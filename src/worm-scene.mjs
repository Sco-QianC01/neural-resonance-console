import * as THREE from '../public/vendor/three/three.module.min.js';
import {OrbitControls} from '../public/vendor/three/OrbitControls.js';
import {MUSIC_LAYERS,extent,normalizeValue,performancePath,observationAt,smoothTrajectory,intervalPaths} from './performance-model.mjs';

const INK=0x526a8b,ACCENT=0x315ad7,GRID=0xc8d0db;
const W=12,H=7;
function clear(group){
  for(const child of [...group.children]){
    child.traverse(n=>{
      n.geometry?.dispose();
      for(const m of (Array.isArray(n.material)?n.material:[n.material]).filter(Boolean)){
        m.map?.dispose();m.dispose();
      }
    });group.remove(child);
  }
}
function line(points,color=GRID,opacity=1){
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
}
function text(value,x,y,z,{size=.2,color='#556477',width=3}={}){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  const font='32px QA-CJK, "Microsoft YaHei", sans-serif';ctx.font=font;
  c.width=Math.ceil(ctx.measureText(value).width)+20;c.height=56;
  ctx.font=font;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,c.width/2,28);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
  sprite.userData.label={width:c.width,height:c.height,pixels:Math.max(11,Math.min(13,size*55))};
  sprite.scale.set(c.width/32*size,c.height/32*size,1);sprite.position.set(x,y,z);return sprite;
}
function xy(x,y,xrange,yrange,z=0,width=W){return [
  (normalizeValue(x,xrange)-.5)*width,(normalizeValue(y,yrange)-.5)*H,z,
];}
export class WormScene{
  constructor(host,{onFailure}={}){
    this.host=host;this.onFailure=onFailure;
    this.data=null;this.eeg=null;this.source='music';this.mode='trace';this.selected=4;
    this.time=0;this.cursorKey='';this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.smoothing=1;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setClearColor(0xf4f5f6,1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.canvas=this.renderer.domElement;this.canvas.className='research-canvas';
    this.canvas.setAttribute('aria-label','可旋轉的資料場景');this.canvas.tabIndex=0;
    host.prepend(this.canvas);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure?.('圖形環境已中斷，請重新載入頁面。');});
    this.scene=new THREE.Scene();
    this.static=new THREE.Group();this.dynamic=new THREE.Group();
    this.scene.add(this.static,this.dynamic);
    this.camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,200);
    this.camera.position.set(0,0,35);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;
    this.controls.enablePan=false;this.controls.minZoom=.65;this.controls.maxZoom=2.5;
    this.controls.minPolarAngle=Math.PI/2-.22;this.controls.maxPolarAngle=Math.PI/2+.22;
    this.controls.minAzimuthAngle=-.85;this.controls.maxAzimuthAngle=.85;
    this.controls.addEventListener('start',()=>{this.flight=null;});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    this.windowResize=()=>{this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.resize();};
    window.addEventListener('resize',this.windowResize);
    this.resize();this.drawStatic();this.moveCamera();
    this.running=true;this.animate();
  }
  resize(){
    const {width,height}=this.host.getBoundingClientRect();if(width<1||height<1)return;
    this.renderer.setSize(width,height,false);
    const aspect=width/height,span=this.mode==='focus'?11:9;
    const halfY=Math.max(span/2,7.5/aspect);
    this.camera.left=-halfY*aspect;this.camera.right=halfY*aspect;
    this.camera.top=halfY;this.camera.bottom=-halfY;this.camera.updateProjectionMatrix();
  }
  setSource(source,data,eeg){
    this.source=source;this.data=data;this.eeg=eeg;this.cursorKey='';
    this.displayData=data?{...data,rows:smoothTrajectory(data.rows,this.smoothing)}:null;
    this.drawStatic();this.updateCursor(this.time);
  }
  setSmoothing(value){this.smoothing=value;this.setSource(this.source,this.data,this.eeg);}
  setView(mode,selected=this.selected){
    const turnPage=mode==='focus'&&this.mode==='focus'&&selected!==this.selected;
    this.mode=mode;this.selected=selected;this.cursorKey='';
    this.controls.enableRotate=mode==='focus';
    if(turnPage&&!this.reduced.matches)this.pageTurnStart=performance.now();
    else{this.pageTurnStart=undefined;this.static.rotation.y=this.dynamic.rotation.y=0;}
    this.canvas.dataset.mode=mode;this.canvas.dataset.layer=MUSIC_LAYERS[selected].key;
    this.drawStatic();this.updateCursor(this.time);this.resize();this.moveCamera();
  }
  moveCamera(){
    this.camera.zoom=1;this.camera.updateProjectionMatrix();
    const focus=this.mode==='focus';
    this.flight={from:this.camera.position.clone(),to:new THREE.Vector3(focus?18:0,focus?2:0,focus?28:35),
      targetFrom:this.controls.target.clone(),targetTo:new THREE.Vector3(0,0,0),start:performance.now()};
  }
  axes(group,xr,yr,xlabel,ylabel,z=0,selected=true){
    const opacity=selected?1:.35;
    const width=this.source==='eeg'&&this.mode==='trace'?H:W;
    for(let i=0;i<=4;i++){
      const x=-width/2+width*i/4,y=-H/2+H*i/4;
      group.add(line([[x,-H/2,z],[x,H/2,z]],GRID,opacity*.75));
      group.add(line([[-width/2,y,z],[width/2,y,z]],GRID,opacity*.75));
      if(selected){
        const a=xr[0]+(xr[1]-xr[0])*i/4,b=yr[0]+(yr[1]-yr[0])*i/4;
        group.add(text(a.toFixed(Math.abs(a)<10?1:0),x,-H/2-.32,z,{width:1.4,size:.18}));
        group.add(text(b.toFixed(Math.abs(b)<10?1:0),-width/2-.65,y,z,{width:1.4,size:.18}));
      }
    }
    group.add(line([[-width/2,-H/2,z],[width/2,-H/2,z],[width/2,H/2,z],[-width/2,H/2,z],[-width/2,-H/2,z]],
      selected?0x738579:GRID,opacity));
    if(selected){
      group.add(text(xlabel,0,-H/2-.83,z,{width:5,size:.19}));
      group.add(text(ylabel,-width/2+1.2,H/2+.75,z,{width:4,size:.19,color:'#53657e'}));
    }
  }
  ranges(){
    if(this.source==='eeg')return [[0,100],[0,100]];
    return [extent(this.data?.rows.map(p=>p.tempo)??[]),extent(this.data?.rows.map(p=>p.dynamics)??[])];
  }
  drawStatic(){
    clear(this.static);this.planes=[];
    if(this.mode==='trace'){
      const [xr,yr]=this.ranges();
      this.axes(this.static,xr,yr,this.source==='eeg'?'專注 · 原生指數':'速度 · ♪/min',
        this.source==='eeg'?'冥想／放鬆 · 原生指數':'RMS電平 · dBFS');
      if(this.source==='music'&&this.data){
        let points=[];
        const flush=()=>{if(points.length>1)this.static.add(line(points,0x788d78,.13));points=[];};
        this.displayData.rows.forEach((p,i)=>{
          if(i&&p.t>this.displayData.rows[i-1].end+.00001)flush();
          points.push(xy(p.tempo,p.dynamics,xr,yr,-.015));
        });flush();
      }
      return;
    }
    const layer=MUSIC_LAYERS[this.selected],z=0;
    const group=new THREE.Group();this.static.add(group);
    const rows=this.source==='music'&&layer.metric?this.data?.rows??[]:[];
    const yr=extent(rows.map(p=>p[layer.key]));
    if(rows.length)this.axes(group,[0,this.data.duration],yr,'時間 · s',`${layer.name} · ${layer.unit}`,z,true);
    else{
      group.add(line([[-W/2,-H/2,z],[W/2,-H/2,z],[W/2,H/2,z],[-W/2,H/2,z],[-W/2,-H/2,z]],0x71816e,.6));
      group.add(text('未提供時間對位資料',0,0,z,{width:6,size:.26}));
    }
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(W,H),
      new THREE.MeshBasicMaterial({color:0xf0f2f5,side:THREE.DoubleSide}));
    plane.position.z=z-.025;plane.userData.index=this.selected;group.add(plane);this.planes.push(plane);
    if(rows.length){
      for(const segment of intervalPaths(this.data,layer.key))
        group.add(line(segment.map(([t,value])=>xy(t,value,[0,this.data.duration],yr,z+.02)),ACCENT,1));
    }
  }
  updateCursor(time,eeg=this.eeg){
    this.time=time;this.eeg=eeg;
    const current=this.source==='music'?observationAt(this.data,time):eeg?.points.at(-1);
    const key=`${current?.t??current?.timestamp??'none'}:${this.mode}:${this.selected}:${this.mode==='trace'?'':time}`;
    if(this.cursorKey===key)return;this.cursorKey=key;clear(this.dynamic);
    if(this.mode==='trace'){
      const [xr,yr]=this.ranges();
      const width=this.source==='eeg'?H:W;
      const points=this.source==='music'?performancePath(this.displayData,time):
        smoothTrajectory((eeg?.points??[]).map(p=>({t:p.timestamp/1000,tempo:p.attention,
          dynamics:p.relaxation,segment:p.segment})),this.smoothing)
          .filter(p=>p.t>=(eeg?.points.at(-1)?.timestamp??0)/1000-8);
      const sphere=new THREE.SphereGeometry(.045,8,6);
      points.forEach((p,i)=>{
        const pos=xy(p.tempo,p.dynamics,xr,yr,0,width),age=i/Math.max(1,points.length-1);
        if(i&&p.segment===points[i-1].segment){
          const prev=points[i-1];
          const start=new THREE.Vector3(...xy(prev.tempo,prev.dynamics,xr,yr,0,width));
          const end=new THREE.Vector3(...pos),direction=end.clone().sub(start),length=direction.length();
          if(length>0){
            const tube=new THREE.Mesh(new THREE.CylinderGeometry(.018+age*.032,.018+age*.028,length,8),
              new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:.15+age*.75}));
            tube.position.copy(start.add(end).multiplyScalar(.5));
            tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
            this.dynamic.add(tube);
          }
        }
        const ball=new THREE.Mesh(sphere.clone(),new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:.15+age*.85}));
        ball.position.set(...pos);ball.scale.setScalar(.65+age*1.1);this.dynamic.add(ball);
      });
      sphere.dispose();
      if(current&&points.length){
        const end=xy(points.at(-1).tempo,points.at(-1).dynamics,xr,yr,0,width);this.head(end);
        if(this.smoothing){
          const raw=xy(this.source==='music'?current.tempo:current.attention,
            this.source==='music'?current.dynamics:current.relaxation,xr,yr,.01,width);
          this.dynamic.add(line([end,raw],INK,.3));
          const marker=new THREE.Mesh(new THREE.RingGeometry(.055,.068,24),
            new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:.8,side:THREE.DoubleSide}));
          marker.position.set(...raw);this.dynamic.add(marker);
        }
      }
      return;
    }
    if(this.source!=='music'||!current)return;
    const layer=MUSIC_LAYERS[this.selected];
    if(!layer.metric)return;
    const yr=extent(this.data.rows.map(p=>p[layer.key]));
    const pos=xy(time,current[layer.key],[0,this.data.duration],yr,.04);
    this.dynamic.add(line([[pos[0],-H/2,.02],[pos[0],H/2,.02]],0xc3d7aa,.35));
    this.head(pos,.10);
  }
  head(pos,radius=.14){
    const head=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),new THREE.MeshBasicMaterial({color:ACCENT}));
    head.position.set(...pos);this.dynamic.add(head);
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.65,radius*1.8,32),
      new THREE.MeshBasicMaterial({color:ACCENT,side:THREE.DoubleSide,transparent:true,opacity:.5}));
    ring.position.set(pos[0],pos[1],pos[2]+.04);this.dynamic.add(ring);
  }
  animate(){
    if(!this.running)return;
    if(this.flight){
      const f=this.flight,t=this.reduced.matches?1:Math.min(1,(performance.now()-f.start)/700);
      const eased=1-(1-t)**3;
      this.camera.position.lerpVectors(f.from,f.to,eased);this.controls.target.lerpVectors(f.targetFrom,f.targetTo,eased);
      if(t===1)this.flight=null;
    }
    if(this.pageTurnStart!==undefined){
      const t=this.reduced.matches?1:Math.min(1,(performance.now()-this.pageTurnStart)/400);
      this.static.rotation.y=this.dynamic.rotation.y=-.12*(1-t)**3;
      if(t===1)this.pageTurnStart=undefined;
    }
    this.controls.update();
    if(this.host.clientWidth&&this.host.clientHeight&&!this.canvas.hidden&&!document.hidden){
      const ratio=(this.camera.top-this.camera.bottom)/this.host.clientHeight/this.camera.zoom;
      this.static.traverse(object=>{const label=object.userData.label;
        if(label)object.scale.set(label.width/32*label.pixels*ratio,label.height/32*label.pixels*ratio,1);
      });
      this.renderer.render(this.scene,this.camera);
    }
    this.raf=requestAnimationFrame(()=>this.animate());
  }
  dispose(){this.running=false;cancelAnimationFrame(this.raf);this.observer.disconnect();window.removeEventListener('resize',this.windowResize);clear(this.static);clear(this.dynamic);
    this.controls.dispose();this.renderer.dispose();this.canvas.remove();}
}
