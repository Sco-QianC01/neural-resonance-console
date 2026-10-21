"""Foreground watch heart rate over a device-specific, authenticated ADB tunnel."""
import asyncio
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

from aiohttp import ClientSession, ClientTimeout

PACKAGE = "org.neuralresonance.watch"
WATCH_PORT = 18768


class WatchReading:
    def __init__(self, stream):
        self.stream = stream
        self.session = None
        self.sequence = self.event_ns = -1

    def clear(self):
        self.stream.clear_sensor("pr", source="watch")

    def accept(self, packet, now=None, mono=None):
        mono = time.monotonic() if mono is None and now is None else now if mono is None else mono
        now = time.time() if now is None else now
        if not isinstance(packet, dict):
            self.clear()
            return False
        session, sequence = packet.get("sessionId"), packet.get("sequence")
        event, clock = packet.get("eventElapsedNs"), packet.get("nowElapsedNs")
        bpm, accuracy = packet.get("bpm"), packet.get("accuracy")
        valid = (packet.get("schemaVersion") == "neural-watch-heart-v1"
                 and isinstance(session, str) and 0 < len(session) <= 128
                 and packet.get("state") == "receiving"
                 and type(sequence) is int and sequence > 0
                 and type(event) is int and type(clock) is int
                 and 0 < event <= clock and clock - event <= 15_000_000_000
                 and type(accuracy) is int and accuracy in (1, 2, 3)
                 and type(bpm) in (int, float) and math.isfinite(bpm) and 0 < bpm <= 1000)
        if not valid:
            self.clear()
            return False
        if session != self.session:
            self.clear()
            self.session, self.sequence, self.event_ns = session, -1, -1
        if sequence <= self.sequence or event <= self.event_ns:
            return False
        self.sequence, self.event_ns = sequence, event
        self.stream.sensor("pr", bpm, now=now - (clock - event) / 1e9, source="watch",
                           mono=mono - (clock - event) / 1e9,
                           details={"sessionId": session, "sequence": sequence,
                                    "eventElapsedNs": event, "accuracy": accuracy})
        return True


def validate_watch(profile):
    if type(profile["enabled"]) is not bool:
        raise ValueError("watch.enabled must be boolean")
    serial, adb = profile["serial"], profile["adbPath"]
    if (not isinstance(serial, str) or len(serial) > 128
            or serial and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]*", serial)):
        raise ValueError("Invalid watch ADB identity")
    if (not isinstance(adb, str) or len(adb) > 1024 or "\0" in adb
            or adb and re.split(r"[/\\]", adb)[-1].lower() not in ("adb", "adb.exe")):
        raise ValueError("watch.adbPath must identify adb")
    if profile["enabled"] and not serial:
        raise ValueError("An explicit watch ADB identity is required")


async def watch_worker(profile, stream):
    receiver = WatchReading(stream)
    adb = profile["adbPath"] or shutil.which("adb")
    if not adb or not Path(adb).is_file():
        stream.status("watch", state="waiting", reason="adb-missing", message="未找到ADB入口")
        return

    async def command(*args):
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
        process = await asyncio.create_subprocess_exec(
            adb, "-s", profile["serial"], *args,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, **options)
        try:
            output, _error = await asyncio.wait_for(process.communicate(), 5)
            if process.returncode or len(output) > 8192:
                raise ConnectionError("手表或前台采集端不可用")
            return output.decode("utf-8").strip()
        except BaseException:
            if process.returncode is None:
                process.kill()
                await process.wait()
            raise

    while True:
        port = None
        try:
            stream.status("watch", state="connecting", reason="waiting-data",
                          message="连接已配對手表", address=profile["serial"])
            if await command("shell", "pm", "has-feature", "android.hardware.type.watch") != "true":
                raise ConnectionError("指定的ADB设备不是手表")
            # Read only our own installed debug collector's sandbox, never a vendor health database.
            token = await command("exec-out", "run-as", PACKAGE, "cat", "files/session-token")
            if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", token):
                raise ConnectionError("采集端会话未就绪")
            forwarded = await command("forward", "tcp:0", f"tcp:{WATCH_PORT}")
            if not forwarded.isdecimal() or not 1024 <= int(forwarded) <= 65535:
                raise ConnectionError("ADB转发未就绪")
            port = int(forwarded)
            async with ClientSession(timeout=ClientTimeout(total=2), trust_env=False) as client:
                while True:
                    started = time.monotonic()
                    async with client.get(f"http://127.0.0.1:{port}/current",
                                          headers={"Authorization": "Bearer " + token},
                                          allow_redirects=False) as response:
                        if response.status != 200:
                            raise ConnectionError("手表采集会话已更改")
                        raw = await response.content.read(8193)
                        if len(raw) > 8192:
                            raise ValueError("Invalid watch packet size")
                        import json
                        packet = json.loads(raw)
                    accepted = receiver.accept(packet, now=time.time() - (time.monotonic() - started), mono=started)
                    with stream.lock:
                        current = stream.snapshot()
                    fresh = current["pr"] is not None and current["sensorSources"]["pr"] == "watch"
                    state = packet.get("state", "invalid") if isinstance(packet, dict) else "invalid"
                    stream.status("watch", state="receiving" if fresh else "waiting",
                                  reason="valid-protocol" if fresh else state,
                                  message="手表心率有效" if fresh else "等待有效手表心率",
                                  validPackets=current["quality"]["prSamples"],
                                  eventElapsedNs=receiver.event_ns if accepted or fresh else None)
                    await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            raise
        except Exception:
            stream.status("watch", state="waiting", reason="watch-unavailable",
                          message="等待已配對手表及前台采集端")
        finally:
            receiver.clear()
            if port is not None:
                try:
                    await command("forward", "--remove", f"tcp:{port}")
                except Exception:
                    pass
        await asyncio.sleep(2)
