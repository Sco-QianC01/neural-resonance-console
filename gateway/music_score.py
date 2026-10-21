"""A bounded symbolic study: one event source for notation, MIDI and playback."""
import base64
from copy import deepcopy
import hashlib
import json
import struct
import xml.etree.ElementTree as ET

SCHEMA = "music-score-sample-v1"
REVISION = "score-compiler-20261022-v1"
PPQ = 480
PROGRAMS = {"arco": 48, "pizzicato": 45}  # Zero-based GM presets, not a solo instrument's articulations.
VELOCITIES = {"p": 50, "mp": 64, "mf": 80}
PITCHES = tuple(p for p in range(60, 85) if p % 12 in {0, 1, 2, 4, 5, 7, 9, 10})


def example_score():
    pitches = [62, 65, 69, 67, 65, 64, 62, 69, 70, 69, 67, 65, 64, 61, 62, 62]
    return {"schemaVersion": SCHEMA, "title": "String study",
            "source": {"kind": "authored-demo", "model": None}, "tempoBpm": 80,
            "bars": [{"number": i + 1, "articulation": "arco" if i < 4 else "pizzicato",
                      "dynamic": ("p", "mp", "mp", "mf", "mp", "mp", "p", "p")[i],
                      "notes": [{"id": f"m{i + 1}n{j + 1}", "pitch": pitches[i * 2 + j],
                                 "beat": j * 2, "duration": 2} for j in range(2)]}
                     for i in range(8)]}


