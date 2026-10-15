import {MUSIC_LAYERS,validatePerformance,observationAt,layerDescription,extent,intervalPaths} from '../src/performance-model.mjs';

const icons={
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  pause:'<path d="M10 4H6v16h4zM18 4h-4v16h4z"/>',
  reset:'<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-5-5L5 21"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;
export function mountResearch(host,{onSelect=()=>{}}={}){
  let data=null,scene=null,source='music',selection=4,mode='trace',time=0,eeg=null,lastEeg='',destroyed=false,eegValid=false;
  host.innerHTML=`
    <div class="research-toolbar">
      <div class="research-segment" aria-label="觀測資料源">
        <button data-source="music" aria-pressed="true">演奏</button><button data-source="eeg" aria-pressed="false">腦電</button>
      </div>
      <div class="research-segment research-views" aria-label="空間視圖">
        <button data-scene="trace" aria-pressed="true">軌跡</button><button data-scene="focus" aria-pressed="false">側轉</button><button data-scene="solo" aria-pressed="false">單層</button>
      </div>
      <select data-role="smoothing" class="research-smoothing" aria-label="軌跡顯示平滑"><option value="0">原始軌跡</option><option value="1" selected>1 s 平滑</option><option value="2">2 s 平滑</option></select>
      <div class="research-actions">
        <button class="icon-button" data-action="reset" aria-label="重設視角" title="重設視角">${icon('reset')}</button>
        <button class="icon-button" data-action="export" aria-label="保存圖形" title="保存圖形">${icon('image')}</button>
        <button class="icon-button" data-action="expand" aria-label="專注顯示" title="專注顯示">${icon('expand')}</button>
      </div>
    </div>
    <div class="research-workspace">
      <section class="research-plot" aria-label="神經蠕蟲資料圖">
        <div class="plot-caption"><span data-role="plot-title">速度 — RMS電平</span><span data-role="plot-meta">Vmus · 演奏樣例</span></div>
        <div class="scene-host"><p class="scene-message" data-role="scene-error" hidden></p></div>
        <div class="plot-measures" aria-live="off">
          <div><span data-role="metric-a-title">速度</span><b data-role="metric-a">—</b><small data-role="unit-a">♪/min</small></div>
          <div><span data-role="metric-b-title">RMS電平</span><b data-role="metric-b">—</b><small data-role="unit-b">dBFS</small></div>
          <div><span data-role="metric-c-title">拍點</span><b data-role="metric-c">—</b><small data-role="unit-c">小節.拍</small></div>
        </div>
      </section>
      <aside class="research-inspector" aria-label="音樂要素">
        <div class="element-tabs" role="tablist" aria-label="音樂要素">${MUSIC_LAYERS.map((l,i)=>`
          <button role="tab" id="research-tab-${l.key}" aria-controls="research-detail" aria-selected="${i===4}" tabindex="${i===4?0:-1}" data-layer="${i}">
            <small>${String(i+1).padStart(2,'0')}</small><span>${l.name}</span><i></i>
          </button>`).join('')}
        </div>
        <section id="research-detail" class="research-detail" role="tabpanel" aria-labelledby="research-tab-tempo">
          <div class="detail-heading"><h2 data-role="detail-title">速度</h2><small data-role="detail-en">Tempo</small></div>
          <strong data-role="detail-value">—</strong><span class="detail-unit" data-role="detail-unit"></span>
          <canvas class="detail-spark" aria-label="所選要素的時間曲線"></canvas>
          <p data-role="detail-note"></p>
          <dl><dt>來源</dt><dd data-role="detail-source">—</dd><dt>時間</dt><dd data-role="detail-time">—</dd></dl>
        </section>
      </aside>
    </div>
    <div class="research-transport">
      <button class="icon-button playback" data-action="play" aria-label="播放演奏" disabled>${icon('play')}</button>
      <output data-role="time">00:00.0</output><input data-role="seek" aria-label="演奏播放位置" type="range" min="0" max="38.4" step=".01" value="0" disabled>
      <span data-role="duration">—</span>
      <label class="research-volume">音量<input data-role="volume" aria-label="音量" type="range" min="0" max="1" step=".01" value=".65"></label>
    </div>
    <div class="research-source">
      <div><span data-role="track-title">讀取演奏資料</span><small data-role="track-credit"></small></div>
      <span data-role="media-status" role="status"></span><a href="https://v3.vmus.net/fig3/" target="_blank" rel="noopener">Vmus ↗</a>
    </div>
    <details class="research-method"><summary>方法與來源</summary>
      <p>音樂圖：八分音符速率 × RMS電平；腦電圖：設備原生專注 × 冥想／放鬆。兩種資料各有自己的時鐘。</p>
      <p>軌跡保持正視；點選要素時側轉到該項資料頁，各頁保留自己的坐標與單位。缺少譜音對位的項目保留全局資料，不推算逐秒值。</p>
      <a href="./docs/WORM-METHODS.md" target="_blank" rel="noopener">計算方法與文獻 ↗</a>
      <a data-role="score-link" target="_blank" rel="noopener">原始譜面 ↗</a>
    </details>
    <audio data-role="audio" preload="metadata"></audio>`;
  const $=name=>host.querySelector(`[data-role="${name}"]`);
  const action=name=>host.querySelector(`[data-action="${name}"]`);
  const audio=$('audio');audio.volume=.65;
  let desiredSeek=null;
  function report(message){$('media-status').textContent=message;}
  function setMode(value){
    mode=value;host.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===mode)));
    $('smoothing').disabled=mode!=='trace';
    $('smoothing').hidden=mode!=='trace';
    scene?.setView(mode,selection);
    $('plot-title').textContent=mode==='trace'?(source==='music'?'速度 — RMS電平':'專注 — 冥想／放鬆'):MUSIC_LAYERS[selection].name;
  }
  function select(index){
    selection=index;onSelect(index);
    host.querySelectorAll('.element-tabs [data-layer]').forEach(b=>{
      const active=Number(b.dataset.layer)===index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
    });
    host.querySelector('#research-detail').setAttribute('aria-labelledby',`research-tab-${MUSIC_LAYERS[index].key}`);
    setMode(mode==='solo'?'solo':'focus');updateDetails();
  }
  host.querySelectorAll('.element-tabs [data-layer]').forEach(b=>{
    b.onclick=()=>select(Number(b.dataset.layer));
    b.onkeydown=e=>{
      if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();
      let i=Number(b.dataset.layer);
      i=e.key==='Home'?0:e.key==='End'?9:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:9))%10;
      select(i);host.querySelector(`[data-layer="${i}"]`).focus();
    };
  });
  host.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>setMode(b.dataset.scene));
  $('smoothing').onchange=()=>{scene?.setSmoothing(Number($('smoothing').value));};
  host.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{
    source=b.dataset.source;if(source==='eeg')audio.pause();
    host.querySelectorAll('[data-source]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.source===source)));
    host.querySelector('.research-transport').hidden=source==='eeg';
    host.querySelector('.research-source').hidden=source==='eeg';
    scene?.setSource(source,data,eeg);setMode('trace');updateDetails();
  });
  action('reset').onclick=()=>scene?.moveCamera();
  action('expand').onclick=()=>{
    const on=document.body.classList.toggle('research-focus');action('expand').setAttribute('aria-pressed',String(on));
  };
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){
    document.body.classList.remove('research-focus');action('expand').setAttribute('aria-pressed','false');
  }});
  action('export').onclick=()=>{
    if(!scene)return;const a=document.createElement('a');
    a.href=scene.canvas.toDataURL('image/png');a.download=`worm-${source}-${MUSIC_LAYERS[selection].key}-${Date.now()}.png`;a.click();
  };
  action('play').onclick=async()=>{
    if(!audio.paused){audio.pause();return;}
    if(audio.ended){audio.currentTime=0;time=0;}
    report('連接音訊…');
    try{await audio.play();report('');}catch{report('音訊未能播放，可重試或開啟Vmus原站。');}
  };
  audio.addEventListener('play',()=>{action('play').innerHTML=icon('pause');action('play').setAttribute('aria-label','暫停演奏');});
  audio.addEventListener('pause',()=>{action('play').innerHTML=icon('play');action('play').setAttribute('aria-label','播放演奏');});
  audio.addEventListener('waiting',()=>report('音訊緩衝中'));
  audio.addEventListener('playing',()=>report(''));
  audio.addEventListener('error',()=>report('原站音訊暫不可用；觀測資料可查看。'));
  audio.addEventListener('ended',()=>report('播放完畢'));
  audio.addEventListener('timeupdate',()=>{time=audio.currentTime;$('seek').value=String(time);updateDetails();});
  audio.addEventListener('loadedmetadata',()=>{
    if(desiredSeek!==null){audio.currentTime=Math.min(desiredSeek,audio.duration);desiredSeek=null;}
  });
  $('seek').oninput=()=>{
    time=Number($('seek').value);
    if(audio.readyState>=1)audio.currentTime=time;else desiredSeek=time;
    if(!audio.error)report('');
    updateDetails();
  };
  $('volume').oninput=()=>{audio.volume=Number($('volume').value);};
  function spark(layer){
    const canvas=host.querySelector('.detail-spark');
    const rows=source==='music'&&layer.metric?data?.rows??[]:[];
    canvas.hidden=!rows.length;if(!rows.length)return;
    const r=canvas.getBoundingClientRect();
    if(!r.width)return;
    const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height;
    ctx.clearRect(0,0,w,h);
    const [lo,hi]=extent(rows.map(p=>p[layer.key]));ctx.strokeStyle='#323e39';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,h-8);ctx.lineTo(w,h-8);ctx.stroke();
    ctx.strokeStyle='#b8cba7';ctx.beginPath();
    for(const segment of intervalPaths(data,layer.key)){
      segment.forEach(([t,value],i)=>{
        const x=t/data.duration*w,y=h-12-(value-lo)/(hi-lo)*(h-22);
        if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
    }ctx.stroke();
    ctx.strokeStyle='#e0e7d7';const x=time/data.duration*w;ctx.beginPath();ctx.moveTo(x,5);ctx.lineTo(x,h-7);ctx.stroke();
  }
  function updateDetails(){
    const layer=MUSIC_LAYERS[selection],p=source==='music'?observationAt(data,time):null;
    const description=layerDescription(layer,source==='music'?data:null);
    $('detail-title').textContent=layer.name;$('detail-en').textContent=layer.en;
    $('detail-value').textContent=layer.metric?(p?p[layer.key].toFixed(layer.key==='dynamics'?1:0):'—'):description.value;
    $('detail-unit').textContent=layer.metric?layer.unit:'';
    $('detail-note').textContent=source==='music'?description.note:'音樂觀測未提供';
    $('detail-source').textContent=description.source;$('detail-time').textContent=
      source==='eeg'?'—':layer.metric&&p?`${p.t.toFixed(2)}–${p.end.toFixed(2)} s`:layer.metric?'未覆蓋':
        description.source==='—'?'未提供':description.source==='MEI'?'全局譜面':'曲目資料';
    $('time').textContent=clock(time);
    const point=eeg?.points.at(-1);
    $('metric-a-title').textContent=source==='music'?'速度':'專注';
    $('metric-b-title').textContent=source==='music'?'RMS電平':'冥想／放鬆';
    $('metric-c-title').textContent=source==='music'?'拍點':'有效樣本';
    $('metric-a').textContent=source==='music'?(p?.tempo.toFixed(1)??'—'):(point?.attention.toFixed(1)??'—');
    $('metric-b').textContent=source==='music'?(p?.dynamics.toFixed(1)??'—'):(point?.relaxation.toFixed(1)??'—');
    $('metric-c').textContent=source==='music'?(p?.label??'—'):String(eeg?.points.length??0);
    $('unit-a').textContent=source==='music'?'♪/min':'/ 100';
    $('unit-b').textContent=source==='music'?'dBFS':'/ 100';
    $('unit-c').textContent=source==='music'?'小節.拍':'';
    $('plot-meta').textContent=source==='music'?'Vmus · 演奏樣例':`${point?.source==='demo'?'合成示範':point?.source==='replay'?'記錄回放':point?'設備指數':'等待有效資料'}${point&&!eegValid?' · 暫停':''}`;
    scene?.updateCursor(time,eeg);spark(layer);
  }
  async function initialize(){
    try{
      const {WormScene}=await import('../src/worm-scene.mjs');if(destroyed)return;
      scene=new WormScene(host.querySelector('.scene-host'),{onFailure:message=>{
        $('scene-error').hidden=false;$('scene-error').textContent=message;
      }});
      scene.setView('trace',selection);
    }catch(error){
      console.error('Research graphics initialization failed',error);
      $('scene-error').hidden=false;$('scene-error').textContent='此瀏覽器未能建立WebGL。數值與時間曲線仍可查看。';
      action('export').disabled=true;action('reset').disabled=true;
    }
    try{
      const response=await fetch('./public/research/vmus-performance.json');
      if(!response.ok)throw new Error();data=validatePerformance(await response.json());if(destroyed)return;
      $('track-title').textContent=data.title;$('track-credit').textContent=`${data.performers} · ${data.year}`;
      $('duration').textContent=clock(data.duration);$('seek').max=String(data.duration);$('seek').disabled=false;
      $('score-link').href=data.score;audio.src=data.media;action('play').disabled=false;
      host.querySelectorAll('.element-tabs [data-layer]').forEach(b=>{b.dataset.measured=String(Boolean(MUSIC_LAYERS[Number(b.dataset.layer)].metric));});
      scene?.setSource(source,data,eeg);updateDetails();
    }catch(error){console.error('Research observations initialization failed',error);
      report('演奏觀測資料未能載入');$('track-title').textContent='演奏資料不可用';}
  }
  initialize();
  const observer=new ResizeObserver(()=>spark(MUSIC_LAYERS[selection]));observer.observe(host);
  window.addEventListener('pagehide',()=>{destroyed=true;audio.pause();scene?.dispose();observer.disconnect();});
  return {updateEEG(trace,valid){
    eeg=trace;eegValid=Boolean(valid);
    const point=trace?.points.at(-1),key=`${point?.timestamp}:${point?.source}:${point?.connectionEpoch}:${eegValid}`;
    if(key===lastEeg)return;lastEeg=key;
    if(source==='eeg'){scene?.setSource(source,data,eeg);updateDetails();}
  }};
}
