import {safeDeviceId,sessionFileName} from './eeg-session.mjs';
import {encodeTgamHeader} from './tgam-container.mjs';

export class BrowserRawEEGSessionWriter{
  constructor(directory){this.directory=directory;this.handle=null;this.writer=null;
    this.queue=Promise.resolve();this.fileName='';this.metadata=null;this.lastCommit=Date.now();this.bytes=0;}
  async start(deviceId,{transport,sampleRate=512,baudRate=null,sessionId=null,
    connectionEpoch=null,startedAt=new Date()}={}){
    const base=sessionFileName(deviceId,startedAt);
    let name,suffix=1;
    while(true){
      if(suffix>10000)throw new Error('Could not allocate a unique EEG recording name');
      const stem=suffix===1?base:`${base}-${String(suffix).padStart(2,'0')}`;
      name=`${stem}.tgam`;
      try{
        await this.directory.getFileHandle(name);
        suffix++;
      }catch(error){
        if(error.name!=='NotFoundError')throw error;
        break;
      }
    }
    this.handle=await this.directory.getFileHandle(name,{create:true});
    this.writer=await this.handle.createWritable();
    this.fileName=name;this.bytes=0;this.lastCommit=Date.now();
    this.metadata={schema:'neural-resonance-tgam-v1',container:'neural-resonance-tgam-container-v1',
      deviceId:safeDeviceId(deviceId),protocol:'ThinkGear / TGAM raw serial bytes',transport:transport??null,sampleRate,
      baudRate,sessionId,connectionEpoch,startedAt:startedAt.toISOString(),byteCount:0};
    await this.writer.write(encodeTgamHeader(this.metadata));
  }
  append(bytes){
    const chunk=new Uint8Array(bytes);
    this.queue=this.queue.then(async()=>{
      if(!this.writer)throw new Error('Raw EEG session file is not open');
      await this.writer.write(chunk);this.bytes+=chunk.byteLength;
      if(Date.now()-this.lastCommit>=1000)await this.commit();
    });
    return this.queue;
  }
  async commit(){
    if(!this.writer)return;
    const writer=this.writer;this.writer=null;await writer.close();
    const file=await this.handle.getFile();
    await this.writeHeader();
    this.writer=await this.handle.createWritable({keepExistingData:true});
    await this.writer.seek(file.size);this.lastCommit=Date.now();
  }
  async writeHeader(endedAt=null){
    const metadata={...this.metadata,byteCount:this.bytes,...(endedAt?{endedAt:endedAt.toISOString()}:{})};
    const writer=await this.handle.createWritable({keepExistingData:true});
    await writer.seek(0);await writer.write(encodeTgamHeader(metadata));await writer.close();
  }
  async close(){
    await this.queue;
    if(!this.writer)return;
    const writer=this.writer;this.writer=null;await writer.close();
    await this.writeHeader(new Date());
    this.handle=null;this.fileName='';this.metadata=null;
  }
}
