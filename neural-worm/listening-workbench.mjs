import {ListeningTrial} from '../src/listening-experiment.mjs';
const number=x=>Number.isFinite(x)?x.toFixed(3):'—';
/** Three explicit listening trials; this module never fabricates device data. */
export function mountListening(host,{getContext,getRecording,selectRecording,getMusic,getImage}){
 host.innerHTML=`<div class="experiment-heading"><h3>版本實驗</h3><span data-trial-status role="status">選擇同一作品的三個版本</span></div>
  <div class="trial-selection">${[0,1,2].map(i=>`<label>版本 ${i+1}<select data-trial-slot="${i}" disabled></select></label>`).join('')}<label>觀察時長<select data-trial-length><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label></div>
  <div class="trial-actions"><button data-trial-start disabled>開始版本 1</button><button data-trial-stop disabled>結束本次</button><button data-trial-save disabled>保存實驗</button><button data-trial-new disabled>新一組</button><span data-trial-progress></span></div>
  <table class="trial-statistics"><caption>現場設備資料 · 逐版本描述統計</caption><thead><tr><th>版本</th><th>有效點</th><th>關注 μ / s</th><th>放鬆 μ / s</th><th>速度—關注</th><th>速度—放鬆</th></tr></thead><tbody></tbody></table>
  <details class="trial-method"><summary>計算與時間配對</summary><p>μ = Σx/n；s = √[Σ(x−μ)²/(n−1)]；Pearson r = Σ[(x−μx)(y−μy)] / √[Σ(x−μx)²Σ(y−μy)²]。使用原始速度和同時刻設備指數；少於3對或零方差时标为不足，不计算r。</p><p>表格中的正／負／不足是关系方向摘要，不是原始波形上下方向。r僅為探索性的同時相關，未控制時間自相關、偽跡及聲卡／設備延遲，不用於審美、同質性、因果或療效判定。切換來源和無效資料均保留缺口。音訊保持原速；只接收現場設備資料，示範與回放不建實驗。</p></details>`;
 const $=s=>host.querySelector(s),slots=[...host.querySelectorAll('[data-trial-slot]')];
 let rows=[],active=null,trials=[],timer=null,work=null,saved=false,saving=false;
 const status=$('[data-trial-status]'),start=$('[data-trial-start]'),stop=$('[data-trial-stop]'),save=$('[data-trial-save]');
 function validDevice(){const c=getContext();return c?.mode==='live'&&c.valid&&['device','core'].includes(c.snapshot?.source)&&['usb','ble'].includes(c.snapshot?.raw?.transport);}
 function render(){
  const index=trials.length,distinct=new Set(slots.map(s=>s.value)).size===3;
  start.disabled=Boolean(active)||saving||!validDevice()||index>=3||!distinct||!rows.length;
  stop.disabled=!active;$('[data-trial-new]').disabled=!saved||Boolean(active)||saving;save.disabled=Boolean(active)||saving||!trials.length||saved;
  for(const s of slots)s.disabled=Boolean(active)||Boolean(trials.length)||!rows.length;
  $('[data-trial-length]').disabled=Boolean(active)||Boolean(trials.length);
  start.textContent=index<3?`開始版本 ${index+1}`:'三個版本已完成';
  if(!active&&!trials.length)status.textContent=validDevice()?'設備有效 · 可開始版本 1':'等待現場有效设备資料';
  host.querySelector('tbody').replaceChildren(...trials.map((trial,i)=>{
   const tr=document.createElement('tr'),a=trial.statistics.attention,b=trial.statistics.relaxation;
   const relation=x=>x.direction==='insufficient'?'不足':`${number(x.r)} · ${x.direction==='positive'?'正':x.direction==='negative'?'負':x.direction==='none'?'無':'—'}`;
   for(const value of [`${i+1} · ${trial.recording.performer} ${trial.recording.year??''}`,trial.rows.length,`${number(a.mean)} / ${number(a.sd)}`,`${number(b.mean)} / ${number(b.sd)}`,relation(trial.statistics.tempoAttention),relation(trial.statistics.tempoRelaxation)]){
    const td=document.createElement('td');td.textContent=String(value);tr.append(td);}
   return tr;
  }));
  for(const control of host.parentElement.querySelectorAll('[data-visual]'))control.disabled=Boolean(active);
  for(const control of host.parentElement.querySelectorAll('[data-role=work],[data-role=case],[data-role=annotation],[data-role=music-seek]'))control.disabled=Boolean(active)||!rows.length;
  host.dataset.trials=String(trials.length);host.dataset.active=String(Boolean(active));
 }
 async function finish(){
  if(!active)return;const current=active;active=null;clearInterval(timer);timer=null;
  try{trials.push(current.finish(Date.now()));status.textContent=`版本 ${trials.length} 已記錄 · ${trials.at(-1).rows.length} 個有效點`;}
  catch(error){status.textContent=error.message;}
  render();
 }
 $('[data-trial-new]').onclick=()=>{if(!saved||active||saving)return;trials=[];saved=false;host.dataset.trials='0';delete host.dataset.savedDirectory;render();};
  const leave=e=>{if(active||trials.length&&!saved){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);
 start.onclick=async()=>{
  if(start.disabled)return;
  if(trials.length&&trials[0].recording.workId!==work){status.textContent='請完成保存當前作品的實驗。';return;}
  const id=slots[trials.length].value;
  try{
   await selectRecording(id);
   if(!validDevice())throw new Error('設備資料已失效，未開始試次。');
   const {audio}=getMusic();active=new ListeningTrial(getRecording(),audio.currentTime,Date.now());
   status.textContent=`版本 ${trials.length+1} 記錄中`;saved=false;render();
   timer=setInterval(()=>{if(!active)return;
    const seconds=(Date.now()-active.startedAt)/1000;$('[data-trial-progress]').textContent=`${seconds.toFixed(1)} / ${$('[data-trial-length]').value} s · ${active.rows.length} 點`;
    if(audio.paused||audio.ended||seconds>=Number($('[data-trial-length]').value)){finish();audio.pause();}
   },250);
  }catch(error){status.textContent='未開始 · '+error.message;render();}
 };
 stop.onclick=()=>{finish();getMusic().audio.pause();};
 save.onclick=async()=>{
  if(save.disabled)return;saving=true;render();status.textContent='保存中…';
  try{
   const response=await fetch('/api/experiments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'neural-listening-experiment-v1',trials,image:getImage()}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'本機保存失敗');
   saved=true;status.textContent=`已保存 · ${data.directory}`;host.dataset.savedDirectory=data.directory;
  }catch(error){status.textContent=`保存未完成，資料仍保留 · ${error.message}`;}
  finally{saving=false;render();}
 };
 return {
  populate(recordings,workId,preferred=[]){
   if(trials.length&&workId!==work){status.textContent='已記錄的實驗保留；請先保存。';return;}
   if(work===workId)return;work=workId;
   rows=recordings.filter(r=>r.workId===workId&&r.completeStudy&&r.year&&r.provenance!=='legacy').sort((a,b)=>a.year-b.year);
   const picks=[0,Math.floor((rows.length-1)/2),rows.length-1];
   slots.forEach((select,i)=>{select.replaceChildren(...rows.map(r=>Object.assign(document.createElement('option'),{value:r.id,textContent:`${r.performer} · ${r.year}`})));select.value=rows.some(r=>r.id===preferred[i])?preferred[i]:rows[picks[i]]?.id??'';});render();
  },
  accept(context){
   if(active){
    const {audio,point,pointAt}=getMusic();
    if(!audio.paused&&getRecording()?.id===active.recording.id)active.accept(context.snapshot?.raw,pointAt??point,Date.now(),audio.currentTime);
    else finish();
   }
   render();
  },
  busy(){return Boolean(active);},
  dispose(){clearInterval(timer);window.removeEventListener('beforeunload',leave);},
 };
}
