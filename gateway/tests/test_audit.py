import asyncio
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from acquisition import Stream
from device_gateway import Acquisition,create_app,validate_config
import device_gateway
from aiohttp.test_utils import TestClient,TestServer


class ReconnectionTests(unittest.TestCase):
    def test_macos_bundle_data_root_uses_resources_instead_of_frameworks_symlink_base(self):
        with tempfile.TemporaryDirectory() as directory:
            contents=Path(directory)/"Neural Resonance.app"/"Contents"
            frameworks=contents/"Frameworks";resources=contents/"Resources"
            frameworks.mkdir(parents=True);resources.mkdir()
            (resources/"index.html").write_text("public",encoding="utf-8")
            (resources/"gateway").mkdir()
            (resources/"gateway"/"config.example.json").write_text("{}",encoding="utf-8")
            self.assertEqual(device_gateway.asset_root(frameworks,"darwin",True),resources)
            self.assertEqual(device_gateway.asset_root(frameworks,"win32",True),frameworks)

    def test_sensor_field_clocks_are_exported_independently_of_heartbeat(self):
        stream=Stream()
        stream.sensor("spo2",98,now=10)
        stream.sensor("pr",72,now=11)
        packet=stream.snapshot(now=20)
        self.assertEqual(packet["sensorTimestamps"],{"spo2":10,"pr":11,"gsr":None})
        stream.clear_sensor("spo2")
        self.assertIsNone(stream.snapshot(now=20)["spo2"])

    def test_reopening_same_transport_clears_old_fields_and_rejects_old_callbacks(self):
        stream=Stream()
        first=stream.new_connection("usb")
        stream.accept("usb",{"attention":60,"meditation":70},[1],now=10,connection=first)
        stream.end_connection("usb",first)
        second=stream.new_connection("usb")
        self.assertFalse(stream.accept("usb",{"attention":99},[99],now=11,connection=first))
        stream.accept("usb",{},[2],now=11,connection=second)
        packet=stream.snapshot(now=11)
        self.assertEqual(packet["eeg"],{})
        self.assertEqual(packet["rawEegSamples"],[2])
        self.assertEqual(packet["connectionEpoch"],2)


class GatewayResetTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        config=validate_config({key:{"enabled":False} for key in ("eeg","bloodOxygen","gsr","ble")})
        self.acquisition=Acquisition(config)
        self.client=TestClient(TestServer(create_app(self.acquisition,Path(self.tmp.name)/"config.json")))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.tmp.cleanup()

    async def test_an_open_client_receives_raw_samples_immediately_after_config_stream_reset(self):
        self.acquisition.stream.accept("usb",{"attention":60,"meditation":70},list(range(20)))
        socket=await self.client.ws_connect("/ws/live")
        self.assertEqual(len((await socket.receive_json())["rawEegSamples"]),20)
        response=await self.client.post("/api/gateway/config",json={"eeg":{"sampleRate":256}})
        self.assertEqual(response.status,200)
        self.acquisition.stream.accept("usb",{"attention":50,"meditation":60},[100,200])
        packet=await asyncio.wait_for(socket.receive_json(),2)
        self.assertEqual(packet["rawEegSamples"],[100,200])
        await socket.close()

    async def test_parallel_config_changes_are_serialized_and_leave_valid_json(self):
        original=self.acquisition.stop
        active=maximum=0
        async def tracked_stop():
            nonlocal active,maximum
            active+=1;maximum=max(maximum,active)
            await asyncio.sleep(.03)
            await original()
            active-=1
        self.acquisition.stop=tracked_stop
        responses=await asyncio.gather(
            self.client.post("/api/gateway/config",json={"eeg":{"sampleRate":256}}),
            self.client.post("/api/gateway/config",json={"eeg":{"sampleRate":512}}))
        self.assertTrue(all(response.status==200 for response in responses))
        self.assertEqual(maximum,1)
