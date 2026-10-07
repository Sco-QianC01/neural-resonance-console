import {normalizeSnapshot} from './eeg.mjs';
/** Preserve the native packet fields needed by normalizeSnapshot on replay. */
export function captureSnapshot(packet, snapshot, networks=null) {
  return {
    schemaVersion: packet.schemaVersion, ts: packet.ts, source: snapshot.source,
    sessionId: snapshot.sessionId, originalTimestamp: snapshot.originalTimestamp,
    attention: packet.attention ?? null, meditation: packet.meditation ?? null,
    inputs: snapshot.valid ? {attention:snapshot.attention,relaxation:snapshot.relaxation} : null,
    eeg: packet.eeg ?? null, quality: packet.quality ?? null, networks,
    rawEegSamples: packet.rawEegSamples ?? packet.eeg?.rawSamples ?? [],
    rawUnit: packet.rawUnit ?? '',
  };
}
export function recordingCsv(records) {
  const header=['ts','source','attention','meditation','focus_ratio','relaxation_ratio',
    'delta','theta','alpha','beta','signal_valid','raw_unit','raw_samples'];
  const quote=value=>{
    const text=String(value??'');
    return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
  };
  return [header.join(','),...records.map(packet=>{
    const native=normalizeSnapshot(packet,packet.ts*1000);
    return [packet.ts,packet.source,native.attention,native.relaxation,
      native.ratios.focus,native.ratios.relaxation,
      ...['delta','theta','alpha','beta'].map(key=>native.bands[key]),
      native.signalValid,packet.rawUnit,JSON.stringify(packet.rawEegSamples??[]),
    ].map(quote).join(',');
  })].join('\r\n');
}
