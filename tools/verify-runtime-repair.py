"""Reproduce an old absolute venv home in the dedicated QA environment only."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "artifacts/portable-20261012/source-runtime"


def main(args):
    runtime = Path(os.environ["NEURAL_RESONANCE_RUNTIME"]).resolve()
    assert runtime == QA.resolve(), "Do not damage an arbitrary or personal environment"
    config = runtime / "gateway/pyvenv.cfg"
    original = config.read_text(encoding="utf-8")
    damaged = "\n".join("home = Q:\\Neural-QA-Missing-Old-Path\\python" if line.startswith("home =")
                        else line for line in original.splitlines())
    env = {**os.environ, "UV_OFFLINE": "1", "UV_PYTHON_DOWNLOADS": "never"}
    command = [args.pwsh, "-NoLogo", "-NoProfile", "-NonInteractive", "-File",
               str(ROOT / "Start-Windows.ps1"), "-SetupOnly"]
    began = time.monotonic()
    config.write_text(damaged + "\n", encoding="utf-8")
    try:
        result = subprocess.run(command, env=env, capture_output=True, timeout=60)
        print((result.stdout + result.stderr).decode("utf-8", errors="replace"))
        assert result.returncode == 0, (result.stdout + result.stderr).decode("utf-8", errors="replace")
        assert "Missing-Old-Path" not in config.read_text(encoding="utf-8")
        proof = {"pass": True, "damagedVenvHomeReproduced": True,
                 "rebuiltInPlaceFromPrivateCache": True, "offline": True,
                 "seconds": time.monotonic() - began, "hardwareOpened": False}
        Path(args.output).write_text(json.dumps(proof, indent=2), encoding="utf-8")
        print(json.dumps(proof))
    finally:
        if config.exists() and "Missing-Old-Path" in config.read_text(encoding="utf-8"):
            config.write_text(original, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pwsh", required=True)
    parser.add_argument("--output", required=True)
    main(parser.parse_args())
