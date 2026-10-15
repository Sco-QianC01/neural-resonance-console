"""Native Edge checks of a relocated isolated application, with hardware disabled."""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "artifacts/worm-academic-20261010/qa-python"))
from playwright.async_api import async_playwright


async def check(args):
    out = ROOT / "artifacts/portable-20261012/windows-browser"
    out.mkdir(parents=True, exist_ok=True)
    if args.url:
        await browser_check(args.url.rstrip("/"), out, live=True)
        return
    with tempfile.TemporaryDirectory(prefix="Browser 原生 搬遷 ") as directory:
        data = Path(directory)
        native = Path(args.native).resolve()
        moved = data / "獨立 程式" / native.parent.name
        shutil.copytree(native.parent, moved)
        config = json.loads((ROOT / "gateway/config.example.json").read_text(encoding="utf-8"))
        for key in ("eeg", "bloodOxygen", "gsr", "ble"):
            config[key]["enabled"] = False
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            config["port"] = probe.getsockname()[1]
        (data / "config.json").write_text(json.dumps(config), encoding="utf-8")
        command = [str(moved / native.name), "--no-browser"]
        process = subprocess.Popen(command, env={**os.environ, "NEURAL_RESONANCE_DATA": str(data)})
        try:
            base = None
            for _ in range(100):
                try:
                    state = json.loads((data / "runtime.json").read_text())
                    candidate = state["url"].rstrip("/")
                    with urllib.request.urlopen(candidate + "/api/health", timeout=.5) as response:
                        health = json.load(response)
                    if health.get("build") == "score-evidence-20261015-v9":
                        base = candidate
                        break
                except (OSError, KeyError, ValueError):
                    pass
                await asyncio.sleep(.1)
            assert base, "Relocated native server did not become ready"
            await browser_check(base, out, hashlib.sha256(native.read_bytes()).hexdigest())
        finally:
            if process.poll() is None:
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            process.wait(timeout=10)


