#!/usr/bin/env node
// ============================================================================
// fetch-windy.mjs ― Windy Webcams API v3 から全国のWebカメラを取得して
//                    ../data/windy.json を生成する（ブラウザのCORS回避用）。
//
// 使い方:
//   export WINDY_API_KEY=あなたのキー
//   node tools/fetch-windy.mjs
//   （または）  node tools/fetch-windy.mjs <APIKEY>
//
// Node 18+ （グローバル fetch を使用）。サーバー不要・1回叩いてjsonを更新するだけ。
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGIONS } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "windy.json");
const BASE = "https://api.windy.com/webcams/api/v3/webcams";
const KEY = process.env.WINDY_API_KEY || process.argv[2];

if (!KEY) {
  console.error("✗ APIキーがありません。 export WINDY_API_KEY=... か 引数で渡してください。");
  console.error("  キー取得: https://api.windy.com/keys");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRegion(r) {
  const found = [];
  // limitは最大50。offsetでページング（最大5ページ=250件/地方）
  for (let offset = 0; offset < 250; offset += 50) {
    const usp = new URLSearchParams({
      bbox: `${r.n},${r.e},${r.s},${r.w}`, // N,E,S,W
      include: "categories,images,location,player,urls",
      limit: "50",
      offset: String(offset),
    });
    const res = await fetch(`${BASE}?${usp}`, { headers: { "x-windy-api-key": KEY } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${r.name}: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const cams = data.webcams || [];
    found.push(...cams);
    if (cams.length < 50) break; // これ以上ない
    await sleep(250); // レート配慮
  }
  return found;
}

async function main() {
  console.log(`Windy Webcams 取得開始（${REGIONS.length}地方）…`);
  const byId = new Map();
  for (const r of REGIONS) {
    try {
      const cams = await fetchRegion(r);
      let active = 0;
      for (const w of cams) {
        if ((w.status || "").toLowerCase() !== "active") continue; // 稼働中のみ
        if (!byId.has(w.webcamId)) byId.set(w.webcamId, w);
        active++;
      }
      console.log(`  ${r.name}: ${cams.length}件取得 / 稼働 ${active}件`);
    } catch (e) {
      console.warn(`  ⚠ ${r.name} スキップ: ${e.message}`);
    }
    await sleep(300);
  }
  const webcams = [...byId.values()];
  const payload = { generatedAt: new Date().toISOString(), count: webcams.length, webcams };
  await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✓ ${webcams.length}件を ${OUT} に保存しました。`);
}

main().catch((e) => { console.error("✗ 失敗:", e.message); process.exit(1); });
