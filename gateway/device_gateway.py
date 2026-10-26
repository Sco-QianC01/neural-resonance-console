"""Portable local acquisition; no laboratory paths, model services or credentials."""
import argparse
import asyncio
import copy
import json
import logging
import math
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
import webbrowser

from aiohttp import web, ClientSession, ClientTimeout, ClientError
from bleak import BleakClient, BleakScanner
from types import SimpleNamespace
import serial
from serial.tools import list_ports

from acquisition import Stream, choose_port, serial_selection, inventory, ble_candidates, ble_nearby
from protocols import ThinkGear, oxygen, gsr
from runtime_support import BUILD, InstanceLock, instance_id, write_runtime
from experiments import save_experiment, results_root
from watch import validate_watch, watch_worker
from eeg_recording import EEGSessionStore, short_device_name

FROZEN = getattr(sys, "frozen", False)


def recording_label(config, announced=None):
    """The name a new recording file carries.

    The stored label always wins: once an operator has named their recordings,
    swapping the cable or the radio must not rename them. Only when nothing is
    stored — a fresh install, or a label reset to the unknown-device fallback —
    does the connected hardware stand in.

    This lives in the collector, not in the page, because a Bluetooth link comes
    up by itself: `ble_worker` used to read `self.config["ble"]["deviceId"]`,
    which does not exist, so every Bluetooth session was filed as
    `eeg-unknown-device-*.tgam` while the same label was correct over USB.
    """
    stored = str((config.get("eeg") or {}).get("deviceId") or "").strip()
    if stored and stored != "unknown-device":
        return stored
    return short_device_name(announced) or stored


def asset_root(base, platform, frozen):
    """macOS bundles keep data in Resources and cross-link it from Frameworks."""
    root = Path(base)
    if frozen and platform == "darwin" and root.parent.name == "Contents":
        resources = root.parent / "Resources"
        if (resources / "index.html").is_file() and (resources / "gateway/config.example.json").is_file():
            return resources
    return root


ROOT = asset_root(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]), sys.platform, FROZEN)
DEFAULTS = json.loads((ROOT / "gateway/config.example.json").read_text(encoding="utf-8"))

# Bluetooth timings. A sighting stays usable for a while because advertising is
# not continuous: a device that answered one scan must still be connectable a few
# seconds later, when nothing is in the air.
BLE_SCAN_FRESH = 20.0
BLE_CONNECT_TIMEOUT = 10.0
BLE_NO_DATA_TIMEOUT = 20.0
BLE_RETRY_BASE = 1.0
BLE_RETRY_MAX = 8.0


def listening_scanner(callback):
    """A scanner that keeps running, instead of one built per scan cycle.

    Kept behind a named seam so the worker can be exercised without a radio.
    """
    return BleakScanner(detection_callback=callback)
CLIENT_KEY = web.AppKey("client", ClientSession)
CONTEXT_KEY = web.AppKey("context", dict)


def data_directory():
    override = os.environ.get("NEURAL_RESONANCE_DATA")
    if override:
        return Path(override).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/NeuralResonance"
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "NeuralResonance"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "neural-resonance"


BLUETOOTH_PROBE = (
    "import asyncio\n"
    "from bleak import BleakScanner\n"
    "asyncio.run(BleakScanner.discover(timeout=2, return_adv=True))\n"
)


def bluetooth_probe_command():
    """A frozen build cannot run -c, so it re-enters itself with a flag."""
    if FROZEN:
        return [sys.executable, "--bluetooth-probe"]
    return [sys.executable, "-c", BLUETOOTH_PROBE]


def bluetooth_permitted():
    """CoreBluetooth requires a usage description in the *responsible* app.

    macOS terminates a process that touches the framework without one (SIGABRT
    via TCC) instead of returning an error, and a denied permission yields an
    empty scan. Probing in a child process keeps the collector alive and turns
    both cases into a state the console can explain.
    """
    try:
        return subprocess.run(bluetooth_probe_command(), capture_output=True,
                              timeout=30).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def resolve_storage(config):
    """Return (directory, error). A chosen folder wins; otherwise EEG Data sits
    beside the project so it travels with the build."""
    chosen = (config.get("storage", {}).get("directory") or "").strip()
    candidates = [Path(chosen).expanduser()] if chosen else [ROOT / "EEG Data"]
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write-probe"
            probe.write_text("", encoding="utf-8")
            probe.unlink()
            return candidate, ""
        except OSError as error:
            message = str(error)
    if chosen:
        fallback = data_directory() / "EEG Data"
        try:
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback, message
        except OSError as error:
            return None, f"{message}; {error}"
    return None, message


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
        if key == "eeg" and (not isinstance(profile.get("deviceId", ""), str)
                             or len(profile.get("deviceId", "")) > 64):
            raise ValueError("eeg.deviceId is invalid")
    if type(config["ble"]["enabled"]) is not bool:
        raise ValueError("ble.enabled must be boolean")
    if type(config["acquisition"]["running"]) is not bool:
        raise ValueError("acquisition.running must be boolean")
    prefixes = config["ble"]["namePrefixes"]
    if not isinstance(prefixes, list) or not prefixes or not all(
            isinstance(p, str) and p and len(p) <= 128 for p in prefixes):
        raise ValueError("BLE requires nonempty name prefixes")
    for name in ("serviceUuid", "notifyUuid", "address", "name"):
        if not isinstance(config["ble"][name], str) or len(config["ble"][name]) > 128:
            raise ValueError("BLE identity is invalid")
    if type(config["eeg"]["sampleRate"]) is not int or not 1 <= config["eeg"]["sampleRate"] <= 4096:
        raise ValueError("EEG sample rate is invalid")
    for name in ("dtr", "rts"):
        if type(config["eeg"][name]) is not bool:
            raise ValueError(f"EEG {name} must be boolean")
    validate_watch(config["watch"])
    return config


