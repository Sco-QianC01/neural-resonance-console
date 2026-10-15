"""Offline readiness check for the exact locked acquisition environment."""
import argparse
import hashlib
from importlib import metadata
import json
import platform
from pathlib import Path
import sys
import tomllib


def signature(project):
    root = Path(project)
    digest = hashlib.sha256()
    for name in ("pyproject.toml", "uv.lock"):
        digest.update(name.encode())
        digest.update((root / name).read_bytes())
    project_config = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    expected = project_config["dependencies"]
    versions = {}
    for requirement in expected:
        # Project runtime dependencies use exact pins; no build/audit packages.
        item, _, marker = requirement.partition(";")
        if marker and ("win32" in marker):
            required_windows = "!=" not in marker
            if required_windows != (sys.platform == "win32"):
                continue
        name, version = (part.strip() for part in item.split("=="))
        installed = metadata.version(name)
        if installed != version:
            raise ValueError(f"Locked dependency mismatch: {name}")
        versions[name] = installed
    if sys.prefix == sys.base_prefix:
        raise ValueError("A private virtual environment is required")
    config = Path(sys.prefix) / "pyvenv.cfg"
    settings = {key.strip(): value.strip()
                for line in config.read_text(encoding="utf-8").splitlines() if "=" in line
                for key, value in [line.split("=", 1)]}
    home = settings.get("home", "")
    if not home or not Path(home).is_dir():
        raise ValueError("Virtual environment points to an absent Python installation")
    # Actually import backends used at startup, not just their package metadata.
    from aiohttp import ClientSession, web
    from bleak import BleakClient, BleakScanner
    from serial import Serial
    from serial.tools import list_ports
    return {"schemaVersion": 1, "lockSha256": digest.hexdigest(),
            "platform": sys.platform, "machine": platform.machine().lower(),
            "python": list(sys.version_info[:2]), "packages": versions}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--stamp", required=True)
    parser.add_argument("--write-stamp", action="store_true")
    args = parser.parse_args()
    try:
        value = signature(args.project)
        stamp = Path(args.stamp)
        if args.write_stamp:
            stamp.parent.mkdir(parents=True, exist_ok=True)
            temp = stamp.with_suffix(".tmp")
            temp.write_text(json.dumps(value, indent=2), encoding="utf-8")
            temp.replace(stamp)
        elif json.loads(stamp.read_text(encoding="utf-8")) != value:
            raise ValueError("Environment stamp changed")
        print("Isolated locked environment ready (offline).")
    except (OSError, ValueError, ImportError, metadata.PackageNotFoundError) as error:
        print(f"Environment requires installation: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
