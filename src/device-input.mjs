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
      let cursor=0,changed=false,raw=[],valid=true;
      const updates={};
      while(cursor<payload.length){
        let level=0;
        while(payload[cursor]===0x55){level++;cursor++;}
        if(cursor>=payload.length){valid=false;break;}
        const code=payload[cursor++];
        let size=1;if(code>=0x80)size=payload[cursor++];
        if(!Number.isInteger(size)||cursor+size>payload.length){valid=false;break;}
        const values=payload.slice(cursor,cursor+size);cursor+=size;
        if(level>0)continue;
        const set=(key,value)=>{updates[key]=value;changed=true;};
        if(code===2)set('poor_signal',values[0]);
        if(code===4)set('attention',values[0]);
        if(code===5)set('meditation',values[0]);
        if(code===0x80&&size===2){const n=(values[0]<<8)|values[1];raw.push(n>32767?n-65536:n);changed=true;}
        if(code===0x83&&size===24){
          ['delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma'].forEach((key,i)=>
            set(key,(values[i*3]<<16)|(values[i*3+1]<<8)|values[i*3+2]));
        }
      }
      if(!valid||!changed)continue;
      // Commit a complete validated payload, never a partially parsed one.
      for(const [key,value] of Object.entries(updates)){this.latest[key]=value;this.lastAt[key]=now;}
      const eeg=Object.fromEntries(Object.entries(this.latest).filter(([key])=>now-this.lastAt[key]<=3000));
      packets.push({schemaVersion:'neural-resonance-live-v1',source:'device',ts:now/1000,
        metricOrigin:'thinkgear-esense',quality:{eegPackets:++this.count},eeg,
        fieldTimestamps:Object.fromEntries(Object.entries(this.lastAt).map(([key,at])=>[key,at/1000])),
        rawEegSamples:raw,rawUnit:'ADC counts'});
    }
    return packets;
  }
}

/** Browser ownership lasts until disconnect/page close; view switches do not close it. */
export class BrowserDeviceInput{
  constructor({onPacket,onStatus}){Object.assign(this,{onPacket,onStatus});this.generation=0;this.port=null;this.device=null;this.reader=null;this.decoder=new ThinkGearDecoder();this.bytes=0;this.retryTimer=null;this.connectionEpoch=0;this.retry=0;}
  feed(bytes){
    const now=globalThis.performance?.timeOrigin&&globalThis.performance?.now
      ?performance.timeOrigin+performance.now():Date.now();
    this.bytes+=bytes.length;const packets=this.decoder.push(bytes,now);
    this.onStatus(packets.length?`已解析 ${this.decoder.count} 個腦波封包 · ${this.bytes} bytes`:
      `已收到 ${this.bytes} bytes；等待相容腦波封包`);
    if(packets.length)this.onPacket({...packets.at(-1),
      rawEegSamples:packets.flatMap(packet=>packet.rawEegSamples),
      transport:this.port?'browser_usb':'browser_ble',connectionEpoch:this.connectionEpoch});
  }
  async serial(baudRate){
    if(!navigator.serial)throw new Error('此瀏覽器不支援 Web Serial；可使用桌面橋接器的 WebSocket。');
    const requested=this.generation,port=await navigator.serial.requestPort();
    if(requested!==this.generation)return;
    await this.stop();this.port=port;const generation=this.generation;
    let retry=0;
    while(generation===this.generation){
      try{
        await port.open({baudRate});
        if(generation!==this.generation){await port.close();return;}
        this.decoder=new ThinkGearDecoder();this.bytes=0;this.connectionEpoch++;
        this.onStatus('USB 串口已打開；等待資料');const reader=port.readable.getReader();this.reader=reader;
        try{while(generation===this.generation){const {value,done}=await reader.read();if(done)break;if(value){this.feed(value);retry=0;}}}
        finally{try{reader.releaseLock();}catch{}if(this.reader===reader)this.reader=null;try{await port.close();}catch{}}
      }catch(error){if(generation===this.generation)this.onStatus(`USB 暫不可用：${error.message}；等待已授權設備恢復。`);}
      if(generation!==this.generation)return;
      await new Promise(resolve=>{this.retryResolve=resolve;this.retryTimer=setTimeout(resolve,Math.min(8000,1000*2**retry++));});
      this.retryResolve=null;this.retryTimer=null;
    }
  }
  async bluetooth({service,characteristic,namePrefix}){
    if(!navigator.bluetooth)throw new Error('此瀏覽器不支援 Web Bluetooth；可使用桌面橋接器。');
    if(!service||!characteristic)throw new Error('請填入設備文件中的服務 UUID 和通知特徵 UUID。');
    const options={optionalServices:[service],...(namePrefix?{filters:[{namePrefix}]}:{acceptAllDevices:true})};
    const requested=this.generation,device=await navigator.bluetooth.requestDevice(options);
    if(requested!==this.generation)return;
    await this.stop();this.device=device;this.bleOptions={service,characteristic};const generation=this.generation;
    this.disconnected=()=>{
      if(generation!==this.generation||this.device!==device)return;
      this.onStatus('藍牙已斷開；正在重連已授權設備。');this.queueBluetooth(generation);
    };
    device.addEventListener('gattserverdisconnected',this.disconnected);
    try{await this.openBluetooth(generation);}catch(error){this.onStatus(`BLE 暫不可用：${error.message}；正在重連。`);this.queueBluetooth(generation);}
  }
  queueBluetooth(generation){
    if(generation!==this.generation||!this.device)return;
    clearTimeout(this.retryTimer);
    this.retryTimer=setTimeout(async()=>{
      if(generation!==this.generation)return;
      try{await this.openBluetooth(generation);}catch(error){
        if(generation===this.generation){this.onStatus(`BLE 暫不可用：${error.message}；正在重連。`);this.queueBluetooth(generation);}
      }
    },Math.min(8000,1000*2**this.retry++));
  }
  async openBluetooth(generation){
    const {service,characteristic}=this.bleOptions,device=this.device;
    const current=()=>generation===this.generation&&this.device===device;
    const server=await device.gatt.connect();
    if(!current()){if(device.gatt.connected)device.gatt.disconnect();return;}
    const s=await server.getPrimaryService(service),c=await s.getCharacteristic(characteristic);
    if(!current())return;
    if(this.characteristic)this.characteristic.removeEventListener('characteristicvaluechanged',this.notification);
    this.characteristic=c;this.notification=event=>{
      if(!current()||this.characteristic!==c)return;
      const value=event.target.value;this.feed(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
    };
    this.decoder=new ThinkGearDecoder();this.bytes=0;this.connectionEpoch++;
    c.addEventListener('characteristicvaluechanged',this.notification);await c.startNotifications();
    if(!current()){c.removeEventListener('characteristicvaluechanged',this.notification);return;}
    this.retry=0;
    this.onStatus('藍牙 GATT 已連接；等待通知資料');
  }
  async stop(){
    this.generation++;
    clearTimeout(this.retryTimer);this.retryTimer=null;this.retryResolve?.();this.retryResolve=null;this.retry=0;
    if(this.reader){try{await this.reader.cancel();this.reader.releaseLock();}catch{}this.reader=null;}
    if(this.port){try{await this.port.close();}catch{}this.port=null;}
    if(this.characteristic){this.characteristic.removeEventListener('characteristicvaluechanged',this.notification);try{await this.characteristic.stopNotifications();}catch{}this.characteristic=null;}
    if(this.device){this.device.removeEventListener('gattserverdisconnected',this.disconnected);if(this.device.gatt?.connected)this.device.gatt.disconnect();}this.device=null;
  }
}
