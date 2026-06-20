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
// クォータ安全設計: プレイリスト(1ユニット/回)中心＋検索は少数。
//   既定で 約600ユニット/回 → 3時間ごと実行でも1日5千程度（無料枠1万/日内）。
// Node 18+（グローバル fetch）。
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGIONS, regionOf } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "catalog.json");

const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const WINDY_KEY = process.env.WINDY_API_KEY || "";

// --- ビルド設定（クォータに合わせて調整可） ---
const PLAYLISTS = [
  "PLM7jIABwhUkb41KUDAke1x8I0FmTL5Z4s", // 日本全国のライブカメラ
  "UUqdejTsUrCvZ55Y8u9v5h9w",           // 東京都 伊豆・小笠原諸島 港湾ライブカメラ
  "UUEDn0tLxpVqEvI3NJyE2DRA",           // 波のスケッチ（鴨川/外房サーフ）
  "UUY88ELMjnfMyOYMUw5K9o3g",           // 犬吠埼テラス（銚子・24時間）
];
// 検索は100ユニット/回と高価なので少数に絞る（広く拾いたい代表クエリ）
const SEARCH_QUERIES = [
  "ライブカメラ", "富士山 ライブ", "海 ライブカメラ", "空港 ライブカメラ",
  "大島 ライブカメラ", "伊豆 小笠原 港湾 ライブカメラ", "防災 ライブカメラ", "live camera japan",
  // 自治体・官公庁系（河川・道路・防災カメラを拾う）
  "国土交通省 ライブカメラ", "市役所 ライブカメラ", "河川 ライブカメラ", "道路 ライブカメラ", "ダム ライブカメラ",
  // 房総・サーフ（外房の取りこぼし対策）。計15クエリ×100=1500ユニット/回×4回/日=6000<1万。
  "千葉 ライブカメラ", "サーフ ライブカメラ",
];
const PLAYLIST_PAGES = 4; // 1プレイリストあたり最大ページ数（50件/ページ）

// ===== 共通ロジック（sources.js のクライアント版と同等。Node安全に再実装） =====
const REGION_HINTS = [
  ["hokkaido", ["北海道","札幌","函館","旭川","釧路","知床","小樽"]],
  ["tohoku", ["東北","青森","秋田","岩手","山形","宮城","仙台","福島"]],
  ["kanto", ["東京","渋谷","新宿","横浜","千葉","埼玉","茨城","栃木","群馬","神奈川"]],
  ["chubu", ["富士","山梨","長野","新潟","名古屋","愛知","静岡","岐阜","金沢","石川","富山","福井"]],
  ["kinki", ["大阪","京都","神戸","兵庫","奈良","和歌山","滋賀","三重"]],
  ["chugoku", ["広島","岡山","山口","鳥取","島根"]],
  ["shikoku", ["高知","徳島","愛媛","香川","松山"]],
  ["kyushu", ["福岡","博多","熊本","長崎","鹿児島","宮崎","大分","佐賀","沖縄","那覇","石垣"]],
];
const CATEGORY_HINTS = [
  ["mountain", ["山","岳","高原","森","湖","滝","fuji"]],
  ["coast", ["海","港","ビーチ","浜","湾","島","漁港","beach","port","bay","ocean"]],
  ["river", ["川","河川","ダム","防災","水位","river","dam"]],
  ["road", ["道路","国道","交通","峠","高速","road","traffic"]],
  ["city", ["渋谷","新宿","繁華街","駅前","スクランブル","街","crossing","city"]],
  ["weather", ["空","天気","雲","夕日","朝日","星","sky","weather"]],
  ["scenery", ["観光","絶景","景観","temple","shrine","寺","神社","城"]],
];
const GAZETTEER = [
  // 空港（「成田」等の市名より先に判定）
  ["成田空港",35.765,140.386],["羽田空港",35.549,139.780],["羽田",35.549,139.780],
  ["中部空港",34.858,136.805],["セントレア",34.858,136.805],["関西空港",34.434,135.244],["関空",34.434,135.244],
  ["新千歳空港",42.775,141.692],["福岡空港",33.585,130.451],["那覇空港",26.196,127.646],["伊丹空港",34.785,135.438],
  ["宇部空港",33.930,131.279],["福島空港",37.227,140.431],
  ["元町港",34.750,139.360],["岡田港",34.794,139.391],["波浮港",34.692,139.428],
  ["伊豆大島",34.75,139.39],["三原山",34.724,139.394],
  ["利島",34.526,139.282],["新島",34.370,139.270],["式根島",34.323,139.214],
  ["神津島",34.205,139.137],["三宅島",34.075,139.510],["御蔵島",33.896,139.600],
  ["八丈島",33.113,139.789],["青ヶ島",32.457,139.767],
  ["父島",27.094,142.191],["母島",26.633,142.160],["小笠原",27.094,142.191],
  // 千葉・房総（外房=太平洋側。"千葉"より先に判定）
  ["勝浦",35.143,140.320],["鴨川",35.113,140.099],["一宮",35.371,140.382],["釣ヶ崎",35.371,140.382],
  ["御宿",35.190,140.350],["いすみ",35.254,140.385],["大原",35.252,140.390],["九十九里",35.546,140.430],
  ["銚子",35.735,140.827],["茂原",35.428,140.288],["館山",34.997,139.870],["南房総",34.99,139.84],
  ["富津",35.305,139.857],["木更津",35.376,139.917],["船橋",35.695,139.985],["成田",35.776,140.318],
  ["札幌",43.062,141.354],["函館",41.768,140.729],["旭川市",43.77,142.36],["釧路",42.98,144.38],
  ["知床",44.07,145.12],["小樽",43.19,140.99],["青森",40.824,140.74],["秋田",39.72,140.10],
  ["盛岡",39.70,141.15],["仙台",38.268,140.872],["山形",38.24,140.36],["福島",37.75,140.47],
  ["渋谷",35.659,139.700],["新宿",35.690,139.700],["スカイツリー",35.710,139.810],
  ["東京タワー",35.659,139.745],["お台場",35.627,139.776],["浅草",35.711,139.797],
  ["東京",35.681,139.767],["横浜",35.454,139.638],["鎌倉",35.319,139.546],["江ノ島",35.299,139.480],
  ["日光",36.720,139.698],["千葉",35.607,140.106],["箱根",35.232,139.107],
  ["富士山",35.45,138.77],["富士",35.45,138.77],["河口湖",35.517,138.764],["山中湖",35.418,138.868],
  ["上高地",36.25,137.63],["軽井沢",36.348,138.597],["草津",36.62,138.59],["名古屋",35.170,136.882],
  ["金沢",36.561,136.656],["新潟",37.916,139.036],["長野",36.651,138.181],["静岡",34.976,138.383],
  ["熱海",35.096,139.071],["伊豆",34.97,138.95],["富山",36.695,137.211],["福井",36.065,136.221],
  ["大阪",34.694,135.502],["京都",35.011,135.768],["神戸",34.690,135.196],["奈良",34.685,135.805],
  ["姫路",34.826,134.690],["和歌山",34.226,135.167],["広島",34.385,132.455],["岡山",34.656,133.919],
  ["山口",34.186,131.471],["鳥取",35.501,134.238],["島根",35.472,133.050],["出雲",35.367,132.755],
  ["高知",33.559,133.531],["松山",33.839,132.765],["徳島",34.066,134.559],["高松",34.342,134.047],
  ["福岡",33.590,130.401],["博多",33.590,130.420],["熊本",32.803,130.708],["阿蘇",32.884,131.104],
  ["長崎",32.750,129.877],["鹿児島",31.560,130.558],["宮崎",31.911,131.424],["大分",33.238,131.613],
  ["別府",33.279,131.500],["佐賀",33.249,130.299],["那覇",26.212,127.681],["沖縄",26.34,127.80],
  ["石垣",24.34,124.16],["宮古島",24.805,125.281],
];
const REGION_CENTER = { hokkaido:[43.4,142.8],tohoku:[39.3,140.6],kanto:[35.9,139.6],chubu:[36.2,137.6],kinki:[34.6,135.6],chugoku:[34.7,132.8],shikoku:[33.7,133.5],kyushu:[31.5,130.5] };

