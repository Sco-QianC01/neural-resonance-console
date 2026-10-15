/** Music observations and display transforms. No physiological inference. */
const finite=Number.isFinite;
export function beatIntervals(a){
  if(!Array.isArray(a?.t)||a.t.length<2||a.t.length>50000||
    a.t.some((t,i)=>!finite(t)||t<0||(i&&t<=a.t[i-1])))throw new Error('無效或非遞增的拍點');
  const bpb=a.bpb??1,bar0=a.bar0??1;
  if(!Number.isInteger(bpb)||bpb<=0||!Number.isInteger(bar0)||bar0<1)throw new Error('無效的小節起點或每小節拍數');
  let segment=0,wasGap=false;
  return a.t.slice(0,-1).map((t,i)=>{
    const d=a.t[i+1]-t,w=a.w?.[i]??1;
    if(w>0&&wasGap)segment++;wasGap=w<=0;
    const bar=bar0+Math.floor(i/bpb),beatInBar=i%bpb;
    return {t,end:a.t[i+1],tempo:w>0?w*60/d:null,ioi:d*1000,
      bar,barPosition:bar+beatInBar/bpb,beatInBar,beatsPerBar:bpb,weight:w,segment};
  });
}
/** TIME/LABEL and note-level marks do not establish a beat unit. */
export function onsetIntervals(a,duration=Infinity){
  return beatIntervals(a).filter(p=>p.end<=duration).map(p=>({...p,tempo:null,bar:null,barPosition:null,beatInBar:null,beatsPerBar:null}));
}
/** Yang 2007 display convention: uniform grid, W=2σ, Gaussian support ±3σ.
 * Linear interpolation is a documented display curve, never new beat marks.
 * Nonmusical intervals remain gaps, and smoothing does not cross them.
 */
