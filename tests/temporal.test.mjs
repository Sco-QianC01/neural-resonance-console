import test from 'node:test';import assert from 'node:assert/strict';
import {timeBounds,timeTailStrength,temporalProjection} from '../src/temporal-model.mjs';
import {TemporalScene} from '../src/temporal-scene.mjs';
import {beatIntervals,gaussianTempo,musicPoint} from '../src/fusion-model.mjs';

function withMusicScene(check){
 const names=['document','window','ResizeObserver','getComputedStyle','devicePixelRatio'];
 const saved=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
 const paths=[],heads=[];
 const ctx=new Proxy({
  createRadialGradient:()=>({addColorStop(){}}),
  lineTo(x,y){if(this.strokeStyle==='#f3d7b2')paths.push({x,y});},
  arc(x,y,r){if(r===6)heads.push({x,y});},
 },{get:(target,key)=>target[key]??(()=>{})});
 const element=()=>Object.assign(new EventTarget(),{
  dataset:{},style:{},append(){},remove(){},setAttribute(){},
  getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0}),
 });
 Object.assign(globalThis,{
  document:{createElement:element},window:new EventTarget(),
  ResizeObserver:class{observe(){}disconnect(){}},
  getComputedStyle:()=>({getPropertyValue:()=>''}),devicePixelRatio:1,
 });
 let scene;
 try{
  const recording={annotation:{t:[0,1,2,3],bpb:1,bar0:1,amp:{dt:.5,v:[10,20,30,40,50,60,70]}}};
  const raw=beatIntervals(recording.annotation),curve=gaussianTempo(raw,1,.2);
  const points=curve.map(p=>musicPoint(recording,raw,curve,p.t,true)).filter(Boolean);
  let picks=0;
  scene=new TemporalScene(Object.assign(element(),{clientWidth:800,clientHeight:500}),{onMusicPick:()=>picks++});
  const state={points:[],active:false,space:'time',reference:100,comparison:{
   id:'test',time:.73,duration:3,layer:'worm',points,current:musicPoint(recording,raw,curve,.73,true),
   paired:[],barWindow:8,model:{raw,structure:[]},tempoUnit:'beat/min',smooth:true,
  }};
  paths.length=0;heads.length=0;scene.update(state);
  check({scene,state,paths,heads,picks:()=>picks});
 }finally{
  scene?.dispose();
  names.forEach((name,i)=>saved[i]?Object.defineProperty(globalThis,name,saved[i]):delete globalThis[name]);
 }
}

test('rotating the music scene cannot seek; a subsequent click still can',()=>{
 withMusicScene(({scene,picks})=>{
  const hit=scene.hits[0],click=()=>scene.canvas.dispatchEvent(Object.assign(new Event('click'),{clientX:hit.x,clientY:hit.y}));
  scene.moved=true;click();assert.equal(picks(),0);
  click();assert.equal(picks(),1);
 });
});
test('the music time cursor meets its displayed tail without bridging a segment break',()=>{
 withMusicScene(({scene,state,paths,heads})=>{
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert.ok(paths.length>0&&heads.length>0);
  assert.ok(distance(paths.at(-1),heads.at(-1))<1e-6);
  paths.length=0;heads.length=0;
  scene.update({...state,comparison:{...state.comparison,current:{...state.comparison.current,segment:99}}});
  assert.ok(paths.every(p=>distance(p,heads.at(-1))>1e-6));
 });
});
test('time tail is based on playback seconds and remains bounded',()=>{
 assert.equal(timeTailStrength(97,100),0);
 assert.equal(timeTailStrength(98.5,100),.5);
 assert.equal(timeTailStrength(100,100),1);
 assert.equal(timeTailStrength(102,100),1);
 assert.equal(timeTailStrength(99,100,0),0);
});
test('time depth comes from source timestamps and preserves source coordinates',()=>{
 const points=[{timestamp:1000,attention:40,relaxation:60},{timestamp:9000,attention:40,relaxation:60}];
 const saved=structuredClone(points),bounds=timeBounds(points,60),project=temporalProjection(900,650,{x:[0,100],y:[0,100]},bounds);
 assert.deepEqual(bounds,[1000,61000]);assert.notDeepEqual(project.point(points[0]),project.point(points[1]));assert.deepEqual(points,saved);
 assert.equal(project.depth(points[1]),8);assert.equal(project.depth(points[0]),0);
});
test('rotation changes projection only and remains finite in small viewports',()=>{
 const point={timestamp:2500,attention:70,relaxation:30},range={x:[45,95],y:[5,55]};
 const a=temporalProjection(320,340,range,[1000,11000]),b=temporalProjection(320,340,range,[1000,11000],{yaw:-.4,pitch:.2});
 assert.notDeepEqual(a.point(point),b.point(point));assert.equal(b.depth(point),1.5);
 for(const vertex of b.corners)assert.ok(Number.isFinite(vertex.x)&&Number.isFinite(vertex.y));
 assert.equal(a.point({...point,attention:101}),null);
});
