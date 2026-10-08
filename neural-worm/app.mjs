import {StreamState,LiveConnection,demoSnapshot,parseRecording} from '../src/eeg.mjs';
import {DEFAULT_CONFIG,normalizeConfig,demoValues} from '../src/config.mjs';
import {ELEMENTS} from '../src/music.mjs';
import {networkStates,drawNetwork,NETWORK_VERSION} from '../src/neural-networks.mjs';
import {drawWaveforms,drawWorm,drawIndices} from '../src/waveform-view.mjs';
import {BrowserDeviceInput} from '../src/device-input.mjs';
import {captureSnapshot,recordingCsv,replayPacket} from '../src/recording.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {SensorState} from '../src/sensors.mjs';
import {identityOptions,selectedProfile} from '../src/gateway-settings.mjs';
const $=id=>document.getElementById(id),stream=new StreamState();
const sensors=new SensorState();
const english=['MELODY','RHYTHM','HARMONY','DYNAMICS','TEMPO','MODE','FORM','TEXTURE','TIMBRE','ARTICULATION'];
let mode='demo',tick=0,timer=null,selected=0,states=null,recording=false,records=[],frame=0,time=0,paused=false,leaving=false;
let view='waveforms',history=[],rawSamples=[],rawUnit='',replay=null,replayIndex=0,recordBytes=0;
let liveIdentity=null;
const bandTitles={delta:'Delta · δ',theta:'Theta · θ',alpha:'Alpha · α',beta:'Beta · β'};
const waveKeys=['delta','theta','alpha','beta'];
for(const key of waveKeys){
  const cell=document.createElement('section');cell.className='wave-chart';
  cell.innerHTML=`<div><h3>${bandTitles[key]}<small id="wave-range-${key}"></small></h3><span id="wave-value-${key}">—</span></div><canvas id="wave-${key}" aria-label="${key}頻段的時間波形"></canvas>`;
  $('wave-grid').append(cell);
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion=reduced.matches;
reduced.addEventListener('change',event=>{reduceMotion=event.matches;});
const cards=ELEMENTS.map(([key,label],i)=>{
  const button=document.createElement('button');button.className='network';button.dataset.key=key;
  button.setAttribute('aria-pressed',String(i===0));button.setAttribute('aria-label',`${label}神經網`);
  button.innerHTML=`<div class="network-head"><small>${String(i+1).padStart(2,'0')}</small><span>${label}</span><b>—</b></div><canvas aria-label="${label}光粒子神經網"></canvas><div class="network-foot"><span>密集 —</span><span>離散 —</span></div>`;
  button.onclick=()=>{selected=i;update();};$('networks').append(button);return button;
});
const connection=new LiveConnection({
  onState:(state,detail)=>{
    if(mode!=='live'||leaving)return;
    const labels={connecting:'正在連接',connected:'接口已連接',reconnecting:'正在重連',error:'連接不可用',stopped:'已停止',invalid:'資料格式無效'};
    $('status').textContent=labels[state]||state;if(detail)notice(detail);
    if(state==='stopped')stream.reset();
  },
  onSnapshot:packet=>ingest(packet),
});
function notice(text){$('notice').textContent=text;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,5000);}
function ingest(packet,{capture=true,now=Date.now()}={}){
  try{
    if(!stream.accept(packet,now))return;
    sensors.accept(packet,now);
    const snapshot=stream.current(now);
    const identity=JSON.stringify([snapshot.source,snapshot.sessionId,snapshot.transport,snapshot.connectionEpoch]);
    if(identity!==liveIdentity){history=[];rawSamples=[];states=null;liveIdentity=identity;}
    states=networkStates(snapshot);
    history.push(snapshot);history=history.filter(p=>p.timestamp>=Date.now()-60000).slice(-2048);
    const raw=packet.rawEegSamples??packet.eeg?.rawSamples;
    if(Array.isArray(raw)&&raw.length<=8192&&raw.every(Number.isFinite)){
      rawSamples.push(...raw);rawSamples=rawSamples.slice(-4096);rawUnit=packet.rawUnit||'來源原始值';
      $('raw-status').textContent=`${rawSamples.length} 個樣本 · ${rawUnit}${packet.sampleRate?` · ${packet.sampleRate} Hz`:''}${packet.rawDropped?` · 缺失 ${packet.rawDropped}`:''}`;
    }
    if(recording&&capture){
      const entry=captureSnapshot(packet,snapshot,states);
      const size=JSON.stringify(entry).length;
      if(records.length>=20000||recordBytes+size>20*1024*1024){recording=false;notice('記錄已達容量上限，請匯出。');}
      else{records.push(entry);recordBytes+=size;}
    }
    update();
  }catch(error){notice(error.message);}
}
function stop(){clearInterval(timer);clearTimeout(timer);timer=null;connection.stop();stream.reset();sensors.reset();paused=true;devices.stop();}
function emit(){
  const values=demoValues(Number($('attention').value),Number($('relaxation').value),tick,$('auto').checked);
  ingest(demoSnapshot(values.attention,values.relaxation,tick++));
}
function startDemo(){
  stop();mode='demo';paused=false;history=[];const now=Date.now();
  for(let i=0;i<120;i++){
    const ts=now-(120-i)*500,v=demoValues(Number($('attention').value),Number($('relaxation').value),tick,$('auto').checked);
    ingest(demoSnapshot(v.attention,v.relaxation,tick++,ts),{capture:false,now:ts});
  }
  emit();timer=setInterval(emit,250);$('pause').textContent='暫停示範';
}
function setMode(value){
  lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='等待產生';
  stop();mode=value;states=null;time=0;history=[];rawSamples=[];$('raw-status').textContent='等待原始樣本';
  for(const id of ['demo','live','replay']){$(`${id}-input`).hidden=id!==mode;$(id).setAttribute('aria-pressed',String(id===mode));}
  $('source').textContent=mode.toUpperCase();
  $('source-note').textContent=mode==='demo'?'示範由本頁生成，並非實際測量。':mode==='replay'?'保留記錄時間間隔與原始來源，僅重放資料。':'依實際接收的有效指數更新；頻段比值不換算成百分制。';
  $('status').textContent=mode==='demo'?'示範資料':mode==='replay'?'等待記錄':'等待資料源';if(mode==='demo')startDemo();update();
}
function update(){
  const current=stream.current(),valid=current?.valid;
  const sensorValues=sensors.current();
  for(const key of ['spo2','pr','hrv','gsr']){
    $(`sensor-${key}`).textContent=sensorValues[key].valid?String(sensorValues[key].value):'—';
  }
  $('read-attention').textContent=valid?Math.round(current.attention):'—';
  $('read-relaxation').textContent=valid?Math.round(current.relaxation):'—';
  $('gauge-attention').style.setProperty('--progress',`${valid?current.attention*3.6:0}deg`);
  $('gauge-relaxation').style.setProperty('--progress',`${valid?current.relaxation*3.6:0}deg`);
  $('packets').textContent=current?.packets??'—';
  $('freshness').textContent=valid?'有效資料':current?.transportFresh&&!current.signalValid?'接觸不良':
    current?.signalValid?'缺少設備指數':'等待 / 暫停';
  $('waiting').hidden=Boolean(states);
  $('count').textContent=`${records.length} 個樣本`;$('record').textContent=recording?'停止記錄':'開始記錄';
  for(const id of ['export','csv-export','upload-recording'])$(id).disabled=!records.length;
  const state=states?.[selected];
  $('selected-name').replaceChildren(document.createTextNode(`${ELEMENTS[selected][1]} `),
    Object.assign(document.createElement('span'),{textContent:english[selected]}));
  $('selected-value').textContent=valid&&state?state.value:'—';$('selected-unit').textContent=ELEMENTS[selected][2];
  $('density').textContent=valid&&state?state.density.toFixed(2):'—';
  $('dispersion').textContent=valid&&state?state.dispersion.toFixed(2):'—';
  $('nodes').textContent=valid&&state?state.nodeCount:'—';
  cards.forEach((card,i)=>{
    card.setAttribute('aria-pressed',String(i===selected));
    card.querySelector('b').textContent=valid&&states?states[i].value:'—';
    const cells=card.querySelectorAll('.network-foot span');
    cells[0].textContent=`密集 ${valid&&states?states[i].density.toFixed(2):'—'}`;
    cells[1].textContent=`離散 ${valid&&states?states[i].dispersion.toFixed(2):'—'}`;
  });
  for(const key of waveKeys)$(`wave-value-${key}`).textContent=current?.transportFresh&&current.bands[key]!==null?current.bands[key].toPrecision(4):'—';
  $('wave-units').textContent=current?.bandUnits||'保留來源單位';
  for(const key of waveKeys){
    const range=current?.raw?.bandRanges?.[key];
    $(`wave-range-${key}`).textContent=range?` ${range[0]}–${range[1]} Hz`:'';
  }
  if(mode==='live'&&current){
    $('signal-transport').textContent=current.raw.transport==='none'?'等待有效包':current.raw.transport||'外部接口';
    $('signal-age').textContent=Number.isFinite(current.raw.lastSampleAt)?`${Math.max(0,Date.now()/1000-current.raw.lastSampleAt).toFixed(1)} s`:'—';
    $('signal-raw-count').textContent=current.raw.rawSequence??'—';
    $('signal-contact').textContent=current.raw.eeg?.poor_signal===0?'良好':
      current.raw.eeg?.poor_signal>0?`接觸 ${current.raw.eeg.poor_signal}`:'未回報';
  }else{
    for(const id of ['signal-transport','signal-age','signal-raw-count','signal-contact'])$(id).textContent=mode==='demo'?'示範':'—';
  }
  for(const id of ['make-prompt','copy-prompt','download-prompt']){
    $(id).disabled=!valid || (id!=='make-prompt'&&!lastPrompt);
  }
  if(!valid&&lastPrompt){lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='資料已中斷，請重新接收後產生提示詞。';}
}
for(const id of ['demo','live','replay'])$(id).onclick=()=>setMode(id);
for(const id of ['attention','relaxation'])$(id).oninput=()=>{$(`${id}-value`).textContent=$(id).value;if(mode==='demo'&&!paused)emit();};
$('auto').onchange=()=>{if(mode==='demo'&&!paused)emit();};
$('pause').onclick=()=>{
  if(paused)startDemo();else{stop();$('pause').textContent='繼續示範';$('status').textContent='示範已暫停';update();}
};
$('connect').onclick=()=>{
  try{
    const text=$('endpoint').value.trim();
    if(!text)throw new Error('請填入 WebSocket 資料源。');
    if(location.protocol==='https:'&&text.startsWith('ws:'))throw new Error('HTTPS 頁面需要 wss://；本機 HTTP 頁面可使用 ws://。');
    if(mode!=='live')setMode('live');
    stop();stream.reset();states=null;history=[];connection.connect(text);paused=false;
  }catch(error){notice(error.message);}
};
$('disconnect').onclick=()=>{stop();update();};
$('record').onclick=()=>{recording=!recording;update();};
function recordingValue(){return {schemaVersion:'neural-resonance-recording-v1',networkVersion:NETWORK_VERSION,
  recordedAt:new Date().toISOString(),snapshots:records};}
