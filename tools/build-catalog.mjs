#!/usr/bin/env node
// ============================================================================
// build-catalog.mjs ― 公開用カメラ一覧（静的JSON）をビルド時に生成する
// ----------------------------------------------------------------------------
// CI（GitHub Actions）で APIキー(Secret) を使い、YouTube/Windy のカメラを取得して
// data/catalog.json を出力する。公開サイトの訪問者はこのJSONを読むだけ＝
// クライアントにキーを置かない／訪問者ごとのAPI消費ゼロ。
//
//   YOUTUBE_API_KEY=xxx WINDY_API_KEY=yyy node tools/build-catalog.mjs
//
// クォータ安全設計: プレイリスト(1ユニット/ページ)中心＋検索は少数(16×100)。
//   564再生リスト×最大2ページ＋videos.list＋検索 ≈ 2,700ユニット/回。
//   8時間ごと(3回/日)で ≈ 8,100/日（無料枠1万/日内・要監視。超過時は空カタログ保護で既存維持）。
// 一時障害(YouTube側5xx/backendError・通信タイムアウト)は再試行し、それでも駄目な分だけ飛ばす（ビルド全体は落とさない）。
// Node 18+（グローバル fetch）。
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGIONS, regionOf, regionBoxes, DEFAULT_PLAYLISTS } from "../config.js";
import { guessRegion, guessCategory, geocodeTitle } from "../geo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "catalog.json");

const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const WINDY_KEY = process.env.WINDY_API_KEY || "";

// --- ビルド設定（クォータに合わせて調整可） ---
// 再生リストは config.js の DEFAULT_PLAYLISTS を単一ソースとして共有（クライアントと一致）。
// 564件＝全国網羅（北海道→沖縄＋河川防災/空港港湾/観光/サーフ）。
const PLAYLISTS = DEFAULT_PLAYLISTS;
// 検索は100ユニット/回と高価。チャンネル群(564)が地域網羅を担うので、検索は
// 新規/未登録カメラの発見用に少数の広域クエリのみ（16クエリ×100=1,600ユニット）。
const SEARCH_QUERIES = [
  "ライブカメラ", "富士山 ライブ", "海 ライブカメラ", "空港 ライブカメラ",
  "河川 ライブカメラ", "道路 ライブカメラ", "サーフ ライブカメラ", "live camera japan",
  // 追加（現在ライブ中カメラを全ch横断で拾う・カテゴリ網羅）
  "湖 ライブカメラ", "温泉 ライブカメラ", "商店街 ライブカメラ", "展望台 ライブカメラ",
  "駅 ライブカメラ", "港 ライブカメラ", "夜景 ライブカメラ", "城 ライブカメラ",
];
const PLAYLIST_PAGES = 2; // 1プレイリストあたり最大ページ数（50件/ページ）。500本超に拡大したためクォータ配慮で2ページ（発掘時も2ページで実効確認済み）

// 検索が拾うノイズの除外。
// ・EXCLUDE_CHANNELS: 海外カメラ/機種デモ/店内/地震速報専用 等（そのチャンネルに正規の地点カメラが無いものだけ）。
// ・EXCLUDE_TITLE_RX: ニュース番組の常時配信。局名では消さない（同じ局の空港/街カメラを残すため）タイトルで判定。
const EXCLUDE_CHANNELS = new Set([
  // 海外（日本サイトに不要・検索流入）
  "Bristol Parks and Recreation- Maine","Deerfield Beach Live","Luxury Island","Surfline","Surfers Warehouse",
  "Waves of the World","The Hale Pau Hana","Titahi Bay Surf Cam","afarTV","Ozolio Live","911 Surf Report",
  "Amazing Taitung 台東就醬玩","The Surfers View","NJ Beach Cams","Scarborough Beach","AlohaLiveCam",
  "Venice Vive","Boston and Maine Live","Waikiki Aquarium",
  // カメラ機種デモ・総集編巡回・店内/ペット（特定地点でない）
  "Digital Eye Field Lab CTS","Armchair Traveler","Earth Now","もふもふペットCafe","ウミネコ商店",
  // 地震速報専用（カメラではない）
  "株式会社ティーファイブプロジェクト","JDQ-地震情報",
]);
const EXCLUDE_TITLE_RX = /ニュースまとめ|昼のニュース|24H ?NEWS|NEWS LIVE NOW|Japan News Digest|緊急地震速報|地震速報ライブ|WORLD-JAPAN News|最新ニュース|コミックマーケット|待機列/i;

