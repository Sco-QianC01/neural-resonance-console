import {parseUtf8Json} from '../../src/json-io.mjs';

export const ELEMENTS=[
  ['melody','旋律'],['rhythm','节奏'],['harmony','和声'],['dynamics','力度变化'],
  ['tempo','速度变化'],['mode','调性组织'],['form','曲式发展'],['texture','织体'],
  ['timbre','音色'],['articulation','演奏法'],
];
const finite=Number.isFinite;
const units=['BPM','eighth-notes/min','source-beats/min'];
const cleanText=(value,fallback)=>typeof value==='string'&&value.length<=512?value:fallback;

/** Descriptive per-sample statistics, not a validated musical dispersion scale. */
export function tempoStatistics(values,unit){
  if(!units.includes(unit)||!Array.isArray(values)||values.length>10000
    ||[...values].some(x=>x!==null&&(!finite(x)||x<=0||x>10000)))
    throw new Error('速度需有明确单位、正值样本，且最多10000项；缺失请用null。');
  const valid=values.filter(x=>x!==null),n=valid.length;
  if(!n)return null;
  const scale=Math.max(...valid);
  const scaledMean=valid.reduce((s,x)=>s+x/scale,0)/n;
  const scaledSd=Math.sqrt(valid.reduce((s,x)=>s+(x/scale-scaledMean)**2,0)/n);
  const mean=scaledMean*scale,sd=scaledSd*scale;
  const changes=values.slice(1).flatMap((x,i)=>x===null||values[i]===null?[]:[Math.abs(Math.log2(x)-Math.log2(values[i]))]);
  return {n,missing:values.length-n,unit,mean,sd,cv:n>=3?scaledSd/scaledMean:null,
    adjacentChangeMean:changes.length?changes.reduce((s,x)=>s+x,0)/changes.length:null,
    adjacentPairs:changes.length,method:'per-sample-population-sd-cv-v1',dispersionLevel:null};
}

export function readObservations(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>1048576)
    throw new Error('JSON文件需小于1 MiB。');
  const data=parseUtf8Json(text);
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('请输入JSON对象。');
  let neural=null,source,tempo=null,samples=null,windowSeconds=null,provenance=null;
  if(data.schemaVersion==='neural-observation-summary-v2'){
    const input=data.inputs;
    if(!input||!['attention','relaxation'].every(k=>finite(input[k])&&input[k]>=0&&input[k]<=100)
      ||!Number.isInteger(data.observedSamples)||data.observedSamples<1
      ||!finite(data.windowSeconds)||data.windowSeconds<=0||data.windowSeconds>600)
      throw new Error('神经观测摘要的指数、窗口或样本数无效。');
    neural={attention:input.attention,relaxation:input.relaxation};
    source={id:cleanText(data.source,'unattributed-import'),
      kind:data.source==='demo'?'demo':data.source==='replay'?'recording':'imported-neural-summary'};
    const nonnegative=n=>finite(n)&&n>=0?n:null;
    for(const key of ['firstTimestamp','lastTimestamp','observedCoverageSeconds']){
      if(data[key]!=null&&(!finite(data[key])||data[key]<0))
        throw new Error('观测时间与有效覆盖需为非负有限数，缺失请用null。');
    }
    provenance={schemaVersion:data.schemaVersion,sessionId:cleanText(data.sessionId,null),
      transport:cleanText(data.transport,null),createdAt:cleanText(data.createdAt,null),
      firstTimestamp:nonnegative(data.firstTimestamp),lastTimestamp:nonnegative(data.lastTimestamp),
      observedCoverageSeconds:nonnegative(data.observedCoverageSeconds)};
    if(provenance.firstTimestamp!==null&&provenance.lastTimestamp!==null
      &&provenance.firstTimestamp>provenance.lastTimestamp)
      throw new Error('观测首末时间次序无效。');
    const coverage=provenance.observedCoverageSeconds;
    const span=provenance.firstTimestamp!==null&&provenance.lastTimestamp!==null
      ?(provenance.lastTimestamp-provenance.firstTimestamp)/1000:null;
    if(coverage!==null&&(coverage>data.windowSeconds+1e-6
      ||span!==null&&coverage>span+1e-6||data.observedSamples===1&&coverage>1e-6))
      throw new Error('有效覆盖时间不能超过观察窗口或首末样本跨度；单个样本不构成连续覆盖。');
    samples=data.observedSamples;windowSeconds=data.windowSeconds;
  }else if(data.schemaVersion==='music-prompt-input-v1'){
    source={id:cleanText(data.source?.id,'unattributed-import'),kind:cleanText(data.source?.kind,'unknown'),
      reference:cleanText(data.source?.reference,null)};
    if(data.music?.tempo)tempo=tempoStatistics(data.music.tempo.values,data.music.tempo.unit);
    if(data.windowSeconds!==undefined){
      if(!finite(data.windowSeconds)||data.windowSeconds<=0||data.windowSeconds>600)
        throw new Error('观察窗口需为0–600秒之间的正值。');
      windowSeconds=data.windowSeconds;
    }
    samples=tempo?.n??null;
  }else throw new Error('支持music-prompt-input-v1或控制台导出的neural-observation-summary-v2。');
  return {source,provenance,neural,tempo,samples,windowSeconds,dispersionLevel:null,
    measuredMusic:tempo!==null,verification:'source-declared-not-independently-validated',
    claimsInferredFromEeg:false};
}

