// ============================================================================
// sources.js  ―  各ソースの取得アダプタ & 生存（稼働）プローブ
// ----------------------------------------------------------------------------
// 統一カメラオブジェクト:
// {
//   id, source: 'youtube'|'windy'|'direct',
//   title, place, region(id|null), category(id),
//   lat, lng,                       // 無ければ null（地図には出ない）
//   embedType: 'iframe'|'image',
//   embedUrl,                       // モーダルで埋め込むURL
//   imageUrl,                       // 直リンク画像（imageタイプ）
//   thumbUrl,                       // 一覧サムネ（無ければ null）
//   detailUrl,                      // 外部で開くURL
//   status: 'live'|'reported'|'unverified'|'checking'|'offline',
//   note,                           // 稼働状況の補足テキスト
//   lastChecked                     // Date | null
// }
// ============================================================================

import { regionOf } from "./config.js?v=6";

// ---- ユーティリティ -------------------------------------------------------

// タイトルから地方/カテゴリを推定（YouTubeなど座標が無いソース向け）
const REGION_HINTS = [
  ["hokkaido", ["北海道", "札幌", "函館", "旭川", "釧路", "知床", "小樽", "帯広", "十勝", "ニセコ", "hokkaido", "sapporo"]],
  ["tohoku",   ["東北", "青森", "秋田", "岩手", "山形", "宮城", "仙台", "福島", "弘前", "八戸", "郡山", "いわき", "鶴岡", "tohoku", "sendai"]],
  ["kanto",    ["東京", "渋谷", "新宿", "横浜", "千葉", "埼玉", "茨城", "栃木", "群馬", "神奈川", "川越", "那須", "tokyo", "shibuya", "yokohama"]],
  ["chubu",    ["富士", "山梨", "長野", "新潟", "名古屋", "愛知", "静岡", "岐阜", "金沢", "石川", "富山", "福井", "上高地", "能登", "柏崎", "fuji", "nagoya"]],
  ["kinki",    ["大阪", "京都", "神戸", "兵庫", "奈良", "和歌山", "滋賀", "三重", "道頓堀", "琵琶湖", "鳥羽", "志摩", "osaka", "kyoto", "kobe"]],
  ["chugoku",  ["広島", "岡山", "山口", "鳥取", "島根", "下関", "関門", "尾道", "倉敷", "松江", "浜田", "hiroshima", "okayama"]],
  ["shikoku",  ["高知", "徳島", "愛媛", "香川", "松山", "土佐清水", "海陽", "高松", "kochi", "shikoku"]],
  ["kyushu",   ["福岡", "博多", "熊本", "長崎", "鹿児島", "宮崎", "大分", "佐賀", "沖縄", "那覇", "石垣", "桜島", "阿蘇", "名護", "八重山", "宮古", "fukuoka", "okinawa", "naha"]],
];

const CATEGORY_HINTS = [
  ["mountain", ["山", "岳", "高原", "森", "湖", "滝", "fuji", "mountain", "mt."]],
  ["coast",    ["海", "港", "ビーチ", "浜", "湾", "島", "漁港", "beach", "port", "bay", "ocean", "coast"]],
  ["river",    ["川", "河川", "ダム", "防災", "水位", "river", "dam"]],
  ["road",     ["道路", "国道", "交通", "峠", "高速", "road", "traffic"]],
  ["city",     ["渋谷", "新宿", "繁華街", "駅前", "スクランブル", "街", "crossing", "city", "street"]],
  ["weather",  ["空", "天気", "雲", "夕日", "朝日", "星", "sky", "weather", "sunset"]],
  ["scenery",  ["観光", "絶景", "景観", "temple", "shrine", "寺", "神社", "城", "scenic"]],
];

function guessRegion(text = "") {
  const t = text.toLowerCase();
  for (const [id, words] of REGION_HINTS) {
    if (words.some((w) => t.includes(w.toLowerCase()))) return id;
  }
  return null;
}
function guessCategory(text = "") {
  const t = text.toLowerCase();
  for (const [id, words] of CATEGORY_HINTS) {
    if (words.some((w) => t.includes(w.toLowerCase()))) return id;
  }
  return "scenery";
}

