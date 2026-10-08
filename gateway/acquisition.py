"""Device identity and stream state independent of host-specific paths."""
from collections import deque
import copy
import threading
import time
import uuid


def choose_port(ports, profile):
    """Unique VID/PID identity; never select a recycled name or guess ambiguity."""
    if not profile.get("enabled", True):
        return ""
    if profile.get("vid") is None or profile.get("pid") is None:
        return ""
    matches = []
    for port in ports:
        if (port.vid, port.pid) != (profile["vid"], profile["pid"]):
            continue
        if profile.get("serialNumber") and port.serial_number != profile["serialNumber"]:
            continue
        if profile.get("location") and getattr(port, "location", "") != profile["location"]:
            continue
        matches.append(port.device)
    return matches[0] if len(matches) == 1 else ""


def inventory(ports):
    return [{"port": p.device, "description": p.description,
             "vid": p.vid, "pid": p.pid, "serialNumber": p.serial_number or "",
             "location": getattr(p, "location", "") or ""}
            for p in ports]


class Stream:
    def __init__(self, sample_rate=512):
        self.lock = threading.RLock()
        self.sample_rate = sample_rate
        self.session_id = uuid.uuid4().hex
        self.source = None
        self.epoch = 0
        self.fields, self.field_times = {}, {}
        self.raw = deque(maxlen=8192)
        self.sequence = 0
        self.frames = 0
        self.last_eeg = None
        self.last_usb = None
        self.sensors = {key: {"value": None, "at": None, "count": 0}
                        for key in ("spo2", "pr", "gsr")}
        self.devices = {}
        self.priorities = {"desktop_ble": 1, "usb": 2}

    def accept(self, source, fields, raw, now=None):
        now = time.time() if now is None else now
        if not fields and not raw:
            return False
        with self.lock:
            if (self.source and source != self.source and self.last_eeg is not None
                    and now - self.last_eeg < 3
                    and self.priorities[source] < self.priorities[self.source]):
                return False
            if self.source != source:
                self.source = source
                self.epoch += 1
                self.fields.clear()
                self.field_times.clear()
                self.raw.clear()
            self.frames += 1
            self.last_eeg = now
            if source == "usb":
                self.last_usb = now
            self.fields.update(fields)
            self.field_times.update({key: now for key in fields})
            for value in raw:
                self.sequence += 1
                self.raw.append((self.sequence, value))
            return True

    def sensor(self, key, value, now=None):
        now = time.time() if now is None else now
        with self.lock:
            state = self.sensors[key]
            state.update(value=value, at=now, count=state["count"] + 1)

    def status(self, key, **updates):
        with self.lock:
            self.devices.setdefault(key, {}).update(updates)

    def snapshot(self, cursor=0, now=None):
        now = time.time() if now is None else now
        with self.lock:
            fresh = self.last_eeg is not None and 0 <= now - self.last_eeg <= 3
            eeg = {key: value for key, value in self.fields.items()
                   if 0 <= now - self.field_times[key] <= 3}
            rows = [(seq, value) for seq, value in self.raw if seq > cursor] if fresh else []
            packet = {
                "schemaVersion": "neural-resonance-live-v1", "source": "device",
                "ts": now, "transport": self.source if fresh else "none",
                "connectionEpoch": self.epoch, "sampleRate": self.sample_rate,
                "sessionId": self.session_id,
                "rawSequence": self.sequence, "rawUnit": "ADC counts",
                "rawEegSamples": [value for _, value in rows],
                "rawDropped": max(0, rows[0][0] - cursor - 1) if rows else 0,
                "lastSampleAt": self.last_eeg, "metricOrigin": "thinkgear-esense",
                "fieldTimestamps": dict(self.field_times), "eeg": eeg,
                "quality": {"eegPackets": self.frames,
                            "spo2Samples": self.sensors["spo2"]["count"],
                            "prSamples": self.sensors["pr"]["count"],
                            "gsrSamples": self.sensors["gsr"]["count"]},
            }
            for key, state in self.sensors.items():
                packet[key] = (state["value"] if state["at"] is not None
                               and 0 <= now - state["at"] <= 15 else None)
            return packet

    def runtime(self):
        packet = self.snapshot()
        with self.lock:
            devices = copy.deepcopy(self.devices)
        return {
            "schemaVersion": "music-therapy-runtime-v1", "checkedAt": packet["ts"],
            "gateway": "neural-resonance-gateway", "devices": devices,
            "core": {
                "reachable": True, "source": "standalone-gateway", "mode": "LIVE",
                "eegSource": packet["transport"],
                "ports": {"brainlink": devices.get("eeg", {}).get("port", ""),
                          "bloodOxygen": devices.get("bloodOxygen", {}).get("port", "")},
                "streams": {"eeg": {"samples": self.sequence},
                            "spo2": {"samples": self.sensors["spo2"]["count"]},
                            "pr": {"samples": self.sensors["pr"]["count"]},
                            "gsr": {"samples": self.sensors["gsr"]["count"]}},
            },
        }
