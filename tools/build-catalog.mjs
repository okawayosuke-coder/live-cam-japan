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
// クォータ安全設計: プレイリスト(1ユニット/ページ)中心＋検索は少数(8×100)。
//   115再生リスト×最大3ページ＋videos.list＋検索 ≈ 1,100ユニット/回。
//   6時間ごと(4回/日)でも ≈ 4,600/日（無料枠1万/日内）。
// Node 18+（グローバル fetch）。
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGIONS, regionOf, DEFAULT_PLAYLISTS } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "catalog.json");

const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const WINDY_KEY = process.env.WINDY_API_KEY || "";

// --- ビルド設定（クォータに合わせて調整可） ---
// 再生リストは config.js の DEFAULT_PLAYLISTS を単一ソースとして共有（クライアントと一致）。
// 115件＝全国網羅（北海道→沖縄＋河川防災/空港港湾/観光/サーフ）。
const PLAYLISTS = DEFAULT_PLAYLISTS;
// 検索は100ユニット/回と高価。チャンネル群(115)が地域網羅を担うので、検索は
// 新規/未登録カメラの発見用に少数の広域クエリのみ（8クエリ×100=800ユニット）。
const SEARCH_QUERIES = [
  "ライブカメラ", "富士山 ライブ", "海 ライブカメラ", "空港 ライブカメラ",
  "河川 ライブカメラ", "道路 ライブカメラ", "サーフ ライブカメラ", "live camera japan",
];
const PLAYLIST_PAGES = 3; // 1プレイリストあたり最大ページ数（50件/ページ）。115件×最大3=安全圏

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
const EXCLUDE_TITLE_RX = /ニュースまとめ|昼のニュース|24H ?NEWS|NEWS LIVE NOW|Japan News Digest|緊急地震速報|地震速報ライブ|WORLD-JAPAN News/i;

