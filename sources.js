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

import { regionOf } from "./config.js?v=5";

// ---- ユーティリティ -------------------------------------------------------

// タイトルから地方/カテゴリを推定（YouTubeなど座標が無いソース向け）
const REGION_HINTS = [
  ["hokkaido", ["北海道", "札幌", "函館", "旭川", "釧路", "知床", "小樽", "hokkaido", "sapporo"]],
  ["tohoku",   ["東北", "青森", "秋田", "岩手", "山形", "宮城", "仙台", "福島", "tohoku", "sendai"]],
  ["kanto",    ["東京", "渋谷", "新宿", "横浜", "千葉", "埼玉", "茨城", "栃木", "群馬", "神奈川", "tokyo", "shibuya", "yokohama"]],
  ["chubu",    ["富士", "山梨", "長野", "新潟", "名古屋", "愛知", "静岡", "岐阜", "金沢", "石川", "富山", "福井", "fuji", "nagoya"]],
  ["kinki",    ["大阪", "京都", "神戸", "兵庫", "奈良", "和歌山", "滋賀", "三重", "osaka", "kyoto", "kobe"]],
  ["chugoku",  ["広島", "岡山", "山口", "鳥取", "島根", "hiroshima", "okayama"]],
  ["shikoku",  ["高知", "徳島", "愛媛", "香川", "松山", "kochi", "shikoku"]],
  ["kyushu",   ["福岡", "博多", "熊本", "長崎", "鹿児島", "宮崎", "大分", "佐賀", "沖縄", "那覇", "石垣", "fukuoka", "okinawa", "naha"]],
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
  ["札幌", 43.062, 141.354], ["函館", 41.768, 140.729], ["旭川", 43.77, 142.36],
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
