"""Independent score workbench; optional sampler and local pitch planner."""
import array
import asyncio
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import struct
import sys
import tempfile
import time
import uuid
import wave
import zipfile

from aiohttp import ClientError, ClientSession, ClientTimeout, web

from music_score import (PITCHES, PROGRAMS, REVISION, VELOCITIES, canonical_bytes,
                         compile_score, example_score)

RENDER_REVISION = "gm-strings-preview-20261022-v1"
MODEL = "qwen3:4b"
OLLAMA_URL = "http://127.0.0.1:11435"
FILES = {"events.json", "score.musicxml", "performance.mid", "audio.wav", "report.json", "package.zip"}


def file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def renderer_status():
    binary = os.environ.get("NEURAL_SCORE_FLUIDSYNTH") or shutil.which("fluidsynth")
    font = os.environ.get("NEURAL_SCORE_SOUNDFONT")
    if not binary or not Path(binary).is_file():
        return {"ready": False, "renderer": None, "reason": "缺少FluidSynth；谱面和MIDI仍可导出。"}
    if not font or not Path(font).is_file():
        return {"ready": False, "renderer": None, "reason": "请配置已获许可的GM SoundFont。"}
    try:
        presets = soundfont_presets(Path(font))
    except ValueError:
        return {"ready": False, "renderer": None, "reason": "音源不是有效的SF2文件。"}
    if any((0, program) not in presets for program in PROGRAMS.values()):
        return {"ready": False, "renderer": None, "reason": "音源缺少bank 0的GM 48或45预置；未使用替代音色。"}
    return {"ready": True, "reason": None,
            "renderer": {"engine": "FluidSynth", "fontName": Path(font).name,
                         "preview": "GM弦乐预览", "programsZeroBased": PROGRAMS,
                         "presets": {name: presets[(0, program)] for name, program in PROGRAMS.items()},
                         "limitation": "持续弦乐与拨奏弦乐是两个GM预置，不是同一独奏乐器采样库的技巧切换。"}}


def soundfont_presets(path):
    """Read SF2 phdr only; never load sample payloads or guess missing presets."""
    with Path(path).open("rb") as handle:
        header = handle.read(12)
        if len(header) != 12 or header[:4] != b"RIFF" or header[8:] != b"sfbk":
            raise ValueError("Invalid SF2")
        limit = min(Path(path).stat().st_size, struct.unpack("<I", header[4:8])[0] + 8)
        while handle.tell() + 8 <= limit:
            chunk, size = struct.unpack("<4sI", handle.read(8))
            start = handle.tell()
            if start + size > limit:
                raise ValueError("Truncated SF2")
            if chunk == b"LIST" and size >= 4 and handle.read(4) == b"pdta":
                while handle.tell() + 8 <= start + size:
                    sub, length = struct.unpack("<4sI", handle.read(8))
                    if handle.tell() + length > start + size:
                        raise ValueError("Truncated SF2 preset data")
                    if sub == b"phdr":
                        if length < 38 or length % 38 or length > 4 * 1024 * 1024:
                            raise ValueError("Invalid SF2 presets")
                        data = handle.read(length)
                        return {(bank, program): name.split(b"\0")[0].decode("ascii", errors="replace")
                                for name, program, bank, *_ in struct.iter_unpack("<20sHHHIII", data[:-38])}
                    handle.seek(length + (length % 2), 1)
            handle.seek(start + size + (size % 2))
    raise ValueError("SF2 contains no preset headers")


