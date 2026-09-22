"""京都ラボのサイトの公開前チェック。リポジトリのルートで実行する。"""

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
SITE = "https://kyotolab.github.io"
REQUIRED = ["description", "canonical", "og:title", "og:description", "og:image"]
# デモは og:image がまだない（CLAUDE.md の未完了を参照）
OG_IMAGE_OPTIONAL = {"tools/menu/index.html", "tools/sento/index.html"}

errors = warnings = 0


def report(level, page, msg):
    global errors, warnings
    if level == "ERROR":
        errors += 1
    else:
        warnings += 1
    print(f"{level:5} {page}: {msg}")


def has_meta(html, key):
    if key == "canonical":
        return re.search(r'<link[^>]+rel="canonical"', html) is not None
    attr = "property" if key.startswith("og:") else "name"
    return re.search(rf'<meta[^>]+{attr}="{re.escape(key)}"[^>]+content="[^"]+"', html) is not None


def target_exists(page, href):
    url = urlparse(href)
    if url.scheme or href.startswith(("#", "mailto:", "tel:")):
        if not href.startswith(SITE):
            return True
        path = url.path
        base = ROOT
    else:
        path = url.path
        base = page.parent
    if not path:
        return True
    target = (ROOT / path.lstrip("/")) if path.startswith("/") else (base / path)
    if path.endswith("/"):
        target = target / "index.html"
    return target.exists()


pages = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts and ".claude" not in p.parts)
for page in pages:
    rel = page.relative_to(ROOT).as_posix()
    html = page.read_text(encoding="utf-8")

    lang = re.search(r'<html[^>]*lang="([^"]+)"', html)
    if not lang:
        report("ERROR", rel, "<html> に lang がない")

    for key in REQUIRED:
        if not has_meta(html, key):
            level = "WARN" if key == "og:image" and rel in OG_IMAGE_OPTIONAL else "ERROR"
            report(level, rel, f"{key} がない")

    canonical = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', html)
    expected = f"{SITE}/{rel.removesuffix('index.html')}"
    if canonical and canonical.group(1) != expected:
        report("ERROR", rel, f"canonical が {canonical.group(1)}（{expected} のはず）")

    embedded = len(re.findall(r'src="data:image', html))
    if embedded:
        report("WARN", rel, f"base64 の画像が {embedded} 個埋め込まれている。JPEG に切り出す")

    for href in re.findall(r'(?:href|src)="([^"]+)"', html):
        if not target_exists(page, href):
            report("ERROR", rel, f"リンク先がない: {href}")

profile = (ROOT / "profile/index.html").read_text(encoding="utf-8")
if 'name="robots" content="noindex' not in profile:
    report("ERROR", "profile/index.html", "noindex が外れている")

print(f"\n{len(pages)} ページ: ERROR {errors} 件, WARN {warnings} 件")
sys.exit(1 if errors else 0)
