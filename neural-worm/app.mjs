import {StreamState,LiveConnection,demoSnapshot,parseRecording,validateRecording,backfilledSnapshots} from '../src/eeg.mjs';
import {DEFAULT_CONFIG,normalizeConfig,demoValues} from '../src/config.mjs';
import {ELEMENTS} from '../src/music.mjs';
import {networkStates,NETWORK_VERSION} from '../src/neural-networks.mjs';
import {SOURCES} from '../src/research-sources.mjs';
import {drawWaveforms,drawWorm,drawComparison,COMPARISON_PANELS,wormViewport} from '../src/waveform-view.mjs';
import {resolvePlan,parsePlanRules} from '../src/music-plan.mjs';
import {captureSnapshot,spreadsheetCsv,replayPacket,normalizeDeviceId,deviceIdNeedsNormalizing} from '../src/recording.mjs';
import {decodeTgamBytes} from '../src/raw-tgam.mjs';
import {decodeTgamContainer} from '../src/tgam-container.mjs';
import {createMusicPrompt} from '../src/prompt.mjs';
import {SensorState} from '../src/sensors.mjs';
import {identityOptions,selectedProfile,deviceDiagnostic,liveAcquisitionStatus,deviceLabel,bleDiagnostic,acquisitionHeadline,runtimeSummary,shortDeviceName,derivedDeviceLabel,detectedDevice} from '../src/gateway-settings.mjs';
import {replaySpan,replayPosition,formatClock,formatBytes} from '../src/replay-player.mjs';
import {buildWormTrace,WORM_VERSION} from '../src/worm-model.mjs';
import {mountResearch} from './planar-workbench.mjs';
import {RawAmplitude} from '../src/amplitude-model.mjs';
import {BAND_NOTES,NATIVE_BANDS} from '../src/derived-indices.mjs';
import {initI18n, t, onLanguageChange, getLanguage} from '../src/i18n.mjs';
import {observationNow} from '../src/stream-clock.mjs';
const $=id=>document.getElementById(id),stream=new StreamState();
const sensors=new SensorState();
const rawAmplitude=new RawAmplitude();
const english=['MELODY','RHYTHM','HARMONY','DYNAMICS','TEMPO','MODE','FORM','TEXTURE','TIMBRE','ARTICULATION'];
let mode='demo',tick=0,timer=null,selected=0,states=null,recording=false,records=[],frame=0,time=0,paused=false,leaving=false;
let view='waveforms',history=[],replay=null,replayIndex=0,recordBytes=0;
// The player's own state: what is loaded, where the playhead is, whether it is
// running. Kept beside `replay` because a recording is a tape with a position,
// not just an array of packets.
let replayFileName='',replayBytes=0,replayPlaying=false,replayPaintAt=0,replayAnchor=null;
let liveIdentity=null,replayRun=null,recordingLoadEpoch=0;
let eegDeviceId='';
// The label has two possible sources: what a person stored, and what the
// collector detected. Detection only ever fills an empty label; once a name is
// stored it is the recording's name until a person changes it, because swapping
// the hardware (Bluetooth dropping to the USB cable, say) must not rename files
// that are about to be written. `eegLabelEdited` keeps a deliberate name from
// being overwritten by the two-second rescan while it is still being typed.
let eegLabelAuto='',eegLabelEdited=false;
// The collector names the file from its own config, not from this input, so an
// auto-filled name that is never written through would leave the panel promising
// eeg-HR-S0AA758-… while the file on disk says eeg-unknown-device-…. These track
// what has actually been written, so the status line can tell the truth.
// `eegLabelWritten` is the name we wrote ourselves: a value that is neither empty
// nor ours is a human's name and is never overwritten silently.
let eegLabelWritten='',eegLabelWriting='',eegLabelFailed='';
let connectionState='stopped';
let monitorRows=[],monitorFeedDirty=true,
  monitorFeedReset=true,monitorLastPacketCount=null;
let monitorIndices={attention:null,relaxation:null,at:null};
let wormTrace=null,wormCursor=null,wormStates=null;
let planRules=null,currentPlan=null;
const research=mountResearch($('research-worm'),{
  onMode:value=>selectInput(value),
  onWindow:seconds=>{$('worm-window').value=String(seconds);wormTrace=null;update();},
  onImport:file=>loadRecording(file),
  onReplay:()=>toggleReplay(),
});
const waveKeys=[...NATIVE_BANDS];
function renderBandCards(){
  $('wave-grid').replaceChildren(...waveKeys.map(key=>{
    const note=BAND_NOTES[key];
    const cell=document.createElement('section');cell.className='wave-chart';
    cell.innerHTML=`<div><h3>${t(note.title)}<small id="wave-range-${key}"></small></h3><span id="wave-value-${key}">—</span></div><p class="band-note">${t(note.definition)}</p><p class="band-note band-note-prefrontal">${t(note.prefrontal)}</p><canvas id="wave-${key}" aria-label="${t(note.title)} 頻段的時間波形"></canvas>`;
    return cell;
  }));
}
renderBandCards();
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
  const status=view==='settings'&&connectionState==='stopped'&&!current
    ?{state:'waiting',text:'等待腦電設備'}
    :liveAcquisitionStatus(current,connectionState,{running:gatewayRunning});
  $('status').textContent=t(status.text);$('status').dataset.state=status.state;
}
function smoothMonitorIndices(snapshot){
  if(!snapshot.valid)return;
  const previous=monitorIndices,elapsed=previous.at===null?0:snapshot.timestamp-previous.at;
  if(previous.at===null||elapsed<=0||elapsed>3000){
    monitorIndices={attention:snapshot.attention,relaxation:snapshot.relaxation,at:snapshot.timestamp};
    return;
  }
  const alpha=1-Math.exp(-elapsed/1000);
  monitorIndices={
    attention:previous.attention+(snapshot.attention-previous.attention)*alpha,
    relaxation:previous.relaxation+(snapshot.relaxation-previous.relaxation)*alpha,
    at:snapshot.timestamp,
  };
}
function updateDeviceMonitor(current=stream.current()){
  const fresh=current?.transportFresh;
  $('monitor-state').textContent=current
    ?t(fresh?'正在接收資料':'資料流已中斷')
    :t('等待設備資料');
  $('monitor-packets').textContent=String(current?.packets??0);
  $('monitor-indices').textContent=fresh&&current.valid&&monitorIndices.attention!==null
    ?`${Math.round(monitorIndices.attention)} / ${Math.round(monitorIndices.relaxation)}`:'— / —';
  $('monitor-quality').textContent=fresh
    ?t(current.signalQuality==='good'?'良好':current.signalQuality==='poor'?'接觸不良':'未知'):'—';
  if(!monitorFeedDirty)return;
  monitorFeedDirty=false;
  const feed=$('stream-feed');
  if(!monitorRows.length&&monitorFeedReset){
    const empty=document.createElement('li');empty.className='stream-empty';empty.textContent=t('尚未收到 EEG 封包');
    feed.replaceChildren(empty);return;
  }
  const makeRow=entry=>{
    const row=document.createElement('li'),timeLabel=document.createElement('time'),
      content=document.createElement('div'),details=document.createElement('code');
    content.className='stream-feed-content';
    row.dataset.bucket=String(entry.bucket);timeLabel.dateTime=new Date(entry.bucket).toISOString();
    timeLabel.textContent=new Date(entry.bucket).toLocaleTimeString(
      getLanguage()==='en'?'en-US':getLanguage()==='zh-Hant'?'zh-TW':'zh-CN',
      {hour12:false,fractionalSecondDigits:3});
    const bands=Object.entries(entry.bands).map(([key,value])=>`${key}:${value}`);
    const rawValues=entry.rawSamples;
    const fields=[`${t('來源')} ${entry.transport}`,`${t('封包')} ${entry.frames}`,
      `${t('專注度')} ${entry.attention??'—'}`,`${t('放鬆度')} ${entry.relaxation??'—'}`,
      entry.poorSignal===null?'':`${t('接觸')} ${entry.poorSignal}`,...bands].filter(Boolean);
    details.textContent=fields.join(' · ');
    content.append(details);
    if(rawValues.length){
      const rawDetails=document.createElement('code');
      rawDetails.className='stream-feed-raw';
      rawDetails.textContent=`${t('原始樣本')} ${entry.rawSampleCount} ${entry.rawUnit} [${rawValues.slice(-8).join(', ')}]`;
      content.append(rawDetails);
    }
    row.append(timeLabel,content);return row;
  };
  if(monitorFeedReset){
    feed.replaceChildren(...monitorRows.map(makeRow));
    monitorFeedReset=false;
  }else{
    const latest=monitorRows.at(-1);
    if(latest){
      const last=feed.lastElementChild;
      if(last?.dataset.bucket===String(latest.bucket))last.replaceWith(makeRow(latest));
      else feed.append(makeRow(latest));
      while(feed.children.length>monitorRows.length)feed.firstElementChild.remove();
    }
  }
  feed.scrollTop=feed.scrollHeight;
}
function notice(text){$('notice').textContent=text;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,5000);}
/**
 * The instant a packet's readings were measured, not the instant it arrived.
 *
 * A raw ThinkGear stream delivers some 512 frames per second, but eSense and
 * band power only refresh about once a second: dozens of frames carry the very
 * same measurement. This key lets the history keep one point per measurement
 * instead of one per frame — the difference between a 60 s window and the twelve
 * seconds of it that used to survive a replay.
 */
