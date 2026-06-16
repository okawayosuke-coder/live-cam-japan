// ============================================================================
// config.js  ―  全国ライブカメラビューア 設定
// ----------------------------------------------------------------------------
// ・APIキー等のユーザー設定は localStorage に保存（サーバー不要）
// ・捏造防止: ここに置く外部IDは「実在を確認した公開リソース」のみ。
//   実際に表示されるカメラは全てランタイムで生存確認してから出す。
// ============================================================================

// 日本の8地方。bbox は [south, west, north, east]（Leaflet順）。
// Windy API へは N,E,S,W の順で渡す（version-transfer ドキュメント準拠）。
export const REGIONS = [
  { id: "hokkaido", name: "北海道",   s: 41.3, w: 139.3, n: 45.7, e: 146.1, center: [43.4, 142.8] },
  { id: "tohoku",   name: "東北",     s: 36.9, w: 139.0, n: 41.6, e: 142.2, center: [39.3, 140.6] },
  { id: "kanto",    name: "関東",     s: 34.9, w: 138.3, n: 37.2, e: 140.9, center: [35.9, 139.6] },
  { id: "chubu",    name: "中部",     s: 34.5, w: 136.0, n: 37.7, e: 139.2, center: [36.2, 137.6] },
  { id: "kinki",    name: "近畿",     s: 33.4, w: 134.5, n: 35.8, e: 136.6, center: [34.6, 135.6] },
  { id: "chugoku",  name: "中国",     s: 33.7, w: 130.9, n: 35.7, e: 134.6, center: [34.7, 132.8] },
  { id: "shikoku",  name: "四国",     s: 32.7, w: 132.0, n: 34.6, e: 134.9, center: [33.7, 133.5] },
  { id: "kyushu",   name: "九州・沖縄", s: 24.0, w: 122.9, n: 34.7, e: 132.1, center: [31.5, 130.5] },
  // 伊豆諸島〜小笠原（大島・新島・三宅島・八丈島・小笠原）。本州bboxの南の隙間を埋める。
  { id: "izu",      name: "伊豆・小笠原諸島", s: 26.5, w: 138.8, n: 35.0, e: 142.8, center: [34.4, 139.3] },
];

// カテゴリの正規化（Windy categoryや手動分類をこの粒度に寄せる）
export const CATEGORIES = [
  { id: "scenery",  name: "景観・観光" },
  { id: "mountain", name: "山・自然" },
  { id: "coast",    name: "海・港" },
  { id: "river",    name: "河川・防災" },
  { id: "road",     name: "道路・交通" },
  { id: "city",     name: "街・繁華街" },
  { id: "weather",  name: "天気・空" },
  { id: "other",    name: "その他" },
];

