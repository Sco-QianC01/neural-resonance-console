/** Portable USB identities; operating-system port names are display only. */
export function identityOptions(devices,profile){
  if(!Array.isArray(devices)||!profile)return [];
  return devices.filter(d=>d.vid===profile.vid&&d.pid===profile.pid).map(d=>({
    label:`${d.port} · ${d.serialNumber||d.location||d.description||'USB'}`,
    value:JSON.stringify({serialNumber:d.serialNumber||'',location:d.serialNumber?'':d.location||''}),
  }));
}
export function selectedProfile(profile,value){
  const identity=JSON.parse(value||'{}');
  for(const key of ['serialNumber','location']){
    if(typeof (identity[key]??'')!=='string'||(identity[key]||'').length>256)
      throw new Error('無效的USB設備身份。');
  }
  return {...profile,serialNumber:identity.serialNumber||'',location:identity.location||''};
}
