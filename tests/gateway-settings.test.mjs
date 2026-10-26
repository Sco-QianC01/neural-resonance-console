import test from 'node:test';
import assert from 'node:assert/strict';
import {identityOptions,selectedProfile,deviceDiagnostic,deviceLabel} from '../src/gateway-settings.mjs';
import * as gatewaySettings from '../src/gateway-settings.mjs';
import {StreamState,SCHEMA} from '../src/eeg.mjs';

test('a different compatible USB adapter keeps its actual VID/PID and serial identity after port reassignment',()=>{
  const devices=[{port:'COM18',vid:0x10c4,pid:0xea60,serialNumber:'sensor-A',location:'1-3'},
    {port:'COM19',vid:null,pid:null,serialNumber:'',location:''}];
  const profile={vid:0x483,pid:0x5740,baud:115200};
  assert.equal(identityOptions(devices,profile).length,0);
  const options=identityOptions(devices,profile,{allUsb:true});
  assert.equal(options.length,1);
  const saved=selectedProfile(profile,options[0].value);
  assert.equal(saved.vid,0x10c4);assert.equal(saved.pid,0xea60);
  assert.equal(saved.serialNumber,'sensor-A');assert.equal(saved.baud,115200);
  assert.throws(()=>selectedProfile(profile,JSON.stringify({vid:1,pid:-1})));
});
test('hardware diagnostics name the fault, and a healthy link carries no counters',()=>{
  const blocked=deviceDiagnostic({eeg:{state:'open-waiting-data',reason:'invalid-protocol',bytes:300}});
  assert.match(blocked[0],/無有效協議包/);
  // A streaming link says only that the data is valid. The byte total belonged
  // to whichever transport happened to publish one, so a healthy radio link
  // printed 「有效資料 · 0 bytes」 and read as an empty stream.
  const ready=deviceDiagnostic({eeg:{state:'receiving',bytes:300,validPackets:10},gsr:{state:'disabled'}});
  assert.equal(ready.length,1);
  assert.equal(ready[0],'腦電 USB：有效資料');
  assert.doesNotMatch(ready[0],/bytes|\d/);
  assert.match(deviceDiagnostic({ble:{state:'waiting',reason:'ambiguous-devices'}})[0],/選擇身份/);
});
test('watch diagnostics distinguish pairing and permissions from actual samples',()=>{
  assert.match(deviceDiagnostic({watch:{state:'waiting',reason:'waiting-permission'}})[0],/權限/);
  assert.match(deviceDiagnostic({watch:{state:'waiting',reason:'watch-unavailable'}})[0],/前台/);
  assert.match(deviceDiagnostic({watch:{state:'receiving',validPackets:3}})[0],/3.*樣本/);
  assert.doesNotMatch(deviceDiagnostic({watch:{state:'connecting',reason:'waiting-data'}})[0],/有效資料/);
});
test('cross-platform USB choices retain identity instead of an author COM number',()=>{
  const profile={vid:1155,pid:22336,enabled:true};
  const options=identityOptions([
    {port:'COM25',vid:1155,pid:22336,serialNumber:'A'},
    {port:'/dev/cu.usbmodem9510',vid:1155,pid:22336,serialNumber:'B'},
    {port:'COM7',vid:null,pid:null},
  ],profile);
  assert.equal(options.length,2);
  assert.deepEqual(selectedProfile(profile,options[1].value),
    {...profile,serialNumber:'B',location:''});
  assert.equal(Object.hasOwn(selectedProfile(profile,options[1].value),'port'),false);
});
test('device labels name the hardware; an operating-system port path never reaches the page',()=>{
  const mac={port:'/dev/cu.usbmodem8D7F577753511',description:'STM32 Virtual COM Port',
    vid:0x483,pid:0x5740,serialNumber:'8D7F57775351'};
  // Ten characters, the same cut as Bluetooth: a picker is a one-line list, and
  // the full serial is a 12-character string nobody reads past.
  assert.equal(deviceLabel(mac),'STM32 Virt · 8D7F577753');
  // Two identical adapters without serials stay distinguishable by USB slot,
  // not by the port name the operating system happened to assign.
  assert.equal(deviceLabel({...mac,serialNumber:'',location:'1-3'}),'STM32 Virt · 1-3');
  assert.equal(deviceLabel({...mac,serialNumber:'',location:''}),'STM32 Virt');
  const profile={vid:0x483,pid:0x5740};
  for(const option of identityOptions([mac],profile)){
    assert.doesNotMatch(option.label,/\/dev\/|\.cu\.|\bCOM\d/);
    // The label is cut; the identity the collector matches on is not.
    assert.ok(option.label.length<=23,option.label);
    assert.match(JSON.parse(option.value).serialNumber,/^8D7F57775351$/);
  }
  for(const option of identityOptions([{...mac,port:'COM18'}],profile))
    assert.doesNotMatch(option.label,/\/dev\/|\.cu\.|\bCOM\d/);
});

