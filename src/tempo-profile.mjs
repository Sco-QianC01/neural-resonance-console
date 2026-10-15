import {musicPoint,timeToBar,timeToScorePosition,tempoSummary,barTicks} from './fusion-model.mjs';
const num=n=>Number(n.toFixed(1)).toString();

/** Source screenshot grammar: score axis, raw beats, Gaussian display curve,
 * dynamics-width band and duration-weighted mean. The band is not uncertainty.
 */
export function drawTempoProfile(canvas,{recording,model,currentTime=0,smooth=true,paired=[],overlay=false,range=null}){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return {hits:[]};
  const dpr=Math.min(globalThis.devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  const theme=getComputedStyle(canvas),token=(k,f)=>theme.getPropertyValue(k).trim()||f;
  const bg=token('--bg','#121315'),fg=token('--text','#e9e8e2'),muted=token('--muted','#a4a5a6');
  const line=token('--line','#303236'),music='#c8ad8c',eeg=token('--accent','#c5d8d3');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const left=w<400?45:57,top=22,right=w-(overlay?48:15),bottom=h-42,pw=right-left,ph=bottom-top;
  const summary=tempoSummary(model.raw),xr=[summary.firstBar,summary.layerEnd??summary.lastBar+1],yr=range??model.tempoRange;
  const sx=x=>left+(x-xr[0])/(xr[1]-xr[0])*pw,sy=y=>bottom-(y-yr[0])/(yr[1]-yr[0])*ph;
  const ticks=barTicks(xr[0],xr[1],Math.max(2,Math.floor(pw/74)));
  ctx.font='10px ui-monospace,Consolas,monospace';ctx.lineWidth=.7;
  for(const bar of ticks){
    ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(sx(bar),top);ctx.lineTo(sx(bar),bottom);ctx.stroke();
    ctx.fillStyle=muted;ctx.textAlign='center';ctx.fillText(String(bar),sx(bar),bottom+17);
  }
  for(let i=0;i<=4;i++){
    const y=bottom-ph*i/4;ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(num(yr[0]+i/4*(yr[1]-yr[0])),left-7,y+3);
    if(overlay){ctx.fillStyle=eeg;ctx.textAlign='left';ctx.fillText(String(i*25),right+7,y+3);}
  }
  ctx.strokeStyle=muted;ctx.strokeRect(left,top,pw,ph);
  ctx.fillStyle=muted;ctx.font='11px "Segoe UI","Microsoft YaHei","NR CJK",sans-serif';ctx.textAlign='left';
  ctx.fillText(recording.annotation.meter==='6/8'?'八分音符/分':recording.annotation.meter==='4/4.'?'附點四分音符/分':'來源拍/分',left,12);
  ctx.textAlign='center';ctx.fillText('小節',left+pw/2,h-5);
  if(overlay){ctx.textAlign='right';ctx.fillStyle=eeg;ctx.fillText('腦電 0–100',right,12);}
  const points=smooth?model.points:model.unsmoothed,hits=[];
  ctx.save();ctx.beginPath();ctx.rect(left,top,pw,ph);ctx.clip();
  // Each band segment is centred on the same displayed curve. Half-width
  // = relative level/100 × 13% of plot height, matching the source convention.
  if(smooth){
    let segment=[],previous=null;
    const band=()=>{
      if(segment.length>2){ctx.fillStyle='#9a9ca1';ctx.globalAlpha=.22;ctx.beginPath();
        segment.forEach((p,i)=>i?ctx.lineTo(p.x,p.y-p.hw):ctx.moveTo(p.x,p.y-p.hw));
        [...segment].reverse().forEach(p=>ctx.lineTo(p.x,p.y+p.hw));ctx.closePath();ctx.fill();}
      segment=[];
    };
    for(const p of points){
      const bar=timeToScorePosition(model.raw,p.t);
      if(bar===null||p.level===null||!Number.isFinite(p.tempo)||previous!==null&&p.segment!==previous){band();previous=p.segment;continue;}
      segment.push({x:sx(bar),y:sy(p.tempo),hw:p.level/100*ph*.13});previous=p.segment;
    }
    band();
  }
  ctx.globalAlpha=.65;ctx.strokeStyle=muted;ctx.setLineDash([5,5]);ctx.beginPath();
  ctx.moveTo(left,sy(summary.mean));ctx.lineTo(right,sy(summary.mean));ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=1;ctx.strokeStyle=music;ctx.lineWidth=1.65;ctx.beginPath();let previous=null;
  for(const p of points){
    const bar=timeToScorePosition(model.raw,p.t);
    if(bar===null||!Number.isFinite(p.tempo)){previous=null;continue;}
    const x=sx(bar),y=sy(p.tempo);
    if(!previous||previous.segment!==p.segment)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    previous=p;
  }
  ctx.stroke();ctx.fillStyle='#c86e62';
  for(const raw of model.raw){
    if(raw.tempo===null)continue;
    const p=musicPoint(recording,model.raw,model.curve,raw.t,smooth);
    const x=sx(raw.barPosition??raw.bar),y=sy(raw.tempo);ctx.beginPath();ctx.arc(x,y,1.65,0,Math.PI*2);ctx.fill();
    if(p)hits.push({x,y,point:p});
  }
  if(overlay){
    for(const [key,color,dash] of [['attention',eeg,[]],['relaxation','#8aafb9',[4,5]]]){
      ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.setLineDash(dash);ctx.beginPath();let prev=null;
      for(const p of paired){
        const bar=timeToScorePosition(model.raw,p.t);if(bar===null){prev=null;continue;}
        const x=sx(bar),y=bottom-p[key]/100*ph;
        if(!prev||prev.run!==p.run||prev.segment!==p.segment)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        prev=p;
      }
      ctx.stroke();ctx.setLineDash([]);
    }
  }
  const bar=timeToScorePosition(model.raw,currentTime),current=musicPoint(recording,model.raw,model.curve,currentTime,smooth);
  if(bar!==null){
    ctx.strokeStyle=fg;ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(sx(bar),top);ctx.lineTo(sx(bar),bottom);ctx.stroke();
    if(current){ctx.globalAlpha=1;ctx.fillStyle=music;ctx.beginPath();ctx.arc(sx(bar),sy(current.tempo),3.3,0,Math.PI*2);ctx.fill();
      hits.push({x:sx(bar),y:sy(current.tempo),point:current});}
  }
  ctx.restore();
  canvas.dataset.layer='profile';canvas.dataset.samples=String(points.length);
  canvas.dataset.rawPoints=String(model.raw.filter(p=>p.tempo!==null).length);
  canvas.dataset.band=smooth&&!!recording.annotation.amp?'relative-dynamics':'none';
  canvas.dataset.mean=String(summary.mean);canvas.dataset.musicTime=String(currentTime);
  canvas.dataset.tempo=current?.tempo??'';canvas.dataset.level=current?.level??'';
  canvas.dataset.rangeX=xr.join(',');canvas.dataset.rangeY=yr.join(',');
  canvas.dataset.plotLeft=String(left);canvas.dataset.plotTop=String(top);
  canvas.dataset.plotWidth=String(pw);canvas.dataset.plotHeight=String(ph);
  canvas.dataset.coordinate=current?`${bar},${current.tempo}`:'';
  canvas.dataset.scoreBar=String(timeToBar(model.raw,currentTime)??'');
  canvas.dataset.barTicks=JSON.stringify(ticks);
  canvas.dataset.pairedSamples=String(overlay?paired.length:0);
  canvas.dataset.plotSize=String(Math.min(pw,ph));
  return {hits,summary};
}
