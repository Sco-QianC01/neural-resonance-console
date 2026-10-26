export const EEG_SESSION_SCHEMA='neural-resonance-eeg-session-v1';

export function safeDeviceId(value){
  return String(value??'').trim().replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^[-._]+|[-._]+$/g,'').slice(0,64)||'unknown-device';
}

export function sessionFileName(deviceId,date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  const stamp=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  // Type first: a folder mixes sessions from several devices, and eeg- sorts them
  // together whatever the label is.
  return `eeg-${safeDeviceId(deviceId)}-${stamp}`;
}

export function sessionHeader({deviceId,transport,sessionId,connectionEpoch,sampleRate,startedAt=new Date().toISOString()}){
  return {type:'eeg-session',schemaVersion:EEG_SESSION_SCHEMA,deviceId:safeDeviceId(deviceId),
    transport:transport??null,sessionId:sessionId??null,connectionEpoch:connectionEpoch??null,
    sampleRate:sampleRate??null,startedAt};
}

const variablePacketFields=new Set([
  'ts','eeg','quality','fieldTimestamps','sensorTimestamps','rawEegSamples','rawBreaks',
  'rawSequence','rawDropped','lastSampleAt','spo2','pr','hrv','gsr',
]);
function delta(previous={},current={}){
  const set={},drop=[];
  for(const [key,value] of Object.entries(current))
    if(!Object.hasOwn(previous,key)||JSON.stringify(previous[key])!==JSON.stringify(value))set[key]=value;
  for(const key of Object.keys(previous))if(!Object.hasOwn(current,key))drop.push(key);
  return [set,drop];
}
function applyDelta(previous,change){
  const next={...previous};
  for(const key of change[1])delete next[key];
  return Object.assign(next,change[0]);
}
function packetDefaults(packet){
  return Object.fromEntries(Object.entries(packet).filter(([key])=>!variablePacketFields.has(key)));
}

