"""Whole visible site acceptance in a disposable native Edge context."""
import argparse
import asyncio
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
if importlib.util.find_spec("playwright") is None:
    sys.path.insert(0, str(ROOT / "artifacts/worm-academic-20261010/qa-python"))
from playwright.async_api import async_playwright


async def verify(args):
    out = ROOT / "artifacts/system-audit-20261012"
    base = args.url.rstrip("/")
    errors, layouts, checks, documents = [], [], [], []
    async with async_playwright() as driver:
        browser = await driver.chromium.launch(channel="msedge", headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080},
                                           accept_downloads=True)
        await context.grant_permissions(["local-network-access"], origin=base)
        page = await context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        if args.source:
            async def source_route(route):
                name = unquote(urlsplit(route.request.url).path)
                if name == "/":
                    name = "/index.html"
                if name == "/public/config.json":
                    await route.continue_()
                    return
                file = (ROOT / name.lstrip("/")).resolve()
                if file.is_relative_to(ROOT) and file.is_file():
                    types = {".md": "text/plain", ".html": "text/html", ".css": "text/css",
                             ".mjs": "text/javascript", ".js": "text/javascript",
                             ".json": "application/json", ".svg": "image/svg+xml"}
                    await route.fulfill(body=file.read_bytes(),
                                        content_type=types.get(file.suffix, "application/octet-stream") + "; charset=utf-8")
                else:
                    await route.continue_()
            await context.route(base + "/**", source_route)
        await page.goto(base + "/")
        await page.wait_for_function("document.querySelector('#status') && document.querySelector('#status').textContent.length>0")
        checks.append("source workflow loaded; live hardware assertions remain in live audit")
        # All three views, not just the settings page, at common laptop/external sizes.
        for width, height in [(320, 740), (390, 844), (768, 1024), (1366, 768),
                              (1920, 1080), (2560, 1440), (3840, 2160)]:
            await page.set_viewport_size({"width": width, "height": height})
            for view in ("waveforms", "worm", "settings"):
                await page.evaluate("(view)=>location.hash=view", view)
                await page.wait_for_function("(view)=>!document.querySelector('#view-'+view).hidden", arg=view)
                await page.wait_for_timeout(100)
                text = await page.locator("body").inner_text()
                assert "\ufffd" not in text, (width, view)
                assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth"), (width, view)
                canvas = await page.locator(".planar-canvas").bounding_box() if view == "worm" else None
                if canvas:
                    assert canvas["width"] > 100 and canvas["height"] > 100, (width, canvas)
                layouts.append({"width": width, "height": height, "view": view,
                                "charset": await page.evaluate("document.characterSet"),
                                "overflow": False, "canvas": canvas})
                if width == 1920:
                    await page.screenshot(path=str(out / f"{'source' if args.source else 'live'}-{view}-1920.png"))
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.evaluate("location.hash='worm'")
        # An incomplete catalogue must not poison its cache or prevent retry.
        catalog = json.loads((ROOT / "public/research/vmus-reference-cases.json").read_text())
        attempts = 0

        async def catalog_route(route):
            nonlocal attempts
            attempts += 1
            await asyncio.sleep(.2)
            await route.fulfill(json={"schema": catalog["schema"], "recordings": catalog["recordings"]}
                                if attempts == 1 else catalog)

        await page.route(base + "/public/research/vmus-reference-cases.json", catalog_route)
        await page.reload()
        await page.wait_for_function("document.querySelector('[data-role=music-play-state]').textContent.includes('重試')")
        assert attempts == 1, attempts
        await page.click("[data-visual=music]")
        await page.wait_for_function("document.querySelector('[data-role=work]').options.length===2")
        assert attempts == 2
        for work in catalog["works"]:
            await page.select_option("[data-role=work]", str(work["id"]))
            expected = sum(recording["workId"] == work["id"] for recording in catalog["recordings"])
            assert await page.locator("[data-role=case] option").count() == expected
        checks.append("incomplete catalogue, simultaneous requests, retry, two Chopin works and 40 choices")
        # Settings import is browser-local; no request mutates the running device config.
        await page.evaluate("location.hash='settings'")
        settings = {"schemaVersion": "neural-resonance-settings-v1", "baud": "57600",
                    "ble-name": "中文設備", "endpoint": "ws://127.0.0.1:8767/ws/live"}
        await page.set_input_files("#settings-file", {"name": "中文設定.json", "mimeType": "application/json",
                                   "buffer": ("\ufeff" + json.dumps(settings, ensure_ascii=False)).encode("utf-8")})
        await page.wait_for_function("document.querySelector('#baud').value==='57600'")
        assert await page.input_value("#ble-name") == "中文設備"
        async with page.expect_download() as download:
            await page.click("#download-settings")
        target = out / "controlled-settings.json"
        await (await download.value).save_as(target)
        assert json.loads(target.read_text())["ble-name"] == "中文設備"
        checks.append("UTF-8 BOM Chinese settings import and JSON export")
        # A rejected recording should be reported; a valid subsequent import works.
        await page.evaluate("location.hash='worm'")
        await page.click("[data-visual=eeg]")
        await page.locator("#replay").click()
        await page.set_input_files("#research-worm [data-role=file]",
                                  {"name": "bad.json", "mimeType": "application/json", "buffer": b'{"snapshots":[]}'})
        await page.wait_for_function("!document.querySelector('#notice').hidden")
        rows = [{"schemaVersion": "neural-resonance-live-v1", "source": "demo",
                 "sessionId": "controlled-encoding", "ts": 1700000000 + i*.2,
                 "quality": {"eegPackets": i+1}, "eeg": {"attention": 65+i%3, "meditation": 58},
                 "rawUnit": "來源原始值", "rawEegSamples": [i, -i]}
                for i in range(12)]
        recording = {"schemaVersion": "neural-resonance-recording-v1", "snapshots": rows}
        await page.set_input_files("#research-worm [data-role=file]",
                                  {"name": "中文記錄.json", "mimeType": "application/json",
                                   "buffer": ("\ufeff" + json.dumps(recording, ensure_ascii=False)).encode("utf-8")})
        await page.wait_for_function("!document.querySelector('#research-worm [data-action=replay]').disabled")
        await page.click("#research-worm [data-action=replay]")
        await page.wait_for_function("document.querySelector('#read-attention').textContent!=='—'")
        assert await page.locator("#status").get_attribute("data-state") != "valid"
        checks.append("invalid recording recovery and BOM replay remains distinct from acquisition")
        # Directly opened Chinese method pages declare UTF-8; rendered pages preserve source hashes.
        for name in ("PLANAR-METHODS", "EVIDENCE", "MUSIC-PLANS", "WORM-METHODS", "MUSIC-FUSION"):
            response = await page.goto(base + f"/docs/{name}.html")
            assert response.status == 200
            assert await page.evaluate("document.characterSet") == "UTF-8"
            text = await page.locator("article").inner_text()
            assert "\ufffd" not in text
            digest = await page.locator("meta[name=source-sha256]").get_attribute("content")
            assert digest == hashlib.sha256((ROOT / f"docs/{name}.md").read_bytes()).hexdigest()
            documents.append({"name": name, "utf8": True, "sourceDigestMatch": True})
        response = await page.goto(base + "/docs/PLANAR-METHODS.md")
        assert "charset=utf-8" in response.headers.get("content-type", "").lower()
        assert "二維神經蠕蟲" in await page.locator("body").inner_text()
        checks.append("five rendered academic documents and direct Markdown UTF-8")
        assert not errors, errors
        await context.close()
        await browser.close()
    result = {"pass": True, "scope": "source-routed" if args.source else "deployed-live",
              "layouts": layouts, "checks": checks, "documents": documents,
              "browserErrors": errors, "hardwareOpened": False,
              "limitation": "Linux WebKit is not a macOS/Safari or physical device acceptance."}
    target = out / ("source-full-browser.json" if args.source else "live-full-browser.json")
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Passed {result['scope']}: 21 view/viewport pairs, {len(checks)} workflows, 5 documents")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8767")
    parser.add_argument("--source", action="store_true")
    asyncio.run(verify(parser.parse_args()))
