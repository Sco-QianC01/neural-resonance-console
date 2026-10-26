import asyncio
import contextlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import device_gateway
from acquisition import Stream, choose_port, ble_candidates, ble_nearby
from protocols import ThinkGear, oxygen, gsr
from device_gateway import validate_config, Acquisition, create_app, recording_label
from aiohttp.test_utils import TestClient, TestServer


def frame(payload):
    return b"\xaa\xaa" + bytes([len(payload)]) + payload + bytes([(~sum(payload)) & 255])


def port(name, vid=0x0483, pid=0x5740, serial=""):
    return SimpleNamespace(device=name, vid=vid, pid=pid, serial_number=serial,
                           description="USB Serial", location="1-9")


class ProtocolTests(unittest.TestCase):
    def test_error_position_survives_inside_one_bulk_read(self):
        decoder=ThinkGear()
        broken=bytearray(frame(b'\x80\x02\x00\x63'));broken[-1]^=1
        packets=decoder.feed(frame(b'\x80\x02\x00\x01')+broken+frame(b'\x80\x02\xff\xfe'))
        self.assertEqual(packets,[({},[1],0),({},[-2],1)])
        stream=Stream()
        for fields,raw,errors in packets:
            stream.accept('usb',fields,raw,now=10,protocol_errors=errors)
        result=stream.snapshot(now=10)
        self.assertEqual(result['rawEegSamples'],[1,-2])
        self.assertEqual(result['rawBreaks'],[1])
        self.assertEqual(stream.snapshot(1,now=10)['rawBreaks'],[0])
        self.assertEqual(result['rawDropped'],0)
        self.assertEqual(result['quality']['protocolErrors'],1)
    def test_known_row_lengths_reject_earlier_native_fields(self):
        for row in (b'\x80\x01\x01',b'\x83\x17'+bytes(23)):
            decoder=ThinkGear()
            self.assertEqual(decoder.feed(frame(b'\x04\x63'+row)),[])
            self.assertEqual(decoder.errors,1)
    def test_every_signed_raw_code_and_each_24_bit_power_channel(self):
        decoder=ThinkGear()
        for start in range(0,65536,256):
            data=b''.join(frame(b'\x80\x02'+value.to_bytes(2,'big')) for value in range(start,start+256))
            packets=decoder.feed(data[:13])+decoder.feed(data[13:])
            self.assertEqual([p[1][0] for p in packets],[v if v<32768 else v-65536 for v in range(start,start+256)])
        values=[0,1,255,256,65535,65536,0xffffff,123456]
        result=decoder.feed(frame(b'\x83\x18'+b''.join(v.to_bytes(3,'big') for v in values)))[0][0]
        self.assertEqual([result[k] for k in ('delta','theta','lowAlpha','highAlpha','lowBeta','highBeta','lowGamma','midGamma')],values)
    def test_fragmented_signed_raw_and_native_indices(self):
        decoder = ThinkGear()
        data = frame(b"\x02\x00\x04\x3e\x05\x4a\x80\x02\x80\x00")
        self.assertEqual(decoder.feed(data[:4]), [])
        self.assertEqual(decoder.feed(data[4:]),
                         [({"poor_signal": 0, "attention": 62, "meditation": 74}, [-32768],0)])

    def test_malformed_rows_do_not_commit_earlier_fields(self):
        decoder = ThinkGear()
        self.assertEqual(decoder.feed(frame(b"\x04\x3e\x80\x02\x00")), [])
        self.assertEqual(decoder.errors, 1)

    def test_bulk_samples_are_not_truncated(self):
        packet = frame(b"\x80\x02\x00\x01")
        self.assertEqual(len(ThinkGear().feed(packet * 1200)), 1200)

    def test_extended_code_does_not_become_native_attention(self):
        self.assertEqual(ThinkGear().feed(frame(b"\x55\x04\x3e")), [({}, [],0)])

    def test_oxygen_variants_and_reject_invalid_probe(self):
        self.assertEqual(oxygen("Sp02 : 98% ,Pulse rate :72 bpm"), (98, 72))
        self.assertEqual(oxygen("SpO2 : 97% ,Pulse rate :71 bpm"), (97, 71))
        self.assertIsNone(oxygen("Sp02 : 6% ,Pulse rate :102 bpm"))
        self.assertIsNone(oxygen("AFE4490 probe error 100"))
        self.assertEqual(gsr("GSR: 450.2"), 450.2)
        self.assertIsNone(gsr("driver error 450"))


