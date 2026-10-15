"""Edge status regression; controlled packets stay in disposable browser contexts."""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "artifacts/worm-academic-20261010/qa-python"))
from playwright.async_api import async_playwright

FILES = ("neural-worm/app.mjs", "neural-worm/style.css", "src/gateway-settings.mjs")


async def check(args):
    base = args.url.rstrip("/")
    out = ROOT / "artifacts/device-status-20261012"
    out.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(base + "/api/runtime", timeout=3) as response:
        runtime = json.load(response)
    core = runtime["core"]
    errors, layouts, cases, hashes = [], [], [], []

    async with async_playwright() as driver:
        browser = await driver.chromium.launch(channel="msedge", headless=True)

        async def new_page(width=1920, height=1080):
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.context.grant_permissions(["local-network-access"], origin=base)
            page.on("pageerror", lambda error: errors.append(str(error)))
            if args.source:
                async def source_route(route):
                    name = route.request.url.removeprefix(base + "/").split("?")[0]
                    await route.fulfill(body=(ROOT / name).read_bytes(),
                        content_type="text/css" if name.endswith(".css") else "text/javascript")
                for name in FILES:
                    await page.route(base + "/" + name, source_route)
            return page

        async def expect(page, text, state):
            await page.wait_for_function(
                "([text,state])=>{const e=document.querySelector('#status');"
                "return e.textContent===text&&e.dataset.state===state}",
                arg=[text, state], timeout=6000)
            return await page.locator("#status").evaluate(
                "e=>({text:e.textContent,state:e.dataset.state,color:getComputedStyle(e).color,"
                "dot:getComputedStyle(e,'::before').backgroundColor})")

        # This is the unmodified real service stream: no synthetic sensor packets.
        for width, height in [(320, 740), (390, 844), (768, 1024), (1366, 768),
                              (1920, 1080), (2560, 1440), (3840, 2160)]:
            page = await new_page(width, height)
            await page.goto(base + "/#waveforms")
            status = await expect(page, "等待腦電設備", "waiting")
            assert status["dot"] == "rgb(164, 165, 166)", status
            assert await page.locator("#read-attention").inner_text() == "—"
            assert await page.locator("#read-relaxation").inner_text() == "—"
            overflow = await page.evaluate("document.documentElement.scrollWidth>innerWidth")
            assert not overflow, width
            layouts.append({"width": width, "height": height, "overflow": overflow, **status})
            if width in (390, 1920):
                suffix = "source" if args.source else "live"
                await page.screenshot(path=str(out / f"{suffix}-waiting-{width}.png"))
                await page.locator("#status").screenshot(
                    path=str(out / f"{suffix}-status-{width}.png"))
            await page.close()

        # Controlled messages verify state transitions only; they are not capture evidence.
        page = await new_page()
        sockets = []
        await page.route_web_socket("**/ws/live", lambda socket: sockets.append(socket))
        await page.goto(base + "/#waveforms")
        for _ in range(100):
            if sockets:
                break
            await asyncio.sleep(.05)
        assert sockets
        socket = sockets[-1]
        counter = 0

        def packet(eeg=None, transport="usb", source="device", advance=True):
            nonlocal counter
            if advance:
                counter += 1
            return {"schemaVersion": "neural-resonance-live-v1", "source": source,
                    "transport": transport, "sessionId": "isolated-status-qa",
                    "ts": time.time(), "quality": {"eegPackets": counter},
                    "eeg": eeg if eeg is not None else
                        {"attention": 65, "meditation": 58, "poor_signal": 0}}

        socket.send(json.dumps(packet(transport="none", advance=False)))
        cases.append(await expect(page, "等待腦電設備", "waiting"))
        assert await page.locator("#read-attention").inner_text() == "—"
        assert await page.locator("#read-relaxation").inner_text() == "—"
        assert await page.locator("#signal-contact").inner_text() != "良好"
        socket.send(json.dumps(packet()))
        valid = await expect(page, "正在采集 · 指數有效", "valid")
        assert valid["dot"] == "rgb(183, 201, 196)", valid
        cases.append(valid)
        socket.send(json.dumps(packet(eeg={"poor_signal": 0})))
        cases.append(await expect(page, "正在采集 · 等待指數", "receiving"))
        socket.send(json.dumps(packet(eeg={"attention": 65, "meditation": 58, "poor_signal": 75})))
        cases.append(await expect(page, "接觸品質待確認", "warning"))
        socket.send(json.dumps(packet()))
        await expect(page, "正在采集 · 指數有效", "valid")
        for _ in range(8):
            await asyncio.sleep(.45)
            socket.send(json.dumps(packet(advance=False)))
        cases.append(await expect(page, "腦電資料中斷", "stale"))
        assert await page.locator("#read-attention").inner_text() == "—"
        socket.send(json.dumps(packet(transport="none", advance=False)))
        cases.append(await expect(page, "等待腦電設備", "waiting"))
        socket.send(json.dumps(packet()))
        await expect(page, "正在采集 · 指數有效", "valid")
        await socket.close()
        cases.append(await expect(page, "采集服務重連中", "waiting"))
        await page.locator("#disconnect").click()
        cases.append(await expect(page, "采集已停止", "waiting"))
        await page.locator("#demo").click()
        assert await page.locator("#status").inner_text() == "示範資料"
        assert await page.locator("#status").get_attribute("data-state") == "waiting"
        await page.close()
        await browser.close()

    if not args.source:
        for name in FILES:
            with urllib.request.urlopen(base + "/" + name, timeout=3) as response:
                actual = hashlib.sha256(response.read()).hexdigest()
            expected = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
            assert actual == expected, name
            hashes.append({"file": name, "sha256": actual, "sourceMatch": True})
    assert not errors, errors
    result = {"scope": "source-routed" if args.source else "deployed-live",
              "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
              "realService": {"eegSource": core.get("eegSource"),
                  "eegSamples": core.get("streams", {}).get("eeg", {}).get("samples"),
                  "spo2Samples": core.get("streams", {}).get("spo2", {}).get("samples"),
                  "devices": runtime.get("devices")},
              "layouts": layouts, "controlledStatusCases": cases,
              "servedHashes": hashes, "browserErrors": errors,
              "limitation": "Controlled packets are UI regression fixtures, not physical device verification."}
    path = out / ("source-browser.json" if args.source else "live-browser.json")
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Passed {result['scope']}: 7 viewports, {len(cases)} controlled transitions, {len(errors)} errors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8767")
    parser.add_argument("--source", action="store_true")
    asyncio.run(check(parser.parse_args()))