function readingStamp(snapshot){
  const clock=snapshot?.raw?.originalFieldTimestamps??snapshot?.raw?.fieldTimestamps;
  const band=clock?.delta??clock?.lowAlpha;
  return snapshot?.indexSampleKey&&Number.isFinite(band)?`${snapshot.indexSampleKey}|${band}`:null;
}
function ingest(packet,{capture=true,now=Date.now()}={}){
  try{
    const buffered=backfilledSnapshots(packet.history,now);
    delete packet.history;
    if(!stream.accept(packet,now))return;
    sensors.accept(packet,now);
    const snapshot=stream.current(now);
    const transport=snapshot.transport==='none'&&liveIdentity?JSON.parse(liveIdentity)[2]:snapshot.transport;
    const identity=buffered.points.length?buffered.identity
      :JSON.stringify([snapshot.source,snapshot.sessionId,transport,snapshot.connectionEpoch]);
    if(identity!==liveIdentity){history=[];states=null;wormTrace=null;wormCursor=null;monitorRows=[];monitorFeedDirty=true;monitorFeedReset=true;monitorLastPacketCount=null;monitorIndices={attention:null,relaxation:null,at:null};liveIdentity=identity;}
    if(buffered.points.length){
      const known=new Set(history.map(p=>p.indexSampleKey));
      history=buffered.points.filter(p=>!known.has(p.indexSampleKey)).concat(history);
    }
    snapshot.amplitude=rawAmplitude.push(snapshot);
    smoothMonitorIndices(snapshot);
    const nextStates=networkStates(snapshot);
    if(nextStates)states=nextStates;
    // One measurement, one point. Frames that merely repeat the previous reading
    // extend nothing, so they are not appended; the cap below is only a guard
    // against a source whose fields never hold still.
    const stamp=readingStamp(snapshot);
    if(stamp===null||readingStamp(history[history.length-1])!==stamp)history.push(snapshot);
    history=history.filter(p=>p.timestamp>=Date.now()-60000).slice(-2048);
    if(recording&&capture){
      const entry=captureSnapshot(packet,snapshot,states);
      entry.creativeIntent=resolvePlan(snapshot,{manualId:$('music-plan').value,rules:planRules});
      const size=new TextEncoder().encode(JSON.stringify(entry)).byteLength;
      if(records.length>=20000||recordBytes+size>20*1024*1024){recording=false;notice('記錄已達容量上限，請匯出。');}
      else{records.push(entry);recordBytes+=size;}
    }
    const bucket=Math.floor(snapshot.timestamp/100)*100,eeg=packet.eeg??{};
    // The collector sends heartbeats with transport "none" and an empty eeg
    // object. This panel documents that it only shows protocol-validated EEG,
    // so a heartbeat must not become an acquisition row.
    const carriesEeg=['attention','meditation','delta','theta','lowAlpha','highAlpha',
      'lowBeta','highBeta','lowGamma','midGamma'].some(key=>Number.isFinite(eeg[key]));
    if(carriesEeg){
      let row=monitorRows.at(-1);
      if(!row||row.bucket!==bucket){
        row={bucket,frames:0,attention:snapshot.attention,relaxation:snapshot.relaxation,
          poorSignal:Number.isFinite(eeg.poor_signal)?eeg.poor_signal:null,bands:{},
          rawSamples:[],rawSampleCount:0,rawUnit:packet.rawUnit??'',transport:
            packet.transport==='browser_usb'?'USB':packet.transport==='browser_ble'?'BLE'
              :packet.source==='core'?t('本機採集器'):(packet.transport??packet.source??t('未知'))};
        monitorRows.push(row);
        if(monitorRows.length>300)monitorRows.shift();
      }
      const packetCount=packet.quality?.eegPackets;
      row.frames+=Number.isSafeInteger(packetCount)&&monitorLastPacketCount!==null
        ?Math.max(0,packetCount-monitorLastPacketCount):1;
      if(Number.isSafeInteger(packetCount))monitorLastPacketCount=packetCount;
      row.attention=snapshot.attention;row.relaxation=snapshot.relaxation;
      if(Number.isFinite(eeg.poor_signal))row.poorSignal=eeg.poor_signal;
      for(const key of ['delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma'])
        if(Number.isFinite(eeg[key]))row.bands[key]=eeg[key];
      const samples=packet.rawEegSamples??packet.eeg?.rawSamples??[];
      row.rawSampleCount+=samples.length;row.rawSamples.push(...samples);
      if(row.rawSamples.length>256)row.rawSamples.splice(0,row.rawSamples.length-256);
      monitorFeedDirty=true;
    }
  }catch(error){notice(error.message);}
}
function stop(){clearInterval(timer);clearTimeout(timer);timer=null;connection.stop();stream.reset();sensors.reset();rawAmplitude.reset();paused=true;}
function emit(){
  const values=demoValues(Number($('attention').value),Number($('relaxation').value),tick,$('auto').checked);
  ingest(demoSnapshot(values.attention,values.relaxation,tick++));
}
function startDemo(){
  stop();mode='demo';paused=false;history=[];const now=observationNow();
  for(let i=0;i<120;i++){
    const ts=now-(120-i)*500,v=demoValues(Number($('attention').value),Number($('relaxation').value),tick,$('auto').checked);
    ingest(demoSnapshot(v.attention,v.relaxation,tick++,ts),{capture:false,now:ts});
  }
  emit();timer=setInterval(emit,250);$('pause').textContent='暫停示範';
}
function setMode(value){
  lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='等待產生';
  nextPromptAt=$('prompt-auto').checked?Date.now()+60000:0;
  stop();mode=value;states=null;wormTrace=null;wormCursor=null;time=0;history=[];
  for(const id of ['demo','live','replay']){$(`${id}-input`).hidden=id!==mode;$(id).setAttribute('aria-pressed',String(id===mode));}
  $('source').textContent=mode.toUpperCase();
  $('status').dataset.state='waiting';
  $('source-note').textContent=mode==='demo'?'合成示範':mode==='replay'?t('記錄回放'):'即時接入';
  $('status').textContent=mode==='demo'?'示範資料':mode==='replay'?t('等待記錄'):'等待資料源';if(mode==='demo')startDemo();update();
}
function selectInput(value){
  // The synthetic demo has no place in a research console: a feed that looks
  // measured but is generated cannot be told apart once it reaches the charts.
  if(value==='demo')return;
  if(value===mode&&!paused)return;
  setMode(value);
  if(value==='live')$('connect').click();
}
function update(){
  const current=stream.current(),valid=current?.valid;
  if(mode==='live')showLiveStatus(current);
  const sensorValues=sensors.current();
  for(const key of ['spo2','pr','hrv','gsr']){
    const output=$(`sensor-${key}`);
    if(!output)continue;
    output.textContent=sensorValues[key].valid?String(sensorValues[key].value):'—';
    output.parentElement.hidden=!sensorValues[key].valid;
  }
  $('sensor-pr-label').textContent=sensorValues.pr.source==='watch'?'手表心率':'脈率';
  for(const [key,value] of Object.entries(current?.latestIndices??{attention:null,relaxation:null})){
    const available=current?.signalValid&&Number.isFinite(value)&&(current.metricOrigin!=='thinkgear-esense'||value>0);
    $(`read-${key}`).textContent=available?Math.round(value):'—';
    $(`gauge-${key}`).style.setProperty('--progress',`${available?value*3.6:0}deg`);
  }
  $('packets').textContent=current?.packets??'—';
  $('freshness').textContent=t(valid?'有效資料':current?.transportFresh&&!current.signalValid?(current.signalQuality==='unknown'?'接觸品質未確認':'接觸不良'):
    current?.signalValid?'缺少設備指數':!gatewayRunning&&mode==='live'?'采集已停止':'等待 / 暫停');
  $('count').textContent=`${records.length} ${t('個樣本')}`;$('record').textContent=t(recording?'停止記錄':'開始記錄');
  updateDeviceMonitor(current);
  $('planar-count').textContent=$('count').textContent;$('planar-record').textContent=$('record').textContent;
  $('planar-export').disabled=$('planar-csv').disabled=!records.length;
  $('export').disabled=!records.length;
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
    ?`${((selectedPoint.timestamp-points[0].timestamp)/1000).toFixed(1)} / ${stats.seconds.toFixed(1)} s`:t('等待樣本');
  $('worm-center').textContent=$('worm-space').value==='control'?t('坐標換算 · 中心 64, 64'):t('原生指數 · 中心 50, 50');
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
    :t('接收有效指數後呈現起點、終點和變化。');
  const planMode=$('music-source').value==='plan';
  $('plan-select-label').hidden=!planMode;
  $('music-plan').disabled=Boolean(planRules);
  $('plan-rules-clear').hidden=!planRules;
  $('selected-name').replaceChildren(document.createTextNode(t('專注 × 冥想／放鬆 ')),
    Object.assign(document.createElement('span'),{textContent:'NATIVE INDEX TRACE'}));
  $('selected-value').textContent=t(valid?'有效':points.length?'暫停':'等待');$('selected-unit').textContent=t('資料狀態');
  $('density').textContent=t(sourceNames[current?.source]||'—');
  $('dispersion').textContent=Number($('worm-smoothing').value)===0?t('原始位置'):`${$('worm-smoothing').value} s · ${t('僅顯示')}`;
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
  // Without a feed every card is text-only; say why instead of looking broken.
  const hasBands=history.some(point=>Number.isFinite(point.spectralBands?.delta));
  if($('wave-empty'))$('wave-empty').hidden=hasBands;
  for(const key of waveKeys){
    const value=current?.spectralBands?.[key];
    $(`wave-value-${key}`).textContent=current?.transportFresh&&Number.isFinite(value)?value.toFixed(2):'—';
    $(`wave-${key}`).parentElement.hidden=!history.some(p=>Number.isFinite(p.spectralBands?.[key]));
  }
  // Device- or gateway-supplied unit labels pass through untranslated; the two
  // built-in defaults are translated so the badge follows the language switch.
  $('wave-units').textContent=t(current?.raw?.bandUnits||(current?.source==='demo'?'示範頻段值':''))||'—';
  for(const key of waveKeys){
    const range=current?.raw?.bandRanges?.[key];
    $(`wave-range-${key}`).textContent=range?` ${range[0]}–${range[1]} Hz`:'';
  }
  if(mode==='live'&&current){
    $('signal-transport').textContent=current.raw.transport==='none'?'等待有效包':current.raw.transport||'外部接口';
    $('signal-age').textContent=Number.isFinite(current.raw.lastSampleAt)?`${Math.max(0,observationNow()/1000-current.raw.lastSampleAt).toFixed(1)} s`:'—';
    $('signal-raw-count').textContent=current.raw.rawSequence??'—';
    $('signal-contact').textContent=!current.transportFresh?'未回報':
      current.signalQuality==='good'?'良好':
      current.signalQuality==='poor'?`接觸 ${current.poorSignal}`:'未回報';
  }else{
    for(const id of ['signal-transport','signal-age','signal-raw-count','signal-contact'])$(id).textContent=mode==='demo'?'示範':'—';
  }
  if($('prompt-auto').checked&&nextPromptAt&&observationNow()>=nextPromptAt){
    nextPromptAt=observationNow()+60000;
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
    ?`${Math.max(0,Math.ceil((nextPromptAt-observationNow())/1000))} s 後整理`:'手動產生';
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
function downloadCsv(){download(`neural-eeg-${Date.now()}.csv`,spreadsheetCsv(records),'text/csv;charset=utf-8');}
$('planar-record').onclick=()=>$('record').click();
$('planar-export').onclick=()=>$('export').click();
$('planar-csv').onclick=downloadCsv;
let lastPrompt=null,nextPromptAt=0;
function invalidatePrompt(){lastPrompt=null;$('music-prompt').value='';$('prompt-status').textContent='等待產生';update();}
$('prompt-model').onchange=invalidatePrompt;
$('prompt-window').onchange=invalidatePrompt;
$('prompt-auto').onchange=()=>{
  nextPromptAt=$('prompt-auto').checked?observationNow()+60000:0;
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
  replayPlaying=false;replayFileName=file.name;replayBytes=file.size;
  $('history-info').textContent=t('讀取歷史記錄');
  paintReplay(true);update();
  try{
    let parsed;
    if(file.name.toLowerCase().endsWith('.tgam')){
      parsed=await decodeTgamFile(file);
    }else{
      if(file.size>20*1024*1024)throw new Error('請使用 20 MB 以内的記錄。');
      parsed=parseRecording(await file.text());
    }
    if(request!==recordingLoadEpoch)return;
    replay=parsed;
    paintReplay(true);update();
  }catch(error){if(request===recordingLoadEpoch){
    replayFileName='';replayBytes=0;
    $('history-info').textContent=t('歷史記錄不可用');
    paintReplay(true);notice(error.message);update();
  }}
}
/**
 * The player panel: one place that decides what the transport looks like.
 *
 * Written as a paint function rather than four scattered assignments so the
 * buttons, the scrubber and the clock can never disagree about whether a file
 * is loaded or whether it is running.
 */
function paintReplay(force=false){
  const now=Date.now();
  // Replay pushes a packet per recorded packet (hundreds per second); painting
  // the transport that often would compete with the charts.
  if(!force&&now-replayPaintAt<200)return;
  replayPaintAt=now;
  const position=replayPosition(replay?.snapshots,replayIndex);
  const seek=$('replay-seek');
  seek.max=String(position.count);
  seek.value=String(position.position);
  seek.disabled=!position.count;
  seek.style.setProperty('--played',`${Math.round(position.ratio*100)}%`);
  const loaded=position.count>0;
  $('replay-play').disabled=!loaded;
  $('replay-play').textContent=t(replayPlaying?'暫停':'播放');
  $('replay-play').setAttribute('aria-pressed',String(replayPlaying));
  $('replay-stop').disabled=!loaded;
  $('replay-clock').textContent=position.clock;
  if(!replay)return;
  // Identity first: a session is filed under its device label, and the size is
  // how an operator tells two takes of the same length apart.
  $('history-info').textContent=[
    replayFileName||t('已載入記錄'),
    replay.deviceId||'unknown-device',
    `${position.count} ${t('個樣本')}`,
    formatBytes(replayBytes),
  ].filter(Boolean).join(' · ');
}
async function decodeTgamFile(file){
  if(file.size>100*1024*1024)throw new Error('TGAM 記錄大於 100 MB，請分段匯入。');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {metadata}=decodeTgamContainer(bytes);
  // Current files are eeg-<label>-<stamp>; the older <label>-eeg-<stamp> is still
  // read so a folder recorded before the rename keeps its start times.
  const nameMatch=file.name.match(
    /^(?:eeg-(?<current>.*)|(?<legacy>.*)-eeg)-(?<y>\d{4})(?<mo>\d{2})(?<d>\d{2})-(?<h>\d{2})(?<mi>\d{2})(?<s>\d{2})/i);
  const stamp=nameMatch?.groups;
  const startedAt=metadata?.startedAt?Date.parse(metadata.startedAt):stamp
    ?new Date(Number(stamp.y),Number(stamp.mo)-1,Number(stamp.d),
      Number(stamp.h),Number(stamp.mi),Number(stamp.s)).getTime():file.lastModified;
  if(!Number.isFinite(startedAt))throw new Error('TGAM 元數據中的開始時間無效。');
  const parsed=decodeTgamBytes(bytes,{
    deviceId:metadata?.deviceId??(stamp?.current||stamp?.legacy)??'unknown-device',
    sampleRate:metadata?.sampleRate??512,startedAt,
    sessionId:metadata?.sessionId??`raw-tgam-${file.lastModified}`,
    transport:metadata?.transport??'usb',
  });
  return validateRecording(parsed);
}
$('replay-file').onchange=()=>{
  const files=[...$('replay-file').files],file=files.find(item=>item.name.toLowerCase().endsWith('.tgam'))??files[0];
  loadRecording(file);
};
let tgamConversionFiles=[];
$('convert-tgam-file').onchange=()=>{
  tgamConversionFiles=[...$('convert-tgam-file').files];
  const selected=tgamConversionFiles.find(file=>file.name.toLowerCase().endsWith('.tgam'));
  $('convert-tgam-json').disabled=!selected;
  $('convert-tgam-csv').disabled=!selected;
  $('convert-tgam-status').textContent=selected
    ?`${selected.name} · ${t('准备转换')}`:t('尚未选择 TGAM 文件');
};
async function convertTgamFile(format){
  const file=tgamConversionFiles.find(item=>item.name.toLowerCase().endsWith('.tgam'));
  if(!file)return;
  $('convert-tgam-json').disabled=true;$('convert-tgam-csv').disabled=true;
  $('convert-tgam-status').textContent=t('正在转换 TGAM 文件');
  try{
    const parsed=await decodeTgamFile(file);
    const stem=file.name.replace(/\.tgam$/i,'');
    if(format==='csv')download(`${stem}.csv`,spreadsheetCsv(parsed.snapshots),'text/csv;charset=utf-8');
    else download(`${stem}.json`,JSON.stringify(parsed,null,2));
    $('convert-tgam-status').textContent=`${file.name} · ${parsed.snapshots.length} ${t('個樣本')} · ${t('轉換完成')}`;
  }catch(error){
    $('convert-tgam-status').textContent=t('轉換失敗');
    notice(error.message);
  }finally{
    $('convert-tgam-json').disabled=false;$('convert-tgam-csv').disabled=false;
  }
}
$('convert-tgam-json').onclick=()=>convertTgamFile('json');
$('convert-tgam-csv').onclick=()=>convertTgamFile('csv');
function replayNext(){
  if(!replayPlaying||!replay)return;
  const snapshots=replay.snapshots;
  // Play the file at the pace it was recorded. One timer per frame would be
  // clamped to 4 ms by the browser, so a 512 Hz stream — a frame every 2 ms —
  // would run four times too slow and the 60 s plot would take four minutes to
  // fill. The anchor turns record time into wall time; each tick drains every
  // frame that is already due.
  if(!replayAnchor){
    const head=snapshots[Math.min(replayIndex,snapshots.length-1)];
    replayAnchor={wall:performance.now(),clock:Number(head?.ts)||0};
  }
  const target=replayAnchor.clock+(performance.now()-replayAnchor.wall)/1000;
  let pushed=0;
  while(replayIndex<snapshots.length&&pushed<2000&&Number(snapshots[replayIndex].ts)<=target){
    const packet=snapshots[replayIndex++];
    ingest(replayPacket(packet,Date.now(),replayRun));
    pushed++;
  }
  paintReplay();
  if(replayIndex>=snapshots.length){
    stream.reset();rawAmplitude.reset();paused=true;replayPlaying=false;replayAnchor=null;
    $('status').textContent=t('回放完成');paintReplay(true);update();return;
  }
  timer=setTimeout(replayNext,50);
}
function startReplay(){
  if(!replay||!replay.snapshots.length)return;
  // Playing a file is the replay feed: the console must say so, or a recording
  // looks like live data. setMode resets the trace and the timers for us.
  if(mode!=='replay')setMode('replay');
  stop();
  if(replayIndex>=replay.snapshots.length)replayIndex=0;
  replayRun=`replay:${crypto.randomUUID()}`;
  paused=false;replayPlaying=true;replayAnchor=null;
  $('status').textContent=t('記錄回放');
  paintReplay(true);
  replayNext();
}
function pauseReplay(){
  if(!replayPlaying)return;
  clearTimeout(timer);clearInterval(timer);timer=null;
  replayPlaying=false;paused=true;replayAnchor=null;
  $('status').textContent=t('回放已暫停');
  paintReplay(true);update();
}
function stopReplay(){
  if(!replay)return;
  clearTimeout(timer);clearInterval(timer);timer=null;
  replayPlaying=false;paused=true;replayIndex=0;replayAnchor=null;
  // Rewinding clears the trace: a rolling window that still shows the tail of
  // the previous position would claim data the playhead has not reached.
  stream.reset();rawAmplitude.reset();history=[];wormTrace=null;
  $('status').textContent=t('回放已停止');
  paintReplay(true);update();
}
function toggleReplay(){replayPlaying?pauseReplay():startReplay();}
$('replay-play').onclick=toggleReplay;
$('replay-stop').onclick=stopReplay;
$('replay-seek').oninput=()=>{
  if(!replay)return;
  replayIndex=Math.min(replay.snapshots.length,
    Math.max(0,Math.round(Number($('replay-seek').value)||0)));
  // A scrub is a jump, not a re-run: the window continues from the new position
  // instead of pretending the skipped span was observed.
  paintReplay(true);
  if(replayPlaying){replayAnchor=null;clearTimeout(timer);timer=null;replayNext();}
};
$('replay-jump').onclick=()=>{setView('settings');$('replay-file').click();};
function setView(next){
  if(!['waveforms','worm','settings','annotation'].includes(next))next='settings';
  view=next;
  document.body.dataset.view=view;
  // The sidebar always reads as device status; the badge carries the active
  // feed (EEG / DEMO / REPLAY). Device views never keep a synthetic feed alive.
  $('source-label').textContent=t('設備狀態');
  const deviceView=view==='settings'||view==='waveforms';
  // A recording is a file, not a live feed: opening a device view keeps it
  // loaded, because its transport lives in 01. A synthetic demo feed is still
  // dropped — generated data has no place beside measured data.
  if(deviceView&&mode==='replay'){
    $('source').textContent='REPLAY';
  }else if(deviceView&&mode!=='live'){
    setMode('live');
    $('source').textContent='EEG';$('source-note').textContent=t('等待真實 EEG 設備連接；示範與回放已停止。');
  }else if(deviceView&&mode==='live'){
    $('source').textContent='EEG';$('source-note').textContent=t('等待真實 EEG 設備連接。');
    showLiveStatus();
  }else if(mode==='demo'&&paused){
    $('source').textContent='DEMO';$('source-note').textContent=t('合成示範已暫停；按上方資料入口的「示範」可重新啟動。');
    $('status').textContent=t('示範已暫停');
  }
  for(const name of ['waveforms','worm','settings','annotation'])$(`view-${name}`).hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  const title={waveforms:'波形捕獲',worm:'音樂與神經響應',settings:'設備設定',annotation:'數據標註'}[view];
  $('page-title').replaceChildren(document.createTextNode(t(title)),Object.assign(document.createElement('span'),{textContent:t({waveforms:'EEG / LIVE SIGNAL',worm:'音樂參考 · 現場響應 · 版本實驗',settings:'DEVICE / INTERFACES',annotation:'ANNOTATION / PROMPT'}[view])}));
  if(view==='settings')refreshGateway();
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{location.hash=button.dataset.view;});
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
let gatewayConfig=null,gatewayApiAvailable=false,gatewaySelectionDirty=false,gatewayStorage=null;
// The Bluetooth device the operator has picked but not saved yet. null means
// "no opinion, follow the stored identity"; '' means "cleared on purpose".
// Without it every two-second refresh re-derived the picker from the config and
// threw away a fresh choice, which read as the picker resetting itself.
let gatewayBleChoice=null;
// Addresses are what the collector matches on, names are what a person reads.
// Remember the pairing so a saved identity can still be named while the device
// is switched off and absent from the scan.
const gatewayBleNames=new Map();
for(const id of ['gateway-eeg-select','gateway-ble-select'])
  $(id).addEventListener('change',event=>{
    gatewaySelectionDirty=true;
    // Pin the Bluetooth choice so a background refresh cannot overwrite it.
    if(id==='gateway-ble-select'){gatewayBleChoice=event.target.value;markPendingBleChoice();}
    // Hardware and file name are separate decisions. Choosing another cable or
    // radio changes what records, not what the recording is called: only a
    // person renames a label, through 「應用設備名稱」.
    // The pick itself is the decision. A second 「保存」 step meant the picker
    // could name one device while the collector still recorded from another.
    saveIdentity();
  });
/**
 * Mark a Bluetooth pick that is not stored yet.
 *
 * The collector connects to the *saved* address, so an unsaved pick looks as if
 * it is in force while acquisition would still use the old identity. Saying so on
 * the row is the difference between "I chose it" and "it is in force".
 */
function markPendingBleChoice(){
  const select=$('gateway-ble-select');
  // Rebuilding the list wipes these markers; re-selecting within one list does
  // not, so clear them before deciding which row to mark.
  for(const option of select.options){
    if(option.dataset.base!==undefined){
      option.textContent=option.dataset.base;
      delete option.dataset.base;
    }
  }
  const option=select.selectedOptions?.[0];
  const pending=Boolean(gatewayBleChoice)
    &&gatewayBleChoice!==(gatewayConfig?.ble?.address??'');
  if(!option||!pending)return;
  option.dataset.base=option.textContent;
  option.textContent=`${option.textContent} · ${t('尚未保存')}`;
}
/** The filename a given label would produce, in the active language. */
function labelPreview(value){
  return `${t('記錄檔名')} eeg-${value}-<${t('開始時間')}>`;
}
/**
 * Fill 記錄用設備標識 from the detected device, unless the operator has taken over.
 *
 * The label is how a recording is filed, so it must default to something rather
 * than to unknown-device: the collector already knows which hardware is sending,
 * and its first ten characters are the model a person recognises. The field stays
 * editable — an operator who wants their own name just types it, and the rescan
 * stops touching the field from then on.
 */
/**
 * Write a detected label through to the collector.
 *
 * 「記錄用設備標識」 is the name the file will carry, and the collector reads it
 * from its own config — an auto-filled input alone changes nothing on disk. Doing
 * the write here keeps the promise the status line makes without asking for a
 * button the promise never mentioned. Failure is not fatal: the button still
 * works and the status line stops claiming the name is in force.
 */
async function autoWriteDeviceLabel(value){
  if(!gatewayApiAvailable||!value)return;
  if(value===eegLabelWritten||value===eegLabelWriting||value===eegLabelFailed)return;
  eegLabelWriting=value;
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({eeg:{deviceId:value}})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    eegLabelWritten=value;
    eegDeviceId=value;
    try{localStorage.setItem('neural-resonance-eeg-device-id',value);}catch{/* Private mode. */}
  }catch{
    // One refusal per value: retrying every two seconds would hammer a collector
    // that is not listening, and the operator already has a manual path.
    eegLabelFailed=value;
  }finally{
    if(eegLabelWriting===value)eegLabelWriting='';
  }
}
/**
 * Show which hardware is behind the label, in full.
 *
 * The label is cut to ten characters so it can be a filename; the badge keeps the
 * whole name beside it, so a truncated label is never the only thing an operator
 * can see.
 */
function paintDetectedDevice(data){
  const device=detectedDevice({eeg:data?.config?.eeg,ble:data?.config?.ble,
    devices:data?.devices??[],bleNames:gatewayBleNames,bleState:data?.bleStatus?.state,
    bleCandidates:data?.bleDevices??[]});
  const badge=$('eeg-detected');
  badge.textContent=device.name
    ?`${t('設備')} · ${device.name} · ${device.transport==='ble'?t('藍牙'):'USB'}`
    :t('設備 · 未連接');
  badge.title=device.name;
}
/** Applying is only meaningful when the field differs from what is in force. */
function paintLabelApply(){
  const button=$('eeg-label-apply');
  const value=normalizeDeviceId($('eeg-device-id').value);
  const stored=(gatewayConfig?.eeg?.deviceId??'')==='unknown-device'?'':(gatewayConfig?.eeg?.deviceId??'');
  button.disabled=!gatewayConfig||(value==='unknown-device'?'':value)===stored;
  button.title=button.disabled?t('目前標識已生效'):'';
}
function syncDeviceLabel(data){
  const field=$('eeg-device-id');
  const storedRaw=data?.config?.eeg?.deviceId??'';
  // unknown-device is the filename fallback, not a name a person chose, and the
  // collector fills it from the connected hardware on its own — so the panel must
  // not read it as "deliberately unnamed" and stop detecting.
  const stored=storedRaw==='unknown-device'?'':storedRaw;
  const auto=derivedDeviceLabel({eeg:data?.config?.eeg,ble:data?.config?.ble,
    devices:data?.devices??[],bleNames:gatewayBleNames,bleState:data?.bleStatus?.state,
    bleCandidates:data?.bleDevices??[]});
  eegLabelAuto=auto;
  const focused=document.activeElement?.isSameNode(field);
  // A stored label is the recording's name, full stop. Detection does not get to
  // replace it when the hardware changes — Bluetooth dropping to the USB cable
  // used to rename the next file, which is exactly when an operator is least
  // likely to notice. Naming is a human decision, taken with 「應用設備名稱」.
  if(stored){
    // A typed-but-unsaved label keeps the field: the two-second poll must not
    // erase what the operator is in the middle of naming.
    if(focused||eegLabelEdited)return;
    eegDeviceId=stored;field.value=stored;
    // When the label no longer matches the hardware that will actually write,
    // say so plainly instead of silently renaming or silently saying nothing.
    const differs=Boolean(auto)&&normalizeDeviceId(auto)!==normalizeDeviceId(stored);
    $('eeg-profile-status').textContent=differs
      ?`${t('已寫入採集器')} · ${labelPreview(stored)} · ${t('目前設備')} ${auto}，${t('但檔名仍沿用此標識')}`
      :`${t('已寫入採集器')} · ${labelPreview(stored)}`;
    return;
  }
  if(focused||eegLabelEdited)return;
  if(!auto){
    eegDeviceId='';field.value='';
    $('eeg-profile-status').textContent=t('未設置設備標識，記錄文件名將使用 unknown-device');
    return;
  }
  const value=normalizeDeviceId(auto);
  eegDeviceId=value;field.value=value;
  // Nothing is stored yet, so this is the first name the recording will carry.
  // Write it through once: from then on the label is this recording's name and
  // detection stops having an opinion about it.
  $('eeg-profile-status').textContent=`${t('尚未寫入採集器')} · ${labelPreview(value)} · ${t('按「應用設備名稱」生效')}`;
  autoWriteDeviceLabel(value);
}
async function refreshGateway(){
  if(!gatewayApiAvailable)return;
  try{
    const response=await fetch('/api/gateway/devices',{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(!response.ok)return;
    const data=await response.json();
    gatewayConfig=data.config;$('gateway-panel').hidden=false;
    syncDeviceLabel(data);
    paintDetectedDevice(data);
    paintLabelApply();
    // Only real USB devices are listed; non-USB system ports (macOS
    // /dev/cu.debug-console, Bluetooth-Incoming-Port) are collector noise.
    // The device picker already filtered on allUsb, so this is display only.
    // Rows name the hardware, never the /dev node: a person recognises the
    // model and the serial on the sticker, the port path is a platform detail.
    const usbDevices=data.devices.filter(device=>device.vid!==null);
    // The collapsed summary carries the one fact that matters: is the collector
    // matching a unique model automatically, or replaying a saved identity?
    const eegProfile=data.config.eeg??{};
    $('gateway-state').textContent=eegProfile.serialNumber||eegProfile.location
      ?t('使用已保存身份'):t('自動 · 唯一型號匹配');
    $('gateway-inventory').replaceChildren(...usbDevices.map(device=>{
      const row=document.createElement('div');row.className='device-row';
      const name=document.createElement('code'),detail=document.createElement('span');
      name.textContent=(device.description||'').trim()||t('USB 設備');
      const serial=(device.serialNumber||'').trim();
      detail.textContent=serial?t('序列號')+` ${serial}`
        :`${t('USB 型號')} ${device.vid.toString(16).padStart(4,'0')}:${device.pid.toString(16).padStart(4,'0')}`;
      row.append(name,detail);return row;
    }));
    if(!usbDevices.length)$('gateway-inventory').textContent='尚未發現 USB 串口設備；插入後會自動識別。';
    // Storage must be usable before acquisition may start or stop, otherwise a
    // session would run with nowhere to land.
    const storage=data.storage??{};
    gatewayStorage=storage;
    if(document.activeElement?.id!=='storage-directory')
      $('storage-directory').value=data.config.storage?.directory??'';
    $('storage-state').textContent=storage.ready
      ?t('保存目錄已就緒')+' · '+storage.directory
      :t('保存目錄不可用')+' · '+(storage.error||t('尚未選擇可用目錄'));
    // Start/stop per transport. The collector restarts its workers whenever the
    // device configuration changes, so this takes effect without a relaunch.
    const run=$('gateway-run'),running=Boolean(data.config.acquisition?.running);
    run.textContent=t(running?'停止采集':'開始采集');
    run.dataset.running=String(running);
    run.disabled=Boolean(data.upstream)||!storage.ready;
    for(const [key,id] of [['eeg','gateway-eeg-toggle'],['ble','gateway-ble-toggle']]){
      const button=$(id),enabled=Boolean(data.config[key]?.enabled);
      // Whole phrases as keys. Concatenating a translated fragment into a
      // template produces a string the table has never seen, so t() would fall
      // back to the incomplete character map and mix scripts.
      button.textContent=t(`${enabled?'停止':'啟動'} ${key==='eeg'?'EEG USB':'腦電 BLE'}`);
      button.dataset.enabled=String(enabled);
      button.disabled=Boolean(data.upstream);
      button.title=storage.ready?'':t('請先設定可寫入的記錄保存目錄');
    }
    // The rows below feed both the picker and the diagnostic line, so they are
    // collected before the "operator is mid-choice" guard: freezing the whole
    // panel because a row was clicked left 正在掃描 on screen for as long as the
    // pick stayed unsaved, and the person who just picked a device is exactly the
    // one watching that line.
    const bluetooth=$('gateway-ble-select');
    const nearby=data.bleNearby??[],seen=new Set(),rows=[];
    for(const device of [...(data.bleDevices??[]),...nearby]){
      if(!device?.address||seen.has(device.address))continue;
      seen.add(device.address);rows.push(device);
    }
    // Ten characters keep the model (HR-S0AA758 -> HR-S0AA758) and drop the
    // per-unit suffix; the CoreBluetooth identifier never becomes a label.
    const labels=new Map(rows.map(row=>[row.address,shortDeviceName(row.name)]));
    for(const row of rows)gatewayBleNames.set(row.address,labels.get(row.address));
    // Rebuilding the list every 2 s closes an open menu and makes the picker feel
    // unstable, so only touch the DOM when the choices really changed — and not
    // at all while the operator is between picking and saving. The language is
    // part of the signature: option labels are built with t(), and a translated
    // string is not a key, so translateDocument cannot re-translate them later.
    const signature=`${getLanguage()}|`
      +rows.map(row=>`${row.name}|${row.address}`).join(',')
      +`|${data.config.ble.address}|${data.config.ble.name??''}`;
    if(!gatewaySelectionDirty){
    for(const [key,id] of [['eeg','gateway-eeg-select']]){
      const select=$(id),profile=data.config[key];
      select.replaceChildren(new Option(t('自動 · 唯一型號匹配'),'{}'));
      for(const option of identityOptions(data.devices,profile,{allUsb:true}))select.add(new Option(option.label,option.value));
      const registered=JSON.stringify({serialNumber:profile.serialNumber||'',location:profile.location||'',vid:profile.vid,pid:profile.pid});
      // A remembered serial follows the same ten-character rule as a live label.
      const savedIdentity=shortDeviceName(profile.serialNumber||profile.location);
      if(savedIdentity&&![...select.options].some(o=>o.value===registered))
        select.add(new Option(`${t('已保存身份')} · ${savedIdentity}`,registered));
      if([...select.options].some(o=>o.value===registered))select.value=registered;
    }
    if(bluetooth.dataset.signature!==signature){
      bluetooth.dataset.signature=signature;
      // The first option is the way out of a stale saved identity: choosing it
      // drops the address, and the name prefixes take over again. Say so only
      // when there is something to clear.
      bluetooth.replaceChildren(new Option(t(data.config.ble.address
        ?'自動識別相容設備（清除已保存身份）'
        :'自動識別唯一相容設備'),''));
      // Two devices can advertise the same model name, so only then does a short
      // address prefix join the label.
      const shared=new Map();
      for(const label of labels.values())shared.set(label,(shared.get(label)??0)+1);
      for(const row of rows){
        const label=labels.get(row.address);
        const option=new Option(shared.get(label)>1
          ?`${label} · ${row.address.slice(0,8)}`
          :label,row.address);
        option.title=row.address;
        bluetooth.add(option);
      }
      // A saved address, or a choice the operator has made but not saved yet,
      // stays selected. Without this the five-second refresh put the saved
      // identity back and the picker looked like it had reset itself.
      const desired=gatewayBleChoice??(data.config.ble.address??'');
      // Not in this scan: still the active choice, named from memory rather than
      // shown as a raw CoreBluetooth identifier.
      if(desired&&!seen.has(desired)){
        const known=gatewayBleNames.get(desired)||shortDeviceName(data.config.ble.name);
        // A pending pick is labelled by markPendingBleChoice(); only a stored one
        // needs to say where its name came from.
        const pending=desired!==data.config.ble.address;
        const missing=new Option(known
          ?(pending?known:`${known} · ${t('已保存身份')}`)
          :t('已保存身份 · 本次掃描未發現'),desired);
        missing.title=desired;
        bluetooth.add(missing);
      }
      bluetooth.value=desired;
      markPendingBleChoice();
    }
    } // !gatewaySelectionDirty — only the two pickers are held still.
    // An empty picker has unrelated causes — transport off, radio paused by a
    // live USB stream, nothing in range, or names that do not match. Naming the
    // cause is the difference between "查不到" and a next step.
    const bluetoothState=bleDiagnostic({
      enabled:Boolean(data.config.ble?.enabled),status:data.bleStatus,nearby});
    $('gateway-ble-state').textContent=nearby.length
      ?`${nearby.length} ${t('台藍牙設備')} · ${t(bluetoothState.text)}`
      :t(bluetoothState.text);
    $('gateway-message').textContent=t(data.upstream
      ?'目前復用既有音療核心，其設備身份由核心配置管理；獨立模式可在此保存。'
      :'按 USB 身份識別；設備路徑或 COM 號改變後自動重連。');
  }catch(error){$('gateway-message').textContent=`${t('設備清單暫不可用')}：${error.message}`;}
}
// 「重新載入」: exactly what Cmd+R does.
//
// A reload throws away everything on this side of the socket — the cached
// device list, the stream readers, a status line the collector has already
// left — and rebuilds it from one fresh /api/runtime. It is the one action
// that is always safe, including while a session is recording: acquisition
// runs in the collector process and keeps writing its file. Nothing on this
// page can rebuild the collector's radio, so a button must not pretend to;
// restarting the collector is a separate, deliberate act (Start-macOS.command).
$('gateway-refresh').onclick=()=>location.reload();

async function setGatewayEnabled(key,enabled){
  if(!gatewayApiAvailable)return;
  const storage=gatewayStorage;
  if(!storage?.ready){notice(t('請先設定可寫入的記錄保存目錄'));return;}
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({[key]:{enabled}})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gatewaySelectionDirty=false;await refreshGateway();
  }catch(error){notice(error.message);}
}
async function setGatewayRunning(running){
  if(!gatewayApiAvailable)return;
  if(!gatewayStorage?.ready){notice(t('請先設定可寫入的記錄保存目錄'));return;}
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({acquisition:{running}})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gatewaySelectionDirty=false;await refreshGateway();
  }catch(error){notice(error.message);}
}
async function applyStorageDirectory(){
  if(!gatewayApiAvailable)return;
  const directory=$('storage-directory').value.trim();
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({storage:{directory}})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gatewaySelectionDirty=false;await refreshGateway();
  }catch(error){notice(error.message);}
}
$('storage-apply').onclick=()=>applyStorageDirectory();
$('gateway-run').onclick=()=>setGatewayRunning($('gateway-run').dataset.running!=='true');
// Show the file name the label will actually produce, so naming never has to be
// guessed from the rule text.
$('eeg-device-id').addEventListener('input',()=>{
  const raw=$('eeg-device-id').value,normalized=normalizeDeviceId(raw);
  // Typing a name of your own takes the field off auto-detection; clearing it
  // hands the field back to the detected identity.
  eegLabelEdited=raw.trim()!==''&&normalized!==normalizeDeviceId(eegLabelAuto);
  // A typed name is not in force until it is saved: the collector names files
  // from its own config, so the preview must not read as a promise on its own.
  const pending=raw.trim()&&normalized!==eegDeviceId;
  $('eeg-profile-status').textContent=deviceIdNeedsNormalizing(raw)
    ?`${t('將正規化為')} ${normalized} · ${labelPreview(normalized)}`
    :raw.trim()?`${labelPreview(normalized)}${pending?` · ${t('按「應用設備名稱」生效')}`:''}`
      :t('未設置設備標識，記錄文件名將使用 unknown-device');
  paintLabelApply();
});
// 「應用設備名稱」: name it yourself, without touching the USB/BLE identity. The
// default is already the detected hardware, so this button only ever overrides it.
$('eeg-label-apply').onclick=async()=>{
  if(!gatewayConfig)return;
  const value=normalizeDeviceId($('eeg-device-id').value);
  const named=value==='unknown-device'?'':value;
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({eeg:{deviceId:value}})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    try{localStorage.setItem('neural-resonance-eeg-device-id',named);}catch{/* Private mode. */}
    eegDeviceId=named;
    // A name someone typed is theirs: later device changes must not rename it.
    eegLabelWritten=named&&named===normalizeDeviceId(eegLabelAuto)?named:'';
    eegLabelFailed='';eegLabelEdited=false;
    await refreshGateway();
    $('eeg-profile-status').textContent=named
      ?`${t('已寫入採集器')} · ${labelPreview(named)}`
      :t('未設置設備標識，記錄文件名將使用 unknown-device');
  }catch(error){$('eeg-profile-status').textContent=`${t('保存未完成')}：${error.message}`;}
};
$('gateway-eeg-toggle').onclick=()=>setGatewayEnabled('eeg',$('gateway-eeg-toggle').dataset.enabled!=='true');
$('gateway-ble-toggle').onclick=()=>setGatewayEnabled('ble',$('gateway-ble-toggle').dataset.enabled!=='true');
// Identity is written the moment a picker changes, so there is no separate
// 「保存」 button to forget. The label is not part of this: it is filled once
// from the detected hardware and renamed only through 「應用設備名稱」.
async function saveIdentity(){
  if(!gatewayConfig||!gatewayApiAvailable)return;
  const address=$('gateway-ble-select').value;
  const next={
    // The identity spread carries the *stored* deviceId along untouched, so
    // merging cannot drop it; the input field is never read here, because a
    // half-typed name must not be saved by picking a device.
    eeg:{...selectedProfile(gatewayConfig.eeg,$('gateway-eeg-select').value)},
    // Save the name with the address: a device that is switched off next time
    // is still remembered as a device, not as a bare identifier.
    ble:{...gatewayConfig.ble,address,
      name:address?(gatewayBleNames.get(address)??gatewayConfig.ble.name??''):''},
  };
  try{
    const response=await fetch('/api/gateway/config',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gatewaySelectionDirty=false;
    // The pick now matches what the collector stores, so the pin is no longer
    // needed and the saved identity takes over again.
    gatewayBleChoice=null;
    await refreshGateway();
    $('gateway-message').textContent=t('設備身份已保存，採集器已重新識別設備。');
  }catch(error){
    // Keep the 「尚未保存」 marker: the pick is still not in force, and saying so
    // is better than letting the dropdown imply it was applied.
    $('gateway-message').textContent=`${t('保存未完成')}：${error.message}`;
  }
}
let runtimeTimer=null;
// True unless the collector explicitly reports that acquisition is stopped.
let gatewayRunning=true;
async function refreshRuntime(){
  try{
    const response=await fetch('/api/runtime',{cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(!response.ok)return;
    const state=await response.json();if(state.schemaVersion!=='music-therapy-runtime-v1')return;
    if(state.storage){
      if(state.storage.state==='error')
        $('monitor-record-count').textContent=`${t('自動保存失敗')} · ${state.storage.error}`;
      else if(state.storage.state==='unavailable')
        $('monitor-record-count').textContent=t('上游仅提供解析数据，无法保存原始字节流');
      else if(state.storage.state==='saved')
        $('monitor-record-count').textContent=`${t('桌面采集器自动保存至')} ${state.storage.directory}`;
      else $('monitor-record-count').textContent=t('等待 EEG 数据后自动创建会话记录');
    }
    // Presence, not the /dev node: the console reports whether a device was
    // identified, never which platform path it happens to sit on.
    $('runtime-summary').textContent=runtimeSummary(state,t);
    const eegStatus=deviceDiagnostic(Object.fromEntries(
      ['eeg','ble'].filter(key=>state.devices?.[key]).map(key=>[key,state.devices[key]]),
    ),t).join('；');
    // "Stopped" is its own state. Without it the headline keeps repeating the last
    // device state ("waiting for EEG device") after the operator stopped on
    // purpose, which reads like a fault.
    gatewayRunning=state.acquisition?.running!==false;
    $('device-status').textContent=acquisitionHeadline(eegStatus,gatewayRunning,t);
    if(view==='settings'){
      await refreshGateway();
    }
  }catch{$('runtime-summary').textContent=t('本機橋接器暫不可用；等待接口恢復。');}
}
// Canvas text is not walked by translateDocument, so the legend labels are
// resolved through t() here and rebuilt only when the language changes.
let comparisonLanguage='',comparisonSpecs=[];
function comparisonPanels(){
  const language=getLanguage();
  if(language!==comparisonLanguage){
    comparisonLanguage=language;
    comparisonSpecs=COMPARISON_PANELS.map(panel=>({...panel,
      proxyLabel:t(panel.proxyLabel),nativeLabel:t(panel.nativeLabel)}));
  }
  return comparisonSpecs;
}

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
    for(const panel of comparisonPanels())drawComparison($(panel.id),history,panel);
    for(const key of waveKeys)if(!$(`wave-${key}`).parentElement.hidden)drawWaveforms($(`wave-${key}`),history,key,Date.now(),{baseline:$('band-display').value==='baseline'});
  }
  requestAnimationFrame(animate);
}
window.addEventListener('pagehide',()=>{leaving=true;clearInterval(runtimeTimer);stop();});
setInterval(update,100);requestAnimationFrame(animate);
async function initialize(){
  let config=DEFAULT_CONFIG;
  try{const response=await fetch(new URL('../public/config.json',import.meta.url),{signal:AbortSignal.timeout(1500),cache:'no-store'});
    if(response.ok)config=normalizeConfig(await response.json(),location.href);
  }catch{/* Independent demo default. */}
  if(leaving)return;
  gatewayApiAvailable=config.gatewayApi;
  try{
    eegDeviceId=localStorage.getItem('neural-resonance-eeg-device-id')??'';
    $('eeg-device-id').value=eegDeviceId==='unknown-device'?'':eegDeviceId;
    // Before the collector has been asked, only the name is known — claiming it is
    // written here would be a guess. refreshGateway() states the real thing in the
    // next frame.
    $('eeg-profile-status').textContent=eegDeviceId?labelPreview(eegDeviceId):t('未設置設備標識，記錄文件名將使用 unknown-device');
  }catch(error){$('eeg-profile-status').textContent=`${t('設備標識暫不可用')} · ${error.message}`;}
  const initialView=['settings','waveforms','worm','annotation'].includes(location.hash.slice(1))
    ?location.hash.slice(1):'settings';
  // Device views must not fall back to the synthetic demo; the research panel
  // keeps demo reachability on its own.
  const startupMode=['settings','waveforms'].includes(initialView)&&config.startupMode==='demo'
    ?'live':config.startupMode;
  $('endpoint').value=config.endpoint;setMode(startupMode);
  // The local integration owns its endpoint; an old saved remote address must
  // not redirect automatic startup away from the current same-origin core.
  if(config.startupMode==='live'&&config.autoConnect)$('endpoint').value=config.endpoint;
  setView(initialView);
  if(config.startupMode==='live'&&config.autoConnect)$('connect').click();
  if(config.startupMode==='live'&&config.autoConnect){
    refreshRuntime();runtimeTimer=setInterval(refreshRuntime,5000);
  }
}
initialize();
initI18n();
onLanguageChange(()=>{
  monitorFeedDirty=true;
  monitorFeedReset=true;
  setView(view);
  renderBandCards();
  showLiveStatus();
  update();
  // The transport line is composed from translated fragments at paint time, so
  // a language switch has to repaint it; translateDocument only rewrites static
  // text nodes and cannot re-derive "N 個樣本" from the rendered sentence.
  paintReplay(true);
});
const closeNavigation=()=>{document.body.classList.remove('nav-open');$('nav-toggle').setAttribute('aria-expanded','false');};
$('nav-toggle').onclick=()=>{
  const open=document.body.classList.toggle('nav-open');
  $('nav-toggle').setAttribute('aria-expanded',String(open));
};
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',closeNavigation));
function setExhibit(enabled){
  document.body.classList.toggle('exhibit',enabled);
  $('worm-exhibit').textContent=t(enabled?'返回':'展示');
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