// 地名→おおよその座標（YouTube等の座標なしソースを地図に出すための簡易ジオコーダ）。
// あくまで名称からの推定なので approx:true を付け、UIで点線リング表示にして区別する。
const GAZETTEER = [
  // 同名衝突回避（最優先。広域の同名に吸われないよう先頭で判定）
  ["草津駅", 35.013, 135.960],   // 滋賀。群馬の「草津温泉」より先に判定
  ["伊豆白浜", 34.667, 138.953], // 静岡下田。本州"伊豆"中心より具体
  // 空港（「成田」等の市名より先に判定。空港は市街地と離れているため）
  ["成田空港", 35.765, 140.386], ["羽田空港", 35.549, 139.780], ["羽田", 35.549, 139.780],
  ["中部空港", 34.858, 136.805], ["セントレア", 34.858, 136.805], ["関西空港", 34.434, 135.244], ["関空", 34.434, 135.244],
  ["新千歳空港", 42.775, 141.692], ["福岡空港", 33.585, 130.451], ["那覇空港", 26.196, 127.646], ["伊丹空港", 34.785, 135.438],
  ["宇部空港", 33.930, 131.279], ["福島空港", 37.227, 140.431],
  // 伊豆・小笠原諸島（最優先。チャンネル名に「伊豆」が含まれ本土"伊豆"に誤マッチするのを防ぐ）
  ["元町港", 34.750, 139.360], ["岡田港", 34.794, 139.391], ["波浮港", 34.692, 139.428],
  ["伊豆大島", 34.75, 139.39], ["三原山", 34.724, 139.394],
  ["利島", 34.526, 139.282], ["新島", 34.370, 139.270], ["式根島", 34.323, 139.214],
  ["神津島", 34.205, 139.137], ["三宅島", 34.075, 139.510], ["御蔵島", 33.896, 139.600],
  ["八丈島", 33.113, 139.789], ["青ヶ島", 32.457, 139.767],
  ["父島", 27.094, 142.191], ["母島", 26.633, 142.160], ["小笠原", 27.094, 142.191],
  // 千葉・房総（外房=太平洋側。"千葉"より先に判定し千葉市への誤配置を防ぐ）
  ["勝浦", 35.143, 140.320], ["鴨川", 35.113, 140.099], ["一宮", 35.371, 140.382], ["釣ヶ崎", 35.371, 140.382],
  ["御宿", 35.190, 140.350], ["いすみ", 35.254, 140.385], ["大原", 35.252, 140.390], ["九十九里", 35.546, 140.430],
  ["銚子", 35.735, 140.827], ["茂原", 35.428, 140.288], ["館山", 34.997, 139.870], ["南房総", 34.99, 139.84],
  ["富津", 35.305, 139.857], ["木更津", 35.376, 139.917], ["船橋", 35.695, 139.985], ["成田", 35.776, 140.318],
  // 北海道
  ["札幌", 43.062, 141.354], ["函館", 41.768, 140.729], ["旭川市", 43.77, 142.36],
  ["釧路", 42.98, 144.38], ["知床", 44.07, 145.12], ["小樽", 43.19, 140.99], ["富良野", 43.34, 142.38],
  // 東北
  ["青森", 40.824, 140.74], ["秋田", 39.72, 140.10], ["盛岡", 39.70, 141.15], ["仙台", 38.268, 140.872],
  ["山形", 38.24, 140.36], ["福島", 37.75, 140.47], ["蔵王", 38.14, 140.44],
  // 関東
  ["渋谷", 35.659, 139.700], ["新宿", 35.690, 139.700], ["スカイツリー", 35.710, 139.810],
  ["東京タワー", 35.659, 139.745], ["お台場", 35.627, 139.776], ["浅草", 35.711, 139.797],
  ["東京", 35.681, 139.767], ["横浜", 35.454, 139.638], ["みなとみらい", 35.456, 139.632],
  ["鎌倉", 35.319, 139.546], ["江ノ島", 35.299, 139.480], ["江の島", 35.299, 139.480],
  ["日光", 36.720, 139.698], ["千葉", 35.607, 140.106], ["箱根", 35.232, 139.107],
  // 中部
  ["富士山", 35.45, 138.77], ["富士", 35.45, 138.77], ["河口湖", 35.517, 138.764],
  ["山中湖", 35.418, 138.868], ["上高地", 36.25, 137.63], ["軽井沢", 36.348, 138.597],
  ["草津", 36.62, 138.59], ["名古屋", 35.170, 136.882], ["金沢", 36.561, 136.656],
  ["新潟", 37.916, 139.036], ["長野", 36.651, 138.181], ["静岡", 34.976, 138.383],
  ["熱海", 35.096, 139.071], ["伊豆", 34.97, 138.95], ["富山", 36.695, 137.211], ["福井", 36.065, 136.221],
  // 近畿
  ["大阪", 34.694, 135.502], ["京都", 35.011, 135.768], ["神戸", 34.690, 135.196],
  ["奈良", 34.685, 135.805], ["姫路", 34.826, 134.690], ["和歌山", 34.226, 135.167],
  // 中国
  ["広島", 34.385, 132.455], ["岡山", 34.656, 133.919], ["山口", 34.186, 131.471],
  ["鳥取", 35.501, 134.238], ["島根", 35.472, 133.050], ["出雲", 35.367, 132.755],
  // 四国
  ["高知", 33.559, 133.531], ["松山", 33.839, 132.765], ["徳島", 34.066, 134.559], ["高松", 34.342, 134.047],
  // 九州・沖縄
  ["福岡", 33.590, 130.401], ["博多", 33.590, 130.420], ["熊本", 32.803, 130.708],
  ["阿蘇", 32.884, 131.104], ["長崎", 32.750, 129.877], ["鹿児島", 31.560, 130.558],
  ["宮崎", 31.911, 131.424], ["大分", 33.238, 131.613], ["別府", 33.279, 131.500],
  ["佐賀", 33.249, 130.299], ["那覇", 26.212, 127.681], ["沖縄", 26.34, 127.80],
  ["石垣", 24.34, 124.16], ["宮古島", 24.805, 125.281],
  // ===== 全国発掘チャンネル向け 追加地名（北海道→沖縄） =====
  // 北海道・東北
  ["ニセコ", 42.805, 140.687], ["羊蹄山", 42.828, 140.811], ["帯広", 42.924, 143.196], ["十勝川温泉", 42.926, 143.310], ["旭川", 43.768, 142.365],
  ["弘前", 40.603, 140.464], ["八戸", 40.512, 141.488], ["むつ", 41.293, 141.183], ["深浦", 40.646, 139.926],
  ["宮古港", 39.641, 141.957], ["釜石", 39.276, 141.886], ["久慈", 40.190, 141.775],
  ["郡山", 37.400, 140.359], ["会津", 37.495, 139.930], ["いわき", 37.050, 140.890], ["小名浜", 36.939, 140.904], ["相馬", 37.797, 140.919],
  ["鶴岡", 38.727, 139.827], ["加茂水族館", 38.711, 139.760],
  // 関東
  ["歌舞伎町", 35.695, 139.702], ["川越", 35.925, 139.485], ["那須どうぶつ王国", 37.123, 140.053], ["那須", 37.000, 140.050],
  ["勝どき", 35.658, 139.778], ["サンシャイン", 35.729, 139.719], ["善福寺川", 35.699, 139.620],
  // 中部・北陸
  ["御殿場", 35.308, 138.934], ["日本平", 34.974, 138.448], ["富士五湖", 35.500, 138.760],
  ["善光寺", 36.661, 138.187], ["松本", 36.238, 137.972],
  ["立山", 36.576, 137.594], ["室堂", 36.576, 137.594], ["富山空港", 36.648, 137.188],
  ["能登", 37.300, 137.160], ["輪島", 37.391, 136.899], ["珠洲", 37.436, 137.261], ["千里浜", 36.893, 136.778],
  ["柏崎", 37.366, 138.559], ["鯨波", 37.348, 138.519], ["下田", 34.679, 138.945], ["雨晴", 36.792, 137.045], ["高岡", 36.754, 137.026],
  // 近畿
  ["道頓堀", 34.668, 135.501], ["嵐山", 35.009, 135.677], ["祇園", 35.003, 135.775], ["伏見稲荷", 34.967, 135.772],
  ["メリケンパーク", 34.682, 135.187], ["奈良公園", 34.685, 135.843], ["若草山", 34.683, 135.848],
  ["琵琶湖", 35.250, 136.050], ["大津市", 35.004, 135.868],
  ["鳥羽", 34.481, 136.843], ["志摩", 34.331, 136.835], ["国府白浜", 34.318, 136.834],
  ["アドベンチャーワールド", 33.685, 135.343], ["南紀白浜", 33.685, 135.343],
  // 中国
  ["関門海峡", 33.957, 130.942], ["関門橋", 33.957, 130.953], ["下関", 33.957, 130.941],
  ["呉港", 34.232, 132.565], ["宮島", 34.296, 132.320], ["厳島", 34.296, 132.320], ["広島空港", 34.436, 132.919],
  ["尾道", 34.409, 133.205], ["倉敷", 34.585, 133.772], ["鷲羽山", 34.378, 133.815],
  ["松江", 35.468, 133.048], ["浜田", 34.900, 132.074], ["アクアス", 34.901, 132.181],
  ["長門湯本", 34.371, 131.184], ["光市岩田", 33.943, 132.020],
  // 四国
  ["土佐清水", 32.781, 132.954], ["竜串", 32.785, 132.943], ["海陽町", 33.616, 134.355], ["内妻", 33.616, 134.355],
  ["堀江", 33.892, 132.731], ["サンポート", 34.355, 134.052], ["高松港", 34.355, 134.052],
  // 九州・沖縄
  ["桜島", 31.593, 130.657], ["錦江湾", 31.560, 130.620], ["草千里", 32.881, 131.078],
  ["唐津", 33.450, 129.969], ["佐賀空港", 33.150, 130.302],
  ["稲佐山", 32.748, 129.853], ["佐世保", 33.180, 129.715], ["長崎空港", 32.916, 129.914], ["大分空港", 33.479, 131.737],
  ["日南", 31.601, 131.379], ["油津", 31.582, 131.404], ["青島", 31.806, 131.471], ["木崎浜", 31.832, 131.453],
  ["博多港", 33.612, 130.404], ["名護", 26.591, 127.977], ["ブセナ", 26.546, 127.968],
  ["川平湾", 24.453, 124.154], ["名蔵湾", 24.400, 124.130], ["八重山", 24.340, 124.155], ["本部町", 26.694, 127.878], ["美ら海", 26.694, 127.878],
  // 河川（広域アンカー。具体地名が無い河川CCTV向け）
  ["筑後川", 33.300, 130.500], ["矢部川", 33.180, 130.450], ["淀川", 34.717, 135.512], ["由良川", 35.350, 135.200],
  ["石狩川", 43.300, 141.700], ["天塩川", 44.500, 141.900],
];
// 具体地名が無い時のフォールバック（地方の中心）
const REGION_CENTER = {
  hokkaido: [43.4, 142.8], tohoku: [39.3, 140.6], kanto: [35.9, 139.6], chubu: [36.2, 137.6],
  kinki: [34.6, 135.6], chugoku: [34.7, 132.8], shikoku: [33.7, 133.5], kyushu: [31.5, 130.5],
};

