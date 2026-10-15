import {MUSIC_LAYERS,validatePerformance,observationAt,layerDescription,extent,intervalPaths} from '../src/performance-model.mjs';
import {chord,triad,transform,fifth,chordName,scale,PITCH_NAMES,frequency} from '../src/tonal-model.mjs';
const icons={
  play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
  reset:'<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m21 15-5-5L5 21"/>',
  left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;
export function mountResearch(host,{onSelect=()=>{}}={}){
  let data=null,tonal=null,observed=null,source='explore',selection=2,time=0,eeg=null,eegValid=false,lastEeg='';
  let current=chord(0,'major'),destroyed=false,desiredSeek=null,audioContext=null,observedPromise=null,auditionSerial=0;
  const abort=new AbortController(),signal=abort.signal;
  host.innerHTML=`
    <div class="research-toolbar">
      <div class="research-segment" aria-label="資料與探索">
        <button data-source="explore" aria-pressed="true">探索</button><button data-source="music" aria-pressed="false">演奏</button><button data-source="eeg" aria-pressed="false">腦電</button>
      </div>
      <span data-role="plot-meta" class="research-context">音級探索</span>
      <div class="research-actions">
        <button class="icon-button" data-action="reset" aria-label="重設視角" title="重設視角">${icon('reset')}</button>
        <button class="icon-button" data-action="export" aria-label="保存圖形" title="保存圖形">${icon('image')}</button>
        <button class="icon-button" data-action="expand" aria-label="專注顯示" aria-pressed="false" title="專注顯示">${icon('expand')}</button>
      </div>
    </div>
    <div class="research-workspace">
      <section id="research-detail" class="research-detail" role="tabpanel" aria-labelledby="research-tab-harmony">
        <h2 data-role="detail-title">和聲</h2>
        <strong data-role="detail-value">C major</strong>
        <span class="detail-unit" data-role="detail-unit">C · E · G</span>
        <div class="harmonic-controls" data-role="harmonic-controls">
          <div class="plr-controls" aria-label="新里曼和弦變換">${['P','L','R'].map(op=>`<button data-transform="${op}" aria-label="${op} 和弦變換"><span>${op}</span><small data-target="${op}"></small></button>`).join('')}</div>
          <div class="fifth-controls">
            <button class="icon-button" data-fifth="-1" aria-label="前一個五度">${icon('left')}</button>
            <button data-action="audition">試聽</button>
            <button class="icon-button" data-fifth="1" aria-label="後一個五度">${icon('right')}</button>
          </div>
          <details class="pitch-choice"><summary>音級</summary>
            <label>根音<select data-role="root" aria-label="和弦根音">${PITCH_NAMES.map((p,i)=>`<option value="${i}">${p}</option>`).join('')}</select></label>
            <label>和弦<select data-role="quality" aria-label="和弦類型"><option value="major">大三和弦</option><option value="minor">小三和弦</option></select></label>
          </details>
        </div>
        <canvas class="detail-spark" aria-label="所選要素的時間曲線" hidden></canvas>
        <details class="detail-evidence"><summary>來源</summary>
          <p data-role="detail-note"></p>
          <dl><dt>來源</dt><dd data-role="detail-source"></dd><dt>時間</dt><dd data-role="detail-time"></dd></dl>
        </details>
        <output data-role="theory-status" class="theory-status" role="status"></output>
      </section>
      <section class="research-plot" aria-label="音樂空間與觀測資料">
        <div class="scene-host"><p class="scene-message" data-role="scene-error" hidden></p></div>
      </section>
    </div>
    <div class="element-tabs" role="tablist" aria-label="十個音樂要素">${MUSIC_LAYERS.map((l,i)=>`<button role="tab" id="research-tab-${l.key}" aria-controls="research-detail" aria-selected="${i===2}" tabindex="${i===2?0:-1}" data-layer="${i}">${l.name}</button>`).join('')}</div>
    <div class="research-transport">
      <button class="icon-button playback" data-action="play" aria-label="播放演奏樣例" disabled>${icon('play')}</button>
      <output data-role="time">00:00.0</output><input data-role="seek" aria-label="演奏播放位置" type="range" min="0" max="38.4" step=".01" value="0" disabled>
      <span data-role="duration">—</span>
      <label class="research-volume">音量<input data-role="volume" aria-label="音量" type="range" min="0" max="1" step=".01" value=".65"></label>
    </div>
    <div class="research-source">
      <div><span data-role="track-title">讀取演奏樣例</span><small data-role="track-credit"></small></div>
      <span data-role="media-status" role="status"></span><a href="https://v3.vmus.net/fig3/" target="_blank" rel="noopener">Vmus ↗</a>
    </div>
    <details class="research-method"><summary>方法與來源</summary>
      <p>球形布局用於十二音級探索；灰色採樣點和線是幾何參考，藍色關係表示所選和弦。幾何距離不是心理距離，球形布局不等同標準Tonnetz的拓撲。</p>
      <p>探索中的和弦是手動選擇；試聽為十二平均律合成音。演奏樣例的速度、RMS電平、拍點間隔和頻譜質心保留實際單位。MEI未與音訊逐時對位，不推斷目前的旋律、和聲或調式。</p>
      <a href="./docs/WORM-METHODS.md" target="_blank" rel="noopener">計算方法與文獻 ↗</a><a data-role="score-link" target="_blank" rel="noopener">原始譜面 ↗</a>
    </details><audio data-role="audio" preload="metadata"></audio>`;
  const $=name=>host.querySelector(`[data-role="${name}"]`),action=name=>host.querySelector(`[data-action="${name}"]`);
  const audio=$('audio');audio.volume=.65;
  const report=message=>{$('media-status').textContent=message;};
  function updateTheory(value){
    auditionSerial++;$('theory-status').textContent='';
    current=chord(value.root,value.quality);tonal?.setChord(current);
    $('root').value=String(current.root);$('quality').value=current.quality;
    host.dataset.chord=`${current.root}:${current.quality}`;
    host.querySelectorAll('[data-target]').forEach(e=>{e.textContent=chordName(transform(current,e.dataset.target),true);});
    updateDetails();
  }
  function change(operation){if(source!=='explore')setSource('explore');updateTheory(transform(current,operation));}
  function step(direction){if(source!=='explore')setSource('explore');updateTheory(fifth(current,direction));}
  host.querySelectorAll('[data-transform]').forEach(b=>b.onclick=()=>change(b.dataset.transform));
  host.querySelectorAll('[data-fifth]').forEach(b=>b.onclick=()=>step(Number(b.dataset.fifth)));
  $('root').onchange=()=>updateTheory(chord(Number($('root').value),current.quality));
  $('quality').onchange=()=>updateTheory(chord(current.root,$('quality').value));
  action('audition').onclick=async()=>{
    try{
      audioContext??=new (window.AudioContext||window.webkitAudioContext)();
      await audioContext.resume();
      const start=audioContext.currentTime,serial=++auditionSerial;
      for(const pitch of triad(current)){
        const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
        oscillator.type='sine';oscillator.frequency.value=frequency(pitch,4);
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.04);
        gain.gain.exponentialRampToValueAtTime(.001,start+1.2);
        oscillator.connect(gain);gain.connect(audioContext.destination);
        oscillator.start(start);oscillator.stop(start+1.25);
        oscillator.onended=()=>{
          oscillator.disconnect();gain.disconnect();
          if(serial===auditionSerial)$('theory-status').textContent='';
        };
      }
      $('theory-status').textContent=`試聽 · ${chordName(current)}`;
      host.dataset.audition='synthesized';
    }catch{$('theory-status').textContent='此瀏覽器未能試聽合成和弦。';}
  };
  async function showScene(){
    tonal?.setVisible(source==='explore');
    if(source!=='explore'&&!observed){
      try{
        observedPromise??=import('../src/worm-scene.mjs').then(({WormScene})=>{
          if(destroyed)return null;
          return new WormScene(host.querySelector('.scene-host'),{onFailure:graphicsFailure});
        });
        observed=await observedPromise;if(destroyed)return;
      }catch(error){console.error('Observed scene failed',error);graphicsFailure('觀測圖形不可用，數值與來源仍可查看。');}
    }
    if(observed){
      observed.canvas.hidden=source==='explore';observed.controls.enabled=source!=='explore';
      if(source!=='explore'){
        observed.setSource(source,data,eeg);observed.setView(source==='eeg'?'trace':'focus',selection);
        observed.updateCursor(time,eeg);
      }
    }
    if(source==='explore')tonal?.setLayer(selection);
  }
  function setSource(value){
    auditionSerial++;$('theory-status').textContent='';
    source=value;host.dataset.source=source;
    host.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===source)));
    if(source==='eeg')audio.pause();
    host.querySelector('.research-transport').hidden=source==='eeg';
    host.querySelector('.research-source').hidden=source==='eeg';
    showScene();updateDetails();
  }
  function select(index){
    selection=index;onSelect(index);host.dataset.layer=MUSIC_LAYERS[index].key;
    host.querySelectorAll('[data-layer]').forEach(b=>{
      const active=Number(b.dataset.layer)===index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
    });
    host.querySelector('#research-detail').setAttribute('aria-labelledby',`research-tab-${MUSIC_LAYERS[index].key}`);
    setSource(MUSIC_LAYERS[index].metric?'music':'explore');
  }
  host.querySelectorAll('.element-tabs [data-layer]').forEach(b=>{
    b.onclick=()=>select(Number(b.dataset.layer));
    b.onkeydown=e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const index=e.key==='Home'?0:e.key==='End'?9:(Number(b.dataset.layer)+(e.key==='ArrowRight'?1:9))%10;
      select(index);host.querySelector(`.element-tabs [data-layer="${index}"]`).focus();
    };
  });
  host.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{
    if(b.dataset.source==='music'&&!MUSIC_LAYERS[selection].metric){select(4);return;}
    if(b.dataset.source==='explore'&&MUSIC_LAYERS[selection].metric){select(2);return;}
    setSource(b.dataset.source);
  });
  action('reset').onclick=()=>source==='explore'?tonal?.reset():observed?.moveCamera();
  action('expand').onclick=()=>{
    const on=document.body.classList.toggle('research-focus');action('expand').setAttribute('aria-pressed',String(on));
  };
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){
    document.body.classList.remove('research-focus');action('expand').setAttribute('aria-pressed','false');
  }},{signal});
  action('export').onclick=()=>{
    const scene=source==='explore'?tonal:observed;if(!scene)return;
    const a=document.createElement('a');a.href=scene.exportPNG?.()??scene.canvas.toDataURL('image/png');
    a.download=`worm-${source}-${MUSIC_LAYERS[selection].key}-${Date.now()}.png`;a.click();
  };
  action('play').onclick=async()=>{
    if(!audio.paused){audio.pause();return;}if(audio.ended){audio.currentTime=0;time=0;}
    report('連接音訊…');try{await audio.play();report('');}catch{report('音訊未能播放，可重試或開啟Vmus原站。');}
  };
  audio.addEventListener('play',()=>{action('play').innerHTML=icon('pause');action('play').setAttribute('aria-label','暫停演奏樣例');},{signal});
  audio.addEventListener('pause',()=>{action('play').innerHTML=icon('play');action('play').setAttribute('aria-label','播放演奏樣例');},{signal});
  for(const [event,message] of [['waiting','音訊緩衝中'],['playing',''],['error','原站音訊暫不可用；觀測資料可查看。'],['ended','播放完畢']])
    audio.addEventListener(event,()=>report(message),{signal});
  audio.addEventListener('timeupdate',()=>{time=audio.currentTime;$('seek').value=String(time);updateDetails();},{signal});
  audio.addEventListener('loadedmetadata',()=>{if(desiredSeek!==null){audio.currentTime=Math.min(desiredSeek,audio.duration);desiredSeek=null;}},{signal});
  $('seek').oninput=()=>{
    time=Number($('seek').value);if(audio.readyState>=1)audio.currentTime=time;else desiredSeek=time;
    if(!audio.error)report('');updateDetails();
  };
  $('volume').oninput=()=>{audio.volume=Number($('volume').value);};
  function spark(layer){
    const canvas=host.querySelector('.detail-spark'),rows=source==='music'&&layer.metric?data?.rows??[]:[];
    canvas.hidden=!rows.length;if(!rows.length)return;
    const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
    const [lo,hi]=extent(rows.map(p=>p[layer.key]));ctx.strokeStyle='#315ad7';ctx.lineWidth=1.4;ctx.beginPath();
    for(const path of intervalPaths(data,layer.key))path.forEach(([t,v],i)=>{
      const x=t/data.duration*w,y=h-7-(v-lo)/(hi-lo)*(h-15);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    });
    ctx.stroke();ctx.strokeStyle='#77818f';ctx.beginPath();const x=time/data.duration*w;ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }
  function updateDetails(){
    const layer=MUSIC_LAYERS[selection],p=source==='music'?observationAt(data,time):null;
    let description=layerDescription(layer,data),value=layer.metric?(p?p[layer.key].toFixed(layer.key==='dynamics'?1:0):'—'):description.value;
    let unit=layer.metric?layer.unit:'';
    if(source==='explore'&&[2,5].includes(selection)){
      value=chordName(current);unit=(selection===5?scale(current):triad(current)).map(n=>PITCH_NAMES[n]).join(' · ');
      description={source:'十二平均律 · 手動探索',note:'所選音集不代表目前錄音的和聲或調式。'};
    }
    if(source==='eeg'){
      value=eeg?.points.length?String(eeg.points.length):'—';unit='有效樣本';
      const kind=eeg?.points.at(-1)?.source;
      description={source:kind==='demo'?'合成示範':kind==='replay'?'記錄回放':kind?'設備原生指數':'未提供',
        note:kind==='demo'?'合成資料，不是設備測量；不推斷音樂要素。':'專注與冥想／放鬆；不推斷音樂要素。'};
    }
    $('detail-title').textContent=source==='eeg'?'腦電觀測':layer.name;$('detail-value').textContent=value;$('detail-unit').textContent=unit;
    $('harmonic-controls').hidden=source!=='explore';
    $('detail-note').textContent=description.note;$('detail-source').textContent=description.source;
    $('detail-time').textContent=source==='eeg'?'設備時鐘':source==='explore'&&[2,5].includes(selection)?'—':
      layer.metric?(p?`${p.t.toFixed(2)}–${p.end.toFixed(2)} s`:'未覆蓋'):'尚未對位音訊';
    $('time').textContent=clock(time);
    const point=eeg?.points.at(-1);
    $('plot-meta').textContent=source==='explore'?'音級探索':source==='music'?'Vmus · 演奏觀測':
      `${point?.source==='demo'?'合成示範':point?.source==='replay'?'記錄回放':point?'設備指數':'等待有效資料'}${point&&!eegValid?' · 暫停':''}`;
    observed?.updateCursor(time,eeg);spark(layer);
  }
  function graphicsFailure(message){$('scene-error').hidden=false;$('scene-error').textContent=message;}
  async function initialize(){
    try{
      const {TonalScene}=await import('../src/tonal-scene.mjs');if(destroyed)return;
      tonal=new TonalScene(host.querySelector('.scene-host'),{
        onPick:pitch=>updateTheory(chord(pitch,current.quality)),onFifth:step,onTransform:change,onFailure:graphicsFailure,
      });
      tonal.setLayer(selection);updateTheory(current);host.dataset.ready='true';
    }catch(error){console.error('Tonal graphics initialization failed',error);graphicsFailure('球形圖形不可用；和弦與音級選擇仍可使用。');}
    try{
      const response=await fetch('./public/research/vmus-performance.json');
      if(!response.ok)throw new Error('Performance data unavailable');
      data=validatePerformance(await response.json());if(destroyed)return;
      $('track-title').textContent=`演奏樣例 · ${data.title}`;$('track-credit').textContent=`${data.performers} · ${data.year}`;
      $('duration').textContent=clock(data.duration);$('seek').max=String(data.duration);$('seek').disabled=false;
      $('score-link').href=data.score;audio.src=data.media;action('play').disabled=false;
      if(source!=='explore')showScene();updateDetails();
    }catch(error){console.error('Performance observations unavailable',error);report('演奏觀測資料未能載入');$('track-title').textContent='演奏資料不可用';}
  }
  updateTheory(current);host.dataset.source=source;host.dataset.layer='harmony';initialize();
  const observer=new ResizeObserver(()=>spark(MUSIC_LAYERS[selection]));observer.observe(host);
  window.addEventListener('pagehide',()=>{
    destroyed=true;audio.pause();audioContext?.close();tonal?.dispose();observed?.dispose();observer.disconnect();abort.abort();
  },{signal,once:true});
  return {updateEEG(trace,valid){
    eeg=trace;eegValid=Boolean(valid);
    const p=trace?.points.at(-1),key=`${p?.timestamp}:${p?.source}:${p?.connectionEpoch}:${eegValid}`;
    if(key===lastEeg)return;lastEeg=key;
    if(source==='eeg'){observed?.setSource('eeg',data,eeg);updateDetails();}
  }};
}
