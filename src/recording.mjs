import {normalizeSnapshot} from './eeg.mjs';
/** Preserve the native packet fields needed by normalizeSnapshot on replay. */
export function captureSnapshot(packet, snapshot, networks=null) {
  return {
    schemaVersion: packet.schemaVersion, ts: packet.ts, source: snapshot.source,
    metricOrigin: snapshot.metricOrigin,
    transport: packet.transport ?? null, connectionEpoch: packet.connectionEpoch ?? null,
    fieldTimestamps: packet.fieldTimestamps ?? null, sampleRate: packet.sampleRate ?? null,
    originalFieldTimestamps: packet.originalFieldTimestamps ?? packet.fieldTimestamps ?? null,
    rawSequence: packet.rawSequence ?? null, rawDropped: packet.rawDropped ?? 0,
    sessionId: snapshot.sessionId, originalTimestamp: snapshot.originalTimestamp,
    attention: packet.attention ?? null, meditation: packet.meditation ?? null,
    inputs: snapshot.valid ? {attention:snapshot.attention,relaxation:snapshot.relaxation} : null,
    eeg: packet.eeg ?? null, quality: packet.quality ?? null, networks,
    musicFeatures:packet.musicFeatures?structuredClone(packet.musicFeatures):null,
    creativeIntent:packet.creativeIntent?structuredClone(packet.creativeIntent):null,
    bandUnits:packet.bandUnits??null,
    bandRanges:packet.bandRanges?structuredClone(packet.bandRanges):null,
    rawEegSamples: packet.rawEegSamples ?? packet.eeg?.rawSamples ?? [],
    rawUnit: packet.rawUnit ?? '',
  };
}
/** Shift replay clocks together, retaining both the original time and field ages. */
export function replayPacket(packet,now=Date.now()){
  const shift=now/1000-packet.ts;
  const timestamp=(now/1000)*1000;
  return {...packet,source:'replay',originalTimestamp:packet.originalTimestamp??packet.ts*1000,ts:now/1000,
    musicFeatures:packet.musicFeatures?{
      ...packet.musicFeatures,originalTimestamp:packet.musicFeatures.originalTimestamp??packet.musicFeatures.timestamp,
      timestamp:packet.musicFeatures.timestamp===packet.ts*1000?timestamp:packet.musicFeatures.timestamp,
    }:null,
    creativeIntent:packet.creativeIntent?{
      ...structuredClone(packet.creativeIntent),
      originalTimestamp:packet.creativeIntent.originalTimestamp??packet.creativeIntent.timestamp,
      timestamp:packet.creativeIntent.timestamp===packet.ts*1000?timestamp:packet.creativeIntent.timestamp,
    }:null,
    originalFieldTimestamps:packet.originalFieldTimestamps??packet.fieldTimestamps??null,
    fieldTimestamps:packet.fieldTimestamps?Object.fromEntries(Object.entries(packet.fieldTimestamps)
      .map(([key,value])=>[key,typeof value==='number'&&Number.isFinite(value)?value+shift:value])):null};
}
export function recordingCsv(records) {
  const header=['ts','source','attention','meditation','focus_ratio','relaxation_ratio',
    'delta','theta','alpha','beta','signal_valid','indices_valid','raw_unit','raw_samples',
    'transport','connection_epoch','sample_rate','raw_dropped','band_units','music_observations_json',
    'creative_intent_json'];
  const quote=value=>{
    const text=String(value??'');
    return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
  };
  return [header.join(','),...records.map(packet=>{
    const native=normalizeSnapshot(packet,packet.ts*1000);
    return [packet.ts,packet.source,native.attention,native.relaxation,
      native.ratios.focus,native.ratios.relaxation,
      ...['delta','theta','alpha','beta'].map(key=>native.bands[key]),
      native.signalValid,native.valid,packet.rawUnit,JSON.stringify(packet.rawEegSamples??[]),
      packet.transport,packet.connectionEpoch,packet.sampleRate,packet.rawDropped,
      packet.bandUnits,JSON.stringify(packet.musicFeatures??null),JSON.stringify(packet.creativeIntent??null),
    ].map(quote).join(',');
  })].join('\r\n');
}
