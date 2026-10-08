"""Portable local acquisition; no laboratory paths, model services or credentials."""
import argparse
import asyncio
import copy
import json
import os
from pathlib import Path
import signal
import sys
import threading
import time
import webbrowser

from aiohttp import web, ClientSession, ClientTimeout
from bleak import BleakClient, BleakScanner
import serial
from serial.tools import list_ports

from acquisition import Stream, choose_port, inventory
from protocols import ThinkGear, oxygen, gsr

FROZEN = getattr(sys, "frozen", False)
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
DEFAULTS = json.loads((ROOT / "gateway/config.example.json").read_text(encoding="utf-8"))


def data_directory():
    override = os.environ.get("NEURAL_RESONANCE_DATA")
    if override:
        return Path(override).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/NeuralResonance"
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "NeuralResonance"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "neural-resonance"


def validate_config(value):
    config = copy.deepcopy(DEFAULTS)
    if not isinstance(value, dict):
        raise ValueError("Configuration must be an object")
    for key in config:
        if key in value:
            if isinstance(config[key], dict):
                if not isinstance(value[key], dict):
                    raise ValueError(f"{key} must be an object")
                config[key].update({k: v for k, v in value[key].items() if k in config[key]})
            else:
                config[key] = value[key]
    if type(config["port"]) is not int or not 1024 <= config["port"] <= 65535:
        raise ValueError("Port must be 1024–65535")
    if type(config["reuseLocalCore"]) is not bool:
        raise ValueError("reuseLocalCore must be boolean")
    for key in ("eeg", "bloodOxygen", "gsr"):
        profile = config[key]
        if type(profile["enabled"]) is not bool:
            raise ValueError(f"{key}.enabled must be boolean")
        for name in ("vid", "pid"):
            if profile[name] is not None and (type(profile[name]) is not int
                                            or not 0 <= profile[name] <= 65535):
                raise ValueError(f"{key}.{name} must be a USB identifier")
        if type(profile["baud"]) is not int or not 300 <= profile["baud"] <= 921600:
            raise ValueError(f"{key}.baud is invalid")
        for name in ("serialNumber", "location"):
            if not isinstance(profile[name], str) or len(profile[name]) > 256:
                raise ValueError(f"{key}.{name} is invalid")
    if type(config["ble"]["enabled"]) is not bool:
        raise ValueError("ble.enabled must be boolean")
    prefixes = config["ble"]["namePrefixes"]
    if not isinstance(prefixes, list) or not prefixes or not all(
            isinstance(p, str) and p and len(p) <= 128 for p in prefixes):
        raise ValueError("BLE requires nonempty name prefixes")
    for name in ("serviceUuid", "notifyUuid"):
        if not isinstance(config["ble"][name], str) or len(config["ble"][name]) > 128:
            raise ValueError("BLE UUID is invalid")
    if type(config["eeg"]["sampleRate"]) is not int or not 1 <= config["eeg"]["sampleRate"] <= 4096:
        raise ValueError("EEG sample rate is invalid")
    for name in ("dtr", "rts"):
        if type(config["eeg"][name]) is not bool:
            raise ValueError(f"EEG {name} must be boolean")
    return config


