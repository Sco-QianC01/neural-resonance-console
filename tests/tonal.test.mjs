import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chord,triad,transform,voiceLeading,fifth,chordName,scale,pitchPosition,frequency,PITCH_NAMES} from '../src/tonal-model.mjs';

test('C major transforms to Cm, Em and Am with unchanged pitch identities',()=>{
  const c=chord(0,'major');
  assert.deepEqual(triad(c),[0,4,7]);
  assert.deepEqual(transform(c,'P'),chord(0,'minor'));
  assert.deepEqual(transform(c,'L'),chord(4,'minor'));
  assert.deepEqual(transform(c,'R'),chord(9,'minor'));
  assert.equal(chordName(c),'C major');
  assert.equal(chordName(transform(c,'R'),true),'Am');
});
test('all 72 PLR changes keep two notes, move one voice and are involutions',()=>{
  for(let root=0;root<12;root++)for(const quality of ['major','minor'])for(const operation of ['P','L','R']){
    const input=chord(root,quality),saved=structuredClone(input);
    const output=transform(input,operation),transition=voiceLeading(input,output);
    assert.deepEqual(transform(output,operation),input);
    assert.deepEqual(input,saved);
    assert.equal(transition.common.length,2);
    assert.equal(transition.from.length,1);assert.equal(transition.to.length,1);
    const d=Math.abs(transition.from[0]-transition.to[0]);
    assert.equal(Math.min(d,12-d),operation==='R'?2:1);
  }
});
test('the circle of fifths traverses every class and cycles without a boundary',()=>{
  let current=chord(0,'minor'),seen=[];
  for(let i=0;i<12;i++){seen.push(current.root);current=fifth(current,1);}
  assert.equal(new Set(seen).size,12);assert.deepEqual(current,chord(0,'minor'));
  assert.deepEqual(fifth(fifth(chord(11,'major'),1),-1),chord(11,'major'));
  assert.equal(fifth(chord(0,'major'),-1).root,5);
});
test('spherical pitch anchors are twelve unique unit positions independent of musical state',()=>{
  const points=PITCH_NAMES.map((_,i)=>pitchPosition(i));
  assert.equal(new Set(points.map(p=>p.join(','))).size,12);
  for(const p of points)assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12);
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(points.reduce((sum,p)=>sum+p[axis],0))<1e-12);
  const p=pitchPosition(0);p[0]=99;assert.notEqual(pitchPosition(0)[0],99);
});
test('scales and equal-tempered audition use declared musical parameters',()=>{
  assert.deepEqual(scale(chord(0,'major')),[0,2,4,5,7,9,11]);
  assert.deepEqual(scale(chord(0,'minor')),[0,2,3,5,7,8,10]);
  assert.ok(Math.abs(frequency(9,4)-440)<1e-10);
  assert.ok(Math.abs(frequency(0,4)-261.6255653)<1e-6);
});
test('invalid theory inputs fail rather than generating arbitrary nodes or notes',()=>{
  for(const root of [NaN,Infinity,1.5,'C',null])assert.throws(()=>chord(root,'major'));
  assert.throws(()=>chord(0,'dorian'));assert.throws(()=>transform(chord(0,'major'),'X'));
  assert.throws(()=>fifth(chord(0,'major'),0));assert.throws(()=>pitchPosition(12));
  assert.throws(()=>frequency(0,NaN));
});
