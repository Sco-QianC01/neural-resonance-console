/**
 * Portable USB identities. Operating-system port names never reach the page:
 * the console names a device the way a person recognises it — model, then the
 * serial printed on the hardware — because the port path carries no identity
 * (matching already runs on serialNumber/location) and only varies by platform.
 */
export function deviceLabel(device){
  // Same ten-character rule as Bluetooth: a USB description can be a whole
  // sentence ("STM32 Virtual COM Port"), and the picker is a one-line list.
  const name=shortDeviceName((device?.description||'').trim()||'USB');
  // Serial is on the hardware; location is the USB topology slot and is only
  // needed to tell two identical adapters apart in the picker.
  const identity=shortDeviceName((device?.serialNumber||device?.location||'').trim());
  return identity?`${name} · ${identity}`:name;
}
/**
 * Device names carry a model prefix plus a per-unit suffix (HR-S0AA758 is the
 * model HR-S0A and unit A758). Ten characters keeps the model, which is what a
 * person recognises, and drops the rest without exposing the CoreBluetooth
 * identifier the collector matches on. USB serials and labels use the same cut,
 * so a picker line never runs longer than the panel.
 */
export const DEVICE_NAME_LIMIT = 10;
/** Kept as an alias: the Bluetooth picker names the rule it obeys. */
export const BLE_NAME_LIMIT = DEVICE_NAME_LIMIT;
export function shortDeviceName(name, limit = DEVICE_NAME_LIMIT){
  const text = String(name ?? '').trim();
  // A CoreBluetooth identifier is not a name, even if it arrives in that field.
  if (/^[0-9a-f]{8}-/i.test(text)) return '';
  // A cut that lands on a separator would leave "BrainLink-"; drop it so the
  // label reads as a model name rather than a chopped string.
  return (text.length > limit ? text.slice(0, limit) : text).replace(/[-_.\s]+$/, '');
}

/**
 * The label a recording is filed under when nobody has named the device.
 *
 * Ten characters of the identity that is actually streaming. USB outranks
 * Bluetooth because the collector parks the radio while a cable is sending, so
 * the cable is what will write the file — except when Bluetooth is already
 * receiving: a remembered cable may be unplugged, and then the headset is the
 * device producing data. An adapter with no description falls back to its
 * serial, and a CoreBluetooth identifier never becomes a name. The console fills
 * this into the label field and lets the operator replace it.
 */
/**
 * The cable the collector will actually open.
 *
 * An explicitly saved identity decides first. With nothing saved the collector
 * still opens the single port matching the profile's VID/PID (serial_selection in
 * the gateway), so the panel must name that same port instead of reporting
 * "nothing connected" while a cable is plugged in. Two matches is ambiguous —
 * guessing there would name the wrong hardware.
 */
function cableFor(devices, profile){
  if(profile.serialNumber||profile.location){
    return devices.find(device=>device?.vid!==null&&(profile.serialNumber
      ?device?.serialNumber===profile.serialNumber
      :device?.location===profile.location))??null;
  }
  if(profile.vid==null||profile.pid==null)return null;
  const matches=devices.filter(device=>device?.vid===profile.vid&&device?.pid===profile.pid);
  return matches.length===1?matches[0]:null;
}

/**
 * The hardware behind the label, named in full for the side badge.
 *
 * The label keeps the first ten characters; this is the name those ten came
 * from, so an operator can see which device is actually connected instead of
 * trusting a truncated name. Same priority as derivedDeviceLabel(): a radio that
 * is receiving owns the file, then the cable, then a uniquely identified radio.
 */
