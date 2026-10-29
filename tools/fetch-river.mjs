#!/usr/bin/env node
// ============================================================================
// fetch-river.mjs ― 国交省「川の防災情報」の公開JSONから全国の河川カメラを取得して
//                   ../data/cameras.json の cameras[] を作り直す（APIキー不要）。
//
// 使い方:
//   node tools/fetch-river.mjs            （data/cameras.json を更新）
//   node tools/fetch-river.mjs <出力先>    （別ファイルに書く・動作確認用。既存内容は出力先から読む）
//
// 出典: 川の防災情報（国土交通省） https://www.river.go.jp/
//   都道府県一覧  map/pref/prefarea.json（prefCd。北海道は地域別に複数あり計51）
//   カメラ一覧    obslist/twninfo/obs/scam/{prefCd}.json → prefTwn[].scam[]（静止画）と .cctv[]
//   各カメラに 実測座標 lat/lon・管理者 ownName・河川名 rvrNm・画像 currProvUrl（cam.river.go.jp）。
// 座標は観測所の実測値なので approxLocation=false（地図の実線ピン）。
// 画像は約10分ごと更新・ホットリンク可。1万件規模のためクライアントの死活プローブは省略し
// status:"reported"（読めない画像は一覧で自動的に隠れる）。
// ただし停止中のカメラも HTTP 200 で「カメラ画像が取得できませんでした。」の代替画像(PNG)を返すため
// （2026-10-29 の全件確認で 11,321件中483件）、全件を HEAD で確認し、PNG のものは status:"offline" にする。
// CI（deploy.yml）でもビルドごとに実行し、配信物の cameras.json を最新化する（失敗時はこのファイルを配信）。
//
// 安全策: 1地域でも一覧の取得に失敗したら書き込まない（cameras.json を部分データで上書きしない）。
// cameras.json の _readme/_schema 等の説明部分と、手で追加したカメラ（id が kawabou- 以外）は保持し、
// 河川カメラ（kawabou-*）だけを置き換える。
// 出力は1カメラ1行（差分が読めるように）。Node 18+（グローバル fetch）。
// ============================================================================
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, "..", "data", "cameras.json");
const BASE = "https://www.river.go.jp/kawabou/file/files";
const SITE = "https://www.river.go.jp/";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (live-cam-japan)" }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null; // 呼び出し側で「親地域なら正常／それ以外は失敗」を判定
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= tries) throw new Error(`${url}: ${e.message}`);
      await sleep(1000 * attempt);
    }
  }
}

// 日本の範囲外（座標の入力ミス等）は地図に出さない
const inJapan = (lat, lon) => lat > 20 && lat < 46.5 && lon > 122 && lon < 154.5;

function toCamera(c) {
  const name = String(c.name || "").trim();
  const river = String(c.rvrNm || c.rsysNm || "").trim();
  const own = String(c.ownName || "").trim();
  const title = (name + (river && !name.includes(river) ? `（${river}）` : "")).slice(0, 56);
  return {
    id: `kawabou-${c.scamId}`,
    title: title || `河川カメラ ${c.scamId}`,
    place: `${own}（川の防災情報）`,
    category: "river",
    lat: Math.round(c.lat * 1e5) / 1e5,
    lng: Math.round(c.lon * 1e5) / 1e5,
    approxLocation: false,
    embedType: "image",
    imageUrl: c.currProvUrl,
    detailUrl: SITE,
    credit: `${own}／川の防災情報（国土交通省）`,
    sourceUrl: SITE,
    status: "reported",
  };
}