class IdentityTests(unittest.TestCase):
    def test_saved_ble_identity_survives_rename_and_same_name_devices(self):
        found={
            "first":(SimpleNamespace(address="AA:01",name="Renamed headset"),SimpleNamespace(local_name="Renamed headset")),
            "second":(SimpleNamespace(address="AA:02",name="HR-S0A"),SimpleNamespace(local_name="HR-S0A")),
        }
        profile=validate_config({"ble":{"address":"aa:01"}})["ble"]
        self.assertEqual(ble_candidates(found,profile)[0][0].address,"AA:01")
        profile["address"]="missing"
        self.assertEqual(ble_candidates(found,profile),[])

    def test_macos_uuid_identity_and_empty_identity_defaults_are_distinct(self):
        found={"one":(SimpleNamespace(address="ABC-DEF-123",name="BrainLink"),SimpleNamespace(local_name="BrainLink"))}
        profile=validate_config({"ble":{"address":"abc-def-123"}})["ble"]
        self.assertEqual(len(ble_candidates(found,profile)),1)
        profile["address"]=""
        self.assertEqual(len(ble_candidates(found,profile)),1)
        found["two"]=(SimpleNamespace(address="OTHER-UUID",name="BrainLink"),SimpleNamespace(local_name="BrainLink"))
        self.assertEqual(len(ble_candidates(found,profile)),2)

    def test_saved_ble_identity_rejects_invalid_types(self):
        with self.assertRaises(ValueError):
            validate_config({"ble":{"address":123}})

    def test_saved_ble_name_is_optional_but_typed(self):
        # The address is what matching uses; the name is what a person reads while
        # the device is switched off, so it travels with the saved identity.
        profile = validate_config({"ble": {"address": "AA:01", "name": "HR-S0AA758"}})["ble"]
        self.assertEqual(profile["name"], "HR-S0AA758")
        self.assertEqual(validate_config({})["ble"]["name"], "")
        with self.assertRaises(ValueError):
            validate_config({"ble": {"name": 42}})

    def test_nearby_lists_unnamed_and_unmatched_devices(self):
        # A strict saved identity is deliberate: it must never drift onto a
        # same-named device. The neighbourhood is reported separately so the
        # empty picker can be explained instead of just being empty.
        found={
            "phone":(SimpleNamespace(address="AA:01",name="iPhone"),SimpleNamespace(local_name="iPhone")),
            "unnamed":(SimpleNamespace(address="AA:02",name=""),SimpleNamespace(local_name=None)),
        }
        profile=validate_config({"ble":{"address":"gone"}})["ble"]
        self.assertEqual(ble_candidates(found,profile),[])
        self.assertEqual(ble_nearby(found),[{"name":"iPhone","address":"AA:01"}])
        self.assertEqual(ble_nearby({}),[])

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
                      {"eeg": {"dtr": "false"}}, {"eeg": {"deviceId": 123}},
                      {"ble": {"namePrefixes": []}}):
            with self.assertRaises(ValueError):
                validate_config(value)
        self.assertEqual(validate_config({"eeg": {"deviceId": "SOA-FA758"}})
                         ["eeg"]["deviceId"], "SOA-FA758")

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
        self.assertEqual(stream.snapshot(now=10)["fieldTimestamps"]["raw"], 10)
        stream.accept("usb", {"attention": 60}, [], now=11)
        self.assertEqual(stream.snapshot(now=11)["fieldTimestamps"]["raw"], 10)

    def test_sensors_stay_independent_and_expire(self):
        stream = Stream()
        stream.sensor("spo2", 98, now=10)
        stream.sensor("pr", 72, now=10)
        self.assertEqual(stream.snapshot(now=11)["spo2"], 98)
        self.assertIsNone(stream.snapshot(now=26)["spo2"])
        self.assertNotIn("hrv", stream.snapshot(now=11))

    def test_packet_count_belongs_to_one_acquisition(self):
        # 有效封包 answers "how much has this acquisition received". A running
        # total survived Stop and the next Start continued from it, so the panel
        # kept a number that no longer described anything being received.
        stream = Stream()
        connection = stream.new_connection("usb")
        for step in range(3):
            self.assertTrue(stream.accept("usb", {"attention": 60}, [1],
                                          now=10 + step, connection=connection))
        self.assertEqual(stream.snapshot(now=12)["quality"]["eegPackets"], 3)
        stream.end_connection("usb", connection)
        packet = stream.snapshot(now=13)
        self.assertEqual(packet["quality"]["eegPackets"], 0)
        self.assertEqual(packet["transport"], "none")
        # The raw cursor is a position in the byte log, not a session counter:
        # clearing it would make every client re-read the whole log.
        self.assertEqual(packet["rawSequence"], 3)
        resumed = stream.new_connection("usb")
        stream.accept("usb", {"attention": 61}, [1], now=14, connection=resumed)
        self.assertEqual(stream.snapshot(now=14)["quality"]["eegPackets"], 1)

    def test_buffered_minute_reaches_a_client_that_opens_late(self):
        # The page used to draw only the seconds since its own socket opened,
        # because history lived in the browser. A minute is kept here so a tab
        # opened mid-recording can fill the window it draws.
        stream = Stream()
        for step in range(70):
            stream.accept("usb", {"attention": 60, "meditation": 70}, [], now=100 + step)
        packet = stream.snapshot(now=169, backfill=True)
        rows = packet["history"]["points"]
        self.assertTrue(rows)
        self.assertTrue(all(row["ts"] >= 109 for row in rows))
        self.assertEqual(rows[-1]["attention"], 60)
        self.assertEqual(packet["history"]["transport"], "usb")
        self.assertEqual(packet["history"]["connectionEpoch"], packet["connectionEpoch"])
        self.assertEqual(packet["history"]["seconds"], 60)
        # Only the first frame for a client carries it; later frames stay small.
        self.assertNotIn("history", stream.snapshot(now=169))

    def test_buffer_holds_a_sample_per_tick_not_every_frame(self):
        stream = Stream()
        stream.accept("usb", {"attention": 60}, [], now=10.0)
        # eSense and band power arrive as separate frames; one tick, one point.
        stream.accept("usb", {"meditation": 70}, [], now=10.05)
        stream.accept("usb", {"poor_signal": 0, "lowAlpha": 5}, [], now=10.1)
        rows = stream.snapshot(now=10.1, backfill=True)["history"]["points"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["attention"], 60)
        self.assertEqual(rows[0]["meditation"], 70)
        self.assertEqual(rows[0]["bands"], {"lowAlpha": 5.0})
        self.assertEqual(rows[0]["packets"], 3)

    def test_buffer_is_cleared_with_the_acquisition(self):
        stream = Stream()
        connection = stream.new_connection("usb")
        stream.accept("usb", {"attention": 60}, [], now=10, connection=connection)
        stream.end_connection("usb", connection)
        self.assertEqual(stream.snapshot(now=10, backfill=True)["history"]["points"], [])

    def test_packet_count_restarts_when_transport_changes(self):
        stream = Stream()
        for step in range(2):
            stream.accept("desktop_ble", {"attention": 60}, [1], now=10 + step)
        self.assertEqual(stream.snapshot(now=11)["quality"]["eegPackets"], 2)
        stream.accept("usb", {"meditation": 70}, [2], now=12)
        self.assertEqual(stream.snapshot(now=12)["quality"]["eegPackets"], 1)


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_research_media_allowlist_and_range(self):
        with patch.dict("os.environ", {"NEURAL_RESONANCE_DATA": self.tmp.name}):
            target = Path(self.tmp.name) / "results/20261014_神经蠕虫录音修订/音乐资料/音频/c27_fou1978.mp3"
            target.parent.mkdir(parents=True)
            target.write_bytes(b"ID3" + b"a" * 100)
            response = await self.client.get("/api/research-media/c27_fou1978", headers={"Range":"bytes=0-2"})
            self.assertEqual(response.status, 206)
            self.assertEqual(await response.read(), b"ID3")
            self.assertEqual((await self.client.get("/api/research-media/unknown")).status, 404)
            self.assertEqual((await self.client.get("/api/research-media/config.json")).status, 404)

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

    async def test_chinese_static_documents_declare_utf8_for_direct_browser_navigation(self):
        response = await self.client.get("/docs/PLANAR-METHODS.md")
        self.assertEqual(response.charset, "utf-8")
        self.assertIn("二維神經蠕蟲", await response.text())
        module = await self.client.get("/src/gateway-settings.mjs")
        self.assertEqual(module.charset, "utf-8")

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

    async def test_refresh_endpoint_rebuilds_the_radio_without_writing_config(self):
        # 「刷新設備」 is a repair action: it releases a half-open Bluetooth attempt
        # and starts a fresh scan. It must not be a config write, or a stale panel
        # could save settings the operator never chose.
        calls = []

        async def restart():
            calls.append(1)

        self.acquisition.restart_bluetooth = restart
        response = await self.client.post("/api/gateway/refresh")
        self.assertEqual(response.status, 200)
        self.assertEqual(await response.json(), {"refreshed": True})
        self.assertEqual(calls, [1])
        self.assertFalse((Path(self.tmp.name) / "config.json").exists())

    async def test_refresh_is_refused_while_valid_data_is_arriving(self):
        # Restarting the worker ends the recording session, so a link that is
        # actually delivering data must be left alone — the stuck case this
        # button exists for is precisely a link that is not receiving.
        calls = []

        async def restart():
            calls.append(1)

        self.acquisition.restart_bluetooth = restart
        self.acquisition.stream.status("ble", state="receiving")
        response = await self.client.post("/api/gateway/refresh")
        self.assertEqual(response.status, 200)
        self.assertEqual(await response.json(),
                         {"refreshed": False, "reason": "receiving"})
        self.assertEqual(calls, [])

    async def test_device_file_id_is_saved_without_restarting_acquisition(self):
        stream = self.acquisition.stream
        response = await self.client.post("/api/gateway/config", json={"eeg": {"deviceId": "SOA-FA758"}})
        self.assertEqual(response.status, 200)
        self.assertIs(self.acquisition.stream, stream)
        stored = json.loads((Path(self.tmp.name) / "config.json").read_text())
        self.assertEqual(stored["eeg"]["deviceId"], "SOA-FA758")

    async def test_start_and_stop_keep_the_discovered_bluetooth_devices(self):
        # Starting acquisition is a flag, not a re-identification. Replacing the
        # stream here erased the picker the operator was looking at, which is the
        # "identity disappears after pressing start" report.
        stream = self.acquisition.stream
        found = [{"name": "HR-S0AA758", "address": "AA:01"}]
        stream.status("ble", candidates=found, nearby=found, scanned=1)
        started = await self.client.post("/api/gateway/config", json={"acquisition": {"running": True}})
        self.assertEqual(started.status, 200)
        self.assertIs(self.acquisition.stream, stream)
        self.assertTrue(self.acquisition.running)
        self.assertEqual(self.acquisition.stream.devices["ble"]["candidates"], found)
        self.assertEqual(self.acquisition.stream.devices["ble"]["nearby"], found)
        stopped = await self.client.post("/api/gateway/config", json={"acquisition": {"running": False}})
        self.assertEqual(stopped.status, 200)
        self.assertIs(self.acquisition.stream, stream)
        self.assertFalse(self.acquisition.running)

    async def test_switching_bluetooth_off_keeps_the_stream_and_names_the_state(self):
        stream = self.acquisition.stream
        with patch("device_gateway.bluetooth_permitted", return_value=False):
            enabled = await self.client.post("/api/gateway/config", json={"ble": {"enabled": True}})
            self.assertEqual(enabled.status, 200)
            await asyncio.sleep(.1)
            self.assertIs(self.acquisition.stream, stream)
            disabled = await self.client.post("/api/gateway/config", json={"ble": {"enabled": False}})
            self.assertEqual(disabled.status, 200)
        self.assertIs(self.acquisition.stream, stream)
        self.assertEqual(self.acquisition.stream.devices["ble"]["state"], "disabled")

    async def test_runtime_reports_whether_acquisition_is_running(self):
        # The console cannot say 采集已停止 by guessing from the last device state.
        state = await (await self.client.get("/api/runtime")).json()
        self.assertEqual(state["acquisition"], {"running": False})
        await self.client.post("/api/gateway/config", json={"acquisition": {"running": True}})
        state = await (await self.client.get("/api/runtime")).json()
        self.assertEqual(state["acquisition"], {"running": True})

    async def test_external_origin_cannot_change_device_configuration(self):
        response = await self.client.post("/api/gateway/config", json={"port": 9000},
                                          headers={"Origin": "https://unrelated.invalid"})
        self.assertEqual(response.status, 403)


class BluetoothPermissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_refused_permission_is_reported_instead_of_crashing_the_collector(self):
        # macOS aborts (SIGABRT, TCC) a process that touches CoreBluetooth without
        # a usage description, so the worker must never try to scan once the
        # child-process probe has been refused: it reports and waits instead.
        acquisition = Acquisition(validate_config({"ble": {"enabled": True}}), None, "")
        with patch("device_gateway.bluetooth_permitted", return_value=False), \
                patch("device_gateway.listening_scanner") as scanner:
            task = asyncio.create_task(acquisition.ble_worker())
            await asyncio.sleep(.2)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        scanner.assert_not_called()
        self.assertEqual(acquisition.stream.devices["ble"]["state"], "blocked")
        self.assertEqual(acquisition.stream.devices["ble"]["reason"], "bluetooth-permission")


class FastSleep:
    """asyncio stand-in whose sleeps are instant, so a loop can be watched."""

    def __init__(self, real):
        self._real = real

    def __getattr__(self, name):
        return getattr(self._real, name)

    async def sleep(self, *_args, **_kwargs):
        return await self._real.sleep(0)


class FakeScanner:
    """Stands in for the long-lived scanner, without a radio.

    A real scan is continuous: one sighting is refreshed while the device stays
    in range. Emitting once at start models a device that is present, and `emit`
    models one that appears later.
    """

    def __init__(self, found, callback):
        self.found = found
        self.callback = callback
        self.starts = 0
        self.stops = 0

    async def start(self):
        self.starts += 1
        for device, advert in self.found.values():
            self.emit(device, advert)

    async def stop(self):
        self.stops += 1

    def emit(self, device, advert):
        self.callback(device, advert)


