import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWormTrace,traceStatistics,control127} from '../src/worm-model.mjs';
import {networkStates,networkGeometry} from '../src/neural-networks.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
const at=(timestamp,attention=50,relaxation=50,extra={})=>({
  valid:true,timestamp,attention,relaxation,source:'demo',sessionId:'one',
  transport:'demo',connectionEpoch:1,packets:timestamp,...extra,
});
test('control coordinates preserve 0–100 source and map 50 to 64, endpoints to 0/127',()=>{
  assert.deepEqual([0,50,100].map(control127),[0,64,127]);
  const trace=buildWormTrace([at(1000)],{now:1000,smoothingSeconds:0});
  assert.deepEqual(trace.points[0].controls127,{attention:64,relaxation:64});
  assert.equal(trace.points[0].attention,50);
  assert.equal(trace.points[0].rawX,64/127);
});
test('constant measurements do not move with animation time and have zero dispersion',()=>{
  const samples=Array.from({length:20},(_,i)=>at(1000+i*250));
  const trace=buildWormTrace(samples,{now:5750});
  assert.ok(trace.points.every(p=>Math.abs(p.x-64/127)<1e-12&&Math.abs(p.y-64/127)<1e-12));
  assert.ok(trace.stats.standardDistance<1e-12);assert.equal(trace.stats.density,null);
  for(const state of networkStates(samples[0]))
    assert.deepEqual(networkGeometry(state,0),networkGeometry(state,9999));
});
test('gaps, invalid contact and source identity never get joined or smoothed across',()=>{
  const samples=[at(1000,0,0),at(1250,10,10),at(1500,50,50,{valid:false}),
    at(1750,100,100),at(6000,20,20)];
  const trace=buildWormTrace(samples,{now:6000});
  assert.deepEqual(trace.points.map(p=>p.segment),[0,0,1,2]);
  assert.equal(trace.points[2].x,1);
  assert.equal(trace.stats.coverageSeconds,.25);
  const next=buildWormTrace([...samples,at(6250,80,20,{connectionEpoch:2})],{now:6250});
  assert.equal(next.points.length,1);
});
test('duplicate timestamps, frozen counts, future and invalid native values do not add points',()=>{
  const trace=buildWormTrace([at(1000,50,50,{packets:1}),at(1000),
    at(1250,60,60,{packets:1000}),at(1500,-1,50),at(1750,50,101),
    at(2000,50,50,{packets:1000}),at(5000)],{now:2000});
  assert.equal(trace.points.length,2);
  assert.deepEqual(trace.points.map(p=>p.timestamp),[1000,1250]);
});
test('time-weighted standard distance is invariant to packet frequency on the same linear path',()=>{
  const line=step=>Array.from({length:1000/step+1},(_,i)=>({
    timestamp:1000+i*step,rawX:i*step/1000,rawY:.5,segment:0,
    attention:i*step/10,relaxation:50,controls127:{attention:i,relaxation:64},
  }));
  const a=traceStatistics(line(250)),b=traceStatistics(line(50));
  assert.ok(Math.abs(a.standardDistance-b.standardDistance)<1e-10);
  assert.ok(Math.abs(a.standardDistance-100/Math.sqrt(12))<1e-10);
  assert.ok(Math.abs(a.pathLength-b.pathLength)<1e-10);
  assert.equal(a.coverageSeconds,1);
});
test('display smoothing is causal, stays within actual segment and preserves raw exports',()=>{
  const input=[at(1000,0,0),at(1250,100,100),at(1500,20,20)];
  const first=buildWormTrace(input.slice(0,2),{now:1250,smoothingSeconds:.75});
  const full=buildWormTrace(input,{now:1500,smoothingSeconds:.75});
  assert.equal(first.points[1].x,full.points[1].x);
  assert.equal(full.points[1].rawX,1);
  assert.ok(full.points[1].x>0&&full.points[1].x<1);
  assert.equal(input[1].attention,100);
});
test('ten categories preserve time and missing evidence without arbitrary shapes or controls',()=>{
  const states=networkStates(at(1000,65,45));
  assert.equal(states.length,10);
  for(const s of states){
    const g=networkGeometry(s);
    assert.equal(g.nodes.length,0);assert.equal(g.edges.length,0);
    assert.equal(s.control127,null);
    assert.equal(typeof s.descriptor,'string');
    assert.equal(s.timestamp,1000);
    assert.equal(s.value,null);assert.equal(s.status,'unavailable');
  }
});
test('prompt statistics and ten organizations exclude a previous connection epoch',()=>{
  const current=at(2000,80,60,{connectionEpoch:2});
  const result=createMusicPrompt([at(1000,10,10),current],{current,now:2000});
  assert.equal(result.observedSamples,1);
  assert.equal(result.organizations.length,10);
  assert.equal(result.wormVersion,'evidence-trace-v3');
  assert.equal(result.observedCoverageSeconds,0);
});