export function detectedDevice({eeg,ble,devices=[],bleNames=new Map(),
  bleCandidates=[],bleState=''}={}){
  const profile=eeg??{};
  const address=ble?.address;
  const only=bleCandidates.length===1?bleCandidates[0]:null;
  // The picker rebuild fills the name map, and it runs after the label is
  // painted; a device that has just come back into range is therefore known by
  // address before it is known by name. Read the scan itself so one poll does not
  // report the cable while the radio is the thing that will record.
  const remembered=address?(bleNames.get(address)||(ble?.name??'')
    ||(bleCandidates.find(row=>row.address===address)?.name??''))
    :(only?(bleNames.get(only.address)||(only.name??'')):'');
  // A radio that is switched off is not a source: reporting a remembered name
  // would name hardware that cannot be recording. A CoreBluetooth identifier is
  // not a name either.
  const radio=ble?.enabled!==false||bleState==='receiving';
  const bluetooth=radio&&shortDeviceName(remembered)?String(remembered).trim():'';
  const cable=cableFor(devices, profile);
  const fromCable=(cable?.description??'').trim()||String(profile.serialNumber??'').trim();
  if(bleState==='receiving'&&bluetooth)return {name:bluetooth,transport:'ble'};
  if(fromCable)return {name:fromCable,transport:'usb'};
  if(bluetooth)return {name:bluetooth,transport:'ble'};
  return {name:'',transport:''};
}
export function derivedDeviceLabel({eeg,ble,devices=[],bleNames=new Map(),bleState='',
  bleCandidates=[]}={}){
  const profile=eeg??{};
  const address=ble?.address;
  // A brand-new setup has no saved address yet, but the collector has still
  // identified exactly one device — the one it will connect to, because the name
  // prefixes match it uniquely. Without this the label stays empty until the
  // first save, and the filename falls back to unknown-device in the meantime.
  const only=bleCandidates.length===1?bleCandidates[0]:null;
  // Same rule as the badge: a radio that is switched off and not receiving is not
  // the source, so its remembered name must not be offered as what is connected.
  const radio=ble?.enabled!==false||bleState==='receiving';
  const bluetooth=radio?shortDeviceName(address
    ?(bleNames.get(address)||ble?.name||bleCandidates.find(row=>row.address===address)?.name)
    :(only?bleNames.get(only.address)||only.name:'')):'';
  if(bleState==='receiving'&&bluetooth)return bluetooth;
  const cable=cableFor(devices, profile);
  const fromCable=shortDeviceName(cable?.description)||shortDeviceName(profile.serialNumber);
  if(fromCable)return fromCable;
  return bluetooth;
}

export function identityOptions(devices,profile,{allUsb=false}={}){
  if(!Array.isArray(devices)||!profile)return [];
  return devices.filter(d=>allUsb?Number.isInteger(d.vid)&&Number.isInteger(d.pid)
    :d.vid===profile.vid&&d.pid===profile.pid).map(d=>({
    label:deviceLabel(d),
    value:JSON.stringify({serialNumber:d.serialNumber||'',location:d.serialNumber?'':d.location||'',
      ...(allUsb?{vid:d.vid,pid:d.pid}:{})}),
  }));
}
export function selectedProfile(profile,value){
  const identity=JSON.parse(value||'{}');
  for(const key of ['serialNumber','location']){
    if(typeof (identity[key]??'')!=='string'||(identity[key]||'').length>256)
      throw new Error('無效的USB設備身份。');
  }
  const device={};
  if(Object.hasOwn(identity,'vid')||Object.hasOwn(identity,'pid')){
    for(const key of ['vid','pid']){
      if(!Number.isInteger(identity[key])||identity[key]<0||identity[key]>65535)
        throw new Error('無效的USB型號。');
      device[key]=identity[key];
    }
  }
  return {...profile,...device,serialNumber:identity.serialNumber||'',location:identity.location||''};
}

/** Service reachability is separate from fresh, validated sensor acquisition. */
export function liveAcquisitionStatus(snapshot,connectionState,{running=true}={}){
  // A stopped run outranks every snapshot: the last packet may still be cached,
  // but nothing is being acquired.
  if(running === false) return {state:'stopped',text:'采集已停止'};
  const direct=snapshot?.transport==='browser_usb'||snapshot?.transport==='browser_ble';
  if(connectionState!=='connected'&&!direct){
    const states={
      connecting:{state:'waiting',text:'連接采集服務中'},
      reconnecting:{state:'waiting',text:'采集服務重連中'},
      error:{state:'error',text:'采集服務未連接'},
      stopped:{state:'waiting',text:'采集已停止'},
      invalid:{state:'error',text:'資料格式無效'},
    };
    return states[connectionState]??{state:'waiting',text:'等待資料源'};
  }
  // A disconnected adapter can retain cumulative counters or old indices.
  if(!snapshot||snapshot.transport==='none'||!(snapshot.packets>0))
    return {state:'waiting',text:'等待腦電設備'};
  if(['demo','mock','replay'].includes(snapshot.source))
    return {state:'warning',text:'資料並非即時設備來源'};
  if(!snapshot.transportFresh)return {state:'stale',text:'腦電資料中斷'};
  if(!snapshot.signalValid)return {state:'warning',text:'接觸品質待確認'};
  return snapshot.valid?{state:'valid',text:'正在采集 · 指數有效'}
    :{state:'receiving',text:'正在采集 · 等待指數'};
}

