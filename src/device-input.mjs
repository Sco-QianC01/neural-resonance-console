/** ThinkGear framing only. ADC values are preserved; no undocumented µV conversion. */
export class ThinkGearDecoder{
  constructor(){this.bytes=[];this.count=0;this.latest={};this.lastAt={};}
  push(chunk,now=Date.now()){
    this.bytes.push(...chunk);if(this.bytes.length>65536)this.bytes=this.bytes.slice(-65536);
    const packets=[];
    while(this.bytes.length>=4){
      if(this.bytes[0]!==0xaa||this.bytes[1]!==0xaa){this.bytes.shift();continue;}
      const length=this.bytes[2];
      if(length>169){this.bytes.shift();continue;}
      if(this.bytes.length<length+4)break;
      const frame=this.bytes.splice(0,length+4),payload=frame.slice(3,-1);
      const checksum=(~payload.reduce((a,b)=>a+b,0))&255;
      if(checksum!==frame.at(-1))continue;
      let cursor=0,changed=false,raw=[];
      while(cursor<payload.length){
        const code=payload[cursor++];if(code===0x55)continue;
        let size=1;if(code>=0x80)size=payload[cursor++];
        if(!Number.isInteger(size)||cursor+size>payload.length){changed=false;break;}
        const values=payload.slice(cursor,cursor+size);cursor+=size;
        const set=(key,value)=>{this.latest[key]=value;this.lastAt[key]=now;changed=true;};
        if(code===2)set('poor_signal',values[0]);
        if(code===4)set('attention',values[0]);
        if(code===5)set('meditation',values[0]);
        if(code===0x80&&size===2){const n=(values[0]<<8)|values[1];raw.push(n>32767?n-65536:n);changed=true;}
        if(code===0x83&&size===24){
          ['delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma'].forEach((key,i)=>
            set(key,(values[i*3]<<16)|(values[i*3+1]<<8)|values[i*3+2]));
        }
      }
      if(!changed)continue;
      const eeg=Object.fromEntries(Object.entries(this.latest).filter(([key])=>now-this.lastAt[key]<=3000));
      packets.push({schemaVersion:'neural-resonance-live-v1',source:'device',ts:now/1000,
        quality:{eegPackets:++this.count},eeg,rawEegSamples:raw,rawUnit:'ADC counts'});
    }
    return packets;
  }
}

/** Browser ownership lasts until disconnect/page close; view switches do not close it. */
export class BrowserDeviceInput{
  constructor({onPacket,onStatus}){Object.assign(this,{onPacket,onStatus});this.generation=0;this.port=null;this.device=null;this.reader=null;this.decoder=new ThinkGearDecoder();this.bytes=0;}
  feed(bytes){
    this.bytes+=bytes.length;const packets=this.decoder.push(bytes);
    this.onStatus(packets.length?`已解析 ${this.decoder.count} 個腦波封包 · ${this.bytes} bytes`:
      `已收到 ${this.bytes} bytes；等待相容腦波封包`);
    for(const packet of packets)this.onPacket(packet);
  }
  async serial(baudRate){
    if(!navigator.serial)throw new Error('此瀏覽器不支援 Web Serial；可使用桌面橋接器的 WebSocket。');
    const port=await navigator.serial.requestPort();
    await this.stop();this.decoder=new ThinkGearDecoder();this.bytes=0;
    await port.open({baudRate});this.port=port;const generation=this.generation;
    this.onStatus('USB 串口已打開；等待資料');this.reader=port.readable.getReader();
    try{while(generation===this.generation){const {value,done}=await this.reader.read();if(done)break;if(value)this.feed(value);}}
    catch(error){if(generation===this.generation)this.onStatus(`串口中斷：${error.message}`);}
    finally{if(generation===this.generation)await this.stop();}
  }
  async bluetooth({service,characteristic,namePrefix}){
    if(!navigator.bluetooth)throw new Error('此瀏覽器不支援 Web Bluetooth；可使用桌面橋接器。');
    if(!service||!characteristic)throw new Error('請填入設備文件中的服務 UUID 和通知特徵 UUID。');
    const options={optionalServices:[service],...(namePrefix?{filters:[{namePrefix}]}:{acceptAllDevices:true})};
    const device=await navigator.bluetooth.requestDevice(options);
    await this.stop();this.decoder=new ThinkGearDecoder();this.bytes=0;this.device=device;
    device.addEventListener('gattserverdisconnected',()=>this.onStatus('藍牙已斷開'));
    const server=await device.gatt.connect();
    const s=await server.getPrimaryService(service),c=await s.getCharacteristic(characteristic);
    this.characteristic=c;this.notification=event=>{
      const value=event.target.value;this.feed(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
    };
    c.addEventListener('characteristicvaluechanged',this.notification);await c.startNotifications();
    this.onStatus('藍牙 GATT 已連接；等待通知資料');
  }
  async stop(){
    this.generation++;
    if(this.reader){try{await this.reader.cancel();this.reader.releaseLock();}catch{}this.reader=null;}
    if(this.port){try{await this.port.close();}catch{}this.port=null;}
    if(this.characteristic){this.characteristic.removeEventListener('characteristicvaluechanged',this.notification);try{await this.characteristic.stopNotifications();}catch{}this.characteristic=null;}
    if(this.device?.gatt?.connected)this.device.gatt.disconnect();this.device=null;
  }
}