function geocodeTitle(text = "", regionId = null) {
  for (const [name, lat, lng] of GAZETTEER) {
    if (text.includes(name)) return { lat, lng, approx: true };
  }
  if (regionId && REGION_CENTER[regionId]) {
    const [lat, lng] = REGION_CENTER[regionId];
    return { lat, lng, approx: true };
  }
  return null;
}

// ---- 生存プローブ（直リンク画像） -----------------------------------------
// CORSの影響を受けない <img> 読み込みで死活確認。読めれば稼働、エラー/timeoutで停止。
export function probeImage(url, timeoutMs = 9000) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      img.onload = img.onerror = null;
      img.src = "";
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => { clearTimeout(timer); finish(img.naturalWidth > 1); };
    img.onerror = () => { clearTimeout(timer); finish(false); };
    // キャッシュ回避（“今”動いているかを見る）
    const bust = (url.includes("?") ? "&" : "?") + "_lcj=" + Date.now();
    img.src = url + bust;
  });
}

// ============================================================================
// YouTube Live
// ============================================================================
const YT = "https://www.googleapis.com/youtube/v3";

async function ytJson(path, params, key) {
  const usp = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YT}/${path}?${usp.toString()}`);
  if (!res.ok) {
    let reason = `${res.status}`;
    try {
      const j = await res.json();
      reason = j?.error?.errors?.[0]?.reason || j?.error?.message || reason;
    } catch (_) {}
    const err = new Error(`YouTube API ${path}: ${reason}`);
    err.reason = reason;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// プレイリスト→動画ID（最大2ページ=100件）
async function ytPlaylistVideoIds(playlistId, key) {
  const ids = [];
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const data = await ytJson("playlistItems", {
      part: "contentDetails",
      maxResults: "50",
      playlistId,
      ...(pageToken ? { pageToken } : {}),
    }, key);
    for (const it of data.items || []) {
      const vid = it?.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  return ids;
}

// キーワード検索でライブ配信を探す（eventType=live, 100ユニット/回）
async function ytSearchLiveIds(query, key) {
  const data = await ytJson("search", {
    part: "snippet",
    type: "video",
    eventType: "live",
    regionCode: "JP",
    relevanceLanguage: "ja",
    maxResults: "50",
    q: query,
  }, key);
  return (data.items || []).map((it) => it?.id?.videoId).filter(Boolean);
}

// 動画IDの詳細を取得し、“現在ライブ中”だけ採用
async function ytVideosLive(ids, key) {
  const cams = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await ytJson("videos", {
      part: "snippet,status,liveStreamingDetails",
      id: batch.join(","),
    }, key);
    for (const v of data.items || []) {
      const live = v?.snippet?.liveBroadcastContent === "live";
      if (!live) continue; // “動作している(=今ライブ中)”のみ
      const sn = v.snippet;
      const title = sn.title || "(無題)";
      // 地名推定は title＋channelTitle のみ（descriptionは他カメラ一覧を列挙しがちで誤マッチの元）
      const text = `${title} ${sn.channelTitle || ""}`;
      const viewers = v?.liveStreamingDetails?.concurrentViewers;
      const thumb =
        sn.thumbnails?.medium?.url || sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null;
      const guessed = guessRegion(text);
      const geo = geocodeTitle(text, guessed); // 座標なしソースを地図に出すための推定位置
      // 地域は座標から決める（ピン位置と地域フィルタを一致させる。例: 大島→izu）
      const region = geo ? (regionOf(geo.lat, geo.lng) || guessed) : guessed;
      cams.push({
        id: `yt:${v.id}`,
        source: "youtube",
        title,
        place: sn.channelTitle || "",
        region,
        category: guessCategory(text),
        lat: geo?.lat ?? null, lng: geo?.lng ?? null,
        approxLocation: !!geo,
        embedType: "iframe",
        // status.embeddable が false の配信は所有者が埋め込み禁止 → サイト内再生不可（YouTube誘導）
        embeddable: v?.status?.embeddable !== false,
        // origin を付けると埋め込み設定エラー(153等)の一部が解消する。
        embedUrl: `https://www.youtube.com/embed/${v.id}?autoplay=1&mute=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`,
        imageUrl: null,
        thumbUrl: thumb,
        detailUrl: `https://www.youtube.com/watch?v=${v.id}`,
        status: "live",
        note: viewers ? `ライブ中・視聴 ${Number(viewers).toLocaleString()}人` : "ライブ配信中",
        lastChecked: new Date(),
      });
    }
  }
  return cams;
}

