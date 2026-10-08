import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot,StreamState,LiveConnection,demoSnapshot} from '../src/eeg.mjs';
import {ThinkGearDecoder,BrowserDeviceInput} from '../src/device-input.mjs';
import {captureSnapshot,replayPacket,recordingCsv} from '../src/recording.mjs';
import {SensorState} from '../src/sensors.mjs';
import {buildWormTrace} from '../src/worm-model.mjs';
const frame=payload=>Uint8Array.from([170,170,payload.length,...payload,
  (~payload.reduce((a,b)=>a+b,0))&255]);

test('recording and replay preserve independent sensor values, provenance and immutable input',()=>{
  const packet={...demoSnapshot(60,70,1,10000),source:'device',spo2:98,pr:72,hrv:35,gsr:4,
    quality:{eegPackets:2,spo2Samples:1,prSamples:1,gsrSamples:1,hrvSamples:1}};
  const entry=captureSnapshot(packet,normalizeSnapshot(packet,10000));
  packet.eeg.attention=99;packet.quality.prSamples=99;
  assert.equal(entry.eeg.attention,60);assert.equal(entry.quality.prSamples,1);
  const replayed=replayPacket(entry,20000),sensor=new SensorState();
  sensor.accept(replayed,20000);
  assert.equal(sensor.current(20000).spo2.value,98);assert.equal(sensor.current(20000).pr.value,72);
  assert.equal(sensor.current(20000).hrv.value,35);assert.equal(sensor.current(20000).gsr.value,4);
  assert.equal(replayed.originalSource,'device');
  assert.match(recordingCsv([entry]),/spo2,pr,hrv,gsr/);
});
test('field clocks expire both power bands and indices while a transport remains fresh',()=>{
  const packet={...demoSnapshot(60,70,1,10000),source:'device',
    fieldTimestamps:{attention:7.1,meditation:10,delta:6,theta:10,alpha:10,beta:10}};
  const stream=new StreamState();stream.accept(packet,10000);
  assert.equal(stream.current(10000).bands.delta,null);
  assert.equal(stream.current(10000).attention,60);
  assert.equal(stream.current(10200).attention,null);
  assert.equal(stream.current(10200).valid,false);
});
test('browser chunk retains all raw frames and the final valid native fields',()=>{
  const received=[],input=new BrowserDeviceInput({onPacket:p=>received.push(p),onStatus(){}});
  input.feed(Uint8Array.from([...frame([128,2,0,1]),...frame([128,2,255,254]),
    ...frame([2,0,4,60,5,70])]));
  assert.equal(received.length,1);
  assert.deepEqual(received[0].rawEegSamples,[1,-2]);
  assert.equal(received[0].eeg.attention,60);
  assert.equal(received[0].quality.eegPackets,3);
  assert.equal(typeof received[0].fieldTimestamps.attention,'number');
});
test('browser decoder keeps original native field age instead of refreshing it on raw frames',()=>{
  const decoder=new ThinkGearDecoder();
  decoder.push(frame([4,60,5,70]),1000);
  const later=decoder.push(frame([128,2,0,1]),3900)[0];
  const entry=captureSnapshot(later,normalizeSnapshot(later,3900));
  assert.equal(entry.fieldTimestamps.attention,1);
  assert.equal(normalizeSnapshot(replayPacket(entry,10000),10200).valid,false);
});
test('an uncompleted WebSocket handshake times out and schedules recovery',()=>{
  const tasks=[],sockets=[];
  const connection=new LiveConnection({onState(){},onSnapshot(){},idleMs:1000,
    socketFactory:()=>{const socket={close(){this.closed=true;}};sockets.push(socket);return socket;},
    schedule:(fn,delay)=>{const task={fn,delay};tasks.push(task);return task;},
    cancel:task=>{if(task)task.cancelled=true;}});
  connection.connect('ws://localhost/ws/live');
  const deadline=tasks.find(task=>task.delay===1000&&!task.cancelled);
  assert.ok(deadline);deadline.fn();
  assert.equal(sockets[0].closed,true);
  assert.ok(tasks.filter(task=>task.delay===1000&&!task.cancelled).length>=1);
  connection.stop();
});
test('stopping while USB permission is open prevents a delayed selection from opening a device',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let finish,opened=0;
  const input=new BrowserDeviceInput({onPacket(){},onStatus(){}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serial:{
    requestPort:()=>new Promise(resolve=>{finish=()=>resolve({open(){opened++;throw new Error('Unexpected open');},close(){}});})}}});
  try{
    const pending=input.serial(115200);await input.stop();finish();
    await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Selection was not cancelled')),200))]);
    assert.equal(opened,0);await input.stop();
  }finally{await input.stop();if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('two sessions in one history never share a line even when the final identity returns',()=>{
  const p=(t,sessionId,packets)=>({valid:true,timestamp:t,source:'device',sessionId,
    attention:50,relaxation:50,packets});
  const trace=buildWormTrace([p(1000,'a',1),p(2000,'b',1),p(3000,'a',1),p(4000,'a',2)],{now:4000});
  assert.equal(trace.points.length,3);
  assert.equal(trace.points[1].segment,1);
  assert.equal(trace.stats.coverageSeconds,1);
});
test('new sensor sessions reset count freshness without joining earlier session clocks',()=>{
  const state=new SensorState();
  state.accept({ts:1,source:'device',sessionId:'first',spo2:98,quality:{spo2Samples:1}},1000);
  state.accept({ts:20,source:'device',sessionId:'second',spo2:97,quality:{spo2Samples:1}},20000);
  assert.equal(state.current(20000).spo2.value,97);
});
test('a far-future packet cannot poison the ordering of later live observations',()=>{
  const stream=new StreamState(),sensor=new SensorState();
  const bad={...demoSnapshot(99,99,99,1000000),spo2:99,quality:{eegPackets:100,spo2Samples:100}};
  assert.equal(stream.accept(bad,10000),false);assert.equal(sensor.accept(bad,10000),false);
  const good={...demoSnapshot(60,70,1,10000),spo2:98,quality:{eegPackets:2,spo2Samples:1}};
  assert.equal(stream.accept(good,10000),true);assert.equal(sensor.accept(good,10000),true);
  assert.equal(stream.current(10000).valid,true);assert.equal(sensor.current(10000).spo2.value,98);
});
test('recording preserves original sensor field age so replay cannot refresh an old SpO2 measurement',()=>{
  const packet={...demoSnapshot(60,70,1,20000),source:'device',spo2:98,
    sensorTimestamps:{spo2:4},quality:{eegPackets:2,spo2Samples:2}};
  const entry=captureSnapshot(packet,normalizeSnapshot(packet,20000));
  const replayed=replayPacket(entry,100000),state=new SensorState();
  state.accept(replayed,100000);
  assert.equal(state.current(100000).spo2.value,null);
  assert.equal(replayed.originalSensorTimestamps.spo2,4);
  assert.equal(replayed.sensorTimestamps.spo2,84);
});
test('distinct browser notifications use actual high-resolution clocks and are not rejected as duplicate milliseconds',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');
  const accepted=[],stream=new StreamState();let tick=0;
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{timeOrigin:1000,now:()=>++tick/10}});
  try{
    const input=new BrowserDeviceInput({onStatus(){},onPacket:packet=>{
      if(stream.accept(packet,packet.ts*1000))accepted.push(packet);
    }});
    input.feed(frame([2,0,4,60,5,70]));
    input.feed(frame([128,2,0,1]));
    assert.equal(accepted.length,2);
    assert.ok(accepted[1].ts>accepted[0].ts);
  }finally{if(descriptor)Object.defineProperty(globalThis,'performance',descriptor);else delete globalThis.performance;}
});
