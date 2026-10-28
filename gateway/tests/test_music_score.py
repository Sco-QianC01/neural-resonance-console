"""Score/export boundaries; mock renders are never evidence of audible synthesis."""
import asyncio
import base64
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import struct
import unittest
from unittest.mock import AsyncMock, patch
import wave
import xml.etree.ElementTree as ET

from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import music_score as score
import music_score_runtime as runtime
import music_prompt_workbench as workbench


class ScoreTests(unittest.TestCase):
    def test_rejects_invalid_bars_notes_expressions_and_extra_data(self):
        changes = (
            lambda s: s["bars"][0].update(number=1.0),
            lambda s: s["bars"].pop(),
            lambda s: s["bars"][0].update(articulation="tremolo"),
            lambda s: s["bars"][0].update(dynamic="loud"),
            lambda s: s["bars"][0]["notes"][0].update(pitch=True),
            lambda s: s["bars"][0]["notes"][0].update(pitch=63),
            lambda s: s["bars"][0]["notes"][0].update(beat=0.5),
            lambda s: s["bars"][0]["notes"][0].update(duration=1),
            lambda s: s["bars"][0]["notes"][0].update(id="m2n1"),
            lambda s: s.update(rawEEG=[1]),
            lambda s: s.update(tempoBpm=float("nan")),
            lambda s: s.update(title="<script>unsafe</script>"),
        )
        for change in changes:
            value = score.example_score()
            change(value)
            with self.subTest(change=change), self.assertRaises(ValueError):
                score.compile_score(value)

    def test_xml_timeline_midi_share_sixteen_notes_and_integer_measures(self):
        result = score.compile_score(score.example_score())
        xml = ET.fromstring(result["musicxml"])
        measures = xml.findall("./part/measure")
        self.assertEqual([m.attrib["number"] for m in measures], [str(i) for i in range(1, 9)])
        self.assertEqual(len(xml.findall("./part/measure/note")), 16)
        self.assertEqual([int(n.findtext("duration")) for m in measures for n in m.findall("note")],
                         [960] * 16)
        self.assertEqual([m["startSeconds"] for m in result["timeline"]], [i * 3 for i in range(8)])
        self.assertEqual(result["durationSeconds"], 24)
        midi = base64.b64decode(result["midiBase64"])
        self.assertEqual(midi[:14], b"MThd\x00\x00\x00\x06\x00\x01\x00\x02\x01\xe0")
        self.assertEqual(midi.count(b"MTrk"), 2)
        self.assertEqual(len(result["scoreHash"]), 64)

    def test_bar_five_edit_preserves_pitch_and_duration_but_changes_program(self):
        original = score.example_score()
        modified = deepcopy(original)
        modified["bars"][4]["articulation"] = "arco"
        a, b = score.compile_score(original), score.compile_score(modified)
        self.assertEqual([bar["notes"] for bar in a["score"]["bars"]],
                         [bar["notes"] for bar in b["score"]["bars"]])
        self.assertEqual(a["durationSeconds"], b["durationSeconds"])
        self.assertNotEqual(a["scoreHash"], b["scoreHash"])
        self.assertNotEqual(a["midiBase64"], b["midiBase64"])
        self.assertIn("pizz.", a["musicxml"])
        self.assertIn("arco", b["musicxml"])

    def test_soundfont_requires_explicit_presets_in_bank_zero(self):
        with tempfile.TemporaryDirectory() as folder:
            font = Path(folder) / "test.sf2"
            def write(programs):
                records = b"".join(struct.pack("<20sHHHIII", name, program, bank, 0, 0, 0, 0)
                                   for name, program, bank in programs + [(b"EOP", 0, 0)])
                pdta = b"pdta" + b"phdr" + struct.pack("<I", len(records)) + records
                body = b"sfbkLIST" + struct.pack("<I", len(pdta)) + pdta
                font.write_bytes(b"RIFF" + struct.pack("<I", len(body)) + body)
            write([(b"Sustain", 48, 0), (b"Pluck", 45, 0)])
            with patch.dict("os.environ", {"NEURAL_SCORE_FLUIDSYNTH": sys.executable,
                                          "NEURAL_SCORE_SOUNDFONT": str(font)}):
                self.assertTrue(runtime.renderer_status()["ready"])
                write([(b"Sustain", 48, 0), (b"Wrong bank", 45, 1)])
                self.assertFalse(runtime.renderer_status()["ready"])
            font.write_bytes(b"RIFF\x00")
            with self.assertRaises(ValueError):
                runtime.soundfont_presets(font)

    def test_silent_clipped_and_truncated_audio_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "audio.wav"
            for sample, frames in [(0, 44100), (32767, 44100), (1000, 40)]:
                with wave.open(str(path), "wb") as handle:
                    handle.setparams((2, 2, 44100, frames, "NONE", "not compressed"))
                    handle.writeframes(struct.pack("<h", sample) * frames * 2)
                with self.assertRaises(ValueError):
                    runtime.audio_stats(path, 1)


