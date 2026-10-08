"""Real browser checks against an isolated gateway; no hardware is opened."""
import argparse
import asyncio
import csv
import io
import json
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"gateway"))
from device_gateway import Acquisition,create_app,validate_config
from aiohttp.test_utils import TestServer
from playwright.async_api import async_playwright


async def verify(args):
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory)
        config=validate_config({key:{"enabled":False} for key in ("eeg","bloodOxygen","gsr","ble")})
        acquisition=Acquisition(config)
        server=TestServer(create_app(acquisition,root/"config.json"))
        await server.start_server()
        producer=None
        browser=None
        state={"running":True,"freeze":False,"tick":0}
        results={"engine":args.engine,"hardwareOpened":False,"checks":[]}
        async def produce():
            while state["running"]:
                if not state["freeze"]:
                    tick=state["tick"];state["tick"]+=1
                    acquisition.stream.accept("usb",{"attention":60+tick%5,"meditation":70,
                        "delta":20,"theta":30,"lowAlpha":20,"highAlpha":10,
                        "lowBeta":4,"highBeta":6,"poor_signal":0},[tick,-tick])
                    acquisition.stream.sensor("spo2",98)
                    acquisition.stream.sensor("pr",72)
                await asyncio.sleep(.2)
        try:
            producer=asyncio.create_task(produce())
            async with async_playwright() as playwright:
                engine=getattr(playwright,args.engine)
                launch={"headless":True}
                if args.channel:launch["channel"]=args.channel
                browser=await engine.launch(**launch)
                context=await browser.new_context(viewport={"width":1440,"height":1000},accept_downloads=True)
                page=await context.new_page()
                errors=[]
                frames=[]
                page.on("pageerror",lambda error:errors.append(str(error)))
                def packet_received(text):
                    try:
                        packet=json.loads(text)
                        frames.append({key:packet.get(key) for key in
                            ("ts","transport","sessionId","connectionEpoch","fieldTimestamps")})
                        del frames[:-12]
                    except (ValueError,TypeError):pass
                page.on("websocket",lambda socket:socket.on("framereceived",packet_received))
                await page.goto(str(server.make_url("/")))
                await page.wait_for_function("document.querySelector('#read-attention').textContent === '60' || Number(document.querySelector('#read-attention').textContent)>60")
                await page.click("#record")
                await asyncio.sleep(1.1)
                for view in ("worm","settings","waveforms"):
                    await page.click(f'[data-view="{view}"]')
                    await page.wait_for_function(f"!document.querySelector('#view-{view}').hidden")
                await page.click("#record")
                async with page.expect_download() as download:
                    await page.click("#export")
                exported=await download.value
                saved=root/"recording.json";await exported.save_as(saved)
                recording=json.loads(saved.read_text(encoding="utf-8"))
                assert len(recording["snapshots"])>=2
                assert all(packet["spo2"]==98 and packet["pr"]==72 for packet in recording["snapshots"])
                assert all(packet["source"]=="device" for packet in recording["snapshots"])
                results["checks"].append("shared views and sensor recording")
                async with page.expect_download() as download:
                    await page.click("#csv-export")
                exported=await download.value
                saved_csv=root/"recording.csv";await exported.save_as(saved_csv)
                rows=list(csv.DictReader(io.StringIO(saved_csv.read_text(encoding="utf-8"))))
                assert len(rows)==len(recording["snapshots"])
                assert rows[0]["spo2"]=="98" and rows[0]["pr"]=="72"
                results["checks"].append("CSV sensor preservation")
                await page.click('[data-view="settings"]')
                await page.evaluate("""async()=>{
                  const response=await fetch('/api/gateway/config',{method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({eeg:{serialNumber:'audit-absent-device',enabled:false}})});
                  if(!response.ok)throw new Error('Config test failed');
                }""")
                await page.click("#gateway-refresh")
                await page.wait_for_function("document.querySelector('#gateway-eeg-select').value.includes('audit-absent-device')",timeout=3000)
                results["checks"].append("absent saved USB identity remains selected")
                new_session=acquisition.stream.session_id
                for _ in range(30):
                    if any(frame["sessionId"]==new_session and frame["transport"]=="usb" for frame in frames):break
                    await asyncio.sleep(.1)
                else:raise AssertionError("New acquisition session did not reach the browser")
                await page.click('[data-view="worm"]')
                await page.click("#make-prompt")
                assert "創作方案" in await page.input_value("#music-prompt")
                state["freeze"]=True
                await page.wait_for_function("document.querySelector('#make-prompt').disabled",timeout=6000)
                before=await page.locator("#hero").get_attribute("data-coordinate")
                await asyncio.sleep(.6)
                after=await page.locator("#hero").get_attribute("data-coordinate")
                assert before==after,{"before":before,"after":after,
                    "status":await page.locator("#worm-change").inner_text(),
                    "samples":await page.locator("#hero").get_attribute("data-samples"),"frames":frames}
                assert await page.input_value("#music-prompt")==""
                results["checks"].append("frozen hardware stops trace and clears export")
                state["freeze"]=False
                await page.wait_for_function("!document.querySelector('#make-prompt').disabled")
                await context.set_offline(True)
                await asyncio.sleep(.4)
                await context.set_offline(False)
                await page.wait_for_function("!document.querySelector('#make-prompt').disabled",timeout=20000)
                results["checks"].append("network interruption recovery")
                await page.click("#replay")
                await page.set_input_files("#replay-file",{"name":"recording.json","mimeType":"application/json",
                    "buffer":json.dumps(recording).encode()})
                await page.click("#replay-start")
                await page.wait_for_function("document.querySelector('#sensor-spo2').textContent==='98'")
                assert "記錄方案" in await page.locator("#element-sample").inner_text()
                await page.click("#replay-stop")
                results["checks"].append("recording replay keeps sensor data and music plan")
                await page.click("#demo")
                for width,height in ((320,740),(390,844),(768,1024),(1920,1080)):
                    await page.set_viewport_size({"width":width,"height":height})
                    for view in ("waveforms","worm","settings"):
                        await page.evaluate(f"location.hash='{view}'")
                        await page.wait_for_function(f"!document.querySelector('#view-{view}').hidden")
                        assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth"),(width,view)
                    if width<760:
                        await page.click("#nav-toggle")
                        await page.click('[data-view="worm"]')
                        assert not await page.locator("body").evaluate("e=>e.classList.contains('nav-open')")
                await page.set_viewport_size({"width":1440,"height":1000})
                await page.evaluate("location.hash='worm'")
                await page.click("#worm-exhibit")
                assert await page.locator("body").evaluate("e=>e.classList.contains('exhibit')")
                await page.keyboard.press("Escape")
                assert not await page.locator("body").evaluate("e=>e.classList.contains('exhibit')")
                await page.emulate_media(reduced_motion="reduce")
                assert await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
                results["checks"].append("320/390/768/1920 layout, navigation and exhibition")
                assert not errors,errors
                text=await page.locator("body").inner_text()
                assert not any(word in text for word in ("待复核","待復核","未确定","未確定","未观测","未觀測"))
                results["runtimeErrors"]=errors;results["pass"]=True
                output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
                await page.screenshot(path=str(output.with_suffix(".png")))
                output.write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding="utf-8")
                await context.close()
                await browser.close();browser=None
        finally:
            state["running"]=False
            if producer:producer.cancel();await asyncio.gather(producer,return_exceptions=True)
            if browser:await browser.close()
            await server.close()
        print(json.dumps(results,indent=2,ensure_ascii=False))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--engine",choices=("chromium","firefox","webkit"),default="chromium")
    parser.add_argument("--channel")
    parser.add_argument("--output",default="artifacts/browser-audit.json")
    asyncio.run(verify(parser.parse_args()))