export function gaussianTempo(rows,width,step=.05){
  if(!rows.length)return [];
  if(!finite(width)||width<0||!finite(step)||step<=0)throw new Error('無效的平滑窗口');
  const first=rows[0].t,end=rows.at(-1).end,count=Math.floor((end-first)/step)+1;
  if(count>100000)throw new Error('曲線超過容量');
  let k=0,segment=0,previous=null;
  const grid=[];
  for(let j=0;j<count;j++){
    const t=first+j*step;
    while(k<rows.length-1&&rows[k+1].t<=t)k++;
    const p=rows[k],q=rows[k+1],valid=p.tempo!==null;
    if(valid&&previous===false)segment++;
    let tempo=p.tempo;
    if(valid&&q?.tempo!==null&&q&&t>p.t)tempo=p.tempo+(q.tempo-p.tempo)*(t-p.t)/(q.t-p.t);
    grid.push({t,tempo:valid?tempo:null,segment});previous=valid;
  }
  if(!width)return grid;
  const sigma=width/2,K=Math.max(1,Math.round(3*sigma/step));
  const weights=Array.from({length:2*K+1},(_,i)=>Math.exp(-(((i-K)*step)**2)/(2*sigma*sigma)));
  return grid.map((p,j)=>{
    if(p.tempo===null)return p;
    let sum=0,total=0;
    for(let i=Math.max(0,j-K);i<=Math.min(grid.length-1,j+K);i++){
      if(grid[i].tempo===null||grid[i].segment!==p.segment)continue;
      const w=weights[i-j+K];sum+=grid[i].tempo*w;total+=w;
    }
    return {...p,tempo:sum/total};
  });
}
export function musicPoint(recording,rows,curve,t,smoothing=true){
  if(!finite(t))return null;
  const raw=rows.find(p=>t>=p.t&&t<p.end);
  if(!raw||raw.weight<=0)return null;
  let tempo=raw.tempo;
  if(smoothing&&curve.length){
    const step=curve.length>1?curve[1].t-curve[0].t:.05;
    const index=Math.max(0,Math.min(curve.length-1,Math.floor((t-curve[0].t)/step)));
    const p=curve[index],q=curve[index+1];
    tempo=q&&q.tempo!==null&&p.tempo!==null?
      p.tempo+(q.tempo-p.tempo)*(t-p.t)/(q.t-p.t):p.tempo;
  }
  const a=recording.annotation.amp,j=a?Math.floor(t/a.dt):-1;
  const level=a&&j>=0&&j<a.v.length-1&&finite(a.v[j])&&finite(a.v[j+1])?
    a.v[j]+(a.v[j+1]-a.v[j])*(t/a.dt-j):
    a&&t===j*a.dt&&j>=0&&j<a.v.length&&finite(a.v[j])?a.v[j]:null;
  return {t,tempo,rawTempo:raw.tempo,ioi:raw.ioi,level,
    levelSource:level===null?null:'vmus-2007-smoothed-amplitude',
    levelUnit:level===null?null:'source-relative-0-100',dynamicMark:null,bar:raw.bar,
    barPosition:raw.barPosition??raw.bar,beatInBar:raw.beatInBar??null,
    beatsPerBar:raw.beatsPerBar??null,segment:raw.segment};
}
/** A bar number identifies one observed layer over a left-closed interval. */
export function timeToBar(rows,t){
  if(!finite(t))return null;
  const p=rows.find(p=>t>=p.t&&t<p.end);
  return p?.weight>0&&Number.isInteger(p.bar)?p.bar:null;
}
/** Continuous score position preserves sub-bar timing, including the final boundary. */
export function timeToScorePosition(rows,t){
  if(!finite(t)||!rows.length||t<rows[0].t||t>rows.at(-1).end)return null;
  const i=rows.findIndex(p=>t>=p.t&&t<p.end);
  const k=i<0?rows.length-1:i,p=rows[k];
  if(p.weight<=0||!finite(p.bar))return null;
  const start=p.barPosition??p.bar,step=p.beatsPerBar?1/p.beatsPerBar:k?start-(rows[k-1].barPosition??rows[k-1].bar):1;
  return start+step*(t-p.t)/(p.end-p.t);
}
export function barTicks(first,last,maxTicks=5){
  if(!finite(first)||!finite(last))return [];
  const lo=Math.ceil(first),hi=Math.floor(last);
  if(hi<lo)return [];
  const count=Math.max(1,Math.min(hi-lo+1,maxTicks));
  return [...new Set(Array.from({length:count},(_,i)=>Math.round(lo+i*(hi-lo)/Math.max(1,count-1))))];
}
/** A viewport over observed integer layers; source rows remain intact. */
export function barLayerWindow(rows,t,limit=8){
  const bars=[...new Set(rows.filter(p=>p.weight>0&&Number.isInteger(p.bar)).map(p=>p.bar))];
  if(!bars.length)return null;
  const current=timeToBar(rows,t),index=current===null?(t<rows[0].t?0:bars.length-1):bars.indexOf(current);
  const count=limit===0?bars.length:Math.max(1,Math.min(bars.length,Number.isInteger(limit)&&limit>0?limit:8));
  const offset=Math.max(0,Math.min(bars.length-count,index-Math.floor(count/2)));
  const visible=bars.slice(offset,offset+count);
  return {bars:visible,first:visible[0],last:visible.at(-1),current};
}
export function tempoSummary(rows){
  const valid=rows.filter(p=>p.weight>0&&finite(p.tempo));
  const seconds=valid.reduce((s,p)=>s+p.end-p.t,0);
  return {seconds,mean:seconds?valid.reduce((s,p)=>s+p.weight,0)*60/seconds:null,
    firstBar:rows[0]?.bar??null,lastBar:rows.at(-1)?.bar??null,
    firstBarPosition:rows[0]?.barPosition??rows[0]?.bar??null,
    lastBarPosition:rows.length?timeToScorePosition(rows,rows.at(-1).end):null,
    layerEnd:rows.length&&finite(rows.at(-1).bar)?rows.at(-1).bar+1:null};
}
export function musicExtent(rows){
  const values=rows.map(p=>p.tempo).filter(finite);
  const low=Math.min(...values),high=Math.max(...values),pad=Math.max(4,(high-low)*.08);
  return values.length?[Math.max(0,Math.floor((low-pad)/5)*5),Math.ceil((high+pad)/5)*5]:[0,120];
}
/** Exact interval steps plus source amplitude grid; left limits are drawing
 * vertices, not selectable observations at the following interval's time.
 */
export function rawMusicPoints(recording,rows){
  const amp=recording.annotation.amp;
  const times=[...new Set([...rows.map(r=>r.t),
    ...(amp?amp.v.map((_,i)=>i*amp.dt):[])])].sort((a,b)=>a-b);
  const points=[];let previous=null;
  for(const t of times){
    const p=musicPoint(recording,rows,[],t,false);
    if(!p){previous=null;continue;}
    if(previous&&p.segment===previous.segment&&(p.rawTempo!==previous.rawTempo||p.ioi!==previous.ioi))
      points.push({...p,bar:previous.bar,beatInBar:previous.beatInBar,tempo:previous.rawTempo,rawTempo:previous.rawTempo,ioi:previous.ioi,pickable:false});
    points.push(p);previous=p;
  }
  return points;
}
/** Explicit viewport zoom, clamped within native 0–100; inputs remain untouched. */
export function zoomRange(value,span=100){
  const size=[25,50,100].includes(span)?span:100;
  const low=Math.max(0,Math.min(100-size,(finite(value)?value:50)-size/2));
  return [low,low+size];
}
/** Align newly observed index time to the active media run, never its old history. */
export function alignEEG(point,{wallNow,mediaTime,startedAt,run}){
  const at=point?.indexTimestamp??point?.timestamp;
  if(!finite(at)||!finite(mediaTime)||!finite(wallNow)||at<startedAt||wallNow-at<0||wallNow-at>3000)return null;
  const t=mediaTime-(wallNow-at)/1000;
  if(t<0)return null;
  return {...point,t,run,indexTimestamp:at};
}