test('USB adapters without a serial may be selected by location and returned to auto',()=>{
  const profile={vid:6790,pid:29987,serialNumber:'',location:''};
  const [option]=identityOptions([{port:'/dev/cu.wchusbserial1',vid:6790,pid:29987,location:'1-9'}],profile);
  assert.equal(selectedProfile(profile,option.value).location,'1-9');
  assert.equal(selectedProfile(profile,'{}').location,'');
});

test('Bluetooth labels keep the model and drop the unit suffix',()=>{
  const {shortDeviceName}=gatewaySettings;
  assert.equal(shortDeviceName('HR-S0AA758'),'HR-S0AA758');
  assert.equal(shortDeviceName('  HR-S0AA758  '),'HR-S0AA758');
  assert.equal(shortDeviceName('BrainLink-Lite-2024'),'BrainLink');
  assert.equal(shortDeviceName('V+ iPhone 15 Plus'),'V+ iPhone');
  assert.equal(shortDeviceName(''),'');
  assert.equal(shortDeviceName(null),'');
  // The CoreBluetooth identifier must never become the label.
  assert.doesNotMatch(shortDeviceName('81BD5162-0685-EF0B-167C-5E4F84D7FFF2'),/81BD5162/);
});

test('the side badge names the hardware in full, not the ten-character label',()=>{
  const {detectedDevice}=gatewaySettings;
  const devices=[{vid:1155,pid:22336,description:'CP2102 USB to UART Bridge Controller',
    serialNumber:'8D7F57775351',location:'1-3'}];
  // The label is cut to ten characters; the badge keeps the whole description so
  // a truncated label is never the only thing an operator can read.
  assert.deepEqual(detectedDevice({eeg:{serialNumber:'8D7F57775351'},
    ble:{address:''},devices}),{name:'CP2102 USB to UART Bridge Controller',transport:'usb'});
  // A receiving radio is what writes the file, whatever the saved cable identity.
  assert.deepEqual(detectedDevice({eeg:{serialNumber:'8D7F57775351'},devices,
    ble:{address:'addr-1',name:'HR-S0AA758'},bleState:'receiving'}),
  {name:'HR-S0AA758',transport:'ble'});
  // Identified but not saved yet: still the device the collector will connect to.
  assert.deepEqual(detectedDevice({ble:{address:''},
    bleCandidates:[{name:'HR-S0AA758',address:'addr-1'}]}),
  {name:'HR-S0AA758',transport:'ble'});
  assert.deepEqual(detectedDevice({ble:{address:'addr-1'},
    bleNames:new Map([['addr-1','BrainLink-Lite-2024']])}),
  {name:'BrainLink-Lite-2024',transport:'ble'});
  // Ambiguity and identifiers are not names.
  assert.deepEqual(detectedDevice({ble:{address:''},bleCandidates:[
    {name:'HR-S0AA758',address:'a'},{name:'HR-S0AA999',address:'b'}]}),
  {name:'',transport:''});
  assert.deepEqual(detectedDevice({ble:{address:'addr-1',
    name:'81BD5162-0685-EF0B-167C-5E4F84D7FFF2'}}),{name:'',transport:''});
  assert.deepEqual(detectedDevice(),{name:'',transport:''});
});

test('a plugged-in cable is named even before any USB identity is saved',()=>{
  // Live report 2026-10-18: the badge said 設備 · 未連接 while an STM32 was on the
  // bus, because the identity had never been saved and the panel only matched on
  // one. The collector opens the single port whose VID/PID matches its profile, so
  // that is the port the panel must name.
  const {detectedDevice,derivedDeviceLabel}=gatewaySettings;
  const stm32={vid:1155,pid:22336,port:'/dev/cu.usbmodem8D7F577753511',
    description:'STM32 Virtual COM Port',serialNumber:'8D7F57775351',location:'0-1.3'};
  const ghost={vid:null,pid:null,port:'/dev/cu.debug-console',description:'n/a',
    serialNumber:'',location:''};
  const profile={vid:1155,pid:22336,serialNumber:'',location:''};
  assert.deepEqual(detectedDevice({eeg:profile,devices:[ghost,stm32]}),
    {name:'STM32 Virtual COM Port',transport:'usb'});
  // The label keeps ten characters; the badge keeps the whole name.
  assert.equal(derivedDeviceLabel({eeg:profile,devices:[ghost,stm32]}),'STM32 Virt');
  // Two adapters of the same model are not a guess.
  const twin={...stm32,port:'/dev/cu.usbmodem2',serialNumber:'OTHER'};
  assert.deepEqual(detectedDevice({eeg:profile,devices:[stm32,twin]}),{name:'',transport:''});
  assert.equal(derivedDeviceLabel({eeg:profile,devices:[stm32,twin]}),'');
  // Nothing plugged in: the badge says so instead of naming the ghost ports.
  assert.deepEqual(detectedDevice({eeg:profile,devices:[ghost]}),{name:'',transport:''});
  // A radio that is switched off never claims the badge.
  assert.deepEqual(detectedDevice({eeg:profile,devices:[],
    ble:{address:'addr-1',name:'HR-S0AA758',enabled:false}}),{name:'',transport:''});
});

