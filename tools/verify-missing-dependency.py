"""Remove a dependency only in the previously reserved source QA runtime."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "artifacts/portable-20261012/source-runtime"


def verify(args):
    runtime = Path(os.environ["NEURAL_RESONANCE_RUNTIME"]).resolve()
    assert runtime == QA.resolve(), "Only the dedicated QA environment can be damaged"
    env = {**os.environ, "UV_OFFLINE": "1", "UV_PYTHON_DOWNLOADS": "never",
           "PYTHONNOUSERSITE": "1", "PYTHONUTF8": "1"}
    command = [args.pwsh, "-NoLogo", "-NoProfile", "-NonInteractive", "-File",
               str(ROOT / "Start-Windows.ps1"), "-SetupOnly"]
    ready = subprocess.run(command, env=env, capture_output=True, timeout=60)
    assert ready.returncode == 0, (ready.stdout + ready.stderr).decode("utf-8", errors="replace")
    dependency = runtime / "gateway/Lib/site-packages/serial"
    preserved = runtime / f"preserved-serial-{time.time_ns()}"
    assert dependency.is_dir()
    dependency.rename(preserved)
    started = time.monotonic()
    try:
        result = subprocess.run(command, env=env, capture_output=True, timeout=60)
        log = (result.stdout + result.stderr).decode("utf-8", errors="replace")
        print(log)
        assert result.returncode == 0, log
        assert (dependency / "__init__.py").is_file()
        assert "Environment requires installation" in log
        value = {"pass": True, "removedActualSerialPackage": True,
                 "metadataRemained": True, "automaticallyReinstalled": True,
                 "offlinePrivateCache": True, "oldFilesPreserved": True,
                 "seconds": time.monotonic() - started, "hardwareOpened": False}
        Path(args.output).write_text(json.dumps(value, indent=2), encoding="utf-8")
        print(json.dumps(value))
    finally:
        if not dependency.exists():
            preserved.rename(dependency)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pwsh", required=True)
    parser.add_argument("--output", required=True)
    verify(parser.parse_args())
