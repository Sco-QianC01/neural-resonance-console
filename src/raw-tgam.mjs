import {ThinkGearDecoder} from './device-input.mjs';
import {decodeTgamContainer} from './tgam-container.mjs';

const FRAMES_PER_SECOND=513;

export function decodeTgamBytes(bytes,{deviceId='unknown-device',sampleRate=512,
  startedAt=Date.now(),sessionId='raw-tgam-replay',transport='usb'}={}){
  if(!(bytes instanceof Uint8Array))throw new TypeError('TGAM recording must be a Uint8Array');
  const container=decodeTgamContainer(bytes);
  if(container.isContainer){
    const metadata=container.metadata;
    deviceId=metadata.deviceId??deviceId;
    sampleRate=metadata.sampleRate??sampleRate;
    startedAt=metadata.startedAt?Date.parse(metadata.startedAt):startedAt;
    sessionId=metadata.sessionId??sessionId;
    transport=metadata.transport??transport;
    if(!Number.isFinite(startedAt))throw new Error('Invalid EEG start time in TGAM metadata.');
    if(metadata.byteCount!==container.rawBytes.length)
      throw new Error('TGAM container byte count does not match its raw data.');
    bytes=container.rawBytes;
  }
  if(!Number.isFinite(sampleRate)||sampleRate<1||sampleRate>4096)throw new Error('Invalid EEG sample rate in metadata.');
  const decoder=new ThinkGearDecoder(),snapshots=[];
  let packetIndex=0;
  for(let offset=0;offset<bytes.length;offset+=4096){
    const chunk=bytes.subarray(offset,Math.min(bytes.length,offset+4096));
    const decoded=decoder.push(chunk,startedAt+packetIndex*1000/FRAMES_PER_SECOND);
    for(const packet of decoded){
      const timestamp=(startedAt+packetIndex*1000/FRAMES_PER_SECOND)/1000;
      packetIndex++;
      // The decoder already names the instant each field was last measured, and
      // that instant only moves when the field is actually resent. Stamping every
      // field with the frame's own clock — as this used to — turned 512 raw
      // frames per second into 512 "new readings" per second, so a replay filled
      // the whole 60 s plot with a dozen seconds of signal.
      snapshots.push({...packet,source:'device',transport,sessionId,connectionEpoch:1,
        sampleRate,ts:timestamp});
      if(snapshots.length>200000)
        throw new Error('TGAM 記錄超過 200000 個可解析資料包；請分段匯入。');
    }
  }
  if(!snapshots.length)throw new Error('TGAM 檔案中沒有可解析的 ThinkGear 封包。');
  return {schemaVersion:'neural-resonance-recording-v1',recordedAt:new Date(startedAt).toISOString(),
    deviceId,snapshots};
}
