/** Report music observations with provenance; EEG indices never supply music values. */
export const MAPPING_VERSION = 'music-evidence-v3';
export const ELEMENTS = [
  ['melody', '旋律', 'MIDI'], ['rhythm', '節奏', '事件 / 小節'],
  ['harmony', '和聲', '標注'], ['dynamics', '力度／響度', '來源單位'],
  ['tempo', '速度', 'BPM'], ['mode', '調式', '標注'],
  ['form', '曲式', '標注'], ['texture', '織體', '聲部'],
  ['timbre', '音色', '標注'], ['articulation', '演奏法', '標注'],
];
const formats={
  melody:{units:['MIDI'],numeric:true,min:0,max:127},
  rhythm:{units:['events/bar','事件 / 小節'],numeric:true,min:0},
  harmony:{units:['label','和弦標注'],numeric:false},
  dynamics:{units:['dBFS','dB SPL','sone','MIDI velocity'],numeric:true},
  tempo:{units:['BPM'],numeric:true,min:Number.MIN_VALUE},
  mode:{units:['label','調式標注'],numeric:false},
  form:{units:['label','曲式標注'],numeric:false},
  texture:{units:['voices','聲部'],numeric:true,min:1},
  timbre:{units:['label','音色標注'],numeric:false},
  articulation:{units:['label','演奏法標注'],numeric:false},
};
const sourceTypes=['audio-analysis','midi-analysis','score-annotation','human-annotation'];
export function validSource(source){
  if(!source||!sourceTypes.includes(source.type))return false;
  if(!['id','uri','method'].every(key=>typeof source[key]==='string'
    &&source[key].trim().length>0&&source[key].length<=2048))return false;
  if(/^urn:sha256:[0-9a-f]{64}$/i.test(source.uri)
    ||/^file-id:[a-z0-9._/-]{1,256}$/i.test(source.uri))return true;
  try{
    const url=new URL(source.uri);
    return ['https:','http:'].includes(url.protocol)&&Boolean(url.hostname)
      &&!url.username&&!url.password;
  }catch{return false;}
}
export function mapMusic(snapshot) {
  if (!snapshot?.valid||![snapshot.attention,snapshot.relaxation].every(
    value=>Number.isFinite(value)&&value>=0&&value<=100)) return null;
  const bundle=snapshot.musicFeatures??snapshot.raw?.musicFeatures;
  const synchronized=bundle?.schemaVersion==='music-observations-v1'
    &&bundle.timestamp===snapshot.timestamp;
  const evidence=Object.fromEntries(ELEMENTS.map(([key])=>{
    const item=synchronized?bundle.values?.[key]:null,format=formats[key];
    const typed=format.numeric?Number.isFinite(item?.value)
      &&(format.min===undefined||item.value>=format.min)
      &&(format.max===undefined||item.value<=format.max)
      :typeof item?.value==='string'&&item.value.trim().length>0&&item.value.length<=256;
    const accepted=typed&&format.units.includes(item?.unit)&&validSource(item?.source)
      &&!(key==='dynamics'&&item.unit==='MIDI velocity'&&(item.value<0||item.value>127))
      &&!(key==='dynamics'&&item.unit==='sone'&&item.value<0)
      &&!(key==='texture'&&!Number.isInteger(item.value));
    return [key,accepted?{status:'reported',value:item.value,unit:item.unit,
      source:{id:item.source.id,type:item.source.type,uri:item.source.uri,method:item.source.method},
      timestamp:bundle.timestamp,verification:'source-declared-not-independently-validated'}
      :{status:'unavailable',value:null,unit:null,source:null,
        reason:'缺少同一時刻、帶來源與方法的音樂觀測。'}];
  }));
  return {mappingVersion:MAPPING_VERSION,source:snapshot.source,ts:snapshot.timestamp,
    inputs:{attention:snapshot.attention,relaxation:snapshot.relaxation},
    parameters:Object.fromEntries(ELEMENTS.map(([key])=>[key,evidence[key].value])),
    evidence,claimsInferredFromEeg:false};
}

export function pointFor(snapshot) {
  return snapshot?.valid ? { x: snapshot.attention / 100, y: snapshot.relaxation / 100 } : null;
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
    if (!mapping || !this.enabled||mapping.evidence?.melody?.status!=='reported'
      ||mapping.evidence?.dynamics?.unit!=='MIDI velocity') {
      this.gain.gain.setTargetAtTime(0, t, .08); return;
    }
    const p = mapping.parameters;
    this.oscillator.frequency.setTargetAtTime(440 * 2 ** ((p.melody - 69) / 12), t, .3);
    this.gain.gain.setTargetAtTime(Math.min(.055, p.dynamics / 127 * .05), t, .2);
  }
  mute() { this.enabled = false; this.update(null); }
}