class RenderProcessTests(unittest.IsolatedAsyncioTestCase):
    async def test_timeout_and_cancellation_end_owned_process(self):
        await runtime.run_process(sys.executable, "-c", "print('ok')", timeout=3)
        with self.assertRaises(asyncio.TimeoutError):
            await runtime.run_process(sys.executable, "-c", "import time;time.sleep(10)", timeout=.05)
        task = asyncio.create_task(runtime.run_process(sys.executable, "-c", "import time;time.sleep(10)"))
        await asyncio.sleep(.05)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task

    async def test_render_failure_cleans_stage_without_success_package(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            font = root / "font.sf2"
            font.write_bytes(b"test")
            output = root / "output"
            with patch.dict("os.environ", {"NEURAL_SCORE_FLUIDSYNTH": sys.executable,
                                          "NEURAL_SCORE_SOUNDFONT": str(font)}), \
                 patch.object(runtime, "renderer_status", return_value={"ready": True, "renderer": {}}), \
                 patch.object(runtime, "run_process", AsyncMock(side_effect=ValueError("render failed"))):
                with self.assertRaises(ValueError):
                    await runtime.render_score(score.compile_score(score.example_score()), output)
            self.assertEqual(list(output.iterdir()), [])


class PitchPlannerTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_complete_bounded_model_response_is_accepted(self):
        valid = {"model": runtime.MODEL, "done": True, "done_reason": "stop",
                 "message": {"role": "assistant", "content": json.dumps({
                     "pitches": [n["pitch"] for b in score.example_score()["bars"] for n in b["notes"]]})}}
        state = {"value": valid}
        async def tags(request):
            return web.json_response({"models": [{"name": runtime.MODEL, "digest": "d" * 64}]})
        async def chat(request):
            body = await request.json()
            self.assertFalse(body["think"])
            self.assertEqual(body["format"]["properties"]["pitches"]["maxItems"], 16)
            return web.json_response(state["value"])
        app = web.Application()
        app.router.add_get("/api/tags", tags)
        app.router.add_post("/api/chat", chat)
        async with TestServer(app) as server:
            with patch.object(runtime, "OLLAMA_URL", str(server.make_url("")).rstrip("/")):
                result = await runtime.compose_score(80)
                self.assertEqual(result["score"]["source"]["kind"], "ollama")
                for bad in ({**valid, "done_reason": "length"}, {**valid, "done": False},
                            {**valid, "model": "other"},
                            {**valid, "message": {"role": "assistant", "content": '{"pitches":[62]}'}}):
                    state["value"] = bad
                    with self.assertRaises(ValueError):
                        await runtime.compose_score(80)


class ScoreRoutesTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "neural-worm/music-prompt").mkdir(parents=True)
        (self.root / "neural-worm/music-prompt/tags.json").write_text('{"tags":[]}')
        (self.root / "music-score").mkdir()
        (self.root / "music-score/index.html").write_text("<title>score</title>")
        self.client = TestClient(TestServer(workbench.create_app(
            self.root, score_output=self.root / "private-output"), handler_cancellation=True))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.temp.cleanup()

    async def test_compile_boundary_and_static_output_separation(self):
        self.assertEqual((await self.client.get("/music-score/")).status, 200)
        value = await (await self.client.get("/api/music-score/example")).json()
        response = await self.client.post("/api/music-score/compile", json=value)
        self.assertEqual(response.status, 200)
        self.assertEqual((await response.json())["durationSeconds"], 24)
        for body in ({**value, "path": "/tmp/secret"}, {"score": {}}, []):
            self.assertEqual((await self.client.post("/api/music-score/compile", json=body)).status, 400)
        self.assertEqual((await self.client.post("/api/music-score/compile", data="x")).status, 415)
        self.assertEqual((await self.client.get("/private-output/score.musicxml")).status, 404)
        self.assertEqual((await self.client.get("/api/music-score/artifacts/" + "a" * 64 + "/font.sf2")).status, 404)

    async def test_missing_renderer_never_claims_success(self):
        with patch.dict("os.environ", {"NEURAL_SCORE_FLUIDSYNTH": "/missing",
                                      "NEURAL_SCORE_SOUNDFONT": "/missing"}):
            status = await (await self.client.get("/api/music-score/status")).json()
            self.assertFalse(status["ready"])
            response = await self.client.post("/api/music-score/render", json={"score": score.example_score()})
        self.assertEqual(response.status, 503)
        self.assertNotIn("artifacts", await response.json())
        self.assertFalse((self.root / "private-output").exists())

    async def test_model_failure_not_replaced_by_demo_and_busy_shared(self):
        started, finish = asyncio.Event(), asyncio.Event()
        async def generate(_tempo):
            started.set()
            await finish.wait()
            raise ValueError("invalid model response")
        with patch.object(runtime, "compose_score", generate):
            active = asyncio.create_task(self.client.post("/api/music-score/compose", json={"tempoBpm": 80}))
            await started.wait()
            duplicate = await self.client.post("/api/music-score/compose", json={"tempoBpm": 80})
            self.assertEqual(duplicate.status, 409)
            finish.set()
            response = await active
        self.assertEqual(response.status, 502)
        self.assertNotIn("score", await response.json())


if __name__ == "__main__":
    unittest.main()
