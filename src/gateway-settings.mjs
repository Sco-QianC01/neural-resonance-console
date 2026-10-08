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
