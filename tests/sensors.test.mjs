import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SensorState } from '../src/sensors.mjs';
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