// ===== YouTube =====
const YT = "https://www.googleapis.com/youtube/v3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FETCH_TIMEOUT_MS = 20000; // 応答が無い通信でジョブが止まり続けないように
// 一時障害とみなして再試行する理由（2026-10 に backendError 1回でビルド全体が落ちる失敗が4回発生）
const YT_TRANSIENT = new Set(["backendError", "internalError", "serviceUnavailable", "network"]);
async function ytJson(path, params, tries = 3) {
  const usp = new URLSearchParams({ ...params, key: YT_KEY });
  for (let attempt = 1; ; attempt++) {
    let e;
    try {
      const res = await fetch(`${YT}/${path}?${usp}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.ok) return await res.json(); // 本文の途中切れ等も catch 側で通信エラー扱い→再試行
      let r=`${res.status}`; try { const j=await res.json(); r=j?.error?.errors?.[0]?.reason||r; } catch {}
      e=new Error(`YT ${path}: ${r}`); e.reason=r; e.status=res.status;
    } catch (x) {
      e=new Error(`YT ${path}: ${x.name==="TimeoutError"?"timeout":x.message}`); e.reason="network";
    }
    const transient = YT_TRANSIENT.has(e.reason) || e.status >= 500;
    if (!transient || attempt >= tries) throw e;
    console.warn(`  ${e.message} → ${attempt}回目失敗、再試行`);
    await sleep(1000 * 2 ** (attempt - 1)); // 1秒, 2秒
  }
}
async function ytPlaylistIds(pid) {
  const ids=[]; let token="";
  for (let p=0;p<PLAYLIST_PAGES;p++){ const d=await ytJson("playlistItems",{part:"contentDetails",maxResults:"50",playlistId:pid,...(token?{pageToken:token}:{})}); for (const it of d.items||[]) if (it?.contentDetails?.videoId) ids.push(it.contentDetails.videoId); token=d.nextPageToken||""; if(!token)break; }
  return ids;
}
async function ytSearchIds(q) {
  const d=await ytJson("search",{part:"snippet",type:"video",eventType:"live",regionCode:"JP",relevanceLanguage:"ja",maxResults:"50",q});
  return (d.items||[]).map(i=>i?.id?.videoId).filter(Boolean);
}
let quotaHit = false; // YouTube日次クォータ/レート超過の検知。超過時は不完全なカタログで既存を上書きしない。
let ytSkipped = 0;    // 再試行しても取れず飛ばした videos.list の回数（50件単位）。不完全さの判定に quotaHit と併用。
async function ytVideosLive(ids) {
  const cams=[];
  for (let i=0;i<ids.length;i+=50){
    let d;
    try { d=await ytJson("videos",{part:"snippet,status,liveStreamingDetails",id:ids.slice(i,i+50).join(",")}); }
    catch(e){
      if(e.reason==="quotaExceeded"||e.reason==="rateLimitExceeded"){ quotaHit=true; console.warn("  videos.list クォータ超過→以降スキップ"); break; }
      ytSkipped++; console.warn(`  videos.list ${i}〜${i+49}件目を飛ばす（${e.message}）`); continue; // 1回の障害でビルド全体を落とさない
    }
    for (const v of d.items||[]) {
      if (v?.snippet?.liveBroadcastContent!=="live") continue;
      const sn=v.snippet, title=sn.title||"(無題)";
      if (EXCLUDE_CHANNELS.has(sn.channelTitle) || EXCLUDE_TITLE_RX.test(title)) continue; // 海外/ニュース/非カメラ除外
      // 地名推定は title＋channelTitle のみ（descriptionは他カメラ一覧を列挙しがちで誤マッチの元）
      const text=`${title} ${sn.channelTitle||""}`;
      const guessed=guessRegion(text), geo=geocodeTitle(text,guessed);
      const region = geo ? (regionOf(geo.lat,geo.lng)||guessed) : guessed;
      // 地域不明かつタイトルに日本語が無い＝海外カメラとみなし除外（ハワイ/米/NZ等のサーフ配信対策）。
      // 日本語タイトルや地名一致(region!=null)のカメラは残す。
      if (region == null && !/[぀-ヿ一-鿿ー]/.test(title)) continue;
      const viewers=v?.liveStreamingDetails?.concurrentViewers;
      cams.push({
        id:`yt:${v.id}`, source:"youtube", title, place:sn.channelTitle||"",
        region,
        category: guessCategory(text), lat: geo?.lat??null, lng: geo?.lng??null, approxLocation:!!geo,
        embeddable: v?.status?.embeddable!==false, embedType:"iframe",
        embedUrl:`https://www.youtube.com/embed/${v.id}?autoplay=1&mute=1&playsinline=1`,
        imageUrl:null, thumbUrl: sn.thumbnails?.medium?.url||sn.thumbnails?.high?.url||sn.thumbnails?.default?.url||null,
        detailUrl:`https://www.youtube.com/watch?v=${v.id}`, status:"live",
        note: viewers?`ライブ中・視聴 ${Number(viewers).toLocaleString()}人`:"ライブ配信中", lastChecked:new Date().toISOString(),
      });
    }
  }
  return cams;
}
async function fetchYouTube() {
  if (!YT_KEY) { console.warn("  (YOUTUBE_API_KEY未設定→YouTubeスキップ)"); return []; }
  const idSet=new Set();
  for (const pid of PLAYLISTS) {
    // playlistNotFound は実在する再生リストでも断続的に返る（2026-10 の調査で6件中4件が後で実在）→少し待って1回だけ再試行
    for (let t=0;t<2;t++) {
      try { (await ytPlaylistIds(pid)).forEach(id=>idSet.add(id)); break; }
      catch(e){
        if(e.reason==="playlistNotFound"&&t===0){ await sleep(2000); continue; }
        console.warn("  playlist失敗",pid,e.message); if(e.reason==="quotaExceeded"||e.reason==="rateLimitExceeded")quotaHit=true; break;
      }
    }
  }
  for (const q of SEARCH_QUERIES) { try { (await ytSearchIds(q)).forEach(id=>idSet.add(id)); } catch(e){ console.warn("  search失敗",q,e.message); if(e.reason==="quotaExceeded"||e.reason==="rateLimitExceeded"){quotaHit=true;break;} } }
  const cams=await ytVideosLive([...idSet]);
  console.log(`  YouTube: ライブ ${cams.length}件`);
  return cams;
}

