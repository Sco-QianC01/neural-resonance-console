import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountPromptSection,promptMessage} from '../neural-worm/prompt-section.mjs';

test('prompt frame messages require the exact same origin, source and bounded height',()=>{
  const source={};
  const origin='http://127.0.0.1:8767';
  const event={origin,source,data:{type:'nr-prompt-ready',height:700.4}};
  assert.equal(promptMessage(event,source,origin),701);
  for(const changed of [
    {origin:'https://example.com'},{source:{}},{data:{type:'other',height:700}},
    {data:{type:'nr-prompt-ready',height:'700'}},
    {data:{type:'nr-prompt-ready',height:Infinity}},
    {data:{type:'nr-prompt-ready',height:20001}},
    {data:{type:'nr-prompt-ready',height:0}},
  ]) assert.equal(promptMessage({...event,...changed},source,origin),null);
});

test('annotation loads lazily and switching sections keeps the same edited frame',()=>{
  const elements=new Map();
  for(const id of ['annotation-frame','annotation-status','annotation-connection','annotation-retry','annotation-help'])
    elements.set(id,{hidden:true,style:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});
  const frame=elements.get('annotation-frame'),messages=[];
  frame.contentWindow={postMessage(data,origin){messages.push({data,origin});}};
  frame.hasAttribute=()=>Boolean(frame.src);
  const host={location:{origin:'http://127.0.0.1:8767'},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
  const section=mountPromptSection({baseURI:'http://127.0.0.1:8767/',getElementById:id=>elements.get(id)},host);
  assert.equal(frame.src,undefined);
  section.setVisible(true);
  assert.equal(frame.src,'http://127.0.0.1:8767/neural-worm/music-prompt/index.html?embedded=1');
  section.setVisible(false);
  frame.listeners.load();
  assert.equal(messages.at(-1).data.visible,false);
  section.setVisible(true);
  assert.equal(messages.at(-1).data.visible,true);
  host.listeners.message({source:frame.contentWindow,origin:'http://127.0.0.1:8767',
    data:{type:'nr-prompt-ready',height:800}});
  assert.equal(frame.style.height,'800px');
  assert.equal(elements.get('annotation-connection').hidden,true);
  section.setVisible(false);
  assert.equal(messages.at(-1).data.visible,false);
  frame.src+='&retained-edit';
  section.setVisible(true);
  assert.ok(frame.src.endsWith('&retained-edit'));
  assert.equal(messages.at(-1).data.visible,true);
  host.listeners.pagehide();
  assert.equal(messages.at(-1).data.visible,false);
  host.listeners.pageshow();
  assert.equal(messages.at(-1).data.visible,true);
});

test('annotation is the next navigation section after the worm',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.deepEqual([...html.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]),
    ['settings','waveforms','worm','annotation']);
  assert.match(html,/<iframe[^>]+id="annotation-frame"[^>]+title="/);
  assert.doesNotMatch(html,/<iframe[^>]+src=/);
  assert.match(html,/src="\.\/neural-worm\/prompt-entry.mjs"/);
  const app=await readFile(new URL('../neural-worm/app.mjs',import.meta.url),'utf8');
  assert.match(app,/const initialView=\['settings','waveforms','worm','annotation'\]/);
  assert.match(app,/for\(const name of \['waveforms','worm','settings','annotation'\]\)/);
});

test('prompt UI has one deterministic generator and no model or score entry',async()=>{
  const html=await readFile(new URL('../neural-worm/music-prompt/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../neural-worm/music-prompt/app.mjs',import.meta.url),'utf8');
  assert.match(html,/生成 Prompt/);
  assert.doesNotMatch(html,/id="arrange"|id="check-runtime"|music-score|Ollama/);
  assert.doesNotMatch(app,/\/api\/|checkRuntime|generate\(true\)|requestController/);
  assert.match(app,/engine:'rules',model:null/);
});
