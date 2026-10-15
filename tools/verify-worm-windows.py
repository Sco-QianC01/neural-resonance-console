"""Verify the deployed 8767 UI in an isolated Edge context, without user profiles."""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/worm-direction-20261011/windows-browser"
sys.path.insert(0, str(ROOT / "artifacts/worm-academic-20261010/qa-python"))
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

OUT.mkdir(parents=True, exist_ok=True)
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="msedge")
        context = await browser.new_context(viewport={"width":1920,"height":1080}, device_scale_factor=1)
        page = await context.new_page()
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.on("console",lambda message:errors.append(message.text) if message.type=="error" else None)
        await page.goto("http://127.0.0.1:8767/#worm")
        await page.wait_for_selector(".research-canvas")
        await page.wait_for_function("!document.querySelector('[data-role=seek]').disabled")
        assert not await page.locator("[data-role=scene-error]").is_visible()
        await page.locator("[data-role=seek]").fill("12")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(OUT/"live-trace-1920x1080.png"))
        selected=[]
        for i in range(10):
            await page.locator(f".element-tabs [data-layer='{i}']").click()
            await page.wait_for_timeout(90)
            assert await page.locator(f".element-tabs [data-layer='{i}']").get_attribute("aria-selected")=="true"
            selected.append(await page.locator("[data-role=detail-title]").inner_text())
        await page.locator(".element-tabs [data-layer='4']").click()
        assert await page.locator(".detail-spark").is_visible()
        await page.wait_for_timeout(850)
        await page.screenshot(path=str(OUT/"live-focus-1920x1080.png"))
        geometry = await page.evaluate("""async()=>{
            const {WormScene}=await import('/src/worm-scene.mjs');
            const data=await (await fetch('/public/research/vmus-performance.json')).json();
            const host=document.createElement('div');
            host.style.cssText='width:800px;height:500px;position:fixed;left:-10000px';
            document.body.append(host);
            const scene=new WormScene(host);scene.setSource('music',data,null);
            const results=[];
            for(let i=0;i<10;i++){
                scene.setView('focus',i);scene.updateCursor(12);
                let heads=0;
                scene.dynamic.traverse(o=>{if(o.geometry?.type==='SphereGeometry')heads++;});
                results.push({layer:i,pages:scene.planes.length,heads});
            }
            scene.setView('trace');
            const rotateLocked=!scene.controls.enableRotate;
            scene.dispose();host.remove();
            return {results,rotateLocked};
        }""")
        assert geometry["rotateLocked"]
        for item in geometry["results"]:
            assert item["pages"]==1,item
            assert item["heads"]==(1 if item["layer"] in [1,3,4,8] else 0),item
        await page.locator("[data-scene=solo]").click()
        await page.wait_for_timeout(750)
        await page.screenshot(path=str(OUT/"live-solo-1920x1080.png"))
        async with page.expect_download() as download:
            await page.locator("[data-action=export]").click()
        image_path=OUT/"exported-figure.png"
        await (await download.value).save_as(str(image_path))
        image=Image.open(image_path).convert("RGB")
        assert max(ImageStat.Stat(image).stddev)>5
        await page.locator("[data-scene=trace]").click()
        await page.locator("[data-role=smoothing]").select_option("0")
        await page.wait_for_timeout(200)
        await page.locator("[data-role=smoothing]").select_option("1")
        assert await page.locator(".detail-spark").is_visible()
        layouts=[]
        for w,h in [(390,844),(768,1024),(1280,720),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
            await page.set_viewport_size({"width":w,"height":h})
            await page.wait_for_timeout(220)
            metrics=await page.evaluate("""()=>{
                const c=document.querySelector('.research-canvas'),r=c.getBoundingClientRect();
                const gl=c.getContext('webgl2'),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
                gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
                let nonblank=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>120)nonblank++;
                return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
                    canvas:[r.width,r.height],nonblank,
                    controlsBottom:document.querySelector('.research-transport').getBoundingClientRect().bottom,
                    tabsBottom:document.querySelector('.element-tabs').getBoundingClientRect().bottom};
            }""")
            assert not metrics["overflow"],metrics
            assert metrics["nonblank"]>200,metrics
            if w>=1280: assert metrics["controlsBottom"]<=h and metrics["tabsBottom"]<h
            layouts.append(metrics)
            await page.screenshot(path=str(OUT/f"live-{w}x{h}.png"),full_page=True)
            await page.locator("[data-scene=focus]").click()
            await page.wait_for_timeout(750)
            await page.screenshot(path=str(OUT/f"focus-{w}x{h}.png"),full_page=True)
            assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth")
            await page.locator("[data-scene=trace]").click()
        await page.set_viewport_size({"width":1920,"height":1080})
        await page.locator("[data-source=eeg]").click()
        await page.wait_for_timeout(350)
        eeg_label=await page.locator("[data-role=plot-meta]").inner_text()
        assert "合成示範" not in eeg_label
        await page.screenshot(path=str(OUT/"live-eeg.png"))
        await page.locator("[data-source=music]").click()
        await page.locator("[data-action=play]").click()
        await page.wait_for_function("document.querySelector('audio').currentTime>14 && !document.querySelector('audio').paused",timeout=30000)
        playback=await page.locator("audio").evaluate("(a)=>({currentTime:a.currentTime,muted:a.muted,volume:a.volume,error:a.error?.code||null})")
        await page.locator("[data-action=play]").click()
        t=await page.locator("audio").evaluate("(a)=>a.currentTime")
        await page.wait_for_timeout(500)
        assert abs(await page.locator("audio").evaluate("(a)=>a.currentTime")-t)<.1
        playback["pause"]=True
        await page.locator("[data-role=seek]").fill("37.8")
        await page.locator("[data-action=play]").click()
        await page.wait_for_function("document.querySelector('audio').ended",timeout=10000)
        playback["seekAndEnd"]=True
        await page.locator("[data-role=seek]").fill("12")
        assert await page.locator("[data-role=media-status]").inner_text()!="播放完畢"
        await page.locator(".element-tabs [data-layer='4']").click()
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(OUT/"live-final-1920x1080.png"))
        # Pointer rotation is distinct from the programmed element transition.
        canvas=page.locator(".research-canvas")
        before=await canvas.screenshot()
        box=await canvas.bounding_box()
        await page.mouse.move(box["x"]+box["width"]*.4,box["y"]+box["height"]*.4)
        await page.mouse.down()
        await page.mouse.move(box["x"]+box["width"]*.55,box["y"]+box["height"]*.5,steps=8)
        await page.mouse.up()
        await page.wait_for_timeout(300)
        assert before!=await canvas.screenshot()
        await page.locator("[data-action=reset]").click()
        for dpr in [1.5,2]:
            tab=await browser.new_page(viewport={"width":1920,"height":1080},device_scale_factor=dpr,reduced_motion="reduce")
            await tab.goto("http://127.0.0.1:8767/#worm")
            await tab.wait_for_selector(".research-canvas")
            await tab.wait_for_function("!document.querySelector('[data-role=seek]').disabled")
            await tab.locator(".element-tabs [data-layer='8']").click()
            await tab.wait_for_timeout(200)
            assert await tab.locator(".research-canvas").get_attribute("data-layer")=="timbre"
            assert not await tab.evaluate("document.documentElement.scrollWidth>innerWidth")
            await tab.screenshot(path=str(OUT/f"live-dpr-{dpr}.png"))
            await tab.close()
        result={"url":page.url,"browser":browser.version,"layers":selected,"layouts":layouts,"playback":playback,
                "rawEEGLabel":eeg_label,"dragVerified":True,"dpr":[1,1.5,2],"exportNonblank":True,
                "geometry":geometry,"errors":errors}
        (OUT/"verification.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps(result,ensure_ascii=False))
        assert not errors,errors
        await browser.close()

asyncio.run(main())