class Acquisition:
    def __init__(self, config):
        self.config = config
        self.stream = Stream(config["eeg"]["sampleRate"])
        self.stop_event = threading.Event()
        self.threads = []
        self.ble_task = None

    def serial_worker(self, key):
        profile = self.config[key]
        while not self.stop_event.is_set():
            handle = None
            try:
                ports = list(list_ports.comports())
                selected = choose_port(ports, profile)
                self.stream.status(key, port=selected, state="waiting",
                                   message="等待唯一匹配设备" if not selected else "正在打开")
                if not selected:
                    self.stop_event.wait(1)
                    continue
                handle = serial.Serial(port=None, baudrate=profile["baud"], timeout=0.2)
                if key == "eeg":
                    handle.dtr, handle.rts = profile["dtr"], profile["rts"]
                handle.port = selected
                handle.open()
                decoder, text = ThinkGear(), bytearray()
                last_check = last_bytes = time.monotonic()
                last_valid = last_bytes
                received = 0
                self.stream.status(key, state="open-waiting-data", bytes=0,
                                   message="端口已打开，等待有效数据")
                while not self.stop_event.is_set():
                    now = time.monotonic()
                    if now - last_check >= 1:
                        last_check = now
                        if choose_port(list(list_ports.comports()), profile) != selected:
                            raise ConnectionError("设备拔出、变号或身份不再唯一")
                    data = handle.read(min(handle.in_waiting, 4096) or 1)
                    valid = False
                    if data:
                        received += len(data)
                        last_bytes = time.monotonic()
                        if key == "eeg":
                            for fields, raw in decoder.feed(data):
                                valid |= self.stream.accept("usb", fields, raw)
                        else:
                            text.extend(data)
                            if len(text) > 8192:
                                text.clear()
                            while b"\n" in text:
                                line, _, remainder = text.partition(b"\n")
                                text = bytearray(remainder)
                                line = line.decode("utf-8", errors="replace").strip()
                                value = oxygen(line) if key == "bloodOxygen" else gsr(line)
                                if value is not None:
                                    if key == "bloodOxygen":
                                        self.stream.sensor("spo2", value[0])
                                        self.stream.sensor("pr", value[1])
                                    else:
                                        self.stream.sensor("gsr", value)
                                    valid = True
                                elif "probe error" in line.lower():
                                    self.stream.status(key, message="探头无有效信号")
                        self.stream.status(key, bytes=received)
                    if valid:
                        last_valid = time.monotonic()
                        self.stream.status(key, state="receiving", message="已收到有效协议数据")
                    if time.monotonic() - (last_valid if key == "eeg" else last_bytes) > 60:
                        raise TimeoutError("60秒无数据，重新识别设备")
            except Exception as error:
                self.stream.status(key, state="retrying", port="", message=str(error))
            finally:
                if handle:
                    try:
                        handle.close()
                    except Exception:
                        pass
                self.stream.status(key, port="")
            self.stop_event.wait(1)
        self.stream.status(key, state="stopped", port="")

    async def ble_worker(self):
        profile = self.config["ble"]
        while not self.stop_event.is_set():
            try:
                if (self.stream.last_usb is not None
                        and time.time() - self.stream.last_usb < 3):
                    self.stream.status("ble", state="standby", message="USB正在采集")
                    await asyncio.sleep(1)
                    continue
                self.stream.status("ble", state="scanning", message="扫描相容脑电设备")
                found = await BleakScanner.discover(timeout=5, return_adv=True)
                matches = []
                for device, advert in found.values():
                    name = advert.local_name or device.name or ""
                    if any(name.casefold().startswith(p.casefold()) for p in profile["namePrefixes"]):
                        matches.append((device, name))
                if len(matches) != 1:
                    self.stream.status("ble", state="waiting",
                                       message="未发现目标设备" if not matches else "多个同名设备，需要指定身份")
                    await asyncio.sleep(2)
                    continue
                device, name = matches[0]
                async with BleakClient(device, timeout=15) as client:
                    last_valid = [time.monotonic()]
                    decoders = {}

                    def notification(characteristic, data):
                        decoder = decoders.setdefault(str(characteristic.uuid), ThinkGear())
                        for fields, raw in decoder.feed(bytes(data)):
                            if self.stream.accept("desktop_ble", fields, raw):
                                last_valid[0] = time.monotonic()
                                self.stream.status("ble", state="receiving", message="收到有效协议数据")

                    targets = []
                    for service in client.services:
                        if profile["serviceUuid"] and service.uuid.casefold() != profile["serviceUuid"].casefold():
                            continue
                        for characteristic in service.characteristics:
                            if ("notify" in characteristic.properties
                                    and (not profile["notifyUuid"]
                                         or characteristic.uuid.casefold() == profile["notifyUuid"].casefold())):
                                targets.append(characteristic)
                    if not targets:
                        raise ValueError("未找到指定通知特征，请按设备文档配置UUID")
                    for characteristic in targets:
                        await client.start_notify(characteristic, notification)
                    self.stream.status("ble", state="connected-waiting-data",
                                       name=name, address=device.address, message="等待有效协议包")
                    while client.is_connected and not self.stop_event.is_set():
                        if self.stream.last_usb and time.time() - self.stream.last_usb < 3:
                            break
                        if time.monotonic() - last_valid[0] > 10:
                            raise TimeoutError("BLE没有有效协议数据，重新连接")
                        await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self.stream.status("ble", state="retrying", message=str(error))
                await asyncio.sleep(2)

    async def start(self):
        for key in ("eeg", "bloodOxygen", "gsr"):
            if self.config[key]["enabled"]:
                thread = threading.Thread(target=self.serial_worker, args=(key,), daemon=True)
                self.threads.append(thread)
                thread.start()
            else:
                self.stream.status(key, state="disabled", port="", message="未启用")
        if self.config["ble"]["enabled"]:
            self.ble_task = asyncio.create_task(self.ble_worker())

    async def stop(self):
        self.stop_event.set()
        if self.ble_task:
            self.ble_task.cancel()
            await asyncio.gather(self.ble_task, return_exceptions=True)
        for thread in self.threads:
            await asyncio.to_thread(thread.join, 2)


