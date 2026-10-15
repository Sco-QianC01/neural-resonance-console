import {StreamState,LiveConnection,demoSnapshot,parseRecording} from '../src/eeg.mjs';
import {DEFAULT_CONFIG,normalizeConfig,demoValues} from '../src/config.mjs';
import {ELEMENTS} from '../src/music.mjs';
import {networkStates,NETWORK_VERSION} from '../src/neural-networks.mjs';
import {SOURCES} from '../src/research-sources.mjs';
import {drawWaveforms,drawWorm,drawIndices,wormViewport} from '../src/waveform-view.mjs';
import {resolvePlan,parsePlanRules} from '../src/music-plan.mjs';
import {BrowserDeviceInput} from '../src/device-input.mjs';
import {captureSnapshot,spreadsheetCsv,replayPacket} from '../src/recording.mjs';
import {parseUtf8Json} from '../src/json-io.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {SensorState} from '../src/sensors.mjs';
import {identityOptions,selectedProfile,deviceDiagnostic,liveAcquisitionStatus} from '../src/gateway-settings.mjs';
import {buildWormTrace,WORM_VERSION} from '../src/worm-model.mjs';
import {mountResearch} from './planar-workbench.mjs';
import {RawAmplitude} from '../src/amplitude-model.mjs';
import {RawWaveform,drawRawWaveform} from '../src/raw-waveform.mjs';
const $=id=>document.getElementById(id),stream=new StreamState();
const sensors=new SensorState();
const rawAmplitude=new RawAmplitude();
const rawWaveform=new RawWaveform();
const english=['MELODY','RHYTHM','HARMONY','DYNAMICS','TEMPO','MODE','FORM','TEXTURE','TIMBRE','ARTICULATION'];
let mode='demo',tick=0,timer=null,selected=0,states=null,recording=false,records=[],frame=0,time=0,paused=false,leaving=false;
let view='waveforms',analysisLayer='whitebox',history=[],replay=null,replayIndex=0,recordBytes=0;
let liveIdentity=null,replayRun=null,recordingLoadEpoch=0;
let connectionState='stopped';
let wormTrace=null,wormCursor=null,wormStates=null;
let planRules=null,currentPlan=null;
const research=mountResearch($('research-worm'),{
  onMode:value=>selectInput(value),
  onWindow:seconds=>{$('worm-window').value=String(seconds);wormTrace=null;update();},
  onImport:file=>loadRecording(file),
  onReplay:()=>{$(paused?'replay-start':'replay-stop').click();},
});
const bandTitles={delta:'Delta · δ',theta:'Theta · θ',alpha:'Alpha · 合計',beta:'Beta · 合計',lowAlpha:'Low Alpha',highAlpha:'High Alpha',lowBeta:'Low Beta',highBeta:'High Beta',lowGamma:'Low Gamma',midGamma:'Mid Gamma'};
const waveKeys=Object.keys(bandTitles);
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
  button.setAttribute('aria-pressed',String(i===0));button.setAttribute('aria-label',`${label}觀測與來源`);
  button.innerHTML=`<div class="network-head"><small>${String(i+1).padStart(2,'0')}</small><span>${label}</span><b></b></div>`;
  button.onclick=()=>{selected=i;update();};$('networks').append(button);return button;
});
for(const source of SOURCES){
  const entry=document.createElement('li'),link=document.createElement('a'),scope=document.createElement('p');
  link.href=source.url;link.target='_blank';link.rel='noopener';link.textContent=source.title;
  scope.textContent=`${source.supports} ${source.boundary}`;entry.append(link,scope);
  $('method-sources').append(entry);
}
const sourceNames={demo:'合成示範',device:'設備資料',core:'橋接資料',replay:'記錄回放',unknown:'外部接口'};
const connection=new LiveConnection({
  onState:(state,detail)=>{
    connectionState=state;
    if(mode!=='live'||leaving)return;
    showLiveStatus();if(detail)notice(detail);
    if(state==='error'){
      try{const url=new URL($('endpoint').value);if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))
        $('source-note').textContent='本機連接未建立：檢查服務及此站點的本地網絡訪問權限。';}catch{/* Invalid URL is handled at the entry. */}
    }else if(state==='connected')$('source-note').textContent='采集服務可用；設備接入以有效腦電資料為準。';
    if(state==='stopped')stream.reset();
  },
  onSnapshot:packet=>{connectionState='connected';ingest(packet);},
});
function showLiveStatus(current=stream.current()){
  const status=liveAcquisitionStatus(current,connectionState);
  $('status').textContent=status.text;$('status').dataset.state=status.state;
}
function notice(text){$('notice').textContent=text;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,5000);}
function ingest(packet,{capture=true,now=Date.now()}={}){
  try{
    if(!stream.accept(packet,now))return;
    sensors.accept(packet,now);
    const snapshot=stream.current(now);
    const transport=snapshot.transport==='none'&&liveIdentity?JSON.parse(liveIdentity)[2]:snapshot.transport;
    const identity=JSON.stringify([snapshot.source,snapshot.sessionId,transport,snapshot.connectionEpoch]);
    if(identity!==liveIdentity){history=[];rawWaveform.reset();states=null;wormTrace=null;wormCursor=null;liveIdentity=identity;}
    snapshot.amplitude=rawAmplitude.push(snapshot);
    const nextStates=networkStates(snapshot);
    if(nextStates)states=nextStates;
    history.push(snapshot);history=history.filter(p=>p.timestamp>=Date.now()-60000).slice(-2048);
    rawWaveform.push(snapshot);
    if(recording&&capture){
      const entry=captureSnapshot(packet,snapshot,states);
      entry.creativeIntent=resolvePlan(snapshot,{manualId:$('music-plan').value,rules:planRules});
      const size=JSON.stringify(entry).length;
      if(records.length>=20000||recordBytes+size>20*1024*1024){recording=false;notice('記錄已達容量上限，請匯出。');}
      else{records.push(entry);recordBytes+=size;}
    }
    update();
  }catch(error){notice(error.message);}
}
function stop(){clearInterval(timer);clearTimeout(timer);timer=null;connection.stop();stream.reset();sensors.reset();rawAmplitude.reset();paused=true;devices.stop();}
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
  nextPromptAt=$('prompt-auto').checked?Date.now()+60000:0;
  stop();mode=value;states=null;wormTrace=null;wormCursor=null;time=0;history=[];rawWaveform.reset();$('raw-status').textContent='等待原始樣本';
  for(const id of ['demo','live','replay']){$(`${id}-input`).hidden=id!==mode;$(id).setAttribute('aria-pressed',String(id===mode));}
  $('source').textContent=mode.toUpperCase();
  $('status').dataset.state='waiting';
  $('source-note').textContent=mode==='demo'?'合成示範':mode==='replay'?'記錄回放':'即時接入';
  $('status').textContent=mode==='demo'?'示範資料':mode==='replay'?'等待記錄':'等待資料源';if(mode==='demo')startDemo();update();
}
function selectInput(value){
  if(value===mode&&!paused)return;
  setMode(value);
  if(value==='live')$('connect').click();
}
function update(){
  const current=stream.current(),valid=current?.valid;
  if(mode==='live')showLiveStatus(current);
  const sensorValues=sensors.current();
  for(const key of ['spo2','pr','hrv','gsr']){
    $(`sensor-${key}`).textContent=sensorValues[key].valid?String(sensorValues[key].value):'—';
    $(`sensor-${key}`).parentElement.hidden=!sensorValues[key].valid;
  }
  $('read-attention').textContent=valid?Math.round(current.attention):'—';
  $('read-relaxation').textContent=valid?Math.round(current.relaxation):'—';
  $('gauge-attention').style.setProperty('--progress',`${valid?current.attention*3.6:0}deg`);
  $('gauge-relaxation').style.setProperty('--progress',`${valid?current.relaxation*3.6:0}deg`);
  $('packets').textContent=current?.packets??'—';
  $('freshness').textContent=valid?'有效資料':current?.transportFresh&&!current.signalValid?(current.signalQuality==='unknown'?'接觸品質未確認':'接觸不良'):
    current?.signalValid?'缺少設備指數':'等待 / 暫停';
  $('count').textContent=`${records.length} 個樣本`;$('record').textContent=recording?'停止記錄':'開始記錄';
  $('planar-count').textContent=$('count').textContent;$('planar-record').textContent=$('record').textContent;
  $('planar-export').disabled=$('planar-csv').disabled=!records.length;
  for(const id of ['export','csv-export','upload-recording'])$(id).disabled=!records.length;
  if(valid||!wormTrace)wormTrace=buildWormTrace(history,{space:$('worm-space').value,
    windowSeconds:Number($('worm-window').value),smoothingSeconds:Number($('worm-smoothing').value)});
  research.updateEEG(wormTrace,valid,{snapshot:current,amplitude:rawAmplitude.value(),history,mode,paused,replayLoaded:Boolean(replay)});
  const points=wormTrace?.points??[];
  $('waiting').hidden=points.length>0;
  const selectedPoint=$('worm-follow').checked?points.at(-1):points.reduce((best,p)=>
    !best||Math.abs(p.timestamp-wormCursor)<Math.abs(best.timestamp-wormCursor)?p:best,null);
  wormCursor=selectedPoint?.timestamp??null;
  const historical=selectedPoint?history.find(p=>p.timestamp===(selectedPoint.packetTimestamp??selectedPoint.timestamp)&&p.valid):null;
  wormStates=historical?networkStates(historical):states;
  currentPlan=resolvePlan(historical??current,{manualId:$('music-plan').value,rules:planRules});
  const state=wormStates?.[selected];
  const stats=wormTrace?.stats;
  $('worm-cursor').max=String(Math.max(0,points.length-1));
  $('worm-cursor').value=String(Math.max(0,points.indexOf(selectedPoint)));
  $('worm-cursor').disabled=!points.length;
  $('worm-export').disabled=!points.length;
  $('worm-time').textContent=selectedPoint
    ?`${((selectedPoint.timestamp-points[0].timestamp)/1000).toFixed(1)} / ${stats.seconds.toFixed(1)} s`:'等待樣本';
  $('worm-center').textContent=$('worm-space').value==='control'?'坐標換算 · 中心 64, 64':'原生指數 · 中心 50, 50';
  $('worm-xy').textContent=selectedPoint?($('worm-space').value==='control'
    ?`${selectedPoint.controls127.attention}, ${selectedPoint.controls127.relaxation} / 127`
    :`${selectedPoint.attention.toFixed(1)}, ${selectedPoint.relaxation.toFixed(1)} / 100`):'—';
  $('trace-density').textContent=points.length?String(stats.samples):'—';
  $('trace-dispersion').textContent=stats?.standardDistance==null?'—':`${stats.standardDistance.toFixed(2)} 指數`;
  $('trace-coverage').textContent=points.length?`${stats.coverageSeconds.toFixed(1)} / ${wormTrace.windowSeconds} s`:'—';
  const signed=n=>`${n>0?'+':''}${n.toFixed(1)}`;
  const coordinate=p=>$('worm-space').value==='control'
    ?`${p.controls127.attention}, ${p.controls127.relaxation}`
    :`${p.attention.toFixed(1)}, ${p.relaxation.toFixed(1)}`;
  $('worm-change').textContent=points.length
    ?`起點 ${coordinate(points[0])} → 終點 ${coordinate(points.at(-1))} / ${$('worm-space').value==='control'?127:100}`
      +` · 原生專注 ${signed(stats.delta.attention)}，放鬆 ${signed(stats.delta.relaxation)}`
      +` · ${stats.samples} 個樣本 / ${stats.segments} 個連續段${valid?'':' · 連線暫停，保留最後觀察'}`
    :'接收有效指數後呈現起點、終點和變化。';
  const planMode=$('music-source').value==='plan';
  $('plan-select-label').hidden=!planMode;
  $('music-plan').disabled=Boolean(planRules);
  $('plan-rules-clear').hidden=!planRules;
  $('selected-name').replaceChildren(document.createTextNode('專注 × 冥想／放鬆 '),
    Object.assign(document.createElement('span'),{textContent:'NATIVE INDEX TRACE'}));
  $('selected-value').textContent=valid?'有效':points.length?'暫停':'等待';$('selected-unit').textContent='資料狀態';
  $('density').textContent=sourceNames[current?.source]||'—';
  $('dispersion').textContent=Number($('worm-smoothing').value)===0?'原始位置':`${$('worm-smoothing').value} s · 僅顯示`;
  $('nodes').textContent=points.length?new Date(selectedPoint.timestamp).toLocaleTimeString():'—';
  cards.forEach((card,i)=>{
    card.setAttribute('aria-pressed',String(i===selected));
    const observation=wormStates?.[i];
    const reported=observation?.status==='reported';
    card.hidden=planMode?!currentPlan:!reported;
    card.querySelector('b').textContent=!planMode&&reported?String(observation.value):'';
    card.dataset.control='';
    card.dataset.sampleTimestamp=String(wormStates?.[i].timestamp??'');
  });
  const shown=cards.findIndex(card=>!card.hidden);
  if(cards[selected].hidden&&shown>=0){selected=shown;cards[selected].setAttribute('aria-pressed','true');}
  const observation=wormStates?.[selected],entry=planMode?currentPlan?.values[ELEMENTS[selected][0]]:null;
  $('element-detail').hidden=shown<0;
  $('element-title').textContent=ELEMENTS[selected][1];
  $('element-text').textContent=planMode?entry?.text??'':`${observation?.value??''} ${observation?.unit??''}`;
  $('element-tags').replaceChildren(...(planMode?entry?.tags??[]:[]).map(text=>{
    const node=document.createElement('span');node.textContent=text;return node;
  }));
  $('element-sample').textContent=planMode&&currentPlan
    ?`${currentPlan.origin==='manual'?'手動方案':currentPlan.origin==='recording'?'記錄方案':'規則 '+currentPlan.ruleId} · ${selectedPoint?new Date(selectedPoint.timestamp).toLocaleTimeString():''}`
    :observation?.source?`${observation.source.id} · ${observation.source.method}`:'';
  $('plan-source').textContent=planMode&&currentPlan?`課件 · 第${currentPlan.source.page}頁`:'音樂資料';
  for(const key of waveKeys){
    const value=current?.spectralBands?.[key]??current?.bands?.[key];
    $(`wave-value-${key}`).textContent=current?.transportFresh&&Number.isFinite(value)?String(value):'—';
    const nativeKey=key==='alpha'?'lowAlpha':key==='beta'?'lowBeta':null;
    const native=nativeKey&&history.some(p=>Number.isFinite(p.spectralBands?.[nativeKey]));
    const known=Number.isFinite(value)||history.some(p=>Number.isFinite(p.spectralBands?.[key]??p.bands?.[key]));
    $(`wave-${key}`).parentElement.hidden=Boolean(native)||!known;
  }
  $('wave-units').textContent=current?.raw?.bandUnits||(current?.source==='demo'?'示範頻段值':'');
  for(const key of waveKeys){
    const range=current?.raw?.bandRanges?.[key];
    $(`wave-range-${key}`).textContent=range?` ${range[0]}–${range[1]} Hz`:'';
  }
  if(mode==='live'&&current){
    $('signal-transport').textContent=current.raw.transport==='none'?'等待有效包':current.raw.transport||'外部接口';
    $('signal-age').textContent=Number.isFinite(current.raw.lastSampleAt)?`${Math.max(0,Date.now()/1000-current.raw.lastSampleAt).toFixed(1)} s`:'—';
    $('signal-raw-count').textContent=current.raw.rawSequence??'—';
    $('signal-contact').textContent=!current.transportFresh?'未回報':
      current.signalQuality==='good'?'良好':
      current.signalQuality==='poor'?`接觸 ${current.poorSignal}`:'未回報';
  }else{
    for(const id of ['signal-transport','signal-age','signal-raw-count','signal-contact'])$(id).textContent=mode==='demo'?'示範':'—';
  }
  if($('prompt-auto').checked&&nextPromptAt&&Date.now()>=nextPromptAt){
    nextPromptAt=Date.now()+60000;
    lastPrompt=createMusicPrompt(history,{current,windowSeconds:60,target:$('prompt-model').value,
      musicPlan:resolvePlan(current,{manualId:$('music-plan').value,rules:planRules})});
    if(lastPrompt){
      $('music-prompt').value=lastPrompt.text;
      $('prompt-status').textContent=`60秒窗口 · ${lastPrompt.observedSamples} 個有效樣本 · 實際觀察 ${lastPrompt.observedCoverageSeconds.toFixed(1)} 秒 · 尚未上傳`;
    }else{
      $('music-prompt').value='';$('prompt-status').textContent='本次窗口無有效指數，未產生交接。';
    }
  }
  $('prompt-next').textContent=$('prompt-auto').checked
    ?`${Math.max(0,Math.ceil((nextPromptAt-Date.now())/1000))} s 後整理`:'手動產生';
  for(const id of ['make-prompt','copy-prompt','download-prompt']){
    $(id).disabled=!valid || (id!=='make-prompt'&&!lastPrompt);
  }
  if(!valid&&lastPrompt){lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='資料已中斷，請重新接收後整理摘要。';}
}
for(const id of ['demo','live','replay'])$(id).onclick=()=>selectInput(id);
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
    stop();stream.reset();states=null;wormTrace=null;wormCursor=null;wormStates=null;history=[];connection.connect(text);paused=false;
  }catch(error){notice(error.message);}
};
$('disconnect').onclick=()=>{stop();update();};
$('record').onclick=()=>{recording=!recording;update();};
function recordingValue(){return {schemaVersion:'neural-resonance-recording-v1',networkVersion:NETWORK_VERSION,
  wormVersion:WORM_VERSION,wormPresentation:{space:$('worm-space').value,
    windowSeconds:Number($('worm-window').value),smoothingSeconds:Number($('worm-smoothing').value),
    selectedElement:ELEMENTS[selected][0]},creativePlan:{
      selected:$('music-plan').value,rules:planRules?structuredClone(planRules):null,
    },recordedAt:new Date().toISOString(),snapshots:records};}
