import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePerformance,observationAt,performancePath,extent,normalizeValue,layerDescription,MUSIC_LAYERS,smoothTrajectory,intervalPaths} from '../src/performance-model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/research/vmus-performance.json',import.meta.url)));
test('public performance preserves the annotated eighth-note rate and digital dBFS method',()=>{
  validatePerformance(data);assert.equal(data.rows.length,168);
  assert.match(data.method.tempo,/eighth-note/);assert.match(data.method.dynamics,/not perceived loudness/);
  for(const p of data.rows){
    assert.ok(Math.abs(p.tempo-60000/p.rhythm)<.001);
    assert.ok(p.dynamics<0);assert.ok(p.timbre>0&&p.timbre<11025);
  }
});
test('playback lookup does not fabricate data before the first mark or after the last interval',()=>{
  assert.equal(observationAt(data,0),null);
  assert.equal(observationAt(data,data.rows.at(-1).end),null);
  assert.equal(observationAt(data,38.4),null);
  assert.equal(observationAt(data,data.rows[1].t),data.rows[1]);
  assert.equal(observationAt(data,NaN),null);
});
test('temporal geometry splits gaps, preserves source values, and never changes with a static cursor',()=>{
  const copy=structuredClone(data);
  const broken={...data,rows:[data.rows[0],data.rows[4]]};
  const result=performancePath(broken,data.rows[4].t);
  assert.deepEqual(result.map(p=>p.segment),[0,1]);
  assert.deepEqual(performancePath(data,10),performancePath(data,10));
  assert.deepEqual(data,copy);
  assert.ok(performancePath(data,10).every(p=>p.t<=10&&p.end>=2));
});
test('constant observations retain a finite centered coordinate and invalid intervals are rejected',()=>{
  const range=extent([5,5,5]);assert.equal(normalizeValue(5,range),.5);
  for(const edit of [{tempo:null},{end:-1},{dynamics:Infinity},{t:-1}]){
    const copy=structuredClone(data);Object.assign(copy.rows[0],edit);assert.throws(()=>validatePerformance(copy));
  }
  const overlap=structuredClone(data);overlap.rows[1].t=overlap.rows[0].t;assert.throws(()=>validatePerformance(overlap));
});
test('ten feature pages keep categorical and unaligned score evidence distinct from numeric observations',()=>{
  assert.equal(MUSIC_LAYERS.length,10);
  assert.equal(MUSIC_LAYERS.filter(l=>l.metric).length,4);
  assert.equal(layerDescription(MUSIC_LAYERS[5],data).value,'未標注');
  assert.match(layerDescription(MUSIC_LAYERS[0],data).note,/尚未對位/);
  assert.equal(layerDescription(MUSIC_LAYERS[4],null).value,'—');
});
test('display smoothing is causal, bounded and never bridges gaps or edits raw measurements',()=>{
  const raw=structuredClone(data.rows),smooth=smoothTrajectory(raw,1);
  assert.deepEqual(raw,data.rows);
  assert.deepEqual(smoothTrajectory(raw,0),raw);
  assert.deepEqual(smooth.slice(0,10),smoothTrajectory(raw.slice(0,10),1));
  const constant=[{t:0,tempo:50,dynamics:50,segment:0},{t:1,tempo:50,dynamics:50,segment:0}];
  assert.deepEqual(smoothTrajectory(constant,1),constant);
  const gap=[raw[0],raw[9]];assert.deepEqual(smoothTrajectory(gap,1),gap);
  for(let i=1;i<smooth.length;i++)for(const key of ['tempo','dynamics']){
    assert.ok(smooth[i][key]>=Math.min(smooth[i-1][key],raw[i][key])-1e-9);
    assert.ok(smooth[i][key]<=Math.max(smooth[i-1][key],raw[i][key])+1e-9);
  }
});
test('a time cursor lies on its interval curve, including between marker timestamps',()=>{
  for(const layer of MUSIC_LAYERS.filter(l=>l.metric)){
    const paths=intervalPaths(data,layer.key);
    for(const row of data.rows){
      const t=(row.t+row.end)/2,value=observationAt(data,t)[layer.key];
      assert.ok(paths.some(path=>path.some(([x,y],i)=>i&&path[i-1][0]<=t&&t<x&&
        path[i-1][1]===value&&y===value)));
    }
  }
  const missing={...data,rows:[data.rows[0],data.rows[5]]};
  const paths=intervalPaths(missing,'tempo');
  assert.equal(paths.length,2);
  assert.equal(paths[0].at(-1)[0],data.rows[0].end);
  assert.equal(paths[1][0][0],data.rows[5].t);
});
