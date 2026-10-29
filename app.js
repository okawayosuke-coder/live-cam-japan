// ============================================================================
// app.js  ―  統合・描画・地図・ライブ判定
// ============================================================================
import { REGIONS, CATEGORIES, loadSettings, saveSettings } from "./config.js?v=8";
import { fetchYouTube, fetchWindy, fetchDirect, probeImage } from "./sources.js?v=8";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const CARDS_PER_PAGE = 60; // 一覧の初期表示件数（「もっと見る」で追加）
// YouTubeの「ライブ中」判定がこれより古い＝定期ビルド停止の疑い（通常は8時間ごとに更新）。
// 2026-10 に定期実行が13日止まり、「稼働中」表示の27%が配信終了済みになっていた反省から。
const STALE_MS = 24 * 60 * 60 * 1000;
// 直リンク画像（河川カメラ等）をモーダルで開いている間の再取得間隔。
// 川の防災情報の画像は約10分ごと更新・Cache-Control max-age=300 なので、5秒ごとは提供元への過剰負荷だった。
const IMAGE_REFRESH_MS = 60 * 1000;

const state = {
  settings: loadSettings(),
  cameras: [],          // 全カメラ
  map: null,
  markers: new Map(),   // id -> L.marker
  layer: null,          // L.layerGroup
  filters: { q: "", region: "all", category: "all", source: "all", fav: false },
  visibleLimit: CARDS_PER_PAGE,
  errors: {},           // source -> message
  loading: false,
  cacheAge: null,
  catalogGeneratedAt: null,
};

const SOURCE_LABEL = { youtube: "YouTube", windy: "Windy", direct: "直リンク", catalog: "公開データ" };
const STATUS_META = {
  live:       { label: "稼働中",   cls: "ok",   color: "#22c55e" },
  reported:   { label: "稼働(報告)", cls: "rep",  color: "#14b8a6" },
  stale:      { label: "要確認",   cls: "stale", color: "#f59e0b" }, // ライブ判定が24時間超前（配信終了の可能性）
  checking:   { label: "確認中…",  cls: "chk",  color: "#9ca3af" },
  unverified: { label: "未確認",   cls: "unv",  color: "#64748b" },
  offline:    { label: "停止",     cls: "off",  color: "#ef4444" },
};

// ---- 地図 -----------------------------------------------------------------
function initMap() {
  const map = L.map("map", { zoomControl: true, attributionControl: true }).setView([37.8, 137.5], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors ｜ Webカメラ: <a href='https://www.windy.com/webcams' target='_blank' rel='noopener'>Windy.com</a> / YouTube",
  }).addTo(map);
  // 大量マーカーをまとめるクラスタリング（プラグイン未読込時はlayerGroupにフォールバック）
  state.layer = (typeof L.markerClusterGroup === "function")
    ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50, spiderfyOnMaxZoom: true })
    : L.layerGroup();
  state.layer.addTo(map);
  state.map = map;
}