// キー不正/リファラ制限など「修復が必要な」403か（クォータ超過は除く）
function isKeyError(e) {
  return e.status === 403 && e.reason && e.reason !== "quotaExceeded" && e.reason !== "rateLimitExceeded";
}

export async function fetchYouTube(settings, onError) {
  const key = (settings.youtubeApiKey || "").trim();
  if (!key) { onError?.("youtube", "APIキー未設定（設定から追加すると全国のYouTubeライブカメラを表示）"); return []; }

  const idSet = new Set();
  let quotaHit = false;

  // プレイリスト（1ユニット/回と安価）
  for (const pid of settings.youtubePlaylists || []) {
    try {
      (await ytPlaylistVideoIds(pid, key)).forEach((id) => idSet.add(id));
    } catch (e) {
      if (isKeyError(e)) { onError?.("youtube", `APIキー/参照元制限エラー（${e.reason}）`); return []; }
      if (e.reason === "quotaExceeded") quotaHit = true;
      console.warn("playlist失敗", pid, e.message);
    }
  }

  // キーワード検索（100ユニット/回）。失敗しても収集済みIDは捨てない。
  if (settings.youtubeSearchEnabled && !quotaHit) {
    for (const q of settings.youtubeSearchQueries || []) {
      try { (await ytSearchLiveIds(q, key)).forEach((id) => idSet.add(id)); }
      catch (e) {
        if (isKeyError(e)) { onError?.("youtube", `APIキー/参照元制限エラー（${e.reason}）`); return []; }
        if (e.reason === "quotaExceeded") { quotaHit = true; break; } // 以降も超過するので中断
        console.warn("search失敗", q, e.message);
      }
    }
  }

  const ids = [...idSet];
  if (!ids.length) {
    onError?.("youtube", quotaHit ? "クォータ超過（翌日0:00 PT回復）" : "ライブ動画IDを取得できませんでした");
    return [];
  }
  try {
    const cams = await ytVideosLive(ids, key); // videos.list は 1ユニット/50件と安価
    if (quotaHit) onError?.("youtube", "一部のみ取得（クォータ超過。翌日0:00 PT回復）");
    return cams;
  } catch (e) {
    onError?.("youtube", e.reason === "quotaExceeded" ? "クォータ超過（翌日0:00 PT回復）" : e.message);
    return [];
  }
}

