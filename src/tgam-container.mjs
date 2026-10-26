const MAGIC=new TextEncoder().encode('NR-TGAM1');
const HEADER_CAPACITY=4096;
const PREFIX_BYTES=MAGIC.length+4;
export const TGAM_HEADER_BYTES=PREFIX_BYTES+HEADER_CAPACITY;

export function encodeTgamHeader(metadata){
  const encoded=new TextEncoder().encode(JSON.stringify(metadata));
  if(encoded.length>HEADER_CAPACITY)throw new Error('TGAM session metadata exceeds the container header capacity.');
  const header=new Uint8Array(TGAM_HEADER_BYTES);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(MAGIC.length,encoded.length,false);
  header.set(encoded,PREFIX_BYTES);
  return header;
}

export function decodeTgamContainer(bytes){
  if(!(bytes instanceof Uint8Array))throw new TypeError('TGAM recording must be a Uint8Array');
  if(bytes.length<MAGIC.length||!MAGIC.every((value,index)=>bytes[index]===value))
    return {isContainer:false,metadata:null,rawBytes:bytes};
  if(bytes.length<TGAM_HEADER_BYTES)throw new Error('TGAM container header is incomplete.');
  const length=new DataView(bytes.buffer,bytes.byteOffset+MAGIC.length,4).getUint32(0,false);
  if(length===0||length>HEADER_CAPACITY)throw new Error('TGAM container metadata length is invalid.');
  let metadata;
  try{
    metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(PREFIX_BYTES,PREFIX_BYTES+length)));
  }catch{
    throw new Error('TGAM container metadata is not valid UTF-8 JSON.');
  }
  if(metadata?.schema!=='neural-resonance-tgam-v1'
    ||metadata?.container!=='neural-resonance-tgam-container-v1')
    throw new Error('Unsupported TGAM container metadata schema.');
  return {isContainer:true,metadata,rawBytes:bytes.subarray(TGAM_HEADER_BYTES)};
}
