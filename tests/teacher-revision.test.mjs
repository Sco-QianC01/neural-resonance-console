import test from 'node:test';
import assert from 'node:assert/strict';
import {RawWaveform,waveformEnvelope} from '../src/raw-waveform.mjs';
import {scoreMusicPoint,linearFit,structurePoints,linearityProxy,changeProxy} from '../src/music-structure.mjs';
import {normalizeSnapshot} from '../src/eeg.mjs';
import {drawWaveforms,drawIndices} from '../src/waveform-view.mjs';
const snapshot=(seq,values,at=1000)=>({source:'device',sessionId:'a',transport:'usb',connectionEpoch:1,
 timestamp:at,transportFresh:true,packets:seq,raw:{rawSequence:seq,rawEegSamples:values,sampleRate:128,rawUnit:'ADC counts'}});
test('raw overlap, duplicate and gaps preserve each source value exactly once',()=>{
 const raw=new RawWaveform();raw.push(snapshot(4,[1,-2,3,-4]));raw.push(snapshot(4,[1,-2,3,-4],1100));
 raw.push(snapshot(6,[3,-4,5,-6],1200));assert.deepEqual(raw.rows.map(p=>p.value),[1,-2,3,-4,5,-6]);
 raw.push(snapshot(9,[8,-9],1300));assert.equal(raw.dropped,1);assert.equal(raw.rows.at(-1).segment,1);
 const saved=structuredClone(raw.rows);raw.push(snapshot(8,[77],1400));assert.deepEqual(raw.rows,saved);
});
test('pixel envelope retains signed single-sample spikes; small units stay visible',()=>{
 const rows=[0,.002,-.013,.001].map((value,i)=>({value,sequence:i+1,segment:0}));
 const reduced=waveformEnvelope(rows,1,4,1);assert.equal(reduced[0].min,-.013);assert.equal(reduced[0].max,.002);
 const raw=new RawWaveform();raw.push(snapshot(4,rows.map(r=>r.value)));assert.equal(raw.extent,.015625);
 assert.ok(raw.window().stats.rms>0);assert.equal(raw.window().stats.peakToPeak,.015);
});
test('expired raw field times and invalid sequence do not refresh stored samples',()=>{
 const raw=new RawWaveform();raw.push(snapshot(4,[1,-1,2,-2]));
 raw.push({...snapshot(6,[100,-100],5000),raw:{rawSequence:6,rawEegSamples:[100,-100],fieldTimestamps:{raw:1}}});
 raw.push({...snapshot(6,[100,-100],5000),raw:{rawSequence:'6',rawEegSamples:[100,-100]}});
 assert.equal(raw.rows.length,4);assert.equal(raw.at,1000);
});
test('protocol breaks preserve every valid raw value without inventing a lost sample count',()=>{
 const raw=new RawWaveform();
 raw.push({...snapshot(4,[1,-2,3,-4]),raw:{rawSequence:4,rawEegSamples:[1,-2,3,-4],sampleRate:128,rawUnit:'ADC counts',rawBreaks:[2]}});
 assert.deepEqual(raw.rows.map(p=>p.value),[1,-2,3,-4]);
 assert.deepEqual(raw.rows.map(p=>p.segment),[0,0,1,1]);
 assert.equal(raw.dropped,0);
 const stats=raw.window().stats;
 assert.equal(stats.samples,2,'waveform statistics use only the last continuous segment');
 assert.equal(stats.rms,3.5);assert.equal(stats.peakToPeak,7);
 const saved=structuredClone(raw.rows);
 raw.push({...snapshot(6,[5,6],1100),raw:{rawSequence:6,rawEegSamples:[5,6],sampleRate:128,rawUnit:'ADC counts',rawBreaks:[3]}});
 assert.deepEqual(raw.rows,saved,'invalid break offsets cannot alter stored samples');
});
test('raw time-axis sample spacing matches the declared rate without a one-sample stretch',()=>{
 const raw=new RawWaveform();
 raw.push({...snapshot(256,Array(256).fill(1)),raw:{rawSequence:256,rawEegSamples:Array(256).fill(1),sampleRate:128,rawUnit:'ADC counts'}});
 const window=raw.window(2);
 assert.equal(window.end-window.start,256);
 assert.equal((window.rows.at(-1).sequence-window.rows[0].sequence)/(window.end-window.start)*window.seconds,255/128);
 raw.push({...snapshot(258,[100,-100],1100),raw:{rawSequence:258,rawEegSamples:[100,-100],sampleRate:128,rawUnit:'ADC counts',fieldTimestamps:{raw:.9}}});
 assert.equal(raw.rows.length,256,'older raw field clocks do not advance the waveform');
});
test('band and index plots use source field clocks and do not multiply heartbeat copies',()=>{
 const marks=[],ctx={setTransform(){},clearRect(){},beginPath(){},stroke(){},fillText(){},setLineDash(){},
  moveTo(x,y){if(['#d6a5eb','#e39b86'].includes(this.strokeStyle))marks.push([x,y]);},
  lineTo(x,y){if(['#d6a5eb','#e39b86'].includes(this.strokeStyle))marks.push([x,y]);}};
 const canvas={clientWidth:1000,clientHeight:200,getContext:()=>ctx,dataset:{}};
 const one={timestamp:9500,indexTimestamp:9000,indexSampleKey:'one',valid:true,transportFresh:true,
  attention:60,relaxation:70,source:'device',sessionId:'one',connectionEpoch:1,transport:'usb',
  bands:{alpha:10},raw:{fieldTimestamps:{alpha:9}}};
 const duplicate={...one,timestamp:9800};
 drawWaveforms(canvas,[one,duplicate],'alpha',10000);
 assert.equal(marks.length,1);
 assert.ok(Math.abs(marks[0][0]-(48+932*(1-1000/60000)))<1e-9);
 marks.length=0;
 drawIndices(canvas,[one,duplicate],10000);
 assert.equal(marks.length,1);
 assert.ok(Math.abs(marks[0][0]-(42+943*(1-1000/60000)))<1e-9);
 assert.equal(one.timestamp,9500);
});
test('eight native powers are independent, absent data not made zero',()=>{
 const p={schemaVersion:'neural-resonance-live-v1',source:'device',ts:10,quality:{eegPackets:1},eeg:{lowAlpha:1,highAlpha:2,lowBeta:3,highBeta:4,lowGamma:5,midGamma:6}};
 const s=normalizeSnapshot(p,10000);assert.equal(s.bands.alpha,3);assert.equal(s.spectralBands.lowAlpha,1);
 assert.equal(s.spectralBands.lowGamma,5);assert.equal(s.spectralBands.delta,null);
});
test('source amplitude stays continuous and never becomes an inferred score dynamic',()=>{
 const rows=[{t:0,end:1,tempo:60,ioi:1000,weight:1,segment:0,bar:1,barPosition:1,beatInBar:0,beatsPerBar:4}];
 const rec={annotation:{amp:{dt:1,v:[19,20]}}};
 const point=scoreMusicPoint(rec,rows,[],.5,false);
 assert.equal(point.level,19.5);
 assert.equal(point.levelSource,'vmus-2007-smoothed-amplitude');
 assert.equal(point.levelUnit,'source-relative-0-100');
 assert.equal(point.dynamicMark,null);
 assert.equal(Object.hasOwn(point,'tier'),false);
 for(const level of [0,100]){
  const p=scoreMusicPoint({annotation:{amp:{dt:1,v:[level,level]}}},rows,[],.5,false);
  assert.equal(p.level,level);assert.equal(p.dynamicMark,null);
 }
 const missing=scoreMusicPoint({annotation:{}},rows,[],.5,false);
 assert.equal(missing.level,null);assert.equal(missing.levelSource,null);assert.equal(missing.levelUnit,null);
});
test('linear and abrupt beat changes have different reproducible descriptors',()=>{
 const rows=[60,70,80,90].map((tempo,i)=>({bar:i+1,tempo,t:i,end:i+1,weight:1,segment:0,ioi:1000}));
 const fit=linearFit(rows);assert.equal(fit.r2,1);assert.equal(fit.slope,10);
 assert.equal(linearFit(rows.map(p=>({...p,tempo:60}))).r2,null);
 const rec={annotation:{amp:{dt:1,v:[10,20,30,40,50]}}};
 const points=structurePoints(rec,rows);assert.equal(points[0].jump,null);assert.equal(points[1].fit,null);
 const jumpRows=[60,60,120].map((tempo,i)=>({...rows[i],tempo}));
 assert.equal(structurePoints(rec,jumpRows).at(-1).jump,1);
 assert.ok(linearFit(jumpRows).r2<1);
});
test('linearity and change descriptors remain exploratory proxies',()=>{
 const fit=linearFit([0,1,2].map((bar,i)=>({bar,tempo:60+i*5})));
 assert.equal(linearityProxy(fit),1);
 assert.equal(changeProxy({tempo:60},{tempo:120}),1);
});
