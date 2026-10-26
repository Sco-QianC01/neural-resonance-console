import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreMusicPoint,linearFit,structurePoints,linearityProxy,changeProxy} from '../src/music-structure.mjs';
import {normalizeSnapshot} from '../src/eeg.mjs';
import {drawWaveforms,drawComparison,COMPARISON_PANELS} from '../src/waveform-view.mjs';
test('band and index plots use source field clocks and do not multiply heartbeat copies',()=>{
 const marks=[],ctx={setTransform(){},clearRect(){},beginPath(){},stroke(){},fillText(){},setLineDash(){},
  measureText(t){return {width:String(t).length*5};},
  moveTo(x,y){if(['#d6a5eb','#e39b86'].includes(this.strokeStyle)&&y>20)marks.push([x,y]);},
  lineTo(x,y){if(['#d6a5eb','#e39b86'].includes(this.strokeStyle)&&y>20)marks.push([x,y]);}};
 const canvas={clientWidth:1000,clientHeight:200,getContext:()=>ctx,dataset:{}};
 const one={timestamp:9500,indexTimestamp:9000,indexSampleKey:'one',valid:true,transportFresh:true,
  attention:60,relaxation:70,source:'device',sessionId:'one',connectionEpoch:1,transport:'usb',
  bands:{alpha:10},raw:{fieldTimestamps:{alpha:9}}};
 const duplicate={...one,timestamp:9800};
 drawWaveforms(canvas,[one,duplicate],'alpha',10000);
 assert.equal(marks.length,1);
 assert.ok(Math.abs(marks[0][0]-(48+932*(1-1000/60000)))<1e-9);
 marks.length=0;
 drawComparison(canvas,[one,duplicate],COMPARISON_PANELS[0],10000);
 assert.equal(marks.length,1);
 assert.ok(Math.abs(marks[0][0]-(42+916*(1-1000/60000)))<1e-9);
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
