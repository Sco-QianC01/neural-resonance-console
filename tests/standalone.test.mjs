import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG,normalizeConfig,demoValues } from '../src/config.mjs';
import { createConsoleServer,serverOptions } from '../tools/serve.mjs';

test('default startup shows a demo and has no preconfigured private endpoint',()=>{
  assert.equal(DEFAULT_CONFIG.startupMode,'demo');
  assert.equal(DEFAULT_CONFIG.endpoint,'');assert.equal(DEFAULT_CONFIG.autoConnect,false);
});
test('data endpoints and startup are configurable independently of the host machine',()=>{
  assert.equal(normalizeConfig({startupMode:'live',endpoint:'/ws/live',autoConnect:true},
    'https://example.test/console/').endpoint,'wss://example.test/ws/live');
  const config=normalizeConfig({startupMode:'live',endpoint:'wss://device.example/eeg',autoConnect:true});
  assert.equal(config.autoConnect,true);
  assert.equal(normalizeConfig({startupMode:'live'}).autoConnect,false);
  assert.throws(()=>normalizeConfig({endpoint:'https://example.test'}));
  assert.throws(()=>normalizeConfig({endpoint:'ws://user:secret@example.test'}));
});
test('dynamic example moves while manual sliders remain exact and bounded',()=>{
  assert.notDeepEqual(demoValues(62,74,10),demoValues(62,74,20));
  assert.deepEqual(demoValues(62,74,10,false),{attention:62,relaxation:74});
  for(let i=0;i<300;i++){
    const value=demoValues(100,0,i);
    assert.ok(value.attention>=0&&value.attention<=100&&value.relaxation>=0&&value.relaxation<=100);
  }
});
test('server port and host use CLI options or environment instead of project-specific paths',()=>{
  assert.deepEqual(serverOptions(['--port','6123','--host','0.0.0.0'],{}),{port:6123,host:'0.0.0.0'});
  assert.deepEqual(serverOptions([],{PORT:'8123',HOST:'localhost'}),{port:8123,host:'localhost'});
  assert.throws(()=>serverOptions(['--port','invalid'],{}));
});
test('portable static server serves its own UI and never exposes private runtime endpoints',async()=>{
  const server=createConsoleServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const page=await fetch(base);assert.equal(page.status,200);
    assert.ok((await page.text()).includes('id="field"'));
    assert.equal((await fetch(`${base}/src/app.mjs`)).headers.get('content-type'),'text/javascript; charset=utf-8');
    assert.equal((await fetch(`${base}/api/runtime`)).status,404);
    assert.equal((await fetch(`${base}/.git/config`)).status,404);
    assert.equal((await fetch(`${base}/public/config.json`,{method:'POST'})).status,405);
  }finally{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});
