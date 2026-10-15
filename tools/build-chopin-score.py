"""Reproduce the audited monophonic excerpt; refuse other files or score structures."""
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/research/chopin-score"
EXPECTED = "a3df083ed687d752b411df97ee2448b9f261d537c101c574ed6e18cf62eec60a"
COMMIT = "95dfb105c1669c72d10b04088566154f12d3dc1c"


def duration(token):
    match = re.search(r"(\d+)(?:%(\d+))?(\.*)", token)
    if not match or "q" in token:
        raise ValueError("Untimed or unsupported duration")
    value = Fraction(4 * int(match[2] or 1), int(match[1]))
    return value * sum((Fraction(1, 2**i) for i in range(len(match[3]) + 1)), Fraction())


def pitch(token):
    match = re.search(r"([a-g]+|[A-G]+)([-#n]*)", token)
    if not match or len(set(match[1])) != 1:
        raise ValueError("Unsupported pitch spelling")
    letters, signs = match.groups()
    octave = 3 + len(letters) if letters.islower() else 4 - len(letters)
    return dict(step=letters[0].upper(), alter=signs.count("#") - signs.count("-"), octave=octave)


def pair(value):
    return [value.numerator, value.denominator]


def build(text):
    events, ornaments, dynamics = [], [], []
    bar, at, remaining, opened_tie = 0, Fraction(), [Fraction(), Fraction()], None
    for row, line in enumerate(text.splitlines(), 1):
        if not line or line.startswith("!"):
            continue
        cells = line.split("\t")
        if line.startswith("="):
            next_bar = int(re.match(r"=(\d+)", cells[0])[1])
            if bar:
                assert at == 3 and not any(remaining), (bar, at, remaining)
            if next_bar == 9:
                assert opened_tie is None
                break
            assert next_bar == bar + 1
            bar, at = next_bar, Fraction()
            continue
        if line.startswith("*"):
            assert not any(v in {"*^", "*v", "*x", "*+"} for v in cells), "Voice changes outside excerpt scope"
            continue
        assert bar in range(1, 9) and len(cells) == 4
        tokens = [cells[0], cells[2]]
        grace = any("q" in t for t in tokens)
        upper = cells[2]
        if upper != ".":
            assert " " not in upper, "Chord or ambiguous melody: refuse highest-note selection"
            event = dict(id=f"op27-2-L{row}", bar=bar, onset=pair(at), sourceRows=[row], tokens=[upper])
            if "q" in upper:
                event.update(pitch=pitch(upper), duration=None, kind="ornament")
                ornaments.append(event)
            else:
                event.update(duration=pair(duration(upper)), kind="rest" if "r" in upper else "note",
                             pitch=None if "r" in upper else pitch(upper))
                if "_" in upper or "]" in upper:
                    assert opened_tie and opened_tie["pitch"] == event["pitch"]
                    assert opened_tie["bar"] == bar
                    previous_end = Fraction(*opened_tie["onset"]) + Fraction(*opened_tie["duration"])
                    assert previous_end == at
                    opened_tie["duration"] = pair(Fraction(*opened_tie["duration"]) + Fraction(*event["duration"]))
                    opened_tie["sourceRows"].append(row)
                    opened_tie["tokens"].append(upper)
                    if "]" in upper:
                        opened_tie = None
                else:
                    assert opened_tie is None
                    events.append(event)
                    if "[" in upper:
                        opened_tie = event
        if cells[3] not in {".", "<", ">", "[", "]"}:
            assert re.fullmatch(r"(?:p{1,3}|f{1,3}|mp|mf|fp|fz|sfz)", cells[3]), cells[3]
            dynamics.append(dict(bar=bar, onset=pair(at), mark=cells[3], sourceRow=row, grace=grace))
        if grace:
            assert tokens[0] == ".", "Simultaneous measured/grace data is outside this extractor"
            continue
        for i, token in enumerate(tokens):
            if token != ".":
                assert remaining[i] == 0
                remaining[i] = duration(token)
        assert all(v > 0 for v in remaining)
        delta = min(remaining)
        at += delta
        remaining = [v - delta for v in remaining]
    assert bar == 8 and len(ornaments) == 6
    return dict(
        schema="chopin-score-evidence-v1", workId=6, title="肖邦 · 降D大調夜曲 Op.27 No.2",
        range=[1, 8], staff=1, voice="upper-monophonic", unit="quarter-note",
        source=dict(
            title="First Editions of Fryderyk Chopin's Music", institution="The Fryderyk Chopin Institute",
            copyright="Copyright 2017–2021 The Fryderyk Chopin Institute",
            website="https://chopinscores.org", license="CC BY 4.0",
            licenseUrl="https://creativecommons.org/licenses/by/4.0/",
            url=f"https://github.com/pl-wnifc/humdrum-chopin-first-editions/blob/{COMMIT}/kern/027-1-Sm-002.krn",
            file="./public/research/chopin-score/027-1-Sm-002.krn", sha256=EXPECTED, commit=COMMIT,
            edition="M. Schlesinger, Paris · PL-Wbfc 3744/n · RISM 1001022558",
            transformation="Extracted bars 1–8, upper staff monophonic voice; ties merged, grace notes separated.",
        ),
        context=dict(key="降D大調", basis="explicit-source-key", meter="6/8", quartersPerBar=3,
                     scale=[dict(step=s, alter=a) for s, a in [("D", -1), ("E", -1), ("F", 0),
                            ("G", -1), ("A", -1), ("B", -1), ("C", 0)]]),
        events=events, ornaments=ornaments, dynamics=dynamics,
    )


if __name__ == "__main__":
    source = (DATA / "027-1-Sm-002.krn").read_bytes()
    assert hashlib.sha256(source).hexdigest() == EXPECTED, "Source changed; re-audit before extracting"
    assert duration("8.dd-") == Fraction(3, 4)
    assert duration("[4.a-") == Fraction(3, 2)
    assert pitch("16bb--") == dict(step="B", alter=-2, octave=5)
    result = build(source.decode("utf-8"))
    output = DATA / "op27-2-bars1-8.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(result['events'])} measured events; {len(result['ornaments'])} untimed ornaments; {output}")
