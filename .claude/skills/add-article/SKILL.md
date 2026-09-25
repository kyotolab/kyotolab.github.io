---
name: add-article
description: 京都ラボのサイトに記事を1本追加して、日本語トップ（と英語トップ）の一覧に載せる。「記事を追加」「記事を公開」「公開準備中の記事を出す」「noteやMediumの記事をサイトにも載せる」と言われたときに使う。
---

# 記事を追加する

先に `CLAUDE.md` の「書くときのルール」を読む。とくに個人情報のルールは、本文だけでなくコミットやPRにも当てはまる。

## 1. ページをつくる

1. スラッグを決める。短いローマ字か英単語にする（例 `kamogawa`、`one-day`）。
2. 近い既存の記事をコピーして `articles/<slug>/index.html` をつくる。
   - 日本語の記事: `articles/honyaku/`、`articles/kamogawa/`
   - 英語の記事: `articles/gion/`、`articles/shimogyo/`
3. `<head>` を全部書き換える。コピー元の値が残りやすいので、1つずつ確かめる。
   - `<html lang="ja">` か `<html lang="en">`
   - `<title>`、`description`
   - `canonical` と `og:url` は `https://kyotolab.github.io/articles/<slug>/`
   - `og:type` は `article`、`og:site_name` は `京都ラボ`
   - `og:title`、`og:description`、`og:image`（`og:image:width` と `og:image:height` も合わせる）
4. 本文の日付と、シリーズ名（例「京都を通る水 04」）を入れる。

## 2. 画像

- JPEG のファイルとして置く。HTML に base64 で埋め込まない。
- トップのカードでも使う画像は `assets/<名前>.jpg`（1600px幅）と `assets/<名前>@700.jpg` の2つを用意する。記事の中だけで使う画像は記事のフォルダに置いてよい。
- オリジナルのイラストを使う。人が写り込むものは使わない。

## 3. 一覧に載せる

- 日本語トップ `index.html`
  - 暮らしの記事は「京都の日常」の `.jgrid` に `a.jcard` を足す。`span.cat`（シリーズ名か分類）、`h3`、`p`（2〜3文の紹介）、`time`（`datetime="YYYY-MM-DD"`、表示は `YYYY.MM.DD`）、`span.pill.live`（公開中）を入れる。
  - 観光地は、`spots/<slug>/` に日本語の攻略ページ（行く時刻、見るところ、回り方）をつくり、「名所攻略」のカード（イラスト、名前、「攻略法を読む ›」）からリンクする。英語の解説記事は攻略ページから「英語の解説を読む（English） ›」でリンクする。攻略ページ下の「ほかの名所」の一覧も、全ページで揃える。
  - 「公開準備中」の `div.jrow` に同じ記事があれば消す。
- 英語トップ `en/index.html`
  - 観光地は、`en/spots/<slug>/` に英語の攻略ページをつくり、「Spot guide」のカード（イラスト、名前、「Read the guide ›」）からリンクする。日本語の攻略ページと同じ事実、同じ節にする。英語の解説記事があれば「Read the longer field note ›」でリンクし、フッターから日本語の攻略ページへ「日本語で読む」でリンクする。
  - 英語の記事は「Field notes」の `.jgrid` に足す。パスは `../articles/<slug>/`、ラベルは `Live`。
  - 日本語だけの記事は足さなくてよい（`jseries` の一文で日本語サイトに案内している）。
- フッターの「読みもの」に載せるのは、トップから個別にたどらせたい記事だけ。

## 4. SNS に広げる

記事を公開するPRに、SNS 用のファイルも入れる。どれも公開リポジトリに入るので、個人情報のルールはここにも当てはまる。

### Instagram（自動）

`social/instagram/<slug>.txt` をつくる。PR が `main` に入ると、GitHub Actions が投稿する。

```
image: assets/<名前>.jpg

キャプション
```

- `image:` は投稿する画像のパス。JPEG で、縦横比は 4:5 から 1.91:1 のあいだにする。カード用の `@700` ではなく大きいほうを使う。
- 読んでほしいのは外国人観光客なので、キャプションは英語を先に、日本語をあとに書く。2,200字まで。
- ハッシュタグは英語を中心に5個ほど（例 `#kyoto #kyototravel #japantravel` と名所の英語名）。日本語は1〜2個まで。
- キャプションの URL は押せない。サイトへは「プロフィールのリンクから」と案内する。プロフィールのリンクは英語トップ（`https://kyotolab.github.io/en/`）に向いている前提で書く。
- 同じ PR に投稿文を何本も入れると、取り込んだときに全部が同時に投稿される。1日1本までにしたいので、1つの PR に入れる投稿文は1本にする。
- `python3 social/instagram.py check` を通す。
- 投稿は取り消せない。PR 本文に「取り込むと Instagram に投稿される」と書く。
- 投稿されるのは、新しく足したファイルだけ。投稿したあとにファイルを直しても、もう一度は投稿されない。

### note（手で貼る）

`social/note/<slug>.txt` に、note に貼る本文を書く。オーナーがコピーして note に貼る。

- 1行目にタイトル、空行のあとに本文。見出しは1行で書き、貼ったあとで note の見出しに設定する。
- 最後に、サイトの記事への案内を入れる（例「この記事は京都ラボのサイトにも載せています。https://kyotolab.github.io/articles/<slug>/」）。
- 非公式の API や自動操作では投稿しない。

### Medium（URL を貼る）

ファイルはいらない。サイトに記事が出たら、オーナーが https://medium.com/p/import に記事の URL を貼る。下書きとして取り込まれ、サイトへの canonical が付くので、確かめてから公開する。PR 本文に、貼る URL を書いておく。

## 5. 確かめる

- 年、数、場所、営業時間、規則は出典で確かめる。変わりうる情報には、公式情報を確認するよう注記する。
- `/site-check` を実行する。

## 6. コミット

1記事1コミットにする。件名は英語の命令形にする（例 `Publish the Kamo river article`、`Add the 番台 article to the 京都の日常 list`）。SNS 用のファイルは別のコミットにする（例 `Add the Instagram caption and note text for the Kamo river article`）。