def scanner_factory(found, created=None):
    def build(callback):
        scanner = FakeScanner(found, callback)
        if created is not None:
            created.append(scanner)
        return scanner
    return build


class BluetoothIdentificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_scanning_stops_being_reported_once_a_device_is_identified(self):
        # The radio rescans every few seconds to keep the nearby list current, and
        # the worker used to publish "scanning" at the top of every cycle. The
        # panel therefore alternated between 已識別 and 正在掃描 forever, which an
        # operator reads as identification having failed, and the picker looked
        # like it was resetting itself on every refresh.
        address = "81BD5162-0685-EF0B-167C-5E4F84D7FFF2"
        device = SimpleNamespace(address=address, name="HR-S0AA758")
        advert = SimpleNamespace(local_name="HR-S0AA758")
        acquisition = Acquisition(validate_config({"ble": {"enabled": True, "address": address}}), None, "")
        states = []
        original = acquisition.stream.status

        def record(key, **fields):
            if key == "ble" and "state" in fields:
                states.append(fields["state"])
            return original(key, **fields)

        acquisition.stream.status = record
        with patch("device_gateway.bluetooth_permitted", return_value=True), \
                patch("device_gateway.listening_scanner",
                      new=scanner_factory({address: (device, advert)})), \
                patch("device_gateway.asyncio", new=FastSleep(asyncio)):
            task = asyncio.create_task(acquisition.ble_worker())
            await asyncio.sleep(.1)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        # Identification is a one-way fact for the life of the worker: only the
        # very first cycle may say it is still looking.
        self.assertIn("ready", states)
        self.assertEqual(states.count("scanning"), 1)
        self.assertEqual(states[0], "scanning")
        self.assertEqual(acquisition.stream.devices["ble"]["state"], "ready")
        self.assertEqual(acquisition.stream.devices["ble"]["reason"], "awaiting-start")


