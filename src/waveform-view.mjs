import {mapMusic} from './music.mjs';
const colours={delta:'#e0f4f2',theta:'#9fd9d5',alpha:'#8cb6d4',beta:'#c6d4e7'};
export function drawWaveforms(canvas,history,key,now=Date.now(),{mask=false,row=0,rows=1}={}){
  const ratio=Math.min(2,globalThis.devicePixelRatio||1);
  const width=canvas.clientWidth||1920,height=canvas.clientHeight||1080;
  if(!mask){
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(mask?1:ratio,0,0,mask?1:ratio,0,0);
  const w=mask?canvas.width:width,h=mask?canvas.height/rows:height,offset=mask?row*h:0;
  if(!mask)ctx.clearRect(0,0,w,h);
  const pad=mask?25:48,top=offset+18,bottom=offset+h-32;
  const values=history.filter(p=>p.signalValid&&Number.isFinite(p.bands?.[key]));
  const max=Math.max(1e-8,...values.map(p=>p.bands[key]));
  if(!mask){
    ctx.strokeStyle='#24323c';ctx.lineWidth=.7;ctx.fillStyle='#8298a4';ctx.font='9px Consolas,monospace';
    for(let i=0;i<4;i++){const y=top+(bottom-top)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-10,y);ctx.stroke();ctx.fillText((max*(1-i/3)).toPrecision(2),3,y+3);}
    for(const seconds of [-60,-45,-30,-15,0])ctx.fillText(`${seconds}s`,pad+(w-pad-20)*(seconds+60)/60-8,offset+h-11);
  }
  ctx.strokeStyle=mask?'#ffffff':colours[key];ctx.lineWidth=mask?3:1.5;ctx.beginPath();
  let previous=null;
  for(const p of history){
    if(!p.signalValid||!Number.isFinite(p.bands?.[key])){previous=null;continue;}
    const x=pad+(w-pad-20)*(1-(now-p.timestamp)/60000),y=bottom-(p.bands[key]/max)*(bottom-top);
    if(x<pad)continue;
    if(!previous||p.timestamp-previous.timestamp>3000)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    previous=p;
  }
  ctx.stroke();canvas.dataset.samples=String(values.length);
}

export function drawWorm(canvas,history,time=0,{space='eeg',active=true,reduced=false}={}){
  const ratio=Math.min(2,globalThis.devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const pad=42,points=history.filter(p=>p.valid).slice(-120).map(p=>{
    const mapping=mapMusic(p);
    return {x:space==='music'?(mapping.parameters.tempo-48)/60:p.attention/100,
      y:space==='music'?mapping.parameters.dynamics/127:p.relaxation/100,timestamp:p.timestamp};
  });
  ctx.strokeStyle='#23313c';ctx.lineWidth=.6;
  for(let i=0;i<=4;i++){
    const x=pad+(w-2*pad)*i/4,y=pad+(h-2*pad)*i/4;
    ctx.beginPath();ctx.moveTo(x,pad);ctx.lineTo(x,h-pad);ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();
    ctx.fillStyle='#718995';ctx.font='9px Consolas,monospace';
    ctx.fillText(String(Math.round((space==='music'?127:100)*(1-i/4))),8,y+3);
    ctx.fillText(String(Math.round(space==='music'?48+60*i/4:100*i/4)),x-7,h-pad+16);
  }
  ctx.fillStyle='#8298a4';ctx.font='10px Consolas,monospace';
  ctx.fillText(space==='music'?'力度 / 127':'放鬆度 / 100',pad,17);
  ctx.textAlign='right';ctx.fillText(space==='music'?'速度 48 → 108 BPM':'專注度 0 → 100',w-pad,h-12);ctx.textAlign='left';
  const pos=p=>({x:pad+p.x*(w-2*pad),y:h-pad-p.y*(h-2*pad)});
  ctx.globalAlpha=active?1:.25;
  for(let i=1;i<points.length;i++){
    if(points[i].timestamp-points[i-1].timestamp>3000)continue;
    const a=pos(points[i-1]),b=pos(points[i]),alpha=.12+.55*i/points.length;
    ctx.strokeStyle=`rgba(176,235,228,${alpha})`;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  const step=Math.max(1,Math.floor(points.length/40));
  for(let i=0;i<points.length;i+=step){
    const p=pos(points[i]),r=1.3+2*i/Math.max(1,points.length);
    ctx.shadowColor='#8eddde';ctx.shadowBlur=reduced?0:10;ctx.fillStyle=`rgba(184,240,231,${.15+.65*i/points.length})`;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;
  if(points.length){
    const p=pos(points.at(-1));ctx.fillStyle='#ecfffa';ctx.shadowColor='#99e8db';ctx.shadowBlur=reduced?0:18;
    ctx.beginPath();ctx.arc(p.x,p.y,5+(reduced?0:Math.sin(time)*.8),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;canvas.dataset.samples=String(points.length);canvas.dataset.clock=String(time);
}