test('an unnamed recording is labelled from the hardware that is actually sending',()=>{
  const {derivedDeviceLabel}=gatewaySettings;
  const devices=[{vid:1155,pid:22336,description:'CP2102 USB to UART Bridge Controller',
    serialNumber:'8D7F57775351',location:'1-3'}];
  // USB wins over Bluetooth: while a cable streams, the collector parks the
  // radio, so the cable is what writes the file.
  assert.equal(derivedDeviceLabel({
    eeg:{vid:1155,pid:22336,serialNumber:'8D7F57775351',location:''},
    ble:{address:'81BD5162-0685-EF0B-167C-5E4F84D7FFF2',name:'HR-S0AA758'},devices}),
  'CP2102 USB');
  // An adapter with no description still has a serial to fall back on, which is
  // also all that is left when the device is unplugged between sessions.
  assert.equal(derivedDeviceLabel({eeg:{serialNumber:'8D7F57775351'},devices:[]}),'8D7F577753');
  assert.equal(derivedDeviceLabel({eeg:{location:'1-3'},
    devices:[{vid:0,pid:0,description:'FT232R USB UART',location:'1-3'}]}),'FT232R USB');
  // Bluetooth names are the remembered model, never the CoreBluetooth address.
  assert.equal(derivedDeviceLabel({ble:{address:'addr-1',name:'HR-S0AA758'},devices:[]}),'HR-S0AA758');
  assert.equal(derivedDeviceLabel({ble:{address:'addr-1',name:''},
    devices:[],bleNames:new Map([['addr-1','BrainLink-Lite-2024']])}),'BrainLink');
  // A remembered cable may be unplugged: once the radio is actually receiving,
  // the headset is what writes the file, whatever identity is saved for USB.
  assert.equal(derivedDeviceLabel({
    eeg:{vid:1155,pid:22336,serialNumber:'8D7F57775351'},devices,
    ble:{address:'addr-1',name:'HR-S0AA758'},bleState:'receiving'}),'HR-S0AA758');
  // Saved but silent Bluetooth never outranks a saved cable.
  assert.equal(derivedDeviceLabel({
    eeg:{serialNumber:'8D7F57775351'},devices,
    ble:{address:'addr-1',name:'HR-S0AA758'},bleState:'scanning'}),'CP2102 USB');
  assert.equal(derivedDeviceLabel({ble:{address:'81BD5162-0685-EF0B-167C-5E4F84D7FFF2',
    name:'81BD5162-0685-EF0B-167C-5E4F84D7FFF2'},devices:[]}),'');
  // No identity at all: nothing to offer, so the field stays empty.
  assert.equal(derivedDeviceLabel({eeg:{},ble:{address:''},devices:[]}),'');
  assert.equal(derivedDeviceLabel(),'');
  // A fresh setup has no saved address yet, but one uniquely matched device is
  // what the collector will connect to, so the label can already name the file.
  assert.equal(derivedDeviceLabel({ble:{address:''},bleCandidates:[
    {name:'HR-S0AA758',address:'addr-1'}]}),'HR-S0AA758');
  assert.equal(derivedDeviceLabel({ble:{address:''},bleCandidates:[
    {name:'HR-S0AA758',address:'addr-1'}],bleNames:new Map([['addr-1','HR-S0AA758']])}),
  'HR-S0AA758');
  // A saved address still wins: the operator's pick is what records.
  assert.equal(derivedDeviceLabel({ble:{address:'addr-2',name:'BrainLink-Lite'},
    bleCandidates:[{name:'HR-S0AA758',address:'addr-1'}]}),'BrainLink');
  // Two matches is ambiguous; guessing one of them would misname the file.
  assert.equal(derivedDeviceLabel({ble:{address:''},bleCandidates:[
    {name:'HR-S0AA758',address:'addr-1'},{name:'HR-S0AA999',address:'addr-2'}]}),'');
  assert.equal(derivedDeviceLabel({ble:{address:''},bleCandidates:[
    {name:'81BD5162-0685-EF0B-167C-5E4F84D7FFF2',address:'addr-1'}]}),'');
});