export class BrowserEEGSessionWriter{
  constructor(directory){this.directory=directory;this.handle=null;this.writer=null;this.queue=Promise.resolve();this.fileName='';this.previous=null;this.defaults=null;this.packetFields=[];this.lastCommit=Date.now();}
  async start(deviceId,packet){
    const base=sessionFileName(deviceId,new Date(packet.ts*1000));
    let name=`${base}.jsonl`,suffix=2;
    while(true){
      try{this.handle=await this.directory.getFileHandle(name);name=`${base}-${String(suffix++).padStart(2,'0')}.jsonl`;}
      catch(error){if(error.name!=='NotFoundError')throw error;break;}
    }
    this.handle=await this.directory.getFileHandle(name,{create:true});
    this.writer=await this.handle.createWritable();
    this.fileName=name;
    this.defaults=packetDefaults(packet);
    this.packetFields=Object.keys(packet).sort();
    this.previous={eeg:{...(packet.eeg??{})},quality:{...(packet.quality??{})},
      fieldTimestamps:{...(packet.fieldTimestamps??{})},sensorTimestamps:{...(packet.sensorTimestamps??{})},
      extras:Object.fromEntries(Object.entries(packet).filter(([key])=>!variablePacketFields.has(key)))};
    this.previous.extras=Object.fromEntries(Object.entries(packet).filter(([key])=>
      variablePacketFields.has(key)&&!['ts','eeg','quality','fieldTimestamps','sensorTimestamps','rawEegSamples','rawBreaks','rawSequence','rawDropped'].includes(key)));
    await this.writeLine({...sessionHeader({
      deviceId,transport:packet.transport,sessionId:packet.sessionId,
      connectionEpoch:packet.connectionEpoch,sampleRate:packet.sampleRate,
      startedAt:new Date(packet.ts*1000).toISOString(),
    }),compactVersion:2,packetDefaults:this.defaults,packetFields:this.packetFields,packetState:this.previous});
    this.lastCommit=Date.now();
  }
  append(packet){
    this.queue=this.queue.then(async()=>{
      if(!this.writer)throw new Error('EEG session file is not open');
      const defaults=packetDefaults(packet);
      if(JSON.stringify(defaults)!==JSON.stringify(this.defaults)
        ||JSON.stringify(Object.keys(packet).sort())!==JSON.stringify(this.packetFields)){
        await this.writeLine({type:'sample',packet});
        this.previous={
          eeg:{...(packet.eeg??{})},quality:{...(packet.quality??{})},
          fieldTimestamps:{...(packet.fieldTimestamps??{})},sensorTimestamps:{...(packet.sensorTimestamps??{})},
          extras:Object.fromEntries(Object.entries(packet).filter(([key])=>
            variablePacketFields.has(key)&&!['ts','eeg','quality','fieldTimestamps','sensorTimestamps','rawEegSamples','rawBreaks','rawSequence','rawDropped'].includes(key))),
        };
      }else{
        const eeg=delta(this.previous.eeg,packet.eeg??{});
        const fieldTimestamps=delta(this.previous.fieldTimestamps,packet.fieldTimestamps??{});
        const quality=delta(this.previous.quality,packet.quality??{});
        const sensorTimestamps=delta(this.previous.sensorTimestamps,packet.sensorTimestamps??{});
        const extras=delta(this.previous.extras,Object.fromEntries(
          Object.entries(packet).filter(([key])=>!variablePacketFields.has(key))));
        await this.writeLine({type:'delta',values:[
          packet.ts,packet.rawSequence??null,packet.rawEegSamples??[],packet.rawBreaks?.length?packet.rawBreaks:null,
          packet.rawDropped??0,eeg,fieldTimestamps,quality,sensorTimestamps,extras,
        ]});
        this.previous={eeg:applyDelta(this.previous.eeg,eeg),fieldTimestamps:applyDelta(this.previous.fieldTimestamps,fieldTimestamps),
          quality:applyDelta(this.previous.quality,quality),sensorTimestamps:applyDelta(this.previous.sensorTimestamps,sensorTimestamps),
          extras:applyDelta(this.previous.extras,extras)};
      }
      if(Date.now()-this.lastCommit>=1000)await this.commit();
    });
    return this.queue;
  }
  async writeLine(value){await this.writer.write(`${JSON.stringify(value)}\n`);}
  async commit(){
    if(!this.writer)return;
    const writer=this.writer;this.writer=null;
    await writer.close();
    const file=await this.handle.getFile();
    this.writer=await this.handle.createWritable({keepExistingData:true});
    await this.writer.seek(file.size);
    this.lastCommit=Date.now();
  }
  async close(){
    if(!this.writer)return;
    await this.queue;
    const writer=this.writer;this.writer=null;this.handle=null;this.fileName='';
    await writer.close();
    this.previous=null;this.defaults=null;this.packetFields=[];
  }
}

