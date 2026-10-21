"""Allowlisted distribution. Never copies runtimes, captures or local settings."""
import argparse
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ("README.md", "LICENSE", "package.json", "index.html",
         "Start-Windows.ps1", "Start-Windows.cmd", "Start-macOS.command",
         "gateway/acquisition.py", "gateway/device_gateway.py", "gateway/protocols.py",
         "gateway/runtime_support.py", "gateway/experiments.py", "gateway/config.example.json",
         "gateway/watch.py", "gateway/music_prompt_workbench.py",
         "gateway/music_score.py", "gateway/music_score_runtime.py",
         "gateway/build-manifest.json",
         "gateway/package.spec", "gateway/pyproject.toml", "gateway/uv.lock",
         "tools/runtime-check.py", "tools/runtime-smoke.py", "tools/portable-smoke.py",
         "tools/package-portable-source.py", "tools/build.mjs", "tools/serve.mjs",
         "tools/start-music-prompt.py", "tools/build-watch.py",
         "watch/AndroidManifest.xml", "watch/src/org/neuralresonance/watch/MainActivity.java",
         "tools/browser-audit.py", ".github/workflows/desktop.yml",
         "tools/system-audit-static.py", "tools/system-full-browser.py",
         "tools/verify-missing-dependency.py",
         "tools/verify-teacher-workflow.py", "tools/verify-teacher-revision.py", "tools/build-chopin-score.py",
         "tools/verify-score-evidence.py", "tools/build-method-docs.py",
         ".github/workflows/compatibility.yml")
TREES = ("src", "public", "docs", "neural-worm", "music-prompt", "music-score", "tests", "gateway/tests")


def package(output):
    files = [ROOT / name for name in FILES]
    for directory in TREES:
        files.extend(p for p in (ROOT / directory).rglob("*") if p.is_file()
                     and "__pycache__" not in p.parts and p.suffix != ".pyc")
    manifest = []
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(files):
            if not file.is_file():
                raise FileNotFoundError(file)
            name = file.relative_to(ROOT).as_posix()
            value = file.read_bytes()
            manifest.append(f"{hashlib.sha256(value).hexdigest()}  {name}")
            archive.write(file, "NeuralResonance-Source/" + name)
        archive.writestr("NeuralResonance-Source/MANIFEST.sha256", "\n".join(manifest) + "\n")
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        for name in archive.namelist():
            assert not any(part in {".runtime", ".venv", ".env", ".git", "artifacts",
                                    "recordings", "local"} for part in Path(name).parts)
    print(f"{output}: {len(files)} allowlisted files, SHA256 {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    package(parser.parse_args().output)
