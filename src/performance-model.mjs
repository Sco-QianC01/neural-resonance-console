export const MUSIC_LAYERS=[
  {key:'melody',name:'旋律',en:'Melody',unit:'譜面'},
  {key:'rhythm',name:'節奏',en:'Rhythm',unit:'ms',metric:true},
  {key:'harmony',name:'和聲',en:'Harmony',unit:'譜面'},
  {key:'dynamics',name:'力度',en:'Dynamics',unit:'dBFS',metric:true},
  {key:'tempo',name:'速度',en:'Tempo',unit:'♪/min',metric:true},
  {key:'mode',name:'調式',en:'Mode',unit:'標注'},
  {key:'form',name:'曲式',en:'Form',unit:'標注'},
  {key:'texture',name:'織體',en:'Texture',unit:'配器'},
  {key:'timbre',name:'音色',en:'Timbre',unit:'Hz',metric:true},
  {key:'articulation',name:'演奏法',en:'Articulation',unit:'譜面'},
];
export function validatePerformance(data){
  if(data?.schema!=='performance-observations-v1'||!Number.isFinite(data.duration)||data.duration<=0
    ||!Array.isArray(data.rows)||!data.rows.length)throw new Error('演奏資料格式無效');
  let end=-Infinity;
  for(const p of data.rows){
    if(!Number.isFinite(p.t)||!Number.isFinite(p.end)||p.t<end||p.t<0||p.end<=p.t||p.end>data.duration
      ||!['tempo','rhythm','dynamics','timbre'].every(k=>Number.isFinite(p[k])))
      throw new Error('演奏觀測時間或數值無效');
    end=p.end;
  }
  return data;
}
export function observationAt(data,time){
  return data?.rows.find(p=>p.t<=time&&time<p.end)??null;
}
/** Interval observations are held over [t,end); gaps do not imply observations. */
export function intervalPaths(data,key){
  const paths=[];let path=[],previous=null;
  for(const row of data?.rows??[]){
    if(!Number.isFinite(row[key])){previous=null;if(path.length)paths.push(path);path=[];continue;}
    if(previous&&row.t>previous.end+.00001){paths.push(path);path=[];}
    path.push([row.t,row[key]],[row.end,row[key]]);previous=row;
  }
  if(path.length)paths.push(path);
  return paths;
}
export function extent(values,{minimumSpan=1,padding=.08}={}){
  const finite=values.filter(Number.isFinite);
  if(!finite.length)return [0,1];
  let lo=Math.min(...finite),hi=Math.max(...finite);
  const span=Math.max(minimumSpan,hi-lo),centre=(lo+hi)/2;
  return [centre-span*(.5+padding),centre+span*(.5+padding)];
}
export function normalizeValue(v,[lo,hi]){
  return (v-lo)/(hi-lo);
}
/** Causal display filter; input observations and categorical values stay intact. */
export function smoothTrajectory(rows,tau=1){
  let previous=null;
  return rows.map(p=>{
    let next={...p};
    if(tau>0&&previous&&p.segment===previous.segment&&p.t>previous.t
      &&(previous.end===undefined||p.t<=previous.end+.00001)){
      const weight=1-Math.exp(-(p.t-previous.t)/tau);
      next.tempo=previous.tempo+(p.tempo-previous.tempo)*weight;
      next.dynamics=previous.dynamics+(p.dynamics-previous.dynamics)*weight;
    }
    previous=next;return next;
  });
}
export function performancePath(data,time,tail=8){
  if(!data)return [];
  const rows=data.rows.filter(p=>p.t<=time&&p.end>=time-tail);
  let segment=0;
  return rows.map((p,i)=>{
    if(i&&p.t>rows[i-1].end+.00001)segment++;
    return {...p,segment};
  });
}
export function layerDescription(layer,data){
  if(!data)return {value:'—',note:'等待音樂資料',source:'未提供'};
  const f=data.scoreFacts??{};
  const contents={
    melody:[`${f.notes??'—'} 音符`,'MEI譜面總數；尚未對位音訊','MEI'],
    harmony:[`${f.chords??'—'} 和弦事件`,'譜面chord元素；和聲功能未標注','MEI'],
    mode:['未標注','尚無可引用的調式分析','—'],
    form:['節選','尚無可引用的曲式分段','Vmus'],
    texture:['小提琴 · 鋼琴','配器來源；不推定逐時刻聲部數','Vmus / MEI'],
    articulation:[`${f.articulations??'—'} 演奏法標記`,`${f.slurs??'—'} 個連線標記 · 譜面總數`,'MEI'],
    rhythm:['拍點間隔','相鄰八分音符標記的時間差','CSV · Δt'],
    dynamics:['RMS電平','100 ms窗 · 數位電平','PCM · RMS'],
    tempo:['八分音符速率','60 / 拍點間隔','CSV · ♪/min'],
    timbre:['頻譜質心','100 ms Hann窗 · 幅度譜','PCM · FFT'],
  };
  const [value,note,source]=contents[layer.key];return {value,note,source};
}