/**
 * A running HTTP interface is not proof that a sensor is producing data.
 *
 * `translate` exists because this text lands in a DOM node: a sentence assembled
 * from raw Traditional fragments is not in the translation table, so
 * translateDocument() falls back to the character map and renders mixed script
 * (「授權後重新啟動」-> 「授权後重新啟动」). Composing through t() keeps every
 * fragment resolved in the active language before the sentence is built.
 */
export function deviceDiagnostic(devices, translate = value => value){
  // watch is the v0.11.6 sensor; it is named here so the row is not silently dropped.
  const labels={eeg:'腦電 USB',bloodOxygen:'血氧 USB',gsr:'GSR',ble:'腦電 BLE',watch:'手錶心率'};
  const reasons={
    'profile-unconfigured':'尚未配置設備型號',
    'device-not-found':'尚未識別相容設備；檢查電源、資料線及廠商驅動',
    'saved-device-missing':'已保存設備未出現；可重新選擇身份',
    'ambiguous-devices':'多台設備匹配，請選擇身份',
    'waiting-data':'尚無有效設備資料',
    'invalid-protocol':'有字節但無有效協議包；核對設備協議及波特率',
    'access-or-port-busy':'端口被占用或權限不足；關閉其他采集程式並檢查權限',
    'disconnected-or-read-error':'已斷線，采集器會重新識別',
    'bluetooth-unavailable-or-denied':'藍牙不可用、權限或連接異常；檢查系統藍牙設定',
    'adb-missing':'未找到ADB入口；請選擇本機ADB程式',
    'watch-unavailable':'等待已配對手錶及前台採集端',
    'waiting-permission':'請在手錶確認身體傳感器權限',
    'permission-denied':'手錶尚未授予身體傳感器權限',
    'waiting-measurement':'請佩戴手錶，等待新的心率測量',
    'unreliable':'手錶接觸品質待確認',
    'stopped':'手錶採集已停止',
    'paused':'手錶前台採集已暫停',
    'sensor-unavailable':'手錶心率傳感器不可用',
    'usb-active':'USB 正在傳送；藍牙掃描暫停',
    'scanning':'正在掃描藍牙設備',
    'name-not-matched':'附近藍牙名稱不符；可在清單選擇',
    'awaiting-start':'已識別設備，等待按「開始采集」',
    'bluetooth-permission':'系統未授權藍牙訪問；授權後重新啟動藍牙采集',
  };
  // No byte or packet counters here. This line answers one question — is the
  // hardware working, and if not, what should the operator do — while the
  // monitoring page already carries 有效封包 for the session. A byte count
  // published by only some transports is worse than none: it printed
  // 「有效資料 · 0 bytes」 on a healthy radio link, which reads as an empty
  // stream rather than as a field that was never filled in.
  // Byte and packet totals stay out: they were published by whichever transport
  // happened to fill the field, so a healthy radio link printed 「有效資料 ·
  // 0 bytes」 and read as an empty stream. The watch sample count is different —
  // it is an integer the watch worker always fills, and it is the only evidence
  // that a measurement is arriving.
  return Object.entries(devices??{}).filter(([key,row])=>labels[key]&&row.state!=='disabled')
    .map(([key,row])=>`${translate(labels[key])}：${row.state==='receiving'
      ?key==='watch'?`${translate('有效資料')} · ${row.validPackets??0} ${translate('樣本')}`
        :translate('有效資料')
      :translate(reasons[row.reason]||row.message||row.state||'等待')}`);
}
/**
 * The one-line runtime summary above the collector panel.
 *
 * Only the transport that is carrying data gets a name. Printing
 * 「EEG USB 未識別」during a Bluetooth session is literally true — no cable is
 * attached — but it reads as a fault in the middle of a working session, and
 * the USB row of 設備設定 already reports USB in detail. A USB device that is
 * present is still worth naming, because "the cable is here but the radio is
 * streaming" is the fact an operator needs before yanking one of them.
 */
