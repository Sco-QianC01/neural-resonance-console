"""Device identity and stream state independent of host-specific paths."""
from collections import deque
import copy
import math
import threading
import time
import uuid


def unique_ports(ports):
    """macOS's cu/tty aliases name the same serial device, not two sensors."""
    names = {p.device for p in ports}
    return [p for p in ports if not (p.device.startswith("/dev/tty.")
            and "/dev/cu." + p.device[len("/dev/tty."):] in names)]


def serial_selection(ports, profile):
    if not profile.get("enabled", True):
        return "", "disabled", 0
    if profile.get("vid") is None or profile.get("pid") is None:
        return "", "profile-unconfigured", 0
    matches = []
    model_count = 0
    for port in unique_ports(ports):
        if (port.vid, port.pid) != (profile["vid"], profile["pid"]):
            continue
        model_count += 1
        if profile.get("serialNumber") and port.serial_number != profile["serialNumber"]:
            continue
        if profile.get("location") and getattr(port, "location", "") != profile["location"]:
            continue
        matches.append(port.device)
    if len(matches) == 1:
        return matches[0], "selected", 1
    if len(matches) > 1:
        return "", "ambiguous-devices", len(matches)
    return "", ("saved-device-missing" if model_count else "device-not-found"), 0


def choose_port(ports, profile):
    """Unique VID/PID identity; never select a recycled name or guess ambiguity."""
    return serial_selection(ports, profile)[0]


def inventory(ports):
    return [{"port": p.device, "description": p.description,
             "vid": p.vid, "pid": p.pid, "serialNumber": p.serial_number or "",
             "location": getattr(p, "location", "") or ""}
            for p in unique_ports(ports)]

def ble_candidates(found, profile):
    """Prefer an explicitly saved address/UUID; names only identify unique defaults."""
    rows=[]
    address=profile.get("address", "").casefold()
    for device, advert in found.values():
        name=advert.local_name or device.name or ""
        if address:
            matches=device.address.casefold()==address
        else:
            matches=any(name.casefold().startswith(p.casefold())
                        for p in profile["namePrefixes"])
        if matches:
            rows.append((device, name))
    return rows


def ble_nearby(found):
    """Every advertising device in range, matched or not.

    A saved identity intentionally never falls back to a same-named device, so
    "no match" is the normal state for a device that moved. Reporting the whole
    neighbourhood keeps that strictness diagnosable: zero rows means the radio
    or the permission is the problem, rows mean the identity or the name filter
    is, and the operator can pick the right row instead of guessing.
    """
    rows = []
    for device, advert in found.values():
        name = (advert.local_name or device.name or "").strip()
        if name:
            rows.append({"name": name, "address": device.address})
    return sorted(rows, key=lambda row: (row["name"].casefold(), row["address"]))


# A page that opens mid-acquisition used to draw a curve that only ever had as
# many seconds as the tab had been open: the browser starts accumulating on the
# first socket frame and keeps everything in memory. Buffering one minute of
# aggregated points here lets a new client fill the window it advertises, with
# the collector's own clock instead of the page's.
HISTORY_SECONDS = 60
HISTORY_LIMIT = 600
HISTORY_TRIGGERS = ("attention", "meditation", "poor_signal", "poorSignal",
                    "delta", "theta", "lowAlpha", "highAlpha",
                    "lowBeta", "highBeta", "lowGamma", "midGamma")
HISTORY_BANDS = ("delta", "theta", "lowAlpha", "highAlpha",
                 "lowBeta", "highBeta", "lowGamma", "midGamma")