async def compose_score(tempo):
    payload = {"model": MODEL, "stream": False, "think": False, "keep_alive": "60s",
               "options": {"temperature": 0, "num_ctx": 4096, "num_predict": 256},
               "format": {"type": "object", "properties": {"pitches": {"type": "array",
                          "items": {"type": "integer", "enum": list(PITCHES)}, "minItems": 16, "maxItems": 16}},
                          "required": ["pitches"], "additionalProperties": False},
               "messages": [{"role": "system", "content":
                   "Plan only the pitches for an eight-bar D-minor string study in 4/4. "
                   "Exactly two half notes per bar, 16 MIDI pitches in total. "
                   "Use the allowed D-minor pitches only, a modest singable contour with predominantly stepwise motion, "
                   "a contrasting second phrase and final D (62 or 74). Return only JSON {\"pitches\":[...]}. "
                   "Rhythm, articulation and dynamics are supplied by the application; do not claim to generate audio."},
                   {"role": "user", "content": json.dumps({"tempoBpm": tempo, "allowedPitches": PITCHES})}]}
    async with ClientSession(timeout=ClientTimeout(total=90), trust_env=False) as session:
        async def identity():
            async with session.get(OLLAMA_URL + "/api/tags", allow_redirects=False,
                                   timeout=ClientTimeout(total=3)) as response:
                if response.status != 200:
                    raise ValueError("本地模型不可用。")
                data = await response.json()
                models = data.get("models") if isinstance(data, dict) else None
                model = next((m for m in models if isinstance(m, dict) and m.get("name") == MODEL), None) if isinstance(models, list) else None
                digest = model.get("digest") if model else None
                if not isinstance(digest, str) or not re.fullmatch("[a-f0-9]{64}", digest):
                    raise ValueError("所需本地模型未安装或身份无效。")
                return digest
        digest = await identity()
        started = time.monotonic()
        async with session.post(OLLAMA_URL + "/api/chat", json=payload, allow_redirects=False) as response:
            if response.status != 200:
                raise ValueError("本地模型推理失败。")
            data = await response.json()
        if (not isinstance(data, dict) or data.get("model") != MODEL or data.get("done") is not True
                or data.get("done_reason") != "stop" or not isinstance(data.get("message"), dict)
                or data["message"].get("role") != "assistant"):
            raise ValueError("模型输出不完整或身份不符；未使用固定样例替代。")
        value = json.loads(data["message"]["content"])
        if not isinstance(value, dict) or set(value) != {"pitches"} or not isinstance(value["pitches"], list) \
                or len(value["pitches"]) != 16 or any(type(p) is not int or p not in PITCHES for p in value["pitches"]):
            raise ValueError("模型未返回16个允许音高。")
        if value["pitches"][-1] not in (62, 74):
            raise ValueError("模型未遵守结束音D；请重新规划。")
        if await identity() != digest:
            raise ValueError("推理期间模型已变化，请重新规划。")
    score = example_score()
    score.update(title="D minor · local pitch study", tempoBpm=tempo,
                 source={"kind": "ollama", "model": MODEL})
    for note, pitch in zip((n for b in score["bars"] for n in b["notes"]), value["pitches"]):
        note["pitch"] = pitch
    compile_score(score)
    return {"score": score, "model": {"name": MODEL, "digest": digest, "engine": "ollama",
            "durationMs": round((time.monotonic() - started) * 1000),
            "scope": "16 pitches only; fixed rhythm and expressions", "compilerRevision": REVISION}}


