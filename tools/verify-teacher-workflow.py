"""Browser acceptance with explicit isolated protocol fixtures, never hardware claims."""
import argparse
import asyncio
import json
from pathlib import Path
import time
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/teacher-discussion-20261013'

async def verify(args):
 async with async_playwright() as p:
  browser=await getattr(p,args.engine).launch(**({'channel':args.channel} if args.channel else {}),headless=True)
  context=await browser.new_context(viewport={'width':1920,'height':1080},accept_downloads=True)
  if args.channel:await context.grant_permissions(['local-network-access'],origin=args.url.rstrip('/'))
  page=await context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  base=args.url.rstrip('/');layouts=[];checks=[];sockets=[]
  await page.route_web_socket('**/ws/live',lambda ws:sockets.append(ws))
  await page.goto(base+'/#worm');await page.wait_for_function("document.querySelector('[data-role=work]').options.length===2")
  await page.wait_for_timeout(100)
  assert await page.locator('[data-visual=overlay]').count()==0
  await page.wait_for_function("document.querySelector('.planar-canvas').dataset.layer==='profile'")
  assert await page.locator('[data-trial-start]').is_disabled()
  checks.append('music reference first; no overlay; no real trial without device')
  await page.click('[data-action=music-play]');await page.wait_for_function("!document.querySelector('[data-role=audio]').paused && document.querySelector('[data-role=audio]').currentTime>.2")
  await page.click('[data-visual=eeg]');await page.wait_for_timeout(400)
  assert await page.locator('[data-role=audio]').evaluate('(a)=>a.currentTime')>.3
  assert await page.locator('[data-role=profile-caption]').is_hidden()
  await page.locator('[data-role=audio]').evaluate('(a)=>a.pause()')
  checks.append('original source music decodes and advances while observing EEG')
  await page.click('#demo');await page.wait_for_timeout(550)
  await page.click('[data-action=follow]')
  before=await page.locator('.planar-canvas').evaluate('(c)=>({...c.dataset})')
  canvas=page.locator('.planar-canvas');await canvas.focus();await page.keyboard.press('ArrowRight')
  after=await canvas.evaluate('(c)=>({...c.dataset})')
  assert before['coordinate']==after['coordinate'] and before['timestamp']==after['timestamp'] and before['camera']!=after['camera']
  await page.select_option('[data-role=space]','plane');assert await canvas.get_attribute('data-coordinate')==before['coordinate']
  await page.select_option('[data-role=space]','time');await page.keyboard.press('Home')
  checks.append('time depth preserves source coordinates; camera-only rotation; 2D projection retained')
  for width,height in [(320,740),(390,844),(768,1024),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
   await page.set_viewport_size({'width':width,'height':height})
   for stage in ['music','eeg','experiment']:
    await page.click('[data-visual='+stage+']');await page.wait_for_timeout(80)
    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,stage)
    assert '\ufffd' not in await page.locator('body').inner_text()
    assert await page.locator('[data-trial-start]').is_disabled()
    layouts.append({'width':width,'height':height,'stage':stage,'overflow':False})
    if width in (390,1920):await page.screenshot(path=str(OUT/f'{args.engine}-{args.channel or "bundled"}-{stage}-{width}.png'))
  # A separate browser source, kept out of the physical-device evidence.
  await page.set_viewport_size({'width':1920,'height':1080});await page.click('[data-visual=experiment]')
  sockets=[]
  await page.route_web_socket('**/ws/live',lambda ws:sockets.append(ws))
  await page.locator('#endpoint').evaluate("(e)=>{const u=new URL('/ws/live',location.href);u.protocol='ws:';e.value=u.href;e.dispatchEvent(new Event('input',{bubbles:true}))}");await page.locator('#connect').evaluate('(b)=>b.click()');await page.wait_for_timeout(200)
  for _ in range(40):
   if sockets:break
   await page.wait_for_timeout(100)
  if not sockets:
   print('DEBUG',await page.locator('#status').inner_text(),await page.locator('#endpoint').input_value(),await page.locator('#notice').inner_text(),await page.evaluate('location.href'))
   raise AssertionError('websocket not opened')
  running=True;sent=0
  async def pump():
   nonlocal sent
   while running:
    stamp=time.time();sent+=1
    packet={'schemaVersion':'neural-resonance-live-v1','ts':stamp,'source':'device','metricOrigin':'thinkgear-esense','transport':'usb','sessionId':'controlled-teacher-qa','connectionEpoch':1,
     'attention':40+sent%30,'meditation':75-sent%30,'quality':{'eegPackets':sent},'eeg':{'poor_signal':0,'delta':1,'theta':2,'alpha':3,'beta':4},
     'fieldTimestamps':{'attention':stamp,'meditation':stamp,'raw':stamp},'sampleRate':128,'rawSequence':sent*64,'rawEegSamples':[(-1)**i*(i%6+1) for i in range(64)],'rawUnit':'ADC counts'}
    sockets[-1].send(json.dumps(packet));await asyncio.sleep(.25)
  task=asyncio.create_task(pump())
  try:
   await page.wait_for_function("!document.querySelector('[data-trial-start]').disabled")
   for i in range(3):
    await page.click('[data-trial-start]');await page.wait_for_function("document.querySelector('.listening-experiment').dataset.active==='true'",timeout=40000)
    await page.wait_for_timeout(1350);await page.click('[data-trial-stop]')
    await page.wait_for_function("(i)=>document.querySelector('.listening-experiment').dataset.trials===String(i)",arg=i+1)
   assert await page.locator('.trial-statistics tbody tr').count()==3
   checks.append('three distinct source versions capture valid ordered protocol fixtures; descriptive statistics calculated')
   saved_payload=[]
   if args.isolated_save:
    await page.click('[data-trial-save]');await page.wait_for_function("document.querySelector('.listening-experiment').dataset.savedDirectory",timeout=25000)
    directory=await page.locator('.listening-experiment').get_attribute('data-saved-directory')
    target=Path(directory);data=json.loads((target/'experiment.json').read_text())
    assert len(data['trials'])==3 and all(len(t['rows'])>=3 for t in data['trials'])
    assert (target/'paired.csv').read_bytes().startswith(b'\xef\xbb\xbf')
    assert all(r['source']=='device' for t in data['trials'] for r in t['rows'])
    assert (target/'report.html').is_file() and (target/'figure.png').is_file()
    checks.append('isolated server saves JSON/raw packets, BOM CSV, PNG and HTML atomically; recalculates statistics')
   else:
    async def saved(route):
     saved_payload.append(route.request.post_data_json);await route.fulfill(json={'saved':True,'directory':'Controlled browser fixture only; no data written'})
    await page.route(base+'/api/experiments',saved);await page.click('[data-trial-save]')
    await page.wait_for_function("document.querySelector('.listening-experiment').dataset.savedDirectory")
    assert len(saved_payload[0]['trials'])==3
    checks.append('live browser export payload verified with stub; synthetic packets not written to real results')
   await page.screenshot(path=str(OUT/f'{args.engine}-{args.channel or "bundled"}-three-trials.png'))
   await page.click('[data-trial-new]');await page.wait_for_timeout(100);assert await page.locator('.trial-statistics tbody tr').count()==0
   checks.append('new group only after saved results, no overwrite')
  finally:
   running=False;await task
  assert not errors,errors
  result={'pass':True,'browser':browser.version,'engine':args.engine,'url':base,'layouts':layouts,'checks':checks,'errors':errors,'physicalHardwareVerified':False,'source':'controlled synthetic USB-labelled protocol packets in disposable browser; public Chopin media decoded','isolatedSave':args.isolated_save}
  (OUT/f'workflow-{args.engine}-{args.channel or "bundled"}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(result,ensure_ascii=False));await browser.close()

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8788');parser.add_argument('--engine',choices=['chromium','firefox','webkit'],default='chromium');parser.add_argument('--channel');parser.add_argument('--isolated-save',action='store_true')
 asyncio.run(verify(parser.parse_args()))
