import {ComparisonScene} from './comparison-scene.mjs';
import {timeBounds,temporalProjection} from './temporal-model.mjs';
import {lightEncoding} from './amplitude-model.mjs';
import {timeToBar,barLayerWindow,barTicks,musicExtent} from './fusion-model.mjs';
/** Orthographic source-time view, rendered without a WebGL dependency. */
export class TemporalScene extends ComparisonScene{
 constructor(host,options={}){
  super(host,options);this.camera={yaw:.58,pitch:.38};this.drag=null;this.moved=false;
  this.canvas.removeEventListener('keydown',this.musicKey);
  this.musicKeyboard=e=>{if(!this.isTime())this.musicKey(e);};
  this.canvas.addEventListener('keydown',this.musicKeyboard);
  this.canvas.removeEventListener('click',this.pick);
  this.timePick=e=>{
   if(!this.isTime())return this.pick(e);
   if(this.moved){this.moved=false;e.stopImmediatePropagation();return;}
   if(this.state.comparison)return;
   const rect=this.canvas.getBoundingClientRect();let closest=null,distance=15;
   for(const p of this.state.points){const q=this.projection?.point(p);if(!q)continue;
    const d=Math.hypot(q.x-e.clientX+rect.left,q.y-e.clientY+rect.top);if(d<distance){distance=d;closest=p;}}
   if(closest)options.onPick?.(closest.timestamp);
  };
  this.down=e=>{if(!this.isTime()||e.button!==0)return;
   this.drag={x:e.clientX,y:e.clientY,...this.camera};this.moved=false;this.canvas.setPointerCapture(e.pointerId);};
  this.move=e=>{if(!this.drag)return;
   const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(dx,dy)<4&&!this.moved)return;
   this.moved=true;this.camera={yaw:Math.max(-1.1,Math.min(1.1,this.drag.yaw+dx*.005)),pitch:Math.max(.08,Math.min(.9,this.drag.pitch+dy*.004))};this.render();};
  this.up=()=>{this.drag=null;};
  this.keys=e=>{if(!this.isTime())return;
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();
   if(e.key==='Home')this.camera={yaw:.58,pitch:.38};
   else{if(e.key==='ArrowLeft'||e.key==='ArrowRight')this.camera.yaw=Math.max(-1.1,Math.min(1.1,this.camera.yaw+(e.key==='ArrowRight'?.08:-.08)));
    else this.camera.pitch=Math.max(.08,Math.min(.9,this.camera.pitch+(e.key==='ArrowDown'?.06:-.06)));}
   this.render();};
  for(const [event,listener] of [['click',this.timePick],['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.up],['keydown',this.keys]])this.canvas.addEventListener(event,listener);
 }
 isTime(){return this.state.space==='time'&&(!this.state.comparison||['worm','structure'].includes(this.state.comparison.layer));}
 render(){
  if(!this.isTime()){
   for(const key of ['space','elapsed','camera'])delete this.canvas.dataset[key];
   if(this.state.comparison)for(const key of ['coordinate','timestamp','rms','intensity','halo','rangeX','rangeY'])delete this.canvas.dataset[key];
   else this.canvas.dataset.space='plane';
   this.canvas.style.touchAction='pan-y';return super.render();
  }
  const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
  const canvas=this.canvas;for(const key of ['musicTime','tempo','level','ioi','mean','band','rawPoints','plotWidth','plotHeight','plotLeft','plotTop','plotSize'])delete canvas.dataset[key];
  const dpr=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const style=getComputedStyle(this.host),token=(k,f)=>style.getPropertyValue(k).trim()||f;
  const theme=this.theme={background:token('--bg','#121315'),muted:token('--muted','#a4a5a6'),signal:token('--accent','#c5d8d3')};
  ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);
  const music=this.state.comparison,structural=music?.layer==='structure';
  const layers=music?barLayerWindow(music.model.raw,music.time,music.barWindow??8):null;
  const original=music?(structural?music.model.structure:music.points):this.state.points;
  const convert=p=>music?{...p,attention:structural?p.linearity:p.tempo,relaxation:structural?p.jump:p.level,
   timestamp:(p.bar??timeToBar(music.model.raw,p.t))*1000}:p;
  const points=music?original.filter(p=>p.t<=music.time&&layers?.bars.includes(p.bar)).map(convert):original;
  const levelRange=musicExtent(points.map(p=>({tempo:p.relaxation}))).map(v=>Math.max(0,Math.min(100,v)));
  const ranges=music?{x:structural?[0,1]:musicExtent(points.map(p=>({tempo:p.attention}))),
   y:structural?[0,Math.max(.1,...music.model.structure.map(p=>p.jump??0))]:levelRange}:
   this.state.ranges??{x:[0,100],y:[0,100]};
  const first=layers?.first??0,last=layers?.last??1;
  const time=music?[first*1000,Math.max(first+1,last)*1000]:timeBounds(points,this.state.windowSeconds??60);
  const projection=this.projection=temporalProjection(w,h,ranges,time,this.camera),v=projection.vertex;
  const line=(a,b,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
  const face=(vertices,color)=>{ctx.fillStyle=color;ctx.beginPath();vertices.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();};
  if(music){
   const planes=(layers?.bars??[]).map(bar=>({bar,z:(bar-first)/Math.max(1,last-first)}));
   planes.sort((a,b)=>v(.5,.5,a.z).depth-v(.5,.5,b.z).depth);
    for(const {bar,z} of planes){
    const active=bar===layers.current;
      face([v(0,0,z),v(1,0,z),v(1,1,z),v(0,1,z)],active?'rgba(197,216,211,.12)':'rgba(197,216,211,.035)');
      const color=active?'#a8c9bd':'#59676a';
    for(const [a,b] of [[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]])
       line(v(...a,z),v(...b,z),color,active?1.8:1);
    if(active)for(let i=1;i<4;i++){const q=i/4;line(v(q,0,z),v(q,1,z),'#2b3638',.6);line(v(0,q,z),v(1,q,z),'#2b3638',.6);}
   }
  }else{
   face([v(0,0,0),v(1,0,0),v(1,0,1),v(0,0,1)],'#191c1e');
   face([v(0,0,0),v(0,1,0),v(1,1,0),v(1,0,0)],'#15181a');
   for(let i=0;i<=4;i++){
    const q=i/4;line(v(q,0,0),v(q,0,1),'#2a3033',.7);line(v(0,0,q),v(1,0,q),'#2a3033',.7);
    line(v(q,0,0),v(q,1,0),'#262c2f',.7);line(v(0,q,0),v(1,q,0),'#262c2f',.7);
    line(v(0,q,0),v(0,q,1),'#262c2f',.7);
   }
   for(const x of [0,1])for(const y of [0,1])line(v(x,y,0),v(x,y,1),'#434c50',.8);
   for(const z of [0,1]){line(v(0,0,z),v(1,0,z),'#434c50',.8);line(v(0,1,z),v(1,1,z),'#434c50',.8);line(v(0,0,z),v(0,1,z),'#434c50',.8);line(v(1,0,z),v(1,1,z),'#434c50',.8);}
  }
  const vertices=points.map(point=>({point,q:projection.point(point)})).filter(p=>p.q);
  for(let i=1;i<vertices.length;i++){
   const a=vertices[i-1],b=vertices[i];if(a.point.segment!==b.point.segment)continue;
   const crossing=music&&a.point.bar!==b.point.bar;
   if(crossing&&b.point.bar-a.point.bar!==1)continue;
   ctx.setLineDash(crossing?[4,5]:[]);
   ctx.globalAlpha=crossing?.72:.55+.4*i/Math.max(1,vertices.length-1);
   line(a.q,b.q,crossing?'#bac7c3':'#d6f1e7',crossing?1.4:2.4);ctx.globalAlpha=1;
  }
  ctx.setLineDash([]);
  for(let i=0;i<vertices.length;i++){
   const q=vertices[i].q;ctx.fillStyle='#d6f1e7';ctx.globalAlpha=.35+.55*i/Math.max(1,vertices.length-1);ctx.beginPath();
   ctx.arc(q.x,q.y,2.2+1.5*i/Math.max(1,vertices.length-1),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  const current=music&&layers?.current!==null?(structural?[...music.model.structure].reverse().find(p=>p.t<=music.time&&p.bar===layers?.current):music.current):null;
  const selected=music?(current?convert({...current,t:music.time}):null):this.state.selected??points.at(-1);
  const pos=selected?projection.point(selected):null,amplitude=this.state.active?selected?.amplitude:null;
  this.hits=music?points.filter(p=>p.pickable!==false).map(p=>({point:p,...projection.point(p)})).filter(p=>Number.isFinite(p.x)):[];
  const light=lightEncoding(amplitude?.rms,this.state.reference);
  if(pos){
   if(amplitude&&light.halo){const g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,light.halo);g.addColorStop(0,'rgba(197,216,211,.38)');g.addColorStop(1,'rgba(197,216,211,0)');ctx.fillStyle=g;ctx.fillRect(pos.x-light.halo,pos.y-light.halo,light.halo*2,light.halo*2);}
   ctx.fillStyle=music||this.state.active?'#f4fff9':theme.muted;ctx.beginPath();ctx.arc(pos.x,pos.y,music?6:light.radius,0,Math.PI*2);ctx.fill();
   if(amplitude){ctx.fillStyle=`rgba(255,255,255,${light.intensity})`;ctx.beginPath();ctx.arc(pos.x,pos.y,2,0,Math.PI*2);ctx.fill();}
  }
  ctx.font='11px ui-monospace,Consolas,monospace';ctx.textAlign='center';ctx.fillStyle=theme.muted;
  for(let i=0;i<=4;i++){
   const q=i/4,a=v(q,0,1),b=v(0,q,1),c=v(1,0,q);
   ctx.fillText(String(Number((ranges.x[0]+q*(ranges.x[1]-ranges.x[0])).toFixed(1))),a.x,a.y+19);
   ctx.fillText(String(Number((ranges.y[0]+q*(ranges.y[1]-ranges.y[0])).toFixed(2))),b.x-19,b.y+4);
   if(!music)ctx.fillText(String(Number(((time[1]-time[0])*q/1000).toFixed(1))),c.x+24,c.y+6);
  }
  const ticks=music?[...new Set([...barTicks(first,last,Math.min(8,layers?.bars.length??0)),...(layers?.current===null?[]:[layers?.current])])].filter(Number.isInteger):[];
  for(const bar of ticks){
   const q=v(1,0,(bar-first)/Math.max(1,last-first));ctx.fillStyle=bar===layers.current?theme.signal:theme.muted;
   ctx.fillText(String(bar),q.x+19,q.y+5);
   const point=music.model.raw.find(p=>p.bar===bar&&p.weight>0);
   if(point)this.hits.push({point,x:q.x+19,y:q.y+5});
  }
  ctx.font='12px "Segoe UI","Microsoft YaHei","NR CJK",sans-serif';
  const x=v(.5,0,1),y=v(0,.5,1),z=v(1,0,.5);
  ctx.fillStyle='#e39b86';ctx.fillText(music?(structural?'8拍線性擬合 / R²':`速度 / ${music.tempoUnit}`):'關注指數',x.x,x.y+40);
  ctx.fillStyle='#9dd0b6';ctx.fillText(music?(structural?'相鄰變幅 / log₂比':'相對振幅 / 0–100'): '放鬆指數',Math.max(music?82:38,y.x-43),y.y-16);
  ctx.fillStyle=theme.muted;ctx.fillText(music?'小節層':'經過時間 / s',Math.min(w-51,z.x+54),z.y+27);
  if(!points.length){ctx.fillStyle=theme.muted;ctx.fillText(music?'此位置沒有有效音樂標注':'等待有效資料',w/2,h/2);}
  canvas.style.touchAction='none';canvas.setAttribute('aria-label',music?'音樂小節分層空間：每個整數小節一層；點選層號定位，拖動或方向鍵轉向，Home重置視角':'關注、放鬆與經過時間的方盒軌跡；拖動或方向鍵轉向，Home重置視角');
  Object.assign(canvas.dataset,{layer:music?.layer??'eeg',space:'time',coordinate:selected?`${selected.attention},${selected.relaxation}`:'',
   timestamp:selected?String(selected.timestamp):'',elapsed:selected?String(projection.depth(selected)):'',samples:String(points.length),
   segments:String(new Set(points.map(p=>p.segment)).size),rms:amplitude?String(amplitude.rms):'',rangeX:ranges.x.join(','),rangeY:ranges.y.join(','),
   camera:JSON.stringify(this.camera),pairedSamples:'0'});
  if(music)Object.assign(canvas.dataset,{musicTime:String(music.time),scoreBar:String(timeToBar(music.model.raw,music.time)??''),depthUnit:'bar',
   layerBars:JSON.stringify(layers?.bars??[]),barTicks:JSON.stringify(ticks),layerCount:String(layers?.bars.length??0),
   levelUnit:current?.levelUnit??'',levelSource:current?.levelSource??'',dynamicMark:'',
   representation:'bar-layers',smoothing:music.smooth?'gaussian':'raw',tempo:current?.tempo??'',level:current?.level??''});
 }
 dispose(){this.canvas.removeEventListener('keydown',this.musicKeyboard);for(const [event,listener] of [['click',this.timePick],['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.up],['keydown',this.keys]])this.canvas.removeEventListener(event,listener);super.dispose();}
}
