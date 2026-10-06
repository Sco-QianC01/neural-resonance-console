const finite = value => typeof value === 'number' && Number.isFinite(value);
export const SENSOR_FIELDS = {
  spo2: { label: '血氧飽和度', unit: '%', count: 'spo2Samples', valid: v => finite(v) && v > 0 && v <= 100 },
  pr: { label: '脈率', unit: '次／分', count: 'prSamples', valid: v => finite(v) && v > 0 },
  hrv: { label: 'HRV', unit: '來源原始值', count: 'hrvSamples', valid: v => finite(v) && v > 0 },
  gsr: { label: '皮膚電反應', unit: '來源原始值', count: 'gsrSamples', valid: v => finite(v) && v >= 0 },
};

/** Non-EEG channels have their own freshness; an EEG outage must not hide SpO2. */
export class SensorState {
  constructor() { this.reset(); }
  reset() { this.packet = null; this.progress = {}; this.lastTimestamp = -Infinity; }
  accept(packet, now = Date.now()) {
    if (!finite(packet?.ts) || packet.ts <= this.lastTimestamp) return false;
    this.lastTimestamp = packet.ts; this.packet = packet;
    for (const [key, field] of Object.entries(SENSOR_FIELDS)) {
      const count = packet.quality?.[field.count];
      const previous = this.progress[key];
      if (finite(count) && (!previous || count !== previous.count))
        this.progress[key] = { count, advancedAt: now };
    }
    return true;
  }
  current(now = Date.now()) {
    const packet = this.packet;
    const age = packet ? now - packet.ts * 1000 : Infinity;
    const transportFresh = age >= -5000 && age <= 3000;
    return Object.fromEntries(Object.entries(SENSOR_FIELDS).map(([key, field]) => {
      const progress = this.progress[key];
      const hasCount = finite(packet?.quality?.[field.count]);
      // The API already clears values after 15 seconds. Also reject a stuck
      // counter even if a faulty producer keeps sending fresh heartbeats.
      const valid = transportFresh && field.valid(packet?.[key])
        && (!hasCount || (progress?.count > 0 && now - progress.advancedAt <= 15000));
      return [key, { value: valid ? packet[key] : null, count: progress?.count ?? null,
        valid, age: transportFresh ? age / 1000 : null }];
    }));
  }
}
