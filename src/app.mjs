import { StreamState, LiveConnection, demoSnapshot, parseRecording } from './eeg.mjs';
import { ELEMENTS, MAPPING_VERSION, mapMusic, pointFor, Snake, AudioPreview } from './music.mjs';
import { SensorState, SENSOR_FIELDS } from './sensors.mjs';

const $ = id => document.getElementById(id);
const stream = new StreamState(), snake = new Snake(), audio = new AudioPreview();
const sensors = new SensorState();
let systemState = null, systemReceivedAt = 0, systemTimer, leaving = false, runtimeRequest;
let mode = 'live', transport = 'stopped', timer, tick = 0, recording = false;
let replay, replayIndex = 0;
let view = 'trajectory', history = [], records = [], mappings = [], lastMapping = null;
let frameTime = performance.now(), bandFrameTime = 0, noticeTimer, previousValid = false;
const events = [];
const context = $('field').getContext('2d');
const bandColours = { delta:'#786b97', theta:'#6b8da4', alpha:'#a67796', beta:'#79a293' };
const connection = new LiveConnection({
  onState(state, detail) {
    const changed = state !== transport;
    transport = state;
    if (state !== 'connected') { stream.reset(); sensors.reset(); audio.mute(); }
    if (changed && mode === 'live') log({ connected:'接口已連接，等待有效腦波。', connecting:'正在連接接口。',
      reconnecting:'接口斷開，正在自動重連。', stopped:'已停止連接。',
      error:'接口無法連接，請檢查主服務或安全連線設定。', invalid:'資料格式無效。' }[state] || state);
    if (detail) notify(detail);
    render();
  },
  onSnapshot: ingest,
});

