import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scoreEvidence,melodicInterval,alignScore,scoreAt,scoreExport} from '../src/score-evidence.mjs';
const load=()=>JSON.parse(readFileSync(new URL('../public/research/chopin-score/op27-2-bars1-8.json',import.meta.url)));
const note=(step,alter,octave)=>({step,alter,octave});
test('distributed events point to the exact frozen source rows and original tokens',()=>{
  const data=load(),bytes=readFileSync(new URL('../public/research/chopin-score/027-1-Sm-002.krn',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),data.source.sha256);
  const lines=bytes.toString('utf8').split('\n');
  for(const e of [...data.events,...data.ornaments]){
    for(let i=0;i<e.sourceRows.length;i++)assert.equal(lines[e.sourceRows[i]-1].split('\t')[2],e.tokens[i]);
  }
});
test('spelled melodic intervals distinguish repeat, chromatic unison, diatonic steps and leaps',()=>{
  assert.deepEqual(melodicInterval(note('C',0,4),note('C',0,4)),{semitones:0,diatonic:1,direction:0,kind:'repeat'});
  assert.equal(melodicInterval(note('C',0,4),note('C',1,4)).kind,'chromatic');
  const diminished=melodicInterval(note('C',1,4),note('D',-1,4));
  assert.equal(diminished.semitones,0);assert.equal(diminished.kind,'step');
  assert.equal(melodicInterval(note('B',0,4),note('C',0,5)).kind,'step');
  assert.equal(melodicInterval(note('C',0,5),note('A',0,4)).semitones,-3);
  assert.equal(melodicInterval(note('C',0,5),note('A',0,4)).kind,'leap');
});
test('fixed score preserves rests, tie segments, grace exclusions, spelling and source provenance',()=>{
  const source=load(),s=scoreEvidence(source);
  assert.equal(s.measures.length,8);
  assert.equal(s.measures[0].onsets,0);assert.equal(s.measures[0].restFraction,1);
  assert.equal(s.events.find(e=>e.bar===2).pitchName,'F5');
  assert.equal(s.events.find(e=>e.bar===3).durationQ,2);
  assert.equal(s.events.find(e=>e.bar===3).sourceRows.length,2);
  assert.equal(s.events.find(e=>e.bar===5).pitchName,'A4');
  assert.equal(s.events.find(e=>e.bar===5).inScale,false);
  assert.equal(s.events.find(e=>e.bar===6&&e.onsetQ===1.75).interval,null);
  assert.equal(s.ornaments.length,6);
  assert.ok(s.ornaments.every(e=>e.durationQ===null));
  assert.ok(s.events.every(e=>e.sourceRows.length&&e.tokens.length===e.sourceRows.length));
  assert.ok(s.measures.every(m=>Number.isInteger(m.bar)&&m.focus===null&&m.dispersal===null));
});
test('counts, fractions and duration changes can be reconstructed without complements or invented weights',()=>{
  const s=scoreEvidence(load()),m=s.measures.find(m=>m.bar===2);
  assert.equal(m.onsets,4);assert.equal(m.densityPerQuarter,4/3);
  assert.equal(m.stepCount,2);assert.equal(m.leapCount,1);assert.equal(m.intervalCount,3);
  assert.equal(m.outOfScaleCount,0);assert.equal(m.restFraction,0);
  assert.deepEqual(m.durationHistogram,{'3/2':1,'1/2':1,'3/4':1,'1/4':1});
  assert.ok(Math.abs(s.events.find(e=>e.bar===2&&e.onsetQ===1.5).durationChangeLog2-Math.log2(1/3))<1e-12);
});
test('source mismatches, invalid fractions, overlapping voices and missing provenance fail closed',()=>{
  const s=load();s.events[0].duration=[0,1];assert.throws(()=>scoreEvidence(s));
  const overlap=load();overlap.events[2].onset=[0,1];assert.throws(()=>scoreEvidence(overlap));
  const missing=load();missing.source.sha256='';assert.throws(()=>scoreEvidence(missing));
  const wrong=load();wrong.source.sha256='b'.repeat(64);assert.throws(()=>scoreEvidence(wrong));
  const key=load();delete key.context.scale;assert.throws(()=>scoreEvidence(key));
  const changed=load();changed.context.scale[0].alter=0;assert.throws(()=>scoreEvidence(changed));
});
test('alignment uses each variable beat anchor and rejects incompatible or partial source annotations',()=>{
  const s=scoreEvidence(load()),rec={id:'test',workId:6,completeStudy:true,annotation:{kind:'beats',bpb:6,bar0:1,meter:'6/8',t:Array.from({length:49},(_,i)=>i*i/10)}};
  const a=alignScore(s,rec),first=a.events.find(e=>e.bar===2);
  assert.equal(first.t,3.6);assert.equal(first.end,8.1);
  const last=a.events.at(-1);assert.equal(last.end,230.4);
  assert.equal(scoreAt(a,0).event,null);assert.equal(scoreAt(a,3.6).event.id,first.id);
  assert.equal(scoreAt(a,230.4).event,null);assert.equal(scoreAt(a,-1).bar,null);
  assert.equal(alignScore(s,{...rec,workId:4040}),null);
  assert.equal(alignScore(s,{...rec,completeStudy:false}),null);
  assert.equal(alignScore(s,{...rec,annotation:{...rec.annotation,bpb:4}}),null);
  assert.equal(alignScore(s,{...rec,annotation:{...rec.annotation,t:[0,2,1]}}),null);
  const exported=scoreExport(s,a,rec);
  assert.equal(exported.alignment.noteOnsetsMeasured,false);
  assert.deepEqual(exported.alignment.anchors,rec.annotation.t);
  assert.equal(exported.source.sha256,s.source.sha256);
});
