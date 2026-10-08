import {mapMusic} from './music.mjs';
import {STALE_MS} from './eeg.mjs';

export const WORM_VERSION='evidence-trace-v3';
const clamp=value=>Math.max(0,Math.min(1,value));
const finite=Number.isFinite;
const identity=p=>JSON.stringify([p.source,p.sessionId,p.transport,p.connectionEpoch]);
const usable=p=>p?.valid&&finite(p.timestamp)&&finite(p.attention)&&finite(p.relaxation)
  &&p.attention>=0&&p.attention<=100&&p.relaxation>=0&&p.relaxation<=100;
export const control127=value=>Math.round(clamp(value/100)*127);

/** Raw positions are never moved by the animation clock. Causal smoothing is display only. */
export function buildWormTrace(history,{now=Date.now(),windowSeconds=60,space='control',
  smoothingSeconds=0}={}){
  if(!['control','eeg'].includes(space)||!finite(windowSeconds)||windowSeconds<1||windowSeconds>600
    ||!finite(smoothingSeconds)||smoothingSeconds<0||smoothingSeconds>5)
    throw new Error('無效的蠕蟲座標、窗口或平滑設定。');
  const rows=history.filter(p=>finite(p?.timestamp)&&p.timestamp<=now);
  const latest=rows.at(-1);
  const currentIdentity=latest?identity(latest):null;
  const points=[];
  let last=null,segment=-1,lastPackets=null,buffer=[];
  for(const p of rows){
    if(p.timestamp<now-windowSeconds*1000||identity(p)!==currentIdentity){last=null;buffer=[];continue;}
    if(!usable(p)){last=null;buffer=[];continue;}
    // Hardware counts must advance; transport heartbeats do not create trajectory samples.
    if(last&&p.timestamp<=last.timestamp)continue;
    if(p.packets!==undefined&&p.packets===lastPackets)continue;
    const gap=!last||p.timestamp-last.timestamp>STALE_MS;
    if(gap){segment++;buffer=[];}
    const music=mapMusic(p);
    const rawX=space==='control'?control127(p.attention)/127:p.attention/100;
    const rawY=space==='control'?control127(p.relaxation)/127:p.relaxation/100;
    const point={timestamp:p.timestamp,rawX,rawY,x:rawX,y:rawY,segment,
      attention:p.attention,relaxation:p.relaxation,
      controls127:{attention:control127(p.attention),relaxation:control127(p.relaxation)},
      source:p.source,sessionId:p.sessionId,connectionEpoch:p.connectionEpoch,
      musicalParameters:music.parameters};
    buffer.push(point);
    if(smoothingSeconds>0){
      const sigma=smoothingSeconds*1000/2;
      buffer=buffer.filter(q=>p.timestamp-q.timestamp<=3*sigma);
      // Time support weights keep high-rate packets from dominating low-rate intervals.
      let total=0,x=0,y=0;
      for(let j=0;j<buffer.length;j++){
        const q=buffer[j],next=buffer[j+1];
        const support=next?Math.max(1,next.timestamp-q.timestamp)
          :Math.max(1,j?q.timestamp-buffer[j-1].timestamp:1);
        const weight=support*Math.exp(-.5*((p.timestamp-q.timestamp)/sigma)**2);
        total+=weight;x+=q.rawX*weight;y+=q.rawY*weight;
      }
      point.x=x/total;point.y=y/total;
    }
    points.push(point);last=p;lastPackets=p.packets??null;
  }
  return {version:WORM_VERSION,space,windowSeconds,smoothingSeconds,points,
    currentIdentity,source:latest?.source??null,
    stats:traceStatistics(points),rawPositionsPreserved:true};
}

/** Time integrals along observed consecutive straight segments; no invented samples. */
export function traceStatistics(points){
  if(!points.length)return {samples:0,seconds:0,coverageSeconds:0,segments:0,
    density:null,dispersion:null,standardDistance:null,mean:null,
    pathLength:0,velocity:null,samplingHz:null,delta:null};
  const segments=new Set();
  let coverage=0,pathLength=0,integralX=0,integralY=0,integralSquare=0,intervals=0;
  for(let i=0;i<points.length;i++){
    const p=points[i];segments.add(p.segment);
    const prev=points[i-1];
    if(!prev||prev.segment!==p.segment)continue;
    const dt=p.timestamp-prev.timestamp;
    if(dt<=0||dt>STALE_MS)continue;
    const x0=prev.attention,x1=p.attention,y0=prev.relaxation,y1=p.relaxation;
    coverage+=dt;intervals++;
    pathLength+=Math.hypot(x1-x0,y1-y0);
    integralX+=dt*(x0+x1)/2;integralY+=dt*(y0+y1)/2;
    integralSquare+=dt*(x0*x0+x0*x1+x1*x1+y0*y0+y0*y1+y1*y1)/3;
  }
  const mean=coverage?{attention:integralX/coverage,relaxation:integralY/coverage}:null;
  const standardDistance=coverage?Math.sqrt(Math.max(0,integralSquare/coverage
    -mean.attention**2-mean.relaxation**2)):null;
  const first=points[0],last=points.at(-1);
  return {samples:points.length,seconds:(last.timestamp-first.timestamp)/1000,
    coverageSeconds:coverage/1000,segments:segments.size,
    density:null,dispersion:null,standardDistance,mean,
    pathLength,velocity:coverage>0?pathLength/(coverage/1000):null,
    samplingHz:coverage?intervals/(coverage/1000):null,
    units:'native-index',method:'time-weighted-standard-distance-linear-segments-v1',
    start:first.controls127,end:last.controls127,
    delta:{attention:last.attention-first.attention,relaxation:last.relaxation-first.relaxation}};
}
