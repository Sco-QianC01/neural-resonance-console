import {normalizeSnapshot} from './eeg.mjs';
import {captureSnapshot} from './recording.mjs';
export function describe(values){
 const a=values.filter(Number.isFinite),n=a.length;
 const mean=n?a.reduce((s,x)=>s+x,0)/n:null;
 return {n,mean,sd:n>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean)**2,0)/(n-1)):null,min:n?Math.min(...a):null,max:n?Math.max(...a):null};
}
export function relationDirection(r){
 if(!Number.isFinite(r))return 'insufficient';
 if(r>0)return 'positive';
 if(r<0)return 'negative';
 return 'none';
}
export function pairedCorrelation(x,y){
 const pairs=x.map((v,i)=>[v,y[i]]).filter(p=>p.every(Number.isFinite)),n=pairs.length;
 if(n<3)return {n,r:null,direction:'insufficient'};
 const mx=describe(pairs.map(p=>p[0])).mean,my=describe(pairs.map(p=>p[1])).mean;
 let xx=0,yy=0,xy=0;for(const [a,b] of pairs){xx+=(a-mx)**2;yy+=(b-my)**2;xy+=(a-mx)*(b-my);}
 const r=xx&&yy?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
 return {n,r,direction:relationDirection(r)};
}
export class ListeningTrial{
 constructor(recording,mediaStart,startedAt){
  this.recording=structuredClone(recording);delete this.recording.annotations;delete this.recording.annotation;
  this.mediaStart=mediaStart;this.startedAt=startedAt;this.rows=[];this.packets=[];this.identity=null;this.lastKey=null;this.lastPacket=null;this.segment=0;this.rejected=0;
 }
 accept(packet,music,now,mediaTime){
  let value;try{value=normalizeSnapshot(packet,now);}catch{this.rejected++;return false;}
  const identity=JSON.stringify([packet.source,packet.sessionId,packet.connectionEpoch??null,packet.transport]);
  if(!value.transportFresh||!['device','core'].includes(packet.source)||!['usb','ble'].includes(packet.transport)||now<this.startedAt||value.timestamp<this.startedAt||(this.identity&&identity!==this.identity)){
   this.rejected++;return false;
  }
  this.identity??=identity;
  const packetKey=JSON.stringify([packet.ts,packet.rawSequence??null]);
  if(packetKey!==this.lastPacket&&this.packets.length<20000){this.packets.push(captureSnapshot(packet,value));this.lastPacket=packetKey;}
  if(!value.valid){this.pendingBreak=true;this.rejected++;return false;}
  const at=value.indexTimestamp??value.timestamp,t=mediaTime-(now-at)/1000;
  if(at>now||(this.rows.length&&at<this.rows.at(-1).indexTime)||at<this.startedAt||t<this.mediaStart||!Number.isFinite(t)){this.rejected++;return false;}
  const key=value.indexSampleKey??String(at);if(key===this.lastKey)return false;
  if(this.rows.length&&at===this.rows.at(-1).indexTime)return false;
  if(typeof music==='function')music=music(t);
  if(this.rows.length&&(this.pendingBreak||at-this.rows.at(-1).indexTime>3000))this.segment++;
  this.pendingBreak=false;
  this.lastKey=key;
  this.rows.push({mediaTime:t,indexTime:at,packetTime:value.timestamp,segment:this.segment,
   attention:value.attention,relaxation:value.relaxation,source:packet.source,transport:packet.transport,
   tempo:Number.isFinite(music?.rawTempo??music?.tempo)?music.rawTempo??music.tempo:null,
   level:Number.isFinite(music?.level)?music.level:null,bar:music?.bar??null,
   barPosition:music?.barPosition??null,beatInBar:music?.beatInBar??null,beatsPerBar:music?.beatsPerBar??null,ioi:music?.ioi??null,
   levelSource:music?.levelSource??null,levelUnit:music?.levelUnit??null,dynamicMark:null,
   // Legacy tier columns stay empty; amplitude does not establish score dynamics.
   bands:value.bands,spectralBands:value.spectralBands,dynamicTier:null,
   dynamicTierIndex:null,dynamicTierSource:null,
   linearFitR2:music?.linearFitR2??null,linearityProxyR2:music?.linearityProxyR2??music?.linearFitR2??null,
   linearFitConstant:music?.linearFitConstant??null,tempoJump:music?.tempoJump??null,
   changeProxyLog2:music?.changeProxyLog2??music?.tempoJump??null});return true;
 }
 finish(endedAt){
  if(!this.rows.length)throw new Error('沒有有效的現場設備樣本，未建立試次。');
  const values=key=>this.rows.map(p=>p[key]);
  return {schema:'neural-listening-trial-v1',recording:this.recording,startedAt:this.startedAt,endedAt,mediaStart:this.mediaStart,
   identity:this.identity,rejected:this.rejected,rows:structuredClone(this.rows),packets:structuredClone(this.packets),
   statistics:{attention:describe(values('attention')),relaxation:describe(values('relaxation')),
    tempoAttention:pairedCorrelation(values('tempo'),values('attention')),tempoRelaxation:pairedCorrelation(values('tempo'),values('relaxation')),
    levelAttention:pairedCorrelation(values('level'),values('attention')),levelRelaxation:pairedCorrelation(values('level'),values('relaxation')),
    bandRelations:Object.fromEntries(['delta','theta','alpha','beta'].map(b=>[b,{
      attention:pairedCorrelation(this.rows.map(p=>p.bands?.[b]),values('attention')),
      relaxation:pairedCorrelation(this.rows.map(p=>p.bands?.[b]),values('relaxation'))
    }]))},
   timing:'mediaTime = HTMLMediaElement.currentTime − (packet arrival time − index field time)/1000; audio-output and device clocks not calibrated',
   scoreCoordinates:'integer-bar-v1; barPosition is continuous within-score position; beatInBar is zero-based',
   formulas:'mean=Σx/n; sample SD=√(Σ(x−mean)²/(n−1)); Pearson r=Σ((x−mean_x)(y−mean_y))/√(Σ(x−mean_x)²Σ(y−mean_y)²)',
   limitation:'描述統計與探索性同時相關，未控制時間自相關、偽跡與延遲，不證明耦合、因果、審美同質或療效。'};
 }
}
export function experimentCsv(trials){
 const columns=['version','work','performer','year','media_id','media_time_s','index_time_ms','packet_time_ms','segment','attention','relaxation','tempo_raw','relative_level','dynamic_tier','dynamic_tier_index','dynamic_tier_source','linearity_proxy_r2','change_proxy_log2','bar','bar_position','beat_in_bar','beats_per_bar','ioi_ms','delta','theta','alpha','beta','source','transport','level_source','level_unit','dynamic_mark'];
 const quote=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+@-]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 return '\ufeff'+[columns.join(','),...trials.flatMap((trial,i)=>trial.rows.map(p=>[i+1,trial.recording.title,trial.recording.performer,trial.recording.year,trial.recording.mediaId,p.mediaTime,p.indexTime,p.packetTime,p.segment,p.attention,p.relaxation,p.tempo,p.level,p.dynamicTier,p.dynamicTierIndex,p.dynamicTierSource,p.linearityProxyR2,p.changeProxyLog2,p.bar,p.barPosition,p.beatInBar,p.beatsPerBar,p.ioi,...['delta','theta','alpha','beta'].map(k=>p.bands?.[k]),p.source,p.transport,p.levelSource,p.levelUnit,p.dynamicMark].map(quote).join(',')))].join('\r\n');
}
