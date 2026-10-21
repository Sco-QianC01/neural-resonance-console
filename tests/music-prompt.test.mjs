import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  readObservations,tempoStatistics,selectTags,compilePrompt,validateOrder,
} from '../music-prompt/contract.mjs';

const catalogue=JSON.parse(await readFile(new URL('../music-prompt/tags.json',import.meta.url),'utf8'));
const intent={style:'solo-piano',duration:30,tempoBpm:72,levels:{tempo:1,melody:2,harmony:1}};

test('tempo statistics preserve beat units and never span missing adjacent samples',()=>{
  const s=tempoStatistics([60,60,null,120,120],'eighth-notes/min');
  assert.equal(s.mean,90);
  assert.equal(s.sd,30);
  assert.equal(s.cv,1/3);
  assert.equal(s.adjacentChangeMean,0);
  assert.equal(s.unit,'eighth-notes/min');
  assert.equal(tempoStatistics([60,90],'BPM').cv,null);
  assert.throws(()=>tempoStatistics([60,0,90],'BPM'));
  assert.throws(()=>tempoStatistics([60,90,120],'untyped'));
});

test('valid positive tempo endpoints cannot overflow the adjacent log change',()=>{
  const s=tempoStatistics([Number.MIN_VALUE,10000,Number.MIN_VALUE],'BPM');
  assert.ok(Number.isFinite(s.adjacentChangeMean));
  assert.equal(s.adjacentChangeMean,Math.log2(10000)-Math.log2(Number.MIN_VALUE));
  assert.equal(JSON.parse(JSON.stringify(s)).adjacentChangeMean,s.adjacentChangeMean);
});

test('existing neural summary does not create music or invent dispersion levels',()=>{
  const s=readObservations(JSON.stringify({
    schemaVersion:'neural-observation-summary-v2',source:'device',
    observedSamples:20,windowSeconds:30,inputs:{attention:55,relaxation:62},
    musicPlan:null,claimsInferredFromEeg:false,
  }));
  assert.deepEqual(s.neural,{attention:55,relaxation:62});
  assert.equal(s.tempo,null);
  assert.equal(s.measuredMusic,false);
  assert.equal(s.dispersionLevel,null);
});

test('historical demo provenance survives import without becoming live hardware evidence',()=>{
  const data={schemaVersion:'neural-observation-summary-v2',source:'demo',sessionId:'demo-run',
    createdAt:'2020-01-01T00:00:05Z',firstTimestamp:1577836800000,lastTimestamp:1577836804000,
    observedCoverageSeconds:3,observedSamples:4,windowSeconds:10,
    inputs:{attention:55,relaxation:62}};
  const s=readObservations(JSON.stringify(data));
  assert.equal(s.source.kind,'demo');
  assert.equal(s.provenance.firstTimestamp,data.firstTimestamp);
  assert.equal(s.provenance.lastTimestamp,data.lastTimestamp);
  assert.equal(s.provenance.observedCoverageSeconds,3);
  assert.equal(s.provenance.sessionId,'demo-run');
  assert.equal(s.provenance.createdAt,data.createdAt);
  assert.equal(s.verification,'source-declared-not-independently-validated');
});

test('typed JSON has independent sample statistics and bounded parsing',()=>{
  const s=readObservations('\ufeff'+JSON.stringify({
    schemaVersion:'music-prompt-input-v1',source:{id:'reference',kind:'music-annotation'},
    music:{tempo:{values:[72,80,88],unit:'BPM'}},
  }));
  assert.equal(s.tempo.mean,80);
  assert.equal(s.source.id,'reference');
  assert.throws(()=>readObservations(' '.repeat(1048577)));
  assert.throws(()=>readObservations('{"schemaVersion":"other"}'));
  assert.throws(()=>readObservations('{"schemaVersion":"music-prompt-input-v1","music":{"tempo":{"values":[72,1e309,88],"unit":"BPM"}}}'));
});

test('only integer creative grades become tags and unavailable observations stay missing',()=>{
  const tags=selectTags(intent,catalogue);
  assert.ok(tags.some(t=>t.id==='tempo.1'));
  assert.ok(tags.some(t=>t.id==='harmony.1'));
  assert.ok(tags.some(t=>t.id==='recording.clean'));
  assert.throws(()=>selectTags({...intent,levels:{melody:1.5}},catalogue));
  assert.throws(()=>selectTags({...intent,levels:{madeUp:1}},catalogue));
  assert.throws(()=>selectTags({...intent,tempoBpm:0},catalogue));
  assert.throws(()=>selectTags({...intent,duration:Infinity},catalogue));
});

test('LLM cannot add, omit or duplicate approved tags',()=>{
  const ids=selectTags(intent,catalogue).map(t=>t.id);
  assert.deepEqual(validateOrder([...ids].reverse(),ids),[...ids].reverse());
  for(const bad of [ids.slice(1),[...ids,'unknown'],[...ids.slice(1),ids[1]]])
    assert.throws(()=>validateOrder(bad,ids));
});

test('ACE request keeps duration and tempo deterministic without neural interpretations',()=>{
  const observations=readObservations(JSON.stringify({
    schemaVersion:'music-prompt-input-v1',source:{id:'fixture',kind:'demo'},
  }));
  const tags=selectTags(intent,catalogue);
  const result=compilePrompt({observations,intent,tags,order:tags.map(t=>t.id),engine:'rules'});
  assert.equal(result.aceRequest.ditModel,'acestep-v15-xl-sft');
  assert.equal(result.aceRequest.duration,30);
  assert.equal(result.aceRequest.bpm,72);
  assert.equal(result.aceRequest.instrumental,true);
  assert.equal(result.aceRequest.lyrics,'');
  assert.match(result.aceRequest.songDescription,/72 BPM/);
  assert.doesNotMatch(result.aceRequest.songDescription,/attention|relaxation index|EEG|heart.rate|疗效/i);
  assert.equal(result.observations.dispersionLevel,null);
  assert.equal(result.remoteVerified,false);
  assert.equal(result.sunoFields.Instrumental,true);
  assert.ok(result.sunoFields.Exclude.includes('vinyl'));
  assert.throws(()=>compilePrompt({observations,intent,tags,order:[],engine:'ollama'}));
});