def allowed_origin(request):
    origin = request.headers.get("Origin")
    return not origin or origin in {
        f"http://127.0.0.1:{request.url.port}",
        f"http://localhost:{request.url.port}",
    }


def create_app(acquisition, config_path, upstream=None):
    app = web.Application(client_max_size=32768)
    sockets = set()

    async def health(_request):
        return web.json_response({"app": "neural-resonance-gateway", "version": "0.8.2",
                                  "standalone": True, "upstream": bool(upstream),
                                  "platform": sys.platform})

    async def runtime(_request):
        if upstream:
            async with app["client"].get(upstream + "/api/device/status") as response:
                state = await response.json()
            return web.json_response({
                "schemaVersion": "music-therapy-runtime-v1", "gateway": "core-proxy",
                "core": {"reachable": True, "eegSource": state["eeg_sources"]["active"],
                         "ports": {"brainlink": state["ports"]["brainlink"],
                                   "bloodOxygen": state["ports"]["blood_oxygen"]},
                         "streams": state["streams"]},
                "devices": state.get("receiver_diagnostics", {}),
            })
        return web.json_response(acquisition.stream.runtime())

    async def devices(_request):
        ports = await asyncio.to_thread(list_ports.comports)
        return web.json_response({"devices": inventory(ports), "config": acquisition.config,
                                  "platform": sys.platform, "upstream": bool(upstream)})

    async def save_config(request):
        if not allowed_origin(request):
            raise web.HTTPForbidden()
        try:
            change = await request.json()
            if not isinstance(change, dict):
                raise ValueError("Configuration must be an object")
            combined = copy.deepcopy(acquisition.config)
            for key, value in change.items():
                if isinstance(combined.get(key), dict) and isinstance(value, dict):
                    combined[key].update(value)
                else:
                    combined[key] = value
            updated = validate_config(combined)
        except (ValueError, TypeError):
            raise web.HTTPBadRequest(text="Invalid device configuration")
        config_path.parent.mkdir(parents=True, exist_ok=True)
        temp = config_path.with_suffix(".tmp")
        temp.write_text(json.dumps(updated, indent=2, ensure_ascii=False), encoding="utf-8")
        temp.replace(config_path)
        if not upstream:
            await acquisition.stop()
            acquisition.config = updated
            acquisition.stop_event = threading.Event()
            acquisition.threads = []
            acquisition.stream = Stream(updated["eeg"]["sampleRate"])
            await acquisition.start()
        else:
            acquisition.config = updated
        return web.json_response({"ok": True, "restartNeeded": updated["port"] != app["port"],
                                  "upstream": bool(upstream)})

    async def public_config(_request):
        return web.json_response({"startupMode": "live", "endpoint": "/ws/live",
                                  "autoConnect": True, "gatewayApi": True})

    async def live(request):
        if not allowed_origin(request):
            raise web.HTTPForbidden()
        socket = web.WebSocketResponse(heartbeat=20)
        await socket.prepare(request)
        sockets.add(socket)
        async def receive_close():
            async for _message in socket:
                pass
        reader = asyncio.create_task(receive_close())
        try:
            if upstream:
                async with app["client"].ws_connect(upstream + "/ws/live", heartbeat=20) as source:
                    async for message in source:
                        if message.type == web.WSMsgType.TEXT:
                            await asyncio.wait_for(socket.send_str(message.data), 5)
                        if socket.closed:
                            break
            else:
                cursor = 0
                while not socket.closed:
                    packet = acquisition.stream.snapshot(cursor)
                    await asyncio.wait_for(socket.send_json(packet), 5)
                    cursor = packet["rawSequence"]
                    await asyncio.sleep(0.5)
        except (asyncio.TimeoutError, ConnectionError, RuntimeError):
            pass
        finally:
            sockets.discard(socket)
            await socket.close()
            reader.cancel()
            await asyncio.gather(reader, return_exceptions=True)
        return socket

    async def static(request):
        name = request.match_info["path"] or "index.html"
        if not (name == "index.html" or name.startswith(("src/", "neural-worm/", "public/", "docs/"))):
            raise web.HTTPNotFound()
        target = (ROOT / name).resolve()
        if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
            raise web.HTTPNotFound()
        return web.FileResponse(target, headers={"Cache-Control": "no-cache"})

    async def startup(_app):
        app["client"] = ClientSession(timeout=ClientTimeout(total=5))
        if not upstream:
            await acquisition.start()

    async def cleanup(_app):
        await acquisition.stop()
        for socket in list(sockets):
            await socket.close()
        await app["client"].close()

    app["port"] = acquisition.config["port"]
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/runtime", runtime)
    app.router.add_get("/api/gateway/devices", devices)
    app.router.add_post("/api/gateway/config", save_config)
    app.router.add_get("/public/config.json", public_config)
    app.router.add_get("/ws/live", live)
    app.router.add_get("/{path:.*}", static)
    app.on_startup.append(startup)
    app.on_cleanup.append(cleanup)
    return app