function log(message) {
  events.unshift(`${new Date().toLocaleTimeString('zh-TW', { hour12:false })} · ${message}`);
  events.splice(30);
  $('event-log').replaceChildren(...events.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
}
function notify(message) {
  $('notice').textContent = message; $('notice').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 5000);
}
function stopSource() {
  clearTimeout(timer); clearInterval(timer); timer = null;
  connection.stop(); stream.reset(); sensors.reset(); audio.mute(); previousValid = false;
  $('listen').textContent = '開啟聲音預覽 ♫';
  $('disconnect').disabled = true; $('pause-replay').disabled = true;
}
function setMode(next) {
  stopSource(); mode = next; history = []; snake.reset();
  for (const id of ['live','demo','replay']) {
    $(`${id}-controls`).hidden = id !== mode;
    $(`${id}-tab`).setAttribute('aria-selected', String(id === mode));
  }
  $('source-note').textContent = mode === 'live' ? '開頁自動連接音療主服務；設備接入後資料自動顯示。'
    : mode === 'demo' ? '示範資料僅用於測試互動，不是受試者腦波。' : '回放保留原始時間間隔與缺值。';
  log(`切換至${{ live:'即時腦波', demo:'示範', replay:'記錄回放' }[mode]}。`);
  render();
  if (mode === 'live') connectLive();
}
function safePacket(input) {
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const fields = ['attention','meditation','delta','theta','alpha','beta','delta_mean','theta_mean','alpha_mean','beta_mean',
    'lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma','highGamma','gamma',
    'delta_power','theta_power','alpha_power','beta_power','delta_dominant_freq','theta_dominant_freq',
    'alpha_dominant_freq','beta_dominant_freq','focus_index','relaxation_index','poor_signal','poorSignal'];
  const eeg = Object.fromEntries(fields.filter(key => Object.hasOwn(input.eeg || {}, key))
    .map(key => [key, typeof input.eeg[key] === 'number' && Number.isFinite(input.eeg[key]) ? input.eeg[key] : null]));
  return { schemaVersion: input.schemaVersion, ts: input.ts,
    source: ['core','mock','demo','replay'].includes(input.source) ? input.source : 'unknown',
    originalTimestamp: number(input.originalTimestamp) ?? input.ts * 1000,
    quality: Object.fromEntries(['eegPackets','spo2Samples','prSamples','hrvSamples','gsrSamples']
      .map(key=>[key,number(input.quality?.[key])])),
    eeg, attention: number(input.attention), meditation: number(input.meditation),
    ...Object.fromEntries(Object.keys(SENSOR_FIELDS).map(key=>[key,number(input[key])])) };
}
function mappingFor(snapshot) {
  try { return mapMusic(snapshot, { bpmMin:Number($('bpm-min').value), bpmMax:Number($('bpm-max').value) }); }
  catch (error) { return null; }
}
function ingest(packet) {
  if (!stream.accept(packet)) return;
  sensors.accept(packet);
  if (mode === 'live') transport = 'connected';
  const latest = stream.current();
  const mapping = mappingFor(latest);
  if (history.length && history.at(-1).bandUnits !== latest.bandUnits) {
    history = []; log('頻段量尺改變，已清除觀察圖以避免混用單位。');
  }
  history.push(latest);
  history = history.filter(item => item.timestamp > latest.timestamp - 60000).slice(-600);
  if (recording) {
    if (records.length >= 20000) { toggleRecord(); notify('記錄已達 20000 樣本，請匯出後開始新段。'); }
    else {
      records.push(safePacket(packet));
      mappings.push(mapping);
    }
  }
  render();
}
function toggleRecord() {
  recording = !recording;
  if (recording && records.length >= 20000) { recording = false; notify('請先匯出並重新載入頁面，開始下一段。'); }
  log(recording ? '開始記錄生理訊號和音樂參數。' : '停止記錄；已收集的資料仍可匯出。');
  render();
}
function render() {
  const latest = stream.current();
  const valid = Boolean(latest?.valid), signal = Boolean(latest?.signalValid);
  const stateLabel = latest?.source === 'demo' && signal ? '示範資料'
    : latest?.source === 'mock' && signal ? '主服務模擬'
    : latest?.source === 'replay' && signal ? '記錄回放'
    : signal ? '腦波接收中'
    : transport === 'connecting' ? '正在連接'
    : transport === 'reconnecting' ? '正在重連'
    : transport === 'connected' ? '接口已連接 · 無新鮮腦波'
    : transport === 'paused' ? '回放已暫停'
    : transport === 'complete' ? '回放已完成'
    : '尚未連接';
  $('connection-badge').dataset.state = signal ? 'active' : 'waiting';
  $('connection-badge').querySelector('span').textContent = stateLabel;
  $('mode-label').textContent = !signal ? 'WAITING' : latest.source === 'core' ? 'LIVE EEG' : latest.source.toUpperCase();
  $('source-label').textContent = latest ? { core:'感測器主服務', mock:'主服務模擬', demo:'內建示範', replay:'匯入回放', unknown:'未確認來源' }[latest.source] : '—';
  $('freshness').textContent = !latest ? '—' : latest.packets===0 ? '等待有效腦波'
    : `${(Math.max(0,Date.now()-latest.timestamp,Date.now()-stream.lastAdvance)/1000).toFixed(1)} s${signal?'':' · 超時/接觸不良'}`;
  $('packet-count').textContent = latest ? String(latest.packets) : '—';
  for (const [key, value] of [['attention', latest?.attention], ['relaxation', latest?.relaxation]]) {
    $(key).textContent = signal && value !== null && value !== undefined ? Math.round(value) : '—';
    $(`${key}-meter`).style.width = `${signal && value !== null && value !== undefined ? value : 0}%`;
  }
  $('metric-origin').textContent = valid ? (latest.source === 'core' ? '來源：裝置 attention / meditation 指數。'
    : latest.source === 'replay' ? '來源：已匯入記錄中的指數。' : '來源：示範／模擬指數。')
    : signal ? '已收到腦波，但缺少有效百分制指數。' : '指數待接入；超時資料不參與互動。';
  const ratios = latest?.ratios;
  $('ratio-panel').hidden = !signal || (ratios?.focus === null && ratios?.relaxation === null);
  $('ratios').textContent = `β/α：${ratios?.focus?.toFixed(4) ?? '—'}　θ/α：${ratios?.relaxation?.toFixed(4) ?? '—'}`;
  $('stage-empty').hidden = valid;
  $('stage-empty').querySelector('strong').textContent = signal ? '等待有效的二維指數' : '等待一段腦波';
  $('stage-empty').querySelector('p').textContent = signal ? '頻段仍可觀察；百分制映射尚未接入。' : '接入裝置，或從左側開始示範。';
  const mapping = mappingFor(latest);
  lastMapping = mapping;
  if (!mapping) audio.mute();
  $('bpm').replaceChildren(document.createTextNode(mapping ? String(mapping.parameters.tempo) : '—'),
    Object.assign(document.createElement('small'), { textContent:'BPM' }));
  for (const [key,,unit] of ELEMENTS.slice(1)) {
    const output = $(`music-${key}`);
    output.replaceChildren(document.createTextNode(mapping ? String(mapping.parameters[key]) : '—'),
      Object.assign(document.createElement('small'), { textContent:unit }));
  }
  $('listen').disabled = !mapping; $('mute').disabled = !audio.enabled;
  $('listen').textContent = audio.enabled ? '聲音預覽已開啟 ♫' : '開啟聲音預覽 ♫';
  $('export').disabled = records.length === 0;
  $('record').textContent = recording ? '停止記錄' : '開始記錄';
  $('recording-dot').classList.toggle('is-active', recording);
  $('recording-label').textContent = recording ? '記錄中' : records.length ? '記錄已保留' : '準備記錄';
  $('recording-count').textContent = `${records.length} 個樣本`;
  if (previousValid && !valid) { audio.mute(); $('listen').textContent = '開啟聲音預覽 ♫'; log('指數失效，互動與聲音已停止。'); }
  previousValid = valid;
  audio.update(mapping);
  $('band-units').textContent = latest ? `${latest.bandUnits} · 不混用單位` : '原始頻段值 · 保留來源單位';
  for (const key of Object.keys(bandColours)) {
    const value = signal ? latest.bands[key] : null;
    $(`band-value-${key}`).textContent = value === null || value === undefined ? '—' : value.toPrecision(3);
    $(`band-range-${key}`).textContent = latest?.bandUnits === 'RMS · 相對值'
      ? ({delta:'<4 Hz',theta:'4–8 Hz',alpha:'8–13 Hz',beta:'13–30 Hz'})[key]
      : '裝置分段';
  }
  renderSensors(latest, signal);
  renderSystem();
}
function renderSensors(latest, signal) {
  const values = sensors.current();
  const localCore = mode === 'live' && !runtimeStale() ? systemState?.core : null;
  $('sensor-note').textContent = mode === 'live' ? '獨立判斷新鮮度 · 缺值不補零'
    : mode === 'replay' ? '回放中的生理訊號' : '示範模式 · 未模擬其他感測器';
  for (const [key, field] of Object.entries(SENSOR_FIELDS)) {
    const item = values[key];
    $(`sensor-${key}`).replaceChildren(document.createTextNode(item.valid
      ? Number(item.value.toFixed(2)).toString() : '—'),
      Object.assign(document.createElement('small'),{textContent:field.unit}));
    $(`sensor-status-${key}`).textContent = item.valid ? '資料接收中'
      : key === 'gsr' && localCore?.reachable && !localCore.features.gsr ? '目前設定未啟用'
      : key === 'hrv' ? '等待獨立 HRV 資料' : '等待有效資料';
  }
  const fields = signal ? Object.entries(latest?.raw.eeg || {})
    .filter(([,value])=>typeof value==='number'&&Number.isFinite(value)) : [];
  $('eeg-fields').replaceChildren(...(fields.length ? fields.map(([key,value])=>{
    const cell=document.createElement('div'),name=document.createElement('dt'),data=document.createElement('dd');
    name.textContent=key;data.textContent=Number(value.toPrecision(6)).toString();cell.append(name,data);return cell;
  }) : [Object.assign(document.createElement('dt'),{textContent:'等待有效腦波資料'})]));
}
function runtimeStale() { return !systemState || Date.now()-systemReceivedAt>15000; }
function chip(label,state) {
  const item=document.createElement('span');item.className='program-chip';item.dataset.state=state;
  item.textContent=label;return item;
}
function renderSystem() {
  const state=runtimeStale()?null:systemState;
  const audit=state?.audit;
  const freshAudit=audit?.checkedAt&&Date.now()-Date.parse(audit.checkedAt)<30000;
  const programs=freshAudit?audit.programs:[];
  $('system-summary').textContent = !state ? '本機狀態暫不可用'
    : !state.core.reachable ? '感測器主服務尚未就緒'
    : state.core.source==='mock' ? '主服務運行中 · 模擬來源' : '感測器主服務運行中';
  $('program-status').replaceChildren(...(programs.length?programs.map(item=>chip(
    `${item.label} · ${item.infrastructureReady?'運行中':item.running?'端口待就緒':item.ports?.some(p=>p.bound)?'端口被佔用':item.pathValid?'未啟動':'路徑缺失'}`,
    item.infrastructureReady?'running':item.running?'partial':'stopped')):[chip('等待本機程序清單','stopped')]));
  if(state?.model) $('program-status').append(chip(
    `Ollama 報告服務 · ${state.model.reachable?'接口就緒':'未就緒'}`,
    state.model.reachable?'running':'stopped'));
  const core=state?.core;
  $('core-detail').textContent=core?.reachable
    ? `腦波來源：${{usb:'USB',phone_ble:'手機 BLE',none:'等待設備'}[core.eegSource]??core.eegSource}；腦電串口：${core.ports.brainlink??'未偵測'}；血氧串口：${core.ports.bloodOxygen??'未偵測'}。`
    : '等待感測器主服務；接口恢復後自動重連。';
  $('worker-status').replaceChildren(...(core?.workers||[]).map(item=>chip(
    `${item.name} · ${item.alive?'運行':'已停止'}`,item.alive?'running':'stopped')));
  $('program-note').textContent=programs.length
    ? `檢查時間 ${new Date(audit.checkedAt).toLocaleTimeString('zh-TW',{hour12:false})} · 程序與所屬端口；資料、音訊及畫面需分別驗收。`
    : '本機程序狀態不可讀取；不影響直接連接感測器接口。';
}
async function pollSystem() {
  if (leaving) return;
  try {
    runtimeRequest=new AbortController();
    const timeout=setTimeout(()=>runtimeRequest?.abort(),10000);
    try {
      const response=await fetch('./api/runtime',{cache:'no-store',signal:runtimeRequest.signal});
      if(!response.ok)throw new Error('No local runtime adapter');
      const value=await response.json();
      if(value.schemaVersion!=='music-therapy-runtime-v1')throw new Error('Unsupported runtime status');
      systemState=value;systemReceivedAt=Date.now();
    } finally {clearTimeout(timeout);}
  } catch {systemState=null;}
  renderSystem();
  if(!leaving) systemTimer=setTimeout(pollSystem,5000);
}
function connectLive() {
  try {history=[];snake.reset();connection.connect($('endpoint').value);$('disconnect').disabled=false;}
  catch(error){notify(error.message);}
}
async function autoConnect() {
  try {
    const response=await fetch('./api/health',{signal:AbortSignal.timeout(1500),cache:'no-store'});
    const health=await response.json();
    if(health.app==='neural-resonance-console'&&health.websocketPath==='/ws/live')
      $('endpoint').value=`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws/live`;
  } catch {/* Static hosting keeps the editable direct core endpoint. */}
  if(!leaving&&mode==='live'&&transport==='stopped')connectLive();
}
function resizeCanvas(canvas) {
  const ratio = Math.min(2, devicePixelRatio || 1);
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0);
  return { ctx, width, height };
}
function drawField(delta) {
  const { width:w, height:h } = resizeCanvas($('field'));
  const pad = 27, width = Math.max(1,w-pad*2), height = Math.max(1,h-pad*2);
  const pos = point => ({ x:pad+point.x*width, y:pad+point.y*height });
  context.clearRect(0,0,w,h);
  context.strokeStyle = '#eae6ef'; context.lineWidth = .6;
  for (let i=0;i<=10;i++) {
    const x=pad+width*i/10, y=pad+height*i/10;
    context.beginPath(); context.moveTo(x,pad); context.lineTo(x,h-pad); context.stroke();
    context.beginPath(); context.moveTo(pad,y); context.lineTo(w-pad,y); context.stroke();
  }
  context.setLineDash([3,5]); context.strokeStyle='#d8cee4';
  context.beginPath(); context.moveTo(w/2,pad); context.lineTo(w/2,h-pad); context.moveTo(pad,h/2); context.lineTo(w-pad,h/2); context.stroke(); context.setLineDash([]);
  const accent = getComputedStyle($('app')).getPropertyValue('--accent').trim();
  const current = stream.current();
  const trail = view === 'snake' ? snake.tail.map(pos) : history.filter(p=>p.valid).slice(-90).map(pointFor).map(pos);
  if (view === 'snake') {
    snake.step(current, delta, reduced);
    const food = pos(snake.food);
    if (current?.valid) {
      context.strokeStyle=accent; context.fillStyle='#ffffff'; context.beginPath(); context.arc(food.x,food.y,5,0,Math.PI*2); context.fill(); context.stroke();
    }
    $('snake-score').querySelector('b').textContent = String(snake.score);
  }
  if (trail.length) {
    context.beginPath(); context.moveTo(trail[0].x,trail[0].y);
    for (const p of trail.slice(1)) context.lineTo(p.x,p.y);
    context.lineWidth=view === 'snake'?6:2;
    context.lineJoin='round'; context.lineCap='round'; context.strokeStyle=accent;
    context.globalAlpha=current?.valid ? .6 : .18; context.stroke(); context.globalAlpha=1;
  }
  const target = view === 'snake' ? (current?.valid ? snake.head : null) : pointFor(current);
  if (target) {
    const p=pos(target); context.fillStyle=accent;
    context.beginPath(); context.arc(p.x,p.y,12,0,Math.PI*2); context.globalAlpha=.09; context.fill(); context.globalAlpha=1;
    context.beginPath(); context.arc(p.x,p.y,4,0,Math.PI*2); context.fill();
    context.strokeStyle='white'; context.lineWidth=1.5; context.stroke();
    context.font='10px Consolas, monospace'; context.fillStyle=accent;
    context.fillText(`${Math.round(current.attention)}, ${Math.round(current.relaxation)}`,
      Math.min(p.x+13,w-70), Math.max(p.y-10,15));
  }
}
function drawBands() {
  for (const [key,colour] of Object.entries(bandColours)) {
    const {ctx,width:w,height:h}=resizeCanvas($(`band-${key}`));
    ctx.clearRect(0,0,w,h); ctx.strokeStyle='#f0edf4'; ctx.lineWidth=1;
    for (const y of [10,h/2,h-8]) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    const now=Date.now(), values=history.filter(p=>p.signalValid&&p.bands[key]!==null);
    if (!values.length) continue;
    const max=Math.max(...values.map(p=>p.bands[key]),1e-9);
    ctx.strokeStyle=colour; ctx.lineWidth=1.5; ctx.beginPath();
    let previous=null;
    for (const p of history) {
      if (!p.signalValid || p.bands[key] === null) { previous=null; continue; }
      const x=w*(1-(now-p.timestamp)/60000), y=h-8-(p.bands[key]/max)*(h-18);
      if (x<0) continue;
      if (!previous||p.timestamp-previous.timestamp>3000) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      previous=p;
    }
    ctx.stroke();
  }
}
function download(name, text, type) {
  const url=URL.createObjectURL(new Blob([text],{type})), link=document.createElement('a');
  link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportRecord() {
  const stamp=new Date().toISOString().replaceAll(':','-').replace(/\.\d+Z$/,'Z');
  const value={schemaVersion:'neural-resonance-recording-v1',mappingVersion:MAPPING_VERSION,
    createdAt:new Date().toISOString(),sources:[...new Set(records.map(p=>p.source))],
    mappingConfig:{bpmMin:Number($('bpm-min').value),bpmMax:Number($('bpm-max').value)},
    snapshots:records,mappings,events:[...events].reverse()};
  const prefix=$('brand').value.toUpperCase();
  if ($('export-format').value === 'csv') {
    const keys=ELEMENTS.map(([key])=>key);
    const header=['ts','originalTimestamp','source','attention','meditation','eegPackets',...Object.keys(SENSOR_FIELDS),...keys];
    const rows=records.map((p,i)=>[p.ts,p.originalTimestamp,p.source,p.attention,p.meditation,p.quality.eegPackets,
      ...Object.keys(SENSOR_FIELDS).map(k=>p[k]),...keys.map(k=>mappings[i]?.parameters[k]??'')].map(v=>v??'').join(','));
    download(`${prefix}_music_eeg_${stamp}.csv`,[header.join(','),...rows].join('\r\n'),'text/csv; charset=utf-8');
  } else {
    download(`${prefix}_music_eeg_${stamp}.json`,JSON.stringify(value,null,2),'application/json');
  }
  log(`已匯出 ${records.length} 個 EEG 樣本。`);
}
function replayNext() {
  if (!replay || replayIndex>=replay.snapshots.length) {
    stream.reset(); sensors.reset(); audio.mute(); transport='complete'; $('pause-replay').disabled=true; render(); log('回放完成。'); return;
  }
  const packet=replay.snapshots[replayIndex];
  ingest({...packet,source:'replay',originalTimestamp:packet.originalTimestamp??packet.ts*1000,
    ts:(Date.now())/1000});
  replayIndex++;
  const next=replay.snapshots[replayIndex];
  timer=setTimeout(replayNext,next?Math.max(1,(next.ts-packet.ts)*1000):500);
}
for (const [key,label,unit] of ELEMENTS.slice(1)) {
  const div=document.createElement('div'); div.className='music-element';
  div.innerHTML=`<span><em>${String(ELEMENTS.findIndex(e=>e[0]===key)+1).padStart(2,'0')}</em>${label}</span><b id="music-${key}">—<small>${unit}</small></b>`;
  $('music-elements').append(div);
}
for (const [key,label] of [['delta','δ Delta'],['theta','θ Theta'],['alpha','α Alpha'],['beta','β Beta']]) {
  const div=document.createElement('div'); div.className='band-row';
  div.innerHTML=`<div class="band-label">${label}<span id="band-range-${key}">裝置分段</span><strong id="band-value-${key}">—</strong></div><canvas id="band-${key}" aria-label="${label} 時序"></canvas>`;
  $('band-rows').append(div);
}
for (const [key,field] of Object.entries(SENSOR_FIELDS)) {
  const cell=document.createElement('div');cell.className='sensor-value';
  cell.innerHTML=`<span>${field.label}</span><strong id="sensor-${key}">—<small>${field.unit}</small></strong><p id="sensor-status-${key}">等待有效資料</p>`;
  $('sensor-values').append(cell);
}
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
$('connect').onclick=connectLive;
$('disconnect').onclick=()=>{stopSource(); render();};
$('start-demo').onclick=()=>{
  stopSource(); tick=0; transport='connected';
  const emit=()=>ingest(demoSnapshot(Number($('demo-attention').value),Number($('demo-relaxation').value),tick++));
  emit(); timer=setInterval(emit,500); log('內建示範開始；這不是受試者資料。');
};
for (const [key,output] of [['demo-attention','demo-attention-value'],['demo-relaxation','demo-relaxation-value']]) {
  $(key).oninput=()=>{ $(output).textContent=$(key).value; };
}
$('replay-file').onchange=async()=>{
  try {
    const file=$('replay-file').files[0]; if(!file)return;
    if(file.size>20*1024*1024)throw new Error('記錄大於 20 MB，請先分段。');
    replay=parseRecording(await file.text()); replayIndex=0;
    $('replay-info').textContent=`${replay.snapshots.length} 個樣本 · ${(replay.snapshots.at(-1).ts-replay.snapshots[0].ts).toFixed(1)} 秒`;
    $('start-replay').disabled=false; log('已匯入 EEG 記錄。');
  } catch(error) { notify(error.message); }
};
$('start-replay').onclick=()=>{
  if(!replay)return;
  const paused=transport==='paused';
  stopSource(); if(!paused||replayIndex>=replay.snapshots.length){replayIndex=0;history=[];snake.reset();}
  transport='connected'; $('pause-replay').disabled=false; replayNext(); log('開始回放。');
};
$('pause-replay').onclick=()=>{
  clearTimeout(timer); stream.reset(); sensors.reset(); audio.mute(); transport='paused'; render(); log('回放已暫停。');
};
$('record').onclick=toggleRecord;
$('export').onclick=exportRecord;
$('brand').onchange=()=>{ $('app').dataset.brand=$('brand').value; log(`切換至 ${$('brand').value.toUpperCase()} 主題。`); };
$('reset').onclick=()=>{ history=[]; snake.reset(); log('軌跡已重置；記錄保留。'); };
for (const value of ['trajectory','snake']) {
  $(`${value}-view`).onclick=()=>{
    view=value; $('trajectory-view').setAttribute('aria-pressed',String(view==='trajectory'));
    $('snake-view').setAttribute('aria-pressed',String(view==='snake')); $('snake-score').hidden=view!=='snake';
  };
}
$('listen').onclick=async()=>{
  if(!lastMapping)return;
  try {
    await audio.start(); audio.update(mappingFor(stream.current())); $('listen').textContent='聲音預覽已開啟 ♫'; render();
    log('已手動開啟低音量正弦聲預覽。');
  } catch(error) { notify(error.message); }
};
$('mute').onclick=()=>{audio.mute(); $('listen').textContent='開啟聲音預覽 ♫'; render();};
for(const id of ['bpm-min','bpm-max']) $(id).onchange=()=>{
  try{mapMusic({valid:true,attention:50,relaxation:50},{bpmMin:Number($('bpm-min').value),bpmMax:Number($('bpm-max').value)});render();}
  catch(error){notify(error.message);audio.mute();render();}
};
$('toggle-log').onclick=()=>{$('event-log').hidden=!$('event-log').hidden;$('toggle-log').setAttribute('aria-expanded',String(!$('event-log').hidden));};
window.addEventListener('pagehide',()=>{leaving=true;clearTimeout(systemTimer);runtimeRequest?.abort();stopSource();audio.mute();});
document.addEventListener('visibilitychange',()=>{ if(document.hidden){audio.mute(); render();} });
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionQuery.matches;
motionQuery.addEventListener('change',event=>{reduced=event.matches;});
function animate(now) {
  if (document.hidden || now-frameTime < (reduced ? 250 : 33)) { requestAnimationFrame(animate); return; }
  const delta=(now-frameTime)/1000; frameTime=now;
  drawField(reduced?0:delta);
  if (now-bandFrameTime>=250) { drawBands(); bandFrameTime=now; }
  requestAnimationFrame(animate);
}
setInterval(render,250);
log('控制台已準備，正在自動連接既有音療主服務。');
render(); requestAnimationFrame(animate);
autoConnect();pollSystem();
