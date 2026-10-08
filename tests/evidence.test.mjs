import test from 'node:test';
import assert from 'node:assert/strict';
import {mapMusic} from '../src/music.mjs';
import {networkStates,networkGeometry} from '../src/neural-networks.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {normalizeSnapshot,parseRecording} from '../src/eeg.mjs';
import {captureSnapshot,replayPacket,recordingCsv} from '../src/recording.mjs';

const sample={valid:true,timestamp:1000,attention:65,relaxation:45,
  source:'device',sessionId:'test',transport:'usb',connectionEpoch:1,packets:1};
const source={id:'annotated-take-01',type:'audio-analysis',
  uri:'https://example.org/annotated-take-01',method:'Beat timestamps reviewed by the annotator.'};
const observed=()=>({...sample,musicFeatures:{
  schemaVersion:'music-observations-v1',timestamp:1000,values:{
    tempo:{value:80,unit:'BPM',source},
    dynamics:{value:-18,unit:'dBFS',source:{...source,method:'RMS amplitude converted to dBFS.'}},
  }}});

test('EEG indices alone never produce ten invented music measurements or mesh nodes',()=>{
  const mapping=mapMusic(sample);
  assert.ok(Object.values(mapping.parameters).every(value=>value===null));
  assert.ok(networkStates(sample).every(state=>state.status==='unavailable'));
  assert.deepEqual(networkGeometry(networkStates(sample)[0]),{nodes:[],edges:[]});
});
test('a reported music value requires source, method, declared units and the matching time',()=>{
  const input=observed(),mapping=mapMusic(input);
  assert.equal(mapping.parameters.tempo,80);
  assert.equal(mapping.parameters.dynamics,-18);
  assert.equal(mapping.parameters.melody,null);
  assert.equal(mapping.evidence.tempo.source.id,source.id);
  for(const mutate of [
    p=>{delete p.musicFeatures.values.tempo.source;},
    p=>{p.musicFeatures.timestamp=999;},
    p=>{p.musicFeatures.values.tempo.source.method='';},
    p=>{p.musicFeatures.values.tempo.unit='Hz';},
    p=>{p.musicFeatures.values.tempo.source.type='eeg-guess';},
    p=>{p.musicFeatures.values.tempo.source.uri='javascript:alert(1)';},
  ]){
    const p=observed();p.musicFeatures=structuredClone(p.musicFeatures);mutate(p);
    assert.equal(mapMusic(p).parameters.tempo,null);
  }
});
test('brain-only prompt exports observations and missing evidence, never a prescribed BPM or mood',()=>{
  const result=createMusicPrompt([sample],{current:sample,now:1000});
  assert.ok(Object.values(result.parameters).every(value=>value===null));
  assert.ok(result.organizations.every(value=>value.status==='unavailable'));
  assert.equal(result.claimsInferredFromEeg,false);
  assert.match(result.text,/未觀測/);
  assert.doesNotMatch(result.text,/音樂組織：|80 BPM|較多轉折|較亮色彩|放鬆.*適合/);
});

test('recording and replay preserve music provenance, band metadata and synchronized clocks',()=>{
  const originalTime=1791450123456, replayTime=1791450223001;
  const packet={schemaVersion:'neural-resonance-live-v1',source:'device',
    ts:originalTime/1000,attention:65,meditation:45,quality:{eegPackets:1},
    fieldTimestamps:{attention:originalTime/1000,meditation:originalTime/1000},
    bandUnits:'source-reported power',bandRanges:{delta:[.5,4]},
    musicFeatures:{schemaVersion:'music-observations-v1',timestamp:(originalTime/1000)*1000,
      values:{tempo:{value:80,unit:'BPM',source:structuredClone(source)}}}};
  const entry=captureSnapshot(packet,normalizeSnapshot(packet,originalTime));
  packet.musicFeatures.values.tempo.value=120;
  packet.bandRanges.delta[0]=1;
  const parsed=parseRecording(JSON.stringify({
    schemaVersion:'neural-resonance-recording-v1',snapshots:[entry]}));
  const replay=replayPacket(parsed.snapshots[0],replayTime);
  const normalized=normalizeSnapshot(replay,replayTime);
  const music=mapMusic(normalized);
  assert.equal(music.parameters.tempo,80);
  assert.deepEqual(music.evidence.tempo.source,source);
  assert.equal(music.evidence.tempo.timestamp,normalized.timestamp);
  assert.equal(replay.musicFeatures.originalTimestamp,entry.musicFeatures.timestamp);
  assert.equal(replay.originalTimestamp,originalTime);
  assert.equal(normalized.bandUnits,'source-reported power');
  assert.deepEqual(replay.bandRanges,{delta:[.5,4]});
  assert.match(recordingCsv([entry]),/music_observations_json/);
  assert.match(recordingCsv([entry]),/annotated-take-01/);
  const unsynchronized=replayPacket({...entry,musicFeatures:{
    ...entry.musicFeatures,timestamp:entry.musicFeatures.timestamp-100}},replayTime);
  assert.equal(mapMusic(normalizeSnapshot(unsynchronized,replayTime)).parameters.tempo,null);
});

test('summary excludes frozen packet counts rather than averaging heartbeat values',()=>{
  const history=[{...sample,timestamp:1000,attention:20,packets:1},
    {...sample,timestamp:1250,attention:99,packets:1},
    {...sample,timestamp:1500,attention:60,packets:2}];
  const result=createMusicPrompt(history,{current:history.at(-1),now:1500});
  assert.equal(result.observedSamples,2);
  assert.equal(result.inputs.attention,40);
  assert.equal(result.schemaVersion,'neural-observation-summary-v2');
});

test('summary coverage does not join across a known invalid contact sample',()=>{
  const history=[{...sample,timestamp:1000,packets:1},
    {...sample,timestamp:1250,valid:false,packets:2},
    {...sample,timestamp:1500,packets:3}];
  const result=createMusicPrompt(history,{current:history.at(-1),now:1500});
  assert.equal(result.observedSamples,2);
  assert.equal(result.traceStatistics.segments,2);
  assert.equal(result.observedCoverageSeconds,0);
});