async def browser_check(base, out, native_sha256=None, live=False):
    errors, layouts = [], []
    async with async_playwright() as driver:
        browser = await driver.chromium.launch(channel="msedge", headless=True)
        for width, height in [(320, 740), (390, 844), (768, 1024), (1366, 768),
                              (1920, 1080), (2560, 1440), (3840, 2160)]:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.context.grant_permissions(["local-network-access"], origin=base)
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(base + "/#settings")
            await page.wait_for_selector("#gateway-panel")
            await page.wait_for_function("document.querySelector('#runtime-summary').textContent.includes('獨立采集器')")
            assert await page.locator("#gateway-open").get_attribute("href") == base + "/"
            assert not await page.locator("#gateway-save").is_disabled()
            assert await page.locator("#gateway-inventory").inner_text()
            overflow = await page.evaluate("document.documentElement.scrollWidth>innerWidth")
            assert not overflow, width
            layouts.append({"width": width, "height": height, "overflow": overflow})
            if width in (390, 1920):
                picture = out / f"settings-{width}.png"
                await page.screenshot(path=str(picture), full_page=True)
            await page.evaluate("location.hash='waveforms'")
            await page.wait_for_selector("#raw-wave")
            assert await page.locator("#analysis-whitebox").get_attribute("aria-pressed") == "true"
            for layer in ("blackbox", "whitebox"):
                await page.locator("#analysis-" + layer).click()
                assert await page.locator("#view-waveforms").get_attribute("data-analysis-layer") == layer
                assert await page.locator("#raw-wave").is_visible() == (layer == "whitebox")
                assert await page.locator(".stream-strip").is_visible()
                assert await page.locator("#indices-wave").is_visible()
                assert not await page.evaluate("document.documentElement.scrollWidth>innerWidth"), (width, layer)
                if width in (390, 1920):
                    await page.screenshot(path=str(out / f"waveforms-{layer}-{width}.png"), full_page=True)
            await page.close()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.context.grant_permissions(["local-network-access"], origin=base)
        page.on("pageerror", lambda error: errors.append(str(error)))
        config = json.loads((ROOT / "gateway/config.example.json").read_text(encoding="utf-8"))
        devices = [{"port": "COM77", "vid": 1155, "pid": 22336, "serialNumber": "A",
                    "location": "", "description": "Controlled QA adapter"},
                   {"port": "COM88", "vid": 1155, "pid": 22336, "serialNumber": "B",
                    "location": "", "description": "Controlled QA adapter"}]
        async def device_route(route):
            await route.fulfill(json={"config": config, "devices": devices, "bleDevices": [],
                                      "platform": "win32", "upstream": False})
        async def runtime_route(route):
            await route.fulfill(json={"schemaVersion": "music-therapy-runtime-v1",
                "gateway": "neural-resonance-gateway",
                "core": {"reachable": True, "eegSource": "none", "ports": {}},
                "devices": {"eeg": {"state": "waiting", "reason": "ambiguous-devices"}}})
        await page.route(base + "/api/gateway/devices", device_route)
        await page.route(base + "/api/runtime", runtime_route)
        await page.goto(base + "/#settings")
        await page.wait_for_function("document.querySelector('#gateway-eeg-select').options.length===3")
        await page.wait_for_function("document.querySelector('#gateway-message').textContent.includes('請選擇身份')")
        select = page.locator("#gateway-eeg-select")
        value = await select.locator("option").nth(1).get_attribute("value")
        await select.select_option(value)
        await page.wait_for_timeout(5500)  # Inventory poll must not erase an unsaved selection.
        assert await select.input_value() == value
        await page.unroute_all(behavior="wait")
        await page.goto(base + "/#worm")
        await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
        await page.locator("#research-worm [data-visual=music]").click()
        await page.wait_for_function("document.querySelector('[data-role=work]').options.length===2")
        media_count = 0
        for work_id, expected in [("6", 33), ("4040", 7)]:
            await page.locator("[data-role=work]").select_option(work_id)
            await page.wait_for_function(
                "count=>document.querySelector('[data-role=case]').options.length===count", arg=expected)
            media_count += await page.locator("[data-role=case] option").count()
        assert media_count == 40
        matches = {}
        for name in ("index.html", "neural-worm/app.mjs", "neural-worm/style.css", "src/gateway-settings.mjs",
                     "src/raw-waveform.mjs", "src/music-structure.mjs", "src/listening-experiment.mjs",
                     "src/temporal-scene.mjs", "neural-worm/planar-workbench.mjs", "neural-worm/planar.css",
                     "src/score-evidence.mjs", "neural-worm/score-workbench.mjs",
                     "public/research/chopin-score/op27-2-bars1-8.json", "docs/SCORE-EVIDENCE.html",
                     "public/research/chopin-curation.json", "docs/LISTENING-METHODS.html",
                     "public/research/vmus-reference-cases.json"):
            response = await page.request.get(base + "/" + name)
            assert response.ok
            matches[name] = hashlib.sha256(await response.body()).hexdigest() == hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        assert all(matches.values()), matches
        result = {"pass": True, "browser": browser.version, "layouts": layouts,
                  "nativeExecutableSha256": native_sha256,
                  "independentGateway": True, "actualFallbackPortLink": True,
                  "unsavedSelectionSurvivesPoll": True, "ambiguityMessage": True,
                  "analysisLayers": ["blackbox", "whitebox"], "captureStatusVisibleInBoth": True,
                  "servedHashes": matches, "errors": errors,
                  "chopinWorks": 2, "chopinMediaEntries": media_count,
                  "physicalHardwareVerified": False, "diagnosticFixtures": "controlled browser responses"}
        if live:
            response = await page.request.get(base + "/api/runtime")
            state = await response.json()
            result["liveRuntime"] = {"eegSource": state["core"]["eegSource"],
                "streams": state["core"]["streams"],
                "devices": {key: {"state": row.get("state"), "reason": row.get("reason")}
                            for key, row in state.get("devices", {}).items()}}
        assert not errors, errors
        (out / ("live-verification.json" if live else "verification.json")).write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--native")
    mode.add_argument("--url")
    asyncio.run(check(parser.parse_args()))