function download(name,data,type='application/json'){
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick=()=>download(`neural-eeg-${Date.now()}.json`,JSON.stringify(recordingValue(),null,2));
$('csv-export').onclick=()=>{
  download(`neural-eeg-${Date.now()}.csv`,spreadsheetCsv(records),'text/csv;charset=utf-8');
};
$('planar-record').onclick=()=>$('record').click();
$('planar-export').onclick=()=>$('export').click();
$('planar-csv').onclick=()=>$('csv-export').click();
let lastPrompt=null,nextPromptAt=0;
function invalidatePrompt(){lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='等待產生';update();}
$('prompt-model').onchange=invalidatePrompt;
$('prompt-window').onchange=invalidatePrompt;
$('prompt-auto').onchange=()=>{
  nextPromptAt=$('prompt-auto').checked?Date.now()+60000:0;
  if($('prompt-auto').checked)$('prompt-window').value='60';
  $('prompt-window').disabled=$('prompt-auto').checked;invalidatePrompt();
};
$('make-prompt').onclick=()=>{
  try{
    lastPrompt=createMusicPrompt(history,{current:stream.current(),target:$('prompt-model').value,
      windowSeconds:Number($('prompt-window').value),
      musicPlan:resolvePlan(stream.current(),{manualId:$('music-plan').value,rules:planRules})});
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
  if(lastPrompt&&stream.current()?.valid)download(`neural-observation-summary-${Date.now()}.json`,JSON.stringify(lastPrompt,null,2));
};
async function loadRecording(file){
  if(!file)return;
  const request=++recordingLoadEpoch;
  stop();replay=null;replayIndex=0;history=[];wormTrace=null;liveIdentity=null;
  $('replay-start').disabled=true;$('replay-info').textContent='讀取記錄';update();
  try{if(file.size>20*1024*1024)throw new Error('請使用 20 MB 以内的記錄。');
    const parsed=parseRecording(await file.text());if(request!==recordingLoadEpoch)return;
    replay=parsed;$('replay-start').disabled=false;$('replay-info').textContent=`${replay.snapshots.length} 個樣本`;
    update();
  }catch(error){if(request===recordingLoadEpoch){$('replay-info').textContent='記錄不可用';notice(error.message);update();}}
}
$('replay-file').onchange=()=>loadRecording($('replay-file').files[0]);
function replayNext(){
  if(!replay||replayIndex>=replay.snapshots.length){stream.reset();rawAmplitude.reset();paused=true;$('status').textContent='回放完成';update();return;}
  const packet=replay.snapshots[replayIndex++];
  ingest(replayPacket(packet,Date.now(),replayRun));
  const next=replay.snapshots[replayIndex];timer=setTimeout(replayNext,next?Math.max(1,(next.ts-packet.ts)*1000):300);
}
$('replay-start').onclick=()=>{if(!replay)return;stop();if(replayIndex>=replay.snapshots.length)replayIndex=0;replayRun=`replay:${crypto.randomUUID()}`;paused=false;$('status').textContent='記錄回放';replayNext();};
$('replay-stop').onclick=()=>{stop();$('status').textContent='回放已暫停';update();};
function setView(next){
  if(!['waveforms','worm','settings'].includes(next))next='settings';
  view=next;
  for(const name of ['waveforms','worm','settings'])$(`view-${name}`).hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  const title={waveforms:'波形捕獲',worm:'音樂與神經響應',settings:'設備設定'}[view];
  $('page-title').replaceChildren(document.createTextNode(title),Object.assign(document.createElement('span'),{textContent:{waveforms:'EEG / LIVE SIGNAL',worm:'音樂參考 · 現場響應 · 版本實驗',settings:'DEVICE / INTERFACES'}[view]}));
  if(view==='settings')capabilities();
  if(view==='settings')refreshGateway();
}
function setAnalysisLayer(next){
  analysisLayer=next==='blackbox'?'blackbox':'whitebox';
  const panel=$('view-waveforms');
  panel.dataset.analysisLayer=analysisLayer;
  $('analysis-whitebox').setAttribute('aria-pressed',String(analysisLayer==='whitebox'));
  $('analysis-blackbox').setAttribute('aria-pressed',String(analysisLayer==='blackbox'));
  $('wave-title').textContent=analysisLayer==='blackbox'?'設備指數與結果趨勢':'原始腦電與頻段功率';
  $('analysis-layer-note').textContent=analysisLayer==='blackbox'
    ?'設備原生指數與時間趨勢；來源、接觸狀態與資料有效性持續顯示。'
    :'原始樣本、單位、采樣率與缺失斷點；設備內部指數算法仍未公開。';
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{location.hash=button.dataset.view;});
$('analysis-whitebox').onclick=()=>setAnalysisLayer('whitebox');
$('analysis-blackbox').onclick=()=>setAnalysisLayer('blackbox');
window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));
for(const id of ['worm-space','worm-window','worm-smoothing'])$(id).onchange=()=>{wormTrace=null;update();};
$('worm-follow').onchange=update;
$('worm-cursor').oninput=()=>{
  $('worm-follow').checked=false;
  wormCursor=wormTrace?.points[Number($('worm-cursor').value)]?.timestamp??null;update();
};
$('hero').onpointerdown=event=>{
  const points=wormTrace?.points;if(!points?.length)return;
  const bounds=$('hero').getBoundingClientRect(),viewport=wormViewport(bounds.width,bounds.height);
  const x=(event.clientX-bounds.left-viewport.left)/viewport.size;
  const y=1-(event.clientY-bounds.top-viewport.top)/viewport.size;
  const p=points.reduce((best,p)=>!best||Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best,null);
  $('worm-follow').checked=false;wormCursor=p.timestamp;update();
};
$('worm-export').onclick=()=>{
  if(!wormTrace?.points.length)return;
  const a=document.createElement('a');a.href=$('hero').toDataURL('image/png');a.download=`neural-worm-${Date.now()}.png`;a.click();
};
function drawRaw(){
  const data=drawRawWaveform($('raw-wave'),rawWaveform,{seconds:Number($('raw-window').value),extent:Number($('raw-scale').value)});
  if(!data)return;
  $('raw-status').textContent=data.rows.length?`${data.rows.length} 樣本 · ${data.unit} · 聲明Fs ${data.rate??'未回報'} Hz${$('raw-wave').dataset.stale==='true'?' · 歷史／已中斷':''}`:'等待原始樣本';
  $('raw-detail').textContent=data.stats?`末段 ${data.stats.samples} 樣本 · 去均值RMS ${data.stats.rms.toPrecision(6)} · 峰峰 ${data.stats.peakToPeak.toPrecision(6)} · 已知序號缺失 ${data.dropped} · 協議斷點 ${data.discontinuities}（丟失樣本數未知） · ${Number($('raw-wave').dataset.gainPxPerUnit).toPrecision(4)} px/單位`:'';
}
for(const [id,mask] of [['wave-snapshot',false],['mask-snapshot',true]])$(id).onclick=()=>{
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1920,1080);if(!mask){ctx.fillStyle='#0c1117';ctx.fillRect(0,0,1920,1080);}
  const keys=waveKeys.filter(key=>!$(`wave-${key}`).parentElement.hidden);
  for(let i=0;i<keys.length;i++)drawWaveforms(canvas,history,keys[i],Date.now(),{mask:true,row:i,rows:keys.length,baseline:$('band-display').value==='baseline'});
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`neural-${mask?'mask':'waveforms'}-${Date.now()}.png`;a.click();
};
const devices=new BrowserDeviceInput({onPacket:ingest,onStatus:text=>{$('device-status').textContent=text;}});
let gatewayConfig=null,gatewayApiAvailable=false,gatewaySelectionDirty=false;
for(const id of ['gateway-eeg-select','gateway-oxygen-select','gateway-ble-select'])
  $(id).addEventListener('change',()=>{gatewaySelectionDirty=true;});
