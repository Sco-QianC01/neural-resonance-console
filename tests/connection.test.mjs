import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveConnection,StreamState,demoSnapshot,normalizeSnapshot} from '../src/eeg.mjs';
import * as recording from '../src/recording.mjs';

test('a superseded socket cannot deliver messages after a reconnect',()=>{
  const sockets=[],scheduled=[],received=[];
  const connection=new LiveConnection({
    onState(){},onSnapshot:p=>received.push(p),
    socketFactory:()=>{const socket={close(){}};sockets.push(socket);return socket;},
    schedule:(fn,delay)=>{const task={fn,delay};scheduled.push(task);return task;},
    cancel(){}
  });
  connection.connect('ws://localhost/ws/live');
  const oldMessage=sockets[0].onmessage;
  sockets[0].onclose();
  scheduled.find(item=>item.delay===1000).fn();
  oldMessage({data:JSON.stringify({old:true})});
  assert.equal(received.length,0);
  connection.stop();
});

test('an open but silent WebSocket is closed and reconnected',()=>{
  let now=0;const sockets=[],scheduled=[];
  const connection=new LiveConnection({
    onState(){},onSnapshot(){},clock:()=>now,idleMs:4000,
    socketFactory:()=>{const socket={close(){this.closed=true;this.onclose?.();}};sockets.push(socket);return socket;},
    schedule:(fn,delay)=>{const task={fn,delay};scheduled.push(task);return task;},
    cancel:task=>{if(task)task.cancelled=true;}
  });
  connection.connect('ws://localhost/ws/live');sockets[0].onopen();
  now=5000;
  const watchdog=scheduled.find(item=>item.delay===4000);
  assert.ok(watchdog,'the open connection has an idle watchdog');
  watchdog.fn();
  assert.equal(sockets[0].closed,true);
  assert.ok(scheduled.some(item=>item.delay===1000&&!item.cancelled));
  connection.stop();
});

test('a source epoch change resets hardware sequence freshness',()=>{
  const now=Date.now(),state=new StreamState();
  const p={...demoSnapshot(60,70,100,now),source:'core',transport:'usb',connectionEpoch:1};
  state.accept(p,now);
  state.accept({...p,ts:(now+3500)/1000,connectionEpoch:2,transport:'ble'},now+3500);
  assert.equal(state.current(now+3500).valid,true);
});

test('native field timestamps expire even while raw packets continue',()=>{
  const now=Date.now();
  const packet={...demoSnapshot(70,60,20,now),source:'core',
    metricOrigin:'thinkgear-esense',
    fieldTimestamps:{attention:(now-4000)/1000,meditation:now/1000}};
  const result=normalizeSnapshot(packet,now);
  assert.equal(result.attention,null);
  assert.equal(result.valid,false);
});

test('replay rebases field clocks without making a stale field fresh',()=>{
  const packet={...demoSnapshot(70,60,20,100000),source:'core',
    fieldTimestamps:{attention:99.5,meditation:96},connectionEpoch:3};
  assert.equal(typeof recording.replayPacket,'function');
  const now=Date.now(),replayed=recording.replayPacket(packet,now);
  assert.equal(replayed.originalTimestamp,100000);
  assert.equal(replayed.originalFieldTimestamps.meditation,96);
  assert.equal(Math.round(now-replayed.fieldTimestamps.meditation*1000),4000);
  const normalized=normalizeSnapshot(replayed,now);
  assert.equal(normalized.attention,70);
  assert.equal(normalized.relaxation,null);
});