def exact_keys(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError("谱面字段不完整或包含未知字段。")


def validate_score(value):
    exact_keys(value, ("schemaVersion", "title", "source", "tempoBpm", "bars"))
    if value["schemaVersion"] != SCHEMA:
        raise ValueError("不支持的谱面版本。")
    title = value["title"]
    if (not isinstance(title, str) or not 1 <= len(title.strip()) <= 80
            or any(ord(c) < 32 or c in "<>" for c in title)):
        raise ValueError("标题须为1–80个可见字符。")
    exact_keys(value["source"], ("kind", "model"))
    source = value["source"]
    if source["kind"] not in ("authored-demo", "ollama", "edited"):
        raise ValueError("未知谱面来源。")
    if source["model"] is not None and (not isinstance(source["model"], str)
            or not 1 <= len(source["model"]) <= 128 or any(ord(c) < 32 for c in source["model"])):
        raise ValueError("模型来源格式无效。")
    if type(value["tempoBpm"]) is not int or not 48 <= value["tempoBpm"] <= 160:
        raise ValueError("速度须为48–160的整数BPM。")
    if not isinstance(value["bars"], list) or len(value["bars"]) != 8:
        raise ValueError("样例必须完整包含8小节。")
    for i, bar in enumerate(value["bars"], 1):
        exact_keys(bar, ("number", "articulation", "dynamic", "notes"))
        if type(bar["number"]) is not int or bar["number"] != i:
            raise ValueError("小节号必须为连续整数1–8。")
        if not isinstance(bar["articulation"], str) or bar["articulation"] not in PROGRAMS:
            raise ValueError("演奏法仅支持arco或pizzicato。")
        if not isinstance(bar["dynamic"], str) or bar["dynamic"] not in VELOCITIES:
            raise ValueError("力度仅支持p、mp、mf。")
        if not isinstance(bar["notes"], list) or len(bar["notes"]) != 2:
            raise ValueError("每小节须包含两个二分音符。")
        for j, note in enumerate(bar["notes"], 1):
            exact_keys(note, ("id", "pitch", "beat", "duration"))
            if note["id"] != f"m{i}n{j}" or type(note["pitch"]) is not int or note["pitch"] not in PITCHES:
                raise ValueError("音符标识或D小调允许音高无效。")
            if type(note["beat"]) is not int or note["beat"] != (j - 1) * 2 \
                    or type(note["duration"]) is not int or note["duration"] != 2:
                raise ValueError("样例拍位固定为0、2，每音时值为两拍。")
    return deepcopy(value)


def canonical_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def _tag(parent, name, text=None, **attributes):
    element = ET.SubElement(parent, name, attributes)
    if text is not None:
        element.text = str(text)
    return element


def musicxml(score):
    root = ET.Element("score-partwise", version="4.0")
    _tag(_tag(root, "work"), "work-title", score["title"])
    ident = _tag(root, "identification")
    _tag(ident, "creator", "Neural Resonance · controlled study", type="composer")
    parts = _tag(root, "part-list")
    part_info = _tag(parts, "score-part", id="P1")
    _tag(part_info, "part-name", "GM Strings")
    instrument = _tag(part_info, "score-instrument", id="P1-I1")
    _tag(instrument, "instrument-name", "GM string preview")
    midi = _tag(part_info, "midi-instrument", id="P1-I1")
    _tag(midi, "midi-channel", 1)
    _tag(midi, "midi-program", PROGRAMS[score["bars"][0]["articulation"]] + 1)
    part = _tag(root, "part", id="P1")
    spellings = {0: ("C", 0), 1: ("C", 1), 2: ("D", 0), 4: ("E", 0),
                 5: ("F", 0), 7: ("G", 0), 9: ("A", 0), 10: ("B", -1)}
    for index, bar in enumerate(score["bars"]):
        measure = _tag(part, "measure", number=str(bar["number"]))
        if bar["number"] == 5:
            _tag(measure, "print", **{"new-system": "yes"})
        if bar["number"] == 1:
            attrs = _tag(measure, "attributes")
            _tag(attrs, "divisions", PPQ)
            key = _tag(attrs, "key")
            _tag(key, "fifths", -1)
            _tag(key, "mode", "minor")
            time = _tag(attrs, "time")
            _tag(time, "beats", 4)
            _tag(time, "beat-type", 4)
            clef = _tag(attrs, "clef")
            _tag(clef, "sign", "G")
            _tag(clef, "line", 2)
        previous = score["bars"][index - 1] if index else None
        if previous is None or previous["articulation"] != bar["articulation"]:
            direction = _tag(measure, "direction", placement="above")
            _tag(_tag(direction, "direction-type"), "words",
                 "arco" if bar["articulation"] == "arco" else "pizz.")
            if bar["number"] == 1:
                metro = _tag(_tag(direction, "direction-type"), "metronome")
                _tag(metro, "beat-unit", "quarter")
                _tag(metro, "per-minute", score["tempoBpm"])
        sound = _tag(measure, "sound", tempo=str(score["tempoBpm"]))
        midi = _tag(sound, "midi-instrument", id="P1-I1")
        _tag(midi, "midi-program", PROGRAMS[bar["articulation"]] + 1)
        if previous is None or previous["dynamic"] != bar["dynamic"]:
            dynamics = _tag(measure, "direction", placement="below")
            _tag(_tag(_tag(dynamics, "direction-type"), "dynamics"), bar["dynamic"])
            _tag(dynamics, "sound", dynamics=str(round(VELOCITIES[bar["dynamic"]] / 127 * 100, 4)))
        for note in bar["notes"]:
            element = _tag(measure, "note", id=note["id"])
            pitch = _tag(element, "pitch")
            step, alter = spellings[note["pitch"] % 12]
            _tag(pitch, "step", step)
            if alter:
                _tag(pitch, "alter", alter)
            _tag(pitch, "octave", note["pitch"] // 12 - 1)
            _tag(element, "duration", note["duration"] * PPQ)
            _tag(element, "type", "half")
            if alter == 1:
                _tag(element, "accidental", "sharp")
        if bar["number"] == 8:
            _tag(_tag(measure, "barline", location="right"), "bar-style", "light-heavy")
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding="unicode")


def _vlq(number):
    result = [number & 127]
    while number > 127:
        number >>= 7
        result.insert(0, (number & 127) | 128)
    return bytes(result)


def _track(events, end_tick):
    payload, previous = bytearray(), 0
    for tick, priority, message in sorted(events, key=lambda event: (event[0], event[1])):
        payload.extend(_vlq(tick - previous) + message)
        previous = tick
    payload.extend(_vlq(end_tick - previous) + b"\xff\x2f\x00")
    return b"MTrk" + struct.pack(">I", len(payload)) + payload


def midi_bytes(score):
    tempo = round(60_000_000 / score["tempoBpm"])
    meta = [(0, 0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
            (0, 1, b"\xff\x58\x04\x04\x02\x18\x08"),
            (0, 2, b"\xff\x59\x02\xff\x01")]
    notes = [(0, 0, bytes([0xB0, 0, 0])), (0, 0, bytes([0xB0, 32, 0])),
             (0, 0, bytes([0xB0, 7, 100])), (0, 0, bytes([0xB0, 11, 127]))]
    for bar in score["bars"]:
        start = (bar["number"] - 1) * 4 * PPQ
        marker = f"bar {bar['number']}".encode("ascii")
        meta.append((start, 3, b"\xff\x06" + _vlq(len(marker)) + marker))
        notes.append((start, 2, bytes([0xC0, PROGRAMS[bar["articulation"]]])))
        for note in bar["notes"]:
            tick = start + note["beat"] * PPQ
            notes.append((tick, 3, bytes([0x90, note["pitch"], VELOCITIES[bar["dynamic"]]])))
            notes.append((tick + note["duration"] * PPQ, 1, bytes([0x80, note["pitch"], 0])))
    end = 32 * PPQ
    return b"MThd" + struct.pack(">IHHH", 6, 1, 2, PPQ) + _track(meta, end) + _track(notes, end)


def compile_score(value):
    score = validate_score(value)
    seconds_per_beat = 60 / score["tempoBpm"]
    timeline = [{"number": bar["number"], "startSeconds": (bar["number"] - 1) * 4 * seconds_per_beat,
                 "endSeconds": bar["number"] * 4 * seconds_per_beat,
                 "program": PROGRAMS[bar["articulation"]], "velocity": VELOCITIES[bar["dynamic"]],
                 "articulation": bar["articulation"], "dynamic": bar["dynamic"]}
                for bar in score["bars"]]
    return {"score": score, "musicxml": musicxml(score),
            "midiBase64": base64.b64encode(midi_bytes(score)).decode("ascii"),
            "timeline": timeline, "scoreHash": hashlib.sha256(canonical_bytes(score)).hexdigest(),
            "durationSeconds": 32 * seconds_per_beat}
