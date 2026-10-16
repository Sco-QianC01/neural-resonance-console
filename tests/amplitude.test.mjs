import test from 'node:test';
import assert from 'node:assert/strict';
import {RawAmplitude,acRms,lightEncoding,formatAmplitude} from '../src/amplitude-model.mjs';
import {neuralExportName,neuralTraceStyle,plotBox,plotPosition,wrapText} from '../src/planar-model.mjs';
import {captureSnapshot,replayPacket} from '../src/recording.mjs';
import {normalizeSnapshot,StreamState} from '../src/eeg.mjs';
const packet=(at,samples,extra={})=>({
  timestamp:at,signalValid:true,valid:true,source:'device',sessionId:'s',transport:'usb',connectionEpoch:1,
  packets:at,raw:{rawEegSamples:samples,rawUnit:'ADC counts',rawSequence:at,...extra},
});
test('AC RMS removes DC, keeps source units and does not use frequency-band power',()=>{
  assert.equal(acRms([-2,2,-2,2]).rms,2);
  assert.equal(acRms([998,1002,998,1002]).rms,2);
  assert.equal(acRms([55,55,55]).rms,0);
  assert.equal(acRms([]),null);assert.equal(acRms([1,NaN]),null);
  const tracker=new RawAmplitude();
  tracker.push(packet(1000,[],{eeg:{alpha:5000,beta:10000}}));
  assert.equal(tracker.value(1000),null);
});
test('rolling window accumulates raw chunks, reports window size and preserves original samples',()=>{
  const tracker=new RawAmplitude(),a=Array(16).fill(-100),b=Array(16).fill(100);
  const saved=a.slice();tracker.push(packet(1000,a,{rawSequence:16,sampleRate:512}));
  assert.equal(tracker.value(1000),null);
  tracker.push(packet(1100,b,{rawSequence:32,sampleRate:512}));
  const v=tracker.value(1100);
  assert.equal(v.rms,100);assert.equal(v.samples,32);assert.equal(v.unit,'ADC counts');
  assert.equal(v.nominalDurationSeconds,32/512);
  assert.deepEqual(a,saved);
  for(let i=0;i<10;i++)tracker.push(packet(1200+i*100,Array(32).fill(0),{rawSequence:64+i*32}));
  assert.equal(tracker.value(2200).samples,256);
});
test('raw sequence deduplicates overlapping data and resets when samples are missing',()=>{
  const tracker=new RawAmplitude();
  tracker.push(packet(1000,Array.from({length:64},(_,i)=>i%2?10:-10),{rawSequence:64}));
  assert.equal(tracker.value(1000).rms,10);
  tracker.push(packet(1100,Array(64).fill(999),{rawSequence:64}));
  assert.equal(tracker.value(1100).rms,10);
  tracker.push(packet(1200,Array(48).fill(0),{rawSequence:80}));
  assert.equal(tracker.value(1200).samples,80);
  tracker.push(packet(1300,Array(16).fill(100),{rawSequence:200,rawDropped:104}));
  assert.equal(tracker.value(1300),null);
});
test('contact, freshness, epoch and unit boundaries prevent mixing or stale amplitude',()=>{
  const tracker=new RawAmplitude(),samples=Array.from({length:32},(_,i)=>i%2?20:-20);
  tracker.push(packet(1000,samples));
  assert.equal(tracker.value(4001),null);
  tracker.push({...packet(4100,samples),signalValid:false});
  assert.equal(tracker.value(4100),null);
  tracker.push(packet(4200,samples));assert.equal(tracker.value(4200).rms,20);
  tracker.push({...packet(4300,Array(16).fill(999)),connectionEpoch:2});assert.equal(tracker.value(4300),null);
  tracker.push({...packet(4400,Array(16).fill(1)),connectionEpoch:2,raw:{rawEegSamples:Array(16).fill(1),rawUnit:'µV'}});
  assert.equal(tracker.value(4400),null);
});
test('missing raw counters do not claim verified continuity; rate changes rebuild the window',()=>{
  const tracker=new RawAmplitude(),samples=Array.from({length:32},(_,i)=>i%2?20:-20);
  tracker.push(packet(1000,samples,{rawSequence:null}));
  assert.equal(tracker.value(1000).continuityVerified,false);
  tracker.push(packet(1100,Array(16).fill(1),{rawSequence:48,sampleRate:512}));
  assert.equal(tracker.value(1100),null);
  tracker.push(packet(1200,samples,{rawSequence:80,sampleRate:512}));
  assert.equal(tracker.value(1200).continuityVerified,true);
  tracker.push(packet(1300,Array(16).fill(1),{rawSequence:96,sampleRate:128}));
  assert.equal(tracker.value(1300),null);
});
test('loss or rate changes reported without raw data invalidate the previous window',()=>{
  const tracker=new RawAmplitude(),samples=Array.from({length:32},(_,i)=>i%2?20:-20);
  tracker.push(packet(1000,samples,{rawSequence:32,sampleRate:512}));
  assert.equal(tracker.value(1000).rms,20);
  tracker.push(packet(1100,[],{rawSequence:48,rawDropped:16,sampleRate:512}));
  assert.equal(tracker.value(1100),null);
  tracker.push(packet(1200,samples,{rawSequence:80,sampleRate:512}));
  assert.equal(tracker.value(1200).rms,20);
  tracker.push(packet(1300,[],{rawSequence:80,sampleRate:128}));
  assert.equal(tracker.value(1300),null);
  tracker.push(packet(1400,samples,{rawSequence:80,sampleRate:128}));
  assert.equal(tracker.value(1400),null);
  tracker.push(packet(1500,samples,{rawSequence:112,sampleRate:128}));
  assert.equal(tracker.value(1500).rms,20);
});
test('loss invalidates cached raw data and metadata-only packets do not change the amplitude clock',()=>{
  const tracker=new RawAmplitude(),samples=Array.from({length:32},(_,i)=>i%2?20:-20);
  tracker.push({...packet(1000,samples,{rawSequence:32}),originalTimestamp:500});
  tracker.push(packet(1100,[],{rawSequence:32}));
  assert.equal(tracker.value(1100).packetTimestamp,1000);
  assert.equal(tracker.value(1100).originalTimestamp,500);
  tracker.push(packet(1200,samples,{rawSequence:32,rawDropped:16}));
  assert.equal(tracker.value(1200),null);
});
test('RMS uses only the newest uninterrupted suffix after a protocol error',()=>{
 const tracker=new RawAmplitude();
 const values=[...Array.from({length:32},(_,i)=>i%2?10:-10),...Array(32).fill(500)];
 tracker.push(packet(1000,values,{rawSequence:64,rawBreaks:[32]}));
 const result=tracker.value(1000);
 assert.equal(result.samples,32);assert.equal(result.mean,500);assert.equal(result.rms,0);
 const captured=captureSnapshot({...packet(1000,values).raw,schemaVersion:'neural-resonance-live-v1',ts:1,source:'device',rawBreaks:[32]},
  {source:'device',sessionId:'one',timestamp:1000,originalTimestamp:1000,valid:false});
 assert.deepEqual(captured.rawBreaks,[32]);
 assert.deepEqual(replayPacket(captured,5000).rawBreaks,[32]);
});
test('a raw counter restart rebuilds the amplitude from the new samples',()=>{
  const tracker=new RawAmplitude(),wave=r=>Array.from({length:32},(_,i)=>i%2?r:-r);
  tracker.push(packet(1000,wave(10),{rawSequence:128}));
  tracker.push(packet(1100,wave(100),{rawSequence:32}));
  assert.equal(tracker.value(1100).rms,100);assert.equal(tracker.value(1100).samples,32);
});
test('raw-field time is independent of the enclosing packet time',()=>{
  const tracker=new RawAmplitude(),samples=Array.from({length:32},(_,i)=>i%2?20:-20);
  tracker.push(packet(10000,samples,{rawSequence:32,fieldTimestamps:{raw:1}}));
  assert.equal(tracker.value(10000),null);
  tracker.push(packet(10100,samples,{rawSequence:64,fieldTimestamps:{raw:10}}));
  const a=tracker.value(10100);
  assert.equal(a.at,10000);assert.equal(a.packetTimestamp,10100);
  assert.equal(a.timing,'source-field-time');
  assert.equal(tracker.value(13001),null);
});
test('impossible or unsafe raw sample counters do not claim continuity',()=>{
  const tracker=new RawAmplitude(),samples=Array(32).fill(1);
  tracker.push(packet(1000,samples,{rawSequence:10}));
  assert.equal(tracker.value(1000),null);
  tracker.push(packet(1100,samples,{rawSequence:Number.MAX_SAFE_INTEGER+1}));
  assert.equal(tracker.value(1100),null);
});
test('brightness is a declared monotonic encoding and changes no XY position',()=>{
  const low=lightEncoding(10,100),high=lightEncoding(200,100);
  assert.ok(high.intensity>low.intensity);assert.ok(high.radius>low.radius);
  assert.equal(lightEncoding(null,100).halo,0);
  const p={attention:60,relaxation:70},box=plotBox(900,650);
  assert.deepEqual(plotPosition({...p,amplitude:low},box),plotPosition({...p,amplitude:high},box));
});
test('amplitude readouts preserve small nonzero values and keep large values compact',()=>{
  assert.equal(formatAmplitude(0),'0.0');assert.equal(formatAmplitude(200),'200.0');
  assert.equal(formatAmplitude(.005),'5.00e-3');
  assert.equal(Number(formatAmplitude(.005)),.005);
  for(const value of [32768,99999.96,1e9,1e125,1e-125])assert.ok(formatAmplitude(value).length<=7);
  assert.equal(formatAmplitude(null),'—');assert.equal(formatAmplitude(-1),'—');
});
test('the square and axes have identical scale at phone, 1920x1080 and 4K sizes',()=>{
  for(const [w,h] of [[320,320],[390,450],[768,700],[1600,750],[3840,1800]]){
    const b=plotBox(w,h);
    const a=plotPosition({attention:0,relaxation:0},b),c=plotPosition({attention:100,relaxation:100},b);
    assert.equal(c.x-a.x,a.y-c.y);
    assert.ok(b.left>=0&&b.top>=0&&b.left+b.size<=w&&b.top+b.size<=h);
  }
});
test('neural trace visibility grows with recency and clamps invalid ages',()=>{
  const oldest=neuralTraceStyle(0),newest=neuralTraceStyle(1);
  assert.ok(newest.lineWidth>oldest.lineWidth);
  assert.ok(newest.lineAlpha>oldest.lineAlpha&&newest.lineAlpha<=1);
  assert.ok(newest.pointRadius>oldest.pointRadius);
  assert.deepEqual(neuralTraceStyle(-1),oldest);
  assert.deepEqual(neuralTraceStyle(Number.NaN),oldest);
  assert.deepEqual(neuralTraceStyle(2),newest);
});
test('neural exports identify the rendered two- or three-dimensional view',()=>{
  assert.equal(neuralExportName('plane',123),'neural-worm-2d-123.png');
  assert.equal(neuralExportName('time',123),'neural-worm-3d-123.png');
});
test('narrow PNG text wraps without dropping source, units or Unicode characters',()=>{
  const text='記錄回放 · 原始為合成示範\nRMS 200.0 ADC counts · 256 samples · µV not assumed';
  const measure=s=>Array.from(s).length*12;
  const lines=wrapText(text,180,measure);
  assert.ok(lines.length>2);
  assert.ok(lines.every(line=>measure(line)<=180));
  assert.equal(lines.join(''),text.replaceAll('\n',''));
  assert.deepEqual(wrapText('😄𝄞',12,measure),['😄','𝄞']);
  assert.throws(()=>wrapText('text',0,measure));
});
test('replay runs isolate identities while retaining original clocks, source and session',()=>{
  const original={schemaVersion:'neural-resonance-live-v1',ts:1,source:'demo',sessionId:'original',
    attention:60,meditation:70,quality:{eegPackets:1}};
  const a=replayPacket(original,10000,'run-a'),b=replayPacket(original,11000,'run-b');
  const stream=new StreamState();stream.accept(a,10000);
  assert.equal(stream.current(10000).sessionId,'run-a');
  stream.accept(b,11000);assert.equal(stream.current(11000).sessionId,'run-b');
  const saved=captureSnapshot(b,normalizeSnapshot(b,11000));
  assert.equal(saved.originalSessionId,'original');
  assert.equal(saved.originalTimestamp,1000);assert.equal(saved.originalSource,'demo');
  assert.equal(original.sessionId,'original');assert.equal(original.ts,1);
});