const guessRegion = (t="") => { t=t.toLowerCase(); for (const [id,w] of REGION_HINTS) if (w.some(x=>t.includes(x.toLowerCase()))) return id; return null; };
const guessCategory = (t="") => { t=t.toLowerCase(); for (const [id,w] of CATEGORY_HINTS) if (w.some(x=>t.includes(x.toLowerCase()))) return id; return "scenery"; };
function geocodeTitle(text="", regionId=null) {
  for (const [name,lat,lng] of GAZETTEER) if (text.includes(name)) return { lat, lng, approx:true };
  if (regionId && REGION_CENTER[regionId]) { const [lat,lng]=REGION_CENTER[regionId]; return { lat, lng, approx:true }; }
  return null;
}

// ===== YouTube =====
const YT = "https://www.googleapis.com/youtube/v3";
async function ytJson(path, params) {
  const usp = new URLSearchParams({ ...params, key: YT_KEY });
  const res = await fetch(`${YT}/${path}?${usp}`);
  if (!res.ok) { let r=`${res.status}`; try { const j=await res.json(); r=j?.error?.errors?.[0]?.reason||r; } catch {} const e=new Error(`YT ${path}: ${r}`); e.reason=r; throw e; }
  return res.json();
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
async function ytVideosLive(ids) {
  const cams=[];
  for (let i=0;i<ids.length;i+=50){ const d=await ytJson("videos",{part:"snippet,status,liveStreamingDetails",id:ids.slice(i,i+50).join(",")});
    for (const v of d.items||[]) {
      if (v?.snippet?.liveBroadcastContent!=="live") continue;
      const sn=v.snippet, title=sn.title||"(無題)";
      // 地名推定は title＋channelTitle のみ（descriptionは他カメラ一覧を列挙しがちで誤マッチの元）
      const text=`${title} ${sn.channelTitle||""}`;
      const guessed=guessRegion(text), geo=geocodeTitle(text,guessed);
      const viewers=v?.liveStreamingDetails?.concurrentViewers;
      cams.push({
        id:`yt:${v.id}`, source:"youtube", title, place:sn.channelTitle||"",
        region: geo ? (regionOf(geo.lat,geo.lng)||guessed) : guessed,
        category: guessCategory(text), lat: geo?.lat??null, lng: geo?.lng??null, approxLocation:!!geo,
        embeddable: v?.status?.embeddable!==false, embedType:"iframe",
        embedUrl:`https://www.youtube.com/embed/${v.id}?autoplay=1&mute=1&playsinline=1`,
        imageUrl:null, thumbUrl: sn.thumbnails?.medium?.url||sn.thumbnails?.high?.url||null,
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
  for (const pid of PLAYLISTS) { try { (await ytPlaylistIds(pid)).forEach(id=>idSet.add(id)); } catch(e){ console.warn("  playlist失敗",pid,e.message); } }
  for (const q of SEARCH_QUERIES) { try { (await ytSearchIds(q)).forEach(id=>idSet.add(id)); } catch(e){ console.warn("  search失敗",q,e.message); if(e.reason==="quotaExceeded")break; } }
  const cams=await ytVideosLive([...idSet]);
  console.log(`  YouTube: ライブ ${cams.length}件`);
  return cams;
}

// ===== Windy =====
const WINDY = "https://api.windy.com/webcams/api/v3/webcams";
function windyCategory(cats=[]) { const ids=cats.map(c=>typeof c==="string"?c:c.id||"").join(" ").toLowerCase(); if(/(beach|harbor|harbour|sea|coast|island|bay|port)/.test(ids))return "coast"; if(/(mountain|ski|lake|forest|nature|volcano)/.test(ids))return "mountain"; if(/(traffic|highway|road)/.test(ids))return "road"; if(/(city|square|town|landmark|building)/.test(ids))return "city"; if(/(weather|sky)/.test(ids))return "weather"; if(/(river|dam)/.test(ids))return "river"; return "scenery"; }
function windyToCamera(w) {
  const loc=w.location||{}, lat=loc.latitude??null, lng=loc.longitude??null, player=w.player||{}, hasLive=!!player.live;
  const imgs=w.images||{}, active=(w.status||"").toLowerCase()==="active";
  const place=[loc.city,loc.region,loc.country].filter(Boolean).join(", ");
  const updated=w.lastUpdatedOn?"・更新 "+new Date(w.lastUpdatedOn).toLocaleString("ja-JP"):"";
  return {
    id:`windy:${w.webcamId}`, source:"windy", title:w.title||place||`Webcam ${w.webcamId}`, place,
    region: regionOf(lat,lng), category: windyCategory(w.categories), lat, lng, hasLive, embedType:"iframe",
    embedUrl: player.live||player.day||player.month||(w.webcamId?`https://webcams.windy.com/webcams/public/embed/player/${w.webcamId}/day`:null),
    imageUrl: imgs.current?.preview||null, thumbUrl: imgs.current?.preview||imgs.current?.thumbnail||null,
    detailUrl: w.urls?.detail||(w.webcamId?`https://www.windy.com/webcams/${w.webcamId}`:null),
    status: active?(hasLive?"live":"reported"):"offline",
    note: active?(hasLive?`Windy: ライブ配信${updated}`:`Windy: 稼働中（静止画/タイムラプス）${updated}`):"Windy: 停止中",
    lastChecked: w.lastUpdatedOn||null,
  };
}
async function fetchWindy() {
  if (!WINDY_KEY) { console.warn("  (WINDY_API_KEY未設定→Windyスキップ)"); return []; }
  const byId=new Map();
  for (const r of REGIONS) {
    for (let offset=0;offset<250;offset+=50) {
      const usp=new URLSearchParams({bbox:`${r.n},${r.e},${r.s},${r.w}`,include:"categories,images,location,player,urls",limit:"50",offset:String(offset)});
      const res=await fetch(`${WINDY}?${usp}`,{headers:{"x-windy-api-key":WINDY_KEY}});
      if (!res.ok) { console.warn(`  Windy ${r.name} HTTP ${res.status}`); break; }
      const data=await res.json(); const list=data.webcams||[];
      for (const w of list) { const c=windyToCamera(w); if (c.status!=="offline" && !byId.has(c.id)) byId.set(c.id,c); }
      if (list.length<50) break;
      await new Promise(x=>setTimeout(x,200));
    }
  }
  console.log(`  Windy: 稼働 ${byId.size}件`);
  return [...byId.values()];
}

async function main() {
  console.log("公開用カタログを生成中…");
  const [yt, windy] = await Promise.all([fetchYouTube(), fetchWindy()]);
  const byId=new Map();
  for (const c of [...yt, ...windy]) if (!byId.has(c.id)) byId.set(c.id, c);
  const cameras=[...byId.values()];
  const payload={ generatedAt:new Date().toISOString(), count:cameras.length, cameras };
  await writeFile(OUT, JSON.stringify(payload), "utf8");
  console.log(`✓ ${cameras.length}件を ${OUT} に出力`);
}
main().catch(e=>{ console.error("✗ 失敗:", e.message); process.exit(1); });
