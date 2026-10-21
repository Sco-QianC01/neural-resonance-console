import test from 'node:test';
import assert from 'node:assert/strict';
import {StreamState,normalizeSnapshot} from '../src/eeg.mjs';
import {SensorState} from '../src/sensors.mjs';
import {PacketClock} from '../src/stream-clock.mjs';
import {captureSnapshot,replayPacket,recordingCsv,} from '../src/recording.mjs';
import {buildWormTrace} from '../src/worm-model.mjs';
import {ThinkGearDecoder} from '../src/device-input.mjs';

const packet=(seq,mono,wall=100,overrides={})=>({
  schemaVersion:'neural-resonance-live-v1',source:'device',sessionId:'clock-test',
  transport:'usb',connectionEpoch:1,ts:wall,packetSequence:seq,
  clock:{schema:'neural-stream-clock-v1',monotonicMs:mono},
  metricOrigin:'thinkgear-esense',eeg:{attention:60,meditation:70,poor_signal:0},
  fieldTimestamps:{attention:wall,meditation:wall,poor_signal:wall},
  fieldAgesMs:{attention:0,meditation:0,poor_signal:0},
  indexPair:{attention:60,meditation:70,at:wall,ageMs:0,sequence:seq},
  pr:72,sensorTimestamps:{pr:wall},sensorAgesMs:{pr:0},sensorSources:{pr:'watch'},
  quality:{eegPackets:seq,prSamples:seq},...overrides,
});

