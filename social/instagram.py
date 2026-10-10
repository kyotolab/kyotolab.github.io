"""京都ラボの Instagram 投稿。リポジトリのルートで実行する。

  python3 social/instagram.py check [FILE ...]            投稿文を確かめる（ネットにつながない）
  python3 social/instagram.py post [--dry-run] [FILE ...]  投稿する。--dry-run は投稿の直前で止める。
                                                          FILE がなければ、トークンが使えるかだけを見る
  python3 social/instagram.py due [--dry-run]              date: が今日（日本時間）の投稿文を投稿する
  python3 social/instagram.py refresh                      トークンの期限を60日先に延ばす

投稿文は social/instagram/<slug>.txt。頭に項目を書き、空行のあとにキャプションを書く。

    image: assets/kamogawa.jpg

    キャプション

カルーセル（スワイプで見る複数枚、2枚から10枚）にするときは、image: のかわりに images: に
画像をカンマで並べる。画像は social/slides.py で作る。

    images: assets/ig/kamogawa/1.jpg, assets/ig/kamogawa/2.jpg

date: を書いた投稿文は、main に入ってもその日まで出ない。その日の朝7時（日本時間）に
毎日の定期実行（due）が投稿する。1日1本ずつ、日をずらして並べる。その日を過ぎてから main に
入ったものは、入ったときに出る。同じキャプションがもう投稿されていたら、二度は出さない。

    date: 2026-10-12

post と refresh は、環境変数 IG_ACCESS_TOKEN（Instagram ログインの長期トークン）を使う。
ふだんは GitHub Actions（.github/workflows/instagram*.yml）から動く。
"""

import argparse
import datetime
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "social" / "instagram"
SITE = "https://kyotolab.github.io"
API = "https://graph.instagram.com/v24.0"
REFRESH = "https://graph.instagram.com/refresh_access_token"

# Instagram のフィード投稿の条件
MAX_BYTES = 8 * 1024 * 1024
MIN_WIDTH = 320
GOOD_WIDTH = 1080
MIN_RATIO, MAX_RATIO = 4 / 5, 1.91
MAX_CAPTION = 2200
MAX_HASHTAGS = 5  # 2025年12月から、1投稿5個まで
MAX_SLIDES = 10
JST = datetime.timezone(datetime.timedelta(hours=9))
MAX_MENTIONS = 20


class Fail(Exception):
    pass


def jpeg_size(data):
    """JPEG の (幅, 高さ) を返す。読めなければ None。"""
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:
            i += 1
            continue
        if marker == 0x01 or 0xD0 <= marker <= 0xD8:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        i += 2 + length
    return None


def today():
    return datetime.datetime.now(JST).date()


def load(name):
    """投稿文を読んで (表示用のパス, 画像のパスの一覧, キャプション, 投稿日か None) を返す。"""
    path = (ROOT / name).resolve()
    if path.parent != QUEUE or path.suffix != ".txt":
        raise Fail("social/instagram/ の .txt ではない")
    if not path.exists():
        raise Fail("ファイルがない")
    head, blank, caption = path.read_text(encoding="utf-8").partition("\n\n")
    if not blank:
        raise Fail("image: の行のあとに空行がない")
    fields = {}
    for line in head.splitlines():
        key, colon, value = line.partition(":")
        if not colon:
            raise Fail(f"読めない行: {line}")
        fields[key.strip()] = value.strip()
    unknown = sorted(set(fields) - {"image", "images", "date"})
    if unknown:
        raise Fail(f"知らない項目: {', '.join(unknown)}")
    if fields.get("image") and fields.get("images"):
        raise Fail("image: と images: は、どちらか一つにする")
    if fields.get("images"):
        images = [s.strip() for s in fields["images"].split(",") if s.strip()]
        if not 2 <= len(images) <= MAX_SLIDES:
            raise Fail(f"images: は2枚から{MAX_SLIDES}枚。いまは {len(images)} 枚")
    elif fields.get("image"):
        images = [fields["image"]]
    else:
        raise Fail("image: か images: がない")
    date = None
    if "date" in fields:
        try:
            date = datetime.date.fromisoformat(fields["date"])
        except ValueError:
            raise Fail(f"date: は 2026-10-12 の形にする（いまは {fields['date']}）") from None
    return path.relative_to(ROOT).as_posix(), images, caption.strip(), date


def problems(images, caption):
    """(エラーの一覧, 注意の一覧) を返す。"""
    errors, warnings = [], []
    for image in images:
        image_problems(image, errors, warnings)
    if len(images) > 1:
        sizes = {jpeg_size((ROOT / i).read_bytes()) for i in images if (ROOT / i).is_file()}
        if len(sizes) > 1:
            errors.append("カルーセルの画像の大きさがそろっていない")
    caption_problems(caption, errors, warnings)
    return errors, warnings