async def run_process(*args, timeout=30):
    process = await asyncio.create_subprocess_exec(*map(str, args),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    try:
        output, _ = await asyncio.wait_for(process.communicate(), timeout)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise
    if process.returncode:
        raise ValueError("音源进程失败；未发布音频。")
    return output.decode("utf-8", errors="replace")[-2000:]


def audio_stats(path, expected):
    with wave.open(str(path), "rb") as handle:
        channels, width, rate, frames = handle.getnchannels(), handle.getsampwidth(), handle.getframerate(), handle.getnframes()
        duration = frames / rate
        if channels != 2 or width != 2 or rate != 44100 or not expected - 0.02 <= duration <= expected + 12:
            raise ValueError("音频格式或时长不符合样例。")
        samples = array.array("h", handle.readframes(frames))
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples or len(samples) != frames * channels:
        raise ValueError("音源未生成完整有效采样。")
    peak = max(abs(n) for n in samples) / 32768
    rms = math.sqrt(sum(n * n for n in samples) / len(samples)) / 32768
    clipping = sum(abs(n) >= 32767 for n in samples)
    if rms <= 1e-6 or clipping:
        raise ValueError("音频静音或存在满幅削波；未发布音频。")
    return {"sampleRate": rate, "channels": channels, "bitsPerSample": width * 8,
            "frames": frames, "durationSeconds": round(duration, 6),
            "scoreDurationSeconds": expected, "releaseTailSeconds": round(duration - expected, 6),
            "peakDbfs": round(20 * math.log10(peak), 3), "rmsDbfs": round(20 * math.log10(rms), 3),
            "clippedSamples": clipping}


async def render_score(compiled, output_root, model_receipt=None):
    status = renderer_status()
    if not status["ready"]:
        raise ValueError(status["reason"])
    binary = Path(os.environ.get("NEURAL_SCORE_FLUIDSYNTH") or shutil.which("fluidsynth")).resolve()
    font = Path(os.environ["NEURAL_SCORE_SOUNDFONT"]).resolve()
    # The executable and licensed font stay local; packages contain only this performance.
    font_hash, binary_hash = file_hash(font), file_hash(binary)
    output_root = Path(output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    render_id = hashlib.sha256(canonical_bytes({"score": compiled["scoreHash"], "font": font_hash,
                                              "engine": binary_hash, "revision": RENDER_REVISION}) + uuid.uuid4().bytes).hexdigest()
    with tempfile.TemporaryDirectory(prefix=".stage-", dir=output_root) as stage_name:
        stage = Path(stage_name)
        (stage / "events.json").write_text(json.dumps(compiled["score"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (stage / "score.musicxml").write_text(compiled["musicxml"], encoding="utf-8")
        (stage / "performance.mid").write_bytes(base64.b64decode(compiled["midiBase64"]))
        version = await run_process(binary, "--version", timeout=5)
        await run_process(binary, "-ni", "-R", "0", "-C", "0", "-F", stage / "audio.wav",
                          "-T", "wav", "-O", "s16", "-r", "44100", "-g", "0.5", font, stage / "performance.mid")
        stats = await asyncio.to_thread(audio_stats, stage / "audio.wav", compiled["durationSeconds"])
        if file_hash(font) != font_hash or file_hash(binary) != binary_hash:
            raise ValueError("渲染期间音源或程序已变更；未发布音频。")
        report = {"schemaVersion": "music-score-render-v1", "renderId": render_id,
                  "scoreHash": compiled["scoreHash"], "compilerRevision": REVISION,
                  "renderRevision": RENDER_REVISION, "sourceClaim": compiled["score"]["source"],
                  "modelReceipt": model_receipt, "renderer": {**status["renderer"],
                  "versionOutput": version.strip(), "fontSha256": font_hash, "binarySha256": binary_hash,
                  "sampleRate": 44100, "gain": 0.5, "reverb": False, "chorus": False,
                  "velocityMapping": VELOCITIES, "velocityCaveat": "本预览的MIDI控制值，不是通用力度—响度标定。"},
                  "audio": stats, "timeline": compiled["timeline"],
                  "files": {name: {"sha256": file_hash(stage / name), "bytes": (stage / name).stat().st_size}
                            for name in ("events.json", "score.musicxml", "performance.mid", "audio.wav")},
                  "validation": {"bars": 8, "notes": 16, "meter": "4/4",
                    "scope": "event/export consistency and non-silent unclipped PCM; musical quality requires listening"}}
        (stage / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with zipfile.ZipFile(stage / "package.zip", "w", zipfile.ZIP_DEFLATED) as archive:
            for name in sorted(FILES - {"package.zip"}):
                archive.write(stage / name, name)
        stage.rename(output_root / render_id)
    names = {"events": "events.json", "musicxml": "score.musicxml", "midi": "performance.mid",
             "audio": "audio.wav", "report": "report.json", "package": "package.zip"}
    return {"scoreHash": compiled["scoreHash"], "renderId": render_id, "report": report,
            "artifacts": {key: f"/api/music-score/artifacts/{render_id}/{name}" for key, name in names.items()}}


def add_score_routes(app, root, inference_lock, output_root=None):
    output_root = Path(output_root or Path(root) / "artifacts/music-score-output").resolve()
    render_lock = asyncio.Lock()
    receipts = {}

    async def read_body(request, keys):
        if request.content_type != "application/json":
            raise web.HTTPUnsupportedMediaType()
        body = await request.json()
        if not isinstance(body, dict) or set(body) != set(keys):
            raise ValueError("请求字段无效。")
        return body

    async def example(request):
        return web.json_response({"score": example_score()})

    async def status(request):
        try:
            return web.json_response({**renderer_status(), "busy": render_lock.locked()})
        except OSError:
            return web.json_response({"ready": False, "renderer": None, "reason": "无法读取音源。"})

    async def compile_route(request):
        try:
            body = await read_body(request, {"score"})
            return web.json_response(compile_score(body["score"]))
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "谱面无效，请检查8小节、音高、拍位和演奏标记。"}, status=400)

    async def compose(request):
        try:
            body = await read_body(request, {"tempoBpm"})
            if type(body["tempoBpm"]) is not int or not 48 <= body["tempoBpm"] <= 160:
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "速度须为48–160的整数BPM。"}, status=400)
        if inference_lock.locked():
            return web.json_response({"error": "本地模型忙，请稍后再试。"}, status=409)
        async with inference_lock:
            try:
                result = await compose_score(body["tempoBpm"])
                compiled = compile_score(result["score"])
                receipts[compiled["scoreHash"]] = result["model"]
                if len(receipts) > 32:
                    del receipts[next(iter(receipts))]
                return web.json_response(result)
            except asyncio.TimeoutError:
                return web.json_response({"error": "模型推理超时；未使用样例替代。"}, status=504)
            except (ValueError, TypeError, KeyError, ClientError, OSError):
                return web.json_response({"error": "模型输出不可用或未通过约束；未使用样例替代。"}, status=502)

    async def render(request):
        try:
            body = await read_body(request, {"score"})
            compiled = compile_score(body["score"])
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "谱面无效，未启动音源。"}, status=400)
        if render_lock.locked():
            return web.json_response({"error": "音源正在渲染，请稍后再试。"}, status=409)
        async with render_lock:
            try:
                if not renderer_status()["ready"]:
                    return web.json_response({"error": renderer_status()["reason"]}, status=503)
                return web.json_response(await render_score(compiled, output_root, receipts.get(compiled["scoreHash"])))
            except asyncio.TimeoutError:
                return web.json_response({"error": "音源渲染超时，子进程已结束，未发布音频。"}, status=504)
            except (OSError, ValueError, wave.Error):
                return web.json_response({"error": "音源渲染或音频验证失败，未发布音频。"}, status=502)

    async def artifact(request):
        render_id, name = request.match_info["render_id"], request.match_info["name"]
        if not re.fullmatch("[a-f0-9]{64}", render_id) or name not in FILES:
            raise web.HTTPNotFound()
        target = (output_root / render_id / name).resolve()
        if not target.is_relative_to(output_root) or not target.is_file():
            raise web.HTTPNotFound()
        response = web.FileResponse(target)
        response.headers["Content-Disposition"] = f'inline; filename="{name}"'
        return response

    app.router.add_get("/api/music-score/example", example)
    app.router.add_get("/api/music-score/status", status)
    app.router.add_post("/api/music-score/compile", compile_route)
    app.router.add_post("/api/music-score/compose", compose)
    app.router.add_post("/api/music-score/render", render)
    app.router.add_get("/api/music-score/artifacts/{render_id}/{name}", artifact)
