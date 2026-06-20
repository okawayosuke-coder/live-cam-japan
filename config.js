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

// 既定の再生リスト（実在確認済み）。UU…はチャンネルの全アップロード再生リスト。
// 中身は実行時/ビルド時に取得し「現在ライブ中」のみ表示するので、ここに死んだ配信が
// 混ざっても表示には出ない。tools/build-catalog.mjs もこの配列をそのまま使う（単一ソース）。
//   先頭8件 = 既存（全国キュレーション/伊豆小笠原港湾/外房サーフ）。
//   以降107件 = 全国発掘（北海道→沖縄＋河川防災/空港港湾/観光温泉/動物園水族館/サーフ）。
export const DEFAULT_PLAYLISTS = [
  // --- 既存 ---
  "PLM7jIABwhUkb41KUDAke1x8I0FmTL5Z4s", // 日本全国のライブカメラ（キュレーション）
  "UUqdejTsUrCvZ55Y8u9v5h9w",           // 東京都 伊豆・小笠原諸島 港湾ライブカメラ
  "UUEDn0tLxpVqEvI3NJyE2DRA",           // 波のスケッチ（鴨川/外房）
  "UUY88ELMjnfMyOYMUw5K9o3g",           // 犬吠埼テラス（銚子）
  "UUorpI8lCIFIuNEZsYAn0Qcg",           // 一宮・釣ヶ崎（外房サーフ）
  "UUKP-Q8DRYQ7Pl6jRirZasBA",           // 太東/東浪見（外房サーフ）
  "UUWAo3gf7X9JvcKifG0s2vpQ",           // 勝浦・部原（外房サーフ）
  "UUV3arNLjYmBubfETmAAzS4w",           // なみある?（サーフ各地）
  // --- 北海道 ---
  "UUGrZAL2OKyKHj5flMIVU72A", // STV札幌テレビ（札幌・函館・旭川・知床ほか）
  "UUXIen52JAy3pttIX60JO0YA", // 函館駅前ライブ
  "UUwJceIUpEJAkS7mVUJoEmYg", // 函館山(FMいるか)夜景
  "UUrOAX9_xMtlHHR6GE8ob2zA", // 旭山動物園ライブ
  "UU-Gpej6F3EVsxsKplMeUmYg", // ニセコ(本田珈琲店)羊蹄山
  "UUJOKZ03IvVCbahaPloXPaww", // 旭川お天気カメラ
  "UULW7dg806PhOIh4oam4ZCRw", // 小樽港(LIVE the SCAPE)
  "UUIQ-kh5y9I3RyiUo6LtfyPw", // 旭川ネットテレビ
  "UUT-PZ211r3_9mFdF0zC1HHg", // 十勝毎日新聞（帯広・十勝川温泉）
  // --- 東北 ---
  "UUNt5Ctj5uR_A5jTn_yZ9mVQ", // 河北新報（仙台）
  "UUHYCNznUIRwu77QUuL7qZJQ", // ATV青森テレビ
  "UUk_jA9Y8pb50Ab2EzV_KhLw", // RAB青森放送
  "UU7UzAjbjzvekhio8uEJXCpw", // AKT秋田テレビ
  "UUMbq0m2vILQTbc0VhOcVWaQ", // IBC岩手放送（宮古港/釜石/久慈）
  "UUKYimk34K4xqApVYTKg6sow", // ミヤギテレビ（仙台駅西口）
  "UUsci9tL9g8QPOvUwjJeDAgA", // TUFテレビユー福島
  "UU8Y0ZErdlAnA9uW7ZeRdreQ", // 福島中央テレビ
  "UU32pF1BZLteNqIaXUVs7Slg", // KFB福島放送 情報カメラ
  "UUBaecD-r5iwKiqkMngdPN4w", // 加茂水族館（山形・クラゲ）
  // --- 関東 ---
  "UUCLnJzwda_Kcdkok3et7n0A", // 歌舞伎町ライブ
  "UUBFDJXGCOdMjVtg2AnReoXA", // 歌舞伎町ライブ2
  "UUGCZAYq5Xxojl_tSXcVJhiQ", // テレビ朝日（渋谷/お台場/羽田T2）
  "UUoQBJMzcwmXrRSHBFAlTsIw", // フジテレビ（お台場/レインボーブリッジ）
  "UU6AG81pAkf6Lbi_1VC5NmPA", // TBS NEWS DIG（横浜みなとみらい/新宿）
  "UUqaWGntsmpG4dzWd1sksLMQ", // tvk（横浜）
  "UU8W6RWFeN4cmx6C3tPNEdaQ", // TOKYO LIVE CAMERA（お台場/富士山/羽田）
  "UU5vHSXebBWenaGFCGuZ3ksA", // 勝どき4K(NexSpark)
  "UU3DrGPmCHsrionkmduqX0qg", // スカイツリー(Juyoh)
  "UUKyXyJMijwyBebgI9wmzFcw", // 東京タワー公式
  "UUg01zTx4TYBA_4ifxep0TFw", // 国交省関東地整 河川（利根川/荒川/多摩川）
  "UUExASDN78i5BDDgHWoy9QRQ", // 川越大正浪漫夢通り
  "UU8oWZuLFc_cBA0LmgWfA2Rw", // 杉並区 善福寺川 河川ライブ
  "UUnFS0WrXmUNelP9Ibs6umbw", // サンシャイン水族館（池袋）
  "UUp6QcfxkVaT77OVMXKKTJoQ", // 那須どうぶつ王国（栃木）
  "UUbn5eHDjwmPC2K9RG8P0i_A", // 草津温泉湯畑（群馬）
  // --- 中部・北陸 ---
  "UUcuadYD11H2Eti8AEOP7Buw", // FujigokoTV（富士五湖/御殿場/日本平）
  "UUVUyX8T-vYwJYraM6957r9Q", // 上高地(五千尺ホテル)
  "UUy9ww22FuUlXd0c6B8INJVQ", // 善光寺(INC長野CATV)
  "UUD1MsyeoR0St_aWxydu9law", // 富山テレビ(BBT)立山室堂/富山空港
  "UUt6LB-BvEmDm-oWbe_TO7mw", // 北陸朝日放送(HAB)金沢/能登/千里浜
  "UU4SO_m6DMmGEb9j42C4zgAQ", // 千里浜(HAB)なぎさドライブウェイ
  "UUkd3H8yZEXxZSGSOmxeHxrg", // FBC福井放送
  "UUFfurCxvxE0mFkFy1ZwSang", // 鯨波海岸（柏崎・日本海夕日）
  "UUnJUV9-pfhyWQdQbvTJ84QA", // 伊豆白浜(mariner1173)下田サーフ
  "UUViEINl4jn95elupZZPk__w", // 高岡ケーブル（雨晴海岸）
  // --- 近畿 ---
  "UUQ2mmGKtrBp6rL8tSMJCCwA", // 道頓堀(RVJ)戎橋/グリコ
  "UUFyohCp_Vx6WC82DiJ0l88w", // 京都市観光協会（嵐山/祇園/伏見稲荷）
  "UU1YsvhwhmQV5kfVMRpTVx-A", // 神戸ウォーターフロント（メリケンパーク）
  "UU0CTWpAAsLqr3-88sbEEjyg", // NaLIVE（奈良公園/若草山）
  "UUciZ_EHzb6frW2WfFGCOX5g", // びわ湖放送（大津/琵琶湖）
  "UU6lmF6p8HDwPkI5PG1YO0Ng", // 草津駅ライブ（滋賀）
  "UUQaIJF9pcbAvVszZHTI-Kqw", // 鳥羽マリンターミナル（三重）
  "UUDZ15oljFdnJJxcix-ZGEAw", // 志摩 国府白浜(machispo)サーフ
  "UUVEmpbL5VzfXsULPFeRsj4Q", // アドベンチャーワールド（和歌山・パンダ）
  // --- 中国 ---
  "UU9r31LvpWhWU0aJdAirOZDQ", // tysテレビ山口（下関/関門海峡）
  "UUlVbdSn_q2wy4t_aYkPMBTA", // 関門海峡(新興製作所)下関
  "UUfE5u1B3RuyBxgpuh8biMfA", // 長門湯本温泉（山口）
  "UUGxj5YPkSuG7UoRXzjZ6PJA", // 光市岩田（山口）
  "UUATnyu9lou_Lw43gvyoh8uA", // RCC NEWS DIG（広島駅/呉港）
  "UUg9YmSd9-AF2RRPNHsLjj2A", // 広島ホームテレビ（広島空港/厳島）
  "UU8RtSgWxyqdtPbGQfXk3mjw", // 尾道千光寺山ロープウェイ
  "UUxNJOB2V-5Jm6pMdl8UXnPg", // 倉敷KCT（鷲羽山/瀬戸大橋）
  "UULkGTD9DRsG-Y27qE9uehaQ", // 鳥取 伏野海岸(Atelier COCOON)
  "UUa6LoR3TlZ934EBz2osTfuw", // 松江道路カメラ（島根・マーブル）
  "UU0R2MtMpbFQX7ZoF-2OgmWA", // アクアス（島根浜田・シロイルカ）
  // --- 四国 ---
  "UUwFO9Ihbc2o76dYunXU7izw", // 土佐清水ジオパークTV（高知・竜串）
  "UU3kYL05u3OLTio9GD9syg1w", // 内妻ビーチ(ふくちゃん)徳島サーフ
  "UUsV_76RlGzFVZQABftUKdSw", // 四国地整 河川CCTV（吉野川/四万十川）
  "UUVbExwCBw3wr5vGGYe-cBPw", // 堀江マリンハウス（松山・瀬戸内）
  "UUOq4G6r489yBvnYh6F3_i-w", // CMSサンポート高松（香川）
  "UU1AgIHd5nsX5oYXZLdcYB8Q", // サンポート高松（CMS専用）
  // --- 九州・沖縄 ---
  "UUpWU25qIleNLmUEF9VwBdMA", // 桜島(財宝)複数アングル
  "UU7f4czw8TuG69HuVt_uXRtQ", // 桜島(MBC南日本放送)垂水/錦江湾
  "UUAhZnTMHk-TPyDzT0rt34IQ", // 桜島(KKB)情報カメラ
  "UUey3hahtkbKG9VrXTSotZoQ", // 阿蘇草千里（自然公園財団・4K）
  "UUx23yzeMtcUP7d3p_Aluj0g", // サガテレビ（佐賀空港/唐津湾）
  "UUyTXCFmTbFW_M3i_6xB7cRQ", // 稲佐山カメラ（長崎夜景）
  "UUWkqxFZQSdkR_q8kGz6p9mw", // NCC長崎文化放送（長崎港/長崎空港/佐世保）
  "UUekmK9BsmFY_PujFeV6ryqg", // OAB大分朝日放送（大分空港/別府）
  "UUz3HhdczanuyQ6y2uhX_ZQg", // 日南テレビ（油津/梅ヶ浜サーフ）
  "UUAu_SrUI1IBv8wFgYSi6kVg", // いい波(ii-nami)宮崎木崎浜/青島サーフ
  "UUDyC7xeQxsihyZj8SoICLEw", // 福岡空港ライブカメラ
  "UUXXEOK4erP8E3cbszN22bEQ", // FBS福岡放送（天神/福岡空港）
  "UUtByHAMKJuA_zjJ7m3nE1_w", // TVQ九州放送（博多港）
  "UUcvSlpVp6ME4dSgzZsHI00w", // ブセナテラス（名護・東シナ海）
  "UU_UB1JJTJPbN0QpaVkPkiwA", // 宮古テレビ（宮古島/来間大橋）
  "UUWFKZJdFJIIH1E9DGYBaY0A", // 八重山リアルタイム（石垣・名蔵湾）
  "UU2RZL3Ftu_lnV43zVrc3qOg", // 石垣島川平湾(CBD)昼夜
  "UUcctSG5Srwqupo150X07lxA", // 石垣島ライブ(ishigaki-ch)川平湾
  "UUQJE3qm7Sjc5-JXAYjAfkrw", // 石垣島ライブカメラ
  "UUl27leged0PT2kIrRtrFYKA", // RBC NEWS（琉球放送・那覇空港/石垣港）
  "UUjPVLguFrd6DTfHl2McrPjw", // OTV沖縄テレビNEWS（お天気カメラ）
  "UUXjkj8-HaOvX7o-fzhOu7Ng", // 海洋博公園・美ら海水族館（本部町）
  "UUjh7PkIBYtB0p5erDP4L6xg", // 那覇港(SALOTK2)
  // --- 河川・防災（官公庁） ---
  "UU_CPIys6tBqmwVXsH-X4ycg", // 国交省北海道開発局（石狩川/天塩川）
  "UUZP1ToNCzbV_RpPChepbbiw", // 国交省近畿地整（淀川/由良川）
  "UUxvRdp0VSZtx6NR4Le2TIFA", // 筑後川（九州地整）
  "UUb1iYF-zWqswtfNSIQKRt0Q", // 矢部川（九州地整・福岡）
  // --- 空港 ---
  "UUMKvT0YVLufHMdGLH89J1oA", // 朝日新聞（成田A滑走路）
  "UUWt0yfrBaUk148rxaOp4b4w", // 日テレNEWS（羽田T1/T3/那覇）
  "UUeCmAYh1ylwIsgGrmqaklzg", // TBS NEWS DIG（羽田T1）
  "UUxiRdfyH0FtFCRZTRfRsdsA", // 中京テレビ（セントレア/伊勢湾）
  "UUH1R8j9ReS3GSV3wi58Xu1A", // Love Flight Jack（成田さくらの山）
  "UU_lRCs4pOVJl2Sv_Y4_Qsaw", // Live Jet（羽田4本滑走路）
  // --- 観光・水族館・その他 ---
  "UUfoiWJgMmg4p9olz1WE0-9A", // 江の島(HviewCam)片瀬海岸
  "UUQcj-JgG6XA0hGcTYWnK3ig", // 鳥羽水族館（ラッコ）
  "UURb3-Nt6Z6JQmJHMyMgsLkA", // 天王寺動物園（大阪）
];

// 既定の設定（localStorageに無ければこれを使う）
const DEFAULTS = {
  // --- YouTube ---
  youtubeApiKey: "",
  // 既定ソース: 実在確認済みの再生リスト（DEFAULT_PLAYLISTS）。現在ライブ中のみ表示。
  youtubePlaylists: DEFAULT_PLAYLISTS,
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