test('stopping acquisition says stopped instead of repeating the waiting line',()=>{
  const {acquisitionHeadline}=gatewaySettings;
  const identified='腦電 BLE：已識別設備，等待按「開始采集」';
  assert.equal(acquisitionHeadline('',false),'采集已停止');
  assert.equal(acquisitionHeadline(identified,false),`采集已停止 · ${identified}`);
  assert.equal(acquisitionHeadline('',true),'等待 EEG 設備資料');
  assert.equal(acquisitionHeadline('腦電 USB：有效資料',true),'腦電 USB：有效資料');
  // An older collector omits the field; that must not read as stopped.
  assert.equal(acquisitionHeadline(identified,undefined),identified);
});

test('an empty Bluetooth picker names its cause instead of staying silent',()=>{
  const rows=[{name:'iPhone',address:'AA:01'}];
  // Four unrelated causes, four different next steps.
  assert.match(gatewaySettings.bleDiagnostic({enabled:false}).text,/啟動 腦電 BLE/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,status:{state:'standby',reason:'usb-active'}}).text,
    /停止 EEG USB/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,status:{state:'waiting',reason:'device-not-found'}}).text,
    /未發現藍牙設備/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,status:{state:'waiting',reason:'saved-device-missing'},nearby:rows}).text,
    /已保存的藍牙身份/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,status:{state:'waiting',reason:'name-not-matched'},nearby:rows}).text,
    /名稱不符/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,status:{state:'ready',reason:'awaiting-start'}}).text,
    /等待按「開始采集」/);
});

test('a connect in flight, a retry and a silent link each say what they are',()=>{
  // These three used to fall through to 「本次掃描未發現藍牙設備」, which is the one
  // thing none of them means: the device was found, the link is the problem.
  assert.equal(gatewaySettings.bleDiagnostic({enabled:true,
    status:{state:'connecting',reason:'connecting'}}).state,'connecting');
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,
    status:{state:'connecting',reason:'connecting'}}).text,/正在連接藍牙設備/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,
    status:{state:'retrying',reason:'connect-failed'}}).text,/正在自動重試/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,
    status:{state:'connected-waiting-data',reason:'waiting-data'}}).text,/等待有效資料/);
  assert.match(gatewaySettings.bleDiagnostic({enabled:true,
    status:{state:'connected-waiting-data',reason:'invalid-protocol'}}).text,/不是 ThinkGear 資料/);
});

test('a transport switched off is reported before any worker state',()=>{
  // The collector's own status cannot describe a worker that was never created.
  assert.equal(gatewaySettings.bleDiagnostic({enabled:false,status:{state:'receiving'}}).state,'off');
});

test('a stopped acquisition is labelled stopped even with a cached snapshot',()=>{
  assert.deepEqual(gatewaySettings.liveAcquisitionStatus(null,'connected',{running:false}),
    {state:'stopped',text:'采集已停止'});
  assert.deepEqual(gatewaySettings.liveAcquisitionStatus(statusPacket(1000000),'connected',{running:false}),
    {state:'stopped',text:'采集已停止'});
  // Absent field (older collector) must not read as stopped.
  assert.notEqual(gatewaySettings.liveAcquisitionStatus(null,'connected').state,'stopped');
});

const statusPacket=(ts,packets=1,changes={})=>({
  schemaVersion:SCHEMA,source:'device',transport:'usb',sessionId:'status-qa',ts:ts/1000,
  quality:{eegPackets:packets},eeg:{attention:65,meditation:58,poor_signal:0},...changes,
});

