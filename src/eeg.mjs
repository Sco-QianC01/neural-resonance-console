import {PacketClock,hasStreamClock,observationNow} from './stream-clock.mjs';
export const SCHEMA = 'neural-resonance-live-v1';
const supportedSchemas = [SCHEMA, 'frontal-live-v1'];
export const STALE_MS = 3000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const index = value => finite(value) && value >= 0 && value <= 100 ? value : null;
const positive = value => finite(value) && value >= 0 ? value : null;

/** Read native fields without turning USB spectral ratios into device scores. */
export function normalizeSnapshot(input, now = observationNow()) {
  if (!input || typeof input !== 'object' || !supportedSchemas.includes(input.schemaVersion))
    throw new Error('不支援的資料格式；請使用 neural-resonance-live-v1。');
  if (!finite(input.ts)) throw new Error('缺少有效的時間戳。');
  const timestamp = input.ts * 1000;
  const age = now - timestamp;
  const clocked=hasStreamClock(input);
  const eeg = input.eeg && typeof input.eeg === 'object' ? input.eeg : {};
  const fieldFresh = key => clocked
    ?finite(input.fieldAgesMs?.[key])&&input.fieldAgesMs[key]>=0
      &&input.fieldAgesMs[key]+Math.max(0,age)<=STALE_MS
    :!input.fieldTimestamps || !Object.hasOwn(input.fieldTimestamps,key)
    || (finite(input.fieldTimestamps[key]) && now-input.fieldTimestamps[key]*1000>=-5000
        && now-input.fieldTimestamps[key]*1000<=STALE_MS);
  const has = key => Object.hasOwn(eeg, key);
  const metricOrigin = input.metricOrigin==='thinkgear-esense' ? 'thinkgear-esense' : 'device-index';
  // The core's top-level fields can alias focus_index/relaxation_index. They
  // are ratios, not a calibrated 0–100 score; preserve them separately.
  const readIndex=value=>metricOrigin==='thinkgear-esense'&&!Number.isInteger(value)?null:index(value);
  const latestAttention = fieldFresh('attention') ? readIndex(has('attention') ? eeg.attention
    : has('focus_index') ? null : input.attention) : null;
  const latestRelaxation = fieldFresh('meditation') ? readIndex(has('meditation') ? eeg.meditation
    : has('relaxation_index') ? null : input.meditation) : null;
  const pairProvided=clocked||Object.hasOwn(input,'indexPair'),pair=input.indexPair;
  const pairAt=clocked&&finite(pair?.ageMs)?timestamp-pair.ageMs:pair?.at*1000;
  const pairValid=pairProvided&&pair&&readIndex(pair.attention)>0&&readIndex(pair.meditation)>0
    &&latestAttention>0&&latestRelaxation>0
    &&Number.isSafeInteger(pair.sequence)&&pair.sequence>0&&finite(pairAt)
    &&now-pairAt>=-5000&&now-pairAt<=STALE_MS;
  const attention=pairValid?pair.attention:latestAttention;
  const relaxation=pairValid?pair.meditation:latestRelaxation;
  // ThinkGear reserves zero for an unavailable eSense computation. Other
  // adapters and the explicit demo can still define valid zero-valued indices.
  const indicesAvailable = metricOrigin!=='thinkgear-esense' || (attention>0 && relaxation>0);
  const times=input.fieldTimestamps;
  const statedOriginal=input.originalFieldTimestamps;
  const originalTimes=statedOriginal&&[statedOriginal.attention,statedOriginal.meditation].every(finite)?
    statedOriginal:times;
  const fieldClock=times&&[times.attention,times.meditation].every(finite);
  const indexTimestamp=pairValid?pairAt:fieldClock?Math.max(times.attention,times.meditation)*1000:null;
  const indexSampleKey=pairProvided?(pairValid?`report:${pair.sequence}`:null)
    :fieldClock?JSON.stringify([originalTimes.attention,originalTimes.meditation]):null;
  const originalPair=input.originalIndexPair??pair;
  const originalIndexTimestamp=pairValid&&finite(originalPair?.at)?originalPair.at*1000:
    fieldClock&&[originalTimes.attention,originalTimes.meditation].every(finite)?
    Math.max(originalTimes.attention,originalTimes.meditation)*1000:input.originalTimestamp??timestamp;
  const packets = positive(input.quality?.eegPackets) ?? 0;
  const qualityKey=has('poor_signal')?'poor_signal':'poorSignal',qualityValue=eeg[qualityKey];
  const poorSignal = fieldFresh(qualityKey)&&Number.isInteger(qualityValue)&&qualityValue>=0&&qualityValue<=200?qualityValue:null;
  const signalQuality=poorSignal===null?'unknown':poorSignal===0?'good':'poor';
  const transportFresh = input.transport!=='none' && age >= -5000 && age <= STALE_MS && packets > 0;
  const signalValid = transportFresh && (metricOrigin==='thinkgear-esense'?poorSignal===0:poorSignal===null||poorSignal===0);
  const bands = Object.fromEntries(['delta', 'theta', 'alpha', 'beta'].map(key => {
    const read=name=>fieldFresh(name)&&(clocked||fieldFresh(key))?positive(eeg[name]):null;
    const direct = read(`${key}_mean`) ?? read(key);
    const low = read(`low${key[0].toUpperCase()}${key.slice(1)}`);
    const high = read(`high${key[0].toUpperCase()}${key.slice(1)}`);
    return [key, direct ?? (low !== null && high !== null ? low + high : null)];
  }));
  const spectralBands=Object.fromEntries(['delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma']
    .map(key=>[key,fieldFresh(key)?positive(eeg[key]):null]));
  return {
    timestamp, originalTimestamp: input.originalTimestamp ?? timestamp,
    source: ['device', 'core', 'mock', 'demo', 'replay'].includes(input.source) ? input.source : 'unknown',
    sessionId: typeof input.sessionId === 'string' ? input.sessionId : null,
    transport: input.transport ?? null, connectionEpoch: input.connectionEpoch ?? null,
    attention, relaxation, bands, spectralBands, packets,
    ratios: { focus: positive(eeg.focus_index), relaxation: positive(eeg.relaxation_index) },
    bandUnits: typeof input.bandUnits==='string'&&input.bandUnits.length<=80?input.bandUnits
      :input.source==='demo'?'合成示範相對值':'來源頻段值 · 單位未回報',
    metricOrigin,indexTimestamp,indexSampleKey,originalIndexTimestamp,
    latestIndices:{attention:latestAttention,relaxation:latestRelaxation},
    pairMethod:pairProvided?'same-report':fieldClock?'legacy-latest-fields':'source-unspecified',
    pairDeltaMs:pairProvided?(pairValid?0:null):fieldClock?Math.abs(times.attention-times.meditation)*1000:null,
    poorSignal,signalQuality,transportFresh,signalValid,
    valid:signalValid&&attention!==null&&relaxation!==null&&indicesAvailable&&(!pairProvided||Boolean(pairValid)),
    raw: input,
  };
}