class BluetoothConnectionTests(unittest.IsolatedAsyncioTestCase):
    """Start must connect on the next tick, and a failure must say what failed."""

    ADDRESS = "81BD5162-0685-EF0B-167C-5E4F84D7FFF2"

    def _found(self):
        device = SimpleNamespace(address=self.ADDRESS, name="HR-S0AA758")
        return {self.ADDRESS: (device, SimpleNamespace(local_name="HR-S0AA758"))}

    async def _run(self, config, client, created=None, seconds=0.1, timeout=None):
        acquisition = Acquisition(config, None, "")
        states = []
        original = acquisition.stream.status

        def record(key, **fields):
            if key == "ble" and "state" in fields:
                states.append((fields["state"], fields.get("reason")))
            return original(key, **fields)

        acquisition.stream.status = record
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch("device_gateway.bluetooth_permitted", return_value=True))
            stack.enter_context(patch("device_gateway.listening_scanner",
                                      new=scanner_factory(self._found(), created)))
            stack.enter_context(patch("device_gateway.BleakClient", new=client))
            stack.enter_context(patch("device_gateway.asyncio", new=FastSleep(asyncio)))
            if timeout is not None:
                stack.enter_context(patch("device_gateway.BLE_NO_DATA_TIMEOUT", timeout))
            task = asyncio.create_task(acquisition.ble_worker())
            await asyncio.sleep(seconds)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        return acquisition, states

    async def test_the_scanner_survives_a_failed_connection(self):
        # Rebuilding the scanner every cycle is what made "偶尔连得上" possible: a
        # fresh CoreBluetooth manager reports nothing for a moment, so the device
        # dropped out of the list between attempts. One scanner, one manager.
        attempts, created = [], []

        class Characteristic:
            uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Service:
            uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
            characteristics = [Characteristic()]

        class FlakyClient:
            def __init__(self, *_args, **_kwargs):
                self.services = [Service()]
                self.is_connected = True

            async def __aenter__(self):
                attempts.append(1)
                if len(attempts) == 1:
                    raise OSError("CoreBluetooth refused the connection")
                return self

            async def __aexit__(self, *_exc):
                return False

            async def start_notify(self, characteristic, callback):
                return None

        config = validate_config({"acquisition": {"running": True},
                                  "ble": {"enabled": True, "address": self.ADDRESS}})
        _acquisition, states = await self._run(config, FlakyClient, created=created)
        self.assertEqual(len(created), 1, "the scanner was rebuilt after a failure")
        self.assertEqual(created[0].starts, 1)
        self.assertGreaterEqual(len(attempts), 2, "the failure was not retried")
        self.assertIn(("retrying", "connect-failed"), states)
        self.assertIn(("connected-waiting-data", "waiting-data"), states)

    async def test_start_connects_within_a_tick_of_the_button(self):
        # The idle branch used to sleep five seconds and then rescan for five
        # more, so Start could look like it did nothing for ten seconds.
        config = validate_config({"ble": {"enabled": True, "address": self.ADDRESS}})
        acquisition = Acquisition(config, None, "")
        states = []
        original = acquisition.stream.status

        def record(key, **fields):
            if key == "ble" and "state" in fields:
                states.append(fields["state"])
            return original(key, **fields)

        acquisition.stream.status = record

        class Client:
            def __init__(self, *_args, **_kwargs):
                self.services = []
                self.is_connected = True

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_exc):
                return False

        # Real sleeps on purpose: this test is about wall-clock latency. The old
        # idle branch slept five seconds before it looked at the flag again, so
        # 0.4 s was not enough to see a connection attempt; the current tick is.
        with patch("device_gateway.bluetooth_permitted", return_value=True), \
                patch("device_gateway.listening_scanner",
                      new=scanner_factory(self._found())), \
                patch("device_gateway.BleakClient", new=Client):
            task = asyncio.create_task(acquisition.ble_worker())
            await asyncio.sleep(.05)
            self.assertEqual(acquisition.stream.devices["ble"]["state"], "ready")
            before = len(states)
            acquisition.config["acquisition"]["running"] = True
            await asyncio.sleep(.4)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.assertIn("connecting", states[before:], states)

    async def test_one_notify_characteristic_is_chosen_deterministically(self):
        # Subscribing to every notify characteristic duplicated bytes on
        # multi-service devices and the decoder reported them as protocol errors.
        subscribed = []

        class Ffe2:
            uuid = "0000ffe2-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Ffe1:
            uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Service:
            uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
            characteristics = [Ffe2(), Ffe1()]

        class Client:
            def __init__(self, *_args, **_kwargs):
                self.services = [Service()]
                self.is_connected = True

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_exc):
                return False

            async def start_notify(self, characteristic, callback):
                subscribed.append(characteristic.uuid)

        config = validate_config({"acquisition": {"running": True},
                                  "ble": {"enabled": True, "address": self.ADDRESS}})
        await self._run(config, Client, seconds=0.05)
        self.assertEqual(subscribed, [Ffe1.uuid])

    async def test_received_bytes_and_frames_are_published_for_bluetooth(self):
        # The 腦電 BLE row printed 「有效資料 · 0 bytes」 on a healthy link: USB
        # fills these counters in its read loop, and the radio never published
        # them at all, so the numbers could not be trusted during a wireless
        # session.
        class Characteristic:
            uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Service:
            uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
            characteristics = [Characteristic()]

        packet = frame(b"\x80\x02\x12\x34")

        class Client:
            def __init__(self, *_args, **_kwargs):
                self.services = [Service()]
                self.is_connected = True

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_exc):
                return False

            async def start_notify(self, characteristic, callback):
                for _ in range(3):
                    callback(characteristic, packet)

        config = validate_config({"acquisition": {"running": True},
                                  "ble": {"enabled": True, "address": self.ADDRESS}})
        acquisition, _states = await self._run(config, Client)
        row = acquisition.stream.devices["ble"]
        self.assertEqual(row["state"], "receiving")
        self.assertEqual(row["bytes"], len(packet) * 3)
        self.assertEqual(row["validPackets"], 3)
        self.assertEqual(row["protocolErrors"], 0)

    async def test_silence_after_connecting_is_not_reported_as_a_missing_device(self):
        class Characteristic:
            uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Service:
            uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
            characteristics = [Characteristic()]

        class SilentClient:
            def __init__(self, *_args, **_kwargs):
                self.services = [Service()]
                self.is_connected = True

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_exc):
                return False

            async def start_notify(self, characteristic, callback):
                return None

        config = validate_config({"acquisition": {"running": True},
                                  "ble": {"enabled": True, "address": self.ADDRESS}})
        _acquisition, states = await self._run(config, SilentClient, seconds=0.05, timeout=0.01)
        self.assertIn(("connected-waiting-data", "waiting-data"), states)
        self.assertIn(("retrying", "connect-failed"), states)
        self.assertNotIn(("waiting", "device-not-found"), states)


