import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot} from '../src/eeg.mjs';
import {buildWormTrace} from '../src/worm-model.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {beatIntervals,onsetIntervals,gaussianTempo,musicPoint,musicExtent,rawMusicPoints,alignEEG,zoomRange,timeToBar,timeToScorePosition,barTicks,barLayerWindow} from '../src/fusion-model.mjs';

test('raw packets do not become new index observations when both field clocks are unchanged',()=>{
  const input={schemaVersion:'neural-resonance-live-v1',source:'device',sessionId:'fixture',transport:'usb',
    metricOrigin:'thinkgear-esense',eeg:{attention:60,meditation:70,poor_signal:0}};
  const rows=[1,1.5,2,2.5].map((ts,i)=>normalizeSnapshot({...input,ts,quality:{eegPackets:100+i},
    fieldTimestamps:{attention:1,meditation:1}},ts*1000));
  const trace=buildWormTrace(rows,{now:2600,space:'eeg'});
  assert.equal(trace.points.length,1);
  assert.equal(trace.points[0].timestamp,1000);
  assert.equal(trace.points[0].attention,60);
  rows.push(normalizeSnapshot({...input,ts:2.8,quality:{eegPackets:110},
    fieldTimestamps:{attention:2.7,meditation:2.7}},2800));
  assert.equal(buildWormTrace(rows,{now:2800}).points.length,2);
});
test('beat tempo and rhythm preserve notated units and gaps',()=>{
  const rows=beatIntervals({t:[0,1,3,4,6],w:[1,2,0,1],bar0:5,bpb:1});
  assert.deepEqual(rows.map(r=>r.tempo),[60,60,null,30]);
  assert.equal(rows[1].ioi,2000);
  assert.equal(rows[1].bar,6);
  assert.throws(()=>beatIntervals({t:[0,1,1]}));
});
test('contact loss does not make cached or backwards index clocks into new measurements',()=>{
  const row=(ts,at,quality,count)=>normalizeSnapshot({
    schemaVersion:'neural-resonance-live-v1',source:'device',ts,transport:'usb',sessionId:'fixture',
    quality:{eegPackets:count},fieldTimestamps:{attention:at,meditation:at},
    eeg:{attention:60,meditation:70,poor_signal:quality}},ts*1000);
  const rows=[row(5,4.9,0,10),row(5.1,4.9,200,11),row(5.2,4.9,0,12),
    row(5.3,4.8,0,13),row(5.5,5.4,0,14)];
  const trace=buildWormTrace(rows,{now:5600});
  assert.equal(trace.points.length,2);
  assert.notEqual(trace.points[0].segment,trace.points[1].segment);
});
test('Gaussian W means 2 sigma; constant tempi remain constant at recording edges',()=>{
  const a={t:[0,1,2,3],window:1};
  const curve=gaussianTempo(beatIntervals(a),1,.04);
  assert.ok(curve.every(p=>Math.abs(p.tempo-60)<1e-8));
  assert.equal(gaussianTempo(beatIntervals({t:[0,1,2,3],w:[1,0,1]}),1,.04)
    .filter(p=>p.t>1&&p.t<2).every(p=>p.tempo===null),true);
});
test('current music interval is left closed/right open and amplitude does not extrapolate',()=>{
  const rec={annotation:{t:[0,1,3],bpb:1,bar0:1,amp:{dt:1,v:[10,20,30]}}};
  const raw=beatIntervals(rec.annotation);
  assert.equal(musicPoint(rec,raw,[],1,false).rawTempo,30);
  assert.equal(musicPoint(rec,raw,[],1,false).level,20);
  assert.equal(musicPoint(rec,raw,[],3,false),null);
  const noAmp={annotation:{t:[0,1,3]}};
  assert.equal(musicPoint(noAmp,raw,[],1,false).level,null);
  assert.ok(musicExtent(raw).every(Number.isFinite));
});
test('unsmoothed paths change at the actual beat boundary, without interpolating phantom tempi',()=>{
  const rec={annotation:{t:[0,.83,2.14],amp:{dt:.2,v:Array(12).fill(50)}}};
  const points=rawMusicPoints(rec,beatIntervals(rec.annotation));
  const boundary=points.filter(p=>p.t===.83);
  assert.equal(boundary.length,2);
  assert.equal(boundary[0].tempo,60/.83);
  assert.equal(boundary[1].tempo,60/(2.14-.83));
  assert.equal(boundary[0].pickable,false);
  assert.equal(boundary[1].pickable,undefined);
});
test('EEG alignment uses index source time, rejects history before playback and keeps run boundaries',()=>{
  const p={timestamp:10000,indexTimestamp:9000,attention:60,relaxation:70,segment:1,source:'device'};
  assert.equal(alignEEG(p,{wallNow:10000,mediaTime:.5,startedAt:9500,run:1}),null);
  const q=alignEEG(p,{wallNow:10000,mediaTime:2,startedAt:8500,run:2});
  assert.equal(q.t,1);assert.equal(q.run,2);assert.equal(q.indexTimestamp,9000);
  assert.equal(alignEEG(p,{wallNow:14000,mediaTime:2,startedAt:8500,run:2}),null);
});
test('fine observation is a range zoom and never edits native values',()=>{
  assert.deepEqual(zoomRange(60,50),[35,85]);
  assert.deepEqual(zoomRange(99,25),[75,100]);
  assert.deepEqual(zoomRange(2,25),[0,25]);
  assert.deepEqual(zoomRange(60,100),[0,100]);
});
test('observation exports include the accepted packet when the index field precedes delivery',()=>{
  const input={schemaVersion:'neural-resonance-live-v1',source:'device',sessionId:'fixture',transport:'usb',
    ts:2,quality:{eegPackets:2},eeg:{attention:40,meditation:60,poor_signal:0},
    fieldTimestamps:{attention:1.8,meditation:1.8}};
  const current=normalizeSnapshot(input,2000);
  const summary=createMusicPrompt([current],{current,now:2000});
  assert.equal(summary.observedSamples,1);
  assert.equal(summary.inputs.attention,40);
  assert.equal(buildWormTrace([current],{now:2000}).points[0].originalTimestamp,1800);
});