export const HISTORY_WINDOW_MS = 60000;
const HISTORY_BANDS = ['delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma'];

/**
 * Rebuild display snapshots from the collector's buffered minute.
 *
 * A page that opens mid-acquisition used to draw only the seconds since its own
 * socket opened, because the browser keeps history in memory. These points are
 * already past, so they carry their own timestamps and skip the freshness gate
 * that would otherwise reject every one of them as stale. Nothing is
 * interpolated: a gap in the buffer stays a gap.
 */
export function backfilledSnapshots(payload, now = Date.now()) {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  const source = ['device','core','mock','demo','replay'].includes(payload?.source)
    ? payload.source : 'device';
  const transport = typeof payload?.transport === 'string' && payload.transport !== 'none'
    ? payload.transport : null;
  const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : null;
  const connectionEpoch = Number.isInteger(payload?.connectionEpoch) ? payload.connectionEpoch : null;
  const rows = [];
  for (const point of points) {
    if (!finite(point?.ts) || point.ts <= 0) continue;
    const timestamp = point.ts * 1000;
    if (timestamp < now - HISTORY_WINDOW_MS || timestamp > now + 1000) continue;
    const read = value => Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
    const attention = read(point.attention), relaxation = read(point.meditation);
    const spectralBands = Object.fromEntries(HISTORY_BANDS.map(key => [key, positive(point.bands?.[key])]));
    const sum = (low, high) => spectralBands[low] !== null && spectralBands[high] !== null
      ? spectralBands[low] + spectralBands[high] : null;
    const bands = { delta: spectralBands.delta, theta: spectralBands.theta,
      alpha: sum('lowAlpha','highAlpha'), beta: sum('lowBeta','highBeta') };
    const fieldTimestamps = { attention: point.ts, meditation: point.ts };
    for (const key of HISTORY_BANDS) fieldTimestamps[key] = point.ts;
    fieldTimestamps.alpha = point.ts; fieldTimestamps.beta = point.ts;
    // Same rule as live frames: ThinkGear reserves zero for "not computed".
    const available = attention > 0 && relaxation > 0;
    rows.push({
      timestamp, originalTimestamp: timestamp, source, sessionId, transport, connectionEpoch,
      attention, relaxation, bands, spectralBands,
      packets: Number.isSafeInteger(point.packets) ? point.packets : 0,
      ratios: { focus: null, relaxation: null }, bandUnits: 'ThinkGear relative power',
      metricOrigin: 'thinkgear-esense', indexTimestamp: timestamp,
      indexSampleKey: JSON.stringify([point.ts, point.ts]), originalIndexTimestamp: timestamp,
      poorSignal: Number.isInteger(point.poorSignal) ? point.poorSignal : null,
      signalQuality: available ? 'good' : 'unknown',
      transportFresh: true, signalValid: available, valid: available, backfilled: true,
      raw: { ts: point.ts, transport, fieldTimestamps },
    });
  }
  rows.sort((a, b) => a.timestamp - b.timestamp);
  return { identity: JSON.stringify([source, sessionId, transport, connectionEpoch]), points: rows };
}