class RecordingLabelTests(unittest.TestCase):
    def test_a_stored_label_always_wins(self):
        # Renaming on a hardware change is the one thing the label must never do.
        self.assertEqual(recording_label({"eeg": {"deviceId": "MY-LAB-01"}}, "HR-S0AA758"),
                         "MY-LAB-01")

    def test_an_unset_label_falls_back_to_the_device(self):
        # unknown-device is the filename fallback, not a name: a fresh install, or
        # a label reset, is named after the hardware that is actually connected.
        self.assertEqual(recording_label({"eeg": {"deviceId": ""}}, "HR-S0AA758"), "HR-S0AA758")
        self.assertEqual(recording_label({"eeg": {"deviceId": "unknown-device"}}, "HR-S0AA758"),
                         "HR-S0AA758")
        self.assertEqual(recording_label({"eeg": {"deviceId": "unknown-device"}},
                                         "STM32 Virtual COM Port"), "STM32 Virt")

    def test_nothing_named_and_nothing_announced_stays_the_fallback(self):
        self.assertEqual(recording_label({"eeg": {"deviceId": ""}}), "")
        self.assertEqual(recording_label({"eeg": {"deviceId": ""}}, "n/a"), "")
        self.assertEqual(recording_label({"eeg": {"deviceId": ""}},
                                         "81BD5162-0685-EF0B-167C-5E4F84D7FFF2"), "")


