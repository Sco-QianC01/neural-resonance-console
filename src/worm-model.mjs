import {mapMusic} from './music.mjs';
import {STALE_MS} from './eeg.mjs';

export const WORM_VERSION='neural-worm-trace-v2';
const clamp=value=>Math.max(0,Math.min(1,value));
const finite=Number.isFinite;
const identity=p=>JSON.stringify([p.source,p.sessionId,p.transport,p.connectionEpoch]);
const usable=p=>p?.valid&&finite(p.timestamp)&&finite(p.attention)&&finite(p.relaxation)
  &&p.attention>=0&&p.attention<=100&&p.relaxation>=0&&p.relaxation<=100;
export const control127=value=>Math.round(clamp(value/100)*127);

/** Raw positions are never moved by the animation clock. Causal smoothing is display only. */
export function buildWormTrace(history,{now=Date.now(),windowSeconds=60,space='control',
  smoothingSeconds=.75,bpmMin=48,bpmMax=108}={}){
  if(!['control','eeg','music'].includes(space)||!finite(windowSeconds)||windowSeconds<1||windowSeconds>600
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
    const music=mapMusic(p,{bpmMin,bpmMax});
    const rawX=space==='music'?(music.parameters.tempo-bpmMin)/(bpmMax-bpmMin)
      :space==='control'?control127(p.attention)/127:p.attention/100;
    const rawY=space==='music'?music.parameters.dynamics/127
      :space==='control'?control127(p.relaxation)/127:p.relaxation/100;
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
  return {version:WORM_VERSION,space,windowSeconds,smoothingSeconds,bpmMin,bpmMax,points,
    currentIdentity,source:latest?.source??null,
    stats:traceStatistics(points),rawPositionsPreserved:true};
}

/** Equal-duration sampling on observed consecutive segments, never across missing data. */
export function traceStatistics(points,{radius=.1,stepMs=250}={}){
  if(!points.length)return {samples:0,seconds:0,coverageSeconds:0,segments:0,
    density:null,dispersion:null,pathLength:0,velocity:null,delta:null};
  const grid=[],segments=new Set();
  let coverage=0,pathLength=0;
  for(let i=0;i<points.length;i++){
    const p=points[i];segments.add(p.segment);
    const prev=points[i-1];
    if(!prev||prev.segment!==p.segment){grid.push({x:p.rawX,y:p.rawY});continue;}
    const dt=p.timestamp-prev.timestamp;
    if(dt<=0||dt>STALE_MS)continue;
    coverage+=dt;pathLength+=Math.hypot(p.rawX-prev.rawX,p.rawY-prev.rawY);
    // Resample the measured piecewise-linear path only for statistics.
    // This does not create or export additional measurement points.
    for(let t=Math.floor(prev.timestamp/stepMs)*stepMs+stepMs;t<=p.timestamp;t+=stepMs){
      const f=(t-prev.timestamp)/dt;
      grid.push({x:prev.rawX+(p.rawX-prev.rawX)*f,y:prev.rawY+(p.rawY-prev.rawY)*f});
    }
  }
  const mean=key=>grid.reduce((sum,p)=>sum+p[key],0)/grid.length;
  const center={x:mean('x'),y:mean('y')};
  const rms=Math.sqrt(grid.reduce((sum,p)=>sum+(p.x-center.x)**2+(p.y-center.y)**2,0)/grid.length);
  let close=0,pairs=0;
  for(let i=0;i<grid.length;i++)for(let j=i+1;j<grid.length;j++){
    pairs++;if(Math.hypot(grid[i].x-grid[j].x,grid[i].y-grid[j].y)<=radius)close++;
  }
  const first=points[0],last=points.at(-1);
  return {samples:points.length,seconds:(last.timestamp-first.timestamp)/1000,
    coverageSeconds:coverage/1000,segments:segments.size,
    density:pairs?close/pairs:null,dispersion:grid.length>1?clamp(rms/Math.SQRT1_2):null,
    pathLength,velocity:coverage>0?pathLength/(coverage/1000):null,
    radius,statisticsStepMs:stepMs,center,
    start:first.controls127,end:last.controls127,
    delta:{attention:last.attention-first.attention,relaxation:last.relaxation-first.relaxation}};
}