export function parseEEGSessionJsonl(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw new Error('EEG JSONL 記錄至少需要標頭和一筆樣本。');
  let header;
  try{header=JSON.parse(lines[0]);}catch{throw new Error('EEG JSONL 標頭無效。');}
  if(header?.type!=='eeg-session'||header.schemaVersion!==EEG_SESSION_SCHEMA)
    throw new Error('不支援的 EEG JSONL 格式。');
  if(lines.length>200001)throw new Error('記錄樣本超過 200000 筆，請分段匯入。');
  if(header.compactVersion===2&&(!header.packetDefaults||!header.packetFields||!header.packetState
    ||!Array.isArray(header.packetFields)||typeof header.packetState!=='object'))
    throw new Error('EEG JSONL 緊湊標頭無效。');
  const snapshots=[];
  let previous;
  if(header.compactVersion===2){
    previous={
      eeg:{...(header.packetState.eeg??{})},quality:{...(header.packetState.quality??{})},
      fieldTimestamps:{...(header.packetState.fieldTimestamps??{})},
      sensorTimestamps:{...(header.packetState.sensorTimestamps??{})},
      extras:{...(header.packetState.extras??{})},
    };
  }
  for(let index=1;index<lines.length;index++){
    let entry;
    try{entry=JSON.parse(lines[index]);}catch{throw new Error(`EEG JSONL 第 ${index+1} 行無效。`);}
    if(entry.type==='delta'&&header.compactVersion===2){
      if(!Array.isArray(entry.values)||entry.values.length!==10)
        throw new Error(`EEG JSONL 第 ${index+1} 行的差量欄位無效。`);
      const [ts,rawSequence,rawEegSamples,rawBreaks,rawDropped,eeg,fieldTimestamps,quality,sensorTimestamps,extras]=entry.values;
      for(const [state,change] of [[previous.eeg,eeg],[previous.fieldTimestamps,fieldTimestamps],
        [previous.quality,quality],[previous.sensorTimestamps,sensorTimestamps],[previous.extras,extras]]){
        if(!Array.isArray(change)||change.length!==2||!change[0]||typeof change[0]!=='object'
          ||Array.isArray(change[0])||!Array.isArray(change[1]))
          throw new Error(`EEG JSONL 第 ${index+1} 行的差量欄位無效。`);
      }
      previous={eeg:applyDelta(previous.eeg,eeg),fieldTimestamps:applyDelta(previous.fieldTimestamps,fieldTimestamps),
        quality:applyDelta(previous.quality,quality),sensorTimestamps:applyDelta(previous.sensorTimestamps,sensorTimestamps),
        extras:applyDelta(previous.extras,extras)};
      const packet={...header.packetDefaults,...previous.extras,ts};
      if(header.packetFields.includes('rawSequence'))packet.rawSequence=rawSequence;
      if(header.packetFields.includes('rawEegSamples'))packet.rawEegSamples=rawEegSamples;
      if(header.packetFields.includes('rawBreaks'))packet.rawBreaks=rawBreaks??[];
      if(header.packetFields.includes('rawDropped'))packet.rawDropped=rawDropped??0;
      if(header.packetFields.includes('eeg'))packet.eeg=previous.eeg;
      if(header.packetFields.includes('quality'))packet.quality=previous.quality;
      if(header.packetFields.includes('fieldTimestamps'))packet.fieldTimestamps=previous.fieldTimestamps;
      if(header.packetFields.includes('sensorTimestamps'))packet.sensorTimestamps=previous.sensorTimestamps;
      snapshots.push(packet);
    }else if(entry.type==='sample'&&entry.packet){
      snapshots.push(entry.packet);
      if(header.compactVersion===2)previous={
        eeg:{...(entry.packet.eeg??{})},quality:{...(entry.packet.quality??{})},
        fieldTimestamps:{...(entry.packet.fieldTimestamps??{})},sensorTimestamps:{...(entry.packet.sensorTimestamps??{})},
        extras:Object.fromEntries(Object.entries(entry.packet).filter(([key])=>
          variablePacketFields.has(key)&&!['ts','eeg','quality','fieldTimestamps','sensorTimestamps','rawEegSamples','rawBreaks','rawSequence','rawDropped'].includes(key))),
      };
    }else if(entry.type==='sample'&&Array.isArray(entry.values)){
      if(!Array.isArray(header.packetKeys)||entry.values.length!==header.packetKeys.length)
        throw new Error(`EEG JSONL 第 ${index+1} 行的緊湊欄位無效。`);
      snapshots.push(Object.fromEntries(header.packetKeys.map((key,valueIndex)=>[key,entry.values[valueIndex]])));
    }else{
      throw new Error(`EEG JSONL 第 ${index+1} 行不是樣本記錄。`);
    }
  }
  return {schemaVersion:'neural-resonance-recording-v1',recordedAt:header.startedAt,
    deviceId:header.deviceId,networkVersion:null,wormVersion:null,snapshots};
}
