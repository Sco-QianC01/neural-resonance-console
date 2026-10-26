import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRecording} from '../src/eeg.mjs';
import {BrowserEEGSessionWriter,parseEEGSessionJsonl,safeDeviceId,sessionFileName,sessionHeader} from '../src/eeg-session.mjs';

const packet={
  schemaVersion:'neural-resonance-live-v1',source:'device',ts:1792252800,
  transport:'browser_usb',sessionId:'session-1',connectionEpoch:1,sampleRate:512,
  metricOrigin:'thinkgear-esense',rawSequence:1,rawUnit:'ADC counts',
  rawEegSamples:[-37],eeg:{attention:60,meditation:70,poor_signal:0},
  quality:{eegPackets:1,protocolErrors:0},
};

test('EEG session file naming sanitizes identifiers and uses local session time',()=>{
  assert.equal(safeDeviceId('../SOA / FA758'),'SOA-FA758');
  // Type first: one folder mixes several devices, and eeg- sorts them together.
  assert.match(sessionFileName('SOA-FA758',new Date(2026,9,17,20,32,14)),/^eeg-SOA-FA758-20261017-203214$/);
  assert.equal(sessionHeader({deviceId:''}).deviceId,'unknown-device');
});

test('JSONL historical EEG session imports as a replayable recording',()=>{
  const text=[
    JSON.stringify(sessionHeader({deviceId:'SOA-FA758',transport:'usb'})),
    JSON.stringify({type:'sample',packet}),
  ].join('\n');
  const parsed=parseRecording(text);
  assert.equal(parsed.deviceId,'SOA-FA758');
  assert.deepEqual(parsed.snapshots[0].rawEegSamples,[-37]);
  assert.equal(parsed.snapshots[0].eeg.attention,60);
});

test('legacy compact JSONL files still import',()=>{
  const compact={...sessionHeader({deviceId:'SOA-FA758'}),packetKeys:Object.keys(packet)};
  const text=[JSON.stringify(compact),JSON.stringify({type:'sample',values:Object.values(packet)})].join('\n');
  const parsed=parseEEGSessionJsonl(text);
  assert.deepEqual(parsed.snapshots[0],packet);
});

test('browser session writer creates a JSONL file and appends each sample',async()=>{
  const files=new Map();
  const directory={async getFileHandle(name,{create=false}={}){
    if(files.has(name))return files.get(name);
    if(!create){const error=new Error('missing');error.name='NotFoundError';throw error;}
    const handle={content:'',async getFile(){return {size:handle.content.length};},async createWritable(){
      return {async write(value){handle.content+=value;},async seek(){},async close(){}};
    }};
    files.set(name,handle);return handle;
  }};
  const writer=new BrowserEEGSessionWriter(directory);
  await writer.start('SOA-FA758',packet);
  await writer.append(packet);
  const file=files.get(writer.fileName);
  await writer.close();
  const lines=file.content.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(lines[0].schemaVersion,'neural-resonance-eeg-session-v1');
  assert.equal(lines[0].compactVersion,2);
  assert.equal(lines[1].type,'delta');
  const parsed=parseEEGSessionJsonl(file.content);
  assert.deepEqual(parsed.snapshots[0],packet);
});

test('compact EEG JSONL omits repeated metadata while preserving each raw sample',async()=>{
  const files=new Map();
  const directory={async getFileHandle(name,{create=false}={}){
    if(files.has(name))return files.get(name);
    if(!create){const error=new Error('missing');error.name='NotFoundError';throw error;}
    const handle={content:'',async getFile(){return {size:handle.content.length};},async createWritable(){
      return {async write(value){handle.content+=value;},async seek(){},async close(){}};
    }};
    files.set(name,handle);return handle;
  }};
  const writer=new BrowserEEGSessionWriter(directory);
  const first={...packet,fieldTimestamps:{attention:1,meditation:1,raw:1},
    eeg:{attention:60,meditation:70,poor_signal:0},quality:{eegPackets:1,protocolErrors:0}};
  await writer.start('SOA-FA758',first);
  const source=[];
  for(let i=0;i<200;i++){
    const sample={...first,ts:first.ts+i/512,rawSequence:i+1,rawEegSamples:[i-100],
      fieldTimestamps:{...first.fieldTimestamps,raw:first.ts+i/512},
      quality:{...first.quality,eegPackets:i+1}};
    source.push(sample);await writer.append(sample);
  }
  const file=files.get(writer.fileName);await writer.close();
  const parsed=parseEEGSessionJsonl(file.content);
  assert.deepEqual(parsed.snapshots,source);
  const legacyBytes=source.reduce((sum,sample)=>sum+Buffer.byteLength(JSON.stringify({type:'sample',packet:sample})+'\n'),0);
  assert.ok(Buffer.byteLength(file.content)<legacyBytes/2);
});