class Acquisition:
    def __init__(self, config, data_directory=None, storage_error=""):
        self.config = config
        self.stream = Stream(config["eeg"]["sampleRate"])
        self.stop_event = threading.Event()
        self.threads = []
        self.ble_task = None
        self.watch_task = None
        # Set while the worker is being restarted; it leaves the scan loop
        # voluntarily so CoreBluetooth is released cleanly instead of cancelled
        # in the middle of a connection attempt.
        self.ble_halt = threading.Event()
        self.ble_permitted = None
        self.record_lock = threading.Lock()
        self.storage_directory = data_directory
        self.storage_state = "idle"
        self.storage_error = storage_error
        self.storage_file = ""
        self.storage_retry_at = 0.0
        self.recorder = EEGSessionStore(data_directory) if data_directory else None
        if self.recorder is None and not self.storage_error:
            self.storage_error = "No writable recording directory"
        if self.storage_error:
            self.storage_state = "error"

    @property
    def storage_ready(self):
        return self.recorder is not None and not self.storage_error

    @property
    def running(self):
        return bool(self.config.get("acquisition", {}).get("running"))

    def use_storage(self, data_directory, storage_error=""):
        """Re-point the recorder; called when the configuration changes."""
        with self.record_lock:
            if self.recorder is not None:
                try:
                    self.recorder.close()
                except OSError:
                    pass
            self.storage_directory = data_directory
            self.storage_error = storage_error
            self.recorder = EEGSessionStore(data_directory) if data_directory else None
            if self.recorder is None and not self.storage_error:
                self.storage_error = "No writable recording directory"
            self.storage_state = "error" if self.storage_error else "idle"
            self.storage_file = ""

    def save_eeg_bytes(self, device_id, data, transport, connection):
        if self.recorder is None or not data:
            return
        with self.record_lock:
            try:
                self.recorder.append_raw(device_id, data, transport=transport,
                    session_id=f"{self.stream.session_id}-{connection}",
                    sample_rate=self.config["eeg"]["sampleRate"],
                    baud_rate=self.config["eeg"]["baud"] if transport == "usb" else None)
                self.storage_state = "saved"
                self.storage_error = ""
                self.storage_file = str(self.recorder.path or self.recorder.last_path or "")
                self.stream.status("eeg", storagePath=self.storage_file, storageState="saved")
            except (OSError, TypeError, ValueError) as error:
                self.storage_state = "error"
                self.storage_error = str(error)
                self.storage_retry_at = time.monotonic() + 10
                self.stream.status("eeg", storageState="error", storageError=self.storage_error)
                logging.getLogger("neural-resonance").error("Raw EEG auto-save failed: %s", error)

    def save_external_packet(self, device_id, packet):
        if self.recorder is None or not isinstance(packet, dict):
            return
        if (packet.get("schemaVersion") != "neural-resonance-live-v1"
                or packet.get("source") not in ("device", "core")
                or packet.get("transport") not in ("usb", "ble", "desktop_ble", "browser_usb", "browser_ble")
                or type(packet.get("ts")) not in (int, float)
                or not math.isfinite(packet["ts"])):
            return
        self.storage_state = "unavailable"
        self.storage_error = "Upstream supplied decoded packets without original EEG bytes"
        self.stream.status("eeg", storageState="unavailable", storageError=self.storage_error)

    def close_recording(self, transport=None):
        if not self.recorder:
            return
        with self.record_lock:
            try:
                self.recorder.close(transport)
            except OSError as error:
                self.storage_state = "error"
                self.storage_error = str(error)
                self.stream.status("eeg", storageState="error", storageError=self.storage_error)
                logging.getLogger("neural-resonance").error("EEG auto-save close failed: %s", error)

    def serial_worker(self, key):
        profile = self.config[key]
        stop_event, stream = self.stop_event, self.stream
        reconnects = 0
        while not stop_event.is_set():
            handle, connection = None, None
            try:
                ports = list(list_ports.comports())
                selected, reason, count = serial_selection(ports, profile)
                # Identifying a device is not consent to stream it: the operator
                # presses Start Acquisition before any port is opened.
                if not self.running:
                    stream.status(key, port=selected,
                                   state="ready" if selected else "waiting",
                                   reason="awaiting-start" if selected else reason,
                                   candidates=count, reconnects=reconnects,
                                   message="已识别，等待开始" if selected else "等待唯一匹配设备")
                    stop_event.wait(1)
                    continue
                stream.status(key, port=selected, state="waiting", reason=reason,
                                   candidates=count, reconnects=reconnects,
                                   message="等待唯一匹配设备" if not selected else "正在打开")
                if not selected:
                    stop_event.wait(1)
                    continue
                handle = serial.Serial(port=None, baudrate=profile["baud"], timeout=0.2)
                if key == "eeg":
                    handle.dtr, handle.rts = profile["dtr"], profile["rts"]
                handle.port = selected
                # The cable's own name, for the same reason as Bluetooth: a label
                # that was never stored still has to name the file. getattr keeps
                # this working for port stubs that only carry the identity fields.
                announced = next((getattr(port, "description", "") for port in ports
                                  if port.device == selected), "")
                handle.open()
                if stop_event.is_set():
                    break
                if key == "eeg":
                    connection = stream.new_connection("usb")
                decoder, text = ThinkGear(), bytearray()
                last_check = last_valid = time.monotonic()
                received = 0
                stream.status(key, state="open-waiting-data", reason="waiting-data",
                                   bytes=0, validPackets=0, protocolErrors=0,
                                   message="端口已打开，等待有效数据")
                while not stop_event.is_set():
                    now = time.monotonic()
                    # Stop means stop: an open port keeps streaming and recording
                    # until the session is closed, so the run flag is checked here
                    # too, not just before connecting.
                    if not self.running:
                        break
                    if now - last_check >= 1:
                        last_check = now
                        if choose_port(list(list_ports.comports()), profile) != selected:
                            raise ConnectionError("设备拔出、变号或身份不再唯一")
                    data = handle.read(min(handle.in_waiting, 4096) or 1)
                    if stop_event.is_set():
                        break
                    valid = False
                    if data:
                        received += len(data)
                        if key == "eeg":
                            self.save_eeg_bytes(recording_label(self.config, announced), data, "usb", connection)
                            for fields, raw, errors in decoder.feed(data):
                                accepted = stream.accept("usb", fields, raw, connection=connection,
                                                         protocol_errors=errors)
                                valid |= accepted
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
                                        stream.sensor("spo2", value[0])
                                        if not self.config["watch"]["enabled"]:
                                            stream.sensor("pr", value[1])
                                    else:
                                        stream.sensor("gsr", value)
                                    valid = True
                                elif "probe error" in line.lower():
                                    stream.clear_sensor("spo2")
                                    stream.clear_sensor("pr", source="bloodOxygen")
                                    stream.status(key, message="探头无有效信号")
                        stream.status(key, bytes=received, protocolErrors=decoder.errors,
                                           validPackets=decoder.valid_frames if key == "eeg" else None)
                    if valid:
                        last_valid = time.monotonic()
                        stream.status(key, state="receiving", reason="valid-protocol",
                                           message="已收到有效协议数据")
                    elif time.monotonic() - last_valid > 3:
                        stream.status(key, state="open-waiting-data",
                                           reason="invalid-protocol" if received else "waiting-data",
                                           message="有字节但未收到有效协议包" if received else "设备未发送数据")
                    if time.monotonic() - last_valid > 60:
                        raise TimeoutError("60秒无有效协议数据，重新识别设备")
            except Exception as error:
                reconnects += 1
                message = str(error)
                reason = ("access-or-port-busy" if isinstance(error, PermissionError)
                          or any(word in message.lower() for word in
                                 ("access is denied", "permission denied", "resource busy"))
                          else "disconnected-or-read-error")
                stream.status(key, state="retrying", port="", reason=reason,
                                   reconnects=reconnects, message=message)
            finally:
                if connection is not None:
                    stream.end_connection("usb", connection)
                    self.close_recording("usb")
                if key == "bloodOxygen":
                    stream.clear_sensor("spo2")
                    stream.clear_sensor("pr", source="bloodOxygen")
                elif key == "gsr":
                    stream.clear_sensor("gsr")
                if handle:
                    try:
                        handle.close()
                    except Exception:
                        pass
                stream.status(key, port="")
            stop_event.wait(1)
        stream.status(key, state="stopped", port="")

    async def ble_worker(self):
        stop_event, stream = self.stop_event, self.stream
        # Probing spawns a child process: macOS aborts the *calling* process when
        # it has no Bluetooth usage description, so a granted permission is worth
        # remembering for the life of the collector instead of paying for it again
        # every time the picker is re-pointed.
        if self.ble_permitted is None:
            if await asyncio.to_thread(bluetooth_permitted):
                self.ble_permitted = True
        if not self.ble_permitted:
            stream.status("ble", state="blocked", reason="bluetooth-permission",
                          message="系统未授权蓝牙访问，采集器已跳过扫描")
            return

        # One scanner for the life of the worker, not one per cycle. Rebuilding it
        # reset CoreBluetooth every few seconds: a fresh central manager reports
        # nothing for the first moment, so a headset that was there a second ago
        # vanished from the list, and Start only connected when the scan happened
        # to be warm. A persistent scanner keeps the peripheral handles cached and
        # the match is available on the next tick.
        seen = {}

        def detected(device, advert):
            name = (getattr(advert, "local_name", "")
                    or getattr(device, "name", "") or "").strip()
            seen[device.address] = (device, name, time.monotonic())

        scanner = None
        attempts = 0
        try:
            while not stop_event.is_set() and not self.ble_halt.is_set():
                connection = None
                try:
                    if scanner is None:
                        scanner = listening_scanner(detected)
                        await scanner.start()
                        stream.status("ble", state="scanning", reason="scanning",
                                      message="扫描相容脑电设备")
                    # A cable that is actually streaming owns the recording; the
                    # radio would otherwise fight it for the same file.
                    if (stream.last_usb is not None
                            and time.time() - stream.last_usb < 3):
                        stream.status("ble", state="standby", reason="usb-active",
                                      message="USB正在采集")
                        await asyncio.sleep(0.5)
                        continue
                    profile = self.config["ble"]
                    now = time.monotonic()
                    # The scanner accumulates; a sighting older than this window
                    # is a device that has left, not one that is still around.
                    for address in [key for key, row in seen.items()
                                    if now - row[2] > BLE_SCAN_FRESH]:
                        seen.pop(address, None)
                    found = {address: (row[0], SimpleNamespace(local_name=row[1]))
                             for address, row in seen.items()}
                    nearby = ble_nearby(found)
                    matches = ble_candidates(found, profile)
                    stream.status("ble", nearby=nearby, scanned=len(found), candidates=[
                        {"name": name, "address": device.address} for device, name in matches])
                    if len(matches) != 1:
                        # Separate "nothing is advertising" from "something is, but
                        # not the saved identity": the two need different fixes.
                        reason = ("ambiguous-devices" if matches else
                                  "device-not-found" if not nearby else
                                  "saved-device-missing" if profile.get("address") else
                                  "name-not-matched")
                        stream.status("ble", state="waiting", reason=reason,
                                      message="未发现目标设备" if not matches else "多个同名设备，需要指定身份")
                        await asyncio.sleep(0.5)
                        continue
                    device, name = matches[0]
                    # Scanning identifies the device; connecting waits for Start.
                    if not self.running:
                        stream.status("ble", state="ready", reason="awaiting-start",
                                      name=name, address=device.address,
                                      message="已识别，等待开始")
                        # A short tick rather than a fixed nap: Start is a user
                        # action, and waiting for it must not look like a freeze.
                        await asyncio.sleep(0.2)
                        continue
                    # Naming the phase is what makes an occasional failure
                    # diagnosable: "scanning" while a connect is in flight reads
                    # as if the button did nothing.
                    stream.status("ble", state="connecting", reason="connecting",
                                  name=name, address=device.address,
                                  message="正在连接蓝牙设备")
                    async with BleakClient(device, timeout=BLE_CONNECT_TIMEOUT) as client:
                        if stop_event.is_set() or self.ble_halt.is_set() or not self.running:
                            continue
                        connection = stream.new_connection("desktop_ble")
                        last_packet = [time.monotonic()]
                        last_valid = [time.monotonic()]
                        decoders = {}
                        # Byte and frame totals are published for diagnosis (the
                        # panel no longer prints them): USB fills them in its read
                        # loop, and the radio used to publish none, so any reader
                        # of /api/runtime saw zero for a healthy wireless link.
                        counters = {"bytes": 0, "packets": 0, "errors": 0}

                        def notification(characteristic, data, token=connection,
                                         decoders=decoders, last_valid=last_valid,
                                         last_packet=last_packet, announced=name,
                                         counters=counters):
                            # Any traffic proves the link is alive; only a valid
                            # frame proves the protocol is. They are different
                            # failures and must not share a timeout.
                            last_packet[0] = time.monotonic()
                            counters["bytes"] += len(data)
                            self.save_eeg_bytes(recording_label(self.config, announced),
                                                bytes(data), "desktop_ble", token)
                            decoder = decoders.setdefault(str(characteristic.uuid), ThinkGear())
                            accepted = False
                            for fields, raw, errors in decoder.feed(bytes(data)):
                                total_errors = errors + sum(d.errors for d in decoders.values() if d is not decoder)
                                if stream.accept("desktop_ble", fields, raw, connection=token, protocol_errors=total_errors):
                                    accepted = True
                            counters["packets"] = sum(d.valid_frames
                                                      for d in decoders.values())
                            counters["errors"] = sum(d.errors for d in decoders.values())
                            if accepted:
                                last_valid[0] = time.monotonic()
                                stream.status("ble", state="receiving", reason="valid-protocol",
                                              bytes=counters["bytes"], validPackets=counters["packets"],
                                              protocolErrors=counters["errors"],
                                              message="收到有效协议数据")

                        candidates = []
                        for service in client.services:
                            if profile["serviceUuid"] and service.uuid.casefold() != profile["serviceUuid"].casefold():
                                continue
                            for characteristic in service.characteristics:
                                if ("notify" in characteristic.properties
                                        and (not profile["notifyUuid"]
                                             or characteristic.uuid.casefold() == profile["notifyUuid"].casefold())):
                                    candidates.append(characteristic)
                        if not candidates:
                            raise ValueError("未找到指定通知特征，请按设备文档配置UUID")
                        # One stream, chosen deterministically. Subscribing to every
                        # notify characteristic of a multi-service device delivered
                        # duplicate bytes, which the decoder reports as protocol
                        # errors and which made a working link look broken.
                        def preference(characteristic):
                            uuid = characteristic.uuid.casefold()
                            if profile["notifyUuid"] and uuid == profile["notifyUuid"].casefold():
                                return 0
                            return 1 if "ffe1" in uuid else 2
                        target = sorted(candidates, key=preference)[0]
                        stream.status("ble", state="connected-waiting-data", reason="waiting-data",
                                      name=name, address=device.address, notify=target.uuid,
                                      bytes=0, validPackets=0, protocolErrors=0,
                                      message="等待有效协议包")
                        await client.start_notify(target, notification)
                        quiet = False
                        while (client.is_connected and not stop_event.is_set()
                               and not self.ble_halt.is_set()):
                            if not self.running:
                                break
                            if (stream.last_usb_monotonic is not None
                                    and time.monotonic() - stream.last_usb_monotonic < 3):
                                break
                            now = time.monotonic()
                            # Bytes can arrive without a single valid frame (wrong
                            # protocol, or a partial header). Publishing on the
                            # tick keeps "received bytes" honest without a status
                            # write per notification.
                            if counters["bytes"]:
                                stream.status("ble", bytes=counters["bytes"],
                                              validPackets=counters["packets"],
                                              protocolErrors=counters["errors"])
                            if now - last_packet[0] > BLE_NO_DATA_TIMEOUT:
                                raise TimeoutError(
                                    f"蓝牙已连接但 {int(BLE_NO_DATA_TIMEOUT)} 秒没有收到数据")
                            if now - last_valid[0] > 8 and not quiet:
                                quiet = True
                                stream.status("ble", state="connected-waiting-data",
                                              reason="invalid-protocol",
                                              message="已连上，但数据不是 ThinkGear 协议")
                            await asyncio.sleep(0.5)
                except asyncio.CancelledError:
                    raise
                except Exception as error:
                    # Backing off matters more than retrying fast: CoreBluetooth
                    # needs a moment to release a failed peripheral, and hammering
                    # it is what turned one bad attempt into a run of bad ones.
                    attempts += 1
                    delay = min(BLE_RETRY_BASE * 2 ** (attempts - 1), BLE_RETRY_MAX)
                    stream.status("ble", state="retrying", reason="connect-failed",
                                  message=str(error), attempt=attempts,
                                  retryIn=round(delay, 1))
                    await asyncio.sleep(delay)
                else:
                    attempts = 0
                finally:
                    if connection is not None:
                        stream.end_connection("desktop_ble", connection)
                        self.close_recording("desktop_ble")
        finally:
            if scanner is not None:
                try:
                    await scanner.stop()
                except Exception:
                    pass

    async def start(self):
        for key in ("eeg", "bloodOxygen", "gsr"):
            if self.config[key]["enabled"]:
                thread = threading.Thread(target=self.serial_worker, args=(key,), daemon=True)
                self.threads.append(thread)
                thread.start()
            else:
                self.stream.status(key, state="disabled", port="", message="未启用")
        if self.config["ble"]["enabled"]:
            self.ble_halt.clear()
            self.ble_task = asyncio.create_task(self.ble_worker())
        if self.config["watch"]["enabled"]:
            self.watch_task = asyncio.create_task(watch_worker(self.config["watch"], self.stream))
        else:
            self.stream.status("watch", state="disabled", message="未启用")

    async def stop(self):
        self.stop_event.set()
        self.ble_halt.set()
        if self.ble_task:
            self.ble_task.cancel()
            await asyncio.gather(self.ble_task, return_exceptions=True)
        if self.watch_task:
            self.watch_task.cancel()
            await asyncio.gather(self.watch_task, return_exceptions=True)
            self.watch_task = None
        for thread in self.threads:
            await asyncio.to_thread(thread.join, 2)
        self.close_recording()

    async def restart_bluetooth(self):
        """Re-point or drop the Bluetooth task while keeping what it discovered.

        The picker is fed from this stream, so tearing the stream down to change
        an address would erase the device list the operator is looking at.

        The old task is asked to leave rather than cancelled outright: CoreBluetooth
        keeps a half-open attempt around when a connection is cancelled mid-flight,
        and the next attempt then fails for reasons that have nothing to do with
        the device. Cancelling stays as the last resort for a worker stuck inside
        a connection timeout.
        """
        task = self.ble_task
        if task:
            self.ble_halt.set()
            try:
                await asyncio.wait_for(asyncio.shield(task), 4)
            except asyncio.TimeoutError:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            except Exception:
                # The worker reports its own failures; a broken one must not turn
                # saving a setting into an HTTP 500.
                await asyncio.gather(task, return_exceptions=True)
            self.ble_task = None
        self.ble_halt = threading.Event()
        if self.config["ble"]["enabled"] and not self.stop_event.is_set():
            self.ble_task = asyncio.create_task(self.ble_worker())
        else:
            self.stream.status("ble", state="disabled", reason="disabled", message="未启用")


