import {mountPromptSection} from './prompt-section.mjs';
import {initI18n,t} from '../src/i18n.mjs';

const root=document,host=window;
const section=mountPromptSection(root,host);
const isAnnotation=()=>host.location.hash==='#annotation';
let legacy;

function showAnnotation(){
  // The legacy application binds every [data-view] node during startup.
  root.body.removeAttribute('data-view');
  root.body.classList.add('annotation-active');
  for(const name of ['settings','waveforms','worm','annotation'])
    root.getElementById(`view-${name}`).hidden=name!=='annotation';
  root.querySelectorAll('[data-view]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.view==='annotation')));
  const subtitle=Object.assign(root.createElement('span'),{textContent:t('ANNOTATION / PROMPT')});
  root.getElementById('page-title').replaceChildren(root.createTextNode(t('數據標註')),subtitle);
  section.setVisible(true);
}

function loadLegacy(){
  // Keep the frozen application out of the independent annotation startup path.
  if(!legacy){
    const names=['settings','waveforms','worm'];
    const name=names.includes(host.location.hash.slice(1))?host.location.hash.slice(1):'settings';
    root.body.classList.remove('annotation-active');
    for(const view of names)root.getElementById(`view-${view}`).hidden=view!==name;
    root.querySelectorAll('[data-view]').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.view===name)));
    root.getElementById('page-title').textContent=t({settings:'設備設定',waveforms:'波形捕獲',worm:'音樂與神經響應'}[name]);
    legacy=import('./app.mjs');
  }
  legacy.catch(()=>{
    const notice=root.getElementById('notice');
    notice.textContent='原控制台启动异常，请保留日志核查。';
    notice.hidden=false;
  });
}

function closeNavigation(){
  root.body.classList.remove('nav-open');
  root.getElementById('nav-toggle').setAttribute('aria-expanded','false');
}

host.addEventListener('hashchange',event=>{
  if(isAnnotation()){
    event.stopImmediatePropagation();
    initI18n();
    showAnnotation();
  }else{
    section.setVisible(false);
    root.body.classList.remove('annotation-active');
    root.getElementById('view-annotation').hidden=true;
    loadLegacy();
  }
});
host.addEventListener('app:language-change',()=>{
  if(isAnnotation())queueMicrotask(showAnnotation);
});
root.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  host.location.hash=button.dataset.view;
  closeNavigation();
}));
root.getElementById('nav-toggle').addEventListener('click',event=>{
  if(!isAnnotation())return;
  event.stopImmediatePropagation();
  const open=root.body.classList.toggle('nav-open');
  root.getElementById('nav-toggle').setAttribute('aria-expanded',String(open));
},true);
host.addEventListener('keydown',event=>{
  if(isAnnotation()&&event.key==='Escape')closeNavigation();
});

if(isAnnotation()){
  initI18n();
  showAnnotation();
}else{
  loadLegacy();
}