// ============================================================================
// Windy Webcams API v3
// ============================================================================
const WINDY = "https://api.windy.com/webcams/api/v3/webcams";

function windyCategory(cats = []) {
  const ids = cats.map((c) => (typeof c === "string" ? c : c.id || "")).join(" ").toLowerCase();
  if (/(beach|harbor|harbour|sea|coast|island|bay|port)/.test(ids)) return "coast";
  if (/(mountain|ski|lake|forest|nature|volcano)/.test(ids)) return "mountain";
  if (/(traffic|highway|road)/.test(ids)) return "road";
  if (/(city|square|town|landmark|building)/.test(ids)) return "city";
  if (/(weather|sky)/.test(ids)) return "weather";
  if (/(river|dam)/.test(ids)) return "river";
  return "scenery";
}

function windyToCamera(w) {
  const loc = w.location || {};
  const lat = loc.latitude ?? null, lng = loc.longitude ?? null;
  const player = w.player || {};
  const hasLive = !!player.live; // 本物のライブ配信を持つか
  // 埋め込みは player.live を優先、無ければ day（直近24hタイムラプス）。
  const embedUrl =
    player.live || player.day || player.month ||
    (w.webcamId ? `https://webcams.windy.com/webcams/public/embed/player/${w.webcamId}/day` : null);
  const imgs = w.images || {};
  const thumb = imgs.current?.preview || imgs.current?.thumbnail || imgs.daylight?.preview || null;
  const active = (w.status || "").toLowerCase() === "active";
  const place = [loc.city, loc.region, loc.country].filter(Boolean).join(", ");
  const updated = w.lastUpdatedOn ? "・更新 " + new Date(w.lastUpdatedOn).toLocaleString("ja-JP") : "";
  return {
    id: `windy:${w.webcamId}`,
    source: "windy",
    title: w.title || place || `Webcam ${w.webcamId}`,
    place,
    region: regionOf(lat, lng),
    category: windyCategory(w.categories),
    lat, lng,
    hasLive,
    embedType: "iframe",
    embedUrl,
    imageUrl: imgs.current?.preview || null,
    thumbUrl: thumb,
    detailUrl: w.urls?.detail || (w.webcamId ? `https://www.windy.com/webcams/${w.webcamId}` : null),
    // ライブ配信ありは「稼働中」、それ以外（静止画/タイムラプス型）は「稼働(報告)」扱い。
    status: active ? (hasLive ? "live" : "reported") : "offline",
    note: active
      ? (hasLive ? `Windy: ライブ配信${updated}` : `Windy: 稼働中（静止画/タイムラプス）${updated}`)
      : "Windy: 停止中",
    lastChecked: w.lastUpdatedOn ? new Date(w.lastUpdatedOn) : null,
  };
}

