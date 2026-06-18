// ============================================================================
// app.js  ―  統合・描画・地図・ライブ判定
// ============================================================================
import { REGIONS, CATEGORIES, loadSettings, saveSettings } from "./config.js?v=5";
import { fetchYouTube, fetchWindy, fetchDirect, probeImage } from "./sources.js?v=5";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const CARDS_PER_PAGE = 60; // 一覧の初期表示件数（「もっと見る」で追加）

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

const SOURCE_LABEL = { youtube: "YouTube", windy: "Windy", direct: "直リンク" };
const STATUS_META = {
  live:       { label: "稼働中",   cls: "ok",   color: "#22c55e" },
  reported:   { label: "稼働(報告)", cls: "rep",  color: "#14b8a6" },
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

function markerIcon(status, approx) {
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
  const res = await fetch("./data/catalog.json", { cache: "no-store" });
  if (!res.ok) throw new Error("no catalog");
  const data = await res.json();
  state.catalogGeneratedAt = data.generatedAt || null;
  return (data.cameras || []).map(reviveDates);
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
  // キャッシュ命中（強制更新でなければ）
  if (!force) {
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
  const s = state.settings;
  const onError = (src, msg) => { state.errors[src] = msg; render(); };
  // 鍵なし = 公開モード → ビルド時生成の静的カタログを読む（クライアントにキー不要・クォータ消費なし）
  const deployed = !s.youtubeApiKey && !s.windyApiKey;
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
  writeCache(state.cameras);
  render();
  probeDirectImages();   // 直リンク画像を非同期に死活確認
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
  const okStatuses = state.settings.onlyWorking
    ? new Set(["live", "reported", "checking"])
    : new Set(["live", "reported", "checking", "unverified", "offline"]);
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

function statusRank(s) { return { live: 0, reported: 1, checking: 2, unverified: 3, offline: 4 }[s] ?? 9; }

function render() {
  const cams = visibleCameras().sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.title.localeCompare(b.title, "ja"));
  renderCards(cams);
  renderMarkers(cams);
  renderStats(cams);
}

function renderStats(cams) {
  const live = cams.filter((c) => c.status === "live").length;
  const rep = cams.filter((c) => c.status === "reported").length;
  const chk = cams.filter((c) => c.status === "checking").length;
  const total = state.cameras.length;
  let msg = (state.loading ? "取得中… " : "") +
    `表示 ${cams.length}件（稼働確定 ${live} / 稼働報告 ${rep}${chk ? " / 確認中 " + chk : ""}）・取得総数 ${total}`;
  if (state.cacheAge != null) msg += `・キャッシュ${state.cacheAge}分前（更新ボタンで再取得）`;
  if (state.catalogGeneratedAt) msg += `・公開データ ${relTime(state.catalogGeneratedAt)}生成`;
  const errs = Object.entries(state.errors).filter(([, m]) => m);
  if (errs.length) msg += " ｜ ⚠ " + errs.map(([s, m]) => `${SOURCE_LABEL[s]}: ${m}`).join(" / ");
  setStatusBar(msg);
}

function setStatusBar(text) { $("#statusbar").textContent = text; }

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
        <span class="srcchip s-${cam.source}">${SOURCE_LABEL[cam.source]}</span>
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
    grid.innerHTML = `<div class="empty">該当するカメラがありません。<br>設定でAPIキーを追加するか、「稼働中のみ」をオフにしてみてください。</div>`;
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
  for (const cam of cams) {
    if (cam.lat == null || cam.lng == null) continue;
    let lat = cam.lat, lng = cam.lng;
    if (cam.approxLocation) { const [dy, dx] = approxJitter(cam.id); lat += dy; lng += dx; }
    const m = L.marker([lat, lng], { icon: markerIcon(cam.status, cam.approxLocation), title: cam.title + (cam.approxLocation ? "（推定位置）" : "") });
    m.on("click", () => openModal(cam.id));
    m.addTo(state.layer);
    state.markers.set(cam.id, m);
  }
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
    <a class="btn primary" href="${escapeAttr(cam.detailUrl)}" target="_blank" rel="noopener">▶ YouTubeで見る ↗</a>
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
  } else if (cam.embedUrl) {
    player = `<iframe class="player" src="${escapeAttr(cam.embedUrl)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  } else {
    player = `<div class="player noimg">埋め込み不可。下のリンクから開いてください。</div>`;
  }
  $("#modalTitle").textContent = cam.title;
  const faved = isFav(cam.id);
  body.innerHTML = `
    <div class="playerwrap">${player}</div>
    <div class="modalmeta">
      <span class="badge ${sm.cls}">${sm.label}</span>
      <span class="srcchip s-${cam.source}">${SOURCE_LABEL[cam.source]}</span>
      <button id="modalFav" class="favbtn inline${faved ? " on" : ""}" aria-label="お気に入り" aria-pressed="${faved}">${faved ? "★ お気に入り" : "☆ お気に入り"}</button>
      ${cam.place ? `<span class="mplace">${escapeHtml(cam.place)}</span>` : ""}
      ${cam.note ? `<span class="mnote">${escapeHtml(cam.note)}</span>` : ""}
      ${cam.source === "windy" && cam.lastChecked ? `<span class="mnote">🕒 更新 ${relTime(cam.lastChecked)}</span>` : ""}
      ${cam.approxLocation ? `<span class="mnote">📍 地図上の位置は名称からの推定です</span>` : ""}
      ${cam.detailUrl ? `<a class="ext" href="${escapeAttr(cam.detailUrl)}" target="_blank" rel="noopener">元ページを開く ↗</a>` : ""}
    </div>`;
  $("#modal").classList.add("open");
  const mf = $("#modalFav");
  if (mf) mf.addEventListener("click", () => {
    toggleFav(cam.id);
    const on = isFav(cam.id);
    mf.classList.toggle("on", on);
    mf.setAttribute("aria-pressed", String(on));
    mf.textContent = on ? "★ お気に入り" : "☆ お気に入り";
  });
  if (initYt) initYtPlayer(cam);
  // 直リンク画像は数秒ごとに更新
  if (cam.embedType === "image") {
    const img = $("#liveImg");
    state._imgTimer = setInterval(() => {
      const base = cam.imageUrl.split("?")[0];
      const q = cam.imageUrl.includes("?") ? cam.imageUrl.split("?")[1] + "&" : "";
      img.src = `${base}?${q}_lcj=${Date.now()}`;
    }, 5000);
  }
}
function closeModal() {
  $("#modal").classList.remove("open");
  destroyYtPlayer();
  $("#modalBody").innerHTML = "";
  if (state._imgTimer) { clearInterval(state._imgTimer); state._imgTimer = null; }
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
  $("#settings").classList.add("open");
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
  $("#settings").classList.remove("open");
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
  $("#settingsClose").addEventListener("click", () => $("#settings").classList.remove("open"));
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("#settings").classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); $("#settings").classList.remove("open"); } });
  // グリッドのクリック委譲: お気に入り / もっと見る / カード
  $("#grid").addEventListener("click", (e) => {
    const fav = e.target.closest(".favbtn");
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); render(); return; }
    if (e.target.closest("#moreBtn")) { state.visibleLimit += CARDS_PER_PAGE; render(); return; }
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

// 公開ドメインで動いている場合、ブラウザにAPIキーが露出する旨を警告
function maybeWarnKeyExposure() {
  const host = location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "" || host === "::1";
  const el = $("#keywarn");
  if (el && !isLocal && (state.settings.youtubeApiKey || state.settings.windyApiKey)) el.hidden = false;
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
  // 初回でキー未設定なら設定を促す
  if (!state.settings.youtubeApiKey && !state.settings.windyApiKey) {
    setTimeout(() => { if (!state.cameras.length) openSettings(); }, 800);
  }
}
boot();
