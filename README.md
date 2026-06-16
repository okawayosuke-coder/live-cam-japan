# 全国 動作中ライブカメラ（Live Cam Japan）

全国の **「今まさに動作している」ライブカメラだけ** を集めて地図＋一覧で表示する、**サーバー不要の静的サイト**です。
リンク切れだらけのライブカメラまとめサイトへの不満を解消するのが目的で、**表示前に1台ずつ生存確認**し、動いているものだけを出します。

## 特徴

- **複数ソース統合**：YouTube Live ＋ Windy Webcams ＋ 自治体/直リンクカメラ
- **「動作している」をブラウザ側で判定**（バックエンド不要）
  | ソース | 取得方法 | 稼働判定 | 必要なもの |
  |---|---|---|---|
  | YouTube Live | Data API でプレイリスト/検索 | `liveStreamingDetails` で **現在ライブ中だけ**採用（確定） | 無料APIキー |
  | Windy Webcams | ビルド時に全国カタログ生成＋playerをiframe埋め込み | `status=active` ＋ 更新時刻（報告ベース） | 無料APIキー |
  | 直リンク/自治体 | `data/cameras.json` | `<img>` の読込成否で死活確認（確定） | 不要 |
- **地図（Leaflet）＋カードグリッド**、地方/カテゴリ/ソース/キーワードで絞り込み
- **APIキーはブラウザのlocalStorageにのみ保存**。外部送信なし
- ビルド手順ゼロ（バンドラ不要）。任意の静的ホスティングに置くだけ

## ファイル構成

```
live-cam-japan/
├ index.html          画面
├ styles.css          スタイル
├ config.js           設定（地方bbox・既定プレイリスト・localStorage）
├ sources.js          各ソースの取得＋生存プローブ
├ app.js              統合・描画・地図・ライブ判定
├ data/
│  ├ cameras.json     直リンク/自治体カタログ（自分で追記）
│  └ windy.json       fetch-windy.mjs が生成（初期は空）
└ tools/
   └ fetch-windy.mjs  Windy全国カタログ生成（Node）
```

## ローカルで動かす

ES Modules を使うため `file://` では動きません。静的サーバー経由で開いてください。

```bash
cd live-cam-japan
python3 -m http.server 8000
# → http://localhost:8000
```

## APIキーの取得（どちらも無料）

### YouTube Data API v3
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. 「YouTube Data API v3」を有効化
3. 「認証情報」→ APIキーを作成
4. （推奨）キーに **HTTPリファラ制限** を設定（例：`localhost/*`, `https://あなたのドメイン/*`）し、利用APIを YouTube Data API v3 に限定
5. サイトの「⚙ 設定」にキーを貼り付けて保存

> 既定では実在確認済みの「日本全国のライブカメラ」プレイリストを参照します。設定でプレイリストIDを自由に変更・追加できます（カンマ区切り）。
> 無料枠は1日10,000ユニット。プレイリスト取得は1ユニット/回・動画詳細も1ユニット/50件と軽量です（キーワード検索は100ユニット/回なので既定オフ）。

### Windy Webcams API
1. [api.windy.com/keys](https://api.windy.com/keys) で無料キーを取得
2. サイトの「⚙ 設定」にキーを貼り付け

**Windyはブラウザからの直fetchがCORSで弾かれる場合があります。** その場合は以下でカタログを生成してください（生成後はキー無しでも表示できます）。

```bash
export WINDY_API_KEY=あなたのキー
node tools/fetch-windy.mjs      # → data/windy.json を生成（Node 18+）
```

## 自治体/直リンクカメラを追加する

`data/cameras.json` の `cameras` 配列に追記します（`_schema` と `_example_entry` を参照）。
**捏造データは入れない方針**です。`sourceUrl`（出典）と利用許諾を確認したカメラのみ追加してください。
`embedType: "image"` の画像は、表示前にブラウザが読み込みテストし、**死んでいれば自動的に隠れます**。

```json
{
  "cameras": [
    {
      "title": "○○海岸",
      "place": "○○県○○市",
      "category": "coast",
      "lat": 34.5, "lng": 135.0,
      "embedType": "image",
      "imageUrl": "https://example.org/cam/latest.jpg",
      "detailUrl": "https://example.org/",
      "credit": "提供元名"
    }
  ]
}
```

## 公開（ホスティング）

静的ファイルなので、GitHub Pages / Netlify / Cloudflare Pages / S3 などにそのまま置けます。
公開ドメインを YouTube APIキーのリファラ制限に追加してください。

## 仕組み・判定の正確さについて

- **YouTube**：APIが返す `liveBroadcastContent === "live"` のものだけを「稼働中（確定）」として表示します。配信終了したものは自動的に消えます。
- **Windy**：APIの `status` と最終更新時刻に基づく「稼働報告」です。playerは実際にブラウザで再生されるため視覚的にも確認できますが、判定自体はWindy側の申告ベースです（バッジは「稼働(報告)」）。
- **直リンク画像**：実際に画像を読み込めたかで判定する確定ベースです。ただし「画像が更新され続けているか（フリーズしていないか）」までは保証しません。

## 注意

- 各カメラの著作権・利用規約は提供元に従います。埋め込み/転載の可否は各ソースの規約をご確認ください。
- APIキーは個人のものを使用し、リファラ制限の設定を推奨します。
- 地図タイルは OpenStreetMap、地図ライブラリは Leaflet を使用しています。
