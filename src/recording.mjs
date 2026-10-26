import {normalizeSnapshot} from './eeg.mjs';
import {SensorState} from './sensors.mjs';
import {observationNow} from './stream-clock.mjs';


/**
 * The one naming rule for a recording device label.
 *
 * Mirrors `safe_device_id()` in `gateway/eeg_recording.py` exactly, so the name
 * the operator sees in 01 is the name that lands in the .tgam header and file
 * name: keep ASCII letters, digits, dot, underscore and hyphen; collapse any
 * other run into a single hyphen; trim leading and trailing `-._`; cap at 64
 * characters; fall back to `unknown-device`. Sessions are written as
 * `eeg-<deviceId>-<YYYYMMDD-HHMMSS>[-NN].tgam`.
 */
export function normalizeDeviceId(value){
  const label=String(value??'').trim()
    .replace(/[^A-Za-z0-9._-]+/g,'-')
    .replace(/^[-._]+|[-._]+$/g,'');
  return label.slice(0,64)||'unknown-device';
}
/** True when typing the value would change it, so the operator can be told. */
export function deviceIdNeedsNormalizing(value){
  return String(value??'').trim()!==normalizeDeviceId(value);
}
/** Preserve the native packet fields needed by normalizeSnapshot on replay. */
export function captureSnapshot(packet, snapshot, networks=null) {
  const timed=snapshot.raw??packet;
  return structuredClone({
    schemaVersion: packet.schemaVersion, ts: snapshot.timestamp/1000, source: snapshot.source,
    packetSequence:packet.packetSequence??null,clock:packet.clock??null,
    originalClock:packet.originalClock??packet.clock??null,
    originalPacketSequence:packet.originalPacketSequence??packet.packetSequence??null,
    displayTimeBasis:timed.displayTimeBasis??null,
    fieldAgesMs:packet.fieldAgesMs??null,sensorAgesMs:packet.sensorAgesMs??null,
    ...(Object.hasOwn(packet,'indexPair')?{
      indexPair:timed.indexPair??null,originalIndexPair:packet.originalIndexPair??packet.indexPair??null,
    }:{}),
    pairMethod:snapshot.pairMethod,pairDeltaMs:snapshot.pairDeltaMs,
    metricOrigin: snapshot.metricOrigin,
    originalSource:packet.originalSource??snapshot.source,
    transport: packet.transport ?? null, connectionEpoch: packet.connectionEpoch ?? null,
    fieldTimestamps: timed.fieldTimestamps ?? null, sampleRate: packet.sampleRate ?? null,
    originalFieldTimestamps: packet.originalFieldTimestamps ?? packet.fieldTimestamps ?? null,
    sensorTimestamps:timed.sensorTimestamps??null,
    sensorSources:packet.sensorSources??null,
    sensorDetails:packet.sensorDetails??null,
    originalSensorTimestamps:packet.originalSensorTimestamps??packet.sensorTimestamps??null,
    rawSequence: packet.rawSequence ?? null, rawDropped: packet.rawDropped ?? 0,rawBreaks:packet.rawBreaks??[],
    sessionId: snapshot.sessionId, originalSessionId:packet.originalSessionId??snapshot.sessionId,
    originalTimestamp: snapshot.originalTimestamp,
    attention: packet.attention ?? null, meditation: packet.meditation ?? null,
    inputs: snapshot.valid ? {attention:snapshot.attention,relaxation:snapshot.relaxation} : null,
    eeg: packet.eeg ?? null, quality: packet.quality ?? null, networks,
    musicFeatures:packet.musicFeatures?structuredClone(packet.musicFeatures):null,
    creativeIntent:packet.creativeIntent?structuredClone(packet.creativeIntent):null,
    bandUnits:packet.bandUnits??null,
    bandRanges:packet.bandRanges?structuredClone(packet.bandRanges):null,
    rawEegSamples: packet.rawEegSamples ?? packet.eeg?.rawSamples ?? [],
    rawUnit: packet.rawUnit ?? '',
    spo2:packet.spo2??null,pr:packet.pr??null,hrv:packet.hrv??null,gsr:packet.gsr??null,
    lastSampleAt:timed.lastSampleAt??null,originalLastSampleAt:packet.originalLastSampleAt??packet.lastSampleAt??null,
  });
}
/** Shift replay clocks together, retaining both the original time and field ages. */
export function replayPacket(packet,now=observationNow(),runId=null){
  const shift=now/1000-packet.ts;
  const timestamp=(now/1000)*1000;
  return {...packet,source:'replay',originalSource:packet.originalSource??packet.source,
    clock:null,originalClock:packet.originalClock??packet.clock??null,
    originalPacketSequence:packet.originalPacketSequence??packet.packetSequence??null,
    ...(Object.hasOwn(packet,'indexPair')?{
      indexPair:packet.indexPair?{...packet.indexPair,at:packet.indexPair.at+shift}:null,
      originalIndexPair:packet.originalIndexPair??packet.indexPair??null,
    }:{}),
    sessionId:runId===null?packet.sessionId:runId,
    originalSessionId:packet.originalSessionId??packet.sessionId??null,
    originalTimestamp:packet.originalTimestamp??packet.ts*1000,ts:now/1000,
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
    originalSensorTimestamps:packet.originalSensorTimestamps??packet.sensorTimestamps??null,
    sensorTimestamps:packet.sensorTimestamps?Object.fromEntries(Object.entries(packet.sensorTimestamps)
      .map(([key,value])=>[key,typeof value==='number'&&Number.isFinite(value)?value+shift:value])):null,
    fieldTimestamps:packet.fieldTimestamps?Object.fromEntries(Object.entries(packet.fieldTimestamps)
      .map(([key,value])=>[key,typeof value==='number'&&Number.isFinite(value)?value+shift:value])):null};
}
export function recordingCsv(records) {
  const sensors=new SensorState();
  const header=['ts','source','attention','meditation','focus_ratio','relaxation_ratio',
    'delta','theta','alpha','beta','signal_valid','indices_valid','raw_unit','raw_samples',
    'transport','connection_epoch','sample_rate','raw_dropped','band_units','music_observations_json',
    'creative_intent_json','spo2','pr','hrv','gsr','original_source','sensor_timestamps_json',
    'low_alpha','high_alpha','low_beta','high_beta','low_gamma','mid_gamma','raw_sequence','field_timestamps_json','raw_breaks_json',
    'sensor_sources_json','sensor_details_json','packet_sequence','original_ts','clock_json',
    'index_pair_json','original_index_pair_json','pair_method','pair_delta_ms','field_ages_ms_json','sensor_ages_ms_json'];
  const quote=value=>{
    const text=String(value??'');
    return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
  };
  return [header.join(','),...records.map(packet=>{
    const native=normalizeSnapshot(packet,packet.ts*1000);
    sensors.accept(packet,packet.ts*1000);
    const sensor=sensors.current(packet.ts*1000);
    return [packet.ts,packet.source,native.attention,native.relaxation,
      native.ratios.focus,native.ratios.relaxation,
      ...['delta','theta','alpha','beta'].map(key=>native.bands[key]),
      native.signalValid,native.valid,packet.rawUnit,JSON.stringify(packet.rawEegSamples??[]),
      packet.transport,packet.connectionEpoch,packet.sampleRate,packet.rawDropped,
      packet.bandUnits,JSON.stringify(packet.musicFeatures??null),JSON.stringify(packet.creativeIntent??null),
      sensor.spo2.value,sensor.pr.value,sensor.hrv.value,sensor.gsr.value,packet.originalSource??packet.source,
      JSON.stringify(packet.sensorTimestamps??null),
      ...['lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma'].map(key=>native.spectralBands[key]),
      packet.rawSequence,JSON.stringify(packet.fieldTimestamps??null),JSON.stringify(packet.rawBreaks??[]),
      JSON.stringify(packet.sensorSources??null),JSON.stringify(packet.sensorDetails??null),
      packet.packetSequence,packet.originalTimestamp,JSON.stringify(packet.clock??packet.originalClock??null),
      JSON.stringify(packet.indexPair??null),JSON.stringify(packet.originalIndexPair??null),
      native.pairMethod,native.pairDeltaMs,JSON.stringify(packet.fieldAgesMs??null),JSON.stringify(packet.sensorAgesMs??null),
    ].map(quote).join(',');
  })].join('\r\n');
}

/** A BOM lets desktop spreadsheet applications identify UTF-8 Chinese reliably. */
export function spreadsheetCsv(records){
  return '\ufeff'+recordingCsv(records);
}