// アイコンは「状態×推定位置か」の十数通りしかないので使い回す（全国1万件超の再描画で毎回生成しない）
const _iconCache = new Map();
function markerIcon(status, approx) {
  const key = `${status}|${approx ? 1 : 0}`;
  if (!_iconCache.has(key)) _iconCache.set(key, buildMarkerIcon(status, approx));
  return _iconCache.get(key);
}
function buildMarkerIcon(status, approx) {
  const c = (STATUS_META[status] || STATUS_META.unverified).color;
  // しずく形ピン（白フチ＋ドロップシャドウ）。明るい地図でも埋もれず地図記号として明確。
  // approx（推定位置）は白フチを点線にして正確座標と区別。
  const dash = approx ? ` stroke-dasharray="3 2.4"` : "";
  const html = `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1.5C7.1 1.5 1.5 7.1 1.5 14c0 9.4 12.5 22.5 12.5 22.5S26.5 23.4 26.5 14C26.5 7.1 20.9 1.5 14 1.5Z"
      fill="${c}" stroke="#fff" stroke-width="2.6"${dash}/>
    <circle cx="14" cy="14" r="4.6" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    className: "lcj-marker",
    html,
    iconSize: [28, 38],
    iconAnchor: [14, 37],   // ピン先端を座標に合わせる
    popupAnchor: [0, -34],
  });
}

// ---- セッションキャッシュ（クォータ節約: TTL内の再読込はAPIを叩かない） ----
const CACHE_KEY = "lcj.cache.v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分
function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (c && Array.isArray(c.cams) && Date.now() - c.t < CACHE_TTL_MS) return c;
  } catch (_) {}
  return null;
}
function writeCache(cams) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), cams })); } catch (_) {}
}
function reviveDates(c) { if (c && c.lastChecked) c.lastChecked = new Date(c.lastChecked); return c; }

// 公開モード: ビルド時生成の静的カタログ（YouTube+Windy）を読む
async function loadCatalog() {
  // キャッシュバスト（?cb=時刻）で全キャッシュ層を貫通し、常に最新カタログを取得
  const res = await fetch("./data/catalog.json?cb=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("no catalog");
  const data = await res.json();
  state.catalogGeneratedAt = data.generatedAt || null;
  return (data.cameras || []).map(reviveDates).map(markStale);
}
// YouTubeの「ライブ中」はビルド時点の判定。最終確認(lastChecked)が STALE_MS より古いものは
// 「要確認」に下げる（ビルド停止時だけでなく、クォータ枯渇時に前回分を再利用した場合も lastChecked が古いまま残る）。
function markStale(c) {
  if (c.source !== "youtube" || c.status !== "live") return c;
  const t = c.lastChecked ? new Date(c.lastChecked).getTime() : NaN;
  if (!(Date.now() - t > STALE_MS)) return c;
  return { ...c, status: "stale", note: `ライブ確認は${relTime(c.lastChecked)}（定期更新が止まっている可能性）。配信が終了している場合があります` };
}

// ---- お気に入り（localStorage） ----
const FAV_KEY = "lcj.favs.v1";
let _favs = new Set();
try { _favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch (_) {}
function isFav(id) { return _favs.has(id); }
function toggleFav(id) {
  if (_favs.has(id)) _favs.delete(id); else _favs.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([..._favs])); } catch (_) {}
}

// ---- 相対時刻（鮮度表示） ----
function relTime(d) {
  if (!d) return "";
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!t || isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

// ---- スケルトン（取得待ちのプレースホルダ） ----
function renderSkeleton(n = 9) {
  $("#grid").innerHTML = Array.from({ length: n }, () => `<div class="card skel"><div class="thumbwrap"></div><div class="meta"><div class="skline"></div><div class="skline short"></div></div></div>`).join("");
}

// ---- データ取得（ソース到着ごとにストリーミング描画） ----
async function loadAll({ force = false } = {}) {
  if (state.loading) return;
  const s = state.settings;
  // 鍵なし = 公開モード → ビルド時生成の静的カタログを読む（クライアントにキー不要・クォータ消費なし）
  const deployed = !s.youtubeApiKey && !s.windyApiKey;
  state.deployed = deployed; // 空状態の文言出し分け等で参照
  // セッションキャッシュはAPIクォータ節約のためのもの＝鍵ありモードだけで使う。
  // 公開モードは静的JSON（圧縮後数百KB）を毎回読む。キャッシュ経由だと公開データの生成時刻（鮮度表示）が
  // 失われていたため（再読み込みで「公開データ X日前生成」が消える不具合）。
  if (deployed) { try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {} } // 旧版が残した数MBの保存分を掃除
  // キャッシュ命中（強制更新でなければ）
  if (!force && !deployed) {
    const c = readCache();
    if (c) {
      state.cameras = c.cams.map(reviveDates);
      state.cacheAge = Math.round((Date.now() - c.t) / 60000);
      state.errors = {};
      render();
      probeDirectImages();
      return;
    }
  }
  state.loading = true;
  state.errors = {};
  state.cameras = [];
  state.cacheAge = null;
  state.visibleLimit = CARDS_PER_PAGE;
  renderSkeleton();
  setStatusBar("カメラを取得中…");

  const byId = new Map();
  const merge = (arr) => {
    for (const cam of arr || []) if (cam && !byId.has(cam.id)) byId.set(cam.id, cam);
    state.cameras = [...byId.values()];
    render(); // 到着次第ストリーミング描画
  };
  const onError = (src, msg) => { state.errors[src] = msg; render(); };
  const jobs = [];
  if (deployed) {
    jobs.push(loadCatalog().then(merge).catch(() => onError("catalog", "公開カタログ未生成（data/catalog.json）。ローカルは設定でAPIキーを追加")));
    if (s.enabledSources.direct) jobs.push(fetchDirect(onError).then(merge).catch(() => {}));
  } else {
    if (s.enabledSources.youtube) jobs.push(fetchYouTube(s, onError).then(merge).catch(() => {}));
    if (s.enabledSources.windy)   jobs.push(fetchWindy(s, REGIONS, onError).then(merge).catch(() => {}));
    if (s.enabledSources.direct)  jobs.push(fetchDirect(onError).then(merge).catch(() => {}));
  }

  await Promise.all(jobs);
  state.loading = false;
  if (!deployed) writeCache(state.cameras);
  render();
  probeDirectImages();   // 直リンク画像を非同期に死活確認
  // ローカル開発で何も取れなかったときだけ設定（APIキー入力）を促す。
  // 旧実装は「起動0.8秒後に0件なら開く」で、回線が遅いと公開サイトの訪問者にもキー入力画面が出ていた。
  if (deployed && !state.cameras.length && isLocalHost()) openSettings();
}

// 直リンク(image)カメラを順次プローブして status を更新
async function probeDirectImages() {
  const targets = state.cameras.filter((c) => c.source === "direct" && c.embedType === "image" && c.status === "checking");
  const limit = 6; // 同時実行数
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const cam = targets[i++];
      const ok = await probeImage(cam.imageUrl, state.settings.probeTimeoutMs);
      cam.status = ok ? "live" : "offline";
      cam.note = ok ? "画像取得OK（稼働中）" : "画像取得に失敗（停止の可能性）";
      cam.lastChecked = new Date();
      updateCameraInPlace(cam);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  render();
}

// ---- フィルタ＆描画 --------------------------------------------------------
function visibleCameras() {
  const f = state.filters;
  // stale（要確認）は配信が続いている可能性も高い（2026-10の実測で73%は継続中）ので「稼働中のみ」でも残す
  const okStatuses = state.settings.onlyWorking
    ? new Set(["live", "reported", "stale", "checking"])
    : new Set(["live", "reported", "stale", "checking", "unverified", "offline"]);
  return state.cameras.filter((c) => {
    if (f.fav && !isFav(c.id)) return false;
    if (!okStatuses.has(c.status)) return false;
    if (f.source !== "all" && c.source !== f.source) return false;
    if (f.region !== "all" && c.region !== f.region) return false;
    if (f.category !== "all" && c.category !== f.category) return false;
    if (f.q) {
      const hay = `${c.title} ${c.place}`.toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

// stale（要確認のYouTube）は唯一の動画ソースで7割は配信継続中（2026-10実測）なので、静止画中心の reported より前に出す
function statusRank(s) { return { live: 0, stale: 1, reported: 2, checking: 3, unverified: 4, offline: 5 }[s] ?? 9; }

// フィルタ後→ステータス→名前 の確定順（render とカードのみ再描画で共有）
// 比較器は使い回す（localeCompare(…,"ja") は呼ぶたびに作り直すため、1.4万件で約1.5倍遅かった）
const titleCollator = new Intl.Collator("ja");
function sortedVisible() {
  return visibleCameras().sort((a, b) => statusRank(a.status) - statusRank(b.status) || titleCollator.compare(a.title, b.title));
}

function render() {
  const cams = sortedVisible();
  renderCards(cams);
  renderMarkers(cams);
  renderStats(cams);
  renderStaleWarning();
}

function renderStats(cams) {
  const live = cams.filter((c) => c.status === "live").length;
  const rep = cams.filter((c) => c.status === "reported").length;
  const chk = cams.filter((c) => c.status === "checking").length;
  const stale = cams.filter((c) => c.status === "stale").length;
  const total = state.cameras.length;
  let msg = (state.loading ? "取得中… " : "") +
    `表示 ${cams.length}件（稼働確定 ${live} / 稼働報告 ${rep}${stale ? " / 要確認 " + stale : ""}${chk ? " / 確認中 " + chk : ""}）・取得総数 ${total}`;
  if (state.cacheAge != null) msg += `・キャッシュ${state.cacheAge}分前（更新ボタンで再取得）`;
  if (state.catalogGeneratedAt) msg += `・公開データ ${relTime(state.catalogGeneratedAt)}生成`;
  const errs = Object.entries(state.errors).filter(([, m]) => m);
  if (errs.length) msg += " ｜ ⚠ " + errs.map(([s, m]) => `${SOURCE_LABEL[s]}: ${m}`).join(" / ");
  setStatusBar(msg);
}

function setStatusBar(text) { const el = $("#statusbar"); el.textContent = text; el.title = text; /* 省略時も全文をホバーで確認可能に */ }

// 「要確認」が1件でもあれば、状態バーより目立つ警告を出す（絞り込みに関係なく全体で判定）
function renderStaleWarning() {
  const el = $("#stalewarn");
  if (!el) return;
  const n = state.cameras.filter((c) => c.status === "stale").length;
  el.hidden = !n;
  if (n) {
    const when = state.catalogGeneratedAt ? `（公開データは${relTime(state.catalogGeneratedAt)}に生成）` : "";
    el.textContent = `⚠ YouTubeカメラ${n}件は、ライブ中の確認から24時間以上たっています${when}。` +
      `「要確認」のカメラは配信が終了している場合があります。`;
  }
}

function cardHtml(cam) {
  const sm = STATUS_META[cam.status] || STATUS_META.unverified;
  const thumb = cam.thumbUrl || cam.imageUrl;
  // 画像読込失敗（Windyトークン失効・hotlink拒否等）はプレースホルダに切替
  const thumbHtml = thumb
    ? `<img class="thumb" loading="lazy" src="${escapeAttr(thumb)}" alt="" referrerpolicy="no-referrer" onerror="this.classList.add('broken')">`
    : `<div class="thumb noimg">NO IMAGE</div>`;
  const fresh = cam.source === "windy" && cam.lastChecked ? `<span class="fresh" title="Windy最終更新">🕒${relTime(cam.lastChecked)}</span>` : "";
  const faved = isFav(cam.id);
  return `
    <article class="card" data-id="${escapeAttr(cam.id)}" tabindex="0" role="button" aria-label="${escapeAttr(cam.title)}">
      <div class="thumbwrap">
        ${thumbHtml}
        <span class="badge ${sm.cls}">${sm.label}</span>
        <span class="srcchip s-${escapeAttr(cam.source)}">${SOURCE_LABEL[cam.source] || cam.source}</span>
        <button class="favbtn${faved ? " on" : ""}" data-fav="${escapeAttr(cam.id)}" aria-label="お気に入り" aria-pressed="${faved}">${faved ? "★" : "☆"}</button>
        ${fresh}
      </div>
      <div class="meta">
        <h3 title="${escapeAttr(cam.title)}">${escapeHtml(cam.title)}</h3>
        <p class="place">${escapeHtml(cam.place || "")}</p>
      </div>
    </article>`;
}

function renderCards(cams) {
  const grid = $("#grid");
  if (state.loading && !cams.length) return; // スケルトン表示中は維持
  if (!cams.length) {
    const f = state.filters;
    const filtering = f.q || f.region !== "all" || f.category !== "all" || f.source !== "all" || f.fav;
    // 公開モードの訪問者はAPIキーを設定しないため、状況に応じた案内に出し分ける
    const advice = filtering
      ? "検索・地方・カテゴリ・お気に入りの絞り込みを緩めてみてください。"
      : (state.deployed
          ? "現在表示できる稼働中カメラがありません。時間をおいて再度お試しください。"
          : "設定でAPIキーを追加するか、「稼働中のみ」をオフにしてみてください。");
    const clearBtn = filtering ? `<br><button id="clearFilters" class="btn" style="margin-top:14px">絞り込みをクリア</button>` : "";
    grid.innerHTML = `<div class="empty">該当するカメラがありません。<br>${advice}${clearBtn}</div>`;
    return;
  }
  const limit = state.visibleLimit || CARDS_PER_PAGE;
  const shown = cams.slice(0, limit);
  let html = shown.map(cardHtml).join("");
  if (cams.length > limit) {
    html += `<button id="moreBtn" class="morebtn">さらに表示（残り ${cams.length - limit}件）</button>`;
  }
  grid.innerHTML = html;
}

// 推定位置（同一地名で座標が重複しがち）はIDから決定的に小さくずらして重なりを防ぐ。
// 沿岸・島の港カメラが海に流出しないよう、ズラし量は控えめ（約90〜440m）に。
function approxJitter(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const ang = (Math.abs(h) % 360) * Math.PI / 180;
  const rad = 0.0008 + (Math.abs(h >> 8) % 1000) / 1000 * 0.0032; // 約90〜440m
  return [Math.sin(ang) * rad, Math.cos(ang) * rad];
}

function renderMarkers(cams) {
  state.layer.clearLayers();
  state.markers.clear();
  const arr = [];
  for (const cam of cams) {
    if (cam.lat == null || cam.lng == null) continue;
    let lat = cam.lat, lng = cam.lng;
    if (cam.approxLocation) { const [dy, dx] = approxJitter(cam.id); lat += dy; lng += dx; }
    const m = L.marker([lat, lng], { icon: markerIcon(cam.status, cam.approxLocation), title: cam.title + (cam.approxLocation ? "（推定位置）" : "") });
    m.on("click", () => openModal(cam.id));
    arr.push(m);
    state.markers.set(cam.id, m);
  }
  // markerClusterGroup は addLayers で一括投入（chunkedLoading が効き、都度の増分クラスタ更新を避ける）。
  // 素の L.layerGroup は addLayers 非対応なので個別 addTo にフォールバック。
  if (typeof state.layer.addLayers === "function") state.layer.addLayers(arr);
  else arr.forEach((m) => m.addTo(state.layer));
}

// プローブ後など、1件だけ反映（再描画は最終的にrenderで）
function updateCameraInPlace(cam) {
  const card = $(`.card[data-id="${cssEscape(cam.id)}"] .badge`);
  if (card) {
    const sm = STATUS_META[cam.status];
    card.textContent = sm.label;
    card.className = `badge ${sm.cls}`;
  }
}

// ---- YouTube IFrame Player API（埋め込み失敗を実行時検知→YouTube誘導に切替） ----
let _ytApiReady = null;
function ensureYTApi() {
  if (_ytApiReady) return _ytApiReady;
  _ytApiReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch (_) {} resolve(); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return _ytApiReady;
}
function ytFallbackHtml(cam) {
  return `<div class="player noimg openyt">
    <div class="ytmsg">このカメラは配信者の設定でサイト内再生ができません</div>
    <a class="btn primary" href="${escapeAttr(safeUrl(cam.detailUrl))}" target="_blank" rel="noopener">▶ YouTubeで見る ↗</a>
  </div>`;
}
function destroyYtPlayer() {
  if (state._ytTimer) { clearTimeout(state._ytTimer); state._ytTimer = null; }
  if (state._ytPlayer) { try { state._ytPlayer.destroy(); } catch (_) {} state._ytPlayer = null; }
}
function showYtFallbackInModal(cam) {
  destroyYtPlayer();
  const wrap = $("#modalBody .playerwrap");
  if (wrap) wrap.innerHTML = ytFallbackHtml(cam);
}
async function initYtPlayer(cam) {
  const vid = cam.id.replace(/^yt:/, "");
  await ensureYTApi();
  if (!$("#modal").classList.contains("open")) return; // 既に閉じられた
  const el = document.getElementById("ytplayer");
  if (!el) return;
  let settled = false;
  const fail = () => { if (settled) return; settled = true; showYtFallbackInModal(cam); };
  state._ytPlayer = new YT.Player(el, {
    width: "100%", height: "100%", videoId: vid,
    playerVars: { autoplay: 1, mute: 1, playsinline: 1 },
    events: {
      onReady: (e) => { try { e.target.playVideo(); } catch (_) {} },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) {
          settled = true;
          if (state._ytTimer) { clearTimeout(state._ytTimer); state._ytTimer = null; }
        }
      },
      onError: () => fail(),
    },
  });
  // 6秒で再生開始しなければ埋め込み失敗とみなす（error153等でonErrorが出ないケースの保険）
  state._ytTimer = setTimeout(fail, 6000);
}

// ---- モーダル（埋め込み再生） ----------------------------------------------
function openModal(id) {
  const cam = state.cameras.find((c) => c.id === id);
  if (!cam) return;
  destroyYtPlayer(); // 前回のプレーヤーを掃除
  // 画像更新インターバルも掃除（destroyYtPlayer との対称性。再オープン時のタイマーリーク防止）
  if (state._imgTimer) { clearInterval(state._imgTimer); state._imgTimer = null; }
  state._lastFocus = document.activeElement; // 閉じたとき起点へフォーカスを戻すため保持
  const body = $("#modalBody");
  const sm = STATUS_META[cam.status] || STATUS_META.unverified;
  let player = "";
  let initYt = false;
  if (cam.embedType === "image") {
    player = `<img id="liveImg" class="player" src="${escapeAttr(cam.imageUrl)}" referrerpolicy="no-referrer" alt="${escapeAttr(cam.title)}">`;
  } else if (cam.source === "youtube" && cam.embeddable === false) {
    // 埋め込み禁止が事前に分かっている → 即YouTube誘導
    player = ytFallbackHtml(cam);
  } else if (cam.source === "youtube") {
    // IFrame APIで再生。失敗(onError/タイムアウト)時は誘導パネルへ切替。
    player = `<div id="ytplayer" class="player"></div>`;
    initYt = true;
  } else if (cam.embedUrl && safeUrl(cam.embedUrl)) {
    // sandbox で埋め込み先の権限を制限（allow-top-navigation は付けない＝トップ遷移によるフィッシングを防ぐ）。
    // Windy/直リンクプレーヤーの再生に必要な scripts/same-origin/popups/presentation は許可。
    player = `<iframe class="player" src="${escapeAttr(safeUrl(cam.embedUrl))}" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  } else {
    player = `<div class="player noimg">埋め込み不可。下のリンクから開いてください。</div>`;
  }
  $("#modalTitle").textContent = cam.title;
  const faved = isFav(cam.id);
  body.innerHTML = `
    <div class="playerwrap">${player}</div>
    <div class="modalmeta">
      <span class="badge ${sm.cls}">${sm.label}</span>
      <span class="srcchip s-${escapeAttr(cam.source)}">${SOURCE_LABEL[cam.source] || cam.source}</span>
      <button id="modalFav" class="favbtn inline${faved ? " on" : ""}" aria-label="お気に入り" aria-pressed="${faved}">${faved ? "★ お気に入り" : "☆ お気に入り"}</button>
      ${cam.place ? `<span class="mplace">${escapeHtml(cam.place)}</span>` : ""}
      ${cam.note ? `<span class="mnote">${escapeHtml(cam.note)}</span>` : ""}
      ${cam.source === "windy" && cam.lastChecked ? `<span class="mnote">🕒 更新 ${relTime(cam.lastChecked)}</span>` : ""}
      ${cam.approxLocation ? `<span class="mnote">📍 地図上の位置は名称からの推定です</span>` : ""}
      ${safeUrl(cam.detailUrl) ? `<a class="ext" href="${escapeAttr(safeUrl(cam.detailUrl))}" target="_blank" rel="noopener">元ページを開く ↗</a>` : ""}
    </div>`;
  $("#modal").classList.add("open");
  // アクセシビリティ: ダイアログ内へフォーカスを移す（背後にフォーカスが残らないように）
  const closeBtn = $("#modalClose");
  if (closeBtn) closeBtn.focus();
  const mf = $("#modalFav");
  if (mf) mf.addEventListener("click", () => {
    toggleFav(cam.id);
    const on = isFav(cam.id);
    mf.classList.toggle("on", on);
    mf.setAttribute("aria-pressed", String(on));
    mf.textContent = on ? "★ お気に入り" : "☆ お気に入り";
  });
  if (initYt) initYtPlayer(cam);
  // 直リンク画像は開いている間 IMAGE_REFRESH_MS ごとに更新（提供元の更新周期に合わせ、過剰に取りに行かない）
  if (cam.embedType === "image") {
    const img = $("#liveImg");
    state._imgTimer = setInterval(() => {
      const base = cam.imageUrl.split("?")[0];
      const q = cam.imageUrl.includes("?") ? cam.imageUrl.split("?")[1] + "&" : "";
      img.src = `${base}?${q}_lcj=${Date.now()}`;
    }, IMAGE_REFRESH_MS);
  }
}
// 開いているダイアログ内に Tab フォーカスを閉じ込める（背後の要素へ抜けさせない）
function trapTab(e) {
  const dlg = $("#modal").classList.contains("open") ? $("#modal .dialog")
            : $("#settings").classList.contains("open") ? $("#settings .dialog") : null;
  if (!dlg) return;
  const list = Array.from(dlg.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((el) => el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function closeModal() {
  $("#modal").classList.remove("open");
  destroyYtPlayer();
  $("#modalBody").innerHTML = "";
  if (state._imgTimer) { clearInterval(state._imgTimer); state._imgTimer = null; }
  // 起点要素へフォーカスを復元（キーボード操作の連続性）
  const back = state._lastFocus;
  state._lastFocus = null;
  if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
}

// ---- 設定モーダル ----------------------------------------------------------
function openSettings() {
  const s = state.settings;
  $("#setYt").value = s.youtubeApiKey || "";
  $("#setYtPlaylists").value = (s.youtubePlaylists || []).join(", ");
  $("#setYtSearch").checked = !!s.youtubeSearchEnabled;
  $("#setWindy").value = s.windyApiKey || "";
  $("#setWindyClient").checked = !!s.windyClientFetch;
  $("#setWindyLiveOnly").checked = s.windyLiveOnly !== false;
  $("#setSrcYt").checked = !!s.enabledSources.youtube;
  $("#setSrcWindy").checked = !!s.enabledSources.windy;
  $("#setSrcDirect").checked = !!s.enabledSources.direct;
  state._lastFocusS = document.activeElement; // 閉じたとき起点へ戻す
  $("#settings").classList.add("open");
  const c = $("#settingsClose");
  if (c) c.focus();
}
function closeSettings() {
  $("#settings").classList.remove("open");
  const back = state._lastFocusS;
  state._lastFocusS = null;
  if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
}
function saveSettingsFromForm() {
  const playlists = $("#setYtPlaylists").value.split(",").map((x) => x.trim()).filter(Boolean);
  state.settings = saveSettings({
    youtubeApiKey: $("#setYt").value.trim(),
    youtubePlaylists: playlists,
    youtubeSearchEnabled: $("#setYtSearch").checked,
    windyApiKey: $("#setWindy").value.trim(),
    windyClientFetch: $("#setWindyClient").checked,
    windyLiveOnly: $("#setWindyLiveOnly").checked,
    enabledSources: {
      youtube: $("#setSrcYt").checked,
      windy: $("#setSrcWindy").checked,
      direct: $("#setSrcDirect").checked,
    },
  });
  closeSettings();
  maybeWarnKeyExposure(); // キー保存でライブモードに入る場合、露出警告を即時再評価（リロード待ちにしない）
  loadAll();
}

// ---- フィルタUI構築 --------------------------------------------------------
function buildFilters() {
  const reg = $("#fRegion");
  reg.innerHTML = `<option value="all">全国</option>` +
    REGIONS.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
  const cat = $("#fCategory");
  cat.innerHTML = `<option value="all">全カテゴリ</option>` +
    CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
}

// フィルタ変更時: 表示上限リセット→再描画→URL同期
function applyFilter() {
  state.visibleLimit = CARDS_PER_PAGE;
  render();
  syncHash();
}
// 全フィルタを初期化してコントロール値も同期（空状態の「絞り込みをクリア」から）
function clearFilters() {
  state.filters = { q: "", region: "all", category: "all", source: "all", fav: false };
  $("#fRegion").value = "all";
  $("#fCategory").value = "all";
  $("#fSource").value = "all";
  $("#fSearch").value = "";
  $("#fFav").classList.remove("on");
  $("#fFav").setAttribute("aria-pressed", "false");
  if (state.map) state.map.flyTo([37.8, 137.5], 5, { duration: 0.6 });
  applyFilter();
}
// 共有可能なURL（#r=kanto&c=coast&q=...）に状態を反映
function syncHash() {
  const f = state.filters;
  const p = new URLSearchParams();
  if (f.region !== "all") p.set("r", f.region);
  if (f.category !== "all") p.set("c", f.category);
  if (f.source !== "all") p.set("s", f.source);
  if (f.q) p.set("q", f.q);
  if (f.fav) p.set("fav", "1");
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (_) {}
}
// URLハッシュ→フィルタ＆コントロールへ反映（buildFilters後に呼ぶ）
function applyHashToUI() {
  const p = new URLSearchParams(location.hash.slice(1));
  const f = state.filters;
  if (p.get("r")) f.region = p.get("r");
  if (p.get("c")) f.category = p.get("c");
  if (p.get("s")) f.source = p.get("s");
  if (p.get("q")) f.q = p.get("q");
  if (p.get("fav") === "1") f.fav = true;
  $("#fRegion").value = f.region;
  $("#fCategory").value = f.category;
  $("#fSource").value = f.source;
  $("#fSearch").value = f.q;
  $("#fFav").classList.toggle("on", f.fav);
  $("#fFav").setAttribute("aria-pressed", String(f.fav));
  // 共有URL(#r=kanto 等)で開いたとき、カード一覧だけでなく地図も当該地方へ寄せる（手動変更時と同挙動）
  if (f.region !== "all" && state.map) {
    const r = REGIONS.find((x) => x.id === f.region);
    if (r) state.map.flyTo(r.center, 7, { duration: 0.6 });
  }
}

function wireUI() {
  $("#fRegion").addEventListener("change", (e) => {
    state.filters.region = e.target.value;
    const r = REGIONS.find((x) => x.id === e.target.value);
    if (state.map) state.map.flyTo(r ? r.center : [37.8, 137.5], r ? 7 : 5, { duration: 0.6 });
    applyFilter();
  });
  $("#fCategory").addEventListener("change", (e) => { state.filters.category = e.target.value; applyFilter(); });
  $("#fSource").addEventListener("change", (e) => { state.filters.source = e.target.value; applyFilter(); });
  let _searchT;
  $("#fSearch").addEventListener("input", (e) => {
    state.filters.q = e.target.value;
    clearTimeout(_searchT);
    _searchT = setTimeout(applyFilter, 220); // デバウンス（大量マーカー再構築の連発を防ぐ）
  });
  $("#fOnlyWorking").addEventListener("change", (e) => {
    state.settings = saveSettings({ onlyWorking: e.target.checked });
    applyFilter();
  });
  $("#fFav").addEventListener("click", () => {
    state.filters.fav = !state.filters.fav;
    $("#fFav").classList.toggle("on", state.filters.fav);
    $("#fFav").setAttribute("aria-pressed", String(state.filters.fav));
    applyFilter();
  });
  $("#btnRefresh").addEventListener("click", () => loadAll({ force: true }));
  $("#btnSettings").addEventListener("click", openSettings);
  $("#settingsSave").addEventListener("click", saveSettingsFromForm);
  $("#settingsClose").addEventListener("click", closeSettings);
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") closeSettings(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); closeSettings(); }
    else if (e.key === "Tab") trapTab(e);
  });
  // グリッドのクリック委譲: お気に入り / もっと見る / カード
  $("#grid").addEventListener("click", (e) => {
    const fav = e.target.closest(".favbtn");
    if (fav) {
      e.stopPropagation();
      toggleFav(fav.dataset.fav);
      if (state.filters.fav) {
        render(); // ★フィルタON時は表示集合が変わるので全描画
      } else {
        // 集合不変: 押した★の見た目だけその場更新（全カード再生成＋マーカー再構築を回避し、フォーカスも維持）
        const on = isFav(fav.dataset.fav);
        fav.classList.toggle("on", on);
        fav.setAttribute("aria-pressed", String(on));
        fav.textContent = on ? "★" : "☆";
      }
      return;
    }
    if (e.target.closest("#moreBtn")) {
      state.visibleLimit += CARDS_PER_PAGE;
      renderCards(sortedVisible()); // マーカー・統計は visibleLimit 非依存なのでカードのみ再描画
      const more = $("#moreBtn");
      if (more) more.focus(); // 連続読み込みのキーボードフォーカスを維持
      return;
    }
    if (e.target.closest("#clearFilters")) { clearFilters(); return; }
    const card = e.target.closest(".card");
    if (card && !card.classList.contains("skel")) openModal(card.dataset.id);
  });
  $("#grid").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const card = e.target.closest(".card"); if (card && !card.classList.contains("skel")) openModal(card.dataset.id); }
  });
  $("#fOnlyWorking").checked = state.settings.onlyWorking;
}

