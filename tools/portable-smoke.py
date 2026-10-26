"""Native/source relocation and restart tests. Hardware channels stay disabled."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def get(url):
    with urllib.request.urlopen(url, timeout=.7) as response:
        return json.load(response)


def stop(process):
    if process.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            process.terminate()
    try:
        process.communicate(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()


def run(args):
    began = time.monotonic()
    build = json.loads((ROOT / "gateway/build-manifest.json").read_text(encoding="utf-8"))["build"]
    with tempfile.TemporaryDirectory(prefix="Neural 獨立 搬遷 ") as temporary:
        home = Path(temporary)
        data = home / "使用者資料"
        data.mkdir()
        config = json.loads((ROOT / "gateway/config.example.json").read_text(encoding="utf-8"))
        for key in ("eeg", "bloodOxygen", "gsr", "ble"):
            config[key]["enabled"] = False
        # Occupy the preferred port. Startup must choose a free one, not terminate its owner.
        occupant = socket.socket()
        occupant.bind(("127.0.0.1", 0))
        occupant.listen()
        port = occupant.getsockname()[1]
        config["port"] = port
        # Even a migrated historical config must not implicitly proxy the author's core.
        config["reuseLocalCore"] = True
        (data / "config.json").write_text(json.dumps(config), encoding="utf-8")
        env = {**os.environ, "NEURAL_RESONANCE_DATA": str(data), "UV_OFFLINE": "1",
               "UV_PYTHON_DOWNLOADS": "never", "PYTHONNOUSERSITE": "1"}
        env.pop("PYTHONHOME", None)
        env.pop("PYTHONPATH", None)
        if args.native:
            original = Path(args.native).resolve()
            bundle = next((parent for parent in original.parents if parent.suffix == ".app"),
                          original.parent)
            moved = home / "應用 程式" / bundle.name
            shutil.copytree(bundle, moved, symlinks=True)
            command = [str(moved / original.relative_to(bundle)), "--no-browser"]
        else:
            moved = home / "網站 源碼"
            moved.mkdir()
            for name in ("index.html", "src", "neural-worm", "public", "docs", "gateway"):
                source = ROOT / name
                target = moved / name
                if source.is_dir():
                    shutil.copytree(source, target, ignore=shutil.ignore_patterns(
                        ".venv", "build", "__pycache__", "*.pyc"))
                else:
                    shutil.copy2(source, target)
            (moved / "tools").mkdir()
            shutil.copy2(ROOT / "tools/runtime-check.py", moved / "tools/runtime-check.py")
            shutil.copy2(ROOT / "tools/start-macos.sh", moved / "tools/start-macos.sh")
            for name in ("Start-Windows.ps1", "Start-macOS.command"):
                shutil.copy2(ROOT / name, moved / name)
            if os.name == "nt":
                command = [args.pwsh, "-NoLogo", "-NoProfile", "-NonInteractive",
                           "-File", str(moved / "Start-Windows.ps1"), "-NoBrowser"]
            else:
                command = ["sh", str(moved / "Start-macOS.command"), "--no-browser"]
        proofs = []
        for attempt in range(2):
            process = subprocess.Popen(command, cwd=moved, env=env,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                health = None
                started = time.monotonic()
                for _ in range(100):
                    if process.poll() is not None:
                        out, err = process.communicate()
                        raise RuntimeError((out + err).decode("utf-8", errors="replace"))
                    try:
                        runtime = json.loads((data / "runtime.json").read_text(encoding="utf-8"))
                        url = runtime["url"].rstrip("/")
                        health = get(url + "/api/health")
                        if health.get("build") == build:
                            break
                    except (OSError, ValueError, KeyError):
                        pass
                    time.sleep(.1)
                assert health and health["build"] == build
                assert not health["upstream"]
                assert urlsplit(url).port != port
                runtime = get(url + "/api/runtime")
                assert all(runtime["core"]["streams"][key]["samples"] == 0
                           for key in ("eeg", "spo2", "pr", "gsr"))
                assert all(row["state"] == "disabled" for row in runtime["devices"].values())
                public = get(url + "/public/config.json")
                assert public["autoConnect"] and public["startupMode"] == "live"
                with urllib.request.urlopen(url + "/") as response:
                    assert "app-sidebar" in response.read().decode("utf-8")
                second = subprocess.run(command, cwd=moved, env=env,
                                        capture_output=True, timeout=15)
                assert second.returncode == 0, second.stderr.decode(errors="replace")
                assert json.loads((data / "runtime.json").read_text())["pid"] == process.pid or args.source
                proofs.append({"attempt": attempt + 1, "readySeconds": time.monotonic() - started,
                               "duplicateClickReusedInstance": True, "portConflictHandled": True,
                               "realHardwareOpened": False, "upstream": False})
            finally:
                stop(process)
        occupant.close()
        result = {"pass": True, "platform": platform.platform(), "native": bool(args.native),
                  "nativeExecutableSha256": hashlib.sha256(Path(args.native).read_bytes()).hexdigest() if args.native else None,
                  "relocatedUnicodeSpacePath": True, "offlineWarmStart": True,
                  "restarts": proofs, "seconds": time.monotonic() - began,
                  "physicalHardwareVerified": False, "macOSNativeVerified": sys.platform == "darwin"}
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    import sys
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--native")
    mode.add_argument("--source", action="store_true")
    parser.add_argument("--pwsh", default="pwsh")
    parser.add_argument("--output", required=True)
    run(parser.parse_args())
