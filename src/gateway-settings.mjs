/** Portable USB identities; operating-system port names are display only. */
export function identityOptions(devices,profile,{allUsb=false}={}){
  if(!Array.isArray(devices)||!profile)return [];
  return devices.filter(d=>allUsb?Number.isInteger(d.vid)&&Number.isInteger(d.pid)
    :d.vid===profile.vid&&d.pid===profile.pid).map(d=>({
    label:`${d.port} · ${d.serialNumber||d.location||d.description||'USB'}`,
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
export function liveAcquisitionStatus(snapshot,connectionState){
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

/** A running HTTP interface is not proof that a sensor is producing data. */
export function deviceDiagnostic(devices){
  const labels={eeg:'腦電 USB',bloodOxygen:'血氧 USB',gsr:'GSR',ble:'腦電 BLE',watch:'手表心率'};
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
    'watch-unavailable':'等待已配對手表及前台采集端',
    'waiting-permission':'請在手表確認身體傳感器權限',
    'permission-denied':'手表尚未授予身體傳感器權限',
    'waiting-measurement':'請佩戴手表，等待新的心率測量',
    'unreliable':'手表接觸品質待確認',
    'stopped':'手表采集已停止',
    'paused':'手表前台采集已暫停',
    'sensor-unavailable':'手表心率傳感器不可用',
  };
  return Object.entries(devices??{}).filter(([key,row])=>labels[key]&&row.state!=='disabled')
    .map(([key,row])=>`${labels[key]}：${row.state==='receiving'
      ?key==='watch'?`有效資料 · ${row.validPackets??0} 樣本`
        :`有效資料 · ${row.bytes??0} bytes${Number.isInteger(row.validPackets)?` · ${row.validPackets} 封包`:''}`
      :reasons[row.reason]||row.message||row.state||'等待'}`);
}