class Stream:
    def __init__(self, sample_rate=512):
        self.lock = threading.RLock()
        self.sample_rate = sample_rate
        self.session_id = uuid.uuid4().hex
        self.source = None
        self.epoch = 0
        self.fields, self.field_times, self.field_monotonic = {}, {}, {}
        self.last_eeg_monotonic = self.last_usb_monotonic = None
        self.packet_sequence = self.pair_sequence = 0
        self.index_pair = None
        self.raw = deque(maxlen=8192)
        self.history = deque(maxlen=HISTORY_LIMIT)
        self.sequence = 0
        self.protocol_errors = 0
        self.raw_break_pending = False
        self.frames = 0
        self.last_eeg = None
        self.last_usb = None
        self.sensors = {key: {"value": None, "at": None, "count": 0, "source": None, "details": None, "monotonic": None}
                        for key in ("spo2", "pr", "gsr")}
        self.devices = {}
        self.priorities = {"desktop_ble": 1, "usb": 2}
        self.connections = {}

    def new_connection(self, source):
        with self.lock:
            token = self.connections.get(source, 0) + 1
            self.connections[source] = token
            if self.source == source:
                self._clear_eeg()
            return token

    def end_connection(self, source, token):
        with self.lock:
            if self.connections.get(source) != token:
                return
            self.connections[source] += 1
            if self.source == source:
                self._clear_eeg()

    def _clear_eeg(self):
        self.source = None
        self.fields.clear()
        self.field_times.clear()
        self.field_monotonic.clear()
        self.index_pair = None
        self.raw.clear()
        self.history.clear()
        self.last_eeg = None
        self.last_usb = None
        self.last_eeg_monotonic = self.last_usb_monotonic = None
        self.protocol_errors = 0
        self.raw_break_pending = False
        # The counter describes one acquisition, not the life of the collector:
        # leaving it running after Stop showed the previous session's total on
        # screen while nothing was being received. The raw sequence is separate
        # and must stay monotonic — clients use it as a cursor.
        self.frames = 0

    def accept(self, source, fields, raw, now=None, connection=None, protocol_errors=None, mono=None):
        mono = time.monotonic() if mono is None and now is None else now if mono is None else mono
        now = time.time() if now is None else now
        if not fields and not raw:
            return False
        if protocol_errors is not None and (type(protocol_errors) is not int or protocol_errors < 0):
            return False
        with self.lock:
            if connection is not None and self.connections.get(source) != connection:
                return False
            if (self.source and source != self.source and self.last_eeg is not None
                    and 0 <= mono - self.last_eeg_monotonic < 3
                    and self.priorities[source] < self.priorities[self.source]):
                return False
            if self.source != source:
                self.source = source
                self.epoch += 1
                self.fields.clear()
                self.field_times.clear()
                self.field_monotonic.clear()
                self.index_pair = None
                self.raw.clear()
                self.history.clear()
                self.protocol_errors = 0
                self.raw_break_pending = False
                # An epoch is one connection's worth of data, so the packet count
                # starts over with it. Otherwise switching transports (or coming
                # back after Stop) continued the old total and the number never
                # matched what this session had actually received.
                self.frames = 0
            if protocol_errors is not None:
                if protocol_errors < self.protocol_errors:
                    return False
                if protocol_errors > self.protocol_errors:
                    self.raw_break_pending = True
                self.protocol_errors = protocol_errors
            self.frames += 1
            self.last_eeg = now
            self.last_eeg_monotonic = mono
            if source == "usb":
                self.last_usb = now
                self.last_usb_monotonic = mono
            self.fields.update(fields)
            self.field_times.update({key: now for key in fields})
            self.field_monotonic.update({key: mono for key in fields})
            if any(key in fields and not (type(fields[key]) in (int, float)
                   and math.isfinite(fields[key]) and 0 < fields[key] <= 100)
                   for key in ("attention", "meditation")):
                self.index_pair = None
            if all(type(fields.get(key)) in (int, float) and math.isfinite(fields[key])
                   and 0 < fields[key] <= 100 for key in ("attention", "meditation")):
                self.pair_sequence += 1
                self.index_pair = {"attention": fields["attention"], "meditation": fields["meditation"],
                                   "at": now, "monotonic": mono, "sequence": self.pair_sequence}
            self._record_history(now, fields)
            for value in raw:
                self.sequence += 1
                self.raw.append((self.sequence, value, self.raw_break_pending))
                self.raw_break_pending = False
            if raw:
                self.field_times["raw"] = now
                self.field_monotonic["raw"] = mono
            return True

    def _record_history(self, now, fields):
        """Keep one aggregated point per tick, merged across packet types.

        eSense (0x04/0x05) and band power (0x83) can arrive in separate frames.
        Storing each frame separately would give the page two interleaved series,
        each missing the other's values, so a point carries the current merged
        state and is rewritten while the same tick is still arriving.
        """
        if not any(key in fields for key in HISTORY_TRIGGERS):
            return
        point = {"ts": now, "packets": self.frames, "bands": {}}
        for key in ("attention", "meditation"):
            value = self.fields.get(key)
            if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 100:
                point[key] = value
        for key in HISTORY_BANDS:
            value = self.fields.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
                point["bands"][key] = float(value)
        poor = self.fields.get("poor_signal", self.fields.get("poorSignal"))
        if isinstance(poor, int) and not isinstance(poor, bool) and 0 <= poor <= 200:
            point["poorSignal"] = poor
        if not point["bands"] and "attention" not in point and "meditation" not in point:
            return
        if self.history and now - self.history[-1]["ts"] < 0.25:
            self.history[-1] = point
        else:
            self.history.append(point)

    def history_payload(self, now):
        """The buffered minute plus the identity it belongs to.

        The client must not infer the session from the packet it arrived in: a
        heartbeat reports transport "none" while these points still belong to
        the live link, and a page that guessed wrong would clear them again on
        the next frame.
        """
        rows = []
        for point in self.history:
            if not 0 <= now - point["ts"] <= HISTORY_SECONDS:
                continue
            row = dict(point)
            row["bands"] = dict(point["bands"])
            rows.append(row)
        return {"source": "device", "sessionId": self.session_id,
                "transport": self.source or "none", "connectionEpoch": self.epoch,
                "seconds": HISTORY_SECONDS, "points": rows}

    def sensor(self, key, value, now=None, source=None, details=None, mono=None):
        if type(value) not in (int, float) or not math.isfinite(value):
            return False
        mono = time.monotonic() if mono is None and now is None else now if mono is None else mono
        now = time.time() if now is None else now
        with self.lock:
            state = self.sensors[key]
            state.update(value=value, at=now, count=state["count"] + 1,
                         source=source or ("bloodOxygen" if key in ("spo2", "pr") else "gsr"),
                         details=copy.deepcopy(details), monotonic=mono)
            return True

    def clear_sensor(self, key, source=None):
        with self.lock:
            if source is None or self.sensors[key]["source"] == source:
                self.sensors[key].update(value=None, at=None, source=None, details=None, monotonic=None)

    def status(self, key, **updates):
        with self.lock:
            self.devices.setdefault(key, {}).update(updates)

    def snapshot(self, cursor=0, now=None, mono=None, backfill=False):
        mono = time.monotonic() if mono is None and now is None else now if mono is None else mono
        now = time.time() if now is None else now
        with self.lock:
            self.packet_sequence += 1
            fresh = self.last_eeg_monotonic is not None and 0 <= mono - self.last_eeg_monotonic <= 3
            eeg = {key: value for key, value in self.fields.items()
                   if 0 <= mono - self.field_monotonic[key] <= 3}
            rows = [row for row in self.raw if row[0] > cursor] if fresh else []
            packet = {
                "schemaVersion": "neural-resonance-live-v1", "source": "device",
                "clock": {"schema": "neural-stream-clock-v1", "monotonicMs": mono * 1000},
                "packetSequence": self.packet_sequence,
                "fieldAgesMs": {key: max(0, (mono - at) * 1000) for key, at in self.field_monotonic.items()},
                "sensorAgesMs": {key: max(0, (mono - state["monotonic"]) * 1000)
                                 if state["monotonic"] is not None else None
                                 for key, state in self.sensors.items()},
                "indexPair": ({key: value for key, value in self.index_pair.items() if key != "monotonic"}
                              | {"ageMs": (mono - self.index_pair["monotonic"]) * 1000}
                              if self.index_pair and fresh and 0 <= mono - self.index_pair["monotonic"] <= 3 else None),
                "ts": now, "transport": self.source if fresh else "none",
                "connectionEpoch": self.epoch, "sampleRate": self.sample_rate,
                "sessionId": self.session_id,
                "rawSequence": self.sequence, "rawUnit": "ADC counts",
                "bandUnits": "ThinkGear relative power",
                "rawEegSamples": [row[1] for row in rows],
                "rawBreaks": [i for i, row in enumerate(rows) if row[2]],
                "rawDropped": max(0, rows[0][0] - cursor - 1) if rows else 0,
                "lastSampleAt": self.last_eeg, "metricOrigin": "thinkgear-esense",
                "fieldTimestamps": dict(self.field_times), "eeg": eeg,
                "sensorTimestamps": {key: state["at"] for key, state in self.sensors.items()},
                "sensorSources": {key: state["source"] for key, state in self.sensors.items()},
                "sensorDetails": {key: copy.deepcopy(state["details"]) for key, state in self.sensors.items()},
                "quality": {"eegPackets": self.frames,
                            "protocolErrors": self.protocol_errors,
                            "spo2Samples": self.sensors["spo2"]["count"],
                            "prSamples": self.sensors["pr"]["count"],
                            "gsrSamples": self.sensors["gsr"]["count"]},
            }
            for key, state in self.sensors.items():
                packet[key] = (state["value"] if state["at"] is not None
                               and 0 <= mono - state["monotonic"] <= 15 else None)
            if backfill:
                packet["history"] = self.history_payload(now)
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
