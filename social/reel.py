"""Instagram のリール（縦長の短い動画）を作る。リポジトリのルートで実行する。

  python3 social/reel.py social/instagram/reels/<slug>.json

JSON に書いた場面を、縦長 1080x1920 の画面にして、ひとつの MP4 にまとめる。
書き出し先は assets/ig/<slug>/reel.mp4 と、表紙の assets/ig/<slug>/cover.jpg。
投稿文（social/instagram/<slug>.txt）の video: に reel.mp4 を書く。

    {
      "scenes": [
        {"image": "assets/xxx.jpg", "label": "01", "head": "見出し", "body": "説明", "seconds": 4}
      ]
    }

image のない場面は白地に文字だけ。音は入れない（無音のトラックだけ付ける）。

"style": "photo" にすると、写真を主役にした形になる。ぼかした写真を背景に敷き、
写真を幅いっぱいに置いてゆっくり寄せ、白い大きな文字を上に重ねる。場面は溶かさずに切り替える。
旅行のリールでよく見る形で、最初の1枚目で何の話かが分かるようにする。
Instagram の画面の下と右にはボタンが重なるので、文字は真ん中から上に置く。
Pillow と ffmpeg が要る（python3 -m pip install pillow imageio-ffmpeg）。GitHub Actions では動かさない。
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from slides import BG, FG, FG2, GOLD, HANDLE, ROOT, block, font  # noqa: E402

W, H = 1080, 1920
PAD = 96
FPS = 30
FADE = 0.4


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
    except ImportError:
        raise SystemExit("ffmpeg がない。python3 -m pip install imageio-ffmpeg") from None
    return imageio_ffmpeg.get_ffmpeg_exe()


def frame(scene):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    top = 260
    if scene.get("image"):
        art = Image.open(ROOT / scene["image"]).convert("RGB")
        ah = 1000
        scale = max(W / art.width, ah / art.height)
        art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
        left, t = (art.width - W) // 2, (art.height - ah) // 2
        im.paste(art.crop((left, t, left + W, t + ah)), (0, 160))
        top = 160 + ah + 64
    if scene.get("label"):
        d.text((PAD, top), scene["label"], font=font(40, True), fill=GOLD)
        top += 72
    y = block(d, (PAD, top), scene["head"], font(76 if scene.get("image") else 96, True), W - 2 * PAD - 80, FG, 14)
    if scene.get("body"):
        block(d, (PAD, y + 36), scene["body"], font(46), W - 2 * PAD - 80, FG2, 18)
    d.text((PAD, 110), f"KYOTO LAB  {HANDLE}", font=font(30), fill=FG2)
    return im


ZOOM = 0.06  # 1つの場面のあいだに、写真をどれだけ寄せるか


def cover_fit(im, w, h):
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def shadow_text(d, xy, text, fnt, width, fill, gap):
    # 写真の上でも読めるように、文字の下に薄い影を落とす
    x, y = xy
    block(d, (x + 3, y + 4), text, fnt, width, "#000000", gap)
    return block(d, (x, y), text, fnt, width, fill, gap)


def photo_layers(scene, backdrop):
    """動かない部分（背景と文字）と、寄せていく写真を返す。"""
    art = Image.open(ROOT / scene["image"]).convert("RGB") if scene.get("image") else None
    src = art or backdrop
    if src is not None:
        bg = cover_fit(src, W, H).filter(ImageFilter.GaussianBlur(40))
        bg = ImageEnhance.Brightness(bg).enhance(0.45)
    else:
        bg = Image.new("RGB", (W, H), FG)
    d = ImageDraw.Draw(bg)
    y = 230
    if scene.get("label"):
        d.text((PAD, y), scene["label"], font=font(42, True), fill="#F2C14E")
        y += 80
    y = shadow_text(d, (PAD, y), scene["head"], font(84 if art else 104, True), W - 2 * PAD, "#FFFFFF", 14)
    box = None
    if art:
        ph = round(W * art.height / art.width)
        box = (0, max(y + 50, 640), W, max(y + 50, 640) + ph)
        y = box[3]
    if scene.get("body"):
        shadow_text(d, (PAD, y + 56), scene["body"], font(48), W - 2 * PAD, "#E6E6E6", 18)
    d.text((PAD, 130), f"KYOTO LAB  {HANDLE}", font=font(30), fill="#CFCFCF")
    return bg, art, box, src


def photo_frame(bg, art, box, k):
    im = bg.copy()
    if art:
        w, h = box[2] - box[0], box[3] - box[1]
        z = 1 + ZOOM * k
        cw, ch = art.width / z, art.height / z
        left, top = (art.width - cw) / 2, (art.height - ch) / 2
        im.paste(art.resize((w, h), Image.LANCZOS, box=(left, top, left + cw, top + ch)), box[:2])
    return im


def build_photo(scenes, out):
    cmd = [ffmpeg(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
           "-map", "0:v", "-map", "1:a", "-shortest",
           "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out / "reel.mp4")]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total, backdrop = 0.0, None
    for i, scene in enumerate(scenes):
        bg, art, box, backdrop = photo_layers(scene, backdrop)
        n = round(float(scene.get("seconds", 2.5)) * FPS)
        for f in range(n):
            im = photo_frame(bg, art, box, f / max(n - 1, 1))
            if i == 0 and f == 0:
                im.save(out / "cover.jpg", quality=88, optimize=True, progressive=True)
            proc.stdin.write(im.tobytes())
        total += n / FPS
    proc.stdin.close()
    if proc.wait():
        raise SystemExit("ffmpeg が失敗した")
    return total


def build(spec_path):
    spec_path = Path(spec_path)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    scenes = spec["scenes"]
    out = ROOT / "assets" / "ig" / spec_path.stem
    out.mkdir(parents=True, exist_ok=True)
    if spec.get("style") == "photo":
        total = build_photo(scenes, out)
        print(f"video: {(out / 'reel.mp4').relative_to(ROOT).as_posix()}（{total:.1f}秒）")
        return
    with tempfile.TemporaryDirectory() as tmp:
        inputs, lengths = [], []
        for i, scene in enumerate(scenes):
            p = Path(tmp) / f"{i}.png"
            frame(scene).save(p)
            if i == 0:
                frame(scene).save(out / "cover.jpg", quality=88, optimize=True, progressive=True)
            sec = float(scene.get("seconds", 3))
            lengths.append(sec)
            inputs += ["-loop", "1", "-t", str(sec + FADE), "-framerate", str(FPS), "-i", str(p)]
        # 場面を順に重ねて、FADE 秒ずつ溶かしてつなぐ
        chain, last, offset = [], "[0:v]", 0.0
        for i in range(1, len(scenes)):
            offset += lengths[i - 1]
            tag = f"[v{i}]"
            chain.append(f"{last}[{i}:v]xfade=transition=fade:duration={FADE}:offset={offset:.2f}{tag}")
            last = tag
        total = sum(lengths) + FADE
        graph = ";".join(chain) + f";{last}format=yuv420p[v]" if chain else "[0:v]format=yuv420p[v]"
        cmd = [ffmpeg(), "-y", "-loglevel", "error", *inputs,
               "-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
               "-filter_complex", graph, "-map", "[v]", "-map", f"{len(scenes)}:a",
               "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
               str(out / "reel.mp4")]
        subprocess.run(cmd, check=True)
    print(f"video: {(out / 'reel.mp4').relative_to(ROOT).as_posix()}（{total:.1f}秒）")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        build(arg)
