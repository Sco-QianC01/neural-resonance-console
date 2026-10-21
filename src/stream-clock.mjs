const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const STREAM_CLOCK='neural-stream-clock-v1';
/** A display/expiry clock; original device and host wall times are kept separately. */
export function observationNow(){
  const p=globalThis.performance;
  return finite(p?.timeOrigin)&&typeof p.now==='function'?p.timeOrigin+p.now():Date.now();
}
export function hasStreamClock(packet){
  if(packet?.clock==null)return false;
  if(packet.clock.schema!==STREAM_CLOCK||!finite(packet.clock.monotonicMs)||packet.clock.monotonicMs<0
    ||!Number.isSafeInteger(packet.packetSequence)||packet.packetSequence<1
    ||typeof packet.sessionId!=='string'||!packet.sessionId||packet.sessionId.length>128)
    throw new Error('無效的采集會話時鐘或封包序號。');
  return true;
}

/** Map one gateway session to a continuous local timeline, without altering its source packet. */
export class PacketClock{
  constructor(){this.reset();}
  reset(){this.identity=null;this.sequence=null;this.mono=null;this.anchor=null;this.local=null;}
  map(packet,now=observationNow()){
    if(!hasStreamClock(packet))return packet;
    if(!['neural-resonance-live-v1','frontal-live-v1'].includes(packet.schemaVersion)||!finite(packet.ts))
      throw new Error('無效的采集資料格式或原始時間戳。');
    const identity=JSON.stringify([packet.source,packet.sessionId]),mono=packet.clock.monotonicMs;
    const same=identity===this.identity;
    if(same&&(packet.packetSequence<=this.sequence||mono<this.mono))return null;
    const anchor=same?this.anchor:mono,local=same?this.local:now,timestamp=local+mono-anchor;
    if(!finite(timestamp)||timestamp>now+5000)return null;
    const at=age=>finite(age)&&age>=0?(timestamp-age)/1000:null;
    const fieldTimestamps=Object.fromEntries([...new Set([
      ...Object.keys(packet.eeg??{}),...Object.keys(packet.fieldTimestamps??{}),
      ...Object.keys(packet.fieldAgesMs??{}),
    ])].map(key=>[key,at(packet.fieldAgesMs?.[key])]));
    const sensorTimestamps=Object.fromEntries(['spo2','pr','hrv','gsr']
      .map(key=>[key,at(packet.sensorAgesMs?.[key])]));
    const pair=packet.indexPair;
    const ages=Object.values(packet.fieldAgesMs??{}).filter(v=>finite(v)&&v>=0);
    const result={...packet,ts:timestamp/1000,displayTimeBasis:'gateway-monotonic',
      originalTimestamp:packet.originalTimestamp??packet.ts*1000,
      originalFieldTimestamps:packet.originalFieldTimestamps??packet.fieldTimestamps??null,
      originalSensorTimestamps:packet.originalSensorTimestamps??packet.sensorTimestamps??null,
      originalLastSampleAt:packet.originalLastSampleAt??packet.lastSampleAt??null,
      originalIndexPair:packet.originalIndexPair??pair??null,
      fieldTimestamps,sensorTimestamps,
      lastSampleAt:ages.length?at(Math.min(...ages)):null,
      indexPair:pair&&typeof pair==='object'?{...pair,at:at(pair.ageMs)}:null};
    Object.assign(this,{identity,sequence:packet.packetSequence,mono,anchor,local});
    return result;
  }
}
