import {STALE_MS} from './eeg.mjs';
import {ELEMENTS,mapMusic} from './music.mjs';
import {networkStates,NETWORK_VERSION} from './neural-networks.mjs';
import {buildWormTrace,WORM_VERSION} from './worm-model.mjs';
import {SOURCE_IDS} from './research-sources.mjs';

const targets=['generic','ace-xl','shao','minimax','yue'];
const usable=s=>s?.valid && Number.isFinite(s.attention) && s.attention>=0 && s.attention<=100
  && Number.isFinite(s.relaxation) && s.relaxation>=0 && s.relaxation<=100;

/** Observation hand-off. Never prescribe ten musical values from two EEG indices. */
export function createMusicPrompt(history,{current,now=Date.now(),windowSeconds=60,target='generic',musicPlan=null}={}) {
  if(!targets.includes(target))throw new Error('不支援的音樂模型。');
  if(!Number.isFinite(windowSeconds)||windowSeconds<1||windowSeconds>600)
    throw new Error('觀察窗口需為 1–600 秒。');
  if(!usable(current)||now-current.timestamp>STALE_MS||now-current.timestamp< -5000)return null;
  // Keep the newest accepted snapshot for duplicate timestamps and never mix
  // another source or participant into this observation window.
  const candidates=[...history,current].filter(s=>s
    && s.source===current.source && s.sessionId===current.sessionId
    && s.transport===current.transport && s.connectionEpoch===current.connectionEpoch
    && s.timestamp>=now-windowSeconds*1000 && s.timestamp<=current.timestamp);
  const ordered=[...new Map(candidates.map(s=>[s.timestamp,s])).values()]
    .sort((a,b)=>a.timestamp-b.timestamp);
  const trace=buildWormTrace(ordered,{now,windowSeconds,space:'eeg',smoothingSeconds:0});
  const accepted=new Set(trace.points.map(p=>p.timestamp));
  const samples=ordered.filter(p=>accepted.has(p.timestamp));
  if(!samples.length)return null;
  const mean=key=>+(samples.reduce((sum,s)=>sum+s[key],0)/samples.length).toFixed(2);
  const inputs={attention:mean('attention'),relaxation:mean('relaxation')};
  const mapping=mapMusic(current);
  const organizations=networkStates(current);
  const controls127=Object.fromEntries(ELEMENTS.map(([key])=>[key,null]));
  const longestGapSeconds=+(samples.slice(1).reduce((max,s,i)=>
    Math.max(max,(s.timestamp-samples[i].timestamp)/1000),0)).toFixed(3);
  const sourceLabel={demo:'合成示範資料',replay:'回放資料',device:'設備資料',core:'橋接資料'}[current.source]||'來源資訊';
  const observations=`${samples.length} 個有效樣本，跨度 ${((samples.at(-1).timestamp-samples[0].timestamp)/1000).toFixed(1)} 秒`;
  const descriptions=organizations.filter(item=>item.status==='reported').map(item=>
    `${item.label}：${item.value} ${item.unit}；記錄 ${item.source.id}；方法 ${item.source.method}`).join('；');
  const selectedPlan=musicPlan?.kind==='creative-intent'&&musicPlan.timestamp===current.timestamp
    ?structuredClone(musicPlan):null;
  const planText=selectedPlan?`\n創作方案：${selectedPlan.label}；${selectedPlan.origin==='manual'?'手動選擇':
    selectedPlan.origin==='recording'?'記錄方案':'規則 '+selectedPlan.ruleId}。`
    +ELEMENTS.map(([key,label])=>`${label}：${selectedPlan.values[key].text}`).join('；'):'';
  return {
    schemaVersion:'neural-observation-summary-v2',mappingVersion:mapping.mappingVersion,target,
    networkVersion:NETWORK_VERSION,wormVersion:WORM_VERSION,
    source:current.source,sessionId:current.sessionId,metricOrigin:current.metricOrigin,
    createdAt:new Date(now).toISOString(),windowSeconds,observedSamples:samples.length,
    firstTimestamp:samples[0].timestamp,lastTimestamp:samples.at(-1).timestamp,
    longestGapSeconds,observedCoverageSeconds:trace.stats.coverageSeconds,
    traceStatistics:trace.stats,inputs,parameters:mapping.parameters,controls127,
    organizations:organizations.map(s=>({key:s.key,value:s.value,unit:s.unit,status:s.status,
      source:s.source,description:s.description,verification:s.verification??null})),
    evidence:mapping.evidence,methodSources:SOURCE_IDS,claimsInferredFromEeg:false,
    musicPlan:selectedPlan,
    coordinates127:{attention:Math.round(inputs.attention/100*127),
      relaxation:Math.round(inputs.relaxation/100*127),center:64},
    text:`觀測摘要\n`
      +`來源：${sourceLabel}；${observations}；按樣本計算的專注指數均值 ${inputs.attention}/100，`
      +`冥想／放鬆指數均值 ${inputs.relaxation}/100；這些不是百分比。`
      +`\n實際連續觀察 ${trace.stats.coverageSeconds.toFixed(2)} 秒；缺失不補造。`
      +(descriptions?`\n音樂觀測：${descriptions}。`:'')+planText,
  };
}
