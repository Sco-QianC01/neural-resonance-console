import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThinkGearDecoder} from '../src/device-input.mjs';
const frame=payload=>Uint8Array.from([170,170,payload.length,...payload,(~payload.reduce((a,b)=>a+b,0))&255]);
test('ThinkGear fragmented input preserves raw signed values and native indices',()=>{
  const d=new ThinkGearDecoder(),packet=frame([2,0,4,60,5,70,128,2,255,219]);
  assert.equal(d.push(packet.slice(0,5),1000).length,0);
  const p=d.push(packet.slice(5),1000)[0];
  assert.equal(p.eeg.attention,60);assert.equal(p.eeg.meditation,70);
  assert.deepEqual(p.rawEegSamples,[-37]);assert.equal(p.rawUnit,'ADC counts');
});
test('corrupt packets and old device scores do not become valid fresh readings',()=>{
  const d=new ThinkGearDecoder(),broken=frame([4,60]);broken[broken.length-1]=0;
  assert.equal(d.push(broken,1000).length,0);
  d.push(frame([4,60,5,70]),1000);
  const p=d.push(frame([128,2,0,1]),5000)[0];
  assert.equal(p.eeg.attention,undefined);assert.equal(p.eeg.meditation,undefined);
  assert.deepEqual(p.rawEegSamples,[1]);
});
