"""Check real importability rather than trusting surviving package metadata."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("installation_check", ROOT / "tools/runtime-check.py")
runtime_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime_check)


class InstallationTests(unittest.TestCase):
    def test_serial_namespace_without_serial_class_is_not_a_ready_installation(self):
        broken = types.ModuleType("serial")
        with patch.dict(sys.modules, {"serial": broken}):
            with self.assertRaises(ImportError):
                runtime_check.signature(ROOT / "gateway")

    def test_aiohttp_namespace_without_client_session_is_not_a_ready_installation(self):
        broken = types.ModuleType("aiohttp")
        with patch.dict(sys.modules, {"aiohttp": broken}):
            with self.assertRaises(ImportError):
                runtime_check.signature(ROOT / "gateway")

    def test_actual_locked_environment_imports_required_startup_and_device_symbols(self):
        actual = runtime_check.signature(ROOT / "gateway")
        self.assertIn("pyserial", actual["packages"])
        self.assertIn("bleak", actual["packages"])
        self.assertIn("aiohttp", actual["packages"])

    def test_virtual_environment_cannot_inherit_global_site_packages(self):
        original = Path.read_text
        config = Path(sys.prefix) / "pyvenv.cfg"
        def contaminated(path, *args, **kwargs):
            text = original(path, *args, **kwargs)
            if path == config:
                text = text.replace("include-system-site-packages = false",
                                    "include-system-site-packages = true")
            return text
        with patch.object(Path, "read_text", contaminated):
            with self.assertRaisesRegex(ValueError, "system site"):
                runtime_check.signature(ROOT / "gateway")
