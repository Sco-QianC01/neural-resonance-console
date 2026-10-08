import test from 'node:test';
import assert from 'node:assert/strict';
import {wormViewport,drawWorm} from '../src/waveform-view.mjs';
import {buildWormTrace} from '../src/worm-model.mjs';
test('worm uses equal physical scaling on both axes at desktop, phone and exhibition sizes',()=>{
  for(const [w,h] of [[1000,520],[320,330],[1800,800]]){
    const viewport=wormViewport(w,h);
    assert.ok(viewport.left>=0&&viewport.top>=0);
    assert.ok(viewport.left+viewport.size<=w);
    assert.ok(viewport.top+viewport.size<=h);
  }
});
test('drawing never creates a point or changes measurements, including a paused trace',()=>{
  const ctx=new Proxy({},{get:(target,key)=>target[key]??(()=>{})});
  const canvas={clientWidth:850,clientHeight:500,width:0,height:0,dataset:{},getContext:()=>ctx};
  const history=[{valid:true,timestamp:1000,attention:50,relaxation:50,source:'device',packets:1}];
  const trace=buildWormTrace(history,{now:1000,space:'eeg'});
  const before=JSON.stringify(trace.points);
  drawWorm(canvas,history,0,{space:'eeg',trace,active:false});
  const coordinate=canvas.dataset.coordinate;
  drawWorm(canvas,history,500,{space:'eeg',trace,active:false});
  assert.equal(canvas.dataset.coordinate,coordinate);
  assert.equal(JSON.stringify(trace.points),before);
  assert.equal(canvas.dataset.samples,'1');
});
