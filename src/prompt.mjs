import {STALE_MS} from './eeg.mjs';
import {ELEMENTS,mapMusic} from './music.mjs';

const targets=['generic','ace-xl','shao','minimax','yue'];
const ranges={melody:[48,72],rhythm:[1,9],harmony:[10,65],dynamics:[32,90],
  tempo:[48,108],mode:[20,80],form:[8,32],texture:[1,6],timbre:[15,85],articulation:[30,90]};
const usable=s=>s?.valid && Number.isFinite(s.attention) && s.attention>=0 && s.attention<=100
  && Number.isFinite(s.relaxation) && s.relaxation>=0 && s.relaxation<=100;

/** Manual hand-off, with no remote call and no inferred emotion or diagnosis. */
export function createMusicPrompt(history,{current,now=Date.now(),windowSeconds=60,target='generic'}={}) {
  if(!targets.includes(target))throw new Error('不支援的音樂模型。');
  if(!Number.isFinite(windowSeconds)||windowSeconds<1||windowSeconds>600)
    throw new Error('觀察窗口需為 1–600 秒。');
  if(!usable(current)||now-current.timestamp>STALE_MS||now-current.timestamp< -5000)return null;
  // Keep the newest accepted snapshot for duplicate timestamps and never mix
  // another source or participant into this observation window.
  const candidates=[...history,current].filter(s=>usable(s)
    && s.source===current.source && s.sessionId===current.sessionId
    && s.timestamp>=now-windowSeconds*1000 && s.timestamp<=current.timestamp);
  const samples=[...new Map(candidates.map(s=>[s.timestamp,s])).values()]
    .sort((a,b)=>a.timestamp-b.timestamp);
  if(!samples.length)return null;
  const mean=key=>+(samples.reduce((sum,s)=>sum+s[key],0)/samples.length).toFixed(2);
  const inputs={attention:mean('attention'),relaxation:mean('relaxation')};
  const mapping=mapMusic({...current,...inputs});
  const controls127=Object.fromEntries(ELEMENTS.map(([key])=>{
    const [min,max]=ranges[key];
    return [key,Math.round(Math.max(0,Math.min(1,(mapping.parameters[key]-min)/(max-min)))*127)];
  }));
  const longestGapSeconds=+(samples.slice(1).reduce((max,s,i)=>
    Math.max(max,(s.timestamp-samples[i].timestamp)/1000),0)).toFixed(3);
  const sourceLabel={demo:'示範資料',replay:'回放資料',device:'設備資料',core:'橋接資料'}[current.source]||'來源待核對';
  const observations=`${samples.length} 個有效樣本，跨度 ${((samples.at(-1).timestamp-samples[0].timestamp)/1000).toFixed(1)} 秒`;
  const units={melody:' MIDI',rhythm:' 事件/小節',harmony:'% 張力',dynamics:'/127',
    tempo:' BPM',mode:'% 明亮傾向',form:' 秒/樂句',texture:' 聲部',timbre:'% 明亮度',articulation:'% 延音'};
  const descriptions=ELEMENTS.map(([key,label])=>`${label}：${mapping.parameters[key]}${units[key]}`).join('；');
  return {
    schemaVersion:'neural-music-prompt-v1',mappingVersion:mapping.mappingVersion,target,
    source:current.source,sessionId:current.sessionId,metricOrigin:current.metricOrigin,
    createdAt:new Date(now).toISOString(),windowSeconds,observedSamples:samples.length,
    firstTimestamp:samples[0].timestamp,lastTimestamp:samples.at(-1).timestamp,
    longestGapSeconds,inputs,parameters:mapping.parameters,controls127,
    coordinates127:{attention:Math.round(inputs.attention/100*127),
      relaxation:Math.round(inputs.relaxation/100*127),center:64},
    text:`請按以下十項控制量創作一段純音樂，避免人聲；保留樂句呼吸與清晰聲部分工。\n${descriptions}。\n`
      +`依據：${sourceLabel}；${observations}；專注度均值 ${inputs.attention}/100，放鬆度均值 ${inputs.relaxation}/100。`
      +`此為 ${mapping.mappingVersion} 實驗映射，不能據此推斷情緒、疾病或療效；不補造缺失資料。`,
  };
}
