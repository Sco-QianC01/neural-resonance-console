export const SCHEMA = 'neural-resonance-live-v1';
const supportedSchemas = [SCHEMA, 'frontal-live-v1'];
export const STALE_MS = 3000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const index = value => finite(value) && value >= 0 && value <= 100 ? value : null;
const positive = value => finite(value) && value >= 0 ? value : null;

/** Read native fields without turning USB spectral ratios into device scores. */
export function normalizeSnapshot(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || !supportedSchemas.includes(input.schemaVersion))
    throw new Error('不支援的資料格式；請使用 neural-resonance-live-v1。');
  if (!finite(input.ts)) throw new Error('缺少有效的時間戳。');
  const timestamp = input.ts * 1000;
  const age = now - timestamp;
  const eeg = input.eeg && typeof input.eeg === 'object' ? input.eeg : {};
  const fieldFresh = key => !input.fieldTimestamps || !Object.hasOwn(input.fieldTimestamps,key)
    || (finite(input.fieldTimestamps[key]) && now-input.fieldTimestamps[key]*1000>=-5000
        && now-input.fieldTimestamps[key]*1000<=STALE_MS);
  const has = key => Object.hasOwn(eeg, key);
  // The core's top-level fields can alias focus_index/relaxation_index. They
  // are ratios, not a calibrated 0–100 score; preserve them separately.
  const attention = fieldFresh('attention') ? index(has('attention') ? eeg.attention
    : has('focus_index') ? null : input.attention) : null;
  const relaxation = fieldFresh('meditation') ? index(has('meditation') ? eeg.meditation
    : has('relaxation_index') ? null : input.meditation) : null;
  const metricOrigin = input.metricOrigin==='thinkgear-esense' ? 'thinkgear-esense' : 'device-index';
  // ThinkGear reserves zero for an unavailable eSense computation. Other
  // adapters and the explicit demo can still define valid zero-valued indices.
  const indicesAvailable = metricOrigin!=='thinkgear-esense' || (attention>0 && relaxation>0);
  const packets = positive(input.quality?.eegPackets) ?? 0;
  const poorSignal = positive(eeg.poor_signal ?? eeg.poorSignal);
  const transportFresh = age >= -5000 && age <= STALE_MS && packets > 0;
  const signalValid = transportFresh && !(poorSignal !== null && poorSignal > 0);
  const bands = Object.fromEntries(['delta', 'theta', 'alpha', 'beta'].map(key => {
    const direct = positive(eeg[`${key}_mean`]) ?? positive(eeg[key]);
    const low = positive(eeg[`low${key[0].toUpperCase()}${key.slice(1)}`]);
    const high = positive(eeg[`high${key[0].toUpperCase()}${key.slice(1)}`]);
    return [key, direct ?? (low !== null && high !== null ? low + high : null)];
  }));
  return {
    timestamp, originalTimestamp: input.originalTimestamp ?? timestamp,
    source: ['device', 'core', 'mock', 'demo', 'replay'].includes(input.source) ? input.source : 'unknown',
    sessionId: typeof input.sessionId === 'string' ? input.sessionId : null,
    transport: input.transport ?? null, connectionEpoch: input.connectionEpoch ?? null,
    attention, relaxation, bands, packets,
    ratios: { focus: positive(eeg.focus_index), relaxation: positive(eeg.relaxation_index) },
    bandUnits: typeof input.bandUnits==='string'&&input.bandUnits.length<=80?input.bandUnits
      :input.source==='demo'?'合成示範相對值':'來源頻段值 · 單位未回報',
    metricOrigin,
    transportFresh, signalValid, valid: signalValid && attention !== null && relaxation !== null && indicesAvailable,
    raw: input,
  };
}

/** The heartbeat is not proof of incoming hardware samples. */
export class StreamState {
  constructor() { this.reset(); }
  reset() { this.latest = null; this.lastAdvance = 0; this.lastPackets = null; this.lastTimestamp = -Infinity; this.identity=null; }
  accept(input, now = Date.now()) {
    const snapshot = normalizeSnapshot(input, now);
    const identity=JSON.stringify([snapshot.source,snapshot.sessionId,snapshot.transport,snapshot.connectionEpoch]);
    if(this.identity!==identity){this.reset();this.identity=identity;}
    if (snapshot.timestamp <= this.lastTimestamp) return false;
    if (snapshot.packets !== this.lastPackets) this.lastAdvance = now;
    this.lastPackets = snapshot.packets;
    this.lastTimestamp = snapshot.timestamp;
    this.latest = snapshot;
    return true;
  }
  current(now = Date.now()) {
    if (!this.latest) return null;
    const fresh = now - this.latest.timestamp <= STALE_MS
      && now - this.lastAdvance <= STALE_MS;
    return { ...this.latest, transportFresh: this.latest.transportFresh && fresh,
      signalValid: this.latest.signalValid && fresh,
      valid: this.latest.valid && fresh };
  }
}

export class LiveConnection {
  constructor({ onState, onSnapshot, socketFactory = url => new WebSocket(url),
    schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = handle => clearTimeout(handle),clock=()=>Date.now(),idleMs=10000 }) {
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

export function demoSnapshot(attention, relaxation, tick, timestamp = Date.now()) {
  return { schemaVersion: SCHEMA, source: 'demo', ts: timestamp / 1000,
    quality: { eegPackets: tick + 1 }, attention, meditation: relaxation,
    eeg: { attention, meditation: relaxation, delta: 22 + 7 * Math.sin(tick / 8),
      theta: 28 + 9 * Math.sin(tick / 11), alpha: 25 + relaxation * 0.22,
      beta: 14 + attention * 0.26 } };
}

export function parseRecording(text) {
  if (text.length > 20 * 1024 * 1024) throw new Error('記錄大於 20 MB，請先分段。');
  const parsed = JSON.parse(text);
  if (parsed.schemaVersion !== 'neural-resonance-recording-v1' || !Array.isArray(parsed.snapshots)
    || !parsed.snapshots.length || parsed.snapshots.length > 20000)
    throw new Error('請匯入本控制台導出的記錄（1–20000 個樣本）。');
  let previous = -Infinity;
  for (const entry of parsed.snapshots) {
    normalizeSnapshot(entry, entry.ts * 1000);
    if (entry.ts <= previous) throw new Error('記錄時間戳必須依序遞增。');
    previous = entry.ts;
  }
  return parsed;
}
