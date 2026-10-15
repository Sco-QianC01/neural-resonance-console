"""Reproducible descriptors from the reviewed Vmus public example, not EEG inference.

Run with the existing analysis environment (numpy + PyAV). Original media stays
under artifacts; the application streams the official URL.
"""
import csv
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import av
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts/worm-3d-20261010/reference-music"
STEM = "Sunshine-ZAZ-XBN-2024_B73-107"
container = av.open(str(SOURCE / f"{STEM}.mp4"))
resampler = av.AudioResampler(format="fltp", layout="mono", rate=22050)
chunks = []
for frame in container.decode(audio=0):
    chunks.extend(f.to_ndarray().reshape(-1) for f in resampler.resample(frame))
chunks.extend(f.to_ndarray().reshape(-1) for f in resampler.resample(None))
audio = np.concatenate(chunks).astype(np.float64)
rate = 22050
duration = len(audio) / rate
with (SOURCE / f"{STEM}.csv").open(encoding="utf-8-sig") as f:
    marks = list(csv.DictReader(f))
times = [float(m["TIME"]) for m in marks]
assert len(times) == 169 and all(b > a for a, b in zip(times, times[1:]))
assert times[-1] < duration
# |8 denotes eighth-note markers; output uses explicit eighth-note rate.
assert "|8" in marks[0]["LABEL"] and all("|" not in m["LABEL"] for m in marks[1:])
rows = []
for i, t in enumerate(times[:-1]):
    end = times[i + 1]
    centre = (t + end) / 2
    segment = audio[max(0, round((centre - .05) * rate)):round((centre + .05) * rate)]
    rms = np.sqrt(np.mean(segment ** 2))
    spectrum = abs(np.fft.rfft(segment * np.hanning(len(segment))))
    frequencies = np.fft.rfftfreq(len(segment), 1 / rate)
    centroid = float(np.sum(spectrum * frequencies) / spectrum.sum()) if spectrum.sum() else None
    rows.append({
        "t": round(t, 6), "end": round(end, 6), "label": marks[i]["LABEL"].split("|")[0],
        "tempo": round(60 / (end - t), 4),
        "rhythm": round(1000 * (end - t), 4),
        "dynamics": round(20 * np.log10(max(rms, 1e-12)), 4),
        "timbre": round(centroid, 4) if centroid is not None else None,
        "audioWindowCentre": round(centre, 6),
    })
score = ET.parse(SOURCE / f"{STEM}.mei")
ns = {"m": "http://www.music-encoding.org/ns/mei"}
notes = score.findall(".//m:note", ns)
artics = score.findall(".//m:artic", ns)
slurs = score.findall(".//m:slur", ns)
metadata = json.loads((SOURCE / "source-and-validation.json").read_text())
result = {
    "schema": "performance-observations-v1",
    "title": metadata["title"], "performers": "章奧哲 · 小提琴 / 謝貝妮 · 鋼琴",
    "year": 2024, "duration": round(duration, 6), "media": metadata["media_uri"],
    "reference": metadata["official_entry"], "score": metadata["score_uri"],
    "marks": metadata["marks_uri"], "rows": rows,
    "method": {
        "tempo": "60 / Δt; annotated eighth-note markers; unit ♪/min",
        "rhythm": "1000 × Δt; annotated marker interval, not detected note onset",
        "dynamics": "20 log10 RMS; mono 22050 Hz; 100 ms centered between markers; digital dBFS, not perceived loudness",
        "timbre": "FFT magnitude spectral centroid; Hann window 100 ms; Hz; timbral descriptor, not instrument recognition",
        "alignment": "Each row represents [t,end). Audio window is centred in that interval. Outside marked support: missing.",
        "score": "Score totals only. MEI not aligned to audio; no time-local pitch/harmony/mode/form inferred.",
    },
    "scoreFacts": {
        "notes": len(notes), "chords": len(score.findall(".//m:chord", ns)),
        "slurs": len(slurs), "articulations": len(artics),
        "articulationTypes": sorted(set(a.get("artic", "") for a in artics)),
        "staffCount": len(score.findall(".//m:scoreDef/m:staffGrp//m:staffDef", ns)),
    },
    "sourceHashes": {f.name: hashlib.sha256(f.read_bytes()).hexdigest()
                     for f in SOURCE.glob(f"{STEM}.*")},
}
target = ROOT / "public/research/vmus-performance.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"intervals": len(rows), "duration": duration, "scoreFacts": result["scoreFacts"]}))
