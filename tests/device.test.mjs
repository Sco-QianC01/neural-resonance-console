import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThinkGearDecoder} from '../src/device-input.mjs';
import {normalizeSnapshot} from '../src/eeg.mjs';
import {captureSnapshot} from '../src/recording.mjs';
const now=1791378000000;
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
test('ThinkGear zero eSense means unavailable and remains invalid after recording',()=>{
  const decoder=new ThinkGearDecoder();
  const payload=[2,0,4,0,5,80];
  const bytes=new Uint8Array([0xaa,0xaa,payload.length,...payload,(~payload.reduce((a,b)=>a+b,0))&255]);
  const packet=decoder.push(bytes,now)[0];
  assert.equal(packet.eeg.attention,0);
  assert.equal(normalizeSnapshot(packet,now).signalValid,true);
  assert.equal(normalizeSnapshot(packet,now).valid,false);
  assert.equal(normalizeSnapshot(captureSnapshot(packet,normalizeSnapshot(packet,now)),now).valid,false);
});
test('a checksum-valid but malformed row cannot poison cached native indices',()=>{
  const decoder=new ThinkGearDecoder();
  const bytes=payload=>new Uint8Array([0xaa,0xaa,payload.length,...payload,(~payload.reduce((a,b)=>a+b,0))&255]);
  decoder.push(bytes([2,0,4,40,5,60]),now);
  assert.equal(decoder.push(bytes([4,99,0x83,24,1]),now+1).length,0);
  const packet=decoder.push(bytes([0x80,2,0x80,0]),now+2)[0];
  assert.equal(packet.eeg.attention,40);assert.equal(packet.rawEegSamples[0],-32768);
});
test('extended-code rows are skipped instead of becoming base-level eSense',()=>{
  const decoder=new ThinkGearDecoder();
  const payload=[2,0,4,40,5,60,0x55,4,99];
  const bytes=new Uint8Array([0xaa,0xaa,payload.length,...payload,(~payload.reduce((a,b)=>a+b,0))&255]);
  assert.equal(decoder.push(bytes,now)[0].eeg.attention,40);
});