// 既定の設定（localStorageに無ければこれを使う）
const DEFAULTS = {
  // --- YouTube ---
  youtubeApiKey: "",
  // 既定ソース: 実在確認済みの再生リスト。中身は実行時に取得し現在ライブ中のみ表示。
  // ・PLM7...: 「日本全国のライブカメラ」キュレーション
  // ・UUqdej...: 東京都港湾局 公式「伊豆・小笠原諸島港湾ライブカメラ」のアップロード
  //   （元町港/岡田港/波浮港=大島ほか 全11島17港。UUはチャンネルの全アップロード再生リスト）
  youtubePlaylists: ["PLM7jIABwhUkb41KUDAke1x8I0FmTL5Z4s", "UUqdejTsUrCvZ55Y8u9v5h9w"],
  // 追加のキーワード検索（クォータ消費が大きい[100/回]ので既定OFF）。
  // ONにすると現在ライブ中のカメラを広く探索して件数が増える。重複は自動排除。
  youtubeSearchEnabled: false,
  youtubeSearchQueries: [
    "ライブカメラ", "富士山 ライブ", "海 ライブカメラ", "港 ライブカメラ", "空港 ライブカメラ",
    "駅 ライブカメラ", "川 ライブカメラ", "天気 ライブカメラ", "街 ライブ配信",
    "北海道 ライブカメラ", "東北 ライブカメラ", "東京 ライブカメラ", "横浜 ライブカメラ",
    "名古屋 ライブカメラ", "大阪 ライブカメラ", "京都 ライブカメラ", "神戸 ライブカメラ",
    "広島 ライブカメラ", "福岡 ライブカメラ", "沖縄 ライブカメラ", "live camera japan",
    // 自治体・防災系（公式機関のYouTube配信を拾う）
    "国土交通省 ライブカメラ", "河川 ライブカメラ 配信", "防災 ライブカメラ",
    "ダム ライブカメラ", "道路 ライブカメラ", "市役所 ライブカメラ",
    // 離島・自然・観光系
    "伊豆大島 ライブカメラ", "大島 ライブカメラ", "離島 ライブカメラ", "灯台 ライブカメラ", "滝 ライブカメラ",
    "スキー場 ライブカメラ", "動物園 ライブカメラ", "水族館 ライブカメラ", "商店街 ライブカメラ",
    // 東京都公式「伊豆・小笠原諸島港湾ライブカメラ」（元町港/岡田港/波浮港=大島 等の島嶼港を網羅）
    "伊豆 小笠原 港湾 ライブカメラ",
  ],

  // --- Windy Webcams ---
  windyApiKey: "",
  // ブラウザからの直接fetchはCORSで弾かれる場合があるため、
  // tools/fetch-windy.mjs で生成した data/windy.json をフォールバックに使う。
  windyClientFetch: true,
  // true: ライブ配信(player.live)を持つWindyカメラのみ表示。
  // false: スナップショット/タイムラプス型も含めて全部表示（=件数最大）。
  windyLiveOnly: false,

  // --- 表示 ---
  onlyWorking: true,          // 稼働中のみ表示（既定ON）
  enabledSources: { youtube: true, windy: true, direct: true },
  probeTimeoutMs: 9000,       // 直リンク画像プローブのタイムアウト
  autoRefreshMin: 0,          // 0=自動更新なし。>0で分間隔再チェック
};

const LS_KEY = "lcj.settings.v1";

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch (_) { saved = {}; }
  // config.local.js（gitignore済み）に書いた設定を「常に有効」にする（最優先）。
  // 優先順位: DEFAULTS < localStorage(画面保存) < config.local.js
  // → ファイルに書いた値は、過去の画面保存に邪魔されず確実に効く。
  const local = (typeof window !== "undefined" && window.LCJ_LOCAL) || {};
  const merged = {
    ...DEFAULTS,
    ...saved,
    ...local,
    enabledSources: { ...DEFAULTS.enabledSources, ...(saved.enabledSources || {}), ...(local.enabledSources || {}) },
    // 既定の厳選プレイリスト（島チャンネル等）は常に含める＋保存/ローカルの追加分を和集合
    youtubePlaylists: [...new Set([
      ...DEFAULTS.youtubePlaylists,
      ...(saved.youtubePlaylists || []),
      ...(local.youtubePlaylists || []),
    ])],
    // 検索クエリは画面編集不可。古い保存値で上書きされないよう常に file/DEFAULTS を使う。
    youtubeSearchQueries: local.youtubeSearchQueries || DEFAULTS.youtubeSearchQueries,
  };
  // 鍵は空文字を避けて file→保存→既定の順でフォールバック。
  merged.youtubeApiKey = (local.youtubeApiKey || saved.youtubeApiKey || DEFAULTS.youtubeApiKey || "").trim();
  merged.windyApiKey = (local.windyApiKey || saved.windyApiKey || DEFAULTS.windyApiKey || "").trim();
  return merged;
}

export function saveSettings(patch) {
  // 「画面で実際に変更した項目だけ」を保存する。
  // loadSettings()全体を保存すると、古いDEFAULTSのスナップショットが固定化されて
  // 後からの既定値更新を上書きしてしまうため、生のlocalStorageにpatchだけ重ねる。
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (_) { saved = {}; }
  const next = { ...saved, ...patch };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return loadSettings();
}

// lat/lng がどの地方に属するか（最初に含んだ地方）
export function regionOf(lat, lng) {
  if (lat == null || lng == null) return null;
  for (const r of REGIONS) {
    if (lat >= r.s && lat <= r.n && lng >= r.w && lng <= r.e) return r.id;
  }
  return null;
}
