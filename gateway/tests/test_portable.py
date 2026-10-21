import asyncio
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition import choose_port, inventory, serial_selection
from runtime_support import InstanceLock
from device_gateway import Acquisition, validate_config
from device_gateway import create_app, run_owned
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


def port(name, serial="", location=""):
    return SimpleNamespace(device=name, vid=1155, pid=22336,
                           serial_number=serial, location=location,
                           description="ThinkGear-compatible USB")


class PortableTests(unittest.TestCase):
    def test_macos_cu_tty_aliases_are_not_false_ambiguity(self):
        ports = [port("/dev/tty.usbmodem123"), port("/dev/cu.usbmodem123")]
        self.assertEqual(choose_port(ports, validate_config({})["eeg"]), "/dev/cu.usbmodem123")
        self.assertEqual(len(inventory(ports)), 1)
        ports.append(port("/dev/cu.usbmodem456"))
        self.assertEqual(serial_selection(ports, validate_config({})["eeg"])[1], "ambiguous-devices")

    def test_absent_saved_device_is_distinct_from_no_matching_model(self):
        profile = {**validate_config({})["eeg"], "serialNumber": "saved"}
        self.assertEqual(serial_selection([port("COM15", "other")], profile)[1], "saved-device-missing")
        self.assertEqual(serial_selection([], profile)[1], "device-not-found")

    def test_independent_default_does_not_use_author_core(self):
        self.assertFalse(validate_config({})["reuseLocalCore"])

    def test_os_lock_blocks_another_process_and_releases_after_close(self):
        with tempfile.TemporaryDirectory(prefix="獨立環境 ") as directory:
            lock = InstanceLock(directory)
            self.assertTrue(lock.acquire())
            script = ("from runtime_support import InstanceLock; import sys; "
                      "lock=InstanceLock(sys.argv[1]); ok=lock.acquire(); "
                      "lock.close(); sys.exit(0 if ok else 3)")
            command = [sys.executable, "-c", script, directory]
            env = dict(__import__("os").environ, PYTHONPATH=str(Path(__file__).resolve().parents[1]))
            try:
                self.assertEqual(subprocess.run(command, env=env, capture_output=True).returncode, 3)
            finally:
                lock.close()
            self.assertEqual(subprocess.run(command, env=env, capture_output=True).returncode, 0)

    def test_access_denied_is_actionable_and_never_fakes_packets(self):
        acquisition = Acquisition(validate_config({}))
        def denied(*_args, **_kwargs):
            acquisition.stop_event.set()
            raise PermissionError("Access is denied")
        with patch("device_gateway.list_ports.comports", return_value=[port("COM19")]), \
                patch("device_gateway.serial.Serial", side_effect=denied):
            acquisition.serial_worker("eeg")
        status = acquisition.stream.runtime()["devices"]["eeg"]
        self.assertEqual(status["reason"], "access-or-port-busy")
        self.assertEqual(acquisition.stream.frames, 0)
        self.assertEqual(acquisition.stream.sequence, 0)


class NotificationStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_server_is_not_duplicated_and_no_hardware_is_opened(self):
        app = web.Application()
        async def health(_request):
            return web.json_response({"app": "neural-resonance-gateway", "version": "old"})
        app.router.add_get("/api/health", health)
        async with TestServer(app) as server:
            config = validate_config({"port": server.port})
            args = SimpleNamespace(reuse_local_core=False, standalone=False, no_browser=True)
            with tempfile.TemporaryDirectory() as directory, \
                    patch.object(Acquisition, "start") as start:
                with self.assertRaisesRegex(RuntimeError, "旧采集器"):
                    await run_owned(args, Path(directory), Path(directory) / "config.json", config)
                start.assert_not_called()

    async def test_controlled_hotplug_bytes_reach_http_and_websocket_without_stale_fields(self):
        state = {"port": None, "sent": set()}
        handles = []
        def ports():
            return [port(state["port"])] if state["port"] else []
        class Serial:
            dtr = rts = False
            in_waiting = 1024
            def __init__(self, **_kwargs):
                self.port = None
                self.closed = False
                handles.append(self)
            def open(self): pass
            def close(self): self.closed = True
            def read(self, _count):
                import time
                time.sleep(.03)
                if self.port not in state["sent"]:
                    state["sent"].add(self.port)
                    payload = (b"\x02\x00\x04\x3e\x05\x4a\x80\x02\x00\x01"
                               if self.port == "COM77" else b"\x80\x02\x00\x02")
                    encoded=b"\xaa\xaa" + bytes([len(payload)]) + payload + bytes([(~sum(payload)) & 255])
                    if self.port == "COM77":
                        encoded+=b"\xaa\xaa\x04\x80\x02\x00\x63\x00"  # Deliberately invalid checksum.
                        tail=b"\x80\x02\xff\xfd"
                        encoded+=b"\xaa\xaa"+bytes([len(tail)])+tail+bytes([(~sum(tail))&255])
                    return encoded
                return b""
        config = validate_config({"bloodOxygen": {"enabled": False}, "ble": {"enabled": False}})
        acquisition = Acquisition(config)
        with tempfile.TemporaryDirectory() as directory, \
                patch("device_gateway.list_ports.comports", side_effect=ports), \
                patch("device_gateway.serial.Serial", Serial):
            async with TestClient(TestServer(create_app(acquisition, Path(directory) / "config.json"))) as client:
                socket = await client.ws_connect("/ws/live")
                self.assertEqual((await socket.receive_json())["rawEegSamples"], [])
                state["port"] = "COM77"  # Insert after the server/browser has already started.
                first = None
                async with asyncio.timeout(6):
                    while first is None:
                        packet = await socket.receive_json()
                        if packet["rawEegSamples"]:
                            first = packet
                self.assertIsNotNone(first)
                self.assertEqual(first["eeg"]["attention"], 62)
                self.assertEqual(first["rawEegSamples"], [1,-3])
                self.assertEqual(first["rawBreaks"], [1])
                self.assertEqual(first["quality"]["protocolErrors"], 1)
                live = await (await client.get("/api/runtime")).json()
                self.assertEqual(live["devices"]["eeg"]["state"], "receiving")
                self.assertGreater(live["devices"]["eeg"]["bytes"], 0)
                self.assertEqual(live["devices"]["eeg"]["validPackets"], 2)
                state["port"] = "COM99"  # Disconnect/reconnect at a reassigned OS port.
                second = None
                async with asyncio.timeout(6):
                    while second is None:
                        packet = await socket.receive_json()
                        if packet["rawEegSamples"] == [2]:
                            second = packet
                self.assertIsNotNone(second)
                self.assertNotIn("attention", second["eeg"])
                self.assertEqual(second["rawBreaks"], [])
                self.assertEqual(second["quality"]["protocolErrors"], 0)
                self.assertGreater(second["connectionEpoch"], first["connectionEpoch"])
                await socket.close()
        self.assertTrue(handles and all(handle.closed for handle in handles))

    async def test_notification_during_start_notify_cannot_be_replaced_by_waiting_state(self):
        acquisition = Acquisition(validate_config({}))
        device = SimpleNamespace(address="UUID", name="BrainLink")
        char = SimpleNamespace(uuid="notify", properties=["notify"])
        before_disconnect = []
        class Client:
            def __init__(self, *_args, **_kwargs):
                self.services = [SimpleNamespace(uuid="service", characteristics=[char])]
                self.is_connected = False
            async def __aenter__(self): return self
            async def __aexit__(self, *_args):
                before_disconnect.append(acquisition.stream.devices["ble"]["state"])
                acquisition.stop_event.set()
            async def start_notify(self, characteristic, callback):
                callback(characteristic, b"\xaa\xaa\x04\x80\x02\x00\x01\x7c")
        found = {"one": (device, SimpleNamespace(local_name="BrainLink"))}
        with patch("device_gateway.BleakScanner.discover", return_value=found), \
                patch("device_gateway.BleakClient", Client):
            await asyncio.wait_for(acquisition.ble_worker(), 2)
        self.assertEqual(before_disconnect, ["receiving"])
        self.assertEqual(acquisition.stream.devices["ble"]["state"], "waiting")
        self.assertEqual(acquisition.stream.sequence, 1)
