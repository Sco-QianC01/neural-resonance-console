"""Exercise the distributable source, rather than only its complete checkout."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("package_portable_source", ROOT / "tools/package-portable-source.py")
packager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(packager)


class SourceArchiveTests(unittest.TestCase):
    def test_archive_imports_optional_modules_and_builds_without_author_files(self):
        with tempfile.TemporaryDirectory(prefix="source archive 测试 ") as directory:
            target = Path(directory)
            archive = target / "source.zip"
            with contextlib.redirect_stdout(io.StringIO()):
                packager.package(archive)
            with zipfile.ZipFile(archive) as source:
                source.extractall(target)
            root = target / "NeuralResonance-Source"
            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            imported = subprocess.run(
                [sys.executable, "-I", "-c",
                 "import sys;sys.path.insert(0,sys.argv[1]);import device_gateway,watch,music_prompt_workbench",
                 str(root / "gateway")],
                cwd=root, env=env, capture_output=True, text=True, encoding="utf-8", timeout=20)
            self.assertEqual(imported.returncode, 0, imported.stderr)
            for entry in ("tools/start-music-prompt.py", "tools/build-watch.py",
                          "gateway/music_score.py", "gateway/music_score_runtime.py",
                          "music-score/index.html", "music-score/vendor/OSMD-LICENSE",
                          "watch/AndroidManifest.xml", "watch/src/org/neuralresonance/watch/MainActivity.java"):
                self.assertTrue((root / entry).is_file(), entry)
            for arguments in (["--test", "tests/music-prompt.test.mjs"], ["tools/build.mjs"]):
                result = subprocess.run(["node", *arguments], cwd=root, env=env, capture_output=True,
                                        text=True, encoding="utf-8", timeout=30)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
