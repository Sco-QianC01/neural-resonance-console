import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SensorState } from '../src/sensors.mjs';
import { RuntimeMonitor, safeCoreStatus } from '../tools/runtime.mjs';
const now=1791266400000;
const packet=(overrides={})=>({ts:now/1000,source:'core',spo2:97,pr:73,hrv:null,gsr:null,
  quality:{spo2Samples:1,prSamples:1,eegPackets:0},...overrides});
test('SpO2 and pulse work independently of missing EEG and preserve null HRV',()=>{
  const state=new SensorState();state.accept(packet(),now);
  assert.equal(state.current(now).spo2.value,97);
  assert.equal(state.current(now).pr.value,73);
  assert.equal(state.current(now).hrv.value,null);
});
test('non-EEG invalid values, transport gaps and frozen hardware counts clear readings',()=>{
  const state=new SensorState();state.accept(packet(),now);
  assert.equal(state.current(now+3001).spo2.value,null);
  state.accept(packet({ts:(now+15001)/1000}),now+15001);
  assert.equal(state.current(now+15001).spo2.value,null);
  state.accept(packet({ts:(now+15002)/1000,quality:{spo2Samples:2,prSamples:2}}),now+15002);
  assert.equal(state.current(now+15002).spo2.value,97);
  state.accept(packet({ts:(now+15003)/1000,spo2:101,pr:0}),now+15003);
  assert.equal(state.current(now+15003).spo2.value,null);
  assert.equal(state.current(now+15003).pr.value,null);
  state.reset();assert.equal(state.current(now).spo2.value,null);
});
test('device status is allowlisted and omits device identities and paths',()=>{
  const safe=safeCoreStatus({source:'core',streams:{},ports:{},deviceIdentity:'private',
    workers:[{name:'app-api',alive:true}],features:{gsr:false}});
  assert.equal(safe.workers[0].alive,true);assert.ok(!('deviceIdentity' in safe));
  assert.equal(safe.features.gsr,false);
  assert.throws(()=>safeCoreStatus({ok:true}));
});
test('program polling coalesces concurrent requests and reports core failures honestly',async()=>{
  let reads=0,finish;
  const monitor=new RuntimeMonitor({coreOrigin:'http://127.0.0.1:8002'},{
    programs:()=>{reads++;return new Promise(resolve=>{finish=resolve;});},
    fetcher:async()=>{throw new Error('offline');},
  });
  const first=monitor.snapshot(),second=monitor.snapshot();
  assert.equal(reads,1);finish({checkedAt:new Date().toISOString(),programs:[]});
  const [a,b]=await Promise.all([first,second]);
  assert.equal(a.core.reachable,false);assert.equal(b.core.reachable,false);
  await monitor.snapshot();assert.equal(reads,1);
});