test('gateway clock orders new packets through a wall-clock rollback and retains original times',()=>{
  const state=new StreamState();
  assert.equal(state.accept(packet(1,1000,100),100000),true);
  assert.equal(state.accept(packet(2,2000,90),101000),true);
  const current=state.current(101000);
  assert.equal(current.valid,true);
  assert.equal(current.timestamp,101000);
  assert.equal(current.originalTimestamp,90000);
  assert.equal(current.raw.originalFieldTimestamps.attention,90);
  assert.equal(current.raw.fieldTimestamps.attention,101);
});
test('stale monotonic field ages cannot be revived by fresh heartbeats or wall-clock changes',()=>{
  const state=new StreamState(),sensor=new SensorState();
  const p=packet(1,1000,900000,{fieldAgesMs:{attention:4000,meditation:0,poor_signal:0},
    indexPair:null,sensorAgesMs:{pr:16000}});
  assert.equal(state.accept(p,100000),true);
  assert.equal(sensor.accept(p,100000),true);
  assert.equal(state.current(100000).valid,false);
  assert.equal(sensor.current(100000).pr.valid,false);
});
test('duplicate, decreasing and corrupt clock metadata cannot poison the next valid packet',()=>{
  const clock=new PacketClock();
  assert.ok(clock.map(packet(2,2000),100000));
  assert.equal(clock.map(packet(2,2000),100000),null);
  assert.equal(clock.map(packet(3,1900),100001),null);
  assert.throws(()=>clock.map(packet(3,2001,100,{clock:{schema:'neural-stream-clock-v1',monotonicMs:Infinity}}),100001));
  assert.throws(()=>clock.map(packet(99,2001,100,{schemaVersion:'invalid'}),100001));
  assert.throws(()=>clock.map(packet(99,2001,NaN),100001));
  assert.ok(clock.map(packet(3,2001),100001));
});
test('time checks never revive a value already expired in the same stream',()=>{
  const state=new StreamState(),sensor=new SensorState(),p=packet(1,1000);
  state.accept(p,100000);sensor.accept(p,100000);
  assert.equal(state.current(116000).valid,false);
  assert.equal(state.current(101000).valid,false);
  assert.equal(sensor.current(116000).pr.valid,false);
  assert.equal(sensor.current(101000).pr.valid,false);
});
test('a held pair creates one point and independent index updates do not move its coordinates',()=>{
  const state=new StreamState(),history=[];
  state.accept(packet(1,1000),100000);history.push(state.current(100000));
  state.accept(packet(2,1500,90,{eeg:{attention:90,meditation:70,poor_signal:0},
    indexPair:{attention:60,meditation:70,at:100,ageMs:500,sequence:1}}),100500);
  const current=state.current(100500);history.push(current);
  assert.equal(current.attention,60);
  assert.equal(current.latestIndices.attention,90);
  assert.equal(current.pairMethod,'same-report');
  assert.equal(buildWormTrace(history,{now:100500,space:'eeg'}).points.length,1);
  state.accept(packet(3,5000,90,{indexPair:null}),104000);
  assert.equal(state.current(104000).valid,false);
});
test('recording, CSV and replay retain clock and pair provenance without refreshing old measurements',()=>{
  const state=new StreamState(),original=packet(1,1000,90,{sensorAgesMs:{pr:16000}});
  state.accept(original,100000);
  const entry=captureSnapshot(original,state.current(100000));
  assert.equal(entry.ts,100);
  assert.equal(entry.originalTimestamp,90000);
  assert.equal(entry.packetSequence,1);
  assert.equal(entry.clock.monotonicMs,1000);
  assert.equal(entry.originalIndexPair.at,90);
  assert.equal(entry.indexPair.at,100);
  const replayed=replayPacket(entry,200000,'replay-clock'),normalized=normalizeSnapshot(replayed,200000);
  assert.equal(normalized.valid,true);
  assert.equal(normalized.originalTimestamp,90000);
  assert.equal(normalized.pairMethod,'same-report');
  const recaptured=captureSnapshot(replayed,normalized);
  assert.equal(recaptured.originalClock.monotonicMs,1000);
  assert.equal(recaptured.originalPacketSequence,1);
  const sensor=new SensorState();sensor.accept(replayed,200000);
  assert.equal(sensor.current(200000).pr.valid,false);
  assert.match(recordingCsv([entry]).split('\r\n')[0],/packet_sequence/);
  assert.equal(original.ts,90);
});
test('legacy asynchronous recordings retain their fields and disclose the pairing method',()=>{
  const raw={schemaVersion:'neural-resonance-live-v1',source:'replay',ts:102,transport:'usb',
    metricOrigin:'thinkgear-esense',eeg:{attention:60,meditation:70,poor_signal:0},
    fieldTimestamps:{attention:100,meditation:102,poor_signal:102},quality:{eegPackets:1}};
  const value=normalizeSnapshot(raw,102000);
  assert.equal(value.valid,true);
  assert.equal(value.pairMethod,'legacy-latest-fields');
  assert.equal(value.pairDeltaMs,2000);
  assert.equal(raw.fieldTimestamps.attention,100);
});
test('browser ThinkGear input only creates a pair from a complete protocol report',()=>{
  const frame=p=>Uint8Array.from([170,170,p.length,...p,(~p.reduce((a,b)=>a+b,0))&255]);
  const decoder=new ThinkGearDecoder();
  const first=decoder.push(frame([2,0,4,60]),100000)[0];
  const second=decoder.push(frame([5,70]),100500)[0];
  assert.equal(first.indexPair,null);
  assert.equal(second.indexPair,null);
  assert.equal(normalizeSnapshot(second,100500).valid,false);
  const paired=decoder.push(frame([4,61,5,71]),101000)[0];
  assert.equal(paired.indexPair.attention,61);
  assert.equal(normalizeSnapshot(paired,101000).valid,true);
});
test('clocked spectral aggregates use actual component ages, without requiring an invented aggregate timestamp',()=>{
  const state=new StreamState();
  state.accept(packet(1,1000,100,{eeg:{lowAlpha:10,highAlpha:20,lowBeta:30,highBeta:40},
    fieldAgesMs:{lowAlpha:0,highAlpha:0,lowBeta:0,highBeta:0}}),100000);
  assert.deepEqual(state.current(100000).bands,{delta:null,theta:null,alpha:30,beta:70});
  assert.equal(state.current(103001).bands.alpha,null);
});