async function refreshGateway(){
  if(!gatewayApiAvailable)return;
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
    if(!data.devices.length)$('gateway-inventory').textContent='尚未發現串口設備；插入後會自動識別。';
    if(gatewaySelectionDirty)return;
    for(const [key,id] of [['eeg','gateway-eeg-select'],['bloodOxygen','gateway-oxygen-select']]){
      const select=$(id),profile=data.config[key];
      select.replaceChildren(new Option('自動 · 唯一型號匹配','{}'));
      for(const option of identityOptions(data.devices,profile,{allUsb:true}))select.add(new Option(option.label,option.value));
      const registered=JSON.stringify({serialNumber:profile.serialNumber||'',location:profile.location||'',vid:profile.vid,pid:profile.pid});
      if((profile.serialNumber||profile.location)&&![...select.options].some(o=>o.value===registered))
        select.add(new Option(`已保存 · ${profile.serialNumber||profile.location}`,registered));
      if([...select.options].some(o=>o.value===registered))select.value=registered;
    }
    const bluetooth=$('gateway-ble-select');
    bluetooth.replaceChildren(new Option('自動識別唯一相容設備',''));
    const known=data.bleDevices??[];
    for(const device of known)bluetooth.add(new Option(`${device.name} · ${device.address}`,device.address));
    if(data.config.ble.address&&!known.some(device=>device.address===data.config.ble.address))
      bluetooth.add(new Option(data.config.ble.address,data.config.ble.address));
    bluetooth.value=data.config.ble.address??'';
    $('gateway-save').disabled=Boolean(data.upstream);
    $('gateway-message').textContent=data.upstream
      ?'目前復用既有音療核心，其设备身份由核心配置管理；獨立模式可在此保存。'
      :'按USB身份識別；COM號或macOS設備路径改變後自動重連。';
  }catch(error){$('gateway-message').textContent=`設備清單暫不可用：${error.message}`;}
}
$('gateway-refresh').onclick=()=>{gatewaySelectionDirty=false;refreshGateway();};
$('gateway-save').onclick=async()=>{
  if(!gatewayConfig)return;
  try{
    const next={...gatewayConfig,
      eeg:selectedProfile(gatewayConfig.eeg,$('gateway-eeg-select').value),
      bloodOxygen:selectedProfile(gatewayConfig.bloodOxygen,$('gateway-oxygen-select').value),
      ble:{...gatewayConfig.ble,address:$('gateway-ble-select').value}};
    const response=await fetch('/api/gateway/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gatewaySelectionDirty=false;
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
      ?`${state.gateway==='core-proxy'?'既有核心':'獨立采集器'}運行中 · ${core.eegSource==='none'?'尚未收到有效腦波':`來源 ${core.eegSource}`} · USB ${core.ports?.brainlink||'未識別'} · 血氧 ${core.ports?.bloodOxygen||'未識別'}`
      :'核心未運行；接口保持重連。';
    $('health-result').textContent=JSON.stringify({core:state.core,devices:state.devices,checkedAt:state.checkedAt},null,2);
    if(view==='settings'){
      await refreshGateway();
      $('gateway-message').textContent=deviceDiagnostic(state.devices).join('；');
    }
  }catch{$('runtime-summary').textContent='本機橋接器暫不可用；等待接口恢復。';}
}
function capabilities(){
  const data=[['執行環境',isSecureContext?'安全來源':'非安全來源：硬體 API 可能不可用'],
    ['USB / Web Serial',navigator.serial?'瀏覽器接口可用':'此瀏覽器未提供接口'],
    ['BLE / Web Bluetooth',navigator.bluetooth?'瀏覽器接口可用':'此瀏覽器未提供接口'],
    ['設備驅動','由作業系統管理']];
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
  try{const file=$('settings-file').files[0];if(!file)return;if(file.size>100000)throw new Error('設定檔過大。');applySettings(parseUtf8Json(await file.text()));notice('已匯入設定；連線需手動開啟。');}
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
  if(view==='worm'&&$('hero').offsetParent!==null){
    drawWorm($('hero'),history,time,{space:$('worm-space').value,active:Boolean(valid),reduced:reduceMotion,
      trace:wormTrace,layer:wormStates?.[selected],cursorTimestamp:wormCursor});
  }
  if(view==='waveforms'){
    drawIndices($('indices-wave'),history);
    if(analysisLayer==='whitebox'){
      for(const key of waveKeys)if(!$(`wave-${key}`).parentElement.hidden)drawWaveforms($(`wave-${key}`),history,key,Date.now(),{baseline:$('band-display').value==='baseline'});
      drawRaw();
    }
  }
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
  gatewayApiAvailable=config.gatewayApi;
  if(gatewayApiAvailable)$('gateway-open').href=new URL('/',location.href).href;
  $('endpoint').value=config.endpoint;setMode(config.startupMode);
  try{const local=localStorage.getItem('neural-resonance-settings');if(local)applySettings(JSON.parse(local));}catch{/* Bad saved settings do not prevent startup. */}
  // The local integration owns its endpoint; an old saved remote address must
  // not redirect automatic startup away from the current same-origin core.
  if(config.startupMode==='live'&&config.autoConnect)$('endpoint').value=config.endpoint;
  setView(location.hash.slice(1));
  setAnalysisLayer('whitebox');
  if(config.startupMode==='live'&&config.autoConnect)$('connect').click();
  if(config.startupMode==='live'&&config.autoConnect){
    $('health-url').value=new URL('/api/runtime',location.href).href;
    refreshRuntime();runtimeTimer=setInterval(refreshRuntime,5000);
  }
}
initialize();
const closeNavigation=()=>{document.body.classList.remove('nav-open');$('nav-toggle').setAttribute('aria-expanded','false');};
$('nav-toggle').onclick=()=>{
  const open=document.body.classList.toggle('nav-open');
  $('nav-toggle').setAttribute('aria-expanded',String(open));
};
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',closeNavigation));
function setExhibit(enabled){
  document.body.classList.toggle('exhibit',enabled);
  $('worm-exhibit').textContent=enabled?'返回':'展示';
}
$('worm-exhibit').onclick=()=>setExhibit(!document.body.classList.contains('exhibit'));
window.addEventListener('keydown',event=>{if(event.key==='Escape'){setExhibit(false);closeNavigation();}});
for(const id of ['music-source','music-plan'])$(id).onchange=()=>{invalidatePrompt();update();};
$('plan-rules-file').onchange=async()=>{
  try{
    const file=$('plan-rules-file').files[0];if(!file)return;
    if(file.size>65536)throw new Error('規則檔需小於64 KB。');
    planRules=parsePlanRules(await file.text());invalidatePrompt();update();
  }catch(error){notice(error.message);}
};
$('plan-rules-clear').onclick=()=>{planRules=null;$('plan-rules-file').value='';invalidatePrompt();update();};
