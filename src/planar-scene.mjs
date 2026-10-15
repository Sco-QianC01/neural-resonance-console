import {plotBox,plotPosition,wrapText} from './planar-model.mjs';
import {lightEncoding} from './amplitude-model.mjs';

const instrumentTheme=host=>{
  const style=getComputedStyle(host),token=(name,fallback)=>style.getPropertyValue(name).trim()||fallback;
  return {background:token('--bg','#121315'),text:token('--text','#e9e8e2'),
    muted:token('--muted','#a4a5a6'),line:token('--line','#303236'),
    signal:token('--accent','#c5d8d3'),minor:'#23262a'};
};

/** A two-dimensional instrument: no camera, Z coordinate or animation clock. */
export class PlanarScene{
  constructor(host,{onPick=()=>{}}={}){
    this.host=host;this.state={points:[],active:false,selected:null,reference:100};
    this.canvas=document.createElement('canvas');this.canvas.className='research-canvas planar-canvas';this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label','關注與放鬆指數的二維時間軌跡');host.append(this.canvas);
    this.pick=e=>{
      const rect=this.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      let best=null,distance=12;
      for(const p of [...this.state.points].reverse()){
        const q=plotPosition(p,this.box,this.state.ranges);if(!q)continue;const d=Math.hypot(q.x-x,q.y-y);
        if(d<distance){best=p;distance=d;}
      }
      if(best)onPick(best.timestamp);
    };
    this.canvas.addEventListener('click',this.pick);
    this.resize=new ResizeObserver(()=>this.render());this.resize.observe(host);
    this.pixelResize=()=>this.render();window.addEventListener('resize',this.pixelResize);
    this.render();
  }
  update(state){this.state=state;this.render();}
  render(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const dpr=Math.min(globalThis.devicePixelRatio||1,2),canvas=this.canvas;
    canvas.setAttribute('aria-label','關注與放鬆指數的二維時間軌跡');
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const theme=this.theme=instrumentTheme(this.host);
    ctx.clearRect(0,0,w,h);ctx.fillStyle=theme.background;ctx.fillRect(0,0,w,h);
    const box=this.box=plotBox(w,h),{left,top,size}=box,right=left+size,bottom=top+size;
    const ranges=this.state.ranges??{x:[0,100],y:[0,100]};
    const project=p=>plotPosition(p,box,ranges);
    const points=this.state.points.filter(p=>project(p)),selected=this.state.selected??points.at(-1);
    const pos=selected?project(selected):null;
    const amplitude=this.state.active?selected?.amplitude:null,light=lightEncoding(amplitude?.rms,this.state.reference);
    ctx.save();ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();
    if(pos&&this.state.active&&light.halo){
      const g=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,light.halo);
      g.addColorStop(0,theme.signal);g.addColorStop(1,theme.background);
      ctx.globalAlpha=.12+.2*light.intensity;ctx.fillStyle=g;ctx.fillRect(left,top,size,size);ctx.globalAlpha=1;
    }
    for(let i=0;i<=8;i++){
      const x=left+size*i/8,y=top+size*i/8;
      ctx.strokeStyle=i%2?theme.minor:theme.line;ctx.lineWidth=i%2?.6:.8;
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
      for(let j=0;j<=8;j++){
        ctx.fillStyle=theme.muted;ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(x,top+size*j/8,1.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }
    }
    for(let i=1;i<points.length;i++){
      if(points[i].segment!==points[i-1].segment)continue;
      const a=project(points[i-1]),b=project(points[i]),age=i/points.length;
      ctx.strokeStyle=theme.signal;ctx.globalAlpha=.1+.65*age;ctx.lineWidth=1.1+.6*age;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.globalAlpha=1;
    }
    const stride=Math.max(1,Math.ceil(points.length/180));
    for(let i=0;i<points.length;i+=stride){
      const p=project(points[i]),age=i/Math.max(1,points.length-1);
      ctx.fillStyle=theme.signal;ctx.globalAlpha=.15+.6*age;ctx.beginPath();ctx.arc(p.x,p.y,1.4+1.1*age,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(pos){
      ctx.globalAlpha=this.state.active?1:.5;
      ctx.fillStyle=this.state.active?theme.signal:theme.muted;
      ctx.beginPath();ctx.arc(pos.x,pos.y,light.radius,0,Math.PI*2);ctx.fill();
      if(this.state.active&&amplitude){ctx.fillStyle=`rgba(255,255,255,${light.intensity})`;ctx.beginPath();ctx.arc(pos.x,pos.y,1.4+light.intensity,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
    }
    ctx.restore();
    ctx.strokeStyle=theme.muted;ctx.globalAlpha=.6;ctx.lineWidth=1;ctx.strokeRect(left,top,size,size);ctx.globalAlpha=1;
    ctx.fillStyle=theme.muted;ctx.font='11px ui-monospace, Consolas, monospace';
    for(let i=0;i<=4;i++){
      const x=ranges.x[0]+i/4*(ranges.x[1]-ranges.x[0]),y=ranges.y[0]+i/4*(ranges.y[1]-ranges.y[0]);
      ctx.textAlign='center';ctx.fillText(String(Number(x.toFixed(1))),left+size*i/4,bottom+20);
      ctx.textAlign='right';ctx.fillText(String(Number(y.toFixed(1))),left-12,bottom-size*i/4+4);
    }
    ctx.font='13px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.textAlign='center';
    ctx.fillText('關注指數',left+size/2,bottom+42);
    ctx.save();ctx.translate(left-40,top+size/2);ctx.rotate(-Math.PI/2);ctx.fillText('放鬆指數',0,0);ctx.restore();
    if(!points.length){ctx.fillStyle=theme.muted;ctx.font='13px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.fillText('等待有效資料',left+size/2,top+size/2);}
    canvas.dataset.plotSize=String(size);canvas.dataset.plotLeft=String(left);canvas.dataset.plotTop=String(top);
    canvas.dataset.samples=String(points.length);canvas.dataset.segments=String(new Set(points.map(p=>p.segment)).size);
    canvas.dataset.coordinate=selected?`${selected.attention},${selected.relaxation}`:'';
    canvas.dataset.timestamp=selected?String(selected.timestamp):'';
    canvas.dataset.rms=amplitude?String(amplitude.rms):'';
    canvas.dataset.intensity=String(light.intensity);canvas.dataset.halo=String(light.halo);
    canvas.dataset.rangeX=ranges.x.join(',');canvas.dataset.rangeY=ranges.y.join(',');
    canvas.dataset.layer='eeg';canvas.dataset.pairedSamples='0';
  }
  exportPNG(metadata){
    const out=document.createElement('canvas'),ratio=this.canvas.width/this.host.clientWidth;
    out.width=this.canvas.width;
    const ctx=out.getContext('2d'),font='12px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.font=font;
    const content=Array.isArray(metadata)?metadata.join('\n'):String(metadata);
    const lines=wrapText(content,this.host.clientWidth-40,text=>ctx.measureText(text).width);
    out.height=this.canvas.height+Math.ceil((28+18*lines.length)*ratio);
    const theme=this.theme??instrumentTheme(this.host);
    ctx.fillStyle=theme.background;ctx.fillRect(0,0,out.width,out.height);
    ctx.drawImage(this.canvas,0,0);ctx.scale(ratio,ratio);ctx.fillStyle=theme.muted;
    ctx.font=font;
    lines.forEach((line,i)=>ctx.fillText(line,20,this.host.clientHeight+27+i*18));
    out.dataset.captionLines=String(lines.length);
    return out.toDataURL('image/png');
  }
  dispose(){this.resize.disconnect();window.removeEventListener('resize',this.pixelResize);this.canvas.remove();}
}
