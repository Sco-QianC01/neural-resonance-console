"""Synthetic protocol/clock faults; these are not physical-device acceptance."""
import asyncio
import json
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquisition import Stream
from protocols import gsr
from watch import WatchReading
from device_gateway import Acquisition, validate_config


class ClockTests(unittest.TestCase):
    def test_wall_clock_steps_cannot_expire_or_revive_measurements(self):
        stream = Stream()
        stream.accept('usb', {'attention': 60, 'meditation': 70}, [1], now=1000, mono=10)
        stream.sensor('gsr', 42, now=1000, mono=10)
        jumped = stream.snapshot(now=9000, mono=11)
        self.assertEqual(jumped['eeg']['attention'], 60)
        self.assertEqual(jumped['fieldTimestamps']['attention'], 1000)
        self.assertEqual(jumped['indexPair']['ageMs'], 1000)
        self.assertEqual(jumped['fieldAgesMs']['attention'], 1000)
        self.assertEqual(jumped['sensorAgesMs']['gsr'], 1000)
        expired = stream.snapshot(now=999, mono=26)
        self.assertEqual(expired['eeg'], {})
        self.assertIsNone(expired['gsr'])
        self.assertIsNone(expired['indexPair'])
        self.assertGreater(expired['packetSequence'], jumped['packetSequence'])
        self.assertEqual(expired['clock']['monotonicMs'], 26000)

    def test_index_pair_is_same_report_and_does_not_refresh_on_raw_or_single_metric(self):
        stream = Stream()
        stream.accept('usb', {'attention': 60}, [], now=10)
        stream.accept('usb', {'meditation': 70}, [], now=11)
        self.assertIsNone(stream.snapshot(now=11)['indexPair'])
        stream.accept('usb', {'attention': 62, 'meditation': 72}, [], now=12)
        pair = stream.snapshot(now=12)['indexPair']
        stream.accept('usb', {'attention': 80}, [4], now=13)
        current = stream.snapshot(now=13)
        self.assertEqual(current['indexPair']['attention'], 62)
        self.assertEqual(current['indexPair']['sequence'], pair['sequence'])
        stream.accept('usb', {'attention': 0}, [], now=13.1)
        self.assertIsNone(stream.snapshot(now=13.1)['indexPair'])
        stream.accept('usb', {'attention': 80}, [], now=13.2)
        self.assertIsNone(stream.snapshot(now=13.2)['indexPair'])
        stream.accept('usb', {}, [5], now=16)
        self.assertIsNone(stream.snapshot(now=16)['indexPair'])
        token = stream.new_connection('usb')
        stream.accept('usb', {'attention': 60}, [], now=17, connection=token)
        self.assertIsNone(stream.snapshot(now=17)['indexPair'])

    def test_nonfinite_gsr_does_not_poison_mixed_sensor_json(self):
        stream = Stream()
        stream.sensor('spo2', 98, now=10)
        stream.sensor('pr', 72, now=10)
        self.assertIsNone(gsr('GSR: ' + '9' * 400))
        for value in (float('inf'), float('nan'), True):
            self.assertFalse(stream.sensor('gsr', value, now=10))
        packet = stream.snapshot(now=10)
        self.assertEqual(packet['spo2'], 98)
        self.assertEqual(packet['pr'], 72)
        self.assertIsNone(packet['gsr'])
        json.loads(json.dumps(packet, allow_nan=False))

    def test_watch_device_age_survives_transport_and_wall_clock_changes(self):
        stream = Stream()
        reader = WatchReading(stream)
        packet = dict(schemaVersion='neural-watch-heart-v1', sessionId='watch', state='receiving',
                      sequence=1, bpm=72, accuracy=3, eventElapsedNs=1_000_000_000,
                      nowElapsedNs=15_000_000_000)
        self.assertTrue(reader.accept(packet, now=1000, mono=100))
        self.assertEqual(stream.snapshot(now=9000, mono=100)['pr'], 72)
        self.assertEqual(stream.snapshot(now=999, mono=100)['sensorAgesMs']['pr'], 14000)
        self.assertFalse(reader.accept(packet, now=2000, mono=102))
        self.assertIsNone(stream.snapshot(now=986, mono=102)['pr'])


class RecoveryTests(unittest.TestCase):
    def test_garbage_bytes_trigger_reopen_for_every_serial_adapter(self):
        for key in ('eeg', 'bloodOxygen', 'gsr'):
            with self.subTest(key=key):
                acquisition = Acquisition(validate_config({}))
                profile = acquisition.config[key]
                profile.update(vid=1, pid=2, enabled=True)
                clock = {'at': 0}
                handles = []
                def factory(**_kwargs):
                    class Handle:
                        in_waiting = 64
                        def open(self):
                            handles.append(self)
                            if len(handles) == 2:
                                acquisition.stop_event.set()
                        def read(self, _count):
                            clock['at'] += 10
                            return b'garbage\n'
                        def close(self):
                            self.closed = True
                    return Handle()
                port = SimpleNamespace(device='COM1', vid=1, pid=2, serial_number='', location='')
                with patch('device_gateway.serial.Serial', side_effect=factory), \
                     patch('device_gateway.list_ports.comports', return_value=[port]), \
                     patch('device_gateway.time.monotonic', side_effect=lambda: clock['at']), \
                     patch.object(acquisition.stop_event, 'wait', return_value=False):
                    acquisition.serial_worker(key)
                self.assertEqual(len(handles), 2)
                self.assertTrue(all(handle.closed for handle in handles))


class BleRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_ble_silence_degrades_then_disconnect_clears_status(self):
        acquisition = Acquisition(validate_config({}))
        states = []
        clock = {'at': 100}
        characteristic = SimpleNamespace(uuid='notify', properties=['notify'])
        device = SimpleNamespace(address='AA:01', name='BrainLink')
        advert = SimpleNamespace(local_name='BrainLink')
        def status(key, **changes):
            states.append(changes.get('state'))
            Stream.status(acquisition.stream, key, **changes)
        class Client:
            services = [SimpleNamespace(uuid='service', characteristics=[characteristic])]
            is_connected = True
            async def __aenter__(self):
                return self
            async def __aexit__(self, *_args):
                acquisition.stop_event.set()
            async def start_notify(self, char, callback):
                payload = b'\x04\x3c\x05\x46'
                callback(char, b'\xaa\xaa' + bytes([len(payload)]) + payload + bytes([(~sum(payload)) & 255]))
        async def sleep(_seconds):
            clock['at'] += 4
            if clock['at'] > 104:
                acquisition.stop_event.set()
        async def discover(**_kwargs):
            return {'device': (device, advert)}
        with patch('device_gateway.BleakScanner.discover', side_effect=discover), \
             patch('device_gateway.BleakClient', return_value=Client()), \
             patch('device_gateway.time.monotonic', side_effect=lambda: clock['at']), \
             patch('device_gateway.asyncio.sleep', side_effect=sleep), \
             patch.object(acquisition.stream, 'status', side_effect=status):
            await acquisition.ble_worker()
        self.assertIn('receiving', states)
        self.assertIn('connected-waiting-data', states[states.index('receiving') + 1:])
        self.assertEqual(acquisition.stream.devices['ble']['state'], 'waiting')
        self.assertEqual(acquisition.stream.snapshot()['transport'], 'none')
