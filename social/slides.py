"""Instagram のカルーセル（スワイプで見る複数枚）の画像を作る。リポジトリのルートで実行する。

  python3 social/slides.py social/instagram/slides/<slug>.json

JSON に書いた絵と文字から、縦長 1080x1350 の JPEG を assets/ig/<slug>/1.jpg, 2.jpg … に書き出す。
1枚目は絵とタイトル、2枚目からは文字のカード、最後は「保存して、送って」のカード。
投稿文（social/instagram/<slug>.txt）の images: に、書き出した画像を順に並べる。

    {
      "image": "assets/fushimi-inari.jpg",
      "label": "SPOT GUIDE",
      "title": "Fushimi Inari without the crowd",
      "cards": [
        {"label": "WHEN", "head": "Quiet before 7 a.m.", "body": "Busy from about 10 a.m. to 3 p.m."}
      ]
    }

色はサイトの :root と同じ（文字 --fg、ラベル --gold）。触れるものがないので青は使わない。
Pillow が要る（python3 -m pip install pillow）。GitHub Actions では動かさない。
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 1080, 1350
PAD = 96
BG, BG2, FG, FG2, GOLD, LINE = "#FFFFFF", "#F5F5F7", "#1D1D1F", "#6E6E73", "#A33A2C", "#E3E3E6"
FONTS = Path("/usr/share/fonts/truetype/liberation")
HANDLE = "@kyotolab923"
END = {
    "label": "BEFORE YOU GO",
    "head": "Save this. Send it to your Kyoto travel buddy.",
    "body": "Hours and prices change, so check the official site. Free crowd forecast: search “Kyoto Tourism Comfort Map”. Full guide: link in bio.",
}


def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ("LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf")), size)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def block(draw, xy, text, fnt, width, fill, gap):
    x, y = xy
    for line in wrap(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    return y


def footer(draw, page, total):
    y = H - PAD
    draw.line((PAD, y - 40, W - PAD, y - 40), fill=LINE, width=2)
    f = font(30)
    draw.text((PAD, y - 10), f"KYOTO LAB  {HANDLE}", font=f, fill=FG2, anchor="ls")
    draw.text((W - PAD, y - 10), f"{page} / {total}", font=f, fill=FG2, anchor="rs")


def cover(spec, total):
    im = Image.new("RGB", (W, H), BG)
    art = Image.open(ROOT / spec["image"]).convert("RGB")
    # 絵は幅いっぱいにして、真ん中を 3:2 の高さで切る
    ah = round(W * 2 / 3)
    scale = max(W / art.width, ah / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    left, top = (art.width - W) // 2, (art.height - ah) // 2
    im.paste(art.crop((left, top, left + W, top + ah)), (0, 0))
    d = ImageDraw.Draw(im)
    y = ah + 72
    d.text((PAD, y), spec.get("label", "SPOT GUIDE"), font=font(34, True), fill=GOLD)
    block(d, (PAD, y + 64), spec["title"], font(76, True), W - 2 * PAD, FG, 14)
    footer(d, 1, total)
    return im


def card(c, page, total, numbered=True):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    if numbered:
        d.text((PAD, 150), f"{page - 1:02d}", font=font(150, True), fill=GOLD)
    y = 400
    d.text((PAD, y), c["label"], font=font(36, True), fill=GOLD)
    y = block(d, (PAD, y + 76), c["head"], font(88, True), W - 2 * PAD, FG, 16)
    if c.get("body"):
        block(d, (PAD, y + 52), c["body"], font(50), W - 2 * PAD, FG2, 22)
    footer(d, page, total)
    return im


def build(spec_path):
    spec_path = Path(spec_path)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    out = ROOT / "assets" / "ig" / spec_path.stem
    out.mkdir(parents=True, exist_ok=True)
    cards = spec["cards"]
    total = len(cards) + 2
    if not 2 <= total <= 10:
        raise SystemExit(f"カルーセルは2枚から10枚。いまは {total} 枚")
    pages = [cover(spec, total)] + [card(c, i + 2, total) for i, c in enumerate(cards)]
    pages.append(card(spec.get("end", END), total, total, numbered=False))
    paths = []
    for i, im in enumerate(pages, 1):
        p = out / f"{i}.jpg"
        im.save(p, quality=88, optimize=True, progressive=True)
        paths.append(p.relative_to(ROOT).as_posix())
    print("images: " + ", ".join(paths))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        build(arg)
