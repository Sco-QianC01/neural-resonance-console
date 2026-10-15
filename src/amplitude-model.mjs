import {STALE_MS} from './eeg.mjs';

/** AC amplitude in the input unit, not band power or a calibrated voltage. */
export function acRms(values){
  if(!Array.isArray(values)||!values.length||values.some(v=>!Number.isFinite(v)))return null;
  // Welford's population second moment is stable when a large DC offset exists.
  let mean=0,m2=0,count=0,lo=Infinity,hi=-Infinity;
  for(const value of values){
    count++;const delta=value-mean;mean+=delta/count;m2+=delta*(value-mean);
    lo=Math.min(lo,value);hi=Math.max(hi,value);
  }
  if(![mean,m2,hi-lo].every(Number.isFinite))return null;
  return {rms:Math.sqrt(Math.max(0,m2/count)),mean,peakToPeak:hi-lo,samples:count};
}
export function lightEncoding(rms,reference=100){
  if(!Number.isFinite(reference)||reference<=0)throw new TypeError('振幅顯示參照須大於零');
  if(!Number.isFinite(rms)||rms<0)return {intensity:0,radius:4,halo:0,opacity:.68};
  const intensity=rms/(rms+reference);
  return {intensity,radius:4+2*intensity,halo:intensity?7+19*intensity:0,opacity:.52+.48*intensity};
}
/** Compact presentation only; source values remain unchanged. */
export function formatAmplitude(value){
  if(!Number.isFinite(value)||value<0)return '—';
  const fixed=value.toFixed(1);
  if(value===0||value>=.1&&fixed.length<=7)return fixed;
  const exponent=Math.floor(Math.log10(value));
  return value.toExponential(exponent<=-100?0:exponent>=100?1:2).replace('e+','e');
}
/** A bounded raw-sample window. Identity, unit and reported gaps reset it. */
export class RawAmplitude{
  constructor(){this.reset();}
  reset(){this.values=[];this.identity=null;this.at=null;this.packetTimestamp=null;this.lastPacketAt=null;this.originalTimestamp=null;this.sequence=null;this.packetCount=null;this.rate=null;this.unit='';this.continuityVerified=false;this.timing='packet-delivery-time';}
  push(snapshot){
    if(!snapshot?.signalValid||!Number.isFinite(snapshot.timestamp)){this.reset();return null;}
    const p=snapshot.raw??{},raw=p.rawEegSamples??p.eeg?.rawSamples;
    const unit=typeof p.rawUnit==='string'&&p.rawUnit.trim()?p.rawUnit.slice(0,80):'來源原始值';
    const rate=Number.isFinite(p.sampleRate)&&p.sampleRate>0?p.sampleRate:null;
    const hasSequence=p.rawSequence!==null&&p.rawSequence!==undefined;
    if(hasSequence&&(!Number.isSafeInteger(p.rawSequence)||p.rawSequence<0)){this.reset();return null;}
    const seq=hasSequence?p.rawSequence:null;
    const identity=JSON.stringify([snapshot.source,snapshot.sessionId,snapshot.transport,snapshot.connectionEpoch,unit,rate,hasSequence]);
    if(this.identity!==identity||this.at!==null&&snapshot.timestamp-this.at>STALE_MS){this.reset();this.identity=identity;}
    if(this.lastPacketAt!==null&&snapshot.timestamp<=this.lastPacketAt)return this.value(snapshot.timestamp);
    const field=p.fieldTimestamps??{};
    const rawField=Object.hasOwn(field,'raw')?'raw':Object.hasOwn(field,'rawEegSamples')?'rawEegSamples':null;
    const rawTime=rawField?field[rawField]*1000:snapshot.timestamp;
    if(rawField&&!Number.isFinite(field[rawField])||!Number.isFinite(rawTime)
      ||snapshot.timestamp-rawTime>STALE_MS||rawTime-snapshot.timestamp>5000){this.reset();return null;}
    const lost=Number(p.rawDropped)>0;
    this.lastPacketAt=snapshot.timestamp;
    if(raw!==undefined&&raw!==null&&!Array.isArray(raw)){this.reset();return null;}
    if(!Array.isArray(raw)||!raw.length){
      if(lost||seq!==null&&this.sequence!==null&&seq!==this.sequence){this.values=[];this.at=null;this.sequence=seq;}
      // Remember an empty packet's counter so cached samples cannot appear new.
      if(seq!==null)this.sequence=seq;
      this.packetCount=snapshot.packets;
      return this.value(snapshot.timestamp);
    }
    if(raw.length>8192||raw.some(v=>!Number.isFinite(v))){this.reset();return null;}
    const breaks=p.rawBreaks??[];
    if(!Array.isArray(breaks)||breaks.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=raw.length||i>0&&n<=breaks[i-1])){this.reset();return null;}
    if(seq!==null&&seq<raw.length){this.reset();return null;}
    if(lost){this.values=[];this.at=null;}
    if(this.sequence!==null&&seq!==null&&seq<this.sequence){this.values=[];this.sequence=null;this.at=null;}
    if(this.at!==null&&rawTime<this.at){this.reset();return null;}
    let incoming=raw;
    if(seq!==null){
      if(this.sequence!==null&&seq<=this.sequence)return this.value(snapshot.timestamp);
      const first=seq-raw.length+1;
      if(this.sequence!==null&&first>this.sequence+1||lost)this.values=[];
      if(this.sequence!==null&&first<=this.sequence)incoming=raw.slice(this.sequence-first+1);
    }else if(this.packetCount!==null&&snapshot.packets===this.packetCount)return this.value(snapshot.timestamp);
    if(!incoming.length)return this.value(snapshot.timestamp);
    if(breaks.length&&breaks.at(-1)>=raw.length-incoming.length){this.values=[];incoming=raw.slice(breaks.at(-1));}
    if(lost)this.values=[];
    this.values.push(...incoming);this.values=this.values.slice(-256);
    this.at=rawTime;this.packetTimestamp=snapshot.timestamp;this.sequence=seq;this.packetCount=snapshot.packets;
    this.rate=rate;this.unit=unit;this.source=snapshot.source;this.continuityVerified=seq!==null;
    this.timing=rawField?'source-field-time':'packet-delivery-time';
    const originalField=rawField?p.originalFieldTimestamps?.[rawField]:null;
    this.originalTimestamp=Number.isFinite(originalField)?originalField*1000
      :Number.isFinite(snapshot.originalTimestamp)?snapshot.originalTimestamp+rawTime-snapshot.timestamp:rawTime;
    return this.value(snapshot.timestamp);
  }
  value(now=Date.now()){
    if(this.at===null||now-this.at>STALE_MS||now<this.at-5000||this.values.length<32)return null;
    const a=acRms(this.values);
    if(!a)return null;
    return {...a,unit:this.unit,sampleRate:this.rate,at:this.at,packetTimestamp:this.packetTimestamp,
      originalTimestamp:this.originalTimestamp,timing:this.timing,
      source:this.source,continuityVerified:this.continuityVerified,
      nominalDurationSeconds:this.rate?a.samples/this.rate:null,
      method:'dc-removed-rms-last-continuous-256-samples-v3'};
  }
}