// ===== Windy =====
const WINDY = "https://api.windy.com/webcams/api/v3/webcams";
function windyCategory(cats=[]) { const ids=cats.map(c=>typeof c==="string"?c:c.id||"").join(" ").toLowerCase(); if(/(beach|harbor|harbour|sea|coast|island|bay|port)/.test(ids))return "coast"; if(/(mountain|ski|lake|forest|nature|volcano)/.test(ids))return "mountain"; if(/(traffic|highway|road)/.test(ids))return "road"; if(/(city|square|town|landmark|building)/.test(ids))return "city"; if(/(weather|sky)/.test(ids))return "weather"; if(/(river|dam)/.test(ids))return "river"; return "scenery"; }
function windyToCamera(w) {
  const loc=w.location||{}, lat=loc.latitude??null, lng=loc.longitude??null, player=w.player||{}, hasLive=!!player.live;
  // 「active」申告でも画像が2日以上更新されていないものは実質停止（2026-10に申告active・画像は1週間前のカメラを確認）。
  // 平常時のビルドでは全件が24時間以内の更新だったので、48時間なら正常なカメラは落とさない。
  const stale=w.lastUpdatedOn && Date.now()-new Date(w.lastUpdatedOn).getTime()>48*3600e3;
  const imgs=w.images||{}, active=(w.status||"").toLowerCase()==="active" && !stale;
  const place=[loc.city,loc.region,loc.country].filter(Boolean).join(", ");
  const updated=w.lastUpdatedOn?"・更新 "+new Date(w.lastUpdatedOn).toLocaleString("ja-JP"):"";
  return {
    id:`windy:${w.webcamId}`, source:"windy", title:w.title||place||`Webcam ${w.webcamId}`, place,
    region: regionOf(lat,lng), category: windyCategory(w.categories), lat, lng, hasLive, embedType:"iframe",
    embedUrl: player.live||player.day||player.month||(w.webcamId?`https://webcams.windy.com/webcams/public/embed/player/${w.webcamId}/day`:null),
    imageUrl: imgs.current?.preview||null, thumbUrl: imgs.current?.preview||imgs.current?.thumbnail||imgs.daylight?.preview||null,
    detailUrl: w.urls?.detail||(w.webcamId?`https://www.windy.com/webcams/${w.webcamId}`:null),
    status: active?(hasLive?"live":"reported"):"offline",
    note: active?(hasLive?`Windy: ライブ配信${updated}`:`Windy: 稼働中（静止画/タイムラプス）${updated}`):"Windy: 停止中",
    lastChecked: w.lastUpdatedOn||null,
  };
}
async function fetchWindy() {
  if (!WINDY_KEY) { console.warn("  (WINDY_API_KEY未設定→Windyスキップ)"); return []; }
  const byId=new Map();
  // 地方ごとの矩形＋飛び地（伊勢志摩など）を順に取得。重複は byId で除く。
  for (const r of REGIONS.flatMap((g)=>regionBoxes(g).map((b)=>({...b,name:g.name})))) {
    for (let offset=0;offset<500;offset+=50) { // 2026-10時点の最大は中部400件＝上限500で取りこぼしなし
      const usp=new URLSearchParams({bbox:`${r.n},${r.e},${r.s},${r.w}`,include:"categories,images,location,player,urls",limit:"50",offset:String(offset)});
      let data;
      try {
        const res=await fetch(`${WINDY}?${usp}`,{headers:{"x-windy-api-key":WINDY_KEY},signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
        if (!res.ok) { console.warn(`  Windy ${r.name} HTTP ${res.status}`); break; }
        data=await res.json();
      } catch(e){ console.warn(`  Windy ${r.name} 通信失敗（${e.name==="TimeoutError"?"timeout":e.message}）→この地方の残りを飛ばす`); break; } // 例外でビルド全体を落とさない
      const list=data.webcams||[];
      for (const w of list) { const c=windyToCamera(w); if (c.status!=="offline" && !byId.has(c.id)) byId.set(c.id,c); }
      if (list.length<50) break;
      await new Promise(x=>setTimeout(x,200));
    }
  }
  console.log(`  Windy: 稼働 ${byId.size}件`);
  return [...byId.values()];
}

// 公開中のカタログ（前回ビルド結果）を取得。クォータ超過時のフォールバック用。
const DEPLOYED_URL = "https://okawayosuke-coder.github.io/live-cam-japan/data/catalog.json";
async function fetchDeployedCatalog() {
  try {
    const res = await fetch(`${DEPLOYED_URL}?cb=${Date.now()}`);
    if (!res.ok) return null;
    const d = await res.json();
    return Array.isArray(d.cameras) ? d.cameras : null;
  } catch { return null; }
}
// カメラの title/place から座標・地域を現在の geo.js で再計算（辞書更新を反映）。
function regeocode(c) {
  const text = `${c.title} ${c.place || ""}`;
  const guessed = guessRegion(text);
  const geo = geocodeTitle(text, guessed);
  const region = geo ? (regionOf(geo.lat, geo.lng) || guessed) : guessed;
  return { ...c, lat: geo?.lat ?? null, lng: geo?.lng ?? null, approxLocation: !!geo, region };
}

async function main() {
  console.log("公開用カタログを生成中…");
  const [yt, windy] = await Promise.all([fetchYouTube(), fetchWindy()]);
  const byId=new Map();
  for (const c of [...yt, ...windy]) if (!byId.has(c.id)) byId.set(c.id, c);
  let cameras=[...byId.values()];

  // 通常は総数≈2,500件。クォータ超過/障害でYouTubeがほぼ0に落ちるとWindy(~1,200)のみでFLOORを下回る。
  const FLOOR = 2000;
  // YouTube取得が不完全か（日次クォータ超過、または再試行しても取れず飛ばした分がある）
  const ytIncomplete = quotaHit || ytSkipped > 0;
  if (ytSkipped) console.warn(`⚠ videos.list を ${ytSkipped}回分（最大${ytSkipped*50}件）飛ばした`);

  // フォールバック: YouTubeが大きく欠けた場合、公開中カタログのカメラを
  // 現在の geo.js で再ジオコーディングして再利用する（新鮮なWindyは今回分を使用）。
  // これで①サイトがWindyのみに転落しない ②geo.jsの辞書修正(座標是正)はクォータ枯渇中でも反映される。
  // 再利用分の lastChecked は元のまま残る＝画面側で「最終確認から24時間超」を要確認として表示できる。
  if (ytIncomplete && cameras.length < FLOOR) {
    const prev = await fetchDeployedCatalog();
    if (prev && prev.length) {
      const prevYt = prev.filter((c) => c.source === "youtube").map(regeocode);
      const merged = new Map();
      // 今回取れたYouTube(最新のライブ判定)を優先し、欠けた分だけ前回分で補う
      for (const c of [...yt, ...prevYt, ...windy]) if (c && !merged.has(c.id)) merged.set(c.id, c);
      const fb = [...merged.values()];
      if (fb.length > cameras.length) {
        console.warn(`⚠ YouTube取得が不完全→今回のYouTube ${yt.length}件に、公開中カタログのYouTube ${prevYt.length}件(再ジオコーディング済み)で欠けを補う（+今回Windy ${windy.length}件）`);
        cameras = fb;
      }
    }
  }
  // 既存カタログ保護: 0件、またはフォールバックでも回復できず不完全(<FLOOR)なら
  // デプロイせず exit1 で中止（deploy.yml の後続 upload/deploy をスキップ＝直前の公開カタログを維持）。
  if (!cameras.length || (ytIncomplete && cameras.length < FLOOR)) {
    console.error(`✗ ${!cameras.length ? "生成0件" : `YouTube取得が不完全(${cameras.length}件<${FLOOR})`}。既存カタログ保護のためデプロイ中止。`);
    process.exit(1);
  }
  if (ytIncomplete) console.warn(`⚠ YouTube取得が不完全だが${cameras.length}件確保→デプロイ続行`);
  const payload={ generatedAt:new Date().toISOString(), count:cameras.length, cameras };
  await writeFile(OUT, JSON.stringify(payload), "utf8");
  console.log(`✓ ${cameras.length}件を ${OUT} に出力`);
}
main().catch(e=>{ console.error("✗ 失敗:", e.message); process.exit(1); });
