import {acRms} from './amplitude-model.mjs';
/** Source samples, never synthetic interpolation. Sequence gaps break the line. */
export class RawWaveform{
 constructor(){this.reset();}
 reset(){this.rows=[];this.identity=null;this.sequence=null;this.at=null;this.rate=null;this.unit='';this.segment=0;this.dropped=0;this.discontinuities=0;this.extent=0;this.packetCount=null;}
 push(snapshot){
  const p=snapshot?.raw??{},raw=p.rawEegSamples??p.eeg?.rawSamples;
  if(!snapshot?.transportFresh)return;
  if(p.rawSequence!=null&&(!Number.isSafeInteger(p.rawSequence)||p.rawSequence<0))return;
  const at=Number.isFinite(p.fieldTimestamps?.raw)?p.fieldTimestamps.raw*1000:snapshot.timestamp;
  if(!Number.isFinite(at)||snapshot.timestamp-at>3000||at-snapshot.timestamp>5000)return;
  const seq=Number.isSafeInteger(p.rawSequence)&&p.rawSequence>=0?p.rawSequence:null;
  const rate=Number.isFinite(p.sampleRate)&&p.sampleRate>0?p.sampleRate:null;
  const unit=typeof p.rawUnit==='string'&&p.rawUnit.trim()?p.rawUnit.slice(0,80):'來源原始值';
  const identity=JSON.stringify([snapshot.source,snapshot.sessionId,snapshot.transport,snapshot.connectionEpoch,unit,rate,seq!==null]);
  if(!Array.isArray(raw)||!raw.length||raw.length>8192||raw.some(v=>!Number.isFinite(v)))return;
  const breaks=p.rawBreaks??[];
  if(!Array.isArray(breaks)||breaks.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=raw.length||i>0&&n<=breaks[i-1]))return;
  if(identity!==this.identity){this.reset();this.identity=identity;}
  if(this.at!==null&&at<this.at)return;
  if(seq!==null&&seq<raw.length)return;
  if(seq===null&&this.packetCount===snapshot.packets)return;
  if(seq!==null&&this.sequence!==null&&seq<=this.sequence)return;
  let incoming=raw,first=seq===null?(this.sequence??0)+1:seq-raw.length+1;
  if(this.sequence!==null&&first<=this.sequence){incoming=raw.slice(this.sequence-first+1);first=this.sequence+1;}
  const gap=this.sequence!==null?Math.max(0,first-this.sequence-1):0;
  const boundary=gap||p.rawDropped>0||this.at!==null&&snapshot.timestamp-this.at>3000;
  if(boundary){
   this.segment++;this.dropped+=Math.max(gap,Number(p.rawDropped)||0);
  }
  const removed=raw.length-incoming.length,breakSet=new Set(breaks);
  incoming.forEach((value,i)=>{
   if(breakSet.has(removed+i)){this.discontinuities++;if(i||!boundary)this.segment++;}
   this.rows.push({sequence:first+i,value,segment:this.segment});
  });
  this.rows=this.rows.slice(-8192);this.sequence=seq??this.rows.at(-1)?.sequence;
  this.at=at;
  this.packetCount=snapshot.packets;this.rate=rate;this.unit=unit;
  for(const value of incoming){const limit=2**Math.ceil(Math.log2(Math.max(1e-12,Math.abs(value))));this.extent=Math.max(this.extent,Number.isFinite(limit)?limit:Math.abs(value));}
 }
 window(seconds=2){
  const end=this.rows.at(-1)?.sequence??0,count=this.rate?Math.ceil(seconds*this.rate):4096;
  const rows=this.rows.filter(r=>r.sequence>end-count),lastSegment=rows.at(-1)?.segment;
  const stats=acRms(rows.filter(r=>r.segment===lastSegment).map(r=>r.value));
  return {rows,stats,rate:this.rate,unit:this.unit,at:this.at,extent:this.extent,dropped:this.dropped,discontinuities:this.discontinuities,
   start:end-Math.max(1,count),end,seconds:this.rate?count/this.rate:null};
 }
}
/** All extrema survive pixel reduction, including a one-sample negative spike. */
export function waveformEnvelope(rows,start,end,pixels){
 const bins=[];
 for(const row of rows){
  const x=Math.min(pixels-1,Math.max(0,Math.floor((row.sequence-start)/Math.max(1,end-start)*pixels)));
  const last=bins.at(-1);
  if(last?.x===x&&last.segment===row.segment){last.min=Math.min(last.min,row.value);last.max=Math.max(last.max,row.value);last.last=row.value;}
  else bins.push({x,min:row.value,max:row.value,first:row.value,last:row.value,segment:row.segment});
 }
 return bins;
}
export function drawRawWaveform(canvas,state,{seconds=2,extent=null,now=Date.now()}={}){
 const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
 const ratio=Math.min(2,globalThis.devicePixelRatio||1),ctx=canvas.getContext('2d');
 canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const data=state.window(seconds),limit=extent>0?extent:data.extent||1,left=64,right=w-15,top=16,bottom=h-28,mid=(top+bottom)/2;
 const y=value=>mid-value/limit*(bottom-top)/2;
 ctx.font='10px Consolas,monospace';ctx.fillStyle='#a4a5a6';ctx.textAlign='right';
 for(const value of [-limit,-limit/2,0,limit/2,limit]){
  ctx.strokeStyle=value===0?'#687574':'#293132';ctx.lineWidth=value===0?1:.7;ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(right,y(value));ctx.stroke();
  ctx.fillText(Number(value.toPrecision(5)).toString(),left-7,y(value)+3);
 }
 ctx.textAlign='center';
 for(const f of [0,.5,1])ctx.fillText(data.seconds!==null?`${Number((-data.seconds*(1-f)).toFixed(2))} s`:`#${Math.round(data.start+(data.end-data.start)*f)}`,left+(right-left)*f,h-8);
 ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.strokeStyle='#d7e7e1';ctx.lineWidth=1;
 const bins=waveformEnvelope(data.rows,data.start,data.end,Math.max(1,Math.floor(right-left)));
 let previous=null;
 for(const bin of bins){
  const x=left+bin.x;ctx.beginPath();
  if(previous?.segment===bin.segment){ctx.moveTo(left+previous.x,y(previous.last));ctx.lineTo(x,y(bin.first));}
  ctx.moveTo(x,y(bin.min));ctx.lineTo(x,y(bin.max));ctx.stroke();previous=bin;
 }
 ctx.restore();
 Object.assign(canvas.dataset,{samples:String(data.rows.length),positive:String(data.rows.filter(r=>r.value>0).length),
  negative:String(data.rows.filter(r=>r.value<0).length),segments:String(new Set(data.rows.map(r=>r.segment)).size),
  dropped:String(data.dropped),zeroY:String(mid),extent:String(limit),unit:data.unit,stale:String(data.at===null||now-data.at>3000),
  discontinuities:String(data.discontinuities),timeBasis:data.rate?'declared-sample-rate':'sample-sequence',
  gainPxPerUnit:String((bottom-top)/2/limit),sampleRate:data.rate??'',rms:data.stats?.rms??'',peakToPeak:data.stats?.peakToPeak??''});
 return data;
}