function download(name,data,type='application/json'){
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick=()=>download(`neural-eeg-${Date.now()}.json`,JSON.stringify(recordingValue(),null,2));
$('csv-export').onclick=()=>{
  download(`neural-eeg-${Date.now()}.csv`,recordingCsv(records),'text/csv;charset=utf-8');
};
let lastPrompt=null;
function invalidatePrompt(){lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='等待產生';update();}
$('prompt-model').onchange=invalidatePrompt;
$('prompt-window').onchange=invalidatePrompt;
$('make-prompt').onclick=()=>{
  try{
    lastPrompt=createMusicPrompt(history,{current:stream.current(),target:$('prompt-model').value,
      windowSeconds:Number($('prompt-window').value)});
    if(!lastPrompt)throw new Error('需要新鮮且有效的設備指數；頻段比值不能直接代替。');
    $('music-prompt').value=lastPrompt.text;
    const c=lastPrompt.coordinates127;
    $('prompt-status').textContent=`${lastPrompt.observedSamples} 個有效樣本 · 最大間隔 ${lastPrompt.longestGapSeconds}s · 座標 ${c.attention}, ${c.relaxation} / 127`;
    update();
  }catch(error){notice(error.message);}
};
$('copy-prompt').onclick=async()=>{
  if(!lastPrompt||!stream.current()?.valid)return;
  try{await navigator.clipboard.writeText(lastPrompt.text);notice('已複製；可貼到所選音樂模型。');}
  catch{$('music-prompt').focus();$('music-prompt').select();notice('請複製已選取的文字。');}
};
$('download-prompt').onclick=()=>{
  if(lastPrompt&&stream.current()?.valid)download(`neural-music-prompt-${Date.now()}.json`,JSON.stringify(lastPrompt,null,2));
};
$('replay-file').onchange=async()=>{
  try{const file=$('replay-file').files[0];if(!file)return;if(file.size>20*1024*1024)throw new Error('請使用 20 MB 以内的記錄。');
    replay=parseRecording(await file.text());replayIndex=0;$('replay-start').disabled=false;$('replay-info').textContent=`${replay.snapshots.length} 個樣本`;
  }catch(error){notice(error.message);}
};
function replayNext(){
  if(!replay||replayIndex>=replay.snapshots.length){stream.reset();$('status').textContent='回放完成';update();return;}
  const packet=replay.snapshots[replayIndex++];
  ingest(replayPacket(packet));
  const next=replay.snapshots[replayIndex];timer=setTimeout(replayNext,next?Math.max(1,(next.ts-packet.ts)*1000):300);
}
$('replay-start').onclick=()=>{if(!replay)return;stop();if(replayIndex>=replay.snapshots.length)replayIndex=0;paused=false;$('status').textContent='記錄回放';replayNext();};
$('replay-stop').onclick=()=>{stop();$('status').textContent='回放已暫停';update();};
function setView(next){
  if(!['waveforms','worm','settings'].includes(next))next='waveforms';
  view=next;
  for(const name of ['waveforms','worm','settings'])$(`view-${name}`).hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  const title={waveforms:'波形捕獲',worm:'神經蠕蟲',settings:'設備設定'}[view];
  $('page-title').replaceChildren(document.createTextNode(title),Object.assign(document.createElement('span'),{textContent:{waveforms:'EEG / LIVE SIGNAL',worm:'十大音樂要素',settings:'DEVICE / INTERFACES'}[view]}));
  if(view==='settings')capabilities();
  if(view==='settings')refreshGateway();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{location.hash=button.dataset.view;});
window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));
function drawRaw(){
  const c=$('raw-wave'),ratio=Math.min(2,devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;
  if(c.width!==Math.round(w*ratio)||c.height!==Math.round(h*ratio)){c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);}
  const ctx=c.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  if(!rawSamples.length)return;
  const min=Math.min(...rawSamples),max=Math.max(...rawSamples),range=Math.max(1,max-min);
  ctx.strokeStyle='#dfefec';ctx.lineWidth=1;ctx.beginPath();
  const stride=Math.max(1,Math.floor(rawSamples.length/w));
  for(let i=0;i<rawSamples.length;i+=stride){
    const x=i/(rawSamples.length-1||1)*w,y=h-12-(rawSamples[i]-min)/range*(h-24);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }ctx.stroke();c.dataset.samples=String(rawSamples.length);
}
for(const [id,mask] of [['wave-snapshot',false],['mask-snapshot',true]])$(id).onclick=()=>{
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1920,1080);if(!mask){ctx.fillStyle='#0c1117';ctx.fillRect(0,0,1920,1080);}
  for(let i=0;i<4;i++)drawWaveforms(canvas,history,waveKeys[i],Date.now(),{mask:true,row:i,rows:4});
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`neural-${mask?'mask':'waveforms'}-${Date.now()}.png`;a.click();
};
const devices=new BrowserDeviceInput({onPacket:ingest,onStatus:text=>{$('device-status').textContent=text;}});
let gatewayConfig=null;
async function refreshGateway(){
  try{
    const response=await fetch('/api/gateway/devices',{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(!response.ok)return;
    const data=await response.json();
    gatewayConfig=data.config;$('gateway-panel').hidden=false;
    $('gateway-platform').textContent=data.platform==='darwin'?'macOS':data.platform==='win32'?'Windows':data.platform;
    $('gateway-inventory').replaceChildren(...data.devices.map(device=>{
      const row=document.createElement('div');row.className='device-row';
      const name=document.createElement('code'),detail=document.createElement('span');
      name.textContent=device.port;
      detail.textContent=`${device.description} · ${device.vid===null?'非USB':`${device.vid.toString(16).padStart(4,'0')}:${device.pid.toString(16).padStart(4,'0')}`} · ${device.serialNumber||device.location||'無序列號'}`;
      row.append(name,detail);return row;
    }));
    if(!data.devices.length)$('gateway-inventory').textContent='尚未發現串口設備；插入後可重新掃描。';
    for(const [key,id] of [['eeg','gateway-eeg-select'],['bloodOxygen','gateway-oxygen-select']]){
      const select=$(id),profile=data.config[key];
      select.replaceChildren(new Option('自動 · 唯一型號匹配','{}'));
      for(const option of identityOptions(data.devices,profile))select.add(new Option(option.label,option.value));
      const registered=JSON.stringify({serialNumber:profile.serialNumber||'',location:profile.location||''});
      if([...select.options].some(o=>o.value===registered))select.value=registered;
    }
    $('gateway-save').disabled=Boolean(data.upstream);
    $('gateway-message').textContent=data.upstream
      ?'目前復用既有音療核心，其设备身份由核心配置管理；獨立模式可在此保存。'
      :'按USB身份識別；COM號或macOS設備路径改變後自動重連。';
  }catch(error){$('gateway-message').textContent=`設備清單暫不可用：${error.message}`;}
}
$('gateway-refresh').onclick=refreshGateway;
$('gateway-save').onclick=async()=>{
  if(!gatewayConfig)return;
  try{
    const next={...gatewayConfig,
      eeg:selectedProfile(gatewayConfig.eeg,$('gateway-eeg-select').value),
      bloodOxygen:selectedProfile(gatewayConfig.bloodOxygen,$('gateway-oxygen-select').value)};
    const response=await fetch('/api/gateway/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    await refreshGateway();$('gateway-message').textContent='身份已保存，采集器已重新識別設備。';
  }catch(error){$('gateway-message').textContent=`保存未完成：${error.message}`;}
};
let runtimeTimer=null;
async function refreshRuntime(){
  try{
    const response=await fetch('/api/runtime',{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(!response.ok)return;
    const state=await response.json();if(state.schemaVersion!=='music-therapy-runtime-v1')return;
    const core=state.core;
    $('runtime-summary').textContent=core?.reachable
      ?`核心運行中 · ${core.eegSource==='none'?'尚未收到有效腦波':`來源 ${core.eegSource}`} · USB ${core.ports?.brainlink||'未識別'} · 血氧 ${core.ports?.bloodOxygen||'未識別'}`
      :'核心未運行；接口保持重連。';
    $('health-result').textContent=JSON.stringify({core:state.core,checkedAt:state.checkedAt},null,2);
  }catch{$('runtime-summary').textContent='本機橋接器暫不可用；等待接口恢復。';}
}
function capabilities(){
  const data=[['執行環境',isSecureContext?'安全來源':'非安全來源：硬體 API 可能不可用'],
    ['USB / Web Serial',navigator.serial?'瀏覽器接口可用':'此瀏覽器未提供接口'],
    ['BLE / Web Bluetooth',navigator.bluetooth?'瀏覽器接口可用':'此瀏覽器未提供接口'],
    ['設備驅動','由作業系統管理；未從網頁核驗']];
  $('capabilities').replaceChildren(...data.map(([title,text])=>{
    const item=document.createElement('div');const t=document.createElement('span'),p=document.createElement('b');
    t.textContent=title;p.textContent=text;item.append(t,p);return item;
  }));
}
$('check-capabilities').onclick=capabilities;
$('serial-connect').onclick=async()=>{
  try{setMode('live');await devices.serial(Number($('baud').value));}
  catch(error){$('device-status').textContent=error.message;notice(error.message);}
};
$('ble-connect').onclick=async()=>{
  try{setMode('live');await devices.bluetooth({service:$('ble-service').value.trim(),
    characteristic:$('ble-characteristic').value.trim(),namePrefix:$('ble-name').value.trim()});}
  catch(error){await devices.stop();$('device-status').textContent=error.message;notice(error.message);}
};
$('device-stop').onclick=()=>{stop();$('device-status').textContent='設備連線已停止';update();};
function httpUrl(text){const url=new URL(text);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('請使用不含帳密的 HTTP／HTTPS 地址。');return url.href;}
$('health-check').onclick=async()=>{
  try{const response=await fetch(httpUrl($('health-url').value.trim()),{signal:AbortSignal.timeout(5000)});
    $('health-result').textContent=`HTTP ${response.status} ${response.ok?'接口有回應；硬體需另行核驗':'接口回應錯誤'}`;
  }catch(error){$('health-result').textContent=`無法讀取接口：${error.message}。請檢查地址、TLS 與 CORS。`;}
};
const settingIds=['endpoint','baud','ble-name','ble-service','ble-characteristic','health-url','upload-url'];
function settings(){return {schemaVersion:'neural-resonance-settings-v1',...Object.fromEntries(settingIds.map(id=>[id,$(id).value]))};}
function applySettings(value){
  if(value?.schemaVersion!=='neural-resonance-settings-v1')throw new Error('不支援的設定格式。');
  if(value.endpoint)normalizeConfig({endpoint:value.endpoint},location.href);
  for(const id of ['health-url','upload-url'])if(value[id])httpUrl(value[id]);
  if(value.baud&&!['9600','57600','115200'].includes(String(value.baud)))throw new Error('不支援的波特率。');
  for(const id of settingIds)if(typeof value[id]==='string'&&value[id].length<=2048)$(id).value=value[id];
}
$('save-settings').onclick=()=>{try{const value=settings();applySettings(value);localStorage.setItem('neural-resonance-settings',JSON.stringify(value));notice('設定已保存在此瀏覽器。');}catch(error){notice(error.message);}};
$('download-settings').onclick=()=>{try{const value=settings();applySettings(value);download('neural-resonance-settings.json',JSON.stringify(value,null,2));}catch(error){notice(error.message);}};
$('settings-file').onchange=async()=>{
  try{const file=$('settings-file').files[0];if(!file)return;if(file.size>100000)throw new Error('設定檔過大。');applySettings(JSON.parse(await file.text()));notice('已匯入設定；連線需手動開啟。');}
  catch(error){notice(error.message);}
};
$('upload-recording').onclick=async()=>{
  try{const response=await fetch(httpUrl($('upload-url').value.trim()),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(recordingValue()),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    $('upload-result').textContent=`已收到接口回應 HTTP ${response.status}；${records.length} 個樣本`;
  }catch(error){$('upload-result').textContent=`上傳未完成：${error.message}`;}
};
function animate(now){
  if(document.hidden||now-frame<(reduceMotion?250:40)){requestAnimationFrame(animate);return;}
  const valid=stream.current()?.valid;
  if(valid&&!reduceMotion)time+=Math.min(.1,(now-frame)/1000);
  frame=now;
  if(view==='worm'){
    drawWorm($('hero'),history,time,{space:$('worm-space').value,active:Boolean(valid),reduced:reduceMotion});
    cards.forEach((card,i)=>{
      const bounds=card.getBoundingClientRect();
      if(bounds.bottom>0&&bounds.top<innerHeight)drawNetwork(card.querySelector('canvas'),states?.[i],time,{active:Boolean(valid)});
    });
  }
  if(view==='waveforms'){drawIndices($('indices-wave'),history);for(const key of waveKeys)drawWaveforms($(`wave-${key}`),history,key);drawRaw();}
  requestAnimationFrame(animate);
}
window.addEventListener('pagehide',()=>{leaving=true;clearInterval(runtimeTimer);stop();});
setInterval(update,250);requestAnimationFrame(animate);
async function initialize(){
  let config=DEFAULT_CONFIG;
  try{const response=await fetch(new URL('../public/config.json',import.meta.url),{signal:AbortSignal.timeout(1500),cache:'no-store'});
    if(response.ok)config=normalizeConfig(await response.json(),location.href);
  }catch{/* Independent demo default. */}
  if(leaving)return;
  $('endpoint').value=config.endpoint;setMode(config.startupMode);
  try{const local=localStorage.getItem('neural-resonance-settings');if(local)applySettings(JSON.parse(local));}catch{/* Bad saved settings do not prevent startup. */}
  // The local integration owns its endpoint; an old saved remote address must
  // not redirect automatic startup away from the current same-origin core.
  if(config.startupMode==='live'&&config.autoConnect)$('endpoint').value=config.endpoint;
  setView(location.hash.slice(1));
  if(config.startupMode==='live'&&config.autoConnect)$('connect').click();
  if(config.startupMode==='live'&&config.autoConnect){
    $('health-url').value=new URL('/api/runtime',location.href).href;
    refreshRuntime();runtimeTimer=setInterval(refreshRuntime,5000);
  }
}
initialize();