async def run(args):
    directory = data_directory()
    directory.mkdir(parents=True, exist_ok=True)
    config_path = Path(args.config).resolve() if args.config else directory / "config.json"
    config = validate_config(json.loads(config_path.read_text(encoding="utf-8"))
                             if config_path.exists() else {})
    if args.port:
        config["port"] = args.port
    upstream = None
    async with ClientSession(timeout=ClientTimeout(total=2)) as client:
        if config["reuseLocalCore"] and not args.standalone:
            try:
                async with client.get("http://127.0.0.1:8002/api/device/status") as response:
                    state = await response.json()
                    if state.get("source") == "core" and state.get("mode") == "LIVE":
                        upstream = "http://127.0.0.1:8002"
            except Exception:
                pass
        for port in range(config["port"], min(65536, config["port"] + 10)):
            try:
                async with client.get(f"http://127.0.0.1:{port}/api/health",
                                      timeout=ClientTimeout(total=0.3)) as response:
                    health = await response.json()
                    if health.get("app") == "neural-resonance-gateway":
                        if not args.no_browser:
                            webbrowser.open(f"http://127.0.0.1:{port}/")
                        return
            except Exception:
                pass
    acquisition = Acquisition(config)
    app = create_app(acquisition, config_path, upstream)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    selected = None
    for port in range(config["port"], min(65536, config["port"] + 10)):
        try:
            site = web.TCPSite(runner, "127.0.0.1", port)
            await site.start()
            selected = port
            app["port"] = port
            break
        except OSError:
            continue
    if selected is None:
        await runner.cleanup()
        raise RuntimeError("本地端口均被占用")
    url = f"http://127.0.0.1:{selected}/"
    print(f"Neural Resonance {url} ({'existing core' if upstream else 'independent acquisition'})", flush=True)
    (directory / "runtime.json").write_text(json.dumps({"url": url, "pid": os.getpid()}), encoding="utf-8")
    if not args.no_browser:
        webbrowser.open(url)
    done = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, done.set)
        except NotImplementedError:
            signal.signal(sig, lambda *_args: done.set())
    try:
        await done.wait()
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config")
    parser.add_argument("--port", type=int)
    parser.add_argument("--standalone", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    try:
        asyncio.run(run(parser.parse_args()))
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(f"无法启动：{error}", file=sys.stderr)
        if FROZEN:
            data_directory().mkdir(parents=True, exist_ok=True)
            (data_directory() / "startup-error.txt").write_text(str(error), encoding="utf-8")
        raise SystemExit(1)
