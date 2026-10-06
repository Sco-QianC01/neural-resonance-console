/** Explicit experimental mapping. Replace this module with a calibrated model. */
export const MAPPING_VERSION = 'eeg-music-rules-v1';
export const ELEMENTS = [
  ['tempo', '速度', 'BPM'], ['rhythmDensity', '節奏密度', '/ 10'],
  ['pitchCenter', '音高中心', 'MIDI'], ['pitchRange', '音域', '半音'],
  ['dynamics', '力度', '/ 127'], ['timbreBrightness', '音色明亮度', '%'],
  ['harmonyTension', '和聲張力', '%'], ['articulation', '發音長度', '%'],
  ['spatialWidth', '空間寬度', '%'], ['transitionSeconds', '過渡時間', '秒'],
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
      rhythmDensity: +(1 + 8 * a).toFixed(1),
      pitchCenter: Math.round(48 + 24 * a),
      pitchRange: Math.round(7 + 17 * a),
      dynamics: Math.round(32 + 58 * energy),
      timbreBrightness: Math.round(15 + 70 * energy),
      harmonyTension: Math.round(10 + 55 * (1 - r)),
      articulation: Math.round(30 + 60 * r),
      spatialWidth: Math.round(25 + 65 * r),
      transitionSeconds: +(1 + 7 * r).toFixed(1),
    },
  };
}

export function pointFor(snapshot) {
  return snapshot?.valid ? { x: snapshot.attention / 100, y: 1 - snapshot.relaxation / 100 } : null;
}

export class Snake {
  constructor() { this.reset(); }
  reset() { this.head = { x: .5, y: .5 }; this.tail = []; this.score = 0; this.food = { x: .72, y: .35 }; this.stepIndex = 0; }
  step(snapshot, deltaSeconds, instant = false) {
    const target = pointFor(snapshot);
    if (!target) return;
    const distance = Math.hypot(target.x - this.head.x, target.y - this.head.y);
    const step = instant ? distance : Math.min(distance, Math.max(0, Math.min(deltaSeconds, .1)) * .22);
    if (distance > .005) {
      this.head = { x: this.head.x + (target.x - this.head.x) / distance * step,
        y: this.head.y + (target.y - this.head.y) / distance * step };
      this.tail.push({ ...this.head }); this.tail = this.tail.slice(-50);
    }
    if (Math.hypot(this.head.x - this.food.x, this.head.y - this.food.y) < .055) {
      this.score += 1; this.stepIndex += 1;
      this.food = { x: .15 + ((this.stepIndex * 37) % 71) / 100,
        y: .15 + ((this.stepIndex * 53) % 71) / 100 };
    }
  }
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
    this.oscillator.frequency.setTargetAtTime(440 * 2 ** ((p.pitchCenter - 69) / 12), t, .3);
    this.gain.gain.setTargetAtTime(Math.min(.055, p.dynamics / 127 * .05), t, .2);
  }
  mute() { this.enabled = false; this.update(null); }
}
