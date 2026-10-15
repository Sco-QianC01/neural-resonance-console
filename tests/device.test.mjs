import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThinkGearDecoder,BrowserDeviceInput} from '../src/device-input.mjs';
import {normalizeSnapshot} from '../src/eeg.mjs';
import {captureSnapshot} from '../src/recording.mjs';
const now=1791378000000;
const frame=payload=>Uint8Array.from([170,170,payload.length,...payload,(~payload.reduce((a,b)=>a+b,0))&255]);
test('manual stop closes a GATT connection that finishes after cancellation',async()=>{
  let finishConnect,disconnected=0;
  const device={removeEventListener(){},gatt:{connected:false,connect(){
    return new Promise(resolve=>{finishConnect=()=>{this.connected=true;resolve({});};});
  },disconnect(){this.connected=false;disconnected++;}}};
  const input=new BrowserDeviceInput({onPacket(){},onStatus(){}});
  input.device=device;input.bleOptions={service:'service',characteristic:'char'};
  const connecting=input.openBluetooth(input.generation);
  await input.stop();
  finishConnect();await connecting;
  assert.equal(device.gatt.connected,false);
  assert.equal(disconnected,1);
});
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
test('all signed 16-bit raw codes decode unchanged across fragmented input',()=>{
  const decoder=new ThinkGearDecoder();
  for(let start=0;start<65536;start+=256){
    const bytes=Uint8Array.from(Array.from({length:256},(_,i)=>Array.from(frame([128,2,(start+i)>>8,(start+i)&255]))).flat());
    const packets=[...decoder.push(bytes.slice(0,13),now),...decoder.push(bytes.slice(13),now)];
    assert.equal(packets.length,256);
    packets.forEach((p,i)=>assert.deepEqual(p.rawEegSamples,[start+i>32767?start+i-65536:start+i]));
  }
});
test('a rejected checksum leaves an explicit break inside a browser read batch',()=>{
  const input=new BrowserDeviceInput({onPacket:p=>packets.push(p),onStatus(){}});
  const packets=[],bad=frame([128,2,0,99]);bad[bad.length-1]^=1;
  input.feed(Uint8Array.from([...frame([128,2,0,1]),...bad,...frame([128,2,255,254])]));
  assert.equal(packets.length,1);
  assert.deepEqual(packets[0].rawEegSamples,[1,-2]);
  assert.deepEqual(packets[0].rawBreaks,[1]);
  assert.equal(packets[0].rawSequence,2);
  assert.equal(packets[0].quality.protocolErrors,1);
});
test('known RAW and power row lengths reject the complete payload atomically',()=>{
  const decoder=new ThinkGearDecoder();
  decoder.push(frame([2,0,4,40,5,60]),now);
  for(const row of [[128,1,1],[131,23,...Array(23).fill(0)]]){
    assert.equal(decoder.push(frame([4,99,...row]),now+1).length,0);
  }
  assert.equal(decoder.push(frame([128,2,0,2]),now+2)[0].eeg.attention,40);
});