/** The heartbeat is not proof of incoming hardware samples. */
export class StreamState {
  constructor() { this.reset(); }
  reset() { this.latest = null; this.lastAdvance = 0; this.lastPackets = null; this.lastTimestamp = -Infinity; this.identity=null;this.clock=new PacketClock();this.checkedAt=-Infinity; }
  accept(input, now = observationNow()) {
    input=this.clock.map(input,now);
    if(!input)return false;
    const snapshot = normalizeSnapshot(input, now);
    if(snapshot.timestamp>now+5000)return false;
    const identity=JSON.stringify([snapshot.source,snapshot.sessionId,snapshot.transport,snapshot.connectionEpoch]);
    if(this.identity!==identity){
      this.latest=null;this.lastAdvance=0;this.lastPackets=null;this.lastTimestamp=-Infinity;
      this.identity=identity;this.checkedAt=-Infinity;
    }
    if (snapshot.timestamp <= this.lastTimestamp) return false;
    if (snapshot.packets !== this.lastPackets) this.lastAdvance = now;
    this.lastPackets = snapshot.packets;
    this.lastTimestamp = snapshot.timestamp;
    this.latest = snapshot;
    return true;
  }
  current(now = observationNow()) {
    if (!this.latest) return null;
    now=this.checkedAt=Math.max(this.checkedAt,now);
    const latest=normalizeSnapshot(this.latest.raw,now);
    const fresh = now - this.latest.timestamp <= STALE_MS
      && now - this.lastAdvance <= STALE_MS;
    return { ...latest, transportFresh: latest.transportFresh && fresh,
      signalValid: latest.signalValid && fresh,
      valid: latest.valid && fresh };
  }
}

