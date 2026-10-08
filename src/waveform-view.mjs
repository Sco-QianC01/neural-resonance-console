import {buildWormTrace} from './worm-model.mjs';
const colours={delta:'#f098a2',theta:'#d4df8c',alpha:'#d6a5eb',beta:'#89d6bd'};
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
  const values=history.filter(p=>p.timestamp>=now-60000&&p.timestamp<=now&&(p.transportFresh??p.signalValid)&&Number.isFinite(p.bands?.[key]));
  const max=Math.max(1e-8,...values.map(p=>p.bands[key]));
  if(!mask){
    ctx.strokeStyle='#24323c';ctx.lineWidth=.7;ctx.fillStyle='#8298a4';ctx.font='9px Consolas,monospace';
    for(let i=0;i<4;i++){const y=top+(bottom-top)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-10,y);ctx.stroke();ctx.fillText((max*(1-i/3)).toPrecision(2),3,y+3);}
    for(const seconds of [-60,-45,-30,-15,0])ctx.fillText(`${seconds}s`,pad+(w-pad-20)*(seconds+60)/60-8,offset+h-11);
  }
  ctx.strokeStyle=mask?'#ffffff':colours[key];ctx.lineWidth=mask?3:1.5;ctx.beginPath();
  let previous=null,previousUnit=null;
  for(const p of history){
    if(p.timestamp>now||!(p.transportFresh??p.signalValid)||!Number.isFinite(p.bands?.[key])){previous=null;continue;}
    const x=pad+(w-pad-20)*(1-(now-p.timestamp)/60000),y=bottom-(p.bands[key]/max)*(bottom-top);
    if(x<pad)continue;
    if(!previous||p.timestamp-previous.timestamp>3000||p.connectionEpoch!==previous.connectionEpoch||p.transport!==previous.transport||p.bandUnits!==previousUnit)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    previous=p;
    previousUnit=p.bandUnits;
  }
  ctx.stroke();canvas.dataset.samples=String(values.length);
}

export function drawIndices(canvas,history,now=Date.now()){
  const ratio=Math.min(2,globalThis.devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const left=42,right=w-15,top=16,bottom=h-30;
  ctx.font='9px Consolas,monospace';ctx.fillStyle='#8298a4';ctx.lineWidth=.7;ctx.strokeStyle='#24323c';
  for(const value of [0,25,50,75,100]){
    const y=bottom-(bottom-top)*value/100;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(String(value),6,y+3);
  }
  for(const seconds of [-60,-45,-30,-15,0])ctx.fillText(`${seconds}s`,left+(right-left)*(seconds+60)/60-9,h-9);
  for(const [key,colour] of [['attention','#e2c18a'],['relaxation','#88d2ce']]){
    ctx.strokeStyle=colour;ctx.lineWidth=1.8;ctx.beginPath();let previous=null;
    for(const p of history){
      if(p.timestamp<now-60000||p.timestamp>now||!p.valid||!Number.isFinite(p[key])){previous=null;continue;}
      const x=left+(right-left)*(1-(now-p.timestamp)/60000),y=bottom-p[key]*(bottom-top)/100;
      if(!previous||p.timestamp-previous.timestamp>3000||p.connectionEpoch!==previous.connectionEpoch)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      previous=p;
    }
    ctx.stroke();
  }
}

export function wormViewport(width,height){
  const leftMargin=width<420?38:52,topMargin=28,bottomMargin=40;
  const size=Math.max(1,Math.min(width-leftMargin-24,height-topMargin-bottomMargin));
  return {left:leftMargin+(width-leftMargin-24-size)/2,top:topMargin,size};
}
export function drawWorm(canvas,history,time=0,{space='control',active=true,reduced=false,
  trace=null,layer=null,cursorTimestamp=null}={}){
  const ratio=Math.min(2,globalThis.devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  trace??=buildWormTrace(history,{space});
  const {left,top,size}=wormViewport(w,h),right=left+size,bottom=top+size,points=trace.points;
  const cursor=cursorTimestamp===null?points.at(-1):points.reduce((best,p)=>
    !best||Math.abs(p.timestamp-cursorTimestamp)<Math.abs(best.timestamp-cursorTimestamp)?p:best,null);
  const pos=p=>({x:left+p.x*size,y:bottom-p.y*size});
  ctx.strokeStyle='#343d41';ctx.lineWidth=.7;
  const marks=space==='control'?[0,32,64,96,127]:[0,25,50,75,100];
  for(const mark of marks){
    const f=mark/(space==='control'?127:100);
    const x=left+size*f,y=bottom-size*f;
    ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.fillStyle='#9ea9aa';ctx.font='11px Consolas,monospace';
    ctx.textAlign='right';ctx.fillText(String(mark),left-10,y+4);
    ctx.textAlign='center';ctx.fillText(String(mark),x,bottom+18);ctx.textAlign='left';
  }
  const center=space==='control'?64/127:.5;
  ctx.strokeStyle='#4b7076';ctx.setLineDash([4,6]);ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(left+center*size,top);ctx.lineTo(left+center*size,bottom);
  ctx.moveTo(left,bottom-center*size);ctx.lineTo(right,bottom-center*size);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#b0bbba';ctx.font='11px Consolas,monospace';
  ctx.fillText(`冥想／放鬆 / ${space==='control'?127:100}`,left,16);
  ctx.textAlign='right';ctx.fillText(`專注 / ${space==='control'?127:100}`,right,bottom+36);ctx.textAlign='left';
  ctx.globalAlpha=active?1:.7;
  for(let i=1;i<points.length;i++){
    if(points[i].segment!==points[i-1].segment)continue;
    const a=pos(points[i-1]),b=pos(points[i]),alpha=.18+.67*i/points.length;
    ctx.strokeStyle=`rgba(195,216,208,${alpha})`;ctx.lineWidth=1+1.3*i/points.length;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  const step=Math.max(1,Math.ceil(points.length/80));
  for(let i=0;i<points.length;i+=step){
    const p=pos(points[i]),r=1.3+2*i/Math.max(1,points.length);
    ctx.shadowColor='#bcd7ce';ctx.shadowBlur=reduced?0:4;ctx.fillStyle=`rgba(206,224,213,${.22+.7*i/points.length})`;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;
  if(points.length){
    const start=pos(points[0]);ctx.strokeStyle='#9aaeba';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(start.x,start.y,6,0,Math.PI*2);ctx.stroke();
    ctx.font='11px system-ui';ctx.fillStyle='#becac7';ctx.fillText('起',Math.min(right-14,start.x+10),Math.max(top+12,start.y-10));
    const p=pos(cursor);ctx.fillStyle='#f2f7ed';ctx.shadowColor='#c8ddd0';ctx.shadowBlur=reduced?0:9;
    ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#d5eee7';ctx.fillText(cursor===points.at(-1)?'末':'選',Math.min(right-14,p.x+10),Math.min(bottom-8,p.y+18));
  }
  ctx.globalAlpha=1;canvas.dataset.samples=String(points.length);canvas.dataset.clock=String(time);
  canvas.dataset.segments=String(trace.stats.segments);
  canvas.dataset.coordinate=cursor?`${cursor.rawX},${cursor.rawY}`:'';
  canvas.dataset.space=space;
  canvas.dataset.plotSize=String(size);
}
