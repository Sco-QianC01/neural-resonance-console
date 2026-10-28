import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
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
test('watch heart rate retains its source and never creates EEG or oxygen values',()=>{
  const state=new SensorState();
  state.accept(packet({source:'device',spo2:null,pr:72,sensorSources:{pr:'watch'},
    sensorTimestamps:{pr:now/1000}}),now);
  assert.equal(state.current(now).pr.source,'watch');
  assert.equal(state.current(now).pr.value,72);
  assert.equal(state.current(now).spo2.value,null);
  assert.equal(state.current(now+3001).pr.source,null);
});

const application=readFileSync(new URL('../neural-worm/app.mjs',import.meta.url),'utf8');
const sensorStart=application.indexOf('  const sensorValues=sensors.current();');
const sensorEnd=application.indexOf('  for(const [key,value]',sensorStart);
assert.ok(sensorStart>=0&&sensorEnd>sensorStart,'Find the actual shared sensor renderer');
const sensorRenderer=application.slice(sensorStart,sensorEnd);
const renderSensors=(nodes,source='watch')=>runInNewContext(sensorRenderer,{
  $:id=>nodes[id]??null,sensors:{current:()=>({
    spo2:{valid:false},pr:{valid:true,value:72,source},hrv:{valid:false},gsr:{valid:false},
  })},
});

test('a removed optional pulse label does not interrupt surviving sensor readouts',()=>{
  const pulse={textContent:'',parentElement:{hidden:true}};
  renderSensors({'sensor-pr':pulse});
  assert.equal(pulse.textContent,'72');
  assert.equal(pulse.parentElement.hidden,false);
});

test('the optional pulse label still follows its actual watch or pulse source',()=>{
  const label={textContent:''};
  renderSensors({'sensor-pr-label':label},'watch');
  assert.equal(label.textContent,'手表心率');
  renderSensors({'sensor-pr-label':label},'core');
  assert.equal(label.textContent,'脈率');
});
