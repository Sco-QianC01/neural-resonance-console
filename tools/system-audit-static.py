"""Check deployable UTF-8, JSON, local assets and parseable Python without secrets."""
import ast
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/system-audit-20261012"
EXTENSIONS = {".md", ".json", ".mjs", ".js", ".html", ".css", ".py", ".ps1",
              ".command", ".toml", ".yml", ".txt", ".svg", ".cmd"}


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths, self.ids = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for name in ("href", "src"):
            value = attrs.get(name)
            if value and not value.startswith(("#", "data:", "http:", "https:", "mailto:")):
                self.paths.append(value)


def main():
    files = [ROOT / name for name in ("index.html", "README.md", "Start-Windows.ps1",
                                     "Start-Windows.cmd", "Start-macOS.command")]
    for tree in ("src", "public", "docs", "neural-worm", "gateway", "tests", "tools", ".github"):
        files.extend(p for p in (ROOT / tree).rglob("*")
                     if p.is_file() and p.suffix in EXTENSIONS
                     and not any(part in {"__pycache__", "build", ".venv", "node_modules"} for part in p.parts))
    issues, checked = [], Counter()
    for file in sorted(set(files)):
        name = file.relative_to(ROOT).as_posix()
        try:
            text = file.read_text(encoding="utf-8")
            if "\ufffd" in text:
                issues.append({"file": name, "error": "replacement character"})
            if file.suffix == ".json":
                json.loads(text)
                checked["json"] += 1
            elif file.suffix == ".py":
                ast.parse(text.lstrip("\ufeff"), filename=name)
                checked["python"] += 1
            elif file.suffix == ".html":
                parser = References()
                parser.feed(text)
                duplicates = [key for key, count in Counter(parser.ids).items() if count > 1]
                if duplicates:
                    issues.append({"file": name, "error": "duplicate HTML ids", "ids": duplicates})
                for value in parser.paths:
                    part = unquote(urlsplit(value).path)
                    if not part:
                        continue
                    target = (ROOT / part.lstrip("/")) if part.startswith("/") else file.parent / part
                    if target.is_dir():
                        target /= "index.html"
                    if not target.exists():
                        issues.append({"file": name, "error": "missing local asset", "target": value})
                checked["html"] += 1
            elif file.suffix in (".mjs", ".js"):
                patterns = r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.{1,2}/[^'"]+)['"]"""
                for value in re.findall(patterns, text):
                    if not (file.parent / value).is_file():
                        issues.append({"file": name, "error": "missing JS module", "target": value})
                result = subprocess.run(["node", "--check", str(file)], capture_output=True, text=True)
                if result.returncode:
                    issues.append({"file": name, "error": "JS syntax", "detail": result.stderr[-500:]})
                checked["javascript"] += 1
            checked["utf8"] += 1
        except (UnicodeError, ValueError, SyntaxError) as error:
            issues.append({"file": name, "error": str(error)})
    shell = subprocess.run(["sh", "-n", str(ROOT / "Start-macOS.command")],
                           capture_output=True, text=True)
    if shell.returncode:
        issues.append({"file": "Start-macOS.command", "error": shell.stderr})
    shell = subprocess.run(["sh", "-n", str(ROOT / "tools/start-macos.sh")],
                           capture_output=True, text=True)
    if shell.returncode:
        issues.append({"file": "tools/start-macos.sh", "error": shell.stderr})
    result = {"checks": dict(checked), "issues": issues, "pass": not issues}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "static-audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