class BluetoothRecordingTests(unittest.IsolatedAsyncioTestCase):
    """A Bluetooth session must be filed under the same label as a cable one."""

    async def _record_once(self, config, announced):
        class Characteristic:
            uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            properties = ["notify"]

        class Service:
            uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
            characteristics = [Characteristic()]

        class FakeClient:
            def __init__(self, *_args, **_kwargs):
                self.services = [Service()]
                self.is_connected = True

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_exc):
                return False

            async def start_notify(self, characteristic, callback):
                # One packet is enough: the filename is chosen before decoding.
                callback(characteristic, b"\xaa\xaa\x02\x80\xff\xd7")

        device = SimpleNamespace(address=config["ble"]["address"], name=announced)
        advert = SimpleNamespace(local_name=announced)
        with tempfile.TemporaryDirectory() as temporary:
            acquisition = Acquisition(config, Path(temporary) / "EEG Data")
            with patch("device_gateway.bluetooth_permitted", return_value=True), \
                    patch("device_gateway.listening_scanner",
                          new=scanner_factory({device.address: (device, advert)})), \
                    patch("device_gateway.BleakClient", new=FakeClient), \
                    patch("device_gateway.asyncio", new=FastSleep(asyncio)):
                task = asyncio.create_task(acquisition.ble_worker())
                await asyncio.sleep(.1)
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            acquisition.recorder.close()
            return Path(acquisition.storage_file).name if acquisition.storage_file else ""

    async def test_the_file_is_named_from_the_eeg_label_not_unknown_device(self):
        # The worker used to read `self.config["ble"]["deviceId"]`, which does not
        # exist, so every Bluetooth session landed as eeg-unknown-device-*.tgam
        # while the same label worked over USB.
        config = validate_config({"eeg": {"deviceId": "HR-S0AA758"},
                                  "acquisition": {"running": True},
                                  "ble": {"enabled": True,
                                          "address": "81BD5162-0685-EF0B-167C-5E4F84D7FFF2"}})
        name = await self._record_once(config, "HR-S0AA758")
        self.assertTrue(name.startswith("eeg-HR-S0AA758-"), name)

    async def test_an_unnamed_install_is_named_after_the_bluetooth_device(self):
        config = validate_config({"acquisition": {"running": True},
                                  "ble": {"enabled": True,
                                          "address": "81BD5162-0685-EF0B-167C-5E4F84D7FFF2"}})
        name = await self._record_once(config, "HR-S0AA758")
        self.assertTrue(name.startswith("eeg-HR-S0AA758-"), name)


