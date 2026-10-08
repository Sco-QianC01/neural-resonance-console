"""Vendor byte formats only: missing measurements stay missing."""
import re

POWER_FIELDS = (
    "delta", "theta", "lowAlpha", "highAlpha",
    "lowBeta", "highBeta", "lowGamma", "midGamma",
)


class ThinkGear:
    def __init__(self):
        self.buffer = bytearray()
        self.valid_frames = 0
        self.errors = 0

    def feed(self, data):
        self.buffer.extend(data)
        output = []
        while len(self.buffer) >= 4:
            if self.buffer[:2] != b"\xaa\xaa":
                del self.buffer[0]
                continue
            size = self.buffer[2]
            if size > 169:
                del self.buffer[0]
                continue
            if len(self.buffer) < size + 4:
                break
            payload = bytes(self.buffer[3:3 + size])
            checksum = self.buffer[3 + size]
            if (~sum(payload)) & 255 != checksum:
                del self.buffer[0]
                self.errors += 1
                continue
            del self.buffer[:size + 4]
            parsed = self.parse(payload)
            if parsed is not None:
                self.valid_frames += 1
                output.append(parsed)
            else:
                self.errors += 1
        return output

    @staticmethod
    def parse(payload):
        fields, raw, i = {}, [], 0
        while i < len(payload):
            extended = 0
            while i < len(payload) and payload[i] == 0x55:
                extended += 1
                i += 1
            if i >= len(payload):
                return None
            code = payload[i]
            i += 1
            if code >= 0x80:
                if i >= len(payload):
                    return None
                size = payload[i]
                i += 1
            else:
                size = 1
            if i + size > len(payload):
                return None
            value = payload[i:i + size]
            i += size
            if extended:
                continue
            if code in (2, 4, 5):
                fields[{2: "poor_signal", 4: "attention", 5: "meditation"}[code]] = value[0]
            elif code == 0x80 and size == 2:
                raw.append(int.from_bytes(value, "big", signed=True))
            elif code == 0x83 and size == 24:
                fields.update({key: int.from_bytes(value[n * 3:n * 3 + 3], "big")
                               for n, key in enumerate(POWER_FIELDS)})
        return fields, raw


OXYGEN_RE = re.compile(
    r"Sp[O0]?2\s*:\s*(-?\d+)\s*%.*?Pulse\s*rate\s*:\s*(-?\d+)", re.I,
)


def oxygen(line):
    match = OXYGEN_RE.search(line)
    if not match:
        return None
    spo2, pulse = map(int, match.groups())
    return (spo2, pulse) if 50 <= spo2 <= 100 and 0 < pulse <= 240 else None


def gsr(line):
    match = re.fullmatch(r"\s*(?:GSR\s*[:=]\s*)?(\d+(?:\.\d+)?)\s*", line, re.I)
    return float(match[1]) if match else None