// ===== 共通ロジック（sources.js のクライアント版と同等。Node安全に再実装） =====
const REGION_HINTS = [
  ["hokkaido", ["北海道","札幌","函館","旭川","釧路","知床","小樽","帯広","十勝","ニセコ","hokkaido","sapporo"]],
  ["tohoku", ["東北","青森","秋田","岩手","山形","宮城","仙台","福島","弘前","八戸","郡山","いわき","鶴岡","tohoku","sendai"]],
  ["kanto", ["東京","渋谷","新宿","横浜","千葉","埼玉","茨城","栃木","群馬","神奈川","川越","那須","tokyo","shibuya","yokohama"]],
  ["chubu", ["富士","山梨","長野","新潟","名古屋","愛知","静岡","岐阜","金沢","石川","富山","福井","上高地","能登","柏崎","fuji","nagoya"]],
  ["kinki", ["大阪","京都","神戸","兵庫","奈良","和歌山","滋賀","三重","道頓堀","琵琶湖","鳥羽","志摩","osaka","kyoto","kobe"]],
  ["chugoku", ["広島","岡山","山口","鳥取","島根","下関","関門","尾道","倉敷","松江","浜田","hiroshima","okayama"]],
  ["shikoku", ["高知","徳島","愛媛","香川","松山","土佐清水","海陽","高松","kochi","shikoku"]],
  ["kyushu", ["福岡","博多","熊本","長崎","鹿児島","宮崎","大分","佐賀","沖縄","那覇","石垣","桜島","阿蘇","名護","八重山","宮古","fukuoka","okinawa","naha"]],
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
  // 同名衝突回避（最優先。広域の同名に吸われないよう先頭で判定）
  ["草津駅",35.013,135.960],   // 滋賀。群馬の「草津温泉」より先に判定
  ["伊豆白浜",34.667,138.953], // 静岡下田。本州"伊豆"中心より具体
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
  // ===== 全国発掘チャンネル向け 追加地名（北海道→沖縄） =====
  // 北海道・東北
  ["ニセコ",42.805,140.687],["羊蹄山",42.828,140.811],["帯広",42.924,143.196],["十勝川温泉",42.926,143.310],["旭川",43.768,142.365],
  ["弘前",40.603,140.464],["八戸",40.512,141.488],["むつ",41.293,141.183],["深浦",40.646,139.926],
  ["宮古港",39.641,141.957],["釜石",39.276,141.886],["久慈",40.190,141.775],
  ["郡山",37.400,140.359],["会津",37.495,139.930],["いわき",37.050,140.890],["小名浜",36.939,140.904],["相馬",37.797,140.919],
  ["鶴岡",38.727,139.827],["加茂水族館",38.711,139.760],
  // 関東
  ["歌舞伎町",35.695,139.702],["川越",35.925,139.485],["那須どうぶつ王国",37.123,140.053],["那須",37.000,140.050],
  ["勝どき",35.658,139.778],["サンシャイン",35.729,139.719],["善福寺川",35.699,139.620],["みなとみらい",35.456,139.632],["江の島",35.299,139.480],
  // 中部・北陸
  ["御殿場",35.308,138.934],["日本平",34.974,138.448],["富士五湖",35.500,138.760],
  ["善光寺",36.661,138.187],["松本",36.238,137.972],
  ["立山",36.576,137.594],["室堂",36.576,137.594],["富山空港",36.648,137.188],
  ["能登",37.300,137.160],["輪島",37.391,136.899],["珠洲",37.436,137.261],["千里浜",36.893,136.778],
  ["柏崎",37.366,138.559],["鯨波",37.348,138.519],["下田",34.679,138.945],["雨晴",36.792,137.045],["高岡",36.754,137.026],
  // 近畿
  ["道頓堀",34.668,135.501],["嵐山",35.009,135.677],["祇園",35.003,135.775],["伏見稲荷",34.967,135.772],
  ["メリケンパーク",34.682,135.187],["奈良公園",34.685,135.843],["若草山",34.683,135.848],
  ["琵琶湖",35.250,136.050],["大津市",35.004,135.868],
  ["鳥羽",34.481,136.843],["志摩",34.331,136.835],["国府白浜",34.318,136.834],
  ["アドベンチャーワールド",33.685,135.343],["南紀白浜",33.685,135.343],
  // 中国
  ["関門海峡",33.957,130.942],["関門橋",33.957,130.953],["下関",33.957,130.941],
  ["呉港",34.232,132.565],["宮島",34.296,132.320],["厳島",34.296,132.320],["広島空港",34.436,132.919],
  ["尾道",34.409,133.205],["倉敷",34.585,133.772],["鷲羽山",34.378,133.815],
  ["松江",35.468,133.048],["浜田",34.900,132.074],["アクアス",34.901,132.181],
  ["長門湯本",34.371,131.184],["光市岩田",33.943,132.020],
  // 四国
  ["土佐清水",32.781,132.954],["竜串",32.785,132.943],["海陽町",33.616,134.355],["内妻",33.616,134.355],
  ["堀江",33.892,132.731],["サンポート",34.355,134.052],["高松港",34.355,134.052],
  // 九州・沖縄
  ["桜島",31.593,130.657],["錦江湾",31.560,130.620],["草千里",32.881,131.078],
  ["唐津",33.450,129.969],["佐賀空港",33.150,130.302],
  ["稲佐山",32.748,129.853],["佐世保",33.180,129.715],["長崎空港",32.916,129.914],["大分空港",33.479,131.737],
  ["日南",31.601,131.379],["油津",31.582,131.404],["青島",31.806,131.471],["木崎浜",31.832,131.453],
  ["博多港",33.612,130.404],["名護",26.591,127.977],["ブセナ",26.546,127.968],
  ["川平湾",24.453,124.154],["名蔵湾",24.400,124.130],["八重山",24.340,124.155],["本部町",26.694,127.878],["美ら海",26.694,127.878],
  // 河川（広域アンカー。具体地名が無い河川CCTV向け）
  ["筑後川",33.300,130.500],["矢部川",33.180,130.450],["淀川",34.717,135.512],["由良川",35.350,135.200],
  ["石狩川",43.300,141.700],["天塩川",44.500,141.900],
  // ===== 未配置カメラ救済（ジオコーディング検証済み。具体地名→キー長降順で部分文字列シャドウ防止） =====
  ["矢作川 河川カメラライブ中継",35.08,137.16],["ぐんまの道路ライブカメラ",36.39,139.06],["hakodateyama",35.42,136.03], // 矢作川/群馬道路/箱館山(滋賀)
  ["Miura Beach",35.166,139.667],["淡路島モンキーセンター",34.245,134.883],["久留米市鳥類センター",33.319,130.528],
  ["港北パーキングエリア",35.529,139.56],["Tanukikoji",43.056,141.346],["駿河湾フェリー土肥",34.911,138.787],
  ["シーボニアマリーナ",35.158,139.612],["茅ヶ崎サザンビーチ",35.317,139.399],["内海LiveCam",34.712,136.882],
  ["しながわネットTV",35.598,139.738],["クリーンシステム",38.297,140.347],["豊橋市表浜海岸",34.652,137.455], // 須川飯塚橋=山形
  ["笠置キャンプ場",34.756,135.943],["忍野しのびの里",35.461,138.846],["五島つばき空港",32.666,128.833],
  ["ぐんまの道路",36.35,139.0],["エルシーブイ",36.039,138.114],["ニルヤカナヤ",26.708,127.879],
  ["関西国際空港",34.434,135.244],["道後温泉本館",33.852,132.786],["春日北交差点",35.48,133.062],
  ["津久井浜海岸",35.221,139.681],["猪名川河川",34.74,135.42],["武庫川河川",34.72,135.38],["大和川河川",34.59,135.49],
  ["旭山動物園",43.769,142.481],["赤岳天望荘",35.9707,138.3705],["本牧海づり",35.418,139.66],
  ["新保土ヶ谷",35.4514,139.5672],["扇町カーブ",34.706,135.512],["逗子海岸",35.293,139.572],
  ["小清水町",43.922,144.315],["湾岸Go",35.61,139.83],["蔵王索道",38.165,140.397],["新御堂筋",34.728,135.5],
  ["内海海岸",34.711,136.88],["花巻空港",39.429,141.135],["天草空港",32.482,130.158],["庄内空港",38.812,139.787],
  ["五ヶ瀬川",32.58,131.66],["新河岸川",35.88,139.5],["相野谷川",33.73,135.99],["波津海岸",33.879,130.553],
  ["松原市",34.578,135.551],["ぐんま",36.567,138.836],["八幡浜",33.463,132.424],["杉並区",35.69,139.62],
  ["志木市",35.836,139.583],["掛川城",34.776,138.014],["利尻島",45.242,141.23],["筑波山",36.213,140.102],
  ["金剛山",34.419,135.673],["美ヶ原",36.1,138.106],["七面山",35.366,138.354],["海王丸",36.781,137.1],
  ["忠海港",34.333,132.93],["山国川",33.598,131.18],["貴志川",34.21,135.3],["小里川",35.32,137.36],
  ["土岐川",35.35,137.18],["川内川",31.81,130.3],["呉服橋",35.6822,139.772],["大垣",35.36,136.61],["揖斐川",35.49,136.57],["新冠",42.362,142.318],
  // 地方整備局アンカー（具体河川キーの後＝河川名不明な河川CCTVを正しい地方中心へ集約）
  ["四国地方整備局",33.75,133.7],["関東地方整備局",35.9,139.6],["近畿地方整備局",34.6,135.6],
  ["九州地方整備局",32.8,130.8],["北陸地方整備局",37.06,138.1],
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
