#!/usr/bin/env python3
"""Baut aus src/ wieder eine einzelne, offline lauffähige HTML-Datei.

Jedes lokale <link rel="stylesheet" href="..."> und <script src="..."></script>
in src/index.html wird durch den Dateiinhalt ersetzt (inline).

  python3 tools/build.py            -> index.html (für GitHub Pages / Doppelklick)
  python3 tools/build.py out.html   -> eigene Zieldatei
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def read(rel):
    return (SRC / rel).read_text(encoding="utf-8").rstrip("\n")


def build():
    html = (SRC / "index.html").read_text(encoding="utf-8")

    def css(m):
        return "<style>\n" + read(m.group(1)) + "\n</style>"

    def js(m):
        code = read(m.group(1))
        if re.search(r"</script", code, re.I):
            raise SystemExit(f"{m.group(1)} enthält '</script' – kann nicht inline eingebettet werden")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="(?!https?:)([^"]+)">', css, html)
    html = re.sub(r'<script src="(?!https?:)([^"]+)"></script>', js, html)
    return html


if __name__ == "__main__":
    out = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "index.html")
    data = build()
    out.write_text(data, encoding="utf-8")
    print(f"{out}: {len(data.encode('utf-8')) / 1e6:.2f} MB")
