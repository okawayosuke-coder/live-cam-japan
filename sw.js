// ============================================================================
// sw.js ― Service Worker（ネットワーク優先）
// ----------------------------------------------------------------------------
// 方針: 常にネットワークから最新を取得し、オフライン時のみキャッシュを返す。
//       → コード更新が即反映され「古いキャッシュで動く」問題を起こさない。
// 対象: 同一オリジンのGETのみ。YouTube/Windy/地図タイル等の外部は素通し。
// ============================================================================
const CACHE = "lcj-shell-v4";
const SHELL = [
  "./", "./index.html", "./styles.css",
  "./app.js?v=4", "./config.js?v=4", "./sources.js?v=4",
  "./manifest.webmanifest", "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // 外部・非GETは素通し
  // ネットワーク優先（最新を取得）、失敗時のみキャッシュにフォールバック
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
