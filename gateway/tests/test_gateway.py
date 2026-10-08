import asyncio
import json
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition import Stream, choose_port
from protocols import ThinkGear, oxygen, gsr
from device_gateway import validate_config, Acquisition, create_app
from aiohttp.test_utils import TestClient, TestServer


def frame(payload):
    return b"\xaa\xaa" + bytes([len(payload)]) + payload + bytes([(~sum(payload)) & 255])


def port(name, vid=0x0483, pid=0x5740, serial=""):
    return SimpleNamespace(device=name, vid=vid, pid=pid, serial_number=serial,
                           description="USB Serial", location="1-9")


class ProtocolTests(unittest.TestCase):
    def test_fragmented_signed_raw_and_native_indices(self):
        decoder = ThinkGear()
        data = frame(b"\x02\x00\x04\x3e\x05\x4a\x80\x02\x80\x00")
        self.assertEqual(decoder.feed(data[:4]), [])
        self.assertEqual(decoder.feed(data[4:]),
                         [({"poor_signal": 0, "attention": 62, "meditation": 74}, [-32768])])

    def test_malformed_rows_do_not_commit_earlier_fields(self):
        decoder = ThinkGear()
        self.assertEqual(decoder.feed(frame(b"\x04\x3e\x80\x02\x00")), [])
        self.assertEqual(decoder.errors, 1)

    def test_bulk_samples_are_not_truncated(self):
        packet = frame(b"\x80\x02\x00\x01")
        self.assertEqual(len(ThinkGear().feed(packet * 1200)), 1200)

    def test_extended_code_does_not_become_native_attention(self):
        self.assertEqual(ThinkGear().feed(frame(b"\x55\x04\x3e")), [({}, [])])

    def test_oxygen_variants_and_reject_invalid_probe(self):
        self.assertEqual(oxygen("Sp02 : 98% ,Pulse rate :72 bpm"), (98, 72))
        self.assertEqual(oxygen("SpO2 : 97% ,Pulse rate :71 bpm"), (97, 71))
        self.assertIsNone(oxygen("Sp02 : 6% ,Pulse rate :102 bpm"))
        self.assertIsNone(oxygen("AFE4490 probe error 100"))
        self.assertEqual(gsr("GSR: 450.2"), 450.2)
        self.assertIsNone(gsr("driver error 450"))


class IdentityTests(unittest.TestCase):
    def test_windows_and_macos_identity_do_not_depend_on_device_name(self):
        profile = validate_config({})["eeg"]
        self.assertEqual(choose_port([port("COM21")], profile), "COM21")
        self.assertEqual(choose_port([port("/dev/cu.usbmodem9510")], profile),
                         "/dev/cu.usbmodem9510")

    def test_blank_serial_accepts_another_users_headband(self):
        self.assertEqual(choose_port([port("COM21", serial="another-device")],
                                     validate_config({})["eeg"]), "COM21")

    def test_identical_adapters_need_identity_selection(self):
        profile = validate_config({})["eeg"]
        devices = [port("COM21", serial="A"), port("COM22", serial="B")]
        self.assertEqual(choose_port(devices, profile), "")
        self.assertEqual(choose_port(devices, {**profile, "serialNumber": "B"}), "COM22")

    def test_virtual_bluetooth_ports_never_match_usb(self):
        self.assertEqual(choose_port([port("COM7", None, None)],
                                     validate_config({})["eeg"]), "")

    def test_invalid_config_is_rejected(self):
        for value in ({"port": 1}, {"eeg": {"baud": 0}}, {"eeg": {"vid": "0483"}},
                      {"eeg": {"dtr": "false"}}, {"ble": {"namePrefixes": []}}):
            with self.assertRaises(ValueError):
                validate_config(value)

    def test_enabled_gsr_without_known_identity_never_guesses(self):
        profile = validate_config({"gsr": {"enabled": True}})["gsr"]
        self.assertEqual(choose_port([port("COM21")], profile), "")


