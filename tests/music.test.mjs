import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, mapMusic, pointFor, Snake } from '../src/music.mjs';

test('all ten music parameters use the same valid sample and are deterministic',()=>{
  const sample={valid:true,attention:60,relaxation:70,source:'core',timestamp:100};
  const result=mapMusic(sample);
  assert.equal(Object.keys(result.parameters).length,10);
  assert.equal(ELEMENTS.length,10);
  assert.deepEqual(result,mapMusic(sample));
  assert.deepEqual(result.inputs,{attention:60,relaxation:70});
  assert.equal(result.parameters.tempo,78);assert.equal(result.ts,100);
});
test('missing/stale data produces no music mapping and no point',()=>{
  assert.equal(mapMusic({valid:false,attention:100,relaxation:100}),null);
  assert.equal(mapMusic(null),null);assert.equal(pointFor({valid:false}),null);
});
test('corners, valid zero scores and range edits behave predictably',()=>{
  assert.deepEqual(pointFor({valid:true,attention:0,relaxation:100}),{x:0,y:0});
  const result=mapMusic({valid:true,attention:100,relaxation:0},{bpmMin:40,bpmMax:120});
  assert.equal(result.parameters.tempo,120);
  assert.throws(()=>mapMusic({valid:true,attention:50,relaxation:50},{bpmMin:120,bpmMax:40}));
});
test('snake follows EEG target and stops without valid indices',()=>{
  const snake=new Snake();const original={...snake.head};
  snake.step({valid:false,attention:100,relaxation:100},.1);
  assert.deepEqual(snake.head,original);
  snake.step({valid:true,attention:100,relaxation:100},.1);
  assert.ok(snake.head.x>original.x);assert.ok(snake.head.y<original.y);
  assert.equal(snake.tail.length,1);
});
