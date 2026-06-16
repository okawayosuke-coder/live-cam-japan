# 無料で公開する（GitHub Pages ＋ ビルド時生成）

クライアントにAPIキーを置かず、**GitHub Actions がビルド時にカメラ一覧（静的JSON）を生成 → GitHub Pages で配信**します。
これにより **キー露出なし・訪問者ごとのAPIクォータ消費ゼロ**で、完全無料で公開できます。

## 仕組み
- 訪問者は `data/catalog.json`（ビルド時生成）を読むだけ。APIキー不要。
- ライブ映像（YouTube/Windy埋め込み）は訪問者のブラウザで再生。
- APIキーは **GitHub の Secret** にのみ保存（CIのビルド時だけ使用、クライアントに出ない）。
- カメラ一覧は **3時間ごと**に自動再生成（`/.github/workflows/deploy.yml` の cron）。

## 手順

### 1. リポジトリを作る
- GitHub で **新しいリポジトリ**を作成（**Public** 推奨：Actions/Pages が無料・無制限）。
- この `live-cam-japan/` フォルダの中身を、そのリポジトリの**ルート**として push する。
  - `config.local.js` は `.gitignore` 済み → **鍵はリポジトリに上がりません**（確認推奨）。

### 2. APIキーを Secret に登録
リポジトリ **Settings → Secrets and variables → Actions → New repository secret** で2つ登録:
| Name | 値 |
|---|---|
| `YOUTUBE_API_KEY` | あなたの YouTube Data API v3 キー |
| `WINDY_API_KEY` | あなたの Windy Webcams キー |

### 3. Pages を有効化
リポジトリ **Settings → Pages → Build and deployment → Source: `GitHub Actions`** を選択。

### 4. 公開（ビルド実行）
- **Actions** タブ → 「Build catalog & Deploy to Pages」→ **Run workflow**（手動実行）。
- もしくは main に push すると自動実行。
- 完了後の公開URL: `https://<ユーザー名>.github.io/<リポジトリ名>/`
- 以後 **3時間ごと**に自動更新。

## クォータ調整
- 既定: 検索8クエリ × 3時間ごと ≈ **1日5千ユニット**（YouTube無料枠1万/日内）。
- 更新を**速く**したい → `deploy.yml` の cron を短く＋`tools/build-catalog.mjs` の `SEARCH_QUERIES` を減らす。
- カメラを**増やしたい** → `SEARCH_QUERIES` / `PLAYLISTS` を追加（その分クォータ消費増）。
- Windy はプレイリスト/検索と別枠。無料枠の上限に注意（必要なら cron を延ばす）。

## セキュリティ / 法務
- **キーはCIのSecretのみ**＝公開サイトのHTML/JSには一切含まれません（クライアント露出なし）。
- そのためキーのリファラ/IP制限は必須ではありませんが、YouTubeキーは「YouTube Data API v3」限定のままを推奨。
- 帰属表示（Windy / YouTube / OpenStreetMap）は地図クレジットに表示済み。各カメラの利用規約は提供元に従ってください。

## ローカル開発との関係
- ローカル（`config.local.js` に鍵あり）では従来どおり**ライブAPI**で動作（`catalog.json` は使わない）。
- 公開サイト（鍵なし）では**自動的に `catalog.json`** を読む。コードは同じ、鍵の有無で切り替わります。
