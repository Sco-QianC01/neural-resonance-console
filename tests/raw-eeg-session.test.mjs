import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BrowserRawEEGSessionWriter} from '../src/raw-eeg-session.mjs';
import {decodeTgamBytes} from '../src/raw-tgam.mjs';
import {decodeTgamContainer,encodeTgamHeader,TGAM_HEADER_BYTES} from '../src/tgam-container.mjs';

function memoryDirectory(){
  const files=new Map();
  return {files,async getFileHandle(name,{create=false}={}){
    if(files.has(name))return files.get(name);
    if(!create){const error=new Error('missing');error.name='NotFoundError';throw error;}
    const handle={content:new Uint8Array(),async getFile(){return {size:handle.content.length};},
      async createWritable({keepExistingData=false}={}){
        let position=keepExistingData?handle.content.length:0;
        return {async write(value){
          if(typeof value==='string')value=new TextEncoder().encode(value);
          const next=keepExistingData?handle.content.slice():new Uint8Array();
          const output=new Uint8Array(Math.max(next.length,position+value.length));
          output.set(next);output.set(value,position);position+=value.length;handle.content=output;
        },async seek(value){position=value;},async close(){}};
      }};
    files.set(name,handle);return handle;
  }};
}

function frame(payload){
  const checksum=(~payload.reduce((sum,value)=>sum+value,0))&255;
  return Uint8Array.from([0xaa,0xaa,payload.length,...payload,checksum]);
}

test('browser raw writer embeds metadata and preserves the exact byte stream',async()=>{
  const directory=memoryDirectory(),writer=new BrowserRawEEGSessionWriter(directory);
  await writer.start('../SOA/FA758',{transport:'browser_usb',sampleRate:512,
    baudRate:57600,sessionId:'browser-9',connectionEpoch:9,
    startedAt:new Date(2026,9,17,21,30,0)});
  const filename=writer.fileName;
  const data=Uint8Array.from([0xaa,0xaa,0x04,0x80,0x02,0xff,0xfd,0xd2]);
  await writer.append(data);await writer.commit();
  const committed=decodeTgamContainer(directory.files.get(filename).content);
  assert.equal(committed.isContainer,true);
  assert.equal(committed.metadata.byteCount,data.length);
  assert.deepEqual(committed.rawBytes,data);
  const continuation=Uint8Array.from([0xaa,0xaa,0x04,0x80,0x02,0,1,0x7c]);
  await writer.append(continuation);
  await writer.close();
  assert.equal(filename,'eeg-SOA-FA758-20261017-213000.tgam');
  assert.equal(directory.files.has(filename.replace(/\.tgam$/,'.meta.json')),false);
  const {metadata,rawBytes}=decodeTgamContainer(directory.files.get(filename).content);
  assert.deepEqual([...rawBytes],[...data,...continuation]);
  assert.equal(metadata.deviceId,'SOA-FA758');
  assert.equal(metadata.byteCount,data.length+continuation.length);
  assert.equal(metadata.sampleRate,512);
  assert.equal(metadata.baudRate,57600);
  assert.equal(metadata.transport,'browser_usb');
  assert.equal(metadata.sessionId,'browser-9');
  assert.equal(metadata.connectionEpoch,9);
  assert.ok(metadata.endedAt);
});

test('ThinkGear raw stream maps to replay packets only when imported',()=>{
  const raw=Uint8Array.from([...frame([0x80,0x02,0xff,0xfd]),...frame([0x02,0,0x04,60,0x05,70])]);
  const recording=decodeTgamBytes(raw,{deviceId:'SOA-FA758',startedAt:Date.UTC(2026,9,17),
    transport:'browser_ble'});
  assert.equal(recording.deviceId,'SOA-FA758');
  assert.equal(recording.snapshots.length,2);
  assert.deepEqual(recording.snapshots[0].rawEegSamples,[-3]);
  assert.equal(recording.snapshots[1].eeg.attention,60);
  assert.equal(recording.snapshots[1].eeg.meditation,70);
  assert.equal(recording.snapshots[0].transport,'browser_ble');
  assert.ok(recording.snapshots[1].ts>recording.snapshots[0].ts);
});

test('self-describing TGAM file restores its metadata and leaves payload bytes unchanged',()=>{
  const raw=Uint8Array.from([...frame([0x80,0x02,0xff,0xfd]),...frame([0x02,0,0x04,60,0x05,70])]);
  const startedAt=Date.UTC(2026,9,17);
  const header=encodeTgamHeader({schema:'neural-resonance-tgam-v1',
    container:'neural-resonance-tgam-container-v1',deviceId:'SOA-FA758',transport:'browser_ble',
    sampleRate:512,baudRate:null,sessionId:'capture-42',startedAt:new Date(startedAt).toISOString(),
    byteCount:raw.length});
  const file=new Uint8Array(TGAM_HEADER_BYTES+raw.length);
  file.set(header);file.set(raw,TGAM_HEADER_BYTES);
  const recording=decodeTgamBytes(file);
  assert.equal(recording.deviceId,'SOA-FA758');
  assert.equal(recording.snapshots[0].transport,'browser_ble');
  assert.equal(recording.snapshots[0].sampleRate,512);
  assert.equal(recording.snapshots[0].sessionId,'capture-42');
  assert.deepEqual(recording.snapshots[0].rawEegSamples,[-3]);
});

test('a frame that repeats a reading keeps the reading time, not the frame time',()=>{
  const withBands=frame([0x02,0,0x04,60,0x05,70,0x83,24,...new Array(24).fill(7)]);
  // Push the next frame past the decoder's 4096-byte chunk so the two frames are
  // decoded at different instants: only then can a stamping bug show up.
  const filler=Array.from({length:600},()=>frame([0x80,0x02,0xff,0xfd]));
  const tail=frame([0x80,0x02,0xff,0xfd]);
  const recording=decodeTgamBytes(Uint8Array.from([...withBands,...filler.flat(),...tail]),
    {startedAt:Date.UTC(2026,9,17)});
  const first=recording.snapshots[0],last=recording.snapshots.at(-1);
  // Later frame, same measurement: the instant of the reading must not move.
  assert.equal(last.fieldTimestamps.delta,first.fieldTimestamps.delta);
  assert.equal(last.fieldTimestamps.attention,first.fieldTimestamps.attention);
  // The frame itself did arrive.
  assert.ok(last.ts>first.ts);
});