class StreamTests(unittest.TestCase):
    def test_raw_cannot_refresh_old_native_indices(self):
        stream = Stream()
        stream.accept("usb", {"attention": 60, "meditation": 70}, [1], now=10)
        stream.accept("usb", {}, [2], now=14)
        packet = stream.snapshot(now=14)
        self.assertEqual(packet["eeg"], {})
        self.assertEqual(packet["rawEegSamples"], [1, 2])
        self.assertEqual(stream.snapshot(now=18)["rawEegSamples"], [])
        self.assertEqual(stream.snapshot(now=18)["transport"], "none")

    def test_usb_preempts_ble_without_joining_windows(self):
        stream = Stream()
        stream.accept("desktop_ble", {"attention": 60}, [1], now=10)
        stream.accept("usb", {"meditation": 70}, [2], now=11)
        self.assertFalse(stream.accept("desktop_ble", {"attention": 80}, [3], now=12))
        packet = stream.snapshot(now=12)
        self.assertEqual(packet["eeg"], {"meditation": 70})
        self.assertEqual(packet["connectionEpoch"], 2)
        self.assertEqual(packet["rawEegSamples"], [2])

    def test_per_client_raw_cursor_has_no_duplicates(self):
        stream = Stream()
        stream.accept("usb", {}, [1, 2, 3], now=10)
        a = stream.snapshot(now=10)
        self.assertEqual(stream.snapshot(a["rawSequence"], now=10)["rawEegSamples"], [])
        self.assertEqual(stream.snapshot(now=10)["rawEegSamples"], [1, 2, 3])

    def test_sensors_stay_independent_and_expire(self):
        stream = Stream()
        stream.sensor("spo2", 98, now=10)
        stream.sensor("pr", 72, now=10)
        self.assertEqual(stream.snapshot(now=11)["spo2"], 98)
        self.assertIsNone(stream.snapshot(now=26)["spo2"])
        self.assertNotIn("hrv", stream.snapshot(now=11))


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        config = validate_config({
            "eeg": {"enabled": False}, "bloodOxygen": {"enabled": False},
            "gsr": {"enabled": False}, "ble": {"enabled": False},
        })
        self.acquisition = Acquisition(config)
        app = create_app(self.acquisition, Path(self.tmp.name) / "config.json")
        self.client = TestClient(TestServer(app))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.tmp.cleanup()

    async def test_static_site_and_auto_config_without_node_or_lab(self):
        page = await self.client.get("/")
        self.assertIn("waveforms", await page.text())
        config = await (await self.client.get("/public/config.json")).json()
        self.assertEqual(config["endpoint"], "/ws/live")
        self.assertTrue(config["autoConnect"])
        health = await (await self.client.get("/api/health")).json()
        self.assertEqual(health["app"], "neural-resonance-gateway")

    async def test_source_and_config_files_are_not_public(self):
        for path in ("/gateway/device_gateway.py", "/.runtime/config.json",
                     "/.git/config", "/../gateway/config.example.json"):
            self.assertEqual((await self.client.get(path)).status, 404)

    async def test_websocket_preserves_missing_values_and_raw_cursor(self):
        self.acquisition.stream.accept("usb", {"attention": 62, "meditation": 74}, [1, -2])
        socket = await self.client.ws_connect("/ws/live")
        first = await socket.receive_json()
        second = await socket.receive_json()
        self.assertEqual(first["rawEegSamples"], [1, -2])
        self.assertEqual(second["rawEegSamples"], [])
        self.assertIsNone(first["spo2"])
        await socket.close()

    async def test_config_is_validated_and_saved_with_no_author_paths(self):
        response = await self.client.post("/api/gateway/config", json={"port": 9000})
        self.assertEqual(response.status, 200)
        stored = json.loads((Path(self.tmp.name) / "config.json").read_text())
        self.assertEqual(stored["port"], 9000)
        self.assertEqual(stored["eeg"]["serialNumber"], "")
        invalid = await self.client.post("/api/gateway/config", json={"port": 1})
        self.assertEqual(invalid.status, 400)

    async def test_external_origin_cannot_change_device_configuration(self):
        response = await self.client.post("/api/gateway/config", json={"port": 9000},
                                          headers={"Origin": "https://unrelated.invalid"})
        self.assertEqual(response.status, 403)


if __name__ == "__main__":
    unittest.main()
