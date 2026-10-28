"""Exercise new assets through the unchanged device gateway without hardware."""
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from aiohttp.test_utils import TestClient,TestServer
from device_gateway import create_app


class PromptStaticTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_gateway_serves_annotation_from_its_original_allowlist(self):
        acquisition=SimpleNamespace(config={"port":8767},start=AsyncMock(),stop=AsyncMock())
        client=TestClient(TestServer(create_app(acquisition,Path("unused-config.json"))))
        await client.start_server()
        try:
            for name in ["prompt-entry.mjs","prompt-section.mjs","prompt-section.css",
                         "music-prompt/index.html","music-prompt/app.mjs",
                         "music-prompt/contract.mjs","music-prompt/style.css","music-prompt/tags.json"]:
                response=await client.get("/neural-worm/"+name)
                self.assertEqual(response.status,200,name)
                self.assertTrue(await response.read(),name)
        finally:
            await client.close()
