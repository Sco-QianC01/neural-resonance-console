"""Render the original UTF-8 method documents; never rewrite their source."""
from pathlib import Path
import hashlib
import html
import re
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = ["PLANAR-METHODS", "EVIDENCE", "MUSIC-PLANS", "WORM-METHODS", "MUSIC-FUSION", "LISTENING-METHODS", "SCORE-EVIDENCE"]


def build():
    renderer = MarkdownIt("commonmark", {"html": False}).enable("table")
    def render_text(tokens, index, options, env):
        text = tokens[index].content
        opened = sum(1 if token.type == "link_open" else -1 if token.type == "link_close" else 0
                     for token in tokens[:index])
        if opened:
            return html.escape(text)
        parts = re.split(r"(https?://[^\s<>\")]+)", text)
        return "".join(
            f'<a href="{html.escape(part, quote=True)}" target="_blank" rel="noopener">{html.escape(part)}</a>'
            if re.match(r"https?://", part) else html.escape(part) for part in parts
        )
    renderer.renderer.rules["text"] = render_text
    for name in DOCUMENTS:
        source = ROOT / "docs" / f"{name}.md"
        if not source.is_file():
            continue
        raw = source.read_bytes()
        text = raw.decode("utf-8")
        title = text.splitlines()[0].lstrip("# ").strip()
        body = renderer.render(text)
        for other in DOCUMENTS:
            body = body.replace(f'href="{other}.md"', f'href="{other}.html"')
        body = re.sub(r'<a(?![^>]*\btarget=) href="(https://[^"]+)"',
                      r'<a target="_blank" rel="noopener" href="\1"', body)
        document = f"""<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="source-sha256" content="{hashlib.sha256(raw).hexdigest()}">
<title>{html.escape(title)} · 神經共振</title>
<link rel="stylesheet" href="../neural-worm/style.css">
<link rel="stylesheet" href="./method-documents.css"></head>
<body class="method-document"><header class="document-header">
<a href="../#worm">← 神經共振</a><a href="./{name}.md" download>下載原文 Markdown</a>
</header><main><article>{body}</article></main></body></html>
"""
        source.with_suffix(".html").write_text(document, encoding="utf-8")
        print(f"{name}.html {len(document.encode('utf-8'))} bytes")


if __name__ == "__main__":
    build()
