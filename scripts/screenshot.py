"""Снимает скриншоты страниц через headless Chrome.

Запуск: python3 scripts/screenshot.py <url> <out.png> [ширина] [высота]
"""

import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def shoot(url: str, out: Path, width: int = 1500, height: int = 1000) -> None:
    chrome = next((p for n in ("google-chrome", "chromium", "chromium-browser") if (p := shutil.which(n))), None)
    if not chrome:
        sys.exit("Chrome/Chromium не найден в PATH")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        tmp_png = Path(tmp) / "shot.png"
        proc = subprocess.Popen(
            [chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
             f"--user-data-dir={Path(tmp) / 'profile'}", f"--window-size={width},{height}",
             "--virtual-time-budget=4000", f"--screenshot={tmp_png}", url],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Headless Chrome may keep running after writing the file, so wait for the file instead of the process.
        deadline = time.monotonic() + 60
        last = -1
        while time.monotonic() < deadline:
            size = tmp_png.stat().st_size if tmp_png.exists() else -1
            if size > 0 and size == last:
                break
            last = size
            time.sleep(0.7)
        proc.kill()
        proc.wait()
        if not tmp_png.exists():
            sys.exit(f"Скриншот не создан: {url}")
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(tmp_png, out)


if __name__ == "__main__":
    args = sys.argv[1:]
    shoot(args[0], Path(args[1]), *(int(a) for a in args[2:4]))
