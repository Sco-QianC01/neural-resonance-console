import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC_PLANS,musicPlan,parsePlanRules,resolvePlan} from '../src/music-plan.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {replayPacket,captureSnapshot,recordingCsv} from '../src/recording.mjs';
import {normalizeSnapshot} from '../src/eeg.mjs';

test('four teaching plans contain ten sourced musical intentions without measured or inferred emotion claims',()=>{
  assert.equal(MUSIC_PLANS.length,4);
  for(const plan of MUSIC_PLANS){
    const result=musicPlan(plan.id,1000);
    assert.equal(Object.keys(result.values).length,10);
    assert.ok(Object.values(result.values).every(v=>v.text&&v.tags.length>=2));
    assert.ok(result.source.page>=17&&result.source.page<=20);
    assert.equal(result.kind,'creative-intent');
    assert.equal(result.measuredMusic,false);assert.equal(result.inferredEmotion,false);
  }
});
test('EEG coordinates cannot change the manually selected music plan',()=>{
  const a=resolvePlan({valid:true,timestamp:1,attention:5,relaxation:10},{manualId:'gentle'});
  const b=resolvePlan({valid:true,timestamp:2,attention:95,relaxation:90},{manualId:'gentle'});
  assert.equal(a.id,b.id);assert.deepEqual(a.values,b.values);assert.equal(a.origin,'manual');
});
test('explicit imported regions have unambiguous boundaries and no inferred default regions',()=>{
  const rules=parsePlanRules(JSON.stringify({schemaVersion:'neural-music-plan-rules-v1',
    id:'author-config-v1',author:'Test author',zones:[
      {attention:[0,50],relaxation:[0,100],planId:'gentle'},
      {attention:[50,100],relaxation:[0,100],planId:'bright'}]}));
  const p=(attention)=>({valid:true,timestamp:1,attention,relaxation:100});
  assert.equal(resolvePlan(p(49),{rules}).id,'gentle');
  assert.equal(resolvePlan(p(50),{rules}).id,'bright');
  assert.equal(resolvePlan(p(100),{rules}).origin,'imported-control-rule');
  assert.equal(resolvePlan({...p(100),valid:false},{rules}),null);
  const sparse={...rules,zones:[rules.zones[0]]};
  assert.equal(resolvePlan(p(60),{rules:sparse}),null);
  assert.throws(()=>parsePlanRules(JSON.stringify({...rules,zones:[rules.zones[0],rules.zones[0]]})));
});
test('summary keeps creative intentions separate from source-gated music measurements',()=>{
  const snapshot={valid:true,timestamp:1000,attention:60,relaxation:40,
    source:'device',sessionId:'test',packets:1};
  const plan=resolvePlan(snapshot,{manualId:'gentle'});
  const summary=createMusicPrompt([snapshot],{current:snapshot,now:1000,musicPlan:plan});
  assert.equal(summary.musicPlan.kind,'creative-intent');
  assert.ok(Object.values(summary.parameters).every(value=>value===null));
  assert.equal(summary.claimsInferredFromEeg,false);
  assert.match(summary.text,/創作方案/);
});
test('replay rebases recorded creative intentions independently from observed music',()=>{
  const intent=musicPlan('gentle',1000);
  const packet=replayPacket({ts:1,creativeIntent:intent},5000);
  assert.equal(packet.creativeIntent.timestamp,5000);
  assert.equal(packet.creativeIntent.originalTimestamp,1000);
  assert.equal(packet.creativeIntent.measuredMusic,false);
  assert.equal(packet.musicFeatures,null);
  assert.equal(intent.timestamp,1000);
});
test('recorded plan remains tied to its sample through replay, capture and summary despite a different current selector',()=>{
  const original={schemaVersion:'neural-resonance-live-v1',source:'device',ts:1,
    attention:55,meditation:45,quality:{eegPackets:1},creativeIntent:musicPlan('bright',1000)};
  const packet=replayPacket(original,5000);
  const snapshot=normalizeSnapshot(packet,5000);
  const plan=resolvePlan(snapshot,{manualId:'gentle'});
  assert.equal(plan.id,'bright');assert.equal(plan.origin,'recording');
  assert.equal(plan.originalOrigin,'manual');assert.equal(plan.originalTimestamp,1000);
  const saved=captureSnapshot(packet,snapshot);
  assert.deepEqual(saved.creativeIntent,packet.creativeIntent);
  assert.match(recordingCsv([saved]),/creative_intent_json/);
  assert.match(recordingCsv([saved]),/bright/);
  const summary=createMusicPrompt([snapshot],{current:snapshot,now:5000,musicPlan:plan});
  assert.equal(summary.musicPlan.id,'bright');assert.match(summary.text,/記錄方案/);
});
test('out-of-time or altered recorded musical content does not silently change to a current manual plan',()=>{
  const intent=musicPlan('bright',1000);
  const snapshot={valid:true,source:'replay',timestamp:2000,raw:{creativeIntent:intent}};
  assert.equal(resolvePlan(snapshot,{manualId:'gentle'}),null);
  intent.timestamp=2000;intent.values.tempo.text='not in the source material';
  assert.equal(resolvePlan(snapshot,{manualId:'gentle'}),null);
});