export function selectTags(intent,catalogue){
  if(!intent||!['solo-piano','chamber','ambient'].includes(intent.style)
    ||!Number.isInteger(intent.duration)||intent.duration<5||intent.duration>120
    ||intent.tempoBpm!==null&&intent.tempoBpm!==undefined
      &&(!finite(intent.tempoBpm)||intent.tempoBpm<20||intent.tempoBpm>300))
    throw new Error('请选择编制；时长为5–120整数秒；目标速度为20–300 BPM或留空。');
  const levels=intent.levels??{};
  if(!levels||typeof levels!=='object'||Array.isArray(levels)
    ||Object.keys(levels).some(key=>!ELEMENTS.some(([k])=>k===key))
    ||Object.values(levels).some(v=>v!==null&&(!Number.isInteger(v)||v<1||v>5)))
    throw new Error('十项创作档位只能是1–5整数或null。');
  const ids=[`style.${intent.style}`,...ELEMENTS.flatMap(([key])=>
    levels[key]==null?[]:[`${key}.${levels[key]}`]),'recording.clean'];
  return ids.map(id=>{
    const tag=catalogue.tags.find(t=>t.id===id);
    if(!tag)throw new Error('标签库缺少条目：'+id);
    return structuredClone(tag);
  });
}

/** Restore inputs only; saved prompts and model claims are not executable state. */
export function readWorkspace(text,catalogue){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>1048576)
    throw new Error('JSON文件需小于1 MiB。');
  const data=parseUtf8Json(text),saved=data?.schemaVersion==='music-prompt-result-v1';
  const input=saved?data.inputDocument:data;
  if(saved&&(!input||!['music-prompt-input-v1','neural-observation-summary-v2'].includes(input.schemaVersion)))
    throw new Error('此结果文件未保存支持的原始观测输入；请导入原始JSON，不能从统计摘要还原样本。');
  const observations=readObservations(saved?JSON.stringify(input):text);
  let inputDocument;
  if(input.schemaVersion==='neural-observation-summary-v2'){
    inputDocument={...observations.provenance,source:observations.source.id,
      observedSamples:observations.samples,windowSeconds:observations.windowSeconds,
      inputs:{...observations.neural}};
  }else{
    inputDocument={schemaVersion:'music-prompt-input-v1',source:{...observations.source},
      ...(observations.windowSeconds!==null?{windowSeconds:observations.windowSeconds}:{}),
      ...(input.music?.tempo?{music:{tempo:{values:[...input.music.tempo.values],unit:input.music.tempo.unit}}}:{})};
  }
  let intent=null;
  if(catalogue&&(saved||data.intent!==null&&data.intent!==undefined)){
    selectTags(data.intent,catalogue);
    intent={style:data.intent.style,duration:data.intent.duration,
      tempoBpm:data.intent.tempoBpm??null,levels:structuredClone(data.intent.levels??{})};
  }
  return {observations,inputDocument,intent};
}

export function validateOrder(order,ids){
  if(!Array.isArray(order)||order.length!==ids.length||new Set(order).size!==ids.length
    ||order.some(id=>!ids.includes(id)))throw new Error('模型输出有新增、重复或遗漏的标签，已拒绝。');
  return [...order];
}

export function compilePrompt({observations,inputDocument=null,intent,tags,order,engine='rules',model=null,inputHash=null,catalogueEvidence=null}){
  if(!['rules','ollama'].includes(engine))throw new Error('未知生成来源。');
  const approved=validateOrder(order,tags.map(t=>t.id));
  const text=approved.map(id=>tags.find(t=>t.id===id).phrase).join('; ')+'.'
    +(finite(intent.tempoBpm)?` Target tempo: ${intent.tempoBpm} BPM.`:'');
  return {schemaVersion:'music-prompt-result-v1',createdAt:new Date().toISOString(),
    inputHash,engine,model,observations:structuredClone(observations),
    ...(inputDocument?{inputDocument:structuredClone(inputDocument)}:{}),
    intent:{kind:'creative-intent',...structuredClone(intent),inferredFromEeg:false},
    tagIds:approved,catalogueVersion:'20261021-v1',promptEn:text,
    annotations:approved.map(id=>structuredClone(tags.find(t=>t.id===id))),
    catalogueEvidence:catalogueEvidence?structuredClone(catalogueEvidence):null,
    aceRequest:{ditModel:'acestep-v15-xl-sft',customMode:false,instrumental:true,title:'器乐创作',
      songDescription:text,style:text,lyrics:'',duration:intent.duration,
      ...(finite(intent.tempoBpm)?{bpm:intent.tempoBpm}:{}),
      batchSize:1,inferenceSteps:50,thinking:false,seed:1283,randomSeed:false,
      audioFormat:'mp3',taskType:'text2music'},
    sunoFields:{Style:text,Lyrics:'',Instrumental:true,
      Exclude:'vocals, singing, spoken voice, vinyl crackle, tape hiss, crowd noise'},
    remoteVerified:false,clinicalClaims:false,
    caveats:['创作档位不是生理测量或经过验证的音乐离散度量表。',
      '提示词是创作目标，生成后的速度、噪声与音乐品质仍需检验。',
      'ACE字段依据本地夜莺源代码；校内服务本轮未联调。']};
}