test('Chopin public catalog retains every media ID and performer, without other composers', async()=>{
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const catalog=JSON.parse(await readFile(new URL('../public/research/vmus-reference-cases.json',import.meta.url),'utf8'));
  const bytes=await readFile(new URL('./fixtures/vmus-chopin-contents.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),catalog.catalogSha256);
  const source=JSON.parse(bytes);
  assert.deepEqual(catalog.recordings.map(r=>r.mediaId).sort((a,b)=>a-b),source.items.map(r=>r.media_id).sort((a,b)=>a-b));
  assert.equal(catalog.recordings.length,40);assert.equal(new Set(catalog.recordings.map(r=>r.performanceId)).size,15);
  assert.equal(catalog.works.length,2);assert.ok(catalog.works.every(w=>w.composer==='Frederic Chopin'));
  assert.equal(catalog.recordings.filter(r=>r.completeStudy).length,10);
  for(const r of catalog.recordings){assert.equal(r.media,source.items.find(i=>i.media_id===r.mediaId).media_url);}
});
test('performance profile score position follows each recording boundary, not shared seconds',async()=>{
  const {tempoSummary}=await import('../src/fusion-model.mjs');
  const a=beatIntervals({t:[0,1,3,6,10],bpb:2,bar0:1});
  const b=beatIntervals({t:[0,2,6,12,20],bpb:2,bar0:1});
  assert.equal(timeToBar(a,3),2);assert.equal(timeToBar(b,6),2);
  assert.equal(timeToBar(a,2),1);assert.equal(timeToBar(a,10),null);
  assert.equal(timeToScorePosition(a,2),1.75);assert.equal(timeToScorePosition(a,10),3);
  assert.equal(timeToBar(a,-.01),null);assert.equal(timeToBar(a,10.01),null);
  assert.equal(tempoSummary(a).mean,24);assert.equal(tempoSummary(b).mean,12);
  const gap=beatIntervals({t:[0,1,2,3],w:[1,0,1],bpb:1});
  assert.equal(timeToBar(gap,1.5),null);assert.equal(tempoSummary(gap).mean,60);
});
test('integer bar layers retain subdivisions, exact boundaries and missing score positions',()=>{
  const rows=beatIntervals({t:[0,1,2,3,4,5,6],bpb:2,bar0:1});
  assert.deepEqual(rows.map(p=>p.bar),[1,1,2,2,3,3]);
  assert.deepEqual(rows.map(p=>p.beatInBar),[0,1,0,1,0,1]);
  assert.deepEqual(rows.map(p=>p.barPosition),[1,1.5,2,2.5,3,3.5]);
  assert.equal(timeToBar(rows,1.999999),1);assert.equal(timeToBar(rows,2),2);
  assert.equal(timeToScorePosition(rows,6),4);
  for(const bpb of [0,-1,NaN,Infinity,1.5])assert.throws(()=>beatIntervals({t:[0,1],bpb}));
  for(const bar0 of [0,NaN,1.5])assert.throws(()=>beatIntervals({t:[0,1],bar0}));
  const unknown=onsetIntervals({t:[0,1,2]});
  assert.ok(unknown.every(p=>p.bar===null&&p.barPosition===null&&p.beatInBar===null));
});
test('bar tick labels are distinct integers and layer windows keep current bar without data loss',()=>{
  assert.deepEqual(barTicks(1,78),[1,20,40,59,78]);
  assert.deepEqual(barTicks(2,3),[2,3]);assert.deepEqual(barTicks(7,7),[7]);
  const rows=beatIntervals({t:Array.from({length:25},(_,i)=>i),bpb:2});
  const saved=structuredClone(rows),layer=barLayerWindow(rows,17,8);
  assert.equal(layer.current,9);assert.equal(layer.bars.length,8);
  assert.ok(layer.bars.includes(9));assert.equal(barLayerWindow(rows,17,0).bars.length,12);
  assert.equal(barLayerWindow(rows,0,8).first,1);
  assert.equal(barLayerWindow(rows,24,8).current,null);
  assert.equal(barLayerWindow(onsetIntervals({t:[0,1,2]}),1),null);
  assert.deepEqual(rows,saved);
});
test('untyped and IOI annotations preserve intervals without manufacturing a tempo or dynamics',async()=>{
  const {onsetIntervals}=await import('../src/fusion-model.mjs');
  const recording={annotation:{kind:'onsets',t:[1,1.3,2],labels:['1.1','2.1','3.1']}};
  const raw=onsetIntervals(recording.annotation),p=musicPoint(recording,raw,[],1.2,false);
  assert.equal(p.tempo,null);assert.equal(p.rawTempo,null);assert.equal(p.level,null);assert.equal(p.bar,null);
  assert.ok(Math.abs(p.ioi-300)<1e-9);assert.equal(musicPoint(recording,raw,[],2),null);
});
test('out-of-media historical timestamps stay preserved but cannot become valid intervals',async()=>{
  const {onsetIntervals}=await import('../src/fusion-model.mjs');
  const annotation={t:[.05,1,2,48695.774],labels:['1.1','1.2','1.3','1.4']};
  const raw=onsetIntervals(annotation,16.404875);
  assert.equal(raw.length,2);assert.ok(raw.every(p=>p.end<=16.404875));
  assert.equal(musicPoint({annotation},raw,[],10),null);assert.equal(annotation.t.at(-1),48695.774);
});
