import {ELEMENTS,mapMusic} from './music.mjs';
export const NETWORK_VERSION='music-observation-panels-v3';
const requirements={
  melody:'需有音高／MIDI音符分析及方法記錄。',
  rhythm:'需有節拍、音符事件及拍號標注。',
  harmony:'需有和弦／和聲標注；不自行生成張力百分比。',
  dynamics:'需有聲明單位的音訊響度或MIDI力度。',
  tempo:'需有節拍時間或已標注的BPM。',
  mode:'需有調式標注及分析依據。',
  form:'需有曲式／樂段標注；不能用腦電推斷樂句長度。',
  texture:'需有可核對的聲部標注。',
  timbre:'需有音色／樂器標注；不自行生成明亮度百分比。',
  articulation:'需有演奏法標注或音符時值分析。',
};
/** Ten project annotation categories; no invented brain-connectivity geometry. */
export function networkStates(snapshot){
  const mapping=mapMusic(snapshot);
  if(!mapping)return null;
  return ELEMENTS.map(([key,label,unit],index)=>({
    key,label,index,unit:mapping.evidence[key].unit??unit,
    ...mapping.evidence[key],description:requirements[key],
    timestamp:snapshot.timestamp,dataSource:snapshot.source,version:NETWORK_VERSION,
    descriptor:mapping.evidence[key].status==='reported'
      ?'來源已聲明，方法待復核':'未觀測',
    control127:null,density:null,dispersion:null,nodeCount:0,shape:null,
  }));
}
// Retain the import contract for older clients, but never return synthetic meshes.
export function networkGeometry(){return {nodes:[],edges:[]};}
export function drawNetwork(canvas,state){
  const ctx=canvas.getContext('2d'),w=canvas.clientWidth||240,h=canvas.clientHeight||100;
  canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#90a6ae';ctx.font='12px system-ui';
  ctx.fillText(state?.status==='reported'?'查看來源記錄':'缺少音樂觀測',12,h/2);
}
