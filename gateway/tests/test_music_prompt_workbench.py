"""Local proxy boundaries and model-output integrity; mocked inference is not AI proof."""
import asyncio
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import music_prompt_workbench as workbench

CATALOGUE = {"tags": [{"id": "piano", "phrase": "piano"},
                       {"id": "quiet", "phrase": "soft dynamics"}]}
BODY = {"tagIds": ["piano", "quiet"], "inputHash": "a" * 64}


class SelectionTests(unittest.TestCase):
    def test_unknown_duplicate_and_extra_observations_rejected(self):
        for body in ({**BODY, "tagIds": ["unknown"]}, {**BODY, "tagIds": ["piano", "piano"]},
                     {**BODY, "rawEEG": [1]}, {**BODY, "inputHash": "secret"},
                     {**BODY, "tagIds": []}, {**BODY, "tagIds": [{}]}):
            with self.subTest(body=body), self.assertRaises(ValueError):
                workbench.validate_selection(body, CATALOGUE)
        self.assertEqual(workbench.validate_selection(BODY, CATALOGUE)[0],
                         {"id": "piano", "phrase": "piano"})

    def test_model_cannot_add_remove_duplicate_or_rewrite_tags(self):
        for value in ({"order": ["piano"]}, {"order": ["piano", "piano"]},
                      {"order": ["piano", "invented"]}, {"order": ["piano", "quiet"], "text": "new"},
                      {"order": [{}, "quiet"]}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                workbench.validate_order(value, BODY["tagIds"])
        self.assertEqual(workbench.validate_order({"order": ["quiet", "piano"]}, BODY["tagIds"]),
                         ["quiet", "piano"])

    def test_conflicting_categories_rejected_and_categories_preserved(self):
        catalogue = {"tags": [{"id": "melody.1", "phrase": "narrow", "category": "melody"},
                               {"id": "melody.5", "phrase": "wide", "category": "melody"}]}
        with self.assertRaises(ValueError):
            workbench.validate_selection({**BODY, "tagIds": ["melody.1", "melody.5"]}, catalogue)
        self.assertEqual(workbench.validate_selection({**BODY, "tagIds": ["melody.1"]}, catalogue)[0]["category"], "melody")

    def test_style_first_and_recording_last_are_validated_not_repaired(self):
        ids = ["style.piano", "melody.1", "recording.clean"]
        self.assertEqual(workbench.validate_order({"order": ids}, ids), ids)
        for order in (["melody.1", "style.piano", "recording.clean"],
                      ["style.piano", "recording.clean", "melody.1"]):
            with self.assertRaises(ValueError):
                workbench.validate_order({"order": order}, ids)


class ProxyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        (self.root / "neural-worm/music-prompt").mkdir(parents=True)
        (self.root / "neural-worm/music-prompt" / "tags.json").write_text(json.dumps(CATALOGUE))
        (self.root / "neural-worm/music-prompt" / "index.html").write_text("<title>Workbench</title>")
        (self.root / "secret.txt").write_text("not exposed")
        self.client = TestClient(TestServer(workbench.create_app(self.root), handler_cancellation=True))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.directory.cleanup()

    async def test_origin_host_static_allowlist_and_body_boundary(self):
        self.assertEqual((await self.client.get("/music-prompt/")).status, 200)
        self.assertEqual((await self.client.get("/neural-worm/music-prompt/index.html")).status, 200)
        self.assertEqual((await self.client.get("/secret.txt")).status, 404)
        self.assertEqual((await self.client.get("/music-prompt/", headers={"Host": "evil.test"})).status, 403)
        self.assertEqual((await self.client.post("/api/music-prompt/arrange", json=BODY,
                                                headers={"Origin": "https://evil.test"})).status, 403)
        response = await self.client.post("/api/music-prompt/arrange", data='"' + 'x' * 66000 + '"',
                                         headers={"Content-Type": "application/json"})
        self.assertEqual(response.status, 413)
        response = await self.client.post("/api/music-prompt/arrange", json={**BODY, "rawEEG": [1]})
        self.assertEqual(response.status, 400)

    async def test_real_engine_label_only_after_success_and_concurrent_request_rejected(self):
        started, finish = asyncio.Event(), asyncio.Event()
        async def generate(tags):
            started.set()
            await finish.wait()
            return ["quiet", "piano"]
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
                patch.object(workbench, "generate_order", generate):
            active = asyncio.create_task(self.client.post("/api/music-prompt/arrange", json=BODY))
            await started.wait()
            duplicate = await self.client.post("/api/music-prompt/arrange", json=BODY)
            self.assertEqual(duplicate.status, 409)
            finish.set()
            result = await (await active).json()
        self.assertEqual(result["order"], ["quiet", "piano"])
        self.assertEqual(result["engine"], "ollama")
        self.assertEqual(result["inputHash"], BODY["inputHash"])
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value=None)):
            response = await self.client.post("/api/music-prompt/arrange", json=BODY)
            self.assertEqual(response.status, 502)
            self.assertNotIn("engine", await response.json())

    async def test_unavailable_health_is_explicit(self):
        with patch.object(workbench, "ollama_tags", AsyncMock(side_effect=OSError("offline"))):
            response = await self.client.get("/api/music-prompt/health")
            value = await response.json()
        self.assertFalse(value["ready"])
        self.assertEqual(value["reason"], "ollama-unavailable")

    async def test_cache_is_bounded_and_echoes_current_hash_without_new_inference(self):
        generate = AsyncMock(return_value=["quiet", "piano"])
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
             patch.object(workbench, "generate_order", generate):
            first = await (await self.client.post("/api/music-prompt/arrange", json=BODY)).json()
            second = await (await self.client.post("/api/music-prompt/arrange", json={
                "tagIds": list(reversed(BODY["tagIds"])), "inputHash": "b" * 64})).json()
            self.assertEqual(generate.await_count, 1)
            self.assertFalse(first["cacheHit"])
            self.assertTrue(second["cacheHit"])
            self.assertEqual(second["inputHash"], "b" * 64)
            self.assertEqual(second["inferenceDurationMs"], first["inferenceDurationMs"])
            self.assertGreaterEqual(second["durationMs"], 0)
            with patch.object(workbench, "PROMPT_REVISION", "changed-revision"):
                third = await (await self.client.post("/api/music-prompt/arrange", json=BODY)).json()
            self.assertFalse(third["cacheHit"])
            self.assertEqual(generate.await_count, 2)
        self.assertEqual(workbench.CACHE_LIMIT, 32)

    async def test_lru_evicts_oldest_and_refreshes_recent_hits(self):
        await self.client.close()
        catalogue = {"tags": [{"id": f"tag.{i}", "phrase": f"phrase {i}"} for i in range(33)]}
        (self.root / "neural-worm/music-prompt" / "tags.json").write_text(json.dumps(catalogue))
        self.client = TestClient(TestServer(workbench.create_app(self.root), handler_cancellation=True))
        await self.client.start_server()
        async def generate(tags):
            return [tag["id"] for tag in tags]
        model = AsyncMock(return_value={"digest": "d" * 64})
        async def request(i):
            return await (await self.client.post("/api/music-prompt/arrange", json={
                **BODY, "tagIds": [f"tag.{i}"]})).json()
        with patch.object(workbench, "ollama_tags", model), patch.object(workbench, "generate_order", generate):
            for i in range(32):
                self.assertFalse((await request(i))["cacheHit"])
            self.assertTrue((await request(0))["cacheHit"])
            self.assertFalse((await request(32))["cacheHit"])
            self.assertTrue((await request(0))["cacheHit"])
            self.assertFalse((await request(1))["cacheHit"])

    async def test_digest_change_and_invalid_identity_cannot_hit_cache(self):
        generate = AsyncMock(return_value=["quiet", "piano"])
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
             patch.object(workbench, "generate_order", generate):
            await self.client.post("/api/music-prompt/arrange", json=BODY)
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "e" * 64})), \
             patch.object(workbench, "generate_order", generate):
            changed = await (await self.client.post("/api/music-prompt/arrange", json=BODY)).json()
        self.assertFalse(changed["cacheHit"])
        self.assertEqual(changed["digest"], "e" * 64)
        for digest in (None, "bad", "g" * 64, 123):
            with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": digest})):
                response = await self.client.post("/api/music-prompt/arrange", json=BODY)
                self.assertEqual(response.status, 502)
                value = await response.json()
                self.assertEqual(value["code"], "model-identity-invalid")
                self.assertNotIn("engine", value)

    async def test_failed_inference_not_cached_and_model_swaps_rejected(self):
        generate = AsyncMock(side_effect=[ValueError("bad output"), ["quiet", "piano"]])
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
             patch.object(workbench, "generate_order", generate):
            self.assertEqual((await self.client.post("/api/music-prompt/arrange", json=BODY)).status, 502)
            value = await (await self.client.post("/api/music-prompt/arrange", json=BODY)).json()
        self.assertFalse(value["cacheHit"])
        with patch.object(workbench, "ollama_tags", AsyncMock(side_effect=[
                {"digest": "a" * 64}, {"digest": "b" * 64}])), \
             patch.object(workbench, "generate_order", AsyncMock(return_value=["quiet", "piano"])):
            response = await self.client.post("/api/music-prompt/arrange", json=BODY)
        self.assertEqual(response.status, 502)
        self.assertEqual((await response.json())["code"], "model-changed")

    async def test_disconnect_cancels_inference_and_releases_lock(self):
        started, cancelled = asyncio.Event(), asyncio.Event()
        async def generate(_tags):
            started.set()
            try:
                await asyncio.Future()
            finally:
                cancelled.set()
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
             patch.object(workbench, "generate_order", generate):
            active = asyncio.create_task(self.client.post("/api/music-prompt/arrange", json=BODY))
            await asyncio.wait_for(started.wait(), 2)
            active.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await active
            await asyncio.wait_for(cancelled.wait(), 2)
        with patch.object(workbench, "ollama_tags", AsyncMock(return_value={"digest": "d" * 64})), \
             patch.object(workbench, "generate_order", AsyncMock(return_value=["quiet", "piano"])):
            response = await self.client.post("/api/music-prompt/arrange", json=BODY)
            value = await response.json()
        self.assertEqual(response.status, 200)
        self.assertFalse(value["cacheHit"])


class InferenceContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_complete_stop_responses_are_accepted(self):
        from aiohttp import web
        tags = [{"id": "style.piano", "category": "style", "phrase": "piano"},
                {"id": "recording.clean", "category": "recording", "phrase": "clean"}]
        state = {"response": {"model": workbench.MODEL, "done": True, "done_reason": "stop",
                              "message": {"role": "assistant", "content": json.dumps({"order": [tag["id"] for tag in tags]})}}}
        requests = []
        async def chat(request):
            requests.append(await request.json())
            return web.json_response(state["response"])
        app = web.Application()
        app.router.add_post('/api/chat', chat)
        async with TestServer(app) as server:
            with patch.object(workbench, "OLLAMA_URL", str(server.make_url('')).rstrip('/')):
                await self.check_contract(tags, state, requests)
        self.assertEqual(json.loads(requests[0]["messages"][1]["content"])[0]["category"], "style")
        self.assertIn("style", requests[0]["messages"][0]["content"])

    async def check_contract(self, tags, state, requests):
        self.assertEqual(await workbench.generate_order(tags), [tag["id"] for tag in tags])
        for changes in ({"done": False}, {"done_reason": "length"}, {"done_reason": None},
                        {"model": "other"}, {"message": {"role": "user", "content": '{}'}}):
            original = state["response"]
            state["response"] = {**original, **changes}
            with self.assertRaises(ValueError):
                await workbench.generate_order(tags)
            state["response"] = original


if __name__ == "__main__":
    unittest.main()
