import {scoreEvidence,alignScore,scoreAt,scoreExport} from '../src/score-evidence.mjs';
import {temporalProjection} from '../src/temporal-model.mjs';
import {wrapText} from '../src/planar-model.mjs';
import {getLanguage,t} from '../src/i18n.mjs';
const kinds={repeat:'同音重複',chromatic:'同字母半音變化',step:'二度級進',leap:'三度及以上跳進'};
const rational=p=>p[1]===1?String(p[0]):p.join('/');
const fixed=n=>Number(n.toFixed(3)).toString();
const interval=e=>e.interval?`${e.interval.semitones>0?'+':''}${e.interval.semitones} ${t('半音')} · ${t(kinds[e.interval.kind])}`:t('—（起點／休止後）');
export function mountScore(host,{seek=()=>{}}={}){
  let score=null,aligned=null,recording=null,time=0,selected=null,key='',modelKey=null,error='',loading=false;
  let camera={yaw:.58,pitch:.38},drag=null,moved=false,hits=[],viewStamp='';
  host.innerHTML=`
    <div class="score-heading"><h3>音高與旋律</h3><span>Op.27 No.2 · 第 1–8 小節 · 上譜表</span>
      <button data-score-export disabled>匯出證據 JSON</button></div>
    <p class="score-state" role="status"></p>
    <dl class="score-current"><div><dt>譜面音高</dt><dd data-note-pitch>—</dd></div>
      <div><dt>旋律音程</dt><dd data-note-interval>—</dd></div>
      <div><dt>記譜時值／四分音符</dt><dd data-note-duration>—</dd></div></dl>
    <div class="score-scene"><canvas class="score-canvas" tabindex="0" aria-label="音高、記譜時值與整數小節層；點選音符定位，左右鍵選音，拖動轉向，Home重置"></canvas></div>
    <p class="score-legend">實線連接相鄰旋律起音；休止處斷開。圓點為降D大調音階內音，菱形為音階外拼寫。裝飾音另列。</p>
    <details class="score-measures"><summary>小節分量</summary><div class="score-table-wrap"><table><caption>按起音所在小節計數；跨小節音程歸入後音，休止斷鏈。密度單位：次／四分音符。</caption><thead><tr><th>小節</th><th>起音</th><th>密度</th><th>調外／起音</th><th>級進／音程</th><th>跳進／音程</th><th>休止佔比</th><th>時值分布</th></tr></thead><tbody></tbody></table></div>
      <p>分量獨立呈現。線性聚焦度／非線性離散度尚未定義運算窗口與權重，未合成指數。</p></details>
    <details class="score-events"><summary>逐音證據</summary><div class="score-table-wrap"><table><caption>小節內起點與時值以四分音符為1；時值合併延音。秒數是拍點插值估計，不是實測逐音起音。選取一列可定位。</caption><thead><tr><th>位置</th><th>音高／音階</th><th>音程</th><th>時值</th><th>時值log₂比</th><th>估計秒</th><th>源行／token</th></tr></thead><tbody></tbody></table></div><p data-score-ornaments></p><p data-score-dynamics></p></details>
    <details class="score-method"><summary>譜面來源與定位方法</summary>
      <p>肖邦研究院初版數字譜：M. Schlesinger, Paris，PL-Wbfc 3744/n。上譜表第1–8小節為單旋律；不按最高音提取聲部。延音續音不重計起音，裝飾音無實測時長，另列並排除常規密度與時值統計。</p>
      <p>調內／調外是相對於來源明示降D大調音階的音名拼寫比對；不等於局部調性、和聲不協和或音樂品質。級進依音名字母相鄰判二度，保留實際半音差；重複及同字母半音變化分開計數。</p>
      <p>小節內起點和時值保留有理數。兩軸為音高與記譜時值；深度為整數小節。空間坐標是顯示編碼。來源人工八分音符拍點之間作分段線性定位；演奏版本與初版差異未逐音核實，裝飾音不配時，未測量延音踏板或實際音長。</p>
      <p>First Editions of Fryderyk Chopin's Music · Copyright 2017–2021 The Fryderyk Chopin Institute (https://nifc.pl)。CC BY 4.0；本頁擷取第1–8小節、合併延音、分列裝飾音並計算描述量。</p>
      <a data-score-source target="_blank" rel="noopener">固定版本來源 ↗</a>
      <a href="./public/research/chopin-score/027-1-Sm-002.krn" target="_blank" rel="noopener">原始數字譜</a>
      <a href="./public/research/chopin-score/LICENSE.txt" target="_blank" rel="noopener">授權與署名</a>
      <a href="./docs/SCORE-EVIDENCE.html" target="_blank" rel="noopener">公式、邊界與復算</a>
      <p data-score-hash></p></details>`;
  const canvas=host.querySelector('canvas'),state=host.querySelector('.score-state');
  const $=s=>host.querySelector(s);
  function select(e){
    selected=e?.kind==='note'?e:null;
    if(aligned&&e)seek(e.t);
    render();
  }
  $('[data-score-export]').onclick=()=>download(scoreExport(score,aligned,recording));
  function download(value){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`score-evidence-op27-2-${recording?.id??'unaligned'}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function tables(){
    const rows=aligned?.events??score.events;
    const cell=(tr,text)=>{const td=document.createElement('td');td.textContent=text;tr.append(td);return td;};
    const body=$('.score-measures tbody');body.replaceChildren();
    for(const m of score.measures){
      const tr=document.createElement('tr');tr.dataset.bar=m.bar;
      for(const text of [m.bar,m.onsets,fixed(m.densityPerQuarter),`${m.outOfScaleCount}/${m.noteCount}`,
        `${m.stepCount}/${m.intervalCount}`,`${m.leapCount}/${m.intervalCount}`,fixed(m.restFraction),
        Object.entries(m.durationHistogram).map(([q,n])=>`${q} × ${n}`).join('；')||'—'])cell(tr,text);
      body.append(tr);
    }
    const events=$('.score-events tbody');events.replaceChildren();
    for(const e of rows){
      const tr=document.createElement('tr');tr.dataset.event=e.id;const td=cell(tr,'');
      const button=document.createElement('button');button.textContent=`${e.bar} 小節 · 起點 ${rational(e.onset)}`;button.disabled=!aligned;
      button.onclick=()=>select(e);td.append(button);
      for(const text of [e.kind==='rest'?'休止':`${e.pitchName} · ${e.inScale?'調內':'調外'}`,e.kind==='rest'?'—':interval(e),
        rational(e.duration),Number.isFinite(e.durationChangeLog2)?fixed(e.durationChangeLog2):'—',
        Number.isFinite(e.t)?e.t.toFixed(3):'未對齊',e.sourceRows.map((n,i)=>`L${n} ${e.tokens[i]}`).join(' + ')])cell(tr,text);
      events.append(tr);
    }
    $('[data-score-ornaments]').textContent=`${score.ornaments.length} 個裝飾音（無秒數／時長）：`+score.ornaments.map(e=>`${e.bar}小節 ${e.pitchName}（L${e.sourceRows[0]}）`).join('、');
    $('[data-score-dynamics]').textContent='顯式譜面力度標記：'+score.dynamics.map(d=>`${d.bar}小節 起點${rational(d.onset)} · ${d.mark}（L${d.sourceRow}${d.grace?'，裝飾音處':''}）`).join('；')+'。未換算成dB或演奏音量。';
  }
  function render(){
    if(host.hidden)return;
    const available=score&&recording?.workId===score.workId;
    host.dataset.sourceState=error?'error':!score?'loading':!available?'missing-work':!aligned?'unmatched-annotation':
      time<aligned.start||time>=aligned.end?'outside':'ready';
    const position=aligned?scoreAt(aligned,time):null;
    state.textContent=error?t(error):!score?t('讀取譜面證據…'):!available?t('此作品尚未提供逐音譜面；可切換 Op.27 No.2 查看已核查譜例。'):
      !aligned?t('目前版本缺少匹配的完整拍點，僅呈現譜面；未配對播放時間。'):
      host.dataset.sourceState==='outside'?t('目前播放位置超出第1–8小節譜例；逐音讀數留空。'):
      `${getLanguage()==='en'?`Measure ${position.bar}`:`第 ${position.bar} 小節`} · ${t('拍點插值定位')} · ${t('非實測逐音起音')}${position.rest?` · ${t('譜面休止')}`:''}`;
    canvas.hidden=!available;$('.score-scene').hidden=!available;$('.score-current').hidden=!available;$('.score-legend').hidden=!available;
    for(const s of ['.score-measures','.score-events','.score-method'])$(s).hidden=!available;
    $('[data-score-export]').disabled=!available;
    const e=available?selected:null;
    $('[data-note-pitch]').textContent=e?`${e.pitchName} · ${e.inScale?'調內':'調外'}`:'—';
    $('[data-note-interval]').textContent=e?interval(e):'—';
    $('[data-note-duration]').textContent=e?`${rational(e.duration)}${e.sourceRows.length>1?' · 延音合併':''}`:'—';
    if(!available){for(const k of Object.keys(canvas.dataset))delete canvas.dataset[k];return;}
    for(const tr of host.querySelectorAll('tr[data-event]'))tr.dataset.active=String(tr.dataset.event===selected?.id);
    draw();
  }
  function draw(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h||!score)return;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const css=getComputedStyle(host),token=(n,f)=>css.getPropertyValue(n).trim()||f;
    const bg=token('--bg','#121315'),muted=token('--muted','#a4a5a6'),signal=token('--accent','#c5d8d3');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const notes=(aligned?.events??score.events).filter(e=>e.kind==='note'),range=[Math.min(...notes.map(e=>e.midi))-1,Math.max(...notes.map(e=>e.midi))+1];
    const projection=temporalProjection(w,h,{x:range,y:[0,3]},[1000,8000],camera),v=projection.vertex;
    const current=aligned?scoreAt(aligned,time):{bar:null};
    const line=(a,b,color,width=1,dash=[])=>{ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);};
    for(let bar=1;bar<=8;bar++){
      const z=(bar-1)/7,active=bar===current.bar;
      const corners=[v(0,0,z),v(1,0,z),v(1,1,z),v(0,1,z)];
      ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.fillStyle=active?'rgba(197,216,211,.045)':'rgba(197,216,211,.008)';ctx.fill();
      for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],active?'#738986':'#303a3d',active?1.1:.7);
      const label=v(1,0,z);ctx.fillStyle=active?signal:muted;ctx.font='11px ui-monospace,Consolas,monospace';ctx.textAlign='left';
      ctx.fillText(String(bar),label.x+10,label.y+4);
    }
    hits=notes.map(e=>({e,...projection.point({attention:e.midi,relaxation:e.durationQ,timestamp:e.bar*1000})}));
    for(let i=1;i<hits.length;i++){
      const a=hits[i-1],b=hits[i];if(a.e.segment!==b.e.segment)continue;
      const crossed=a.e.bar!==b.e.bar;line(a,b,crossed?'#616d70':'#a4bab4',crossed?.8:1.2,crossed?[3,5]:[]);
    }
    for(const hit of [...hits].sort((a,b)=>a.depth-b.depth)){
      const e=hit.e,active=e.id===selected?.id;
      ctx.globalAlpha=active ? 1 : (!aligned||e.t<=time ? .72 : .28);ctx.fillStyle=e.inScale?signal:'#c8ad8c';
      ctx.beginPath();const r=active?5:3;
      if(e.inScale)ctx.arc(hit.x,hit.y,r,0,Math.PI*2);
      else{ctx.moveTo(hit.x,hit.y-r-1);ctx.lineTo(hit.x+r+1,hit.y);ctx.lineTo(hit.x,hit.y+r+1);ctx.lineTo(hit.x-r-1,hit.y);ctx.closePath();}
      ctx.fill();ctx.globalAlpha=1;
      if(active){ctx.strokeStyle=signal;ctx.lineWidth=1;ctx.beginPath();ctx.arc(hit.x,hit.y,9,0,Math.PI*2);ctx.stroke();}
    }
    ctx.fillStyle=muted;ctx.font='11px ui-monospace,Consolas,monospace';ctx.textAlign='center';
    for(let i=0;i<=4;i++){const p=v(i/4,0,1);ctx.fillText(fixed(range[0]+i/4*(range[1]-range[0])),p.x,p.y+19);}
    for(let i=0;i<=3;i++){const p=v(0,i/3,1);ctx.fillText(String(i),p.x-16,p.y+4);}
    ctx.font='12px "Segoe UI","NR CJK",sans-serif';
    const left=Math.min(...projection.corners.map(p=>p.x)),right=Math.max(...projection.corners.map(p=>p.x));
    ctx.fillText('音高 / MIDI（C4 = 60）',w/2,h-10);
    ctx.save();ctx.translate(Math.max(18,left-28),h/2);ctx.rotate(-Math.PI/2);
    ctx.fillText('記譜時值 / 四分音符',0,0);ctx.restore();
    ctx.fillText('小節',Math.min(w-22,right+28),h/2+34);
    Object.assign(canvas.dataset,{representation:'score-bar-layers',layerBars:'[1,2,3,4,5,6,7,8]',scoreBar:String(current.bar??''),
      eventId:selected?.id??'',pitch:selected?.pitchName??'',durationQ:String(selected?.durationQ??''),
      samples:String(notes.length),noteOnsetsMeasured:'false',sourceHash:score.source.sha256,camera:JSON.stringify(camera)});
  }
  function update(rec,t){
    recording=rec;time=t;
    const next=rec?`${rec.id}:${rec.annotation?.annotation_id}:${rec.annotation?.part??''}`:'';
    if(score&&modelKey!==next){modelKey=next;aligned=alignScore(score,rec);key='';selected=null;if(rec?.workId===6)tables();}
    const at=scoreAt(aligned,t),newKey=at.event?.id??`none:${at.bar}`;
    if(newKey!==key||viewStamp!==String(t)){key=newKey;viewStamp=String(t);selected=at.event;}
    render();
  }
  async function load(){
    if(loading)return;loading=true;
    try{
      const response=await fetch('./public/research/chopin-score/op27-2-bars1-8.json',{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('source');
      score=scoreEvidence(await response.json());error='';
      $('[data-score-source]').href=score.source.url;$('[data-score-hash]').textContent=`SHA256 ${score.source.sha256}`;
      modelKey=null;update(recording,time);
    }catch{error='譜面證據讀取失敗；重新開啟頁面可重試。';render();}finally{loading=false;}
  }
  const nearest=e=>{const rect=canvas.getBoundingClientRect();return hits.map(h=>({...h,d:Math.hypot(h.x-e.clientX+rect.left,h.y-e.clientY+rect.top)})).sort((a,b)=>a.d-b.d).find(h=>h.d<=15);};
  canvas.onclick=e=>{if(moved){moved=false;return;}const hit=nearest(e);if(hit)select(hit.e);};
  canvas.onpointerdown=e=>{if(e.button===0){drag={x:e.clientX,y:e.clientY,...camera};moved=false;canvas.setPointerCapture(e.pointerId);}};
  canvas.onpointermove=e=>{
    if(!drag){const hit=nearest(e);canvas.title=hit?`${hit.e.bar}小節 · ${hit.e.pitchName} · 時值${rational(hit.e.duration)} · ${interval(hit.e)}`:'';return;}
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<4&&!moved)return;moved=true;
    camera={yaw:Math.max(-1.1,Math.min(1.1,drag.yaw+dx*.005)),pitch:Math.max(.08,Math.min(.9,drag.pitch+dy*.004))};draw();
  };
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  canvas.onkeydown=e=>{
    if(e.key==='Home'){e.preventDefault();camera={yaw:.58,pitch:.38};draw();return;}
    if(!['ArrowLeft','ArrowRight'].includes(e.key)||!aligned)return;e.preventDefault();
    const notes=aligned.events.filter(e=>e.kind==='note'),index=notes.findIndex(n=>n.id===selected?.id);
    select(notes[Math.max(0,Math.min(notes.length-1,index+(e.key==='ArrowRight'?1:-1)))]);
  };
  const resize=new ResizeObserver(()=>{if(!host.hidden&&recording?.workId===6)draw();});resize.observe(canvas);
  load();
  return {update,setVisible(visible){host.hidden=!visible;if(visible)render();},
    exportPNG(){
      const image=document.createElement('canvas'),ratio=canvas.width/canvas.clientWidth,ctx=image.getContext('2d');
      const text=[`${score.title} · 第1–8小節 · 上譜表單旋律`,
        `參考錄音 ${recording?.performer??'未選'} · 播放 ${time.toFixed(3)} s · ${state.textContent}`,
        `X 音高MIDI；Y 記譜時值/四分音符；Z 整數小節。${selected?selected.pitchName+' · '+interval(selected):'此位置無逐音讀數'}`,
        '拍點間分段線性定位；未測逐音起音，未逐音核實演奏版與初版差異。裝飾音另列。',
        'First Editions of Fryderyk Chopin\'s Music',
        'Copyright 2017–2021 The Fryderyk Chopin Institute (https://nifc.pl)',
        'Website: https://chopinscores.org · Digital scores: https://github.com/pl-wnifc/humdrum-chopin-first-editions',
        `License: ${score.source.licenseUrl} · 擷取第1–8小節、合併延音及計算分量`,
        score.source.url,`來源 SHA256 ${score.source.sha256}`].join('\n');
      ctx.font='12px "Segoe UI","NR CJK",sans-serif';
      const lines=wrapText(text,canvas.clientWidth-40,s=>ctx.measureText(s).width);
      image.width=canvas.width;image.height=canvas.height+Math.ceil((30+18*lines.length)*ratio);
      ctx.fillStyle=getComputedStyle(host).getPropertyValue('--bg').trim()||'#121315';ctx.fillRect(0,0,image.width,image.height);
      ctx.drawImage(canvas,0,0);ctx.scale(ratio,ratio);ctx.fillStyle='#a4a5a6';ctx.font='12px "Segoe UI","NR CJK",sans-serif';
      lines.forEach((s,i)=>ctx.fillText(s,20,canvas.clientHeight+27+i*18));return image.toDataURL('image/png');
    },dispose(){resize.disconnect();}};
}
