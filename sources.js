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

import { regionOf } from "./config.js?v=7";
import { guessRegion, guessCategory, geocodeTitle } from "./geo.js?v=7";

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

// 検索が拾うノイズの除外（build-catalog.mjs と同基準）。
// EXCLUDE_CHANNELS=海外/機種デモ/店内/地震速報専用（正規の地点カメラを持たないch）。
// EXCLUDE_TITLE_RX=ニュース番組の常時配信（局名では消さず、同局の空港/街カメラは残す）。
const EXCLUDE_CHANNELS = new Set([
  "Bristol Parks and Recreation- Maine", "Deerfield Beach Live", "Luxury Island", "Surfline", "Surfers Warehouse",
  "Waves of the World", "The Hale Pau Hana", "Titahi Bay Surf Cam", "afarTV", "Ozolio Live", "911 Surf Report",
  "Amazing Taitung 台東就醬玩", "The Surfers View", "NJ Beach Cams", "Scarborough Beach", "AlohaLiveCam",
  "Venice Vive", "Boston and Maine Live", "Waikiki Aquarium",
  "Digital Eye Field Lab CTS", "Armchair Traveler", "Earth Now", "もふもふペットCafe", "ウミネコ商店",
  "株式会社ティーファイブプロジェクト", "JDQ-地震情報",
]);
const EXCLUDE_TITLE_RX = /ニュースまとめ|昼のニュース|24H ?NEWS|NEWS LIVE NOW|Japan News Digest|緊急地震速報|地震速報ライブ|WORLD-JAPAN News|最新ニュース|コミックマーケット|待機列/i;

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

// プレイリスト→動画ID（最大2ページ=100件。build-catalog.mjs の PLAYLIST_PAGES と統一）
async function ytPlaylistVideoIds(playlistId, key) {
  const ids = [];
  let pageToken = "";
  for (let page = 0; page < 2; page++) {
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
      if (EXCLUDE_CHANNELS.has(sn.channelTitle) || EXCLUDE_TITLE_RX.test(title)) continue; // 海外/ニュース/非カメラ除外
      // 地名推定は title＋channelTitle のみ（descriptionは他カメラ一覧を列挙しがちで誤マッチの元）
      const text = `${title} ${sn.channelTitle || ""}`;
      const viewers = v?.liveStreamingDetails?.concurrentViewers;
      const thumb =
        sn.thumbnails?.medium?.url || sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null;
      const guessed = guessRegion(text);
      const geo = geocodeTitle(text, guessed); // 座標なしソースを地図に出すための推定位置
      // 地域は座標から決める（ピン位置と地域フィルタを一致させる。例: 大島→izu）
      const region = geo ? (regionOf(geo.lat, geo.lng) || guessed) : guessed;
      // 地域不明かつ日本語タイトル無し＝海外カメラとみなし除外（build-catalog.mjs と同基準）。
      if (region == null && !/[぀-ヿ一-鿿ー]/.test(title)) continue;
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
  const liveOnly = settings.windyLiveOnly !== false; // 既定は false（静止画/タイムラプス型も含め全件表示）。true 指定時のみライブ配信に限定
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
      // 画像タイプはプローブで確定。iframeタイプは maintainer が出典確認済みの登録なので
      // 「稼働(報告)」扱いにして既定の「稼働中のみ」フィルタを通す（unverified だと黙って消えるため）。
      status: embedType === "image" ? "checking" : "reported",
      note: c.credit ? `出典: ${c.credit}` : "",
      lastChecked: null,
      // 出典・ライセンス表示用
      credit: c.credit || null,
      sourceUrl: c.sourceUrl || c.detailUrl || null,
    };
  });
}