function liveStatus(packet,now=1000000,state='connected'){
  const stream=new StreamState();
  if(packet)stream.accept(packet,now);
  return gatewaySettings.liveAcquisitionStatus(stream.current(now),state);
}
test('an open service connection without EEG packets shows waiting, never a connected device',()=>{
  for(const packet of [null,statusPacket(1000000,0),statusPacket(1000000,10,{transport:'none'})]){
    const status=liveStatus(packet);
    assert.equal(status.state,'waiting');
    assert.equal(status.text,'等待腦電設備');
    assert.doesNotMatch(status.text,/已連接|有效|正在采集/);
  }
});
test('the successful acquisition label requires fresh validated EEG indices',()=>{
  assert.deepEqual(liveStatus(statusPacket(1000000)),
    {state:'valid',text:'正在采集 · 指數有效'});
  assert.deepEqual(liveStatus(statusPacket(1000000,1,{eeg:{poor_signal:0}})),
    {state:'receiving',text:'正在采集 · 等待指數'});
  assert.deepEqual(liveStatus(statusPacket(1000000,1,{eeg:{attention:65,meditation:58,poor_signal:50}})),
    {state:'warning',text:'接觸品質待確認'});
});
test('a service heartbeat with unchanged EEG packet count withdraws the success label',()=>{
  const stream=new StreamState(),now=1000000;
  stream.accept(statusPacket(now),now);
  assert.equal(gatewaySettings.liveAcquisitionStatus(stream.current(now),'connected').state,'valid');
  stream.accept(statusPacket(now+3200),now+3200);
  assert.deepEqual(gatewaySettings.liveAcquisitionStatus(stream.current(now+3200),'connected'),
    {state:'stale',text:'腦電資料中斷'});
});
test('hardware removal with transport none immediately returns to waiting even with old counters',()=>{
  const stream=new StreamState(),now=1000000;
  stream.accept(statusPacket(now,9),now);
  stream.accept(statusPacket(now+250,9,{transport:'none'}),now+250);
  assert.equal(gatewaySettings.liveAcquisitionStatus(stream.current(now+250),'connected').state,'waiting');
});
test('a disconnected service cannot retain a successful heading; direct browser devices remain supported',()=>{
  for(const state of ['connecting','reconnecting','error','stopped','invalid']){
    const result=liveStatus(statusPacket(1000000),1000000,state);
    assert.notEqual(result.state,'valid');
    assert.doesNotMatch(result.text,/已連接|指數有效/);
  }
  for(const transport of ['browser_usb','browser_ble']){
    assert.equal(liveStatus(statusPacket(1000000,1,{transport}),1000000,'stopped').state,'valid');
  }
});
test('demo, mock and replay packets do not produce a live device success label',()=>{
  for(const source of ['demo','mock','replay']){
    const result=liveStatus(statusPacket(1000000,1,{source}));
    assert.equal(result.state,'warning');
    assert.doesNotMatch(result.text,/指數有效|正在采集/);
  }
});
test('a bluetooth session never reads as a USB fault in the runtime line',()=>{
  // The line used to append 「EEG USB 未識別」 unconditionally, which during a
  // working radio session reads like an error rather than an absent cable.
  const line=gatewaySettings.runtimeSummary({gateway:'neural-resonance-gateway',
    core:{reachable:true,eegSource:'desktop_ble',ports:{brainlink:''}}});
  assert.match(line,/腦電藍牙/);
  assert.doesNotMatch(line,/未識別/);
  assert.doesNotMatch(line,/desktop_ble/,'internal transport names stay off the page');
});
test('an attached USB device is still named while the radio streams',()=>{
  const line=gatewaySettings.runtimeSummary({core:{reachable:true,eegSource:'desktop_ble',
    ports:{brainlink:'/dev/cu.usbmodem123'}}});
  assert.match(line,/腦電 USB 已識別/);
});
test('a USB session names its transport exactly once',()=>{
  const line=gatewaySettings.runtimeSummary({core:{reachable:true,eegSource:'usb',
    ports:{brainlink:'/dev/cu.usbmodem123'}}});
  assert.match(line,/來源 腦電 USB/);
  assert.equal(line.match(/腦電 USB/g).length,1);
});
test('an idle collector reports no signal instead of naming a transport',()=>{
  const line=gatewaySettings.runtimeSummary({core:{reachable:true,eegSource:'none',ports:{}}});
  assert.match(line,/尚未收到有效腦波/);
  assert.doesNotMatch(line,/來源|未識別/);
});
test('an unreachable core keeps its reconnect wording',()=>{
  assert.match(gatewaySettings.runtimeSummary({core:{reachable:false}}),/核心未運行/);
  assert.match(gatewaySettings.runtimeSummary({}),/核心未運行/);
});
test('the english runtime headline keeps the space between its two words',()=>{
  const words={'獨立採集器':'Standalone Acquisition Service','運行中':'Running',
    '尚未收到有效腦波':'No valid EEG received yet','來源':'Source','腦電藍牙':'EEG Bluetooth'};
  const t=key=>words[key]??key;
  const line=gatewaySettings.runtimeSummary({core:{reachable:true,eegSource:'desktop_ble',
    ports:{}}},t);
  assert.equal(line,'Standalone Acquisition Service Running · Source EEG Bluetooth');
});
