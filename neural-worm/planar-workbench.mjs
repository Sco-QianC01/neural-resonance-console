import {TemporalScene} from '../src/temporal-scene.mjs';
import {observationNow} from '../src/stream-clock.mjs';
import {mountListening} from './listening-workbench.mjs';
import {ELEMENTS,mapMusic} from '../src/music.mjs';
import {formatAmplitude} from '../src/amplitude-model.mjs';
import {neuralExportName,viewLabels,viewSpace} from '../src/planar-model.mjs';
import {beatIntervals,onsetIntervals,gaussianTempo,musicPoint,musicExtent,rawMusicPoints,alignEEG,zoomRange,tempoSummary} from '../src/fusion-model.mjs';
import {drawTempoProfile} from '../src/tempo-profile.mjs';
import {structurePoints,scoreMusicPoint} from '../src/music-structure.mjs';
import {mountScore} from './score-workbench.mjs';
const format=value=>Number.isFinite(value)?value.toFixed(1):'—';
const clock=value=>`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toFixed(1).padStart(4,'0')}`;
const utc=value=>{
  if(!Number.isFinite(value))return '未回報';
  const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'未回報';
};
const glyph={
  pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-5-5L5 21"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${glyph[name]}</svg>`;
const sources={demo:'合成示範',replay:'記錄回放',device:'設備資料',core:'橋接資料',mock:'外部模擬',unknown:'外部接口'};
export function mountResearch(host,{onMode=()=>{},onWindow=()=>{},onImport=()=>{},onReplay=()=>{}}={}){
  let latest=null,held=null,frozen=false,cursor=null,selectedElement=null,signature='',reference=100,exportContext=null;
  const spaces={neural:'plane',music:'plane'};
  let stage='music',visualMode='music',space=viewSpace(spaces,'music'),scale=50,scaleAnchor=null,cases=null,recordingData=null,musicModel=null,layer='worm';
  let paired=[],run=0,startedAt=Infinity,lastPairKey=null,sourceIdentity='',animation=0,lastPaint=0;
  const models=new Map();let versionPlots=[],versionWork=null,casesLoading=null;
  let curation=null;
  host.innerHTML=`
    <div class="research-toolbar">
      <h2>觀測研究</h2>
      <div class="visual-modes" role="group" aria-label="觀測資料">${[['music','音樂'],['eeg','神經'],['overlay','對照']].map(([key,label])=>`<button data-visual="${key}" aria-pressed="${key==='music'}">${label}</button>`).join('')}</div>
      <span data-role="source" class="research-context">等待資料</span>
      <div class="research-actions"><button class="icon-button" data-action="export" aria-label="保存圖形" disabled>${icon('image')}</button><button class="icon-button" data-action="focus" aria-label="專注顯示" aria-pressed="false">${icon('focus')}</button></div>
    </div>
    <section class="music-player" hidden aria-label="研究音樂播放">
      <div class="music-selection"><label>作品<select data-role="work" aria-label="選擇肖邦作品" disabled><option>讀取作品…</option></select></label>
      <label>演奏版本／片段<select data-role="case" aria-label="選擇音樂演示案例" disabled><option>讀取版本…</option></select></label></div>
      <button class="icon-button" data-action="music-play" aria-label="播放音樂" disabled>${icon('play')}</button>
      <output data-role="music-time">00:00.0</output><input data-role="music-seek" type="range" min="0" max="1" step=".01" value="0" aria-label="音樂播放位置" disabled>
      <span data-role="music-duration">00:00.0</span><audio data-role="audio" preload="metadata" hidden></audio>
      <span class="music-play-state" data-role="music-play-state" role="status"></span>
    </section>
    <div class="research-workspace">
      <section class="research-detail" aria-label="目前觀測">
        <h2>神經蠕蟲</h2>
        <dl class="planar-values"><dt>關注指數</dt><dd data-role="attention">—</dd><dt>放鬆指數</dt><dd data-role="relaxation">—</dd><dt>振幅 RMS</dt><dd data-role="amplitude">—</dd></dl>
        <span class="planar-unit" data-role="amplitude-unit"></span>
        <p class="planar-state" data-role="state" role="status">等待有效資料</p>
        <label class="planar-window">視圖<select data-role="space" aria-label="神經響應視圖"><option value="plane">二維投影</option><option value="time">三維時間方盒</option></select></label><small class="time-view-hint">拖動旋轉 · 方向鍵微調 · Home 重置</small><label class="planar-window">窗口<select data-role="window" aria-label="觀察窗口"><option value="60">60 秒</option><option value="30">30 秒</option><option value="10">10 秒</option></select></label>
        <label class="planar-window planar-scale">觀察尺度<select data-role="scale" aria-label="腦電觀察尺度"><option value="100">全域 · 0–100</option><option value="50" selected>精細 · 50點</option><option value="25">細微 · 25點</option></select></label>
        <small class="scale-note" data-role="scale-note">坐標窗口，未改變原生指數</small><small class="acquisition-details" data-role="acquisition-details"></small>
        <section class="reference-readouts" hidden aria-label="音樂原始觀測">
          <h3 data-role="reference-title"></h3>
          <dl><dt>圖中顯示速度</dt><dd data-role="display-tempo">—</dd><dt>相對振幅</dt><dd data-role="level">—</dd></dl>
          <details class="observation-audit"><summary>原始值與探索統計</summary><dl><dt>原始逐拍速度</dt><dd data-role="tempo">—</dd><dt>拍點間隔</dt><dd data-role="ioi">—</dd><dt>線性代理 R²</dt><dd data-role="linearity">—</dd><dt>變幅代理 |log₂比|</dt><dd data-role="discreteness">—</dd></dl><small>振幅為來源 0–100 標度，未作響度校準。線性與變幅為探索性代理。</small></details>
          <span data-role="beat-position"></span>
          <label class="music-smoothing"><input data-role="smoothing" type="checkbox" checked>速度高斯窗 · <span data-role="smoothing-width"></span></label>
          <label class="annotation-choice" hidden>標注聲部<select data-role="annotation" aria-label="選擇來源標注聲部"></select></label>
          <details><summary>案例來源</summary><p data-role="reference-credit"></p><p data-role="reference-policy"></p><a data-role="reference-link" target="_blank" rel="noopener">Vmus 原案例 ↗</a></details>
        </section>
        <div class="planar-replay" hidden><label class="replay-file-label">匯入記錄<input data-role="file" type="file" accept=".json"></label><button data-action="replay">播放記錄</button></div>
        <section class="planar-music" hidden aria-label="來源聲明的音樂觀測"><h3 data-role="music-title"></h3><strong data-role="music-value"></strong><small data-role="music-unit"></small><details><summary>來源</summary><p data-role="music-method"></p><span data-role="music-source"></span><p>來源聲明，未獨立驗證。</p></details></section>
      </section>
      <section class="research-plot" aria-label="觀測坐標"><div class="music-layer-tabs" role="group" aria-label="音樂主視圖" hidden>${[['plane','二維蠕蟲'],['time','三維時間'],['profile','全曲曲線'],['notes','逐音證據']].map(([key,label])=>`<button data-music-view="${key}" aria-pressed="${key==='plane'}">${label}</button>`).join('')}<label class="bar-window" data-role="bar-window-label">範圍<select data-role="bar-window" aria-label="可見小節範圍"><option value="8">8 小節</option><option value="16">16 小節</option><option value="0">全曲</option></select></label></div><p class="profile-caption" data-role="profile-caption" hidden></p><p class="score-scope" hidden>譜面範圍：Op.27 No.2 · 第1–8小節；範圍外不補造逐音資料。</p><div class="score-evidence" hidden></div><div class="scene-host"></div><p class="comparison-key" hidden><span class="music-key">音樂 · 速度 × 相對振幅</span><span data-role="pair-status"></span></p><section class="paired-panel" hidden aria-label="播放期神經對照"><h3>神經 · Attention × Meditation</h3><p data-role="comparison-state"></p><div class="paired-scene"></div></section></section>
    </div>
    <details class="research-advanced"><summary>進階音樂視圖</summary><div class="music-secondary-tabs" role="group" aria-label="其他音樂觀測">${[['tempo','逐拍速度'],['dynamics','相對振幅'],['rhythm','拍點間隔'],['structure','速度結構']].map(([key,label])=>`<button data-layer="${key}" aria-pressed="false">${label}</button>`).join('')}</div></details>
    <details class="experiment-disclosure"><summary>版本實驗</summary><section class="listening-experiment"></section></details>
    <details class="version-comparisons" hidden><summary>同作品版本對照<span data-role="version-count"></span></summary><p>共用小節軸與速度刻度；原始拍點、平滑曲線、相對振幅灰帶及平均速度線。每列可選取播放。</p><div data-role="version-plots"></div></details>
    <div class="element-tabs" role="tablist" aria-label="已提供的音樂觀測" hidden>${ELEMENTS.map(([key,name])=>`<button role="tab" data-element="${key}" aria-selected="false" hidden>${name}</button>`).join('')}</div>
    <div class="research-transport">
      <button class="icon-button playback" data-action="follow" aria-label="暫停觀察" disabled>${icon('pause')}</button>
      <output data-role="cursor-time">00:00.0</output><input data-role="cursor" type="range" min="0" max="1" step=".01" value="0" aria-label="觀察時間位置" disabled><span data-role="duration">00:00.0</span>
      <button class="planar-follow" data-action="latest" disabled>跟隨</button>
    </div>
    <details class="research-method"><summary>資料與方法</summary>
      <p>新采集位置取同一協議報告的Attention／Meditation指數；舊記錄保留已保存的字段時間與配對方法。原生指數，刻度0–100；ThinkGear的0表示指數未能可靠計算。網格是坐標參考。</p>
      <p>振幅取最新最多256個原始樣本，最少32個，以去均值RMS計算，保留來源單位。有樣本序號才核查連續性。光點的明暗和光暈是顯示編碼；時間方盒的第三軸只表示樣本經過秒數。沒有原始波形時不顯示振幅。</p>
      <p>軌跡按來源時間排列，丟失、品質不良及來源更換處斷開。暫停觀察不停止設備采集。</p>
      <label class="planar-reference">光暈參照<input data-role="reference" type="number" min=".000001" step="any" value="100" aria-label="振幅光暈參照值"><span>與RMS相同單位</span></label>
      <span data-role="amplitude-method"></span>
      <a href="./docs/PLANAR-METHODS.html" target="_blank" rel="noopener">公式與一手來源 ↗</a>
      <p>音樂參考使用 Yang 2007 人工拍點和原站相對振幅；音樂小節與腦電秒軸分開。版本實驗在播放期建立時間配對；來源時鐘、聲卡輸出與設備延遲未校準，不能據此判定耦合或因果。關係方向另按分窗統計導出，不能由波形向上或向下直接推斷。</p>
      <p>線性代理：最近最多8個有效原始拍點的速度對小節內拍位做最小二乘直線擬合，顯示R²；常量段標為恆定。變幅代理：相鄰原始拍速度比的絕對log₂，0表示未變，1表示倍增／減半。兩者是可重算的探索性描述量，不能作為已驗證的審美或神經機制指標；沒有音符時值標注時，不冒稱已測全音符到64分音符的跳變。</p>
      <p>三維音樂蠕蟲以速度、相對振幅和播放時間為三軸，使用正交投影，不以透視改變數值比例。小節只作觀察範圍與邊界信息，不作遮擋軌跡的實體平面；來源拍點仍保持離散，沒有觀測的位置不補點。</p>
      <p>相對振幅採原站平滑振幅與0–100標度，網格內線性插值；譜面力度未提供，不從振幅推定。此值未作聲壓或響度校準，不能作跨錄音的絕對強弱比較。</p>
      <a href="./docs/LISTENING-METHODS.html" target="_blank" rel="noopener">時序與版本實驗方法 ↗</a>
      <a href="./docs/MUSIC-FUSION.html" target="_blank" rel="noopener">音樂方法、配對與來源 ↗</a>
    </details>`;
  const $=name=>host.querySelector(`[data-role="${name}"]`),action=name=>host.querySelector(`[data-action="${name}"]`);
  const scene=new TemporalScene(host.querySelector('.scene-host'),{
    onPick:timestamp=>{if(visualMode==='eeg'){cursor=timestamp;render();}},
    onMusicPick:t=>{beginRun();$('audio').currentTime=t;render();},
  });
  const pairedScene=new TemporalScene(host.querySelector('.paired-scene'),{
    onPick:timestamp=>{beginRun();$('audio').currentTime=timestamp/1000;render();},
  });
  const scoreView=mountScore(host.querySelector('.score-evidence'),{seek:t=>{
    beginRun();$('audio').currentTime=t;render();
  }});
  const experiment=mountListening(host.querySelector('.listening-experiment'),{
    getContext:()=>latest,getRecording:()=>recordingData?{...recordingData,playbackGain:audio.volume,playbackRate:audio.playbackRate}:null,
    selectRecording:async id=>{if(recordingData?.id!==id){$('case').value=id;prepareCase(id);}audio.playbackRate=1;await audio.play();},
    getMusic:()=>({audio,pointAt:t=>{
      if(!recordingData||!musicModel)return null;
      const p=scoreMusicPoint(recordingData,musicModel.raw,[],t,false),s=[...musicModel.structure].reverse().find(q=>q.t<=t);
      return p?{...p,linearFitR2:s?.fit?.r2??null,linearityProxyR2:s?.linearityProxyR2??s?.fit?.r2??null,
        linearFitConstant:s?.fit?.constant??null,tempoJump:s?.jump??null,changeProxyLog2:s?.changeProxyLog2??s?.jump??null}:null;
    }}),
    getImage:()=>scene.exportPNG(['版本實驗 · 當前觀測圖形',recordingData?.title??'',recordingData?.performer??'']),
  });
  host.dataset.ready='true';host.dataset.presentation='research-time-study';host.dataset.visualMode='music';host.dataset.stage='music';
  $('space').onchange=()=>{
    space=$('space').value;
    if(visualMode==='eeg')viewSpace(spaces,'neural',space);
    else if(layer==='worm')viewSpace(spaces,'music',space);
    render();
  };
  $('bar-window').onchange=render;
  $('window').onchange=()=>{cursor=null;onWindow(Number($('window').value));};
  $('file').onchange=()=>{const file=$('file').files[0];if(file){frozen=false;held=null;cursor=null;onImport(file);}};
  action('replay').onclick=()=>onReplay();
  action('follow').onclick=()=>{
    frozen=!frozen;held=frozen?latest:null;if(!frozen)cursor=null;render();
  };
  action('latest').onclick=()=>{frozen=false;held=null;cursor=null;render();};
  $('cursor').oninput=()=>{
    const data=frozen?held:latest,points=data?.trace?.points??[];
    if(points.length){cursor=points[0].timestamp+Number($('cursor').value)*1000;render();}
  };
  $('reference').onchange=()=>{
    const value=Number($('reference').value);
    if(!Number.isFinite(value)||value<=0){$('reference').value=String(reference);return;}
    reference=value;render();
  };
  $('scale').onchange=()=>{
    scale=Number($('scale').value);scaleAnchor=null;render();
  };
  action('focus').onclick=()=>{const enabled=document.body.classList.toggle('research-focus');action('focus').setAttribute('aria-pressed',String(enabled));};
  const escape=e=>{if(e.key==='Escape'){document.body.classList.remove('research-focus');action('focus').setAttribute('aria-pressed','false');}};
  window.addEventListener('keydown',escape);
  action('export').onclick=async()=>{
    if(visualMode!=='eeg'){
      if(!recordingData||!musicModel)return;
      if(layer==='notes'){
        const link=document.createElement('a');link.href=scoreView.exportPNG();
        link.download=`score-layers-${recordingData.id}-${Date.now()}.png`;link.click();return;
      }
      const t=$('audio').currentTime,p=musicPoint(recordingData,musicModel.raw,musicModel.curve,t,$('smoothing').checked);
      const lines=[`${recordingData.title} · ${recordingData.performer} / ${recordingData.year??'年份未註明'}`,
        `音樂位置 ${clock(t)} · 小節 ${scoreMusicPoint(recordingData,musicModel.raw,[],t,false)?.bar??'—'} · 視圖 ${layer}`,
        `原始速度 ${p?.rawTempo?.toFixed(2)??'—'} ${tempoUnit()} · 顯示速度 ${p?.tempo?.toFixed(2)??'—'} · 相對振幅 ${p?.level?.toFixed(1)??'—'}（來源 0–100）`,
        `原始拍點間隔 ${p?.ioi?.toFixed(1)??'—'} ms · 高斯窗 ${$('smoothing').checked?recordingData.annotation.window:0} s（W=2σ，顯示）`,
        layer==='profile'?'紅點為原始拍點；灰帶寬度編碼相對振幅，並非速度誤差或置信區間。':'來源標注界外不補資料。',
        cases.attribution,recordingData.reference];
      if(visualMode==='overlay'){
        const q=paired.at(-1);lines.push(`神經來源 ${sources[q?.source]??'等待資料'} · 配對 ${paired.length} 個樣本 · 第 ${run} 段`);
        if(q)lines.push(`腦電原生坐標 ${q.attention}, ${q.relaxation} / 100 · 原始字段時間 UTC ${utc(q.originalTimestamp)} · 顯示時間 UTC ${utc(q.indexTimestamp)}`);
        if(q?.amplitude)lines.push(`腦電 RMS ${formatAmplitude(q.amplitude.rms)} ${q.amplitude.unit} · 振幅時間 UTC ${utc(q.amplitude.originalTimestamp)} · 光暈參照 ${reference}（顯示參數）`);
        lines.push('上下圖使用各自坐標，以播放位置對照；音訊輸出及設備時鐘延遲未校準，不表示相關或因果。');
      }
      const link=document.createElement('a');link.href=scene.exportPNG(lines);
      if(visualMode==='overlay'){
        const images=await Promise.all([link.href,pairedScene.exportPNG([$('comparison-state').textContent])].map(src=>new Promise((resolve,reject)=>{
          const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;
        })));
        const out=document.createElement('canvas');out.width=Math.max(...images.map(image=>image.width));out.height=images.reduce((sum,image)=>sum+image.height,0);
        const ctx=out.getContext('2d');ctx.fillStyle=getComputedStyle(host).getPropertyValue('--bg').trim()||'#121315';ctx.fillRect(0,0,out.width,out.height);
        let y=0;for(const image of images){ctx.drawImage(image,0,y);y+=image.height;}link.href=out.toDataURL('image/png');
      }
      link.download=`music-worm-${recordingData.id}-${Date.now()}.png`;link.click();return;
    }
    if(!exportContext)return;
    const {point,amp}=exportContext;
    const lines=[
      `${$('source').textContent} · ${$('state').textContent}`,
      `原始時間 UTC：${utc(point.originalTimestamp)}`,
      `關注 ${$('attention').textContent} / 放鬆 ${$('relaxation').textContent} · 設備原生指數 0–100`,
      `RMS ${$('amplitude').textContent} ${$('amplitude-unit').textContent} · 去均值原始振幅`,
      `觀察尺度 ${scale} 點（僅顯示） · X ${scene.state.ranges?.x.join('–')} / Y ${scene.state.ranges?.y.join('–')}`,
    ];
    if(point.source==='replay')lines.splice(2,0,`回放顯示時間 UTC：${utc(point.timestamp)}`);
    if(amp){
      lines.push(`振幅時間 UTC：${utc(amp.originalTimestamp)} · ${amp.timing==='source-field-time'?'來源欄位時間':'封包到達時間'}`);
      lines.push(`${amp.samples} 樣本 · ${amp.continuityVerified?'序號連續':'連續性未回報'} · 光暈參照 ${reference} ${amp.unit}（顯示參數）`);
    }
    const link=document.createElement('a');link.href=scene.exportPNG(lines);link.download=neuralExportName(space);link.click();
  };
  const audio=$('audio');
  audio.volume=.28;
  const beginRun=()=>{run++;startedAt=observationNow();paired=[];lastPairKey=null;};
  function tempoUnit(){
    return {'1/2':'二分音符/分','2/2':'二分音符/分','6/8':'八分音符/分','4/4.':'附點四分音符/分'}[recordingData?.annotation.meter]??'來源拍/分';
  }
  function getModel(rec){
    const known=rec.annotation.kind==='beats';
    const limit=!known&&audio.currentSrc===rec.media&&Number.isFinite(audio.duration)?audio.duration:
      Number.isFinite(rec.duration)?rec.duration:Infinity;
    const key=`${rec.id}:${rec.annotation.annotation_id??rec.annotation.version}:${rec.annotation.part??''}:${known?'beats':limit}`;
    if(models.has(key))return models.get(key);
    const raw=known?beatIntervals(rec.annotation):onsetIntervals(rec.annotation,limit);
    const curve=known?gaussianTempo(raw,rec.annotation.window??0):[];
    const points=curve.map(p=>scoreMusicPoint(rec,raw,curve,p.t,true)).filter(Boolean);
    const values=raw.map(r=>r.ioi),lo=values.length?Math.max(0,Math.min(...values)-40):0,hi=values.length?Math.max(...values)+40:1000;
    const unsmoothed=rawMusicPoints(rec,raw);
    const model={known,raw,curve,points,unsmoothed,structure:known?structurePoints(rec,raw):[],tempoRange:musicExtent(raw),ioiRange:[lo,hi],
      outOfBounds:!known&&rec.annotation.t.some(t=>t>limit)};
    models.set(key,model);return model;
  }
  function populateWork(workId,preferred=null){
    const rows=cases.recordings.filter(r=>String(r.workId)===String(workId)).sort((a,b)=>
      Number(curation?.recordings.some(r=>r.id===b.id&&r.curated))-Number(curation?.recordings.some(r=>r.id===a.id&&r.curated)));
    const curatedIds=curation?.recordings
      ? new Set(curation.recordings.filter(r=>r.curated).map(r=>r.id))
      : null;
    const visibleRows=curatedIds
      ? rows.filter(r=>curatedIds.has(r.id))
      : rows.filter(r=>r.provenance!=='legacy');
    const selectableRows=visibleRows.length?visibleRows:rows;
    const groups=new Map();
    for(const rec of selectableRows){
      if(!groups.has(rec.performanceId)){
        const group=document.createElement('optgroup');
        group.label=`${rec.performer} · ${rec.year??'年份未註明'}${rec.performer==='演奏者未註明'?' · '+rec.performanceId:''}`;
        groups.set(rec.performanceId,group);
      }
      const option=document.createElement('option');option.value=rec.id;
      const audit=curation?.recordings.find(r=>r.id===rec.id);
      option.textContent=`${rec.performer} · ${rec.year??'年份未註明'} · ${audit?.curated?'完整資料已核查':rec.id==='c27_pachmann1925'?'歷史底噪版本':rec.clipLabel??(rec.completeStudy?'主錄音':rec.excerpt)} · ${rec.mediaId}`;
      groups.get(rec.performanceId).append(option);
    }
    $('case').replaceChildren(...groups.values());$('case').disabled=false;
    const fallback=curation?.default_by_work?.[String(workId)]??selectableRows[0]?.id??rows[0]?.id;
    $('case').value=preferred&&selectableRows.some(r=>r.id===preferred)?preferred:fallback;prepareCase($('case').value);
  }
  function buildVersions(){
    if(!cases||!recordingData)return;
    const workId=recordingData.workId,rows=cases.recordings.filter(r=>r.workId===workId&&r.completeStudy
      &&(!curation||curation.recordings.some(q=>q.id===r.id&&q.curated)));
    $('version-count').textContent=` · ${rows.length} 個完整拍點版本`;
    const container=$('version-plots');container.replaceChildren();versionPlots=[];versionWork=workId;
    const range=[Math.min(...rows.map(r=>getModel(r).tempoRange[0])),Math.max(...rows.map(r=>getModel(r).tempoRange[1]))];
    for(const rec of rows){
      const article=document.createElement('article');article.className='version-plot';article.dataset.version=rec.id;
      const header=document.createElement('div');header.className='version-plot-head';
      const button=document.createElement('button');button.className='icon-button';button.innerHTML=icon('play');
      button.setAttribute('aria-label',`播放 ${rec.performer} ${rec.year}`);
      const name=document.createElement('strong');name.textContent=`${rec.performer} · ${rec.year}`;
      const caption=document.createElement('span'),summary=tempoSummary(getModel(rec).raw);
      caption.textContent=`標注 ${summary.seconds.toFixed(2)} s · 平均速度 ${summary.mean.toFixed(1)} · W ${rec.annotation.window} s`;
      header.append(button,name,caption);
      const canvas=document.createElement('canvas');canvas.className='version-canvas';canvas.tabIndex=0;
      canvas.setAttribute('aria-label',`${rec.performer} ${rec.year} 演奏曲線；點選或回車播放`);
      article.append(header,canvas);container.append(article);
      const item={rec,canvas,article,button,range,hits:[]};versionPlots.push(item);
      const play=async(t=rec.annotation.t[0])=>{
        const paused=audio.paused;
        if(recordingData.id!==rec.id){$('case').value=rec.id;prepareCase(rec.id);}
        layer='profile';audio.currentTime=t;render();
        try{await audio.play();}catch(e){$('music-play-state').textContent='播放未開始 · '+e.message;}
      };
      button.onclick=()=>{if(recordingData.id===rec.id&&!audio.paused)audio.pause();else play();};
      canvas.onclick=e=>{
        const box=canvas.getBoundingClientRect();let nearest=null,dist=20;
        for(const hit of item.hits){const d=Math.hypot(e.clientX-box.left-hit.x,e.clientY-box.top-hit.y);if(d<dist){nearest=hit;dist=d;}}
        if(nearest)play(nearest.point.t);
      };
      canvas.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play();}};
    }
    drawVersions(true);
  }
  function drawVersions(all=false){
    if(!host.querySelector('.version-comparisons').open)return;
    for(const item of versionPlots){
      const active=item.rec.id===recordingData.id;
      if(!all&&!active&&!item.wasActive)continue;
      item.wasActive=active;item.article.dataset.active=String(active);
      item.button.innerHTML=icon(active&&!audio.paused?'pause':'play');
      item.hits=drawTempoProfile(item.canvas,{recording:item.rec,model:getModel(item.rec),
        currentTime:active?audio.currentTime:-1,smooth:$('smoothing').checked,range:item.range}).hits;
    }
  }
  function prepareCase(id){
    audio.pause();recordingData=cases.recordings.find(r=>r.id===id);if(!recordingData)return;
    musicModel=getModel(recordingData);
    if(!musicModel.known&&layer!=='notes')layer='rhythm';
    beginRun();audio.src=recordingData.media;audio.load();
    const selectedId=recordingData.id;
    const audit=curation?.recordings.find(r=>r.id===selectedId);
    audio.volume=Math.min(.28,Math.max(.05,audit?.playback_gain??.28));
    if(curation?.recordings.some(r=>r.id===selectedId&&r.curated)){
      fetch(`/api/research-media/${encodeURIComponent(selectedId)}`,{method:'HEAD',signal:AbortSignal.timeout(2000)})
        .then(response=>{if(response.ok&&recordingData?.id===selectedId&&audio.paused){audio.src=response.url;audio.load();}})
        .catch(()=>{});
    }
    $('music-seek').max=String(recordingData.duration??recordingData.annotation.t.at(-1));$('music-seek').disabled=false;
    action('music-play').disabled=false;
    $('reference-title').textContent=`${recordingData.performer} · ${recordingData.year??'年份未註明'}`;
    $('reference-credit').textContent=`${recordingData.title}；${recordingData.excerpt}。${recordingData.credits.map(c=>c.zh||c.name).join(' / ')}。${recordingData.disc}。媒體 ${recordingData.mediaId}；標注者 ${recordingData.annotationUser}，v${recordingData.annotation.version}。${recordingData.provenance==='legacy'?'歷史上傳：曲目／演奏者資料依原站，未獨立核實。':''}`;
    $('reference-policy').textContent=cases.attribution+' '+cases.mediaPolicy;
    if(audit)$('reference-policy').textContent+=` 解码 ${audit.decoded_seconds.toFixed(3)} s；${audit.beat_boundaries} 個拍點；${audit.amplitude_points} 個振幅值；原站 ${Math.round(audit.bitrate/1000)} kbps。播放增益 ${(20*Math.log10(audio.volume)).toFixed(2)} dB，保留原始分析尺度。`;
    $('reference-link').href=recordingData.reference;
    $('smoothing-width').textContent=musicModel.known?`${recordingData.annotation.window} s`:'拍值未確認';
    $('smoothing').disabled=!musicModel.known;
    const annotations=recordingData.annotations;
    $('annotation').replaceChildren(...annotations.map((ann,i)=>{
      const option=document.createElement('option');option.value=String(i);
      option.textContent=ann.part==='LH'?'左手':ann.part==='RH'?'右手':ann.kind==='beats'?'拍點':`來源標注 ${i+1}`;return option;
    }));
    host.querySelector('.annotation-choice').hidden=annotations.length<2;
    experiment.populate(cases.recordings,recordingData.workId,
      curation?.recordings.filter(r=>r.curated&&cases.recordings.some(q=>q.id===r.id&&q.workId===recordingData.workId)).map(r=>r.id)??[]);
    scene.tooltip.hidden=true;
    if(host.querySelector('.version-comparisons').open&&versionWork!==recordingData.workId)buildVersions();
    drawVersions(true);
    $('music-play-state').textContent='待播放 · 已核查研究錄音';render();
  }
  function loadCases(){
    if(cases)return Promise.resolve();
    if(casesLoading)return casesLoading;
    casesLoading=(async()=>{
      try{
        const response=await fetch('./public/research/vmus-reference-cases.json',{signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('案例資料不可用');
        const value=await response.json();
        if(value?.schema!=='vmus-reference-cases-v1'||!Array.isArray(value.recordings)||!value.recordings.length
          ||!Array.isArray(value.works)||!value.works.length)throw new Error('案例資料格式無效');
        try{const r=await fetch('./public/research/chopin-curation.json',{signal:AbortSignal.timeout(4000)});if(r.ok){const c=await r.json();if(c.schema==='chopin-curation-v1')curation=c;}}catch{}
        cases=value;$('work').replaceChildren(...value.works.map(w=>{
          const option=document.createElement('option');option.value=String(w.id);option.textContent=w.title;return option;
        }));$('work').disabled=false;populateWork(value.works[0].id);
      }catch{
        cases=null;$('work').disabled=true;$('case').disabled=true;
        $('music-play-state').textContent='案例暫不可用 · 重新選擇音樂可重試';
        $('case').replaceChildren(Object.assign(document.createElement('option'),{textContent:'案例讀取失敗'}));
      }finally{casesLoading=null;}
    })();
    return casesLoading;
  }
  for(const button of host.querySelectorAll('[data-visual]'))button.onclick=()=>{
    if(experiment.busy())return;stage=button.dataset.visual;visualMode=stage;
    if(visualMode==='eeg')space=viewSpace(spaces,'neural');
    else if(layer==='worm')space=viewSpace(spaces,'music');
    $('space').value=space;
    for(const b of host.querySelectorAll('[data-visual]'))b.setAttribute('aria-pressed',String(b===button));
    host.dataset.visualMode=visualMode;host.dataset.stage=stage;render();
    if(visualMode!=='eeg')loadCases();
  };
  for(const button of host.querySelectorAll('button[data-layer]'))button.onclick=()=>{
    layer=button.dataset.layer;
    if(layer==='worm'){space=viewSpace(spaces,'music');$('space').value=space;}
    host.querySelectorAll('button[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();
  };
  for(const button of host.querySelectorAll('button[data-music-view]'))button.onclick=()=>{
    const view=button.dataset.musicView;layer=['plane','time'].includes(view)?'worm':view;
    if(layer==='worm'){space=viewSpace(spaces,'music',view);$('space').value=space;}
    render();
  };
  $('case').onchange=()=>prepareCase($('case').value);
  $('work').onchange=()=>populateWork($('work').value);
  $('annotation').onchange=()=>{
    recordingData={...recordingData,annotation:recordingData.annotations[Number($('annotation').value)]};
    musicModel=getModel(recordingData);beginRun();render();
  };
  host.querySelector('.version-comparisons').ontoggle=()=>{if(host.querySelector('.version-comparisons').open)buildVersions();};
  const versionResize=new ResizeObserver(()=>drawVersions(true));versionResize.observe($('version-plots'));
  $('music-seek').oninput=()=>{beginRun();audio.currentTime=Number($('music-seek').value);render();};
  $('smoothing').onchange=()=>{render();drawVersions(true);};
  action('music-play').onclick=async()=>{
    if(!recordingData)return;
    if(!audio.paused){audio.pause();return;}
    if(audio.ended)audio.currentTime=0;
    try{await audio.play();}catch(e){$('music-play-state').textContent='播放未開始 · '+e.message;}
  };
  audio.addEventListener('play',()=>{beginRun();$('music-play-state').textContent='播放中 · 原站研究片段';render();});
  audio.addEventListener('pause',()=>{if(!audio.ended)$('music-play-state').textContent='播放暫停';render();});
  audio.addEventListener('seeking',()=>{beginRun();if(experiment.busy())experiment.accept(latest);render();});
  audio.addEventListener('ended',()=>{$('music-play-state').textContent='播放完成';render();});
  audio.addEventListener('error',()=>{$('music-play-state').textContent='音訊未能載入 · 檢查原站連接';render();});
  audio.addEventListener('loadedmetadata',()=>{
    if(Number.isFinite(audio.duration)&&recordingData){ $('music-seek').max=String(audio.duration);musicModel=getModel(recordingData);render();}
  });
  audio.addEventListener('timeupdate',()=>render());
  function musicFrame(now){
    if(!audio.paused&&visualMode!=='eeg'&&now-lastPaint>80){lastPaint=now;render();}
    animation=requestAnimationFrame(musicFrame);
  }
  animation=requestAnimationFrame(musicFrame);
  function renderMusic(){
    if(!recordingData||!musicModel)return;
    const t=audio.currentTime,smooth=$('smoothing').checked,p=scoreMusicPoint(recordingData,musicModel.raw,musicModel.curve,t,smooth);
    const points=smooth&&musicModel.known?musicModel.points:musicModel.unsmoothed;
    const duration=Number.isFinite(audio.duration)?audio.duration:recordingData.duration??recordingData.annotation.t.at(-1);
    $('tempo').textContent=Number.isFinite(p?.rawTempo)?`${p.rawTempo.toFixed(1)} ${tempoUnit()}`:'—';
    $('display-tempo').textContent=Number.isFinite(p?.tempo)?`${p.tempo.toFixed(1)} ${tempoUnit()}`:'—';
    $('level').textContent=Number.isFinite(p?.level)?`${p.level.toFixed(1)} · 來源 0–100`:'—';
    const structural=[...musicModel.structure].reverse().find(q=>q.t<=t);
    $('linearity').textContent=structural?.fit?.constant?'恆定段':Number.isFinite(structural?.linearityProxyR2)?`${structural.linearityProxyR2.toFixed(4)} · 代理`:'至少3拍';
    $('discreteness').textContent=Number.isFinite(structural?.changeProxyLog2)?`${structural.changeProxyLog2.toFixed(4)} · 代理`:'—';
    $('ioi').textContent=p?`${p.ioi.toFixed(0)} ms`:'—';
    $('beat-position').textContent=p?(musicModel.known?`第 ${p.bar} 小節 · 第 ${(p.beatInBar??0)+1} 個來源拍點 · 顯示速度 ${p.tempo.toFixed(1)}`:'來源發音間隔 · 未換算速度／振幅'):'此位置沒有逐時標注';
    if(musicModel.outOfBounds)$('beat-position').textContent+=' · 原站部分標注超出音訊，越界區間不繪製';
    $('music-time').textContent=clock(t);$('music-duration').textContent=clock(duration);
    $('music-seek').value=String(t);
    action('music-play').innerHTML=icon(audio.paused?'play':'pause');action('music-play').setAttribute('aria-label',audio.paused?'播放音樂':'暫停音樂');
    action('export').disabled=false;
    $('pair-status').textContent=visualMode==='overlay'?`${paired.length} 個播放期配對樣本 · 獨立刻度`:musicModel.known?'人工拍點 · 原站相對振幅':'公開事件標注 · 缺失值不補算';
    for(const b of host.querySelectorAll('button[data-layer]')){
      b.disabled=!musicModel.known&&!['rhythm','notes'].includes(b.dataset.layer);b.setAttribute('aria-pressed',String(b.dataset.layer===layer));
    }
    for(const b of host.querySelectorAll('button[data-music-view]')){
      b.disabled=!musicModel.known&&b.dataset.musicView!=='notes';
      b.setAttribute('aria-pressed',String(b.dataset.musicView===(layer==='worm'?space:layer)));
    }
    host.dataset.musicLayer=layer;
    const profile=layer==='profile';$('profile-caption').hidden=!profile;
    if(profile){const s=tempoSummary(musicModel.raw);
      $('profile-caption').textContent=`${recordingData.performer} · ${recordingData.year}　標注 ${s.seconds.toFixed(2)} s · 平均速度 ${s.mean.toFixed(1)} ${tempoUnit()} · ${smooth?'W '+recordingData.annotation.window+' s':'未平滑'}`;
    }
    host.querySelector('.comparison-key .music-key').textContent=layer==='structure'?'速度 · 線性代理 × 變幅代理 × 小節':layer==='worm'?(space==='time'?'音樂 · 速度 × 相對振幅 × 播放時間':'音樂 · 速度 × 相對振幅 · 小節標記'):profile?'音樂 · 原始拍點／高斯顯示／相對振幅灰帶':layer==='rhythm'?'音樂 · 拍點間隔':layer==='dynamics'?'音樂 · 相對振幅 · 來源 0–100':'音樂 · 速度';
    $('bar-window-label').hidden=!['worm','structure'].includes(layer);
    scoreView.update(recordingData,t);
    if(layer==='notes'){
      action('export').disabled=host.querySelector('[data-score-export]').disabled;
      drawVersions();return;
    }
    scene.update({points:[],active:false,reference,space,comparison:{id:recordingData.id,time:t,duration,points,barWindow:Number($('bar-window').value),
      current:p,paired:[],overlay:false,layer,tempoRange:musicModel.tempoRange,
      ioiRange:musicModel.ioiRange,tempoUnit:tempoUnit(),recording:recordingData,model:musicModel,smooth}});
    if(visualMode==='overlay'){
      const observed=paired.filter(q=>q.t<=t),q=observed.at(-1),fresh=Boolean(q&&latest?.valid&&!audio.paused&&t-q.t<=3);
      $('comparison-state').textContent=`播放位置 ${clock(t)} · ${observed.length} 個播放期配對樣本${q?` · ${sources[q.source]??'外部接口'} · 關注 ${format(q.attention)}／放鬆 ${format(q.relaxation)}${fresh?'':' · 歷史／已過期'}`:' · 尚無有效神經資料'}；聲卡與設備延遲未校準。`;
      pairedScene.update({points:observed.map(q=>({...q,timestamp:q.t*1000})),selected:q?{...q,timestamp:q.t*1000}:null,
        active:fresh,reference,ranges:{x:[0,100],y:[0,100]},space:'plane',windowSeconds:60});
    }
    drawVersions();
  }
  function render(){
    const data=frozen?held:latest,trace=data?.trace,points=trace?.points??[];
    const point=cursor===null?points.at(-1):points.reduce((best,p)=>!best||Math.abs(p.timestamp-cursor)<Math.abs(best.timestamp-cursor)?p:best,null);
    const historical=cursor!==null||frozen,active=Boolean(point&&(historical||data?.valid));
    const amp=point?(historical?point.amplitude:data?.amplitude):null;
    const displayedPoint=point?{...point,amplitude:amp}:null,selectedSnapshot=point?
      data?.history?.find(p=>p.timestamp===(point.packetTimestamp??point.timestamp)):null;
    exportContext=point?{point,amp:active?amp:null}:null;
    const source=point?.source??data?.snapshot?.source;
    const original=selectedSnapshot?.raw?.originalSource;
    const origin=source==='replay'&&original&&sources[original]?` · 原始為${sources[original]}`:'';
    $('source').textContent=(sources[source]??'等待資料')+origin;
    $('state').textContent=frozen?'觀察暫停':cursor!==null?'歷史樣本':data?.valid?'有效資料':points.length?'資料中斷 · 保留軌跡':'等待有效配對';
    $('attention').textContent=active?format(point.attention):'—';$('relaxation').textContent=active?format(point.relaxation):'—';
    $('amplitude').textContent=active&&amp?formatAmplitude(amp.rms):'—';$('amplitude-unit').textContent=active&&amp?amp.unit:'';
    $('amplitude-method').textContent=active&&amp?`${amp.samples} 個樣本 · ${amp.continuityVerified?'序號連續':'連續性未回報'}${amp.sampleRate?` · 來源標示 ${amp.sampleRate} Hz`:' · 采樣率未標示'} · ${amp.timing==='source-field-time'?'來源欄位時間':'封包到達時間'}`:'原始波形未提供或已過期';
    host.querySelector('.planar-replay').hidden=data?.mode!=='replay';
    action('replay').disabled=!data?.replayLoaded;action('replay').textContent=data?.paused?'播放記錄':'暫停回放';
    const duration=points.length?(points.at(-1).timestamp-points[0].timestamp)/1000:0;
    $('cursor').max=String(Math.max(.01,duration));$('cursor').value=String(point?(point.timestamp-points[0].timestamp)/1000:0);
    $('cursor').disabled=!points.length;$('cursor-time').textContent=clock(point?(point.timestamp-points[0].timestamp)/1000:0);$('duration').textContent=clock(duration);
    action('follow').disabled=action('latest').disabled=action('export').disabled=!points.length;
    action('follow').innerHTML=icon(frozen?'play':'pause');action('follow').setAttribute('aria-label',frozen?'繼續觀察':'暫停觀察');
    const music=active?mapMusic(selectedSnapshot):null,available=ELEMENTS.filter(([key])=>music?.evidence[key].status==='reported');
    if(!available.some(([key])=>key===selectedElement))selectedElement=available[0]?.[0]??null;
    const tabs=host.querySelector('.element-tabs');tabs.hidden=!available.length;
    for(const button of tabs.children){
      button.hidden=!available.some(([key])=>key===button.dataset.element);button.setAttribute('aria-selected',String(button.dataset.element===selectedElement));
      button.tabIndex=button.dataset.element===selectedElement?0:-1;
    }
    const observation=selectedElement?music?.evidence[selectedElement]:null;
    host.querySelector('.planar-music').hidden=!observation;
    if(observation){
      $('music-title').textContent=ELEMENTS.find(([key])=>key===selectedElement)[1];$('music-value').textContent=String(observation.value);
      $('music-unit').textContent=observation.unit;$('music-method').textContent=observation.source.method;
      $('music-source').textContent=observation.source.id;
    }
    host.dataset.source=source??'missing';host.dataset.timestamp=point?String(point.timestamp):'';
    host.dataset.valid=String(Boolean(data?.valid));host.dataset.frozen=String(frozen);
    const musical=visualMode!=='eeg';
    const notes=musical&&layer==='notes';
    scoreView.setVisible(notes);
    host.querySelector('.scene-host').hidden=notes;
    host.querySelector('.score-scope').hidden=!notes;
    host.querySelector('.paired-panel').hidden=visualMode!=='overlay'||notes;
    host.querySelector('.research-advanced').hidden=!musical;
    host.querySelector('.experiment-disclosure').hidden=!musical;
    const labels=viewLabels(musical,layer);
    $('space').querySelector('[value="time"]').textContent=labels.time;
    $('space').querySelector('[value="plane"]').textContent=labels.plane;
    $('profile-caption').hidden=!musical||layer!=='profile';
    host.querySelector('.music-player').hidden=!musical;
    $('space').disabled=musical&&!['worm','structure'].includes(layer);host.querySelector('.time-view-hint').hidden=space!=='time'||musical&&!['worm','structure'].includes(layer);
    host.querySelector('.reference-readouts').hidden=!musical;
    host.querySelector('.music-layer-tabs').hidden=!musical;
    host.querySelector('.comparison-key').hidden=!musical||notes;
    host.querySelector('.research-transport').hidden=musical;
    host.querySelector('.version-comparisons').hidden=!musical;
    $('window').disabled=$('scale').disabled=musical;
    const pairing=data?.snapshot?.pairMethod==='same-report'?(data?.snapshot?.valid?'同協議報告':'等待有效同報告雙指數'):
      data?.snapshot?.pairMethod==='legacy-latest-fields'?`舊記錄字段時間配對 · 差 ${format(data.snapshot.pairDeltaMs)} ms`:'配對方法依來源記錄';
    $('acquisition-details').textContent=`${pairing} · ${data?.snapshot?.raw?.sampleRate?'來源標示 '+data.snapshot.raw.sampleRate+' Hz':'采樣率未回報'} · 設備電壓增益未標定`;
    $('scale-note').textContent=scale===100?'坐標窗口，未改變原生指數':`坐標窗口 ${scale} 點 · 原始數值不變`;
    if(musical){renderMusic();return;}
    if(!scaleAnchor&&point)scaleAnchor={attention:point.attention,relaxation:point.relaxation};
    if(point&&scale<100&&scaleAnchor&&(Math.abs(point.attention-scaleAnchor.attention)>scale*.4||
      Math.abs(point.relaxation-scaleAnchor.relaxation)>scale*.4))scaleAnchor={attention:point.attention,relaxation:point.relaxation};
    const ranges={x:zoomRange(scaleAnchor?.attention,scale),y:zoomRange(scaleAnchor?.relaxation,scale)};
    scene.update({points,selected:displayedPoint,active:active&&!historical,reference,ranges,space,windowSeconds:Number($('window').value)});
  }
  for(const button of host.querySelectorAll('[data-element]')){
    button.onclick=()=>{selectedElement=button.dataset.element;render();
      host.querySelector('.planar-music').scrollIntoView({block:'nearest',inline:'nearest'});
    };
    button.onkeydown=e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const visible=[...host.querySelectorAll('[data-element]')].filter(b=>!b.hidden),i=visible.indexOf(button);
      const next=e.key==='Home'?0:e.key==='End'?visible.length-1:(i+(e.key==='ArrowRight'?1:visible.length-1))%visible.length;
      visible[next]?.click();visible[next]?.focus();
    };
  }
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);audio.pause();scene.dispose();pairedScene.dispose();scoreView.dispose();experiment.dispose();versionResize.disconnect();window.removeEventListener('keydown',escape);},{once:true});
  render();loadCases();
  return {updateEEG(trace,valid,context={}){
    // A change in the shared sidebar must leave the previous source.
    if(latest&&latest.mode!==context.mode){frozen=false;held=null;cursor=null;scaleAnchor=null;signature='';beginRun();}
    latest={trace,valid:Boolean(valid),...context};experiment.accept(latest);
    const identity=JSON.stringify([context.mode,context.snapshot?.source,context.snapshot?.sessionId,context.snapshot?.connectionEpoch]);
    if(identity!==sourceIdentity){sourceIdentity=identity;beginRun();}
    const point=trace?.points.at(-1),pairKey=point?JSON.stringify([identity,point.timestamp]):null;
    if(valid&&point&&pairKey!==lastPairKey&&!audio.paused){
      const aligned=alignEEG(point,{wallNow:observationNow(),mediaTime:audio.currentTime,startedAt,run});
      if(aligned){paired.push(aligned);paired=paired.filter(q=>q.t>=audio.currentTime-60).slice(-2048);}
      lastPairKey=pairKey;
    }
    const p=trace?.points.at(-1),key=JSON.stringify([p?.timestamp,p?.source,p?.connectionEpoch,
      context.snapshot?.source,context.snapshot?.sessionId,context.amplitude?.at,context.amplitude?.rms,
      context.amplitude?.unit,valid,context.mode,context.paused,context.replayLoaded,trace?.points.length]);
    if(key===signature)return;signature=key;if(!frozen)render();
  }};
}