def allowed_origin(request):
    origin = request.headers.get("Origin")
    return not origin or origin in {
        f"http://127.0.0.1:{request.url.port}",
        f"http://localhost:{request.url.port}",
    }


def create_app(acquisition, config_path, upstream=None, instance=None):
    app = web.Application(client_max_size=16*1024*1024)
    sockets = set()
    config_lock = asyncio.Lock()

    async def health(_request):
        return web.json_response({"app": "neural-resonance-gateway", "version": "0.11.6",
                                  "standalone": True, "upstream": bool(upstream),
                                  "platform": sys.platform, "build": BUILD,
                                  "instanceId": instance})

    async def runtime(_request):
        if upstream:
            async with app[CLIENT_KEY].get(upstream + "/api/device/status") as response:
                state = await response.json()
            return web.json_response({
                "schemaVersion": "music-therapy-runtime-v1", "gateway": "core-proxy",
                "core": {"reachable": True, "eegSource": state["eeg_sources"]["active"],
                         "ports": {"brainlink": state["ports"]["brainlink"],
                                   "bloodOxygen": state["ports"]["blood_oxygen"]},
                         "streams": state["streams"]},
                "devices": state.get("receiver_diagnostics", {}),
                "storage": {
                    "state": acquisition.storage_state, "error": acquisition.storage_error,
                    "directory": str(acquisition.recorder.directory) if acquisition.recorder else "",
                    "file": acquisition.storage_file,
                },
            })
        state = acquisition.stream.runtime()
        # Start/stop is a separate fact from "is a device identified": the console
        # must be able to say 采集已停止 instead of reporting the last device state.
        state["acquisition"] = {"running": acquisition.running}
        state["storage"] = {
            "state": acquisition.storage_state,
            "error": acquisition.storage_error,
            "directory": str(acquisition.recorder.directory) if acquisition.recorder else "",
            "file": str(acquisition.recorder.path) if acquisition.recorder and acquisition.recorder.path else "",
        }
        return web.json_response(state)

    async def devices(_request):
        ports = await asyncio.to_thread(list_ports.comports)
        with acquisition.stream.lock:
            ble=acquisition.stream.devices.get("ble", {})
            ble_devices=copy.deepcopy(ble.get("candidates", []))
            # Everything the adapter heard, matched or not, plus the worker's own
            # state: without it an empty picker is indistinguishable from a
            # worker that never started, or a radio that is switched off.
            ble_nearby_devices=copy.deepcopy(ble.get("nearby", []))
            ble_status={key: ble.get(key) for key in
                        ("state", "reason", "message", "scanned", "attempt",
                         "retryIn", "notify", "address", "name")}
        return web.json_response({"devices": inventory(ports), "bleDevices": ble_devices,
                                  "bleNearby": ble_nearby_devices, "bleStatus": ble_status,
                                  "config": acquisition.config,
                                  "storage": {"directory": str(acquisition.storage_directory or ""),
                                              "ready": acquisition.storage_ready,
                                              "error": acquisition.storage_error},
                                  "platform": sys.platform, "upstream": bool(upstream)})

    async def refresh_devices(_request):
        """Release the radio and scan again, without reloading the page.

        A Bluetooth session that has gone quiet leaves CoreBluetooth holding a
        half-open attempt; a browser reload fixed it only because the collector
        dropped that attempt on the way out. This does the same thing on request:
        the worker leaves voluntarily (see `restart_bluetooth`) and a fresh one
        rebuilds the scanner. It is a repair action, not a configuration change —
        the saved identity is what gets scanned for.
        """
        if not allowed_origin(_request):
            raise web.HTTPForbidden()
        if upstream:
            return web.json_response({"refreshed": False, "reason": "upstream"})
        # Restarting the worker ends the current session and opens a new file on
        # reconnect, so it must not happen to a link that is delivering data.
        # The case this button exists for — a radio that is stuck — is exactly a
        # link that is *not* receiving, so the guard costs nothing.
        with acquisition.stream.lock:
            receiving = acquisition.stream.devices.get("ble", {}).get("state") == "receiving"
        if receiving:
            return web.json_response({"refreshed": False, "reason": "receiving"})
        # Serialised with configuration writes: two restarts at once would leave
        # one worker without a task reference to shut down.
        async with config_lock:
            await acquisition.restart_bluetooth()
        return web.json_response({"refreshed": True})

    async def save_config(request):
        if not allowed_origin(request):
            raise web.HTTPForbidden()
        async with config_lock:
            return await apply_config(request)

    async def apply_config(request):
        if request.content_length and request.content_length > 32768:
            raise web.HTTPRequestEntityTooLarge(max_size=32768, actual_size=request.content_length)
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
        previous = copy.deepcopy(acquisition.config)
        previous["eeg"].pop("deviceId", "")
        updated_without_id = copy.deepcopy(updated)
        updated_without_id["eeg"].pop("deviceId", "")
        # Only a serial identity change forces the workers (and the counters they
        # publish) to start over. Starting, stopping, saving an identity or
        # re-pointing Bluetooth must not: replacing the stream is what made the
        # Bluetooth picker go blank the moment acquisition started.
        devices_changed = any(updated_without_id.get(key) != previous.get(key)
                              for key in ("eeg", "bloodOxygen", "gsr"))
        # A display name is not an identity: renaming a saved device must not tear
        # down a live Bluetooth session.
        ble_identity = {key: value for key, value in updated["ble"].items() if key != "name"}
        previous_ble = {key: value for key, value in previous["ble"].items() if key != "name"}
        ble_changed = ble_identity != previous_ble
        if not upstream:
            if updated.get("storage", {}) != previous.get("storage", {}):
                directory, error = resolve_storage(updated)
                acquisition.use_storage(directory, error)
            if devices_changed:
                await acquisition.stop()
                acquisition.config = updated
                acquisition.stop_event = threading.Event()
                acquisition.threads = []
                acquisition.stream = Stream(updated["eeg"]["sampleRate"])
                acquisition.record_cursor = 0
                await acquisition.start()
            else:
                acquisition.config = updated
                # Start/stop is a flag both workers read on every loop; Bluetooth
                # additionally needs its task added, dropped or re-pointed.
                if ble_changed:
                    await acquisition.restart_bluetooth()
        else:
            acquisition.config = updated
        return web.json_response({"ok": True, "restartNeeded": updated["port"] != app[CONTEXT_KEY]["port"],
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
        async def transmit():
            if upstream:
                async with app[CLIENT_KEY].ws_connect(upstream + "/ws/live", heartbeat=20) as source:
                    async for message in source:
                        if message.type == web.WSMsgType.TEXT:
                            try:
                                acquisition.save_external_packet(
                                    acquisition.config["eeg"].get("deviceId", ""), json.loads(message.data))
                            except (json.JSONDecodeError, TypeError, ValueError) as error:
                                logging.getLogger("neural-resonance").warning(
                                    "Upstream EEG packet was not saved: %s", error)
                            await asyncio.wait_for(socket.send_str(message.data), 5)
                        if socket.closed:
                            break
            else:
                cursor, session, backfill = 0, None, True
                while not socket.closed:
                    stream = acquisition.stream
                    if stream.session_id != session:
                        session, cursor, backfill = stream.session_id, 0, True
                    packet = stream.snapshot(cursor, backfill=backfill)
                    backfill = False
                    await asyncio.wait_for(socket.send_json(packet, dumps=lambda value: json.dumps(value, allow_nan=False)), 5)
                    cursor = packet["rawSequence"]
                    await asyncio.sleep(0.1)
        sender = asyncio.create_task(transmit())
        try:
            done, _pending = await asyncio.wait({reader, sender}, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except (asyncio.TimeoutError, ConnectionError, RuntimeError, ClientError):
            pass
        finally:
            sockets.discard(socket)
            await socket.close()
            reader.cancel()
            sender.cancel()
            await asyncio.gather(reader, sender, return_exceptions=True)
        return socket

    async def export_experiment(request):
        if not allowed_origin(request):
            raise web.HTTPForbidden()
        try:
            value = await request.json()
            directory = await asyncio.to_thread(save_experiment, value, results_root(Path(config_path).parent))
            return web.json_response({"directory": str(directory), "saved": True})
        except (ValueError, TypeError, AttributeError) as error:
            return web.json_response({"error": str(error)}, status=400)
        except OSError:
            return web.json_response({"error": "本机结果目录无法写入；数据仍保留在页面，可重试。"}, status=500)

    async def research_media(request):
        recording = request.match_info["recording"]
        if recording not in ("c27_fou1978", "c27_barenboim1981", "c27_langlang2003", "c9_yundili2004"):
            raise web.HTTPNotFound()
        target = (results_root(Path(config_path).parent)
                  / "20261014_神经蠕虫录音修订/音乐资料/音频" / (recording + ".mp3"))
        if not target.is_file():
            raise web.HTTPNotFound()
        return web.FileResponse(target, headers={"Content-Type": "audio/mpeg",
                                "X-Content-Type-Options": "nosniff"})

    async def static(request):
        name = request.match_info["path"] or "index.html"
        if not (name == "index.html" or name.startswith(("src/", "neural-worm/", "public/", "docs/"))):
            raise web.HTTPNotFound()
        target = (ROOT / name).resolve()
        if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
            raise web.HTTPNotFound()
        types = {".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                 ".mjs": "text/javascript", ".md": "text/plain", ".txt": "text/plain",
                 ".json": "application/json", ".svg": "image/svg+xml", ".krn": "text/plain"}
        headers = {"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"}
        if target.suffix.lower() in types:
            headers["Content-Type"] = types[target.suffix.lower()] + "; charset=utf-8"
        return web.FileResponse(target, headers=headers)

    async def startup(_app):
        app[CLIENT_KEY] = ClientSession(timeout=ClientTimeout(total=5))
        if not upstream:
            await acquisition.start()

    async def cleanup(_app):
        await acquisition.stop()
        for socket in list(sockets):
            await socket.close()
        await app[CLIENT_KEY].close()

    app[CONTEXT_KEY] = {"port": acquisition.config["port"]}
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/runtime", runtime)
    app.router.add_get("/api/gateway/devices", devices)
    app.router.add_post("/api/gateway/config", save_config)
    app.router.add_post("/api/gateway/refresh", refresh_devices)
    app.router.add_post("/api/experiments", export_experiment)
    app.router.add_get("/api/research-media/{recording}", research_media)
    app.router.add_get("/public/config.json", public_config)
    app.router.add_get("/ws/live", live)
    app.router.add_get("/{path:.*}", static)
    app.on_startup.append(startup)
    app.on_cleanup.append(cleanup)
    return app


GATEWAY_SOURCES = ("device_gateway.py", "acquisition.py", "protocols.py",
                   "eeg_recording.py", "experiments.py", "runtime_support.py")


def newest_source_mtime(root=None):
    """When the gateway code on disk last changed.

    The build string cannot answer this: it is a hand-written constant, so it
    kept reading `portable-20261017-eeg-autosave-v1` while the gateway around it
    changed every day. Single-instance reuse then happily served the old
    process, and the only symptom was a route answering 405 — a method error
    from the static catch-all, for an endpoint that exists only in the file.
    """
    root = Path(root or Path(__file__).resolve().parent)
    latest = 0.0
    for name in GATEWAY_SOURCES:
        try:
            latest = max(latest, (root / name).stat().st_mtime)
        except OSError:
            continue
    return latest


def started_before_sources(state, root=None):
    """True when the running instance predates the code this launch would run.

    `runtime.json` is rewritten at startup, so its `updatedAt` *is* the start
    time: no new field, and it works for instances started by older code. A
    one-second grace keeps a launch from calling itself stale.
    """
    try:
        started = float(state.get("updatedAt") or 0)
    except (TypeError, ValueError):
        started = 0.0
    if not started:
        return False
    return newest_source_mtime(root) > started + 1


async def replace_stale_instance(client, state, url):
    """Stop an instance that predates the code on disk and take its place.

    Starting the collector means "run what is on disk". Reusing a process that
    predates the last edit is how a fixed backend keeps answering with the old
    behaviour, so the operator re-tests a bug that is already fixed.

    A running acquisition is the one case worth refusing: terminating it would
    end the session, and the next start would open a second .tgam.
    """
    async with client.get(url.rstrip("/") + "/api/runtime",
                          timeout=ClientTimeout(total=1)) as response:
        live = await response.json()
    if (live.get("acquisition") or {}).get("running"):
        raise RuntimeError("采集器正在采集，未自动重启；请先按「停止采集」，再重新启动采集器。")
    pid = state.get("pid")
    if not isinstance(pid, int) or pid <= 0:
        raise RuntimeError("无法确认旧采集器进程，请手动结束该进程后再启动。")
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError as error:
        raise RuntimeError(f"结束旧采集器失败：{error}") from error
    return pid


async def wait_until_gone(client, url, seconds=8):
    """Wait for the old instance to stop answering, which means its port is free.

    `run_owned` walks forward from the configured port when a bind fails, so
    starting before the old socket is released would silently move the console
    to 8768 and leave the operator's bookmark pointing at nothing.
    """
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            async with client.get(url.rstrip("/") + "/api/health",
                                  timeout=ClientTimeout(total=.3)) as response:
                await response.read()
        except (ClientError, asyncio.TimeoutError, OSError):
            return True
        await asyncio.sleep(.2)
    return False


async def run(args):
    directory = data_directory()
    directory.mkdir(parents=True, exist_ok=True)
    config_path = Path(args.config).resolve() if args.config else directory / "config.json"
    config = validate_config(json.loads(config_path.read_text(encoding="utf-8-sig"))
                             if config_path.exists() else {})
    if args.port is not None:
        config = validate_config({**config, "port": args.port})
    ownership = InstanceLock(directory)
    if not ownership.acquire():
        # Only the OS lock plus a matching live instance can authorize reuse.
        async with ClientSession(timeout=ClientTimeout(total=1)) as client:
            for _ in range(40):
                try:
                    state = json.loads((directory / "runtime.json").read_text(encoding="utf-8"))
                    url = state["url"]
                    from urllib.parse import urlsplit
                    parsed = urlsplit(url)
                    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1":
                        raise ValueError("Untrusted local runtime URL")
                    async with client.get(url.rstrip("/") + "/api/health") as response:
                        health = await response.json()
                    if (health.get("app") == "neural-resonance-gateway"
                            and health.get("instanceId") == instance_id(directory)):
                        if bool(health.get("upstream")) != bool(args.reuse_local_core):
                            raise RuntimeError("既有程序采集模式不同，请正常退出后以所需模式启动。")
                        stale = health.get("build") != BUILD or started_before_sources(state)
                        if stale:
                            pid = await replace_stale_instance(client, state, url)
                            print(f"Replacing stale collector pid {pid} with the current code",
                                  flush=True)
                            for _ in range(40):
                                if ownership.acquire():
                                    break
                                await asyncio.sleep(.25)
                            if not ownership.handle:
                                raise RuntimeError("旧采集器尚未退出，请稍候再启动。")
                            if not await wait_until_gone(client, url):
                                raise RuntimeError("旧采集器仍占用端口，请稍候再启动。")
                            break
                        if not args.no_browser:
                            webbrowser.open(url)
                        print(f"Existing independent instance {url}", flush=True)
                        return
                except RuntimeError:
                    raise
                except (OSError, ValueError, KeyError, ClientError):
                    pass
                await asyncio.sleep(.25)
            else:
                raise RuntimeError("本用户采集器已启动但尚未响应；未重复打开设备，请查看 startup-error.txt。")
    try:
        await run_owned(args, directory, config_path, config)
    finally:
        ownership.close()


async def run_owned(args, directory, config_path, config):
    upstream = None
    async with ClientSession(timeout=ClientTimeout(total=2)) as client:
        try:
            async with client.get(f"http://127.0.0.1:{config['port']}/api/health",
                                  timeout=ClientTimeout(total=.3)) as response:
                previous = await response.json()
            if previous.get("app") == "neural-resonance-gateway" and not previous.get("instanceId"):
                raise RuntimeError("检测到不支持单实例校验的旧采集器，请正常退出旧程序后启动新包。")
        except (ClientError, asyncio.TimeoutError, ValueError):
            pass
        if args.reuse_local_core and not args.standalone:
            try:
                async with client.get("http://127.0.0.1:8002/api/device/status") as response:
                    state = await response.json()
                    if state.get("source") == "core" and state.get("mode") == "LIVE":
                        upstream = "http://127.0.0.1:8002"
            except Exception:
                pass
        if args.reuse_local_core and not upstream:
            raise RuntimeError("已要求复用核心，但本机核心没有返回有效 LIVE 状态。")
    storage_directory, storage_error = resolve_storage(config)
    acquisition = Acquisition(config, storage_directory, storage_error)
    app = create_app(acquisition, config_path, upstream, instance=instance_id(directory))
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    selected = None
    for port in range(config["port"], min(65536, config["port"] + 10)):
        try:
            site = web.TCPSite(runner, "127.0.0.1", port)
            await site.start()
            selected = port
            app[CONTEXT_KEY]["port"] = port
            break
        except OSError:
            continue
    if selected is None:
        await runner.cleanup()
        raise RuntimeError("本地端口均被占用")
    url = f"http://127.0.0.1:{selected}/"
    print(f"Neural Resonance {url} ({'existing core' if upstream else 'independent acquisition'})", flush=True)
    write_runtime(directory, url=url, mode="core-proxy" if upstream else "standalone")
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
        write_runtime(directory, url=url, mode="stopped")


if __name__ == "__main__":
    # Child-process capability probe: see bluetooth_permitted(). A frozen build
    # re-enters here, a source build runs BLUETOOTH_PROBE with -c.
    if "--bluetooth-probe" in sys.argv[1:]:
        asyncio.run(BleakScanner.discover(timeout=2, return_adv=True))
        raise SystemExit(0)
    parser = argparse.ArgumentParser()
    parser.add_argument("--config")
    parser.add_argument("--port", type=int)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--standalone", action="store_true")
    mode.add_argument("--reuse-local-core", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    logger = logging.getLogger("neural-resonance")
    try:
        data_directory().mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(data_directory() / "service.log", maxBytes=256000,
                                      backupCount=2, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.info("Start build=%s platform=%s", BUILD, sys.platform)
        asyncio.run(run(parser.parse_args()))
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(f"无法启动：{error}", file=sys.stderr)
        logger.error("Startup failed: %s", error)
        try:
            (data_directory() / "startup-error.txt").write_text(str(error), encoding="utf-8")
        except OSError:
            pass
        if FROZEN and "--no-browser" not in sys.argv:
            if sys.platform == "win32":
                import ctypes
                ctypes.windll.user32.MessageBoxW(None, f"{error}\n\n详细记录：{data_directory()}",
                                                "Neural Resonance — 无法启动", 0x10)
            elif sys.platform == "darwin":
                import subprocess
                # AppleScript string literal, passed as an argument without a shell.
                message = json.dumps(f"{error}\n\n记录：{data_directory()}", ensure_ascii=False)
                subprocess.run(["osascript", "-e",
                                f'display alert "Neural Resonance — 无法启动" message {message}'],
                               check=False)
        raise SystemExit(1)
