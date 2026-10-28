"""Browser regression for annotation imports and console startup; opens no hardware."""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


async def verify(args):
    proof = {"checks": {}, "pageErrors": [], "consoleErrors": [], "consoleStartup": [],
             "consoleNavigation": [], "emptyDeviceState": [],
             "modelRequests": [], "mediaProbeRequests": [], "hardwareOpened": False}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        options = {"headless": True}
        if args.channel:
            options["channel"] = args.channel
        browser = await playwright.chromium.launch(**options)
        try:
            page = await browser.new_page(viewport={"width": 1366, "height": 768})
            page.on("pageerror", lambda error: proof["pageErrors"].append(str(error)))

            async def reject_model(route):
                proof["modelRequests"].append(route.request.url)
                await route.abort()

            await page.route("**/api/**", reject_model)
            await page.goto(args.url.rstrip("/") + "/#annotation")
            frame = page.frame_locator("#annotation-frame")
            await frame.locator("#level-articulation").wait_for()
            await page.locator("#annotation-connection").wait_for(state="hidden")
            source = {"schemaVersion": "music-prompt-input-v1",
                      "source": {"id": "retained-input", "kind": "music-annotation"},
                      "music": {"tempo": {"values": [60, 90, 120], "unit": "BPM"}}}
            await frame.locator("#observation-json").fill(json.dumps(source))

            async def generate():
                await frame.locator("#preview").click()
                await frame.locator("#download-json:not([disabled])").wait_for()

            for name, data in [("invalidFileClearsOutput", b"{broken"),
                               ("oversizeFileClearsOutput", b" " * 1048577)]:
                await generate()
                await frame.locator("#input-file").set_input_files({
                    "name": "input.json", "mimeType": "application/json", "buffer": data})
                await frame.locator("#operation-status.error").wait_for()
                proof["checks"][name] = (
                    await frame.locator("#download-json").is_disabled()
                    and await frame.locator("#prompt-en").input_value() == ""
                    and json.loads(await frame.locator("#observation-json").input_value()) == source)

            await generate()
            # Hold only this test page's file read to inspect its pending state.
            await frame.locator("body").evaluate("""() => {
                window.auditOriginalText = File.prototype.text;
                File.prototype.text = function () {
                    window.auditPendingFile = {name: this.name, size: this.size};
                    return new Promise(resolve => { window.auditFinishRead = resolve; });
                };
            }""")
            pending = {**source, "source": {"id": "completed-import", "kind": "music-annotation"}}
            await frame.locator("#input-file").set_input_files({
                "name": "pending.json", "mimeType": "application/json",
                "buffer": json.dumps(pending).encode()})
            proof["checks"]["pendingImportBlocksOldExport"] = (
                await frame.locator("#download-json").is_disabled()
                and await frame.locator("#preview").is_disabled()
                and await frame.locator("#prompt-en").input_value() == "")
            proof["pendingFile"] = await frame.locator("body").evaluate("() => window.auditPendingFile")
            await frame.locator("body").evaluate("""(_, text) => {
                File.prototype.text = window.auditOriginalText;
                window.auditFinishRead(text);
            }""", json.dumps(pending))
            await frame.locator("#metric-source").filter(has_text="completed-import").wait_for(timeout=5000)
            await generate()
            async with page.expect_download() as download:
                await frame.locator("#download-json").click()
            target = output.with_name(output.stem + "-result.json")
            await (await download.value).save_as(str(target))
            saved = json.loads(target.read_text(encoding="utf-8"))
            proof["checks"]["completedImportExportsNewSource"] = (
                saved["inputDocument"]["source"]["id"] == "completed-import"
                and saved["engine"] == "rules" and saved["model"] is None)

            await generate()
            async def reject_reference(route):
                await route.fulfill(status=503, body="test unavailable")
            await page.route("**/vmus-reference-cases.json", reject_reference)
            await frame.locator("#load-reference").click()
            await frame.locator("#operation-status.error").wait_for()
            proof["checks"]["failedReferenceClearsOutput"] = (
                await frame.locator("#download-json").is_disabled()
                and await frame.locator("#prompt-en").input_value() == "")

            # Use the real static config: live mode, no endpoint or auto-connect.
            async def unavailable_media(route):
                proof["mediaProbeRequests"].append(route.request.url)
                await route.fulfill(status=404, content_type="application/json",
                                    body='{"error":"No media proxy in static preview"}')

            for initial in ("settings", "waveforms", "worm"):
                console = await browser.new_page(viewport={"width": 1366, "height": 768})
                console.on("pageerror", lambda error: proof["consoleErrors"].append(str(error))
                           if len(proof["consoleErrors"]) < 10 else None)
                await console.route("**/api/**", reject_model)
                await console.route("**/api/research-media/**", unavailable_media)
                await console.goto(args.url.rstrip("/") + "/#" + initial)
                await console.wait_for_function(
                    "view => document.body.dataset.view === view", arg=initial, timeout=5000)
                # Observe more than one 100 ms update, not just the first paint.
                await console.wait_for_timeout(350)
                state = {"view": initial,
                         "attention": await console.locator("#read-attention").inner_text(),
                         "relaxation": await console.locator("#read-relaxation").inner_text(),
                         "packets": await console.locator("#monitor-packets").inner_text(),
                         "status": await console.locator("#status").get_attribute("data-state")}
                proof["emptyDeviceState"].append(state)
                assert state["attention"] == state["relaxation"] == "—"
                assert state["packets"] == "0" and state["status"] in ("waiting", "stopped")
                if initial == "settings":
                    for view in ("waveforms", "worm", "annotation", "settings"):
                        await console.locator(f'[data-view="{view}"]').click()
                        await console.locator(f"#view-{view}").wait_for(state="visible")
                        if view == "annotation":
                            await console.frame_locator("#annotation-frame").locator(
                                "#level-articulation").wait_for()
                        proof["consoleNavigation"].append(view)
                    assert (await console.locator("#count").inner_text()).split()[0] == "0"
                proof["consoleStartup"].append(initial)
                await console.close()
        except Exception as error:
            proof["failure"] = str(error)
            if "frame" in locals():
                proof["lastUiState"] = {
                    "source": await frame.locator("#metric-source").inner_text(),
                    "status": await frame.locator("#operation-status").inner_text(),
                    "input": await frame.locator("#observation-json").input_value(),
                }
            raise
        finally:
            await browser.close()
            proof["passed"] = (len(proof["checks"]) == 5 and all(proof["checks"].values())
                               and len(proof["consoleStartup"]) == 3
                               and len(proof["consoleNavigation"]) == 4
                               and not proof["pageErrors"] and not proof["consoleErrors"]
                               and not proof["modelRequests"])
            output.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(proof, ensure_ascii=False))
    if not proof["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:18767/")
    parser.add_argument("--channel")
    parser.add_argument("--output", default="artifacts/prompt-audit.json")
    asyncio.run(verify(parser.parse_args()))
