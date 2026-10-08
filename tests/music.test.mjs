import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, mapMusic, pointFor } from '../src/music.mjs';
import {networkStates,networkGeometry} from '../src/neural-networks.mjs';

test('ten music slots retain the same timestamp without filling missing measurements',()=>{
  const sample={valid:true,attention:60,relaxation:70,source:'core',timestamp:100};
  const result=mapMusic(sample);
  assert.equal(Object.keys(result.parameters).length,10);
  assert.equal(ELEMENTS.length,10);
  assert.deepEqual(result,mapMusic(sample));
  assert.deepEqual(result.inputs,{attention:60,relaxation:70});
  assert.equal(result.parameters.tempo,null);assert.equal(result.ts,100);
  assert.ok(Object.values(result.parameters).every(value=>value===null));
});
test('missing/stale data produces no music mapping and no point',()=>{
  assert.equal(mapMusic({valid:false,attention:100,relaxation:100}),null);
  assert.equal(mapMusic(null),null);assert.equal(pointFor({valid:false}),null);
});
test('corners, valid zero scores and range edits behave predictably',()=>{
  assert.deepEqual(pointFor({valid:true,attention:0,relaxation:100}),{x:0,y:1});
  const result=mapMusic({valid:true,attention:100,relaxation:0},{bpmMin:40,bpmMax:120});
  assert.equal(result.parameters.tempo,null);
});
test('ten annotation categories never assert brain-connectivity geometry',()=>{
  assert.deepEqual(ELEMENTS.map(e=>e[1]),['旋律','節奏','和聲','力度／響度','速度','調式','曲式','織體','音色','演奏法']);
  const states=networkStates({valid:true,attention:100,relaxation:0,source:'demo',timestamp:1});
  assert.equal(states.length,10);assert.equal(networkStates({valid:false}),null);
  for(const state of states){
    assert.equal(state.density,null);assert.equal(state.dispersion,null);
    const geometry=networkGeometry(state,0);
    assert.equal(geometry.nodes.length,0);
    assert.equal(geometry.edges.length,0);
    assert.deepEqual(geometry,networkGeometry(state,0));
  }
  const low=networkStates({valid:true,attention:0,relaxation:0})[0];
  const high=states[0];
  assert.equal(high.value,low.value);assert.equal(high.nodeCount,0);
});