// ブラウザから各地方bboxを直接叩く（CORSが通れば最新・通らなければcatchで握りつぶす）。
// limitは最大50なのでoffsetでページングし、地方あたり最大250件まで取得する。
async function windyClientFetch(settings, regions) {
  const key = settings.windyApiKey.trim();
  const byId = new Map();
  for (const r of regions) {
    for (let offset = 0; offset < 250; offset += 50) {
      const usp = new URLSearchParams({
        bbox: `${r.n},${r.e},${r.s},${r.w}`, // N,E,S,W
        include: "categories,images,location,player,urls",
        limit: "50",
        offset: String(offset),
      });
      const res = await fetch(`${WINDY}?${usp}`, { headers: { "x-windy-api-key": key } });
      if (!res.ok) throw new Error(`Windy ${res.status}`);
      const data = await res.json();
      const list = data.webcams || [];
      for (const w of list) {
        const c = windyToCamera(w);
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      if (list.length < 50) break; // この地方はこれ以上ない
    }
  }
  return [...byId.values()];
}

// build時生成カタログ data/windy.json を読む（フォールバック / 既定の確実な経路）
async function windyFromFile() {
  const res = await fetch("./data/windy.json", { cache: "no-store" });
  if (!res.ok) throw new Error("windy.json なし");
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.webcams || [];
  // ファイルが「生のwindyレスポンス」でも「整形済みcamera」でも受ける
  return list.map((w) => (w.source === "windy" ? w : windyToCamera(w)));
}

export async function fetchWindy(settings, regions, onError) {
  const key = (settings.windyApiKey || "").trim();
  const liveOnly = settings.windyLiveOnly !== false; // 既定: ライブ配信のみ
  const refine = (list) => {
    if (!liveOnly) return list;
    const live = list.filter((c) => c.hasLive);
    if (list.length && !live.length) {
      onError?.("windy", `稼働中 ${list.length}件あるがライブ配信は0件（設定の「ライブ配信のみ」をオフにすると静止画/タイムラプス型も表示）`);
    }
    return live;
  };

  if (key && settings.windyClientFetch) {
    try {
      // 成功すればフィルタ後の結果を採用（0件でもCORS失敗ではないのでフォールバックしない）
      return refine(await windyClientFetch(settings, regions));
    } catch (e) {
      console.warn("Windyクライアントfetch失敗（CORS等）→ windy.jsonへ", e.message);
    }
  }
  try {
    const raw = await windyFromFile();
    if (!raw.length) onError?.("windy", "windy.json が空です（tools/fetch-windy.mjs で生成）");
    return refine(raw);
  } catch (_) {
    if (!key) onError?.("windy", "APIキー未設定 & data/windy.json 無し");
    else onError?.("windy", "ブラウザfetchがCORSで不可。tools/fetch-windy.mjs で data/windy.json を生成してください");
    return [];
  }
}

// ============================================================================
// 直リンク / 自治体 など（data/cameras.json）
// ============================================================================
export async function fetchDirect(onError) {
  let raw;
  try {
    const res = await fetch("./data/cameras.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    raw = await res.json();
  } catch (e) {
    onError?.("direct", "data/cameras.json を読めませんでした");
    return [];
  }
  const list = (raw.cameras || raw || []).filter((c) => c && (c.imageUrl || c.embedUrl));
  return list.map((c, i) => {
    const lat = c.lat ?? null, lng = c.lng ?? null;
    const embedType = c.embedType || (c.imageUrl ? "image" : "iframe");
    return {
      id: c.id || `direct:${i}`,
      source: "direct",
      title: c.title || "(無題カメラ)",
      place: c.place || "",
      region: c.region || regionOf(lat, lng),
      category: c.category || guessCategory(`${c.title} ${c.place}`),
      lat, lng,
      approxLocation: !!c.approxLocation,
      embedType,
      embedUrl: c.embedUrl || c.imageUrl,
      imageUrl: c.imageUrl || null,
      thumbUrl: c.thumbUrl || c.imageUrl || null,
      detailUrl: c.detailUrl || c.sourceUrl || null,
      // 画像タイプはプローブで確定。iframeタイプは未確認扱い。
      status: embedType === "image" ? "checking" : "unverified",
      note: c.credit ? `出典: ${c.credit}` : "",
      lastChecked: null,
      // 出典・ライセンス表示用
      credit: c.credit || null,
      sourceUrl: c.sourceUrl || c.detailUrl || null,
    };
  });
}
