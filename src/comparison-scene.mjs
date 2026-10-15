import {PlanarScene} from './planar-scene.mjs';
import {plotBox} from './planar-model.mjs';
import {lightEncoding} from './amplitude-model.mjs';
import {drawTempoProfile} from './tempo-profile.mjs';
import {timeToBar,timeToScorePosition,tempoSummary,barTicks,barLayerWindow,musicExtent} from './fusion-model.mjs';
const format=n=>Number(n.toFixed(1)).toString();
const normalize=(n,r)=>(n-r[0])/(r[1]-r[0]);

/** Two observed coordinate systems on one plane; the media clock selects both. */
export class ComparisonScene extends PlanarScene{
  constructor(host,options={}){
    super(host,options);this.onMusicPick=options.onMusicPick??(()=>{});
    this.tooltip=document.createElement('div');this.tooltip.className='plot-tooltip';this.tooltip.hidden=true;host.append(this.tooltip);
    this.nearest=event=>{
      if(!this.state.comparison)return null;
      const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
      let selected=null,distance=16;
      for(const hit of this.hits??[]){
        const d=Math.hypot(x-hit.x,y-hit.y);if(d<distance){distance=d;selected=hit;}
      }
      return selected;
    };
    this.musicClick=e=>{const hit=this.nearest(e);if(hit)this.onMusicPick(hit.point.t);};
    this.musicHover=e=>{
      const hit=this.nearest(e);
      if(!hit){this.tooltip.hidden=true;return;}
      const p=hit.point;this.tooltip.textContent=`${p.bar!=null?'小節 '+p.bar+' · ':''}${p.t.toFixed(2)} s · ${p.tempo===null?'發音間隔 '+p.ioi.toFixed(1)+' ms':'速度 '+p.tempo.toFixed(2)+' '+this.state.comparison.tempoUnit} · 相對振幅 ${Number.isFinite(p.level)?p.level.toFixed(1):'—'}（來源 0–100）`;
      this.tooltip.hidden=false;this.tooltip.style.left=`${Math.max(4,Math.min(this.host.clientWidth-260,hit.x+12))}px`;
      this.tooltip.style.top=`${Math.max(4,hit.y-38)}px`;
    };
    this.musicLeave=()=>{this.tooltip.hidden=true;};
    this.musicKey=e=>{
      const s=this.state.comparison;if(!s||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();this.onMusicPick(e.key==='Home'?0:e.key==='End'?s.duration:
        Math.max(0,Math.min(s.duration,s.time+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?5:1))));
    };
    this.canvas.addEventListener('click',this.musicClick);this.canvas.addEventListener('pointermove',this.musicHover);
    this.canvas.addEventListener('pointerleave',this.musicLeave);this.canvas.addEventListener('keydown',this.musicKey);
  }
  render(){
    const s=this.state.comparison;
    if(!s){if(this.tooltip)this.tooltip.hidden=true;return super.render();}
    if(s.layer==='profile'){
      this.canvas.setAttribute('aria-label','演奏曲線：小節、原始拍點、速度平滑曲線、相對振幅灰帶和平均速度線；點選定位，左右鍵調整');
      this.hits=drawTempoProfile(this.canvas,{recording:s.recording,model:s.model,currentTime:s.time,
        smooth:s.smooth,overlay:s.overlay,paired:s.paired}).hits;
      return;
    }
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const canvas=this.canvas,dpr=Math.min(devicePixelRatio||1,2);
    if(this.dataId!==s.id){this.dataId=s.id;if(this.tooltip)this.tooltip.hidden=true;}
    canvas.setAttribute('aria-label',`${s.overlay?'腦電與音樂叠加':'音樂'}${s.layer==='worm'?'演奏蠕蟲':'時間曲線'}；點選軌跡定位，左右鍵調整播放位置`);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const style=getComputedStyle(this.host),token=(k,f)=>style.getPropertyValue(k).trim()||f;
    const theme=this.theme={background:token('--bg','#121315'),text:token('--text','#e9e8e2'),
      muted:token('--muted','#a4a5a6'),line:token('--line','#303236'),signal:token('--accent','#c5d8d3')};
    const music='#c8ad8c',eeg=theme.signal;
    ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);
    const base=plotBox(w,h-(s.overlay?20:0));
    const box=this.box={...base,top:base.top+(s.overlay?20:0)},{left,top,size}=box,right=left+size,bottom=top+size;
    const duration=Math.max(.01,s.duration),timeRange=[Math.max(0,s.time-12),Math.min(duration,Math.max(12,s.time))];
    const structural=s.layer==='structure',timeline=!['worm','structure'].includes(s.layer),score=timeline&&s.model.known;
    const range=s.layer==='rhythm'?s.ioiRange:s.layer==='dynamics'?[0,100]:s.tempoRange;
    const summary=tempoSummary(s.model.raw);
    const layers=!timeline?barLayerWindow(s.model.raw,s.time,s.barWindow??8):null;
    const mp=(structural?s.model.structure:s.points).filter(p=>p.t<=s.time
      &&(timeline?(score||p.t>=s.time-12):layers?.bars.includes(p.bar)));
    const current=structural?[...s.model.structure].reverse().find(p=>p.t<=s.time):s.current;
    if(current&&(!mp.length||mp.at(-1).t<current.t))mp.push(current);
    const visibleTempo=musicExtent(mp.map(p=>({tempo:p.tempo})));
    const levelValues=mp.map(p=>p.level).filter(Number.isFinite);
    const levelLo=levelValues.length?Math.min(...levelValues):0;
    const levelHi=levelValues.length?Math.max(...levelValues):100;
    const levelPad=Math.max(1,(levelHi-levelLo)*.2);
    const visibleLevel=[Math.max(0,levelLo-levelPad),Math.min(100,levelHi+levelPad)];
    const xr=structural?[0,1]:timeline?(score?[summary.firstBar,summary.layerEnd??summary.lastBar+1]:timeRange):visibleTempo;
    const yr=structural?[0,Math.max(.1,...s.model.structure.map(p=>p.jump??0))]:timeline?range:visibleLevel;
    const project=(p,kind='music',key=null)=>{
      let x,y;
      if(kind==='eeg'){
        if(timeline){x=normalize(p.t,xr);y=p[key]/100;}
        else{x=p.attention/100;y=p.relaxation/100;}
      }else if(timeline){
        x=normalize(score?timeToScorePosition(s.model.raw,p.t):p.t,xr);
        const value=key==='level'?p.level:s.layer==='rhythm'?p.ioi:s.layer==='dynamics'?p.level:p.tempo;
        if(!Number.isFinite(value))return null;
        y=normalize(value,key==='level'?[0,100]:yr);
      }else{
        if(structural){if(!Number.isFinite(p.linearity)||!Number.isFinite(p.jump))return null;x=normalize(p.linearity,xr);y=normalize(p.jump,yr);}
        else{if(!Number.isFinite(p.level)||!Number.isFinite(p.tempo))return null;x=normalize(p.tempo,xr);y=normalize(p.level,yr);}
      }
      return {x:left+x*size,y:bottom-y*size};
    };
    for(let i=0;i<=8;i++){
      ctx.strokeStyle=i%2?'#23262a':theme.line;ctx.lineWidth=i%2?.6:.8;
      const pos=left+size*i/8,yp=top+size*i/8;
      ctx.beginPath();ctx.moveTo(pos,top);ctx.lineTo(pos,bottom);ctx.moveTo(left,yp);ctx.lineTo(right,yp);ctx.stroke();
    }
    if(score){
      ctx.save();ctx.strokeStyle='#4a5356';ctx.lineWidth=.9;ctx.setLineDash([2,4]);
      for(let bar=summary.firstBar;bar<=(summary.lastBar??summary.firstBar);bar++){
        const x=left+normalize(bar,xr)*size;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
      }
      ctx.restore();
    }
    this.hits=mp.filter(p=>p.pickable!==false).map(point=>({point,...project(point)})).filter(hit=>Number.isFinite(hit.x)&&hit.x>=left&&hit.x<=right&&hit.y>=top&&hit.y<=bottom);
    const ep=s.paired.filter(p=>p.t<=s.time&&p.t>=s.time-12);
    const line=(points,color,kind,key=null,dashed=false)=>{
      ctx.save();ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();
      ctx.setLineDash(dashed?[4,5]:[]);ctx.strokeStyle=color;
      for(let i=1;i<points.length;i++){
        const a=project(points[i-1],kind,key),b=project(points[i],kind,key);
        if(!a||!b||points[i].segment!==points[i-1].segment||points[i].run!==points[i-1].run)continue;
        ctx.globalAlpha=timeline?.18+.7*i/points.length:.55+.45*i/points.length;
        ctx.lineWidth=timeline?1.4:2.8;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
      ctx.restore();
    };
    line(mp,music,'music');
    if(!timeline){
      const step=Math.max(1,Math.ceil(mp.length/90));
      ctx.save();ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();
      for(let i=0;i<mp.length;i+=step){
        const p=project(mp[i]);if(!p)continue;
        ctx.globalAlpha=.35+.55*i/Math.max(1,mp.length-1);ctx.fillStyle=music;
        ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();ctx.globalAlpha=1;
      let previousBar=null;
      for(const point of mp){
        if(point.bar===previousBar||!Number.isInteger(point.bar))continue;
        previousBar=point.bar;const p=project(point);if(!p)continue;
        ctx.fillStyle=theme.muted;ctx.font='10px ui-monospace,Consolas,monospace';ctx.textAlign='left';
        ctx.fillText(String(point.bar),Math.min(right-18,p.x+7),Math.max(top+12,p.y-7));
      }
    }
    if(s.overlay&&s.layer==='tempo')line(mp,'#a68e76','music','level',true);
    if(s.overlay){
      line(ep,eeg,'eeg',timeline?'attention':null);
      if(timeline)line(ep,'#8aafb9','eeg','relaxation',true);
    }
    const head=(point,color,kind,key=null)=>{
      if(!point)return;
      const p=project(point,kind,key);if(!p||p.x<left||p.x>right||p.y<top||p.y>bottom)return;
      const amp=kind==='eeg'?point.amplitude:null,light=lightEncoding(amp?.rms,this.state.reference);
      const halo=kind==='eeg'&&amp?light.halo:0;
      ctx.save();ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();
      const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo||1);
      grad.addColorStop(0,color);grad.addColorStop(1,theme.background);
      ctx.globalAlpha=.3;ctx.fillStyle=grad;ctx.fillRect(p.x-halo,p.y-halo,halo*2,halo*2);
      ctx.globalAlpha=1;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,timeline?3.5:6,0,Math.PI*2);ctx.fill();
      if(!timeline){ctx.strokeStyle=theme.text;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    };
    head(current,music,'music');
    if(s.overlay&&s.layer==='tempo')head(s.current,'#a68e76','music','level');
    if(s.overlay){head(ep.at(-1),eeg,'eeg',timeline?'attention':null);if(timeline)head(ep.at(-1),'#8aafb9','eeg','relaxation');}
    ctx.globalAlpha=1;ctx.strokeStyle=theme.muted;ctx.lineWidth=.8;ctx.strokeRect(left,top,size,size);
    ctx.font='11px ui-monospace,Consolas,monospace';
    for(let i=0;i<=4;i++){
      ctx.fillStyle=music;ctx.textAlign='center';
      if(!score)ctx.fillText(format(xr[0]+i/4*(xr[1]-xr[0])),left+size*i/4,bottom+20);
      ctx.textAlign='right';ctx.fillText(format(yr[0]+i/4*(yr[1]-yr[0])),left-10,bottom-size*i/4+4);
      if(s.overlay){
        ctx.fillStyle=eeg;ctx.textAlign='left';ctx.fillText(String(i*25),right+6,bottom-size*i/4+4);
        if(!timeline){ctx.textAlign='center';ctx.fillText(String(i*25),left+size*i/4,top-10);}
      }
    }
    const ticks=score?barTicks(xr[0],xr[1]):[];
    for(const bar of ticks){ctx.fillStyle=music;ctx.textAlign='center';ctx.fillText(String(bar),left+normalize(bar,xr)*size,bottom+20);}
    const unit=s.tempoUnit||'拍/分';
    ctx.fillStyle=music;ctx.font='12px "Segoe UI","Microsoft YaHei","NR CJK",sans-serif';ctx.textAlign='center';
    if(s.overlay&&!timeline){ctx.fillStyle=eeg;ctx.fillText('關注指數 / 0–100',left+size/2,top-26);ctx.fillStyle=music;}
    ctx.fillText(structural?'8拍線性擬合 / R²':timeline?(score?'譜面小節':'播放時間 / s'):`速度 / ${unit}`,left+size/2,bottom+41);
    ctx.save();ctx.translate(left-42,top+size/2);ctx.rotate(-Math.PI/2);
    ctx.fillText(structural?'相鄰速度變幅 / |log₂比|':timeline?(s.layer==='rhythm'?'拍點間隔 / ms':s.layer==='dynamics'?'相對振幅 / 來源 0–100':`速度 / ${unit}`):'相對振幅 / 來源 0–100',0,0);ctx.restore();
    if(!s.current){ctx.fillStyle=theme.muted;ctx.fillText('此位置沒有有效音樂標注',left+size/2,top+size/2);}
    canvas.dataset.layer=s.layer;canvas.dataset.pairedSamples=String(ep.length);canvas.dataset.musicTime=String(s.time);
    canvas.dataset.tempo=s.current?.tempo??'';canvas.dataset.level=s.current?.level??'';canvas.dataset.ioi=s.current?.ioi??'';
    canvas.dataset.samples=String(mp.length);canvas.dataset.segments=String(new Set(mp.map(p=>p.segment)).size);
    canvas.dataset.plotSize=String(size);canvas.dataset.plotLeft=String(left);canvas.dataset.plotTop=String(top);
    canvas.dataset.coordinate=s.current?`${s.current.tempo},${s.current.level}`:'';
    canvas.dataset.timestamp=s.current?String(s.current.t):'';canvas.dataset.rangeX=xr.join(',');canvas.dataset.rangeY=yr.join(',');
    canvas.dataset.rms=ep.at(-1)?.amplitude?.rms??'';canvas.dataset.intensity='0';canvas.dataset.halo='0';
    canvas.dataset.depthUnit=score?'bar':'none';canvas.dataset.scoreBar=String(timeToBar(s.model.raw,s.time)??'');
    canvas.dataset.barTicks=JSON.stringify(ticks);
    canvas.dataset.levelUnit=s.current?.levelUnit??'';canvas.dataset.levelSource=s.current?.levelSource??'';
    canvas.dataset.dynamicMark='';
  }
  dispose(){
    this.canvas.removeEventListener('click',this.musicClick);this.canvas.removeEventListener('pointermove',this.musicHover);
    this.canvas.removeEventListener('pointerleave',this.musicLeave);this.canvas.removeEventListener('keydown',this.musicKey);
    this.tooltip.remove();super.dispose();
  }
}
