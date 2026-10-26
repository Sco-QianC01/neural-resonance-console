import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, StreamState, LiveConnection, normalizeSnapshot, demoSnapshot, parseRecording, backfilledSnapshots } from '../src/eeg.mjs';
const now=1791266400000;
const packet=(overrides={})=>({...demoSnapshot(60,70,10,now),source:'core',...overrides});
test('native ThinkGear needs fresh known contact quality and integer eSense values',()=>{
  const base=packet({metricOrigin:'thinkgear-esense',eeg:{attention:60,meditation:70,poor_signal:0}});
  assert.equal(normalizeSnapshot(base,now).valid,true);
  for(const input of [
    {...base,eeg:{attention:60,meditation:70}},
    {...base,fieldTimestamps:{poor_signal:(now-4000)/1000}},
    {...base,eeg:{...base.eeg,poor_signal:201}},
    {...base,eeg:{...base.eeg,poor_signal:-1}},
    {...base,eeg:{...base.eeg,attention:60.5}},
  ])assert.equal(normalizeSnapshot(input,now).valid,false);
  const stale=normalizeSnapshot({...base,fieldTimestamps:{poor_signal:(now-4000)/1000}},now);
  assert.equal(stale.poorSignal,null);assert.equal(stale.signalQuality,'unknown');
});

test('core schema preserves native scores, bands, units and source',()=>{
  const result=normalizeSnapshot(packet(),now);
  assert.equal(result.attention,60); assert.equal(result.relaxation,70);
  assert.equal(result.valid,true); assert.equal(result.source,'core'); assert.ok(result.bands.alpha>0);
});
test('USB ratios are not treated as device 0–100 indices',()=>{
  const result=normalizeSnapshot(packet({eeg:{focus_index:.02,relaxation_index:.08,delta_mean:.012},
    attention:.02,meditation:.08}),now);
  assert.equal(result.attention,null); assert.equal(result.relaxation,null);
  assert.equal(result.valid,false); assert.equal(result.signalValid,true);
  assert.equal(result.ratios.focus,.02); assert.equal(result.bands.delta,.012);
  assert.equal(result.bandUnits,'來源頻段值 · 單位未回報');
});
test('null, NaN, negative and out-of-range scores cannot drive interaction',()=>{
  for(const value of [null,NaN,Infinity,-1,101,'60']){
    const result=normalizeSnapshot(packet({eeg:{attention:value,meditation:70}}),now);
    assert.equal(result.valid,false);
  }
});
test('stale, future, zero-packet and poor-contact data are invalid',()=>{
  for(const p of [packet({ts:(now-3100)/1000}),packet({ts:(now+5100)/1000}),
    packet({quality:{eegPackets:0}}),packet({eeg:{attention:60,meditation:70,poorSignal:10}})]){
    assert.equal(normalizeSnapshot(p,now).valid,false);
  }
});
test('an explicit disconnected transport cannot keep old indices, bands or interaction valid',()=>{
  const result=normalizeSnapshot(packet({transport:'none'}),now);
  assert.equal(result.attention,60,'native fields remain preserved');
  assert.equal(result.transportFresh,false);
  assert.equal(result.signalValid,false);
  assert.equal(result.valid,false);
});
test('UTF-8 BOM recordings import without changing values, units or timestamps',()=>{
  const input={schemaVersion:'neural-resonance-recording-v1',snapshots:[packet()]};
  assert.deepEqual(parseRecording('\ufeff'+JSON.stringify(input)),input);
});
test('fresh heartbeats with unchanged hardware counts time out',()=>{
  const state=new StreamState(); state.accept(packet(),now);
  state.accept(packet({ts:(now+2000)/1000}),now+2000);
  assert.equal(state.current(now+2000).valid,true);
  state.accept(packet({ts:(now+3100)/1000}),now+3100);
  assert.equal(state.current(now+3100).valid,false);
  state.accept(packet({ts:(now+3200)/1000,quality:{eegPackets:12}}),now+3200);
  assert.equal(state.current(now+3200).valid,true);
});
test('out-of-order and duplicate packets do not alter state',()=>{
  const state=new StreamState(); assert.equal(state.accept(packet(),now),true);
  assert.equal(state.accept(packet({ts:(now-1)/1000,attention:0}),now),false);
  assert.equal(state.accept(packet(),now),false);
  assert.equal(state.current(now).attention,60);
});
test('recording import preserves gaps and rejects unordered or incompatible files',()=>{
  const result=parseRecording(JSON.stringify({schemaVersion:'neural-resonance-recording-v1',
    snapshots:[packet(),packet({ts:(now+8000)/1000})]}));
  assert.equal(result.snapshots[1].ts-result.snapshots[0].ts,8);
  assert.throws(()=>parseRecording(JSON.stringify({schemaVersion:'neural-resonance-recording-v1',snapshots:[packet(),packet()]})));
  assert.throws(()=>normalizeSnapshot({ts:now/1000,schemaVersion:'unknown'},now));
  assert.throws(()=>parseRecording('{"snapshots":[]}'));
});
test('socket reconnect resumes and manual stop cancels both active and scheduled work',()=>{
  const sockets=[],scheduled=[],states=[],messages=[];
  const client=new LiveConnection({onState:s=>states.push(s),onSnapshot:p=>messages.push(p),
    socketFactory:()=>{const socket={close(){this.closed=true;}};sockets.push(socket);return socket;},
    schedule:(fn,delay)=>{const task={fn,delay};scheduled.push(task);return task;},
    cancel:task=>{if(task)task.cancelled=true;}});
  client.connect('ws://device.example/eeg');
  sockets[0].onopen(); sockets[0].onmessage({data:JSON.stringify(packet())});
  assert.equal(messages.length,1);
  sockets[0].onclose();
  const firstRetry=scheduled.find(task=>task.delay===1000&&!task.cancelled);
  assert.ok(firstRetry);
  firstRetry.fn(); assert.equal(sockets.length,2);
  sockets[1].onclose(); client.stop();
  const secondRetry=scheduled.filter(task=>task.delay===1000).at(-1);
  assert.equal(secondRetry.cancelled,true);
  secondRetry.fn(); assert.equal(sockets.length,2);
  assert.equal(sockets[1].closed,true); assert.equal(states.at(-1),'stopped');
  assert.throws(()=>client.connect('https://localhost'));
  assert.throws(()=>client.connect('ws://user:secret@localhost'));
});
test('malformed or oversized socket frames do not reach the data consumer',()=>{
  let socket,received=0; const states=[];
  const client=new LiveConnection({onState:s=>states.push(s),onSnapshot:()=>received++,
    socketFactory:()=>socket={close(){}}});
  client.connect('ws://localhost');
  socket.onmessage({data:'not json'});socket.onmessage({data:'x'.repeat(131073)});
  assert.equal(received,0);assert.equal(states.at(-1),'invalid');client.stop();
});

