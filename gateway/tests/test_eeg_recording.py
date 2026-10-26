import json
from pathlib import Path
import sys
import struct
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from device_gateway import Acquisition, validate_config
from eeg_recording import EEGSessionStore, safe_device_id, short_device_name


class DeviceNameTests(unittest.TestCase):
    def test_names_are_cut_to_the_same_ten_characters_as_the_page(self):
        self.assertEqual(short_device_name("HR-S0AA758"), "HR-S0AA758")
        self.assertEqual(short_device_name("CP2102 USB to UART Bridge Controller"), "CP2102 USB")
        self.assertEqual(short_device_name("STM32 Virtual COM Port"), "STM32 Virt")

    def test_identifiers_and_non_names_are_not_names(self):
        # A CoreBluetooth identifier would be a worse label than nothing.
        self.assertEqual(short_device_name("81BD5162-0685-EF0B-167C-5E4F84D7FFF2"), "")
        self.assertEqual(short_device_name("n/a"), "")
        self.assertEqual(short_device_name(""), "")
        self.assertEqual(short_device_name(None), "")

    def test_trailing_separators_do_not_survive_the_cut(self):
        self.assertEqual(short_device_name("AB--------CD"), "AB")


class EEGRecordingTests(unittest.TestCase):
    def test_safe_device_id_never_becomes_a_path(self):
        self.assertEqual(safe_device_id("../SOA/FA758"), "SOA-FA758")
        self.assertEqual(safe_device_id(""), "unknown-device")

    def test_session_stores_metadata_and_exact_raw_bytes_in_one_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = EEGSessionStore(Path(temporary) / "EEG Data")
            store.append_raw("SOA-FA758", b"\xaa\xaa\x04\x80\x02\xff\xfd\xd2",
                             transport="usb", session_id="session-1", sample_rate=512,
                             baud_rate=57600, timestamp=1792252800)
            path = store.path
            store.append_raw("SOA-FA758", b"\xaa\xaa\x04\x80\x02\x00\x01\x7c",
                             transport="usb", session_id="session-1", sample_rate=512,
                             baud_rate=57600, timestamp=1792252800.01)
            store.close()

            self.assertEqual(path.parent.name, "EEG Data")
            self.assertTrue(path.name.endswith(".tgam"))
            self.assertFalse(path.with_suffix(".meta.json").exists())
            content = path.read_bytes()
            self.assertEqual(content[:8], b"NR-TGAM1")
            metadata_size = struct.unpack(">I", content[8:12])[0]
            metadata = json.loads(content[12:12 + metadata_size].decode("utf-8"))
            self.assertEqual(content[12 + 4_096:], b"\xaa\xaa\x04\x80\x02\xff\xfd\xd2\xaa\xaa\x04\x80\x02\x00\x01\x7c")
            self.assertEqual(metadata["deviceId"], "SOA-FA758")
            self.assertEqual(metadata["byteCount"], 16)
            self.assertEqual(metadata["container"], "neural-resonance-tgam-container-v1")
            self.assertEqual(metadata["transport"], "usb")
            self.assertEqual(metadata["sampleRate"], 512)
            self.assertEqual(metadata["baudRate"], 57600)
            self.assertIn("endedAt", metadata)

    def test_new_connection_creates_new_file_and_unknown_device_has_explicit_name(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = EEGSessionStore(temporary)
            store.append_raw("", b"one", transport="usb", session_id="session-1",
                             sample_rate=512, timestamp=1792252800)
            first = store.path
            store.append_raw("", b"two", transport="usb", session_id="session-2",
                             sample_rate=512, timestamp=1792252800.01)
            second = store.path
            store.close()

            self.assertNotEqual(first, second)
            self.assertTrue(first.name.startswith("eeg-unknown-device-"))
            self.assertTrue(second.exists())

    def test_acquisition_persists_only_accepted_device_packets(self):
        with tempfile.TemporaryDirectory() as temporary:
            acquisition = Acquisition(validate_config({"acquisition": {"running": True}}), Path(temporary) / "EEG Data")
            connection = acquisition.stream.new_connection("usb")
            acquisition.save_eeg_bytes("SOA-FA758", b"\xaa\xbb", "usb", connection)
            path = Path(acquisition.storage_file)
            acquisition.close_recording()
            content = path.read_bytes()
            self.assertEqual(content[:8], b"NR-TGAM1")
            self.assertEqual(content[12 + 4_096:], b"\xaa\xbb")


if __name__ == "__main__":
    unittest.main()