// ---- エスケープ ------------------------------------------------------------
function escapeHtml(s = "") { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s = "") { return escapeHtml(String(s)); }
function cssEscape(s = "") { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"); }
// href/iframe src 用: http/https 以外（javascript: 等）を弾く。第三者API/カタログ由来URLのスキームインジェクション対策。
function safeUrl(u) {
  if (!u) return "";
  try { const p = new URL(u, location.href); return (p.protocol === "http:" || p.protocol === "https:") ? u : ""; }
  catch (_) { return ""; }
}

// ローカル開発（自分のPCの配信サーバー）で動いているか。index.html の config.local.js 読込判定と同じ基準。
function isLocalHost() {
  const host = location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "" || host === "::1" || host === "[::1]";
}

// 公開ドメインで動いている場合、ブラウザにAPIキーが露出する旨を警告
function maybeWarnKeyExposure() {
  const el = $("#keywarn");
  if (el && !isLocalHost() && (state.settings.youtubeApiKey || state.settings.windyApiKey)) el.hidden = false;
}

// ---- 起動 ------------------------------------------------------------------
function boot() {
  initMap();
  buildFilters();
  applyHashToUI();      // 共有URLの状態を反映
  wireUI();
  maybeWarnKeyExposure();
  loadAll();
  // 自動更新（設定 autoRefreshMin 分ごと・タブ非表示/取得中はスキップ）
  const mins = Number(state.settings.autoRefreshMin) || 0;
  if (mins > 0) setInterval(() => { if (!document.hidden && !state.loading) loadAll({ force: true }); }, mins * 60000);
  // （キー未設定時の設定案内は loadAll 完了後に、ローカルかつ0件のときだけ行う）
}
boot();
