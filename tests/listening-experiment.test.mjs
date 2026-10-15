import test from 'node:test';import assert from 'node:assert/strict';
import {describe,pairedCorrelation,relationDirection,ListeningTrial,experimentCsv} from '../src/listening-experiment.mjs';
const rec={id:'r',workId:6,title:'肖邦',performer:'甲',year:1925,mediaId:1,reference:'https://example.org/research'};
const packet=t=>({schemaVersion:'neural-resonance-live-v1',ts:t,source:'device',transport:'usb',sessionId:'one',metricOrigin:'thinkgear-esense',attention:40+t,meditation:60-t,eeg:{poor_signal:0},quality:{eegPackets:t+1},fieldTimestamps:{attention:t,meditation:t},rawEegSamples:[-2,2],rawUnit:'ADC counts'});
test('descriptive formula handles missing values, constant inputs and negative correlations',()=>{
 assert.deepEqual(describe([null,NaN,1,3]),{n:2,mean:2,sd:Math.SQRT2,min:1,max:3});
 assert.equal(pairedCorrelation([1,2,3],[3,2,1]).r,-1);
 assert.equal(pairedCorrelation([1,2,3],[3,2,1]).direction,'negative');
 assert.equal(pairedCorrelation([1,1,1],[3,4,5]).r,null);
 assert.equal(relationDirection(null),'insufficient');
 assert.equal(pairedCorrelation([1,null,3],[2,4,6]).n,2);
});
test('only valid actual acquisition during a trial is captured, clocks deduplicate and gaps survive',()=>{
 const trial=new ListeningTrial(rec,10,10000);assert.equal(trial.accept(packet(11),{t:11,tempo:60,level:30},11000,11),true);
 assert.equal(trial.accept(packet(11),{t:11.5,tempo:61,level:31},11500,11.5),false);
 assert.equal(trial.accept({...packet(12),source:'demo'},{t:12,tempo:62,level:32},12000,12),false);
 assert.equal(trial.accept({...packet(13),transport:'none'},{t:13,tempo:62,level:32},13000,13),false);
 assert.equal(trial.accept({...packet(14),sessionId:'other'},{t:14,tempo:62,level:32},14000,14),false);
 assert.equal(trial.accept(packet(16),{t:16,tempo:65,level:null},16000,16),true);
 const result=trial.finish(17000);assert.equal(result.rows.length,2);assert.equal(result.packets.length,2);
 assert.equal(result.rows[1].segment,1);assert.equal(result.rows[0].mediaTime,11);assert.deepEqual(result.packets[0].rawEegSamples,[-2,2]);
 assert.equal(result.statistics.tempoAttention.n,2);assert.equal(result.statistics.levelRelaxation.n,1);
 assert.ok(experimentCsv([result]).startsWith('\ufeff'));assert.match(experimentCsv([result]),/肖邦/);
});
test('empty trials and replay cannot become real experimental results',()=>{
 const trial=new ListeningTrial(rec,0,10000);assert.equal(trial.accept({...packet(11),source:'replay'},null,11000,1),false);
 assert.throws(()=>trial.finish(12000),/有效/);
});
test('new raw packets survive repeated indices and bad contact; music queries corrected time',()=>{
 const trial=new ListeningTrial(rec,0,10000),seen=[];
 const lookup=t=>{seen.push(t);return {rawTempo:t*10,bar:t};};
 assert.equal(trial.accept(packet(11),lookup,11000,1),true);
 const repeated={...packet(12),fieldTimestamps:{attention:11,meditation:11},rawEegSamples:[-100,100]};
 assert.equal(trial.accept(repeated,lookup,12000,2),false);
 assert.equal(trial.accept({...packet(13),eeg:{poor_signal:100}},lookup,13000,3),false);
 assert.equal(trial.packets.length,3);assert.equal(trial.rows.length,1);
 assert.deepEqual(trial.packets[1].rawEegSamples,[-100,100]);
 const delayed={...packet(14),fieldTimestamps:{attention:13.5,meditation:13.5}};
 assert.equal(trial.accept(delayed,lookup,14000,4),true);
 assert.deepEqual(seen,[1,3.5]);assert.equal(trial.rows[1].tempo,35);
});
test('experiment exports amplitude provenance and cannot copy an invented dynamic tier',()=>{
 const trial=new ListeningTrial(rec,10,10000);
 trial.accept(packet(11),{tempo:60,level:19.5,levelSource:'vmus-2007-smoothed-amplitude',
  levelUnit:'source-relative-0-100',tier:{label:'PP',index:1,mapping:'equal-source-relative-bins-v0'}},11000,11);
 const result=trial.finish(12000),row=result.rows[0];
 assert.equal(row.level,19.5);assert.equal(row.levelSource,'vmus-2007-smoothed-amplitude');
 assert.equal(row.levelUnit,'source-relative-0-100');
 assert.equal(row.dynamicMark,null);assert.equal(row.dynamicTier,null);
 assert.equal(row.dynamicTierIndex,null);assert.equal(row.dynamicTierSource,null);
 const csv=experimentCsv([result]);
 assert.match(csv,/level_source,level_unit,dynamic_mark/);
 assert.match(csv,/vmus-2007-smoothed-amplitude,source-relative-0-100/);
 assert.doesNotMatch(csv,/PP|equal-source-relative-bins/);
});