def image_problems(image, errors, warnings):
    path = (ROOT / image).resolve()
    if ROOT not in path.parents or not path.is_file():
        errors.append(f"画像がない: {image}")
    else:
        data = path.read_bytes()
        size = jpeg_size(data)
        if size is None:
            errors.append(f"JPEG ではない: {image}")
        else:
            width, height = size
            ratio = width / height
            if not MIN_RATIO <= ratio <= MAX_RATIO:
                errors.append(f"縦横比が {width}x{height}。4:5 から 1.91:1 のあいだにする")
            if width < MIN_WIDTH:
                errors.append(f"幅が {width}px。{MIN_WIDTH}px 以上にする")
            elif width < GOOD_WIDTH:
                warnings.append(f"幅が {width}px。{GOOD_WIDTH}px 未満は粗く見える（@700 ではなく大きいほうを使う）")
        if len(data) > MAX_BYTES:
            errors.append(f"画像が {len(data) // 1024}KB。8MB 以下にする")


def caption_problems(caption, errors, warnings):
    if not caption:
        errors.append("キャプションがない")
    if len(caption) > MAX_CAPTION:
        errors.append(f"キャプションが {len(caption)} 字。{MAX_CAPTION} 字以下にする")
    tags = re.findall(r"#[^\s#]+", caption)
    if len(tags) > MAX_HASHTAGS:
        warnings.append(f"ハッシュタグが {len(tags)} 個。Instagram は2025年12月から {MAX_HASHTAGS} 個までになった")
    mentions = re.findall(r"(?<!\w)@[\w.]+", caption)
    if len(mentions) > MAX_MENTIONS:
        errors.append(f"@ が {len(mentions)} 個。{MAX_MENTIONS} 個以下にする")


def check(names):
    if not names:
        names = [p.relative_to(ROOT).as_posix() for p in sorted(QUEUE.glob("*.txt"))]
    failed = 0
    for name in names:
        try:
            rel, images, caption, date = load(name)
        except Fail as e:
            print(f"ERROR {name}: {e}")
            failed += 1
            continue
        errors, warnings = problems(images, caption)
        if date and fresh(name) and date < today():
            errors.append(f"date: が {date} で、もう過ぎている")
        for msg in errors:
            print(f"ERROR {rel}: {msg}")
        for msg in warnings:
            print(f"WARN  {rel}: {msg}")
        failed += bool(errors)
    print(f"{len(names)} 件を確かめた。エラーは {failed} 件")
    return failed == 0


def fresh(name):
    """まだ main に入っていない投稿文なら True（PR の確かめで、日付が過ぎていないかを見るため）。"""
    base = os.environ.get("BASE_REF")
    if not base:
        return False
    res = subprocess.run(["git", "cat-file", "-e", f"{base}:{name}"], cwd=ROOT, capture_output=True)
    return res.returncode != 0


def token():
    value = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not value:
        raise Fail("IG_ACCESS_TOKEN がない。GitHub の Secrets に入れる（CLAUDE.md の「SNS」を参照）")
    return value


def request(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body), timeout=60) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        try:
            error = json.load(e)["error"]
        except (ValueError, KeyError, TypeError):
            raise Fail(f"Instagram API が HTTP {e.code} を返した") from None
        hint = ""
        if error.get("code") == 190:
            hint = "（トークンが切れているか間違っている。取り直して IG_ACCESS_TOKEN を更新する）"
        raise Fail(f"Instagram API: {error.get('message')}{hint}") from None
    except urllib.error.URLError as e:
        raise Fail(f"Instagram API につながらない: {e.reason}") from None


def get(path, **params):
    params["access_token"] = token()
    return request(f"{API}/{path}?{urllib.parse.urlencode(params)}")


def post_form(path, **params):
    params["access_token"] = token()
    return request(f"{API}/{path}", params)


def wait_for_image(url, timeout=600):
    """GitHub Pages に画像が出るのを待つ。記事と同じPRで足した画像は、デプロイが終わるまで 404 になる。"""
    deadline = time.time() + timeout
    while True:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30) as res:
                if res.headers.get("Content-Type", "").startswith("image/jpeg"):
                    return
        except urllib.error.URLError:
            pass
        if time.time() > deadline:
            raise Fail(f"{timeout // 60} 分待っても画像がサイトに出ない: {url}")
        time.sleep(15)


def container_for(user, images, caption):
    """画像を Instagram に渡して、投稿の入れ物（コンテナ）の ID を返す。"""
    urls = [f"{SITE}/{urllib.parse.quote(i, safe='/@')}" for i in images]
    for url in urls:
        wait_for_image(url)
    if len(urls) == 1:
        container = post_form(f"{user}/media", image_url=urls[0], caption=caption)["id"]
    else:
        children = []
        for url in urls:
            child = post_form(f"{user}/media", image_url=url, is_carousel_item="true")["id"]
            wait_for_container(child)
            children.append(child)
        container = post_form(f"{user}/media", media_type="CAROUSEL", children=",".join(children), caption=caption)["id"]
    wait_for_container(container)
    return container


