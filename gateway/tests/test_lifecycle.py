from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from device_gateway import Acquisition, validate_config
from types import SimpleNamespace


class LifecycleTests(unittest.TestCase):
    def exercise(self, key, first, second):
        acquisition = Acquisition(validate_config({}))
        profile = acquisition.config[key]
        state = {"port": first, "now": 0, "reads": 0}
        devices = []

        def inventory():
            return [SimpleNamespace(device=state["port"], vid=profile["vid"],
                                    pid=profile["pid"], serial_number="", location="1-1")]

        def wait(_duration):
            state["now"] += 1
            return acquisition.stop_event.is_set()

        def serial_factory(*_args, **_kwargs):
            class Handle:
                dtr = rts = True
                port = None
                in_waiting = 64
                closed = False

                def open(self):
                    pass

                def close(self):
                    self.closed = True

                def read(self, _count):
                    state["now"] += 1.1
                    if self.port == first:
                        state["reads"] += 1
                        state["port"] = second
                        if state["reads"] > 3:
                            acquisition.stop_event.set()
                    else:
                        acquisition.stop_event.set()
                    if key == "eeg":
                        return b"\xaa\xaa\x04\x80\x02\x00\x01\x7c"
                    return b"Sp02 : 98% ,Pulse rate :72 bpm\n"
            handle = Handle()
            devices.append(handle)
            return handle

        with patch("device_gateway.list_ports.comports", side_effect=inventory), \
             patch("device_gateway.serial.Serial", side_effect=serial_factory), \
             patch("device_gateway.time.monotonic", side_effect=lambda: state["now"]), \
             patch.object(acquisition.stop_event, "wait", side_effect=wait):
            acquisition.serial_worker(key)
        self.assertEqual([device.port for device in devices], [first, second])
        self.assertEqual(state["reads"], 1)
        self.assertTrue(all(device.closed for device in devices))

    def test_windows_reassigned_com_port_closes_old_handle(self):
        self.exercise("eeg", "COM3", "COM25")

    def test_macos_reassigned_usbmodem_path_closes_old_handle(self):
        self.exercise("eeg", "/dev/cu.usbmodem1", "/dev/cu.usbmodem2")

    def test_macos_oxygen_reconnects_without_com_assumption(self):
        self.exercise("bloodOxygen", "/dev/cu.wchusbserial1", "/dev/cu.wchusbserial2")


if __name__ == "__main__":
    unittest.main()
