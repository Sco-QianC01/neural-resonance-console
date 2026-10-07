import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot,demoSnapshot,parseRecording} from '../src/eeg.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {captureSnapshot,recordingCsv} from '../src/recording.mjs';
const now=1791378000000;
const native=(time=now,tick=10)=>({...demoSnapshot(50,50,tick,time),source:'device'});
test('manual prompt export contains ten reproducible controls and 0–127 coordinates',()=>{
  const current=normalizeSnapshot(native(),now);
  const result=createMusicPrompt([current],{current,now,target:'yue'});
  assert.equal(result.schemaVersion,'neural-music-prompt-v1');
  assert.equal(result.target,'yue');assert.equal(result.source,'device');
  assert.equal(Object.keys(result.controls127).length,10);
  assert.deepEqual(result.coordinates127,{attention:64,relaxation:64,center:64});
  assert.match(result.text,/BPM/);assert.match(result.text,/旋律/);
  assert.match(result.text,/實驗映射/);
  assert.deepEqual(result,createMusicPrompt([current],{current,now,target:'yue'}));
});
test('stale data, contact loss and spectral ratios cannot generate a music prompt',()=>{
  const current=normalizeSnapshot(native(),now);
  assert.equal(createMusicPrompt([current],{current,now:now+4000}),null);
  assert.equal(createMusicPrompt([current],{current:{...current,valid:false},now}),null);
  const ratios=normalizeSnapshot({...native(),eeg:{focus_index:.2,relaxation_index:.8}},now);
  assert.equal(createMusicPrompt([ratios],{current:ratios,now}),null);
});
test('averaging uses only the current source/session and records gaps without filling them',()=>{
  const current=normalizeSnapshot({...native(),sessionId:'s1'},now);
  const same={...current,timestamp:now-5000,attention:70};
  const other={...same,source:'demo',attention:100};
  const otherSession={...same,sessionId:'s2',attention:0};
  const result=createMusicPrompt([same,other,otherSession,current],{current,now});
  assert.equal(result.observedSamples,2);assert.equal(result.inputs.attention,60);
  assert.equal(result.longestGapSeconds,5);
  assert.match(result.text,/2 個有效樣本/);
  assert.throws(()=>createMusicPrompt([current],{current,now,target:'not-a-model'}));
});
test('demo and replay exports retain their non-live provenance',()=>{
  for(const source of ['demo','replay']){
    const current=normalizeSnapshot({...native(),source},now);
    const result=createMusicPrompt([current],{current,now});
    assert.equal(result.source,source);
    assert.match(result.text,source==='demo'?/示範資料/:/回放資料/);
  }
});
test('top-level device indices survive recording and replay even without nested EEG',()=>{
  const packet={schemaVersion:'neural-resonance-live-v1',source:'device',
    ts:now/1000,attention:37,meditation:81,quality:{eegPackets:5},
    sessionId:'s1',rawEegSamples:[10,-10],rawUnit:'μV'};
  const entry=captureSnapshot(packet,normalizeSnapshot(packet,now));
  const recording=parseRecording(JSON.stringify({
    schemaVersion:'neural-resonance-recording-v1',snapshots:[entry]}));
  const replay=normalizeSnapshot(recording.snapshots[0],now);
  assert.equal(replay.valid,true);assert.equal(replay.attention,37);
  assert.equal(replay.relaxation,81);assert.equal(replay.sessionId,'s1');
  assert.equal(entry.rawUnit,'μV');
  assert.match(recordingCsv([entry]),/37,81/);
});
test('recording never replaces missing native scores with derived or cached values',()=>{
  const packet={...native(),eeg:{focus_index:.02,relaxation_index:.08,delta_mean:.01}};
  const entry=captureSnapshot(packet,normalizeSnapshot(packet,now));
  assert.equal(normalizeSnapshot(entry,now).valid,false);
  assert.equal(entry.eeg.focus_index,.02);
  const [header,row]=recordingCsv([entry]).split('\r\n');
  const cells=Object.fromEntries(header.split(',').map((key,i)=>[key,row.split(',')[i]]));
  assert.equal(cells.attention,'');assert.equal(cells.meditation,'');
  assert.equal(cells.focus_ratio,'0.02');assert.equal(cells.relaxation_ratio,'0.08');
});