def wait_for_container(container, timeout=120):
    deadline = time.time() + timeout
    while True:
        res = get(container, fields="status_code,status")
        code = res.get("status_code")
        if code == "FINISHED":
            return
        if code in ("ERROR", "EXPIRED"):
            raise Fail(f"Instagram が画像を受け付けなかった: {res.get('status') or code}")
        if time.time() > deadline:
            raise Fail(f"Instagram の処理が {timeout} 秒で終わらなかった（{code}）")
        time.sleep(5)


def posted_captions(user):
    """最近の投稿のキャプション。同じ投稿文を二度出さないために使う。"""
    res = get(f"{user}/media", fields="caption", limit=50)
    return {same(m.get("caption", "")) for m in res.get("data", [])}


def same(caption):
    return " ".join(caption.split())[:300]


def publish(names, dry_run, now=False):
    me = get("me", fields="user_id,username")
    user = me.get("user_id") or me["id"]
    if not names:
        print(f"トークンは使える（@{me.get('username')}）")
        return True
    print(f"@{me.get('username')} に{'投稿する前まで確かめる' if dry_run else '投稿する'}")
    failed = 0
    posted = posted_captions(user)
    for name in names:
        try:
            rel, images, caption, date = load(name)
            if date and date > today() and not now:
                print(f"SKIP  {rel}: {date} の朝7時に投稿する予約（date:）。いまは出さない")
                continue
            if same(caption) in posted:
                print(f"SKIP  {rel}: もう投稿してある")
                continue
            errors, _ = problems(images, caption)
            if errors:
                raise Fail("、".join(errors))
            container = container_for(user, images, caption)
            if dry_run:
                print(f"OK    {rel}: Instagram が画像を受け付けた。投稿はしていない")
                continue
            media = post_form(f"{user}/media_publish", creation_id=container)["id"]
            permalink = get(media, fields="permalink").get("permalink", media)
            print(f"OK    {rel}: 投稿した {permalink}")
        except Fail as e:
            print(f"ERROR {name}: {e}")
            failed += 1
    return failed == 0


def due(dry_run):
    """date: が今日（日本時間）の投稿文を投稿する。毎日の定期実行から動く。"""
    names = []
    for path in sorted(QUEUE.glob("*.txt")):
        name = path.relative_to(ROOT).as_posix()
        try:
            if load(name)[3] == today():
                names.append(name)
        except Fail as e:
            print(f"ERROR {name}: {e}")
    if not names:
        print(f"{today()} に予約した投稿文はない")
        return True
    return publish(names, dry_run)


def refresh():
    """トークンを更新する。新しい文字列が返ってきたら、SECRETS_PAT で Secrets を書き換える。"""
    if not os.environ.get("IG_ACCESS_TOKEN", "").strip():
        print("IG_ACCESS_TOKEN がまだないので、何もしない")
        return True
    old = token()
    res = request(f"{REFRESH}?{urllib.parse.urlencode({'grant_type': 'ig_refresh_token', 'access_token': old})}")
    new = res["access_token"]
    if os.environ.get("GITHUB_ACTIONS"):
        print(f"::add-mask::{new}")
    days = int(res.get("expires_in", 0)) // 86400
    if new == old:
        print(f"トークンの期限を延ばした（あと {days} 日）")
        return True
    if not os.environ.get("GH_TOKEN"):
        raise Fail(
            "新しいトークンが返ってきたが、Secrets に保存するための SECRETS_PAT がない。"
            "SECRETS_PAT を入れるか、今のトークンが切れる前に取り直して IG_ACCESS_TOKEN を更新する"
        )
    repo = os.environ["GITHUB_REPOSITORY"]
    subprocess.run(["gh", "secret", "set", "IG_ACCESS_TOKEN", "--repo", repo], input=new, text=True, check=True)
    print(f"新しいトークンを IG_ACCESS_TOKEN に保存した（あと {days} 日）")
    return True


def main():
    parser = argparse.ArgumentParser(description="京都ラボの Instagram 投稿")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check").add_argument("files", nargs="*")
    post = sub.add_parser("post")
    post.add_argument("--dry-run", action="store_true")
    post.add_argument("--now", action="store_true", help="date: の予約を無視して、すぐに投稿する")
    post.add_argument("files", nargs="*")
    sub.add_parser("due").add_argument("--dry-run", action="store_true")
    sub.add_parser("refresh")
    args = parser.parse_args()
    try:
        if args.command == "check":
            ok = check(args.files)
        elif args.command == "post":
            ok = publish(args.files, args.dry_run, now=args.now)
        elif args.command == "due":
            ok = due(args.dry_run)
        else:
            ok = refresh()
    except Fail as e:
        print(f"ERROR {e}")
        ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