test('a page that opens late is filled from the collector buffer',()=>{
  const late=1791266460000;
  const payload={source:'device',sessionId:'s1',transport:'desktop_ble',connectionEpoch:1,seconds:60,
    points:[{ts:late/1000-40,attention:0,meditation:0,packets:3,bands:{}},
            {ts:late/1000-30,attention:62,meditation:71,packets:4,poorSignal:0,
             bands:{lowAlpha:100,highAlpha:200,lowBeta:50}},
            {ts:late/1000-600,attention:50,meditation:50,packets:1,bands:{}}]};
  const {identity,points}=backfilledSnapshots(payload,late);
  // Older than the window the page draws, so it is not data the chart could use.
  assert.equal(points.length,2);
  // ThinkGear reserves zero for "no eSense computed"; buffered data obeys it too.
  assert.equal(points[0].valid,false);
  assert.equal(points[1].valid,true);
  assert.equal(points[1].bands.alpha,300);
  assert.equal(points[1].spectralBands.lowBeta,50);
  assert.equal(points[1].indexTimestamp,(late/1000-30)*1000);
  assert.equal(points[1].packets,4);
  assert.equal(points[1].backfilled,true);
  assert.equal(identity,JSON.stringify(['device','s1','desktop_ble',1]));
  assert.deepEqual(backfilledSnapshots(undefined,late).points,[]);
  assert.deepEqual(backfilledSnapshots({points:[{ts:'x'}]},late).points,[]);
});
