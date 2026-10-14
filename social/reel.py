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
縦に長い写真は、"max_h"（既定880）の高さまで上下を切る。"focus_y"（0〜1、既定0.5）で、残す位置を上下に寄せられる。

"style": "video" にすると、撮った動画を縦長に編集する。動画は4:5に切り、ぼかした自分自身を背景に敷いて、
上に大きな文字を時間に合わせて重ねる。元の音は使わず、無音のトラックを付ける（人の声が入るため）。
撮った動画は公開リポジトリに入れない。spec の "source" か、環境変数 REEL_SOURCE でパスを渡す。

    {"style": "video", "source": "IMG_1134.mov", "start": 0, "end": 10.5, "crop_x": 0.5,
     "texts": [{"from": 0, "to": 3.6, "label": "ARASHIYAMA", "head": "POV: ...", "body": "..."}]}
縦に撮った動画（幅が4:5に足りない）は、"layout": "full" にする。画面いっぱいに置き、"zoom"（既定0.06）の分だけ
ゆっくり寄せ、"focus_x"・"focus_y"（0〜1）で寄せる先を決める。文字は左の半分に収め、そこだけ暗くして読ませる。
Instagram の画面の下と右にはボタンが重なるので、文字は真ん中から上に置く。
Pillow と ffmpeg が要る（python3 -m pip install pillow imageio-ffmpeg）。GitHub Actions では動かさない。
"""

import json
import os
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
    if art:
        # 縦に長い写真は、下のボタンに文字がかぶらないように、上下を切って 1080x880 までにする
        max_h = int(scene.get("max_h", 880))
        keep = art.width * max_h / W
        if art.height > keep:
            top = round((art.height - keep) * float(scene.get("focus_y", 0.5)))
            art = art.crop((0, top, art.width, top + round(keep)))
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


VID_Y, VID_H = 230, 1350  # 動画を置く縦の位置と高さ（4:5）
TEXT_FADE = 0.2


def full_shade():
    """縦動画の左の半分を暗くする影。右の被写体は明るいまま残す。"""
    from PIL import ImageChops
    hx = Image.new("L", (W, 1))
    hx.putdata([max(0, round(255 * max(0, 1 - x / 800) ** 1.3)) for x in range(W)])
    vy = Image.new("L", (1, H))
    vy.putdata([255 if y < 760 else round(255 * max(0, 1 - (y - 760) / 520)) for y in range(H)])
    mask = ImageChops.multiply(hx.resize((W, H)), vy.resize((W, H))).point(lambda v: v * 165 // 255)
    top = Image.new("L", (1, H))
    top.putdata([round(100 * max(0, 1 - y / 360)) for y in range(H)])
    mask = ImageChops.lighter(mask, top.resize((W, H)))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.putalpha(mask)
    return im


def text_layer(t, with_frame=False, full=False):
    """動画の上に重ねる、透明な1080x1920の画像。with_frame なら、上の影と名前だけを描く。"""
    if with_frame:
        if full:
            im = full_shade()
        else:
            im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            for y in range(VID_Y, VID_Y + 760):
                a = round(150 * (1 - (y - VID_Y) / 760) ** 1.6)
                d.line((0, y, W, y), fill=(0, 0, 0, a))
        ImageDraw.Draw(im).text((PAD, 130), f"KYOTO LAB  {HANDLE}", font=font(30), fill=(240, 240, 240, 255))
        return im
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = 330 if full else VID_Y + 90
    width = 640 if full else W - 2 * PAD
    if t.get("label"):
        d.text((PAD, y), t["label"], font=font(42, True), fill="#F2C14E")
        y += 84
    y = shadow_text(d, (PAD, y), t["head"], font(84 if full else 96, True), width, "#FFFFFF", 14)
    if t.get("body"):
        shadow_text(d, (PAD, y + 40), t["body"], font(46 if full else 52), width, "#F0F0F0", 18)
    return im


def build_video(spec, out):
    src = Path(os.environ.get("REEL_SOURCE") or spec["source"]).expanduser()
    if not src.is_file():
        raise SystemExit(f"元の動画がない: {src}（REEL_SOURCE にパスを渡す）")
    start, end = float(spec.get("start", 0)), float(spec["end"])
    dur = end - start
    cx = float(spec.get("crop_x", 0.5))
    full = spec.get("layout") == "full"
    texts = spec["texts"]
    with tempfile.TemporaryDirectory() as tmp:
        layers = [text_layer(None, with_frame=True, full=full)] + [text_layer(t, full=full) for t in texts]
        inputs = ["-ss", f"{start}", "-t", f"{dur}", "-i", str(src)]
        for i, im in enumerate(layers):
            p = Path(tmp) / f"t{i}.png"
            im.save(p)
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", str(p)]
        if full:
            # 2倍に伸ばしてから寄せる（zoompan は整数の位置で動くので、そのままだとカクつく）
            z = float(spec.get("zoom", 0.06))
            fx, fy = float(spec.get("focus_x", 0.5)), float(spec.get("focus_y", 0.5))
            frames = max(1, round(dur * FPS))
            chain = [
                f"[0:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop={W * 2}:{H * 2},"
                f"zoompan=z='1+{z}*on/{frames}':x='(iw-iw/zoom)*{fx}':y='(ih-ih/zoom)*{fy}':d=1:s={W}x{H}:fps={FPS}[base]",
                "[base][1:v]overlay=0:0[v0]",
            ]
        else:
            chain = [
                "[0:v]split=2[a][b]",
                f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:2,eq=brightness=-0.2[bg]",
                f"[b]crop=ih*4/5:ih:(iw-ow)*{cx}:0,scale={W}:{VID_H}:flags=lanczos[fg]",
                f"[bg][fg]overlay=0:{VID_Y}[base]",
                "[base][1:v]overlay=0:0[v0]",
            ]
        for i, t in enumerate(texts):
            a, b = float(t["from"]), float(t["to"])
            chain.append(
                f"[{i + 2}:v]format=rgba,fade=t=in:st={a}:d={TEXT_FADE}:alpha=1,"
                f"fade=t=out:st={b - TEXT_FADE}:d={TEXT_FADE}:alpha=1[x{i}]"
            )
            chain.append(f"[v{i}][x{i}]overlay=0:0:eof_action=pass[v{i + 1}]")
        chain.append(f"[v{len(texts)}]format=yuv420p[v]")
        n = len(layers) + 1
        cmd = [ffmpeg(), "-y", "-loglevel", "error", *inputs,
               "-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
               "-filter_complex", ";".join(chain), "-map", "[v]", "-map", f"{n}:a",
               "-map_metadata", "-1", "-map_chapters", "-1",
               "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "25", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
               str(out / "reel.mp4")]
        subprocess.run(cmd, check=True)
        # 表紙は、最初の文字が出そろった1秒のところ
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-ss", "1.0", "-i", str(out / "reel.mp4"),
                        "-frames:v", "1", "-q:v", "3", str(out / "cover.jpg")], check=True)
    return dur


def build(spec_path):
    spec_path = Path(spec_path)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    out = ROOT / "assets" / "ig" / spec_path.stem
    out.mkdir(parents=True, exist_ok=True)
    if spec.get("style") == "video":
        dur = build_video(spec, out)
        print(f"video: {(out / 'reel.mp4').relative_to(ROOT).as_posix()}（{dur:.1f}秒）")
        return
    scenes = spec.get("scenes")
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