export class LiveConnection {
  constructor({ onState, onSnapshot, socketFactory = url => new WebSocket(url),
    schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = handle => clearTimeout(handle),clock=observationNow,idleMs=10000 }) {
    Object.assign(this, { onState, onSnapshot, socketFactory, schedule, cancel,clock,idleMs });
    this.generation = 0; this.retry = 0; this.socket = null; this.timer = null;this.idleTimer=null;this.socketEpoch=0;
  }
  connect(endpoint) {
    const url = new URL(endpoint);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password)
      throw new Error('請填入不含帳密的 ws:// 或 wss:// 接口。');
    this.stop();
    this.endpoint = url.href; this.retry = 0;
    this.open(this.generation);
  }
  open(generation) {
    if (generation !== this.generation) return;
    this.onState(this.retry ? 'reconnecting' : 'connecting');
    let socket;
    try { socket = this.socketFactory(this.endpoint); } catch { this.queue(generation); return; }
    this.socket = socket;
    const epoch=++this.socketEpoch;
    const current=()=>generation===this.generation && epoch===this.socketEpoch && socket===this.socket;
    const watchdog=()=>{
      this.cancel(this.idleTimer);
      this.idleTimer=this.schedule(()=>{
        if(!current())return;
        this.socketEpoch++;socket.onclose=null;socket.close();
        this.onState('error','接口没有继续发送数据，正在重新连接。');
        this.queue(generation);
      },this.idleMs);
    };
    socket.onopen = () => { if (current()) { this.onState('connected');watchdog(); } };
    socket.onmessage = event => {
      if (!current()) return;
      try {
        if (typeof event.data !== 'string' || event.data.length > 131072)
          throw new Error('無效或過大的腦波封包。');
        this.onSnapshot(JSON.parse(event.data));
        this.retry=0;watchdog();
      } catch (error) { this.onState('invalid', error.message); }
    };
    socket.onerror = () => { if (current()) this.onState('error'); };
    socket.onclose = () => { if (current()) {this.socketEpoch++;this.cancel(this.idleTimer);this.queue(generation);} };
    watchdog();
  }
  queue(generation) {
    if(generation!==this.generation)return;
    this.cancel(this.timer);
    this.onState('reconnecting');
    const delay = Math.min(15000, 1000 * 2 ** this.retry++);
    this.timer = this.schedule(() => this.open(generation), delay);
  }
  stop() {
    this.generation += 1;
    this.socketEpoch++;
    this.cancel(this.timer); this.timer = null;
    this.cancel(this.idleTimer);this.idleTimer=null;
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null; }
    this.onState('stopped');
  }
}

export function demoSnapshot(attention, relaxation, tick, timestamp = observationNow()) {
  const alpha = 25 + relaxation * 0.22, beta = 14 + attention * 0.26;
  return { schemaVersion: SCHEMA, source: 'demo', ts: timestamp / 1000,
    quality: { eegPackets: tick + 1 }, attention, meditation: relaxation,
    eeg: { attention, meditation: relaxation, delta: 22 + 7 * Math.sin(tick / 8),
      theta: 28 + 9 * Math.sin(tick / 11), alpha, beta,
      lowAlpha: alpha * 0.55, highAlpha: alpha * 0.45,
      lowBeta: beta * 0.7, highBeta: beta * 0.3,
      lowGamma: 4 + 1.5 * Math.sin(tick / 4), midGamma: 2 + 0.8 * Math.cos(tick / 6) } };
}

export function validateRecording(parsed,{maxSamples=200000}={}) {
  if (!parsed || parsed.schemaVersion !== 'neural-resonance-recording-v1' || !Array.isArray(parsed.snapshots)
    || !parsed.snapshots.length || parsed.snapshots.length > maxSamples)
    throw new Error('請匯入有效的 EEG JSON 或 JSONL 記錄（1–200000 個樣本）。');
  let previous = -Infinity;
  for (const entry of parsed.snapshots) {
    normalizeSnapshot(entry, entry.ts * 1000);
    if (entry.ts <= previous) throw new Error('記錄時間戳必須依序遞增。');
    previous = entry.ts;
  }
  return parsed;
}
export function parseRecording(text,{maxBytes=20*1024*1024}={}) {
  if (new TextEncoder().encode(text).byteLength > maxBytes)
    throw new Error('記錄大於 20 MB，請先分段。');
  let parsed;
  try{parsed=parseUtf8Json(text);}catch{parsed=parseEEGSessionJsonl(text);}
  return validateRecording(parsed);
}
import {parseUtf8Json} from './json-io.mjs';
import {parseEEGSessionJsonl} from './eeg-session.mjs';
