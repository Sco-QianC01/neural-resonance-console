import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const playwright=process.env.PLAYWRIGHT_PATH
  || 'Q:\\音疗系统\\夜莺\\01_工程\\yeying\\frontend\\node_modules\\playwright\\index.mjs';
const { chromium }=await import(pathToFileURL(playwright).href);
const out=path.join(root,'artifacts');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.EDGE_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless:true,
});
const results={checkedAt:new Date().toISOString(),hardwareVerified:false,errors:[]};
const base='http://127.0.0.1:8767/';
try {
  const context=await browser.newContext({viewport:{width:1500,height:1160},acceptDownloads:true});
  const real=await context.newPage();
  real.on('pageerror',e=>results.errors.push(e.message));
  await real.goto(base);
  await real.waitForFunction(()=>document.querySelector('#endpoint').value.endsWith(':8767/ws/live')
    &&document.querySelector('#packet-count').textContent!=='—',{},{timeout:15000});
  await real.waitForFunction(()=>document.querySelector('#system-summary').textContent.includes('主服務運行中'));
  results.realAutoConnection=await real.evaluate(()=>({
    endpoint:document.querySelector('#endpoint').value,
    badge:document.querySelector('#connection-badge').textContent.trim(),
    packets:document.querySelector('#packet-count').textContent,
    backend:document.querySelector('#system-summary').textContent,
    workers:document.querySelector('#worker-status').textContent,
  }));
  results.actualRuntime=await (await context.request.get(`${base}api/runtime`)).json();
  for(const id of ['core','console','max','arena','mumu','image','graph','map','visual'])
    assert.equal(results.actualRuntime.audit.programs.find(item=>item.id===id)?.infrastructureReady,true,
      `${id} process/owned-port gate did not pass`);
  assert.equal(results.actualRuntime.model.reachable,true);
  results.backendInfrastructureVerified=true;
  await real.screenshot({path:path.join(out,'console-integrated-desktop.png'),fullPage:true});
  await real.close();

  const page=await context.newPage();
  page.on('pageerror',e=>results.errors.push(e.message));
  const sockets=[];
  await page.routeWebSocket('ws://127.0.0.1:8767/ws/live',socket=>{sockets.push(socket);});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#connection-badge').textContent.includes('接口已連接'));
  assert.equal(sockets.length,1);
  results.fixtureAutoConnection=true;
  const packet=(n,overrides={})=>({schemaVersion:'frontal-live-v1',source:'core',ts:Date.now()/1000,
    quality:{eegPackets:n,spo2Samples:n,prSamples:n,hrvSamples:n,gsrSamples:n},
    eeg:{attention:62,meditation:74,delta:22,theta:28,alpha:39,beta:34,lowGamma:3,poor_signal:0},
    attention:62,meditation:74,spo2:97,pr:73,hrv:28,gsr:145,...overrides});
  sockets.at(-1).send(JSON.stringify(packet(100)));
  await page.waitForFunction(()=>document.querySelector('#attention').textContent==='62'
    &&document.querySelector('#sensor-spo2').textContent==='97%');
  assert.equal(await page.locator('#sensor-pr').textContent(),'73次／分');
  assert.equal(await page.locator('#sensor-hrv').textContent(),'28來源原始值');
  assert.equal(await page.locator('#sensor-gsr').textContent(),'145來源原始值');
  assert.ok((await page.locator('#eeg-fields').textContent()).includes('lowGamma'));
  results.allReceivedFields=true;
  await page.locator('#record').click();
  sockets.at(-1).send(JSON.stringify(packet(101)));
  await page.waitForFunction(()=>document.querySelector('#recording-count').textContent==='1 個樣本');
  await page.locator('#record').click();
  const pending=page.waitForEvent('download');
  await page.locator('#export').click();
  await (await pending).saveAs(path.join(out,'integration-recording-fixture.json'));
  const record=JSON.parse(await readFile(path.join(out,'integration-recording-fixture.json'),'utf8'));
  assert.equal(record.snapshots[0].spo2,97);assert.equal(record.snapshots[0].pr,73);
  assert.equal(record.snapshots[0].hrv,28);assert.ok(!('sessionId' in record.snapshots[0]));
  results.allSignalExport=true;
  sockets.at(-1).send(JSON.stringify(packet(102,{eeg:{poor_signal:200},attention:null,meditation:null})));
  await page.waitForFunction(()=>document.querySelector('#attention').textContent==='—');
  assert.equal(await page.locator('#sensor-spo2').textContent(),'97%');
  results.nonEEGIndependentOfBadEEG=true;
  sockets.at(-1).close({code:1001,reason:'Controlled reconnect test'});
  await page.waitForFunction(()=>document.querySelector('#connection-badge').textContent.includes('正在重連'));
  await page.waitForFunction(()=>document.querySelector('#connection-badge').textContent.includes('接口已連接'));
  assert.equal(sockets.length,2);
  sockets.at(-1).send(JSON.stringify(packet(103)));
  await page.waitForFunction(()=>document.querySelector('#attention').textContent==='62');
  results.reconnectRecovered=true;
  sockets.at(-1).send(JSON.stringify(packet(104,{spo2:null,pr:null,hrv:null,gsr:null})));
  await page.waitForFunction(()=>document.querySelector('#sensor-spo2').textContent==='—%');
  assert.equal(await page.locator('#sensor-pr').textContent(),'—次／分');
  assert.equal(await page.locator('#sensor-hrv').textContent(),'—來源原始值');
  results.missingSensorsNotInvented=true;
  await page.locator('#disconnect').click();
  await page.waitForTimeout(1300);
  assert.equal(sockets.length,2);
  assert.equal(await page.locator('#attention').textContent(),'—');
  results.manualStopHonoured=true;
  await page.locator('#demo-tab').click();
  await page.locator('#start-demo').click();
  await page.waitForFunction(()=>document.querySelector('#connection-badge').textContent.includes('示範資料'));
  assert.equal(await page.locator('#sensor-spo2').textContent(),'—%');
  results.demoDoesNotFakeOtherSensors=true;
  await page.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const small=await mobile.newPage();small.on('pageerror',e=>results.errors.push(e.message));
  await small.goto(base);
  await small.waitForFunction(()=>document.querySelector('#packet-count').textContent!=='—');
  await small.waitForTimeout(1800);
  const size=await small.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.width,`Mobile overflow: ${JSON.stringify(size)}`);
  await small.screenshot({path:path.join(out,'console-integrated-mobile.png'),fullPage:true});
  results.mobileNoOverflow=true;
  assert.deepEqual(results.errors,[]);
  results.ok=true;
} catch(error) {results.ok=false;results.failure=error.stack;throw error;}
finally {
  await writeFile(path.join(out,'integration-verification.json'),JSON.stringify(results,null,2));
  await browser.close();console.log(JSON.stringify(results,null,2));
}
