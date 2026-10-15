import * as THREE from '../public/vendor/three/three.module.min.js';
import {OrbitControls} from '../public/vendor/three/OrbitControls.js';
import {PITCH_NAMES,pitchPosition,triad,scale,voiceLeading} from './tonal-model.mjs';

const R=3.15,BLUE=0x315ad7,INK=0x586575;
const position=pitch=>new THREE.Vector3(...pitchPosition(pitch)).multiplyScalar(R);
/** Geometry samples are references. Only anchors carry a pitch-class identity. */
export class TonalScene{
  constructor(host,{onPick=()=>{},onFifth=()=>{},onTransform=()=>{},onFailure=()=>{}}={}){
    this.host=host;this.callbacks={onPick,onFifth,onTransform};this.active=true;this.dirty=true;
    this.chord={root:0,quality:'major'};this.layer=2;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setClearColor(0xf4f5f6,1);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.canvas=this.renderer.domElement;this.canvas.className='research-canvas tonal-canvas';this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label','球形音級空間');this.canvas.dataset.anchorCount='12';host.prepend(this.canvas);
    this.labels=document.createElement('div');this.labels.className='tonal-labels';host.append(this.labels);
    this.scene=new THREE.Scene();this.geometryGroup=new THREE.Group();this.musicGroup=new THREE.Group();
    this.scene.add(this.geometryGroup,this.musicGroup);
    this.camera=new THREE.OrthographicCamera(-7,7,4,-4,.1,100);this.camera.position.set(0,.15,14);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.enablePan=false;
    this.controls.minZoom=.8;this.controls.maxZoom=1.35;this.controls.minPolarAngle=.3;this.controls.maxPolarAngle=Math.PI-.3;
    this.controls.addEventListener('change',()=>{this.dirty=true;});
    this.controls.addEventListener('start',()=>{this.flight=null;});
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x9aa3b0,2.5));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-5,7,8);this.scene.add(light);
    this.reference();this.anchors=[];
    const geometry=new THREE.SphereGeometry(.075,20,14);
    const hitGeometry=new THREE.SphereGeometry(.19,12,8);
    this.hits=[];
    for(let pitch=0;pitch<12;pitch++){
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:INK,roughness:.52,metalness:.06}));
      mesh.position.copy(position(pitch));mesh.userData.pitch=pitch;this.musicGroup.add(mesh);this.anchors.push(mesh);
      const hit=new THREE.Mesh(hitGeometry,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
      hit.position.copy(mesh.position);hit.userData.pitch=pitch;this.musicGroup.add(hit);this.hits.push(hit);
      const label=document.createElement('button');label.type='button';label.className='pitch-label';label.dataset.pitch=String(pitch);
      label.textContent=PITCH_NAMES[pitch];label.setAttribute('aria-label',`以 ${PITCH_NAMES[pitch]} 為根音`);
      label.onclick=()=>onPick(pitch);this.labels.append(label);
    }
    const triangle=new THREE.BufferGeometry();triangle.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));
    const outline=new THREE.BufferGeometry();outline.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));
    this.face=new THREE.Mesh(triangle,
      new THREE.MeshBasicMaterial({color:BLUE,side:THREE.DoubleSide,transparent:true,opacity:.035,depthWrite:false}));
    this.edges=new THREE.LineLoop(outline,new THREE.LineBasicMaterial({color:BLUE,transparent:true,opacity:.68}));
    this.musicGroup.add(this.face,this.edges);
    this.mover=new THREE.Mesh(new THREE.SphereGeometry(.07,18,12),new THREE.MeshStandardMaterial({color:BLUE,roughness:.5}));
    this.mover.visible=false;this.musicGroup.add(this.mover);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.down=e=>{this.press={x:e.clientX,y:e.clientY,id:e.pointerId};};
    this.up=e=>{
      const start=this.press;this.press=null;
      if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
      const pitch=this.pick(e);if(pitch!==null)onPick(pitch);
    };
    this.move=e=>{if(this.press)return;const pitch=this.pick(e);if(pitch!==this.hover){this.hover=pitch;this.dirty=true;}};
    this.key=e=>{
      if(e.target!==this.canvas)return;
      if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();onFifth(e.key==='ArrowRight'?1:-1);}
      else if(['p','l','r'].includes(e.key.toLowerCase())){e.preventDefault();onTransform(e.key.toUpperCase());}
    };
    this.canvas.addEventListener('pointerdown',this.down);this.canvas.addEventListener('pointerup',this.up);
    this.canvas.addEventListener('pointermove',this.move);this.canvas.addEventListener('keydown',this.key);
    this.canvas.addEventListener('pointercancel',()=>{this.press=null;});
    this.canvas.addEventListener('pointerleave',()=>{this.hover=null;this.dirty=true;});
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('圖形環境中斷，請重新載入頁面。');});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    this.windowResize=()=>{this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.resize();};
    window.addEventListener('resize',this.windowResize);
    this.resize();this.setChord(this.chord);this.running=true;this.frame();
  }
  reference(){
    const geometry=new THREE.IcosahedronGeometry(R,5),attribute=geometry.getAttribute('position');
    const points=new Map();
    for(let i=0;i<attribute.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(attribute,i);
      points.set(p.toArray().map(v=>v.toFixed(5)).join(','),p);
    }
    const material=new THREE.MeshStandardMaterial({color:0x84909d,roughness:.75});
    const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(.018,8,6),material,points.size);
    const matrix=new THREE.Matrix4();let i=0;
    for(const p of points.values()){matrix.makeTranslation(...p.toArray());beads.setMatrixAt(i++,matrix);}
    beads.instanceMatrix.needsUpdate=true;beads.userData.role='geometric-reference';
    const wire=new THREE.LineSegments(new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({color:0x83909d,transparent:true,opacity:.16,depthWrite:false}));
    wire.userData.role='geometric-reference';
    this.geometryGroup.add(beads,wire);this.referenceSamples=points.size;geometry.dispose();
    this.canvas.dataset.referenceCount=String(points.size);
  }
  resize(){
    const {width,height}=this.host.getBoundingClientRect();if(width<1||height<1)return;
    this.renderer.setSize(width,height,false);
    const aspect=width/height,halfY=Math.max(4.0,3.7/aspect);
    this.camera.left=-halfY*aspect;this.camera.right=halfY*aspect;this.camera.top=halfY;this.camera.bottom=-halfY;
    this.camera.updateProjectionMatrix();this.dirty=true;
  }
  pick(event){
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);this.scene.updateMatrixWorld(true);
    return this.raycaster.intersectObjects(this.hits,false)[0]?.object.userData.pitch??null;
  }
  setChord(value){
    const previous=this.chord;this.chord={...value};this.transition=null;
    const movement=voiceLeading(previous,value);
    if(!this.reduced.matches&&movement.common.length===2&&movement.from.length===1){
      this.transition={common:movement.common,from:position(movement.from[0]),to:position(movement.to[0]),start:performance.now()};
    }
    const notes=triad(value);this.canvas.dataset.chord=`${value.root}:${value.quality}`;
    this.canvas.dataset.activePitches=notes.join(',');this.paintAnchors();this.updateTriangle(notes.map(position));this.dirty=true;
  }
  paintAnchors(){
    const notes=triad(this.chord),members=this.layer===5?scale(this.chord):notes;
    for(let i=0;i<12;i++){
      const selected=notes.includes(i),member=members.includes(i);
      this.anchors[i].material.color.setHex(selected?BLUE:member&&this.layer===5?0x879fe5:INK);
      this.anchors[i].scale.setScalar(selected?1.12:1);
    }
  }
  updateTriangle(points){
    const values=points.flatMap(p=>p.toArray());
    this.face.geometry.attributes.position.array.set(values);this.face.geometry.attributes.position.needsUpdate=true;
    this.face.geometry.computeBoundingSphere();
    this.edges.geometry.attributes.position.array.set(values);this.edges.geometry.attributes.position.needsUpdate=true;this.edges.geometry.computeBoundingSphere();
  }
  setLayer(index){
    this.layer=index;this.canvas.dataset.layer=String(index);this.paintAnchors();
    // A selected element changes viewpoint; it never changes musical identities.
    const angle=index===2?0:((index%4)-1.5)*.2;
    const target=new THREE.Vector3(Math.sin(angle)*14,.15,Math.cos(angle)*14);
    this.flight={from:this.camera.position.clone(),to:target,start:performance.now()};this.dirty=true;
  }
  reset(){
    this.camera.zoom=1;this.camera.updateProjectionMatrix();this.controls.target.set(0,0,0);
    this.flight={from:this.camera.position.clone(),to:new THREE.Vector3(0,.15,14),start:performance.now()};this.dirty=true;
  }
  setVisible(value){
    this.active=value;this.canvas.hidden=!value;this.labels.hidden=!value;
    if(value){this.resize();this.dirty=true;}
  }
  updateLabels(){
    const notes=triad(this.chord),placed=[],w=this.host.clientWidth,h=this.host.clientHeight;
    for(const label of this.labels.children){
      const pitch=Number(label.dataset.pitch),visible=notes.includes(pitch)||pitch===this.hover;
      label.hidden=!visible;label.tabIndex=visible?0:-1;if(!visible)continue;
      const p=position(pitch).project(this.camera);
      let x=(p.x+1)*w/2+14,y=(1-p.y)*h/2-9;
      x=Math.max(8,Math.min(w-34,x));y=Math.max(8,Math.min(h-25,y));
      while(placed.some(q=>Math.abs(q.x-x)<34&&Math.abs(q.y-y)<21))y+=22;
      placed.push({x,y});label.style.transform=`translate(${x}px,${y}px)`;
    }
  }
  frame(){
    if(!this.running)return;
    if(this.active&&this.host.clientWidth&&this.host.clientHeight&&!document.hidden){
      if(this.flight){
        const f=this.flight,t=this.reduced.matches?1:Math.min(1,(performance.now()-f.start)/480);
        this.camera.position.lerpVectors(f.from,f.to,1-(1-t)**3);this.dirty=true;if(t===1)this.flight=null;
      }
      if(this.transition){
        const tr=this.transition,t=this.reduced.matches?1:Math.min(1,(performance.now()-tr.start)/500);
        const moving=tr.from.clone().lerp(tr.to,1-(1-t)**3).normalize().multiplyScalar(R);
        this.mover.position.copy(moving);this.mover.visible=t<1;
        this.updateTriangle([...tr.common.map(position),moving]);this.dirty=true;
        if(t===1){this.transition=null;this.updateTriangle(triad(this.chord).map(position));}
      }
      this.controls.update();
      if(this.dirty){this.renderer.render(this.scene,this.camera);this.updateLabels();this.dirty=false;}
    }
    this.raf=requestAnimationFrame(()=>this.frame());
  }
  exportPNG(){
    const image=document.createElement('canvas');
    image.width=this.canvas.width;image.height=this.canvas.height;
    const ctx=image.getContext('2d');ctx.drawImage(this.canvas,0,0);
    const box=this.canvas.getBoundingClientRect(),ratio=image.width/box.width;
    ctx.scale(ratio,ratio);ctx.font='15px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.textBaseline='top';
    for(const label of this.labels.children){
      if(label.hidden)continue;
      const r=label.getBoundingClientRect(),x=r.left-box.left,y=r.top-box.top;
      ctx.fillStyle='#f4f5f6dd';ctx.fillRect(x,y,r.width,r.height);
      ctx.fillStyle='#23262b';ctx.fillText(label.textContent,x+3,y+2);
    }
    return image.toDataURL('image/png');
  }
  dispose(){
    this.running=false;cancelAnimationFrame(this.raf);this.observer.disconnect();window.removeEventListener('resize',this.windowResize);
    this.controls.dispose();const geometries=new Set(),materials=new Set();
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();
    this.canvas.remove();this.labels.remove();
  }
}
