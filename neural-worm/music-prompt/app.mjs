import {ELEMENTS,readObservations,readWorkspace,selectTags,compilePrompt} from './contract.mjs';
import {parseUtf8Json} from '../../src/json-io.mjs';

const $=id=>document.getElementById(id);
let catalogue=null,result=null,revision=0,inputTask=0,busy=false;
if(new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window){
  document.body.classList.add('embedded');
  let visible=false;
  const resize=()=>{
    if(visible)window.parent.postMessage({type:'nr-prompt-ready',
      height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin);
  };
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin||
      event.data?.type!=='nr-prompt-visibility'||typeof event.data.visible!=='boolean')return;
    visible=event.data.visible;
    if(visible)requestAnimationFrame(resize);
  });
  new ResizeObserver(resize).observe(document.body);
}
const emptyInput=()=>JSON.stringify({schemaVersion:'music-prompt-input-v1',
  source:{id:'未提供观测',kind:'not-provided'}});
const numberText=(n,digits=3)=>Number.isFinite(n)?Number(n.toFixed(digits)).toString():'—';
const unitText=unit=>({'BPM':'BPM','eighth-notes/min':'八分音符/分钟','source-beats/min':'来源拍/分钟'}[unit]??'');
function status(text,error=false){$('operation-status').textContent=text;$('operation-status').classList.toggle('error',error);}
function invalidate(){
  revision++;result=null;
  $('prompt-en').value='';$('ace-json').textContent='等待生成';$('suno-json').textContent='等待生成';
  $('output-engine').textContent='等待生成';
  for(const id of ['copy-prompt','copy-ace','download-json'])$(id).disabled=true;
}
function intent(){
  return {style:$('style').value,duration:$('duration').value===''?null:Number($('duration').value),
    tempoBpm:$('tempo-bpm').value===''?null:Number($('tempo-bpm').value),
    levels:Object.fromEntries(ELEMENTS.map(([key])=>[key,$(`level-${key}`).value===''?null:Number($(`level-${key}`).value)]))};
}
function workspace(){
  return readWorkspace($('observation-json').value.trim()?$('observation-json').value:emptyInput());
}
function observation(){
  return workspace().observations;
}
function updateMetrics(obs){
  const music=obs.tempo;
  $('input-state').textContent=obs.source.kind==='not-provided'?'未导入':'已导入';
  $('observation-origin').textContent=obs.source.kind==='demo'?'示例数据':obs.source.kind==='not-provided'?'未提供':'导入数据声明';
  $('metric-source').textContent=obs.source.id;
  $('metric-count').textContent=obs.samples??'—';
  $('metric-time').textContent=obs.provenance?.createdAt??'—';
  $('metric-coverage').textContent=obs.windowSeconds!==null
    ?`${numberText(obs.provenance?.observedCoverageSeconds)} / ${numberText(obs.windowSeconds)} 秒`:'—';
  $('metric-neural').textContent=obs.neural?`${obs.neural.attention} / ${obs.neural.relaxation}`:'—';
  $('metric-mean').textContent=music?`${numberText(music.mean)} ${unitText(music.unit)}`:'—';
  $('metric-sd').textContent=music?`${numberText(music.sd)} ${unitText(music.unit)}`:'—';
  $('metric-cv').textContent=music?numberText(music.cv,4):'—';
  $('metric-change').textContent=music?numberText(music.adjacentChangeMean,4):'—';
  $('observation-note').textContent=music
    ?'按原始有效样本统计；CV为标准差/均值，少于3点不报告；相邻变幅为|log₂速度比|且不跨缺失。它们不是已验证的综合离散度，未自动转成创作档位。'
    :'缺失值保持为空；不从关注、放松或心率推断音乐参数。';
}
function updateTags(tags){
  $('selected-tags').replaceChildren(...tags.map(tag=>{
    const node=document.createElement('span');node.textContent=tag.zh;node.title=tag.phrase;return node;
  }));
}
function refresh(){
  invalidate();
  try{updateMetrics(observation());updateTags(selectTags(intent(),catalogue));status('选择音乐标签后生成 Prompt；不调用语言模型。');}
  catch(error){
    updateMetrics(readObservations(emptyInput()));
    $('selected-tags').replaceChildren();
    status(error.message,true);$('input-state').textContent='待检查';
  }
}
function present(value){
  result=value;$('prompt-en').value=value.promptEn;
  $('ace-json').textContent=JSON.stringify(value.aceRequest,null,2);
  $('suno-json').textContent=JSON.stringify(value.sunoFields,null,2);
  $('output-engine').textContent='规则生成';
  for(const id of ['copy-prompt','copy-ace','download-json'])$(id).disabled=false;
}
async function hashText(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function generate(){
  if(busy)return;
  invalidate();
  const startedRevision=revision;
  busy=true;$('preview').disabled=true;
  try{
    const {observations:obs,inputDocument}=workspace(),target=intent(),tags=selectTags(target,catalogue);
    updateMetrics(obs);updateTags(tags);
    const inputHash=await hashText(JSON.stringify({inputDocument,intent:target}));
    const catalogueEvidence={version:catalogue.version,
      sha256:await hashText(JSON.stringify(catalogue)),hashEncoding:'UTF-8 JSON.stringify(parsed-catalogue)',
      sources:structuredClone(catalogue.sources)};
    if(revision!==startedRevision)throw new Error('输入已变化，请重新生成。');
    present(compilePrompt({observations:obs,inputDocument,intent:target,tags,
      order:tags.map(t=>t.id),engine:'rules',model:null,inputHash,catalogueEvidence}));
    status('Prompt 已生成，可复制提示词或导出 JSON。');
  }catch(error){
    if(revision!==startedRevision)return;
    status(error.message,true);
  }finally{
    busy=false;$('preview').disabled=false;
  }
}
async function loadReference(){
  const task=++inputTask,startedRevision=revision;
  try{
    const response=await fetch('../../public/research/vmus-reference-cases.json');
    if(!response.ok)throw new Error('已有标注文件读取失败。');
    const data=await response.json(),recording=data.recordings.find(r=>r.id==='c27_langlang2003');
    if(task!==inputTask||revision!==startedRevision)return;
    const times=recording?.annotation?.t?.filter(t=>t<=60);
    if(!times||times.length<3||recording.annotation.meter!=='6/8')throw new Error('参考标注缺少明确拍值。');
    const values=times.slice(1).map((t,i)=>60/(t-times[i]));
    $('observation-json').value=JSON.stringify({schemaVersion:'music-prompt-input-v1',
      source:{id:'郎朗 · 2003 · Op.27 No.2 · 既有拍点标注',kind:'music-annotation',
        reference:recording.annotationReference},
      windowSeconds:times.at(-1)-times[0],music:{tempo:{values,unit:'eighth-notes/min'}}},null,2);
    refresh();status('已读入既有标注前60秒内的完整拍间隔；不是实时设备数据。未加载或播放音频。');
  }catch(error){if(task===inputTask&&revision===startedRevision)status(error.message,true);}
}
async function copy(text){
  try{await navigator.clipboard.writeText(text);status('已复制。');}catch{status('无法写入剪贴板，可选中文字复制或下载JSON。',true);}
}
async function init(){
  try{
    const response=await fetch('./tags.json');
    if(!response.ok)throw new Error('音乐标签库读取失败。');
    const text=await response.text();catalogue=parseUtf8Json(text);
    for(const [key,label] of ELEMENTS){
      const row=document.createElement('div');row.className='level-row';
      const name=document.createElement('label');name.htmlFor=`level-${key}`;name.textContent=label;
      const select=document.createElement('select');select.id=name.htmlFor;select.name=key;
      const empty=document.createElement('option');empty.value='';empty.textContent='未指定';select.append(empty);
      for(let level=1;level<=5;level++){
        const tag=catalogue.tags.find(t=>t.id===`${key}.${level}`),option=document.createElement('option');
        option.value=String(level);option.textContent=`${level} · ${tag.zh}`;select.append(option);
      }
      row.append(name,select);$('music-levels').append(row);select.addEventListener('change',refresh);
    }
    for(const id of ['observation-json','style','duration','tempo-bpm'])
      $(id).addEventListener(id==='style'?'change':'input',refresh);
    $('preview').addEventListener('click',generate);
    $('load-reference').addEventListener('click',loadReference);
    $('choose-file').addEventListener('click',()=>$('input-file').click());
    $('gentle-preset').addEventListener('click',()=>{
      $('tempo-bpm').value='72';
      const levels={melody:2,rhythm:2,harmony:1,dynamics:2,tempo:1,mode:1,form:3,texture:2,timbre:2,articulation:1};
      for(const [key,value] of Object.entries(levels))$(`level-${key}`).value=String(value);
      refresh();status('已填入人工创作目标，未将其声明为观测结果。');
    });
    $('clear-levels').addEventListener('click',()=>{
      for(const [key] of ELEMENTS)$(`level-${key}`).value='';
      $('tempo-bpm').value='';refresh();
    });
    $('input-file').addEventListener('change',async event=>{
      const file=event.target.files[0];if(!file)return;
      const task=++inputTask,startedRevision=revision;
      try{
        if(file.size>1048576)throw new Error('JSON文件需小于1 MiB。');
        const text=await file.text();
        if(task!==inputTask||revision!==startedRevision)return;
        const {inputDocument,intent:supplied}=readWorkspace(text,catalogue);
        $('observation-json').value=JSON.stringify(inputDocument,null,2);
        if(supplied){
          $('style').value=supplied.style;$('duration').value=supplied.duration;
          $('tempo-bpm').value=supplied.tempoBpm??'';
          for(const [key] of ELEMENTS)$(`level-${key}`).value=supplied.levels?.[key]??'';
        }
        refresh();
      }catch(error){if(task===inputTask&&revision===startedRevision)status(error.message,true);}
      finally{if(task===inputTask)event.target.value='';}
    });
    $('copy-prompt').addEventListener('click',()=>result&&copy(result.promptEn));
    $('copy-ace').addEventListener('click',()=>result&&copy(JSON.stringify(result.aceRequest,null,2)));
    $('download-json').addEventListener('click',()=>{
      if(!result)return;
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob(
        [JSON.stringify(result,null,2)],{type:'application/json;charset=utf-8'}));
      link.href=url;link.download='music-prompt.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    refresh();
  }catch(error){status(error.message,true);$('preview').disabled=true;}
}
init();