const TRANSPORT_LABELS={usb:'腦電 USB',desktop_ble:'腦電藍牙'};
export function runtimeSummary(state, translate = value => value){
  const core=state?.core;
  if(!core?.reachable) return translate('核心未運行；接口保持重連。');
  // Chinese compounds without a space, English needs one:「獨立採集器」+「運行中」
  // reads as "Standalone Acquisition ServiceRunning" without this.
  const mode=translate(state.gateway==='core-proxy'?'既有核心':'獨立採集器');
  const running=translate('運行中');
  const headline=/[A-Za-z]$/.test(mode)?`${mode} ${running}`:`${mode}${running}`;
  const transport=TRANSPORT_LABELS[core.eegSource];
  const parts=[headline,transport?`${translate('來源')} ${translate(transport)}`
    :translate('尚未收到有效腦波')];
  if(core.ports?.brainlink&&core.eegSource!=='usb')
    parts.push(`${translate('腦電 USB')} ${translate('已識別')}`);
  return parts.join(' · ');
}

/**
 * The headline under 本機採集器狀態.
 *
 * Stopping is a decision, not a fault: without this the line keeps repeating the
 * last device state ("waiting for an EEG device") after the operator pressed
 * 停止采集, which reads as if identification had failed.
 */
export function acquisitionHeadline(deviceLine, running, translate = value => value){
  if(running !== false) return deviceLine || translate('等待 EEG 設備資料');
  return deviceLine ? `${translate('采集已停止')} · ${deviceLine}` : translate('采集已停止');
}

/**
 * Why the Bluetooth picker is empty, said in one line.
 *
 * An empty picker has four unrelated causes — the transport is switched off, the
 * USB stream paused the radio, the scan found nothing, or it found devices whose
 * names or saved identity did not match. Naming which one it is turns a silent
 * empty list into a next step.
 */
export function bleDiagnostic({enabled,status,nearby=[]}={}){
  if(!enabled)return {state:'off',text:'藍牙采集未啟動 · 按「啟動 腦電 BLE」開始掃描'};
  const state=status?.state||'';
  if(state==='blocked')return {state,text:'系統未授權藍牙訪問 · 允許後重新按「啟動 腦電 BLE」'};
  if(state==='standby')return {state,text:'USB 正在傳送 · 藍牙掃描暫停；先按「停止 EEG USB」'};
  if(state==='receiving')return {state,text:'藍牙已連線並收到有效資料'};
  if(state==='connecting')return {state,text:'正在連接藍牙設備 · 稍候'};
  // Connected, but the payload is not ThinkGear: the link is healthy, so this
  // must not read as "no device found" — the fix is a UUID or the device mode.
  if(state==='connected-waiting-data')
    return {state,text:status?.reason==='invalid-protocol'
      ?'藍牙已連線 · 但收到的不是 ThinkGear 資料'
      :'藍牙已連線 · 等待有效資料'};
  if(state==='retrying')return {state,text:'藍牙連線中斷 · 正在自動重試'};
  if(state==='ready')return {state,text:'已識別藍牙設備 · 等待按「開始采集」'};
  if(state==='scanning')return {state,text:'正在掃描藍牙設備'};
  if(state==='waiting'){
    const reason=status?.reason;
    if(reason==='saved-device-missing')
      return {state,text:'已保存的藍牙身份本次未出現 · 可在清單重新選擇'};
    if(reason==='name-not-matched')
      return {state,text:'附近的藍牙設備名稱不符 · 可在清單直接選擇'};
    if(reason==='ambiguous-devices')
      return {state,text:'多台藍牙設備同名 · 請在清單指定身份'};
    return {state,text:'本次掃描未發現藍牙設備 · 檢查藍牙電源與系統權限'};
  }
  // No worker status yet: either it has not run once, or the collector is old
  // enough to omit the field. Report the neighbourhood we do have.
  return {state:'unknown',text:nearby.length
    ?'附近的藍牙設備名稱不符 · 可在清單直接選擇'
    :'本次掃描未發現藍牙設備 · 檢查藍牙電源與系統權限'};
}
