import test from 'node:test';
import assert from 'node:assert/strict';
import {identityOptions,selectedProfile,deviceDiagnostic} from '../src/gateway-settings.mjs';
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
test('hardware diagnostics distinguish USB bytes from validated data and never treat an open port as successful acquisition',()=>{
  const blocked=deviceDiagnostic({eeg:{state:'open-waiting-data',reason:'invalid-protocol',bytes:300}});
  assert.match(blocked[0],/無有效協議包/);
  const ready=deviceDiagnostic({eeg:{state:'receiving',bytes:300,validPackets:10},gsr:{state:'disabled'}});
  assert.equal(ready.length,1);assert.match(ready[0],/10 封包/);
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
test('USB adapters without a serial may be selected by location and returned to auto',()=>{
  const profile={vid:6790,pid:29987,serialNumber:'',location:''};
  const [option]=identityOptions([{port:'/dev/cu.wchusbserial1',vid:6790,pid:29987,location:'1-9'}],profile);
  assert.equal(selectedProfile(profile,option.value).location,'1-9');
  assert.equal(selectedProfile(profile,'{}').location,'');
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
