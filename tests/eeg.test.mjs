import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, StreamState, LiveConnection, normalizeSnapshot, demoSnapshot, parseRecording } from '../src/eeg.mjs';
const now=1791266400000;
const packet=(overrides={})=>({...demoSnapshot(60,70,10,now),source:'core',...overrides});

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