class StaleInstanceTests(unittest.TestCase):
    """A collector started before the last edit must not answer for that edit.

    The build string is a hand-written constant, so it stayed identical while
    the gateway changed daily; single-instance reuse then served the old process
    and the only symptom was `405 Method Not Allowed` from the static catch-all
    for a route that exists only in the file.
    """

    def test_sources_newer_than_the_instance_mark_it_stale(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "device_gateway.py"
            source.write_text("", encoding="utf-8")
            os.utime(source, (1000, 1000))
            self.assertFalse(device_gateway.started_before_sources({"updatedAt": 1100}, temp))
            self.assertTrue(device_gateway.started_before_sources({"updatedAt": 900}, temp))

    def test_a_launch_is_not_stale_against_its_own_start_time(self):
        # runtime.json is written during startup, so an edit made one second
        # before this launch must not make the new process replace itself.
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "device_gateway.py"
            source.write_text("", encoding="utf-8")
            os.utime(source, (1000, 1000))
            self.assertFalse(device_gateway.started_before_sources({"updatedAt": 1000}, temp))

    def test_an_absent_timestamp_never_authorizes_a_replacement(self):
        self.assertFalse(device_gateway.started_before_sources({}))

    def test_no_gateway_sources_means_nothing_to_compare(self):
        with tempfile.TemporaryDirectory() as temp:
            self.assertEqual(device_gateway.newest_source_mtime(temp), 0.0)
            self.assertFalse(device_gateway.started_before_sources({"updatedAt": 5}, temp))

    def test_a_recording_session_is_never_terminated_to_reload_code(self):
        # Killing a worker mid-session ends the recording and opens a second
        # .tgam on the next start, so the takeover refuses and says why.
        with self.assertRaises(RuntimeError) as caught:
            asyncio.run(device_gateway.replace_stale_instance(
                FakeLiveClient({"acquisition": {"running": True}}),
                {"pid": 4321}, "http://127.0.0.1:8767/"))
        self.assertIn("正在采集", str(caught.exception))


class FakeLiveResponse:
    def __init__(self, payload):
        self.payload = payload

    async def json(self):
        return self.payload


class FakeLiveGet:
    def __init__(self, payload):
        self.payload = payload

    async def __aenter__(self):
        return FakeLiveResponse(self.payload)

    async def __aexit__(self, *_args):
        return False


class FakeLiveClient:
    """Only the one call replace_stale_instance() makes needs to work."""

    def __init__(self, payload):
        self.payload = payload

    def get(self, *_args, **_kwargs):
        return FakeLiveGet(self.payload)


if __name__ == "__main__":
    unittest.main()
