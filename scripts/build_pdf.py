"""Собирает TZ.pdf из TZ.md: Markdown -> HTML -> PDF через headless Chrome.

Требования: python3 -m pip install markdown; установленный Google Chrome/Chromium.
Запуск: python3 scripts/build_pdf.py
"""

import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "TZ.md"
OUT = ROOT / "TZ.pdf"

CSS = """
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
body { font-family: "DejaVu Sans", "Noto Sans", Arial, sans-serif; font-size: 10pt;
       line-height: 1.45; color: #1d1d1f; }
h1 { font-size: 20pt; margin: 0 0 4pt; color: #111; }
h2 { font-size: 15pt; margin: 18pt 0 6pt; padding-bottom: 3pt;
     border-bottom: 2px solid #f5c400; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; page-break-after: avoid; }
h2:first-of-type { border: none; font-size: 14pt; color: #555; margin-top: 0; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 8.8pt;
        page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #c9c9cf; padding: 4pt 5pt; vertical-align: top; text-align: left; }
th { background: #f2f2f5; }
td.id { white-space: nowrap; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 8.6pt; background: #f4f4f6;
       padding: 0 2pt; border-radius: 2pt; }
pre { background: #f7f7f9; border: 1px solid #e1e1e6; padding: 6pt 8pt; border-radius: 4pt;
      page-break-inside: avoid; overflow: hidden; }
pre code { background: none; padding: 0; font-size: 7.6pt; line-height: 1.25; }
hr { border: none; border-top: 1px solid #ddd; margin: 12pt 0; }
a { color: #0b5cad; text-decoration: none; }
ul, ol { margin: 4pt 0 6pt; padding-left: 18pt; }
"""


def find_chrome() -> str:
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        path = shutil.which(name)
        if path:
            return path
    sys.exit("Chrome/Chromium не найден в PATH")


def main() -> None:
    body = markdown.markdown(SRC.read_text(encoding="utf-8"),
                             extensions=["tables", "fenced_code", "sane_lists"])
    body = re.sub(r"<td>([A-ZА-Я]-\d+)</td>", r'<td class="id">\1</td>', body)
    html = (f'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            f"<title>Техническое задание — YM Skins</title><style>{CSS}</style></head>"
            f"<body>{body}</body></html>")
    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / "tz.html"
        html_path.write_text(html, encoding="utf-8")
        tmp_pdf = Path(tmp) / "out.pdf"
        proc = subprocess.Popen(
            [find_chrome(), "--headless=new", "--no-sandbox", "--disable-gpu",
             "--no-first-run", "--disable-extensions", "--no-pdf-header-footer",
             f"--user-data-dir={Path(tmp) / 'profile'}", f"--print-to-pdf={tmp_pdf}",
             html_path.as_uri()],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Headless Chrome may keep running after the PDF is written, so wait for the file instead of the process.
        deadline = time.monotonic() + 120
        last_size = -1
        while time.monotonic() < deadline:
            if proc.poll() is not None and tmp_pdf.exists():
                break
            size = tmp_pdf.stat().st_size if tmp_pdf.exists() else -1
            if size > 0 and size == last_size:
                break
            last_size = size
            time.sleep(1)
        proc.kill()
        proc.wait()
        if not tmp_pdf.exists() or tmp_pdf.stat().st_size == 0:
            sys.exit("Chrome не создал PDF")
        shutil.copyfile(tmp_pdf, OUT)
    print(f"Готово: {OUT}")


if __name__ == "__main__":
    main()
