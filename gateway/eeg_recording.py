"""Save ThinkGear bytes in a self-describing, single-file TGAM container."""
from datetime import datetime
import json
from pathlib import Path
import re
import struct
import time

_MAGIC = b"NR-TGAM1"
_HEADER_CAPACITY = 4096
_PREFIX_SIZE = len(_MAGIC) + 4


def encode_header(metadata):
    encoded = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > _HEADER_CAPACITY:
        raise ValueError("TGAM session metadata exceeds the container header capacity")
    return _MAGIC + struct.pack(">I", len(encoded)) + encoded + bytes(_HEADER_CAPACITY - len(encoded))


def safe_device_id(value):
    label = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip()).strip("-._")
    return label[:64] or "unknown-device"


# The model part of a device name, as a person reads it on the box. Same rule as
# the front end (src/gateway-settings.mjs): first ten characters, trailing
# separators dropped, and a CoreBluetooth identifier is not a name at all.
DEVICE_NAME_LIMIT = 10
_NOT_A_NAME = {"", "n/a", "none", "unknown"}


def short_device_name(value, limit=DEVICE_NAME_LIMIT):
    text = str(value or "").strip()
    if text.casefold() in _NOT_A_NAME or re.match(r"^[0-9a-fA-F]{8}-", text):
        return ""
    return re.sub(r"[-_.\s]+$", "", text[:limit])


def local_timestamp(timestamp=None):
    value = datetime.now().astimezone() if timestamp is None else datetime.fromtimestamp(timestamp).astimezone()
    return value.isoformat(timespec="milliseconds")


class EEGSessionStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.handle = None
        self.path = None
        self.identity = None
        self.last_flush = 0.0
        self.last_path = None
        self.byte_count = 0
        self.metadata = None

    def _open(self, identity, device_id, transport, sample_rate, baud_rate, started_at):
        self.directory.mkdir(parents=True, exist_ok=True)
        started = datetime.fromtimestamp(started_at).astimezone()
        stamp = started.strftime("%Y%m%d-%H%M%S")
        base = f"eeg-{safe_device_id(device_id)}-{stamp}"
        suffix = 1
        while True:
            stem = base if suffix == 1 else f"{base}-{suffix:02d}"
            path = self.directory / f"{stem}.tgam"
            if not path.exists():
                break
            suffix += 1
        self.handle = path.open("xb")
        self.path = path
        self.last_path = path
        self.identity = identity
        self.last_flush = time.monotonic()
        self.byte_count = 0
        self.metadata = {
            "schema": "neural-resonance-tgam-v1",
            "container": "neural-resonance-tgam-container-v1",
            "deviceId": safe_device_id(device_id),
            "protocol": "ThinkGear / TGAM raw serial bytes",
            "transport": transport,
            "sessionId": identity[1],
            "sampleRate": sample_rate,
            "baudRate": baud_rate,
            "startedAt": local_timestamp(started_at),
            "byteCount": 0,
        }
        self.handle.write(encode_header(self.metadata))

    def _write_header(self, ended_at=None):
        value = {**self.metadata, "byteCount": self.byte_count}
        if ended_at is not None:
            value["endedAt"] = local_timestamp(ended_at)
        position = self.handle.tell()
        self.handle.seek(0)
        self.handle.write(encode_header(value))
        self.handle.seek(position)

    def append_raw(self, device_id, data, *, transport, session_id, sample_rate,
                   baud_rate=None, timestamp=None):
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise TypeError("Raw EEG data must be bytes-like")
        if not data:
            return
        timestamp = time.time() if timestamp is None else timestamp
        identity = (transport, session_id)
        if self.identity != identity:
            self.close()
            self._open(identity, device_id, transport, sample_rate, baud_rate, timestamp)
        self.handle.write(data)
        self.byte_count += len(data)
        if time.monotonic() - self.last_flush >= 1:
            self.handle.flush()
            self._write_header()
            self.handle.flush()
            self.last_flush = time.monotonic()

    def close(self, transport=None):
        if self.handle is None or (transport is not None and self.identity[0] != transport):
            return
        try:
            self.handle.flush()
            self._write_header(time.time())
            self.handle.flush()
        finally:
            self.handle.close()
            self.handle = None
            self.path = None
            self.identity = None
            self.metadata = None
