"""Watch fixtures verify validation, never stand in for physical measurements."""
import copy
import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition import Stream
from watch import WatchReading, watch_worker
from device_gateway import validate_config
from aiohttp import web
from aiohttp.test_utils import TestServer


def reading(**changes):
    return {"schemaVersion": "neural-watch-heart-v1", "sessionId": "watch-session",
            "state": "receiving", "sequence": 1, "bpm": 72.0, "accuracy": 3,
            "eventElapsedNs": 99_000_000_000, "nowElapsedNs": 100_000_000_000,
            **changes}


class WatchReadingTests(unittest.TestCase):
    def setUp(self):
        self.stream = Stream()
        self.reader = WatchReading(self.stream)

    def test_real_event_time_and_source_without_invented_brain_or_oxygen(self):
        packet = reading()
        original = copy.deepcopy(packet)
        self.assertTrue(self.reader.accept(packet, now=200))
        snap = self.stream.snapshot(now=200)
        self.assertEqual(snap["pr"], 72)
        self.assertEqual(snap["sensorTimestamps"]["pr"], 199)
        self.assertEqual(snap["sensorSources"]["pr"], "watch")
        self.assertEqual(snap["sensorDetails"]["pr"]["eventElapsedNs"], 99_000_000_000)
        self.assertEqual(snap["sensorDetails"]["pr"]["accuracy"], 3)
        self.assertEqual(snap["sensorDetails"]["pr"]["sequence"], 1)
        self.assertEqual(snap["quality"]["prSamples"], 1)
        self.assertEqual(snap["eeg"], {})
        self.assertIsNone(snap["spo2"])
        self.assertNotIn("hrv", snap)
        self.assertEqual(packet, original)

    def test_duplicate_poll_does_not_advance_counter_or_measurement_time(self):
        self.reader.accept(reading(), now=200)
        self.assertFalse(self.reader.accept(reading(nowElapsedNs=102_000_000_000), now=202))
        snap = self.stream.snapshot(now=202)
        self.assertEqual(snap["quality"]["prSamples"], 1)
        self.assertEqual(snap["sensorTimestamps"]["pr"], 199)

    def test_invalid_and_stale_values_clear_current_watch_sample(self):
        for changes in ({"bpm": float("nan")}, {"bpm": True}, {"bpm": 0},
                        {"bpm": 1001}, {"accuracy": 0}, {"accuracy": -1},
                        {"eventElapsedNs": 101_000_000_000},
                        {"eventElapsedNs": 80_000_000_000},
                        {"sequence": True}, {"nowElapsedNs": float("inf")},
                        {"schemaVersion": "other"}, {"state": "stopped"},
                        {"sessionId": []}):
            with self.subTest(changes=changes):
                stream = Stream()
                receiver = WatchReading(stream)
                receiver.accept(reading(), now=200)
                self.assertFalse(receiver.accept(reading(sequence=2, **{
                    key: value for key, value in changes.items() if key != "sequence"
                }) if "sequence" not in changes else reading(**changes), now=201))
                self.assertIsNone(stream.snapshot(now=201)["pr"])

    def test_sequence_and_device_event_time_must_both_advance(self):
        self.reader.accept(reading(sequence=3), now=200)
        self.assertFalse(self.reader.accept(reading(sequence=2), now=201))
        self.assertFalse(self.reader.accept(reading(sequence=4), now=201))
        self.assertEqual(self.stream.snapshot(now=201)["quality"]["prSamples"], 1)

    def test_new_app_session_accepts_reset_clock_and_sequence(self):
        self.reader.accept(reading(sequence=8), now=200)
        self.assertTrue(self.reader.accept(reading(sessionId="new-session",
                            eventElapsedNs=1_000_000_000, nowElapsedNs=2_000_000_000), now=205))
        snap = self.stream.snapshot(now=205)
        self.assertEqual(snap["quality"]["prSamples"], 2)
        self.assertEqual(snap["sensorTimestamps"]["pr"], 204)

    def test_watch_disconnect_does_not_clear_another_sensor_source(self):
        self.stream.sensor("pr", 65, now=200)
        self.reader.clear()
        self.assertEqual(self.stream.snapshot(now=200)["pr"], 65)


class WatchConfigurationTests(unittest.TestCase):
    def test_default_does_not_scan_or_connect_any_adb_device(self):
        self.assertFalse(validate_config({})["watch"]["enabled"])

    def test_input_rejects_missing_identity_flags_and_non_adb_programs(self):
        for profile in ({"enabled": True}, {"serial": "-a"},
                        {"serial": "host;other"}, {"adbPath": "/bin/sh"},
                        {"enabled": 1}, {"adbPath": 123}):
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                validate_config({"watch": profile})


class WatchTransportTests(unittest.IsolatedAsyncioTestCase):
    async def test_authentication_duplicate_polls_and_owned_forward_cleanup(self):
        stream, calls = Stream(), []
        token = "a" * 43
        http_calls = []
        async def current(request):
            http_calls.append(request.headers.get("Authorization"))
            return web.json_response(reading())
        app = web.Application()
        app.router.add_get("/current", current)
        server = TestServer(app)
        await server.start_server()

        class Process:
            returncode = 0
            def __init__(self, output):
                self.output = output.encode()
            async def communicate(self):
                return self.output, b""
        async def execute(*args, **options):
            calls.append(args)
            self.assertEqual(args[:3], ("adb", "-s", "test-watch"))
            command = args[3:]
            if command == ("shell", "pm", "has-feature", "android.hardware.type.watch"):
                return Process("true")
            if command == ("exec-out", "run-as", "org.neuralresonance.watch", "cat", "files/session-token"):
                return Process(token)
            if command == ("forward", "tcp:0", "tcp:18768"):
                return Process(str(server.port))
            self.assertEqual(command, ("forward", "--remove", f"tcp:{server.port}"))
            return Process("")
        try:
            with patch("watch.Path.is_file", return_value=True), patch("watch.asyncio.create_subprocess_exec", side_effect=execute):
                task = asyncio.create_task(watch_worker(
                    {"adbPath": "adb", "serial": "test-watch"}, stream))
                try:
                    async with asyncio.timeout(3):
                        while len(http_calls) < 2:
                            await asyncio.sleep(0.01)
                    self.assertEqual(stream.snapshot()["quality"]["prSamples"], 1)
                    self.assertEqual(http_calls, ["Bearer " + token] * len(http_calls))
                finally:
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                self.assertIsNone(stream.snapshot()["pr"])
                self.assertEqual(calls[-1][3:], ("forward", "--remove", f"tcp:{server.port}"))
        finally:
            await server.close()


if __name__ == "__main__":
    unittest.main()
