"""Real browser score/playback checks. Never inject or save physical acquisition data."""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/music-elements-20261015"


async def verify(args):
    OUT.mkdir(parents=True, exist_ok=True)
    errors, checks, layouts = [], [], []
    catalog = json.loads((ROOT / "public/research/vmus-reference-cases.json").read_text())
    rec = next(r for r in catalog["recordings"] if r["id"] == "c27_barenboim1981")
    data = json.loads((ROOT / "public/research/chopin-score/op27-2-bars1-8.json").read_text())
    base = args.url.rstrip("/")
    async with async_playwright() as p:
        browser = await getattr(p, args.engine).launch(headless=True, **({"channel": args.channel} if args.channel else {}))
        context = await browser.new_context(viewport={"width": 1920, "height": 1080}, accept_downloads=True)
        if args.channel:
            await context.grant_permissions(["local-network-access"], origin=base)
        if args.source:
            async def source(route):
                name = unquote(urlsplit(route.request.url).path)
                file = (ROOT / (name.lstrip("/") or "index.html")).resolve()
                if name != "/public/config.json" and file.is_relative_to(ROOT) and file.is_file():
                    types = {".html": "text/html", ".css": "text/css", ".mjs": "text/javascript",
                             ".js": "text/javascript", ".json": "application/json", ".md": "text/plain", ".krn": "text/plain"}
                    await route.fulfill(body=file.read_bytes(), content_type=types.get(file.suffix, "application/octet-stream") + "; charset=utf-8")
                else:
                    await route.continue_()
            await context.route(base + "/**", source)
        page = await context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(base + "/#worm")
        await page.wait_for_function("document.querySelector('.score-evidence').dataset.sourceState==='ready'")
        assert await page.locator("[data-layer=notes]").get_attribute("aria-pressed") == "true"
        canvas = page.locator(".score-canvas")
        assert await canvas.get_attribute("data-representation") == "score-bar-layers"
        assert json.loads(await canvas.get_attribute("data-layer-bars")) == list(range(1, 9))
        assert await page.locator("[data-note-pitch]").inner_text() == "—"
        assert "休止" in await page.locator(".score-state").inner_text()
        await canvas.focus()
        await page.keyboard.press("ArrowRight")
        await page.wait_for_function("document.querySelector('[data-note-pitch]').textContent.includes('F5')")
        t = await page.locator("[data-role=audio]").evaluate("(a)=>a.currentTime")
        assert abs(t - rec["annotation"]["t"][6]) < .001
        camera = await canvas.get_attribute("data-camera")
        box = await canvas.bounding_box()
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.mouse.down()
        await page.mouse.move(box["x"] + box["width"] / 2 + 50, box["y"] + box["height"] / 2 + 20, steps=5)
        await page.mouse.up()
        assert await canvas.get_attribute("data-camera") != camera
        assert await page.locator("[data-note-pitch]").inner_text() == "F5 · 調內"
        await canvas.focus()
        await page.keyboard.press("Home")
        checks.append("default score view, integer layers, rest, first-note keyboard positioning and camera independent of facts")
        await page.locator(".score-measures summary").click()
        assert await page.locator(".score-measures tbody tr").count() == 8
        row = page.locator(".score-measures tr[data-bar='2']")
        assert await row.locator("td").nth(1).inner_text() == "4"
        assert await row.locator("td").nth(4).inner_text() == "2/3"
        await page.locator(".score-measures summary").click()
        await page.locator(".score-events summary").click()
        assert await page.locator(".score-events tbody tr").count() == 33
        tied = next(e for e in data["events"] if e["bar"] == 3)
        await page.locator(f"tr[data-event='{tied['id']}'] button").click()
        assert await page.locator("[data-note-duration]").inner_text() == "2 · 延音合併"
        natural = next(e for e in data["events"] if e["bar"] == 5)
        await page.locator(f"tr[data-event='{natural['id']}'] button").click()
        assert await page.locator("[data-note-pitch]").inner_text() == "A4 · 調外"
        assert "6 個裝飾音" in await page.locator("[data-score-ornaments]").inner_text()
        assert "fz" in await page.locator("[data-score-dynamics]").inner_text()
        await page.locator(".score-events summary").click()
        # Decode the actual curated source, without inferring speakers or listening quality.
        await page.click("[data-action=music-play]")
        await page.wait_for_function("!document.querySelector('[data-role=audio]').paused&&document.querySelector('[data-role=audio]').currentTime>17.7")
        await page.locator("[data-role=audio]").evaluate("(a)=>a.pause()")
        assert await canvas.get_attribute("data-event-id") == natural["id"]
        checks.append("33 actual score events, 6 untimed ornaments, tie merge, outside-scale spelling, 2 steps/3 intervals in bar 2, actual audio decoding follows score")
        async with page.expect_download() as download:
            await page.click("[data-score-export]")
        output = await download.value
        target = OUT / f"score-export-{args.engine}-{'source' if args.source else 'live'}.json"
        await output.save_as(target)
        exported = json.loads(target.read_text())
        assert exported["source"]["sha256"] == data["source"]["sha256"]
        assert exported["alignment"]["anchors"] == rec["annotation"]["t"]
        assert exported["alignment"]["noteOnsetsMeasured"] is False
        assert exported["constructs"]["focus"] is None
        assert exported["events"][0]["kind"] == "rest"
        async with page.expect_download() as png:
            await page.click("[data-action=export]")
        await (await png.value).save_as(OUT / "score-layers-export.png")
        await page.locator("[data-role=audio]").evaluate("(a)=>{a.currentTime=40;a.dispatchEvent(new Event('timeupdate'))}")
        assert await page.locator(".score-evidence").get_attribute("data-source-state") == "outside"
        assert await page.locator("[data-note-pitch]").inner_text() == "—"
        await page.select_option("[data-role=work]", "4040")
        assert await page.locator(".score-evidence").get_attribute("data-source-state") == "missing-work"
        assert not await canvas.is_visible()
        assert await page.locator("[data-score-export]").is_disabled()
        assert await page.locator("[data-action=export]").is_disabled()
        checks.append("source/anchors exported, screenshot metadata retained, out-of-excerpt and other work show no stale facts")
        await page.select_option("[data-role=work]", "6")
        await page.select_option("[data-role=case]", "c27_fou1978")
        await page.locator("[data-role=audio]").evaluate("(a)=>{a.currentTime=20;a.dispatchEvent(new Event('timeupdate'))}")
        async with page.expect_download() as other:
            await page.click("[data-score-export]")
        target = OUT / "score-other-performance.json"
        await (await other.value).save_as(target)
        other_data = json.loads(target.read_text())
        other_rec = next(r for r in catalog["recordings"] if r["id"] == "c27_fou1978")
        assert other_data["alignment"]["anchors"] == other_rec["annotation"]["t"]
        assert other_data["alignment"]["anchors"] != rec["annotation"]["t"]
        checks.append("same score changes playback mapping with the selected performance")
        for width, height in [(320, 740), (390, 844), (768, 1024), (1366, 768), (1920, 1080), (2560, 1440), (3840, 2160)]:
            await page.set_viewport_size({"width": width, "height": height})
            for details in [False, True]:
                await page.locator(".score-events").evaluate("(d,open)=>d.open=open", details)
                await page.wait_for_timeout(80)
                assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth"), (width, details)
                assert "\ufffd" not in await page.locator("body").inner_text()
                layouts.append(dict(width=width, height=height, evidenceTableOpen=details, overflow=False))
            await page.locator(".score-events").evaluate("(d)=>d.open=false")
            await page.evaluate("scrollTo(0,0)")
            if width in (390, 1920, 3840):
                await page.screenshot(path=str(OUT / f"score-{width}-{'source' if args.source else 'live'}.png"),full_page=width==390)
        for layer in ["profile", "tempo", "dynamics", "rhythm", "worm", "structure"]:
            await page.click(f"[data-layer={layer}]")
            assert await page.locator(".planar-canvas").is_visible()
            assert not await canvas.is_visible()
        await page.click("[data-visual=eeg]")
        assert await page.locator(".planar-canvas").is_visible()
        await page.click("[data-visual=music]")
        await page.click("[data-layer=notes]")
        assert await canvas.is_visible()
        method = await context.new_page()
        await method.goto(base + "/docs/SCORE-EVIDENCE.html")
        digest = hashlib.sha256((ROOT / "docs/SCORE-EVIDENCE.md").read_bytes()).hexdigest()
        assert await method.locator("meta[name=source-sha256]").get_attribute("content") == digest
        assert await method.evaluate("document.characterSet") == "UTF-8"
        checks.append("14 viewport/table layouts, six original views and neural mode switch, offline UTF-8 methods")
        assert not errors, errors
        result = dict(pass_=True, browser=browser.version, engine=args.engine, sourceRouted=args.source,
                      checks=checks, layouts=layouts, errors=errors, physicalHardwareVerified=False,
                      noteOnsetsMeasured=False, editionMatchVerified=False)
        (OUT / f"browser-{'source' if args.source else 'live'}-{args.engine}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False))
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8767")
    parser.add_argument("--channel")
    parser.add_argument("--engine", default="chromium", choices=["chromium", "firefox", "webkit"])
    parser.add_argument("--source", action="store_true")
    asyncio.run(verify(parser.parse_args()))