// 画像を HEAD で全件確認（本文は取らない）。代替画像(PNG)のカメラは停止扱いにする。
// 通信エラーで確認できなかったものは従来どおり "reported" のまま（停止と断定しない）。
// 提供元への負荷は「1秒あたりの件数」で決まるので、同時8本で往復の遅さを隠しつつ全体を毎秒30件までに抑える
// （1.1万件で約6分半。国内からでも米国のCIからでもほぼ同じ時間・同じ負荷）。
const CHECK_PER_SEC = 30;
async function markUnavailable(cameras) {
  let i = 0, off = 0, unknown = 0, nextSlot = Date.now();
  const sizes = new Map();
  // 時間の上限（提供元が遅い等で終わらないと、CIのデプロイが止まる）。
  // 超えた分は確認不能として数える＝多ければ下の2割ルールで書き込み中止→取得済みデータを配信。
  const deadline = Date.now() + Number(process.env.RIVER_CHECK_BUDGET_MS || 12 * 60 * 1000);
  async function worker() {
    while (i < cameras.length) {
      if (Date.now() > deadline) { unknown += cameras.length - i; i = cameras.length; break; }
      const c = cameras[i++];
      const slot = Math.max(Date.now(), nextSlot); // 全ワーカー共通の発射時刻枠（毎秒 CHECK_PER_SEC 件）
      nextSlot = slot + 1000 / CHECK_PER_SEC;
      if (slot > Date.now()) await sleep(slot - Date.now());
      try {
        const res = await fetch(c.imageUrl, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0 (live-cam-japan)" }, signal: AbortSignal.timeout(15000) });
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.includes("png")) { // 停止と断定するのは代替画像が返ったときだけ
          c.status = "offline";
          c.note = "提供元で画像が取得できない状態（カメラ停止・保守中の可能性）";
          off++;
          const len = res.headers.get("content-length"); sizes.set(len, (sizes.get(len) || 0) + 1);
        } else if (!res.ok) unknown++; // 一時的な5xxやアクセス制限は停止と区別できないので据え置き
      } catch (_) { unknown++; }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  // 代替画像は 30685 バイト固定だった。違うサイズの PNG が出たら仕様変更の可能性があるので知らせる
  const odd = [...sizes].filter(([len]) => len !== "30685");
  console.log(`  画像確認: 停止(代替画像) ${off}件・確認できず ${unknown}件` + (odd.length ? `・⚠ 想定外サイズのPNG ${JSON.stringify(odd)}` : ""));
  return { off, unknown };
}

async function main() {
  const { prefs } = (await getJson(`${BASE}/map/pref/prefarea.json`)) || {};
  if (!prefs?.length) throw new Error("都道府県一覧(prefarea.json)を取得できません");
  const codes = [...new Set(prefs.map((p) => p.prefCd))].sort((a, b) => a - b);
  const prefName = new Map(prefs.map((p) => [p.prefCd, p.altPrefNm || p.prefNm]));
  // 範囲(minLat)を持たない地域は下位地域を束ねる親（2026-10時点で北海道101のみ）＝カメラ一覧ファイルが無いのが正常
  const umbrella = new Set(prefs.filter((p) => p.minLat == null).map((p) => p.prefCd));
  console.log(`川の防災情報: ${codes.length}地域から取得…`);

  const byId = new Map();
  const failed = [];
  let outside = 0;
  for (const cd of codes) {
    try {
      const d = await getJson(`${BASE}/obslist/twninfo/obs/scam/${cd}.json`);
      if (!d && umbrella.has(cd)) { console.log(`  ${prefName.get(cd)}(${cd}): 親地域のため一覧なし（下位地域で取得）`); continue; }
      if (!d) throw new Error("HTTP 404（カメラ一覧が見つからない）");
      let n = 0;
      for (const twn of d.prefTwn || []) {
        for (const c of [...(twn.scam || []), ...(twn.cctv || [])]) {
          if (!c.scamId || !c.currProvUrl || c.lat == null || c.lon == null) continue;
          if (!inJapan(c.lat, c.lon)) { outside++; continue; }
          if (byId.has(c.scamId)) continue; // 地域の境界で重複掲載されるカメラがある
          byId.set(c.scamId, toCamera(c));
          n++;
        }
      }
      console.log(`  ${prefName.get(cd)}(${cd}): ${n}件`);
    } catch (e) {
      failed.push(cd);
      console.warn(`  ⚠ ${prefName.get(cd)}(${cd}) 取得失敗: ${e.message}`);
    }
    await sleep(150); // 提供元への配慮
  }
  if (failed.length) {
    console.error(`✗ ${failed.length}地域が取得できなかったため cameras.json は更新しません（${failed.join(", ")}）。時間をおいて再実行してください。`);
    process.exit(1);
  }

  const cameras = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const { off, unknown } = await markUnavailable(cameras);
  // 平常時の停止は約4%。2割を超える停止/確認不能は提供元の障害や接続制限を疑い、書き込まない（全カメラが消える事故を防ぐ）
  if (off + unknown > cameras.length * 0.2) {
    console.error(`✗ 停止 ${off}件＋確認不能 ${unknown}件が全体の2割超。異常とみなし cameras.json は更新しません。`);
    process.exit(1);
  }
  const { cameras: _old, ...head } = JSON.parse(await readFile(OUT, "utf8"));
  // 手で追加したカメラ（id が kawabou- 以外）はそのまま残し、河川カメラだけを入れ替える
  const manual = (_old || []).filter((c) => !String(c.id || "").startsWith("kawabou-"));
  const all = [...manual, ...cameras];
  head.generatedAt = new Date().toISOString();
  head.count = all.length;
  // 1カメラ1行で書き出す（JSON.stringify(head,null,2) の末尾 "\n}" を外して cameras を続ける）
  const text = `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "cameras": [\n` +
    all.map((c) => "    " + JSON.stringify(c)).join(",\n") + "\n  ]\n}\n";
  JSON.parse(text); // 壊れたJSONを書かない
  await writeFile(OUT, text, "utf8");
  console.log(`✓ 河川 ${cameras.length}件（うち停止 ${off}件）＋手動登録 ${manual.length}件を ${OUT} に保存（範囲外座標の除外 ${outside}件・前回 ${_old?.length ?? 0}件）`);
}

main().catch((e) => { console.error("✗ 失敗:", e.message); process.exit(1); });
