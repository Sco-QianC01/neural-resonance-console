"""Real media and browser rendering; device packets here are labelled QA fixtures."""
import argparse
import asyncio
import json
from pathlib import Path
import re
import time
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts/teacher-revision-20261014"

async def verify(args):
 OUT.mkdir(exist_ok=True);checks=[];layouts=[];media=[];sockets=[];errors=[]
 async with async_playwright() as p:
  browser=await getattr(p,args.engine).launch(**({"channel":args.channel} if args.channel else {}),headless=True)
  context=await browser.new_context(viewport={"width":1920,"height":1080},accept_downloads=True)
  if args.channel:await context.grant_permissions(["local-network-access"],origin=args.url.rstrip("/"))
  page=await context.new_page();page.on("pageerror",lambda error:errors.append(str(error)))
  await page.route_web_socket("**/ws/live",lambda ws:sockets.append(ws))
  await page.goto(args.url+"/#worm")
  await page.wait_for_function("document.querySelector('[data-role=case]').value==='c27_barenboim1981'")
  assert await page.locator("[data-role=case] option").count()==33
  assert await page.locator("[data-trial-start]").is_disabled()
  checks.append("curated modern default; all historical works retained; no hardware trial enabled")
  catalog=json.loads((ROOT/"public/research/vmus-reference-cases.json").read_text())
  for recording in ["c27_barenboim1981","c27_fou1978","c27_langlang2003","c9_yundili2004"]:
   rec=next(r for r in catalog["recordings"] if r["id"]==recording)
   await page.select_option("[data-role=work]",str(rec["workId"]))
   await page.select_option("[data-role=case]",recording)
   await page.wait_for_timeout(700)
   await page.click("[data-action=music-play]")
   await page.wait_for_function("!document.querySelector('[data-role=audio]').paused&&document.querySelector('[data-role=audio]').currentTime>.1")
   data=await page.locator("[data-role=audio]").evaluate("(a)=>({src:a.currentSrc,duration:a.duration,volume:a.volume})")
   assert abs(data["duration"]-rec["duration"])<.5
   assert data["volume"]==.5
   assert data["src"].startswith(args.url+"/api/research-media/"),data
   media.append({"recording":recording,**data})
   await page.locator("[data-role=audio]").evaluate("(a)=>a.pause()")
   await page.click("[data-layer=profile]")
   await page.locator(".planar-canvas").screenshot(path=str(OUT/f"curve-{recording}-{args.engine}.png"))
  checks.append("four actual complete source audio files decoded in browser, metadata matches, gain fixed at 0.5")
  await page.select_option("[data-role=work]","6");await page.select_option("[data-role=case]","c27_barenboim1981")
  await page.wait_for_timeout(700)
  await page.locator("[data-role=audio]").evaluate("(a)=>{a.currentTime=40;a.dispatchEvent(new Event('timeupdate'))}")
  await page.click("[data-layer=worm]")
  canvas=page.locator(".planar-canvas");before=await canvas.evaluate("(c)=>({...c.dataset})")
  assert before["depthUnit"]=="bar" and 1<int(before["scoreBar"])<78
  assert before["rangeY"]=="0,100" and before["levelUnit"]=="source-relative-0-100"
  assert before["levelSource"]=="vmus-2007-smoothed-amplitude" and before["dynamicMark"]==""
  assert abs(float(before["coordinate"].split(",")[1])-float(before["level"]))<1e-9
  assert before["representation"]=="bar-layers"
  assert len(json.loads(before["layerBars"]))==8
  assert all(isinstance(n,int) for n in json.loads(before["barTicks"]))
  await canvas.focus();await page.keyboard.press("ArrowRight")
  after=await canvas.evaluate("(c)=>({...c.dataset})")
  assert before["scoreBar"]==after["scoreBar"] and before["coordinate"]==after["coordinate"] and before["camera"]!=after["camera"]
  rec=next(r for r in catalog["recordings"] if r["id"]=="c27_barenboim1981")
  boundary=rec["annotation"]["t"][6*4]
  for stamp,expected in [(boundary-.001,4),(boundary,5),(boundary+.001,5)]:
   await page.locator("[data-role=audio]").evaluate("(a,t)=>{a.currentTime=t;a.dispatchEvent(new Event('timeupdate'))}",stamp)
   await page.wait_for_timeout(100)
   assert await canvas.get_attribute("data-score-bar")==str(expected)
  await page.select_option("[data-role=bar-window]","16")
  assert int(await canvas.get_attribute("data-layer-count"))==16
  await page.select_option("[data-role=bar-window]","0")
  assert int(await canvas.get_attribute("data-layer-count"))==77
  await page.select_option("[data-role=bar-window]","8")
  await page.locator("[data-role=audio]").evaluate("(a)=>{a.currentTime=40;a.dispatchEvent(new Event('timeupdate'))}")
  await page.screenshot(path=str(OUT/("music-box-"+args.engine+".png")))
  await page.click("[data-layer=structure]");assert await canvas.get_attribute("data-depth-unit")=="bar"
  assert await page.locator("[data-role=linearity]").inner_text()!="至少3拍"
  await page.screenshot(path=str(OUT/("tempo-structure-"+args.engine+".png")))
  await page.select_option("[data-role=space]","plane");assert await canvas.get_attribute("data-layer")=="structure"
  await page.select_option("[data-role=space]","time")
  for layer in ["profile","tempo","dynamics","rhythm"]:
   await page.click("[data-layer="+layer+"]")
   assert all(isinstance(n,int) for n in json.loads(await canvas.get_attribute("data-bar-ticks")))
  await page.click("[data-layer=dynamics]");assert await canvas.get_attribute("data-range-y")=="0,100"
  assert "來源 0–100" in await page.locator("[data-role=level]").inner_text()
  for smooth in [False,True]:
   await page.locator("[data-role=smoothing]").set_checked(smooth)
   await page.click("[data-layer=worm]")
   for space in ["plane","time"]:
    await page.select_option("[data-role=space]",space)
    assert await canvas.get_attribute("data-range-y")=="0,100"
    assert await canvas.get_attribute("data-dynamic-mark")==""
   assert not re.search(r"\b(?:PPP|PP|MP|MF|FF|FFF)\b",await page.locator(".reference-readouts").inner_text())
  await page.locator("[data-role=smoothing]").check()
  await page.click("[data-layer=dynamics]")
  await page.screenshot(path=str(OUT/f"relative-amplitude-{args.engine}.png"))
  assert "九個等寬" not in await page.locator("body").inner_text()
  checks.append("integer bar layers, exact bar boundary, 8/16/full score windows, integer axes, unchanged camera coordinates; continuous source amplitude on both projections, no inferred score marks")
  for width,height in [(320,740),(390,844),(768,1024),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
   await page.set_viewport_size({"width":width,"height":height})
   for layer in ["profile","tempo","dynamics","rhythm","worm","structure"]:
    await page.click("[data-layer="+layer+"]");await page.wait_for_timeout(90)
    assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth"),(width,layer)
    assert "\ufffd" not in await page.locator("body").inner_text()
    layouts.append({"width":width,"height":height,"layer":layer,"overflow":False})
   if width in (390,1920):await page.screenshot(path=str(OUT/f"music-structure-{args.engine}-{width}.png"))
  await page.set_viewport_size({"width":1920,"height":1080})
  await page.locator("#endpoint").evaluate("(e)=>{const u=new URL('/ws/live',location.href);u.protocol='ws:';e.value=u.href}")
  await page.locator("#connect").evaluate("(b)=>b.click()");await page.wait_for_timeout(300)
  assert sockets
  seq=0
  def packet(values,gap=0):
   nonlocal seq
   seq+=len(values)+gap;stamp=time.time()
   return {"schemaVersion":"neural-resonance-live-v1","source":"device","ts":stamp,"transport":"usb","connectionEpoch":1,"sessionId":"explicit-controlled-revision-qa","sampleRate":256,
    "rawUnit":"ADC counts","rawSequence":seq,"rawDropped":gap,"rawEegSamples":values,"metricOrigin":"thinkgear-esense",
    "eeg":{"poor_signal":0,"attention":60,"meditation":70,"delta":11,"theta":22,"lowAlpha":33,"highAlpha":44,"lowBeta":55,"highBeta":66,"lowGamma":77,"midGamma":88},
    "fieldTimestamps":{k:stamp for k in ["attention","meditation","delta","theta","lowAlpha","highAlpha","lowBeta","highBeta","lowGamma","midGamma","raw"]},"quality":{"eegPackets":seq}}
  first=packet([(-1)**i*(i+1) for i in range(64)]);sockets[-1].send(json.dumps(first));await page.wait_for_timeout(150)
  await page.evaluate("location.hash='waveforms'");await page.wait_for_timeout(300)
  derived=page.locator("#derived-wave")
  data=await derived.evaluate("(c)=>({...c.dataset})")
  assert abs(float(data["engagement"])-121/99)<1e-9,data
  assert data["attention"]=="60",data
  native=page.locator("#indices-wave")
  native_data=await native.evaluate("(c)=>({...c.dataset})")
  assert abs(float(native_data["relativeAlpha"])-77/231)<1e-9,native_data
  assert native_data["relaxation"]=="70",native_data
  visible=await page.locator(".wave-chart:visible canvas").count();assert visible==8,visible
  assert await page.locator(".band-note").count()==16
  assert await page.locator("#analysis-blackbox").count()==0
  assert await page.locator("#raw-wave").count()==0
  await page.select_option("#band-display","baseline")
  await page.wait_for_timeout(150);assert await page.locator("#wave-lowGamma").get_attribute("data-representation")=="baseline-deviation"
  checks.append("controlled fixture: eight native bands, two documented proxy indices, no black/white layer switch, no raw panel")
  before_proxy=int(data["proxySamples"]);before_native=int(data["nativeSamples"])
  sockets[-1].send(json.dumps(first));await page.wait_for_timeout(200)
  after=await derived.evaluate("(c)=>({...c.dataset})")
  assert int(after["proxySamples"])==before_proxy,"duplicate field clock must not add a proxy sample"
  assert int(after["nativeSamples"])==before_native,"duplicate field clock must not add a native sample"
  await page.click("#record")
  break_packet=packet([17,-555,9]);break_packet["rawBreaks"]=[1];break_packet["quality"]["protocolErrors"]=1
  sockets[-1].send(json.dumps(break_packet));await page.wait_for_timeout(250)
  async with page.expect_download() as export:
   await page.click("#export")
  download=await export.value;path=OUT/"protocol-break-export.json";await download.save_as(path)
  captured=json.loads(path.read_text(encoding="utf-8"))
  assert captured["snapshots"][-1]["rawBreaks"]==[1]
  assert captured["snapshots"][-1]["rawEegSamples"]==[17,-555,9]
  await page.click("#record")
  unknown=packet([1,-1]);unknown["fieldTimestamps"]["poor_signal"]=time.time()-4
  sockets[-1].send(json.dumps(unknown));await page.wait_for_timeout(250)
  assert await page.locator("#read-attention").inner_text()=="—"
  assert await page.locator("#signal-contact").inner_text()=="未回報"
  assert await page.locator("#freshness").inner_text()=="接觸品質未確認"
  sockets[-1].send(json.dumps(packet([1,-1])));await page.wait_for_timeout(150)
  checks.append("controlled fixture: protocol breaks reach waveform and JSON export without invented loss counts; stale contact quality blocks valid indices")
  await page.evaluate("""()=>{const note=document.createElement('div');note.textContent='受控协议测试数据 · 非头带实测';note.style.cssText='position:fixed;bottom:8px;right:12px;background:#293435;color:#fff;padding:10px;z-index:9999;font:12px \"NR CJK\",sans-serif';document.body.append(note)}""")
  await page.screenshot(path=str(OUT/("waveform-signed-"+args.engine+".png")),full_page=True)
  for width,height in [(390,844),(1920,1080)]:
   await page.set_viewport_size({"width":width,"height":height});await page.wait_for_timeout(150)
   assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth"),("waveforms",width)
  assert not errors,errors
  report={"pass":True,"engine":args.engine,"channel":args.channel,"url":args.url,"checks":checks,"layouts":layouts,"media":media,"derivedDataset":data,"physicalHardwareVerified":False,"errors":errors}
  (OUT/f"revision-{args.engine}-{args.channel or 'bundled'}.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
  await browser.close()
  print(json.dumps(report,ensure_ascii=False))

if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("--url",default="http://127.0.0.1:8788")
 parser.add_argument("--engine",default="chromium");parser.add_argument("--channel",default=None)
 asyncio.run(verify(parser.parse_args()))
