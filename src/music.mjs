/** Explicit experimental mapping. Replace this module with a calibrated model. */
export const MAPPING_VERSION = 'eeg-music-rules-v2';
export const ELEMENTS = [
  ['melody', '旋律', 'MIDI'], ['rhythm', '節奏', '事件 / 小節'],
  ['harmony', '和聲', '% 張力'], ['dynamics', '力度', '/ 127'],
  ['tempo', '速度', 'BPM'], ['mode', '調式', '% 明亮傾向'],
  ['form', '曲式', '秒 / 樂句'], ['texture', '織體', '聲部'],
  ['timbre', '音色', '% 明亮度'], ['articulation', '演奏法', '% 延音'],
];
export function mapMusic(snapshot, { bpmMin = 48, bpmMax = 108 } = {}) {
  if (!snapshot?.valid) return null;
  if (!Number.isFinite(bpmMin) || !Number.isFinite(bpmMax) || bpmMin < 30
    || bpmMax > 180 || bpmMin >= bpmMax) throw new Error('速度需設定 30–180 BPM，且最低值小於最高值。');
  const a = snapshot.attention / 100, r = snapshot.relaxation / 100;
  const energy = 0.65 * a + 0.35 * (1 - r);
  return { mappingVersion: MAPPING_VERSION, source: snapshot.source, ts: snapshot.timestamp,
    config: { bpmMin, bpmMax },
    inputs: { attention: snapshot.attention, relaxation: snapshot.relaxation },
    parameters: {
      tempo: Math.round(bpmMin + (bpmMax - bpmMin) * energy),
      melody: Math.round(48 + 24 * a),
      rhythm: +(1 + 8 * a).toFixed(1),
      harmony: Math.round(10 + 55 * (1 - r)),
      dynamics: Math.round(32 + 58 * (0.45 * a + 0.55 * (1 - r))),
      mode: Math.round(20 + 60 * r),
      form: Math.round(8 + 24 * r),
      texture: Math.round(1 + 5 * energy),
      timbre: Math.round(15 + 70 * energy),
      articulation: Math.round(30 + 60 * r),
    },
  };
}

export function pointFor(snapshot) {
  return snapshot?.valid ? { x: snapshot.attention / 100, y: 1 - snapshot.relaxation / 100 } : null;
}

/** Audio is opt-in and always muted on an invalid or interrupted stream. */
export class AudioPreview {
  async start() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('此瀏覽器不支援聲音預覽。');
    this.context ??= new Audio();
    await this.context.resume();
    if (!this.oscillator) {
      this.oscillator = this.context.createOscillator();
      this.gain = this.context.createGain();
      this.oscillator.type = 'sine'; this.gain.gain.value = 0;
      this.oscillator.connect(this.gain).connect(this.context.destination);
      this.oscillator.start();
    }
    this.enabled = true;
  }
  update(mapping) {
    if (!this.context || !this.gain) return;
    const t = this.context.currentTime;
    if (!mapping || !this.enabled) { this.gain.gain.setTargetAtTime(0, t, .08); return; }
    const p = mapping.parameters;
    this.oscillator.frequency.setTargetAtTime(440 * 2 ** ((p.melody - 69) / 12), t, .3);
    this.gain.gain.setTargetAtTime(Math.min(.055, p.dynamics / 127 * .05), t, .2);
  }
  mute() { this.enabled = false; this.update(null); }
}
