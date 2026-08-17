// ============================================================================
// config.js  ―  全国ライブカメラビューア 設定
// ----------------------------------------------------------------------------
// ・APIキー等のユーザー設定は localStorage に保存（サーバー不要）
// ・捏造防止: ここに置く外部IDは「実在を確認した公開リソース」のみ。
//   実際に表示されるカメラは全てランタイムで生存確認してから出す。
// ============================================================================

// 日本の8地方。bbox は [south, west, north, east]（Leaflet順）。
// Windy API へは N,E,S,W の順で渡す（version-transfer ドキュメント準拠）。
export const REGIONS = [
  { id: "hokkaido", name: "北海道",   s: 41.3, w: 139.3, n: 45.7, e: 146.1, center: [43.4, 142.8] },
  { id: "tohoku",   name: "東北",     s: 36.9, w: 139.0, n: 41.6, e: 142.2, center: [39.3, 140.6] },
  { id: "kanto",    name: "関東",     s: 34.9, w: 139.0, n: 37.2, e: 140.9, center: [35.9, 139.6] },
  { id: "chubu",    name: "中部",     s: 34.5, w: 136.0, n: 37.7, e: 139.2, center: [36.2, 137.6] },
  { id: "kinki",    name: "近畿",     s: 33.4, w: 134.5, n: 35.8, e: 136.6, center: [34.6, 135.6] },
  { id: "chugoku",  name: "中国",     s: 33.7, w: 130.9, n: 35.7, e: 134.6, center: [34.7, 132.8] },
  { id: "shikoku",  name: "四国",     s: 32.7, w: 132.0, n: 34.6, e: 134.9, center: [33.7, 133.5] },
  { id: "kyushu",   name: "九州・沖縄", s: 24.0, w: 122.9, n: 34.7, e: 132.1, center: [31.5, 130.5] },
  // 伊豆諸島〜小笠原（大島・新島・三宅島・八丈島・小笠原）。本州bboxの南の隙間を埋める。
  { id: "izu",      name: "伊豆・小笠原諸島", s: 26.5, w: 139.0, n: 34.83, e: 142.8, center: [34.4, 139.3] },
];

// カテゴリの正規化（Windy categoryや手動分類をこの粒度に寄せる）
export const CATEGORIES = [
  { id: "scenery",  name: "景観・観光" },
  { id: "mountain", name: "山・自然" },
  { id: "coast",    name: "海・港" },
  { id: "river",    name: "河川・防災" },
  { id: "road",     name: "道路・交通" },
  { id: "city",     name: "街・繁華街" },
  { id: "weather",  name: "天気・空" },
  { id: "other",    name: "その他" },
];

// 既定の再生リスト（実在確認済み）。UU…はチャンネルの全アップロード再生リスト。
// 中身は実行時/ビルド時に取得し「現在ライブ中」のみ表示するので、ここに死んだ配信が
// 混ざっても表示には出ない。tools/build-catalog.mjs もこの配列をそのまま使う（単一ソース）。
//   先頭8件 = 既存（全国キュレーション/伊豆小笠原港湾/外房サーフ）。
//   以降 = 全国発掘（北海道→沖縄＋河川防災/空港港湾/観光温泉/動物園水族館/サーフ）。
//   計472件（2026-08に実在＆現在ライブ検証済みを2段階で追加＝第1弾53ch＋第2弾304ch）。
export const DEFAULT_PLAYLISTS = [
  // --- 既存 ---
  "PLM7jIABwhUkb41KUDAke1x8I0FmTL5Z4s", // 日本全国のライブカメラ（キュレーション）
  "UUqdejTsUrCvZ55Y8u9v5h9w",           // 東京都 伊豆・小笠原諸島 港湾ライブカメラ
  "UUEDn0tLxpVqEvI3NJyE2DRA",           // 波のスケッチ（鴨川/外房）
  "UUY88ELMjnfMyOYMUw5K9o3g",           // 犬吠埼テラス（銚子）
  "UUorpI8lCIFIuNEZsYAn0Qcg",           // 一宮・釣ヶ崎（外房サーフ）
  "UUKP-Q8DRYQ7Pl6jRirZasBA",           // 太東/東浪見（外房サーフ）
  "UUWAo3gf7X9JvcKifG0s2vpQ",           // 勝浦・部原（外房サーフ）
  "UUV3arNLjYmBubfETmAAzS4w",           // なみある?（サーフ各地）
  // --- 北海道 ---
  "UUGrZAL2OKyKHj5flMIVU72A", // STV札幌テレビ（札幌・函館・旭川・知床ほか）
  "UUXIen52JAy3pttIX60JO0YA", // 函館駅前ライブ
  "UUwJceIUpEJAkS7mVUJoEmYg", // 函館山(FMいるか)夜景
  "UUrOAX9_xMtlHHR6GE8ob2zA", // 旭山動物園ライブ
  "UU-Gpej6F3EVsxsKplMeUmYg", // ニセコ(本田珈琲店)羊蹄山
  "UUJOKZ03IvVCbahaPloXPaww", // 旭川お天気カメラ
  "UULW7dg806PhOIh4oam4ZCRw", // 小樽港(LIVE the SCAPE)
  "UUIQ-kh5y9I3RyiUo6LtfyPw", // 旭川ネットテレビ
  "UUT-PZ211r3_9mFdF0zC1HHg", // 十勝毎日新聞（帯広・十勝川温泉）
  // --- 東北 ---
  "UUNt5Ctj5uR_A5jTn_yZ9mVQ", // 河北新報（仙台）
  "UUHYCNznUIRwu77QUuL7qZJQ", // ATV青森テレビ
  "UUk_jA9Y8pb50Ab2EzV_KhLw", // RAB青森放送
  "UU7UzAjbjzvekhio8uEJXCpw", // AKT秋田テレビ
  "UUMbq0m2vILQTbc0VhOcVWaQ", // IBC岩手放送（宮古港/釜石/久慈）
  "UUKYimk34K4xqApVYTKg6sow", // ミヤギテレビ（仙台駅西口）
  "UUsci9tL9g8QPOvUwjJeDAgA", // TUFテレビユー福島
  "UU8Y0ZErdlAnA9uW7ZeRdreQ", // 福島中央テレビ
  "UU32pF1BZLteNqIaXUVs7Slg", // KFB福島放送 情報カメラ
  "UUBaecD-r5iwKiqkMngdPN4w", // 加茂水族館（山形・クラゲ）
  // --- 関東 ---
  "UUCLnJzwda_Kcdkok3et7n0A", // 歌舞伎町ライブ
  "UUBFDJXGCOdMjVtg2AnReoXA", // 歌舞伎町ライブ2
  "UUGCZAYq5Xxojl_tSXcVJhiQ", // テレビ朝日（渋谷/お台場/羽田T2）
  "UUoQBJMzcwmXrRSHBFAlTsIw", // フジテレビ（お台場/レインボーブリッジ）
  "UU6AG81pAkf6Lbi_1VC5NmPA", // TBS NEWS DIG（横浜みなとみらい/新宿）
  "UUqaWGntsmpG4dzWd1sksLMQ", // tvk（横浜）
  "UU8W6RWFeN4cmx6C3tPNEdaQ", // TOKYO LIVE CAMERA（お台場/富士山/羽田）
  "UU5vHSXebBWenaGFCGuZ3ksA", // 勝どき4K(NexSpark)
  "UU3DrGPmCHsrionkmduqX0qg", // スカイツリー(Juyoh)
  "UUKyXyJMijwyBebgI9wmzFcw", // 東京タワー公式
  "UUg01zTx4TYBA_4ifxep0TFw", // 国交省関東地整 河川（利根川/荒川/多摩川）
  "UUExASDN78i5BDDgHWoy9QRQ", // 川越大正浪漫夢通り
  "UU8oWZuLFc_cBA0LmgWfA2Rw", // 杉並区 善福寺川 河川ライブ
  "UUnFS0WrXmUNelP9Ibs6umbw", // サンシャイン水族館（池袋）
  "UUp6QcfxkVaT77OVMXKKTJoQ", // 那須どうぶつ王国（栃木）
  "UUbn5eHDjwmPC2K9RG8P0i_A", // 草津温泉湯畑（群馬）
  // --- 中部・北陸 ---
  "UUcuadYD11H2Eti8AEOP7Buw", // FujigokoTV（富士五湖/御殿場/日本平）
  "UUVUyX8T-vYwJYraM6957r9Q", // 上高地(五千尺ホテル)
  "UUy9ww22FuUlXd0c6B8INJVQ", // 善光寺(INC長野CATV)
  "UUD1MsyeoR0St_aWxydu9law", // 富山テレビ(BBT)立山室堂/富山空港
  "UUt6LB-BvEmDm-oWbe_TO7mw", // 北陸朝日放送(HAB)金沢/能登/千里浜
  "UU4SO_m6DMmGEb9j42C4zgAQ", // 千里浜(HAB)なぎさドライブウェイ
  "UUkd3H8yZEXxZSGSOmxeHxrg", // FBC福井放送
  "UUFfurCxvxE0mFkFy1ZwSang", // 鯨波海岸（柏崎・日本海夕日）
  "UUnJUV9-pfhyWQdQbvTJ84QA", // 伊豆白浜(mariner1173)下田サーフ
  "UUViEINl4jn95elupZZPk__w", // 高岡ケーブル（雨晴海岸）
  // --- 近畿 ---
  "UUQ2mmGKtrBp6rL8tSMJCCwA", // 道頓堀(RVJ)戎橋/グリコ
  "UUFyohCp_Vx6WC82DiJ0l88w", // 京都市観光協会（嵐山/祇園/伏見稲荷）
  "UU1YsvhwhmQV5kfVMRpTVx-A", // 神戸ウォーターフロント（メリケンパーク）
  "UU0CTWpAAsLqr3-88sbEEjyg", // NaLIVE（奈良公園/若草山）
  "UUciZ_EHzb6frW2WfFGCOX5g", // びわ湖放送（大津/琵琶湖）
  "UU6lmF6p8HDwPkI5PG1YO0Ng", // 草津駅ライブ（滋賀）
  "UUQaIJF9pcbAvVszZHTI-Kqw", // 鳥羽マリンターミナル（三重）
  "UUDZ15oljFdnJJxcix-ZGEAw", // 志摩 国府白浜(machispo)サーフ
  "UUVEmpbL5VzfXsULPFeRsj4Q", // アドベンチャーワールド（和歌山・パンダ）
  // --- 中国 ---
  "UU9r31LvpWhWU0aJdAirOZDQ", // tysテレビ山口（下関/関門海峡）
  "UUlVbdSn_q2wy4t_aYkPMBTA", // 関門海峡(新興製作所)下関
  "UUfE5u1B3RuyBxgpuh8biMfA", // 長門湯本温泉（山口）
  "UUGxj5YPkSuG7UoRXzjZ6PJA", // 光市岩田（山口）
  "UUATnyu9lou_Lw43gvyoh8uA", // RCC NEWS DIG（広島駅/呉港）
  "UUg9YmSd9-AF2RRPNHsLjj2A", // 広島ホームテレビ（広島空港/厳島）
  "UU8RtSgWxyqdtPbGQfXk3mjw", // 尾道千光寺山ロープウェイ
  "UUxNJOB2V-5Jm6pMdl8UXnPg", // 倉敷KCT（鷲羽山/瀬戸大橋）
  "UULkGTD9DRsG-Y27qE9uehaQ", // 鳥取 伏野海岸(Atelier COCOON)
  "UUa6LoR3TlZ934EBz2osTfuw", // 松江道路カメラ（島根・マーブル）
  "UU0R2MtMpbFQX7ZoF-2OgmWA", // アクアス（島根浜田・シロイルカ）
  // --- 四国 ---
  "UUwFO9Ihbc2o76dYunXU7izw", // 土佐清水ジオパークTV（高知・竜串）
  "UU3kYL05u3OLTio9GD9syg1w", // 内妻ビーチ(ふくちゃん)徳島サーフ
  "UUsV_76RlGzFVZQABftUKdSw", // 四国地整 河川CCTV（吉野川/四万十川）
  "UUVbExwCBw3wr5vGGYe-cBPw", // 堀江マリンハウス（松山・瀬戸内）
  "UUOq4G6r489yBvnYh6F3_i-w", // CMSサンポート高松（香川）
  "UU1AgIHd5nsX5oYXZLdcYB8Q", // サンポート高松（CMS専用）
  // --- 九州・沖縄 ---
  "UUpWU25qIleNLmUEF9VwBdMA", // 桜島(財宝)複数アングル
  "UU7f4czw8TuG69HuVt_uXRtQ", // 桜島(MBC南日本放送)垂水/錦江湾
  "UUAhZnTMHk-TPyDzT0rt34IQ", // 桜島(KKB)情報カメラ
  "UUey3hahtkbKG9VrXTSotZoQ", // 阿蘇草千里（自然公園財団・4K）
  "UUx23yzeMtcUP7d3p_Aluj0g", // サガテレビ（佐賀空港/唐津湾）
  "UUyTXCFmTbFW_M3i_6xB7cRQ", // 稲佐山カメラ（長崎夜景）
  "UUWkqxFZQSdkR_q8kGz6p9mw", // NCC長崎文化放送（長崎港/長崎空港/佐世保）
  "UUekmK9BsmFY_PujFeV6ryqg", // OAB大分朝日放送（大分空港/別府）
  "UUz3HhdczanuyQ6y2uhX_ZQg", // 日南テレビ（油津/梅ヶ浜サーフ）
  "UUAu_SrUI1IBv8wFgYSi6kVg", // いい波(ii-nami)宮崎木崎浜/青島サーフ
  "UUDyC7xeQxsihyZj8SoICLEw", // 福岡空港ライブカメラ
  "UUXXEOK4erP8E3cbszN22bEQ", // FBS福岡放送（天神/福岡空港）
  "UUtByHAMKJuA_zjJ7m3nE1_w", // TVQ九州放送（博多港）
  "UUcvSlpVp6ME4dSgzZsHI00w", // ブセナテラス（名護・東シナ海）
  "UU_UB1JJTJPbN0QpaVkPkiwA", // 宮古テレビ（宮古島/来間大橋）
  "UUWFKZJdFJIIH1E9DGYBaY0A", // 八重山リアルタイム（石垣・名蔵湾）
  "UU2RZL3Ftu_lnV43zVrc3qOg", // 石垣島川平湾(CBD)昼夜
  "UUcctSG5Srwqupo150X07lxA", // 石垣島ライブ(ishigaki-ch)川平湾
  "UUQJE3qm7Sjc5-JXAYjAfkrw", // 石垣島ライブカメラ
  "UUl27leged0PT2kIrRtrFYKA", // RBC NEWS（琉球放送・那覇空港/石垣港）
  "UUjPVLguFrd6DTfHl2McrPjw", // OTV沖縄テレビNEWS（お天気カメラ）
  "UUXjkj8-HaOvX7o-fzhOu7Ng", // 海洋博公園・美ら海水族館（本部町）
  "UUjh7PkIBYtB0p5erDP4L6xg", // 那覇港(SALOTK2)
  // --- 河川・防災（官公庁） ---
  "UU_CPIys6tBqmwVXsH-X4ycg", // 国交省北海道開発局（石狩川/天塩川）
  "UUZP1ToNCzbV_RpPChepbbiw", // 国交省近畿地整（淀川/由良川）
  "UUxvRdp0VSZtx6NR4Le2TIFA", // 筑後川（九州地整）
  "UUb1iYF-zWqswtfNSIQKRt0Q", // 矢部川（九州地整・福岡）
  // --- 空港 ---
  "UUMKvT0YVLufHMdGLH89J1oA", // 朝日新聞（成田A滑走路）
  "UUWt0yfrBaUk148rxaOp4b4w", // 日テレNEWS（羽田T1/T3/那覇）
  "UUeCmAYh1ylwIsgGrmqaklzg", // TBS NEWS DIG（羽田T1）
  "UUxiRdfyH0FtFCRZTRfRsdsA", // 中京テレビ（セントレア/伊勢湾）
  "UUH1R8j9ReS3GSV3wi58Xu1A", // Love Flight Jack（成田さくらの山）
  "UU_lRCs4pOVJl2Sv_Y4_Qsaw", // Live Jet（羽田4本滑走路）
  // --- 観光・水族館・その他 ---
  "UUfoiWJgMmg4p9olz1WE0-9A", // 江の島(HviewCam)片瀬海岸
  "UUQcj-JgG6XA0hGcTYWnK3ig", // 鳥羽水族館（ラッコ）
  "UURb3-Nt6Z6JQmJHMyMgsLkA", // 天王寺動物園（大阪）
  // --- 全国発掘 追加（2026-08・実在＆現在ライブ検証済み53ch） ---
  "UUFx5EVFYmFvlDwet2A_yimA", // 和歌山県 日高振興局管内 河川映像
  "UUHZt37s-l_ZGuWcEMiFuSVA", // 山梨県南アルプス市・富士川町道路ライブカメラ
  "UUPW5WTXsl41MHifOUcTjdag", // 和歌山県 海草振興局管内 河川映像
  "UUZ1gP3mpttGH314cI8ByS-A", // イキテレチャンネル【壱岐市ケーブルテレビ】
  "UU18wakGTIO6r-3e44biki3g", // 福島県 下郷町
  "UUxmo6RuWtljvb5J_zTI22gQ", // 湘南サニーサイドマリーナ
  "UUPldIceiQxfDX-nHAQOem7w", // 白馬村ライブチャンネル
  "UUuE_--BXc0J7gIAtA_t4NnQ", // 1ちゃん!日本海テレビ
  "UUqjC7sdgf78PUaZ2RSHvG_g", // 神奈川県海岸・港湾ライブカメラ
  "UUK9eHUAiJeNA2i_1TcgZcfw", // 【KTV】ケーブルテレビ河口湖
  "UUI-AmuPKmbTweBgZgTqjXuw", // 石川県土木部公園緑地課
  "UUVFk3LGs7qDSlb9Sy8woSTw", // 穴水町公式チャンネル
  "UUJKH8wYxFYeufDnvy1MPofA", // ZAZAマガジンチャンネル
  "UUfCxyg8waxuAPxa8WmBY49g", // 渋谷センター商店街
  "UUi4RF7aKUxthUM7U0PcGWIw", // 【公式】国宝松本城 / National Treasur
  "UUhU3QHV-yZytG_AJgfL2bnw", // 諏訪湖八ヶ岳ライブカメラ  4994 Land
  "UULpgVZwl9CaXierI3oq08mQ", // 京都市観光協会_Live配信
  "UUzzNauFBCq3l7C9TrmiIo-g", // 川越TV
  "UUFPHsl3dglA16jKQiLhxkiA", // 諏訪市公式チャンネル
  "UUm9d_cxZig30MMDv09_o96g", // 王ヶ頭カメラ
  "UUOLVB0iYK8ahQ0mFn-lF-8g", // SBSnews6
  "UUj8MaS8DMpPHGraWX6pKPww", // WINK姫路ケーブルテレビ
  "UUQIw-e2W8a1e628l4_P1ZfQ", // 札幌もいわ山ロープウェイ【公式】
  "UU8NuNbL1frrbS4sQcFSClvQ", // 小樽天狗山ロープウエイ
  "UULy0LVrhCARQJBfzc7PbdeA", // 秋田県仙北市
  "UUujqw4iys19UVg2JYVfVsYA", // いわて花巻空港
  "UUcOSt2pOCZgE7gndPPEwhAw", // 肘折温泉そば処寿屋
  "UU8cnCaq-MquhsebMer9A9rQ", // 【公式】クロス新宿ビジョン
  "UUoS1S0V-QdSl_xe29G8mKcQ", // 大丸有協議会
  "UUpweG_uuLZhAH9B_Spwmmzg", // 原宿駅・表参道口 ライブカメラ [Harajuku Li
  "UUy8wXIvONgiQV4jZEFE6aWQ", // 奥日光湯元温泉 湯〜Tube
  "UUL3peEBSiAkEMDuxNkffbvw", // YBS山梨放送 公式チャンネル
  "UU3i9y6EYpXlvrHLm2wMbOkQ", // 新穂高ロープウェイ
  "UUYAWCLkbY1Heu4tm8SR2-2w", // 七尾市公式YouTubeチャンネルNanao_city
  "UUSgouYRapy1btrfHNrVGKFQ", // 株式会社御前崎ケーブルテレビ(まおまお)
  "UUDGTtJ3Uoy-zs9hSV8ZBytw", // 磐田市危機管理課
  "UUAjRtFIaNvQznbHytYyzUbA", // 長野県大町市
  "UUG9GvkBdKWMn4VDe-GYkg5A", // 天神橋筋商店街から チャンネル
  "UUYIl6Yf96xN0ge-g_bo5JtA", // 芦有ドライブウェイ【公式】
  "UUOKyln0jsZIF_-YKD8buHsA", // 高取町まちづくり課
  "UU2V-P3qfNnPJCDtPyOE-yfg", // 河内長野市役所
  "UU73QFSdUY5fMNZtgnhBjlRg", // 【公式】宮島観光協会
  "UURnFGOp_mjaCYEhMzsE2iHA", // 【公式】HOME広島ニュース
  "UU_LC3G1PYFx3FzeOehzz-lg", // 錦帯橋課公式チャンネル
  "UUiPXMbP2P1OFvY9LMs22mUA", // 備中松山城雲海展望台ライブカメラ
  "UUlAtpDytL1hmOUeiJaNrHlQ", // 【公式】道後温泉
  "UU-2L3iPWxVyvvnPLplpdCHA", // 【公式】南海放送NEWS（チャン４）
  "UUIf6siGkL7JdkyPkDwgYD2Q", // 三島ポートサービス
  "UUkTCKXGQwSr2apB6x0ITNvw", // きんかめちゃんねる
  "UUNEVajGIlWJHvUysEv-Y0CA", // 博多 中洲コマーシャルチャンネル
  "UUpOBAWYh0T5Zz5S7uKIiEmQ", // 長崎ケーブルメディア[公式]
  "UUMj5mfLSlOmx-rOpquoErDQ", // 岡垣町観光協会のまいにち
  "UUVg0E1H6LZBhTt_2oSm2Hzg", // バクノビジョン
  // --- 全国発掘 第2弾（2026-08・実在＆現在ライブ検証済み） ---
  "UUVh1-I9rKs7w7C7_LuUhwcg", // MARUNUMA
  "UUwzJctz6m-0wG_evkheecZA", // フジヤマNAVI
  "UUZ9t1d3zxJGIw6GMmbGdjuw", // 和歌山県 東牟婁振興局串本建設部管内 河川映像
  "UUaaSp7JYkACHR-Sr-p3OHeQ", // Tokyo Views
  "UUwNfkYp9gKIvQDN1kPhpCsQ", // F.S.T. NET
  "UUMaXtOvzgcCQt7MZwJmr7XA", // EN DAIBA
  "UUZ974tQkAeV7_l_opPHCcdg", // The Dramatic 中央本線。
  "UU9pARxM8ajMNB0rA8xBamLg", // 湯島猫島ありのまま
  "UURZMs9s1P6o0b1nGibmtkJA", // 共同通信LiveCamera
  "UUZTGqy2rQTGap-b6IyqECVw", // City Kamiamakusa
  "UUCvr6WB3iOFt623D90pZCtA", // KTV12net /小林TV
  "UU1xeTccsAQdz7-fF0eAa5HA", // 蔵王索道協会
  "UUuv7xqb-jo3HEFMIVLTY_CA", // テイケイ公式チャンネル
  "UUkAB51Lbgor6SW8aE4S3zuQ", // 東京ライブカメラ
  "UU7goiCiuQAGcDCjsajq50wQ", // 札幌もいわ山ロープウェイ【公式-2】
  "UUFzR5mfAXL5fo5A8K8OuHpQ", // 八幡浜 市役所
  "UUfM6ln-djv3yp4PlyP7OSTA", // 杖突峠峠の茶屋
  "UUpBSj4JvnkOP1TJ-eIxaFKw", // 39K
  "UU7OgMFzPdF2t-tawdgrsH_A", // 自然公園財団 上高地支部
  "UUyhNmQHG5ykhoAKIPDjZJ_A", // 南伊豆町観光協会【伊豆の終点、感動の出発点。】
  "UU7lHIZbQzHILorlX4R0izsw", // starstyle
  "UU5-6c7v9yFTZ4yOl_E8LBxQ", // 【公式】熊本市動植物園 ライブカメラチャンネル
  "UU2lZiGfy3K5yZEtfore5mVw", // GORO SKY TOWER GOROGATAKE PA
  "UUEdkwjq31H4y3xfPST9ZFtg", // 箱根ターンパイク株式会社 Official YouTub
  "UUynXCHprmOfyGzGSnqgp6Wg", // 株式会社 上野城公式
  "UUh-ZgieTtDdkrM1r_FIkX1Q", // 蓼科湖畔 蓼の花ライブカメラ
  "UU85IeiB1bl_FgFDsqjo6S1A", // NaganoRowing
  "UUP31tAaN6scBcVAmgf2i1yg", // 恐羅漢スノーパーク&恐羅漢エコロジーキャンプ場
  "UUudZb3TjSjDk3NDCKnuipeQ", // ライブカメラ見ませんか 【 Shingenn しんげん
  "UUrQm4VsC4STPkwuq0kP8TKw", // 和歌山県 有田振興局管内 河川映像
  "UUKF9JhWeRNlgtwmLJpD1_vA", // 東京ドームシティ
  "UUCp1rWY4KFh0t3fKILlPiUQ", // ToyoComtecLiveChannel
  "UU56apcbc2pLZ9xyBizbD1Dg", // インフォ新宿 channel
  "UUCpZAU0b2vZv598fDBlTlqw", // BANKSY GINOWAN
  "UUwr6GbnODegSEq-WGYIJs6g", // ODAIBA TOKYO LIVE
  "UUpk2ftN35L3xfoV2S5xLN2A", // 【LIVE】新宿 大ガード交差点 Tokyo Shinj
  "UUynX4LJTQ_H7_KPy7QiIS2A", // HAKODATE LIVE CAMERA
  "UUnpVhaYEaUYwiQaFdqoPK0g", // Japan Live Camera
  "UUaXRryxoYWX-66VtGPDOmdA", // Scenery & Sound Live Channel
  "UU3bhyaNq5-NFF3A4HJssvIQ", // 日本平夢テラスofficial
  "UUur21TajiRsI1Da1GLzv7Lg", // ITM SKY CAM
  "UU5lG_82zJKl2gvDKkHL0m5Q", // 飛騨小坂観光協会 Hida-Osaka Tourist
  "UUho5sR8l5OCLFgQa22bSbrQ", // 株式会社忍野CATV
  "UUlevANLrH6pEQFfqxBSsCzQ", // （一社）黒部・宇奈月温泉観光局
  "UUi7Mc9-mVGBKIYXXBtm3iGQ", // お宿欣喜湯＆別邸忍冬（川湯温泉）
  "UUsbLhJtyjuslvSMkWZkd36Q", // (一社)日の出町観光協会
  "UUbLm5pG7JURHymVMcISf6_g", // 草津町公式YouTubeチャンネル2
  "UUTY5Gt9CxQcKVdHX6RFgojQ", // 会津東山温泉向瀧・mukaitaki
  "UU811znPqrm4Oqs4P-rGN9yg", // 【公式】リビエラ / Riviera Official
  "UUD6D3tinVTdsbikEtSCeYcw", // 古林伸美
  "UUFM4GflSxh1UEJK1MJbnsEg", // 南知多町観光協会
  "UU01gv8sm8A29MSKeCEUaq1A", // 株式会社石橋
  "UUveiFh0l5eGEVwv4KgMhBfA", // 厚岸町床潭（トコタン）漁港カメラ
  "UUQnSuJ_aYt4XRlvBnL4ak4Q", // 一般社団法人ふじさん駿河湾フェリー
  "UUCb5bQs4a9U4h4Q8rF4YBgQ", // 北海道利尻郡利尻町仙法志字政泊漁港ライブカメラ
  "UUZXscHtExsJQe2z-vfoN1ZA", // 神奈川県小田原市早川漁港ライブカメラ
  "UUcx2yTKNrSvKGwvPpOzOVWA", // 利尻島_旅番屋
  "UUPPyaDqgxNlbiyOkq2FzMOQ", // IAT岩手朝日テレビ
  "UURZplV8vE67bgCI6_3sm3mQ", // たぬきやLIVE
  "UUPgtd-b8SPHD0QZ4Xa29Y3A", // 千葉県佐倉市上志津原ライブカメラ
  "UUwWWMxoGXIVX_LZUn11bneQ", // 長野県軽井沢町
  "UU4BBFj8uCYaNPGVNJGtJDlQ", // 千葉県成田市土屋ライブカメラ
  "UU85_gAlEhxwRWd6A6klLm9w", // 大阪府東大阪市高井田元町ライブカメラ
  "UU0APqyCiILQwcpUPBEPPx1w", // HKだんじり(東岸和田)
  "UU7p1-DM94FYbHlq66IZYKPQ", // Gorimon 2「変わりゆく街並みをスキャン！」
  "UUZdZ7uXbEZ1E96SnvfJGOAg", // 【ほっかいどう】ぷーちゃんねるResort
  "UUFod_8qjE6MO5Jq9IWIAf7Q", // 山梨県上野原市上野原ICライブカメラ
  "UUDwiOni85GLB8NEYIPUu5iw", // 栃木県宇都宮市江野町ライブカメラ
  "UUjeJcwvOUi4XZpM4J9bm74A", // 防犯カメラ販売・設置工事の防犯110番
  "UUW8SDGfX60OFSA7LyVZ9eNg", // AmpiTa
  "UUDQUxTLSRp48XxHfMe5S4Jg", // 鳥取県八頭郡八頭町井古ライブカメラ
  "UUXectqgwIeJpnb6Ao64tstg", // 愛媛県松山市別府町ライブカメラ
  "UUHoJiBhfhNVyFcennfJr7Yg", // トリニティーライブ
  "UU_S3wdk3RsrBhP7nI_o21sw", // 香川県三豊市詫間町瀬戸内海ライブカメラ
  "UUDLDUOVN77uM8TakoGeQdYw", // 北海道苫小牧市表町交通状況ライブカメラ
  "UUnuWX4kaxEHHcpqy-Z_YwaQ", // 北海道千歳市千代田町千歳駅前ライブカメラ
  "UUdpvGwSESOrvjPxwiwKX6Xg", // 熊本県熊本市南区近見ライブカメラ
  "UUkPKVrTdGj4pFcCuNARBIWg", // 北海道旭川市神居町共栄ライブカメラ
  "UU3fDjbb2JVIX6rOLNNqctow", // 【公式】五月山動物園 ウォンバットてれび
  "UU5nv3SjY473p89kwbn-9CVg", // 動物支援コノドch
  "UUtrzqc4p9H6EsmK8sqpho6A", // 紋別アザラシシーパラダイス
  "UUfLSbr8eONUgh3GmCv4QJPQ", // cvn ペンギンライブカメラ
  "UU2ghkdmPNsVLCWNZNM9Tutw", // 久留米市鳥類センター
  "UUNI0op3CT3IXCnOAhr9r3Mg", // cvn サル山ライブカメラ
  "UUBT-WLQk0tN_WfjkrqdSVzQ", // Forest Notes 森の動画チャンネル
  "UUAzaZfwgfjYVRGn4S60xM6Q", // TSCテレビせとうち
  "UUtGDkpAywmLD6wzYGU5hv5A", // 日本平動物園
  "UURs28y8_qHheJ_yPjZ37e-g", // KOMORO ZOO 小諸市動物園　長野県小諸市
  "UUee-u456_iVEFcl-aTCTxcA", // グーライブ(Goolight)
  "UUuboS8tkqptYstvCrAtIZ6g", // 株式会社技研工房
  "UUmhQQ2a_ovsvHX5Sh3aW-fQ", // 寒風山回転展望台
  "UU_9dgNP8GvfhUURELouR3Dg", // 湘南ライブカメラ
  "UURqRQQPgS3eu6DQVDni5Mrw", // 身延七面山ライブカメラ
  "UUYVJUt1uJZJJ_UBEnb2LXHg", // 古墳のある青峰園
  "UU4vlCNw-GtuaQiA-nn8bwvg", // 富士山中湖パノラマライブカメラ
  "UUDMTA9ODpNKG2ohw3gTf-Zw", // 館山城・山頂ライブカメラ
  "UUUYwqlUZcN1gFNz-KQtwV1g", // 松本のシンカ【松本市公式チャンネル】 / Matsumo
  "UUA1PeQnw4Ys2kmBXa2GIF-Q", // 城のホテル甲府
  "UUd6GEK664CTEWRZda7Fu7Lg", // 大阪NEWS【テレビ大阪ニュース】
  "UUPeJ7PiELF7tAjGrOVrQ94A", // 城山公園ライブカメラ
  "UUv7_krlrre3GQi79d4guxHQ", // 読売テレビニュース
  "UUlaKuQ4CsCqpPQpIB-ieqIg", // Discover SENDAI
  "UUAqJUdintpCdd-Kqk-UxFTw", // agataJapan
  "UU3ZzMI_q4BBdA4QIHaxAWaA", // 茨城県東茨城郡城里町石塚ライブカメラ
  "UUvyqF5m-sSOf4W7Xxr0BtYw", // 松本空港
  "UU3vSAbIwuDdbyxln1Wlnehg", // SEA & SKY ch
  "UUVdRvQptqqoLJA9s4_QcpiQ", // Kansai HD
  "UUhy0DnkIETJW0MWR7hIRKBA", // 日光 中禅寺温泉【湖上苑】公式チャンネル
  "UUusBqJK8c15Hq-D8IfKHQAg", // 十和田湖マリーナ
  "UUCk_mV0977ZBEExItWcQgng", // 鹿屋体育大学スポーツ情報センター
  "UUVa9EaYy_W0V8z-VIcrA0GA", // 【公式】エンゼルフォレスト白河高原
  "UU2gv7jCWYfZk-EiwP3bFFrg", // アイオーサポート
  "UUYcexkyqYKH9oWzprRGsW0A", // ふもとっぱらチャンネル
  "UUjvpBcOLMBqktt0KJxjtJCg", // BANTV
  "UU2vDsbLyCHQjXatp4nT0Jfw", // ZEN RESORT NIKKO
  "UU95danhP-6ym8z3ST4ZRR_Q", // 下諏訪観光【公式】
  "UUKABaVLyYlI02C6C8FHGRQQ", // 羽鳥湖天気カメラ(標高940m)
  "UUxuCMqKKTWjzNbZiw661kAQ", // 藤吉電子設計
  "UUx7aVfqIUgc4jwsvXl_tT-g", // M.M.R 鉄道倉庫
  "UUwYeh4cu-0z0hFd3wwYgzeA", // 日光二荒山神社 ライブカメラ
  "UUnO4Bd0YTXkth8dpxVOq1xQ", // タングラム斑尾東急リゾート【公式】_Tangram Ma
  "UUz9uOOV45iv-gi8t5fpdkDQ", // VICENTE AGEMATSU
  "UUdI2ChbySxWNGSWEOaeTjFg", // ぐるっと福島TV
  "UUXJewYtDfap7D1g-CuYh8CQ", // 長野県岡谷市諏訪湖ライブカメラ
  "UUrgX2wz-e6y2no7Vhqqn29A", // ニセコアンヌプリ国際スキー場
  "UUnXXZnHcM2Y-WX7U_fNR2Qg", // SAJ軽井沢スキー学校
  "UU9rA3oJa94_m45Km0OJpO5w", // 志賀高原熊の湯official
  "UU3zsqZH0S4lIJ5p6HDhjKoQ", // shinyoko snova
  "UUh1csHupXAcvi1erIFJr6QA", // 鹿島槍スキー場 Kashimayari Ski Park
  "UU3FO42o5-Tvl_vP_AZSy2kA", // cvn 治部坂高原スキー場ライブカメラ
  "UU1ddmDCIlasqGm1PItp6AoA", // 上婦負ケーブルテレビ
  "UUIC0IsJemlo5nOVzC_frbMA", // 野沢温泉スキー場 日影スキーセンター NOZAWAONS
  "UU8AHDeJk9r2ko0f2LWp8h1A", // 絶景・猪苗代スキー場
  "UUG7OHvaUVRsBhUWrjzByO1Q", // 猿倉スキー場
  "UUk4bgav5X0rlbGefFnPcuoQ", // チューリップテレビ
  "UUJ9nkytiPcIBv2nPW9tQyWA", // 川場スキー場
  "UUCe-Blxf6Fr9ZBfyEwXFM3A", // 高峰マウンテンリゾート
  "UUIJILlnhQs_OpQeT2VK910A", // 八幡平リゾートlive用
  "UUfg8n0p5zxu4V9l2lnHgyyQ", // 民宿吉野屋
  "UUNQH-lj9U7xZ784LWipLiSg", // 菅平プリンスホテル
  "UUK-174OXa-6JQCniHJvfdwA", // 下倉スキー場ライブカメラ
  "UU-S4QbkUwfm5oF0BzNS0oug", // ほぼ日のライブカメラ
  "UUhwpNG3i-WKvf2ukfU1eWmQ", // 山形県米沢市万世町刈安米沢スキー場ライブカメラ
  "UUzm0_Yoo7McbYosgzlHo5KA", // ホテルこのはなパーキング
  "UUcFHRjoyLgjuKU6amaVh-Jg", // 北八ヶ岳リゾート
  "UUZ2S0Tnt9IxP3oyr3c8vqCQ", // 公益財団法人　天神崎の自然を大切にする会
  "UUpgmC8gaNgrYS1-j2kpgaGQ", // sounds good
  "UUzdRRUjfJh1ff3g_IGzujEA", // 日高町ライブカメラ
  "UUJmcX1-3OyZr7rGWSFc-1rg", // The East Coast Of The Izu Pe
  "UUKqYWckqq6044l6zUxISqkw", // LIVE SHIMODA
  "UUSzlMnbA7Fl0qSIggqllwFg", // WITH SEA
  "UUaHr0a1x8zmQ1dxanCeuesA", // 朝日新聞LIVE
  "UUcNpMZYWUnTNePHU0IO38pQ", // Love, Mitoyo
  "UU4FyIzIkofhBsjgLkUmYxJw", // 和歌山県 西牟婁振興局管内 河川映像
  "UUNkxFS9BAHACmmuo0h4IgOg", // AMAUOTURI
  "UUVvmg_yobAVydMzxUhgelJA", // あきのこと - Akinocoto - Dear all
  "UUmUX6oxTrUegbudWIWtvrYg", // 松原市上下水道管理課
  "UUtpZE6LTRW8gGzD2GCaOcXg", // 土佐の海空と侍猫🐻🐈
  "UUkERHEaKiEZjOAxN1Dr9Cgg", // muturyou
  "UUqpfQ9u1gWxzRhBznFg6TNw", // 和歌山県 東牟婁振興局新宮建設部管内 河川映像
  "UU1kDVgEX2DsE295Bkum_K9Q", // 【LIVE】東京 新宿 鉄道 ライブ Tokyo Shinjuku Live Ch
  "UU9yuSASu1r3dKOvEmZwnptQ", // こだまらいふ Kodama life / Shinkansen Japan bullet train
  "UULizOnUQUuR0FW58PP-ZACA", // 日テレ鉄道部
  "UUE5uxiZBrhwFPwzlSfmdWQA", // Tokyo Akabane Live Camera
  "UU2nzv_yI8NPXVLwWU_psgxQ", // 吉塚ライブカメラ
  "UUjmqhsGQ9J1QK4r5mUrZb4A", // 鉄道沿線の生活
  "UUkE1JbngfWjKngmTSujg_wA", // 千葉県タクシー協会京葉支部 CHIBA TAXI Association Keiyo Branch
  "UUihKyLj79k42fSBvPGRja6Q", // 東武日光駅前ライブチャンネルNIKKO Live channel
  "UU2q20o6JH-dlTdUWn4j0bYQ", // ZAZAマガジンチャンネル2nd
  "UUu76uqpelv-VALL5d6zsljg", // 神田ライブチャンネル(Kanda live channel)
  "UUdfXoTp4-fh3MRQQFzOlPkg", // 【JR東日本】新潟駅発車標ライブカメラ
  "UUdoxbxQNSOTRDi_XZvF6cJw", // 【LIVE】定点カメラ@大阪コロナホテル
  "UUVTfCMdif-dxt-e_ijach_Q", // 道の駅日光 日光街道ニコニコ本陣
  "UUAPMlxH-TQVQNzKgD9V_JEw", // うめたくん
  "UUAaw-OnuKB5FTpBkM0xUZ4Q", // 中条駅観光交流室
  "UU8iN-WKPu820ve-4t9NxHRw", // 新潟ニュース NST　-NIIGATA NEWS NST-
  "UUfRziws8kV_nYxfS9OXz6sQ", // cvn 飯田駅ライブカメラ
  "UUI24HewpQ3XQorXQEjrYPJw", // 近鉄久居駅前ライブカメラ | Lofi Hisai
  "UUhRQpufaxclkezElsQ04VXw", // オノデンch
  "UULbDKpDAkM8O4QVvbdA9h0w", // 福井ケーブルテレビ
  "UUDeNzPNV3K8nNkOsMFRB-sw", // 日本海テレビニュース
  "UUHxsYayZMyj1RbaAgxU0lCQ", // 東北新幹線 アルファライブ
  "UUVOTSwpYrlHK5ZEZrjrRY2w", // MrSolidsolution
  "UUgZl3r4RcelbiD7unKMZnWw", // 金剛山ライブ
  "UUPAuCLWsGBJDaS21WrGy2Jw", // よれっしゃこいっちゃ
  "UUaydvLwWthLMbfKLEQSY2UQ", // 東京都水防チャンネル
  "UU_2ba5MHjCGvIv0xXwL4xZQ", // 群馬県 多野郡 上野村Ueno-village
  "UU1gDeEnSozPenmKLWxIXXyw", // ぐんまの道路ライブカメラ【東部地域】
  "UUg9QtOKSEptfh2IxsqyZ5AA", // 相模川ライブカメラ
  "UUXJ_ME7jWCW7CgrzKUqsD8g", // 徳島県河川整備課
  "UUwKfdA61jpY3Smhu9XxMLHQ", // 5 淀川水系 名張川 宇陀川 服部川 柘植川
  "UU6avbfi8llm_IDkKqBP3Jjg", // 青梅市観光協会
  "UUcwYr4sdrvx3XjdkyHnhtBA", // 国土交通省 北陸地方整備局水災害対策センター
  "UUIcq3oUcaQl6LJkiCpEoQ2Q", // LIVECAM TAKEHARAPORT TADANOUMIPORT JAPAN
  "UUqw94gkzHWi7_CI1j0wmKMA", // 小笠原村ライブカメラ1
  "UUpHT_66E7YVI33nvaVD5KPw", // The Gateway to Rabbit Island | Tadanômi Port
  "UUsRb1ylRjChH7-tQtgRWvXA", // 利島村ライブカメラ
  "UUYR27i2wj9PgsR9fYkpkFFw", // 東京都新橋駅新幹線ライブカメラ
  "UUA0JLMcalIWrwEOv1mgevsw", // ストリーミングアカウント
  "UUIMs8atP2qoxcfAvhiFlzGQ", // Hokkaido Kurashi no Yomimono
  "UUKtFn0R-NGm6cocqdoGAQTA", // 横浜汽車道ライブカメラ /Live Cam Yokohama Japan
  "UULsrKjUSA5LGR5iEl5AdDyg", // My Japan Tracks
  "UUGohMl8EseTMaNo37hAssLA", // 谷川岳ロープウエー株式会社
  "UUiIA2H7KnbK7Wsyhpw1_glw", // fuji-net
  "UURRJZCkzKBkBG1N7duHu6Iw", // エルシーブイ株式会社
  "UUdI9Vn0aIzNOdlIZkAy-VnA", // official MIZNO HOTEL
  "UUaxxRyMskvvbpQMo-VJpNhw", // EN DAIBA GLOBAL
  "UUiVxzgxfn4OhuDygv5o5-mg", // Kariyushi Hotels
  "UUN4r4N7n0nRmyfWbzXHi-Xg", // Motobu Terrace
  "UUkUdb6wh-TE9MK7Q2VTE5-A", // 静岡市さった峠 ライブカメラ
  "UUGW7Cx2p9UI_KffBLVNZ2mw", // ぐんまの道路ライブカメラ【西部地域2】
  "UURDIwmg6CFDF6yRuojYbGPw", // 忍野村公式
  "UUoXSony4Fgr3WS0aLlIBj6A", // 箱根全山ウェブカメラ乙女峠
  "UUVuOdqtmmJod2GmhxlLfmCw", // ぐんまの道路ライブカメラ【北部地域】
  "UURruWUK0POjg2veibHucffQ", // 大阪環状線ライブカメラ
  "UUgJR4NiTcsb4h95YrsheNYw", // KawazuLiveCam
  "UUPSoamgFxuDznR5ZfU3L8TQ", // 【添田町】英彦山ライブカメラ
  "UUE6ExBO-KNOLxTHl6T8E6xQ", // わたらせコウノトリ ライブカメラ
  "UU7qQJi_WE9yNhA48kP6TT0Q", // テレビ岩手TVIニュースチャンネル
  "UU3Upaut8BeI-mkk2EhqtoKA", // 大友産業ライブ
  "UUZd_tQ_bkn3X0qPqeullCXQ", // 株式会社南電工
  "UUpeY0Kqqr90NaC2PsbJpCmg", // 話のわかる工務店【脇坂工務店ch】
  "UUpp9pwi4t0rKWoGvKZaAESA", // ジャガイモンプロジェクト 北海道士幌町
  "UUoAsABBSqFNjJyT2_TUGaLA", // 北海道網走市南四条東ライブカメラ
  "UUcnyFxVfbsx8L3-B0rIFTLg", // オ野朝:oya
  "UUZCRg4W6eUuvFvtdtQjzEbg", // 北海道稚内市中央お天気ライブカメラ
  "UUq5rys-l2Q3m3UTblZyLtaQ", // 【北海道を盛り上げるtv!】酪大放送局 YouTubeチャンネル
  "UUOjK4OYeD9qVZkJJHQKd1iQ", // ニッチワークス DIY
  "UU1i47MzonAVfuCsEQQKHQ1w", // 北海道礼文郡礼文町船泊村大備ライブカメラ
  "UUBHnUlgdM3S5bJyW8tovNOg", // 北海道札幌市北区西茨戸ライブカメラ
  "UUp1PQJKoJfZcfAcYlOh8sKA", // Tetsu Kuro
  "UUrMOS_QpjjeIjMKUMOm4_Qw", // ライブカメラDB
  "UUOZv-6MiXqJdLpmYtR431Ow", // STVニュース北海道
  "UU3PYjBjrkDT8ldDqZAPxG5g", // 北海道標津郡標津町南一条東  文化ホール方面ライブカメラ
  "UUmaziVJb0MhG6QPiKolt2zQ", // 北海道室蘭市八丁平ライブカメラ
  "UU8of44yHh-U747wJoo11jXw", // 北海道札幌市中央区北二条ライブカメラ
  "UUDPcL7hccR_-xbagQ60kL7w", // 北海道網走市緑町ライブカメラ
  "UUM01DB_H-5lPubIgNtzNmXw", // 北海道釧路市大川町釧路川河口ライブカメラ
  "UUsf8dyphRqqn6jqrcwwSypg", // プルテウスレンタカー
  "UUKygUybHX3A3Dmew4-MnqnA", // 北海道滝川市幸町ライブカメラ
  "UUO78VjL2zm866J1YoqDZD-Q", // 北海道札幌市清田区美しが丘一条ライブカメラ
  "UUDniwwb6FPDtoMsVSCVWi6A", // LIVE-HOKKAIDO
  "UU3kfuS_vO1mxYP-YqDgHHHw", // 北海道利尻郡利尻町仙法志御崎海岸ライブカメラ
  "UU8bU0LyP49R7pL49LFwsPsg", // 沖縄NOW!!
  "UUn-Vvet39ErgdWj_iRxWDZw", // 沖縄県那覇市首里汀良町モノレールライブカメラ
  "UUGe19IT7lTLHURGi1yZBGRw", // 定点カメラ部沖縄(Fixed point camera LOVE OKINAWA)
  "UUw-gq5ojQF91k2ldN_VlnLg", // Mr.Kajiku /かじく
  "UUYU8QIKLN7zJNdaNmf9ZUCw", // 【ヤンバルクイナと沖縄の生き物 LIVE】by 道の駅やんばるパイナップルの丘安波
  "UUHmmmuYL1lhaTSvbz_YcrKg", // 沖縄県那覇市字識名お天気ライブカメラ
  "UUU2Q1oGMqU1TWF8nIuoY4gg", // 沖縄県うるま市州崎ライブカメラ
  "UUpTWzGUr4aS45kkpomvU0ww", // SAKURAYA CHANNEL OKINAWA
  "UUbU9TQlRGeBGc9SjUYmsGAw", // 石垣島天文台　有松亘
  "UUv89ldA5wRHQpPqPjy5NEJg", // KuROKO-宮古島映像-
  "UUSgoguyyfrF5m2DpaVdFgMg", // AirTraffic Monitor Japan
  "UUa-m_22VEF-ehvxNmici1OQ", // ニルヤカナヤBISE
  "UUHB8-XbfawI0QsLTryrRnUA", // Live 3D Airport ATC + WX
  "UULA5ElFgxFl2GIbZn440xTg", // 沖縄県島尻郡与那原町字与那原国道331号ライブカメラ
  "UUyVf8FIJ-kFpzUadi7_tgZQ", // 京都観光混雑状況Live
  "UUeSiVkT05ddY7j9UnbmyKIg", // HOTEL KUU KYOTO
  "UUd_j7Zc1KmjHkVyvNIySehQ", // JR京都駅ライブカメラ(JR Kyoto Station LiveCam)
  "UUjPBI3613W2r5R0_QH0_rZQ", // 京都 お天気ライブカメラ Kyoto Live Webcam
  "UUw5a5uXLtBVfxvZlP02bCCQ", // kiyomizu monzen P
  "UUbK8WglSwkj6R0nqcmZH_NQ", // butsuguya(京都の祭、観光地をモバイルライブ配信)
  "UUGYs8S82QtfP__XHQmym1dQ", // KYOTO LIVE CAMERA
  "UUMama-5_obWBruSuYI_GW8Q", // 【公式】Radio171
  "UUL0qeZAgAypio9e0DOyujmg", // 京都府京都市左京区大文字山ライブカメラ
  "UUoZukhk-EBlJbmOcPvHQaag", // 禅居庵
  "UUHnyFp-W5IR5RvRmSYzOHkA", // 京都府八幡市岩田高木ライブカメラ
  "UU6qB8_c5l6y1AJHL_7Rj4ug", // 京都府京都市左京区北白川久保田町ライブカメラ
  "UUHS_cf4svIgX1HJl25wzWGQ", // 愛知県名古屋市天白区野並ライブカメラ
  "UUL0xw6Ir2apIVIaq_ZxIq4A", // 愛知県名古屋市北区如意豊山町方面ライブカメラ
  "UUUo7tLdPMCQZua_l6mmIt5A", // 愛知県名古屋市北区如意ライブカメラ
  "UUvCU_ZbLKwxr4hvZO2ocoDA", // 愛知県名古屋市南区明治ライブカメラ
  "UUeDyTJklgdeV7yVIYiU0Eww", // Ryuichi
  "UUoMUBO51S9Rx_UzCFvCpscg", // 愛知県常滑市大野町 名鉄常滑線ライブカメラ
  "UUzcJ9aYTmI1i6HOPShRmFcw", // 柳ケ瀬TV - 岐阜市 ライブカメラ Gifu Yanagase LIVE camera
  "UU43jgy-6kAJu2kEyHuerdGQ", // NARITASAN SHINSHOJI
  "UUs33DOFYmH27UiQ0twvZRAw", // K55
  "UUV8cS-sTne-cXgYaZqY558A", // 緑川・国土交通省九州地方整備局水災害予報センター・熊本河川国道事務所
  "UUVlb412e3-KxZlONLvqNvWw", // 菊池川・国土交通省九州地方整備局水災害予報センター・菊池川河川事務所
  "UUM8imY-lXNP1t7XrXwP9o4A", // The Wayfarer
  "UU8ZZlK9HyQ7WmLZbamIvwcg", // 球磨川・国土交通省九州地方整備局水災害予報センター・八代河川国道事務所
  "UUdFxgT9x_8ClcEZACt7Ag2g", // 本明川・国土交通省九州地方整備局水災害予報センター・長崎河川国道事務所
  "UUVsaJK99sGmHic5i9K2TKQw", // 遠賀川・国土交通省九州地方整備局水災害予報センター・遠賀川河川事務所
  "UUZHJanz8FfXZ0yWrN2uksJw", // [公式]シーサイドホテル舞子ビラ神戸
  "UUCn1d6KhxWkANtNgRU995Uw", // 白川・国土交通省九州地方整備局水災害予報センター・熊本河川国道事務所
  "UUXjZvKda3koJ5wFzVMv7I2g", // 小丸川・国土交通省九州地方整備局水災害予報センター・宮崎河川国道事務所
  "UUA0fKXM0CJ5dcQosR8pyxRQ", // 五ヶ瀬川・国土交通省九州地方整備局水災害予報センター・延岡河川国道事務所
  "UU5u5693Lw0Zy7cd6yWjU6ZQ", // 嘉瀬川・国土交通省九州地方整備局水災害予報センター・武雄河川事務所
  "UUR3gAq9N4mtRb2NUb7tyWig", // ニューガイアグループ広報
  "UUosDdC0GnImjT6b39a0Ykag", // 【熊本の渋滞状況】コンドル!?
  "UUcoGrsRbhwDXPXE_pW2ICzQ", // 川内川・国土交通省九州地方整備局水災害予報センター・川内川河川事務所
  "UUFfacKhaGlkllMQiATeYCDw", // 山国川・国土交通省九州地方整備局水災害予報センター・山国川河川事務所
  "UUxUHGYdQzshp0DPxHDy9_iQ", // KBN
  "UU_MPR_BZ_39Vkd6MDSpIMkw", // 平等寺
  "UUavlT0ICUqHulNOpbJN-FeA", // 八幡浜市役所
  "UU0NG-mY688Tl5Kp5vqyw6Vg", // 一般社団法人いの町観光協会
  "UUS5Lu_lvzsHqshSod39ncoQ", // 綾川町高山航空公園
  "UUXvHEXCqzgz1jha1o-15bFA", // 笠置キャンプ場 Channel
  "UUpRCfnReHSQfLfnZxb5YSqQ", // JBハイウェイサービス株式会社
  "UUnVwMGjeDTN9CNqk89nxcJg", // 島民11人の島暮らし【でぃーぷまりん深島】
  "UU4e4gaT5BGXjIZ67pmAAb1w", // 松山市清掃施設課チャンネル
  // --- 全国発掘 第3弾（2026-08・実効判定済み・中国地整河川/自治体防災ほか） ---
  "UUUL1r_1rXZEYRovsnrZV4hQ", // 山陰ケーブルビジョン　サブちゃんねる
  "UUxFMuvI5BKx00zH8IxpaQ2g", // 【島根県美郷町公式】ライブカメラCH
  "UU6Md_M1SUOtrryYZC-NZTvA", // TSKライブカメラ
  "UUagfXxy3O7noRW1xlCo5cCQ", // 黒坂ライブカメラ
  "UUIXdQ-7gi2UObkYiaUhn8Qw", // 鳥取砂丘チャンネル
  "UUCDCozZz1umL3bOH_WMa-4Q", // アイ・キャン制作G
  "UUaeMPi5n_AJsMusYoKcfWwg", // 鳥取県米子市ライブカメラ
  "UUhOBawAZ5qKd6vxbM3zbmdA", // つるがチャンネルLIVE
  "UUINbBcbN6CPmqI8kp1WcLTA", // 河川映像配信ch4(広島県内)@国交省中国地整河川部
  "UULoiPCAYF1zm5x8X_TtFqpQ", // 株式会社フォト・パブリッシング
  "UUCkzfRzUHWaM7aTcVWuW6kw", // 道の駅越前おおの荒島の郷
  "UUfqfhA7AQsCEjH8fU2tzF3A", // 福井県タクシー協会
  "UUvsp21TYixwg_vbejtBh-Pg", // 上野学園ホール（広島県立文化芸術ホール）公式
  "UUgYvSHFrrKoZ8Toq7g0tcag", // miobyDoTS【ミオバイドッツ】
  "UUOgfxgmcZrpluvs3796NNRg", // HiroshimaUniv
  "UUG7htRbYqeOf9HZWl86jsmQ", // 河川映像配信ch3(岡山県内)@国交省中国地整河川部
  "UUltYUrT1mr15KFfeJy9mKRQ", // 河川映像配信ch5(山口県内)@国交省中国地整河川部
  "UUI3BBj9L5hMz42ZEvs-LYhg", // 自然公園財団 鳥取支部 大山事業地
  "UUKo2LUB9WylsN4zEwANbc2w", // 河川映像配信ch1(鳥取県内)@国交省中国地整河川部
  "UUtLuiKE5mqWOtd6B5XrMVww", // 河川映像配信ch2(島根県内)@国交省中国地整河川部
  "UUDFaAeHWz9GtSjCeEyv5xjA", // 御縁チャンネル【保護猫の猫宿、ゴールデンレトリバー日記】
  "UUMBkpkdFghMYW6TQp7X77wA", // 石垣島ユーグレナ離島ターミナル側LIVEカメラ
  "UUdrBonsvEq5cEsI3UrOwviw", // 正杰資訊有限公司 Jcomm Ltd.
  "UU4JFp0Ndf5bBtBwYd2WiACA", // 風車小屋 - 瀬戸内海ライブ
  "UUVMMnH7mTPksymujI9jwyjQ", // kogushi
  "UUPC60SwUoYYkiQlBc0ULJPA", // CaaSちゃんねる　CaaS-AI
  "UUCdKPqsk7bM62NUMCbHx_kA", // SKHN
  "UUxlvjPrDJgz9JlPmbMOVBag", // 広島県尾道市東尾道ライブカメラ
  "UUBTzVd-Ne0Ih7nT3ViP9Fqw", // TACHIOKAYA
  "UUo3w8Yc05zmHHAmfX7gk_Nw", // aicafe
  "UUUY22wZDhE6MM4E9F7139nQ", // KRY山口放送ニュース公式チャンネル
  "UUZfeD1g0MGG3bbJKCapS5ug", // konchukan
  "UUDuXIr1FaxcL45cfcJjJulg", // gion-unkai
  "UUn99YdjhClqrN6yAHbIQKbw", // 大分市水害監視カメラ
  "UU0tIwl3Ar4zRIuzsZi6QzYw", // 新潟市 西区 SUNSET
  "UU0Cip1OyEnzqdL6nn6b3VaA", // 南房総いいとこどりライブカメラ
  "UUwnL1oawHTCb7xZw0GzNnmw", // 波崎海洋研究施設
  "UU-NuZ8QbpIIDK8ZhzsOyEpQ", // CAHAYA BULAN
  "UUH11kp2h1ZtmAiZOLWY6pww", // 北海道利尻郡利尻町沓形泉町日本海ライブカメラ
  "UU8Y5mMpRMNLlLWXM3BUKy6Q", // HMTV | Tokyo Bay Live & Archive
  "UUOLGSHF7LfL-2svSfwsnOGQ", // e-CAM(イーカム)チャンネル
  "UUegbJ370w3qoZYALUu0m6yA", // OLA GA TOCHI
  "UUmq3RV8ZLTIv95YrusLyqhQ", // 豊橋市表浜海岸ライブカメラ
  "UUyOcmwwnMTzupEakS2_CRig", // サンエス電気通信株式会社
  "UUE5ajTJVTrsmxZJ-V3y8CLA", // ABA青森朝日放送
  "UUT4jEYvUdpdN9oUALaypGfQ", // Amazing Taitung 台東就醬玩
  "UUnB8WKKEBnfFre7vsPNSJsA", // 伊達市ライブカメラ
  "UU5JpiO6tF8uRAZERl5dMcYQ", // 株式会社若狭組
  "UUjkBGAGXUG-Y49BxshId2Ew", // 東京港クルーズターミナル
  "UU6HD4NVe_LJslBs_j2h_11A", // ～南伊勢ええとこ～ 南伊勢町行政チャンネル
  "UUT_iQ29Udk3XNwHJyPNMrEQ", // 与論町供利港ライブカメラ
  "UU4K74vf5snEHSjYVfytMksw", // SBS（静岡放送）
  "UUv5dlVv4ROVgedDbjVktOOA", // 日南テレビ!
  "UUHhN8zJnQ9tHxue5EG-6C_Q", // 春日井市公式動画チャンネル(KasugaiCity)
  "UUR8RKWznKgXXZSVUr54JNIw", // ベイコム公式YouTubeチャンネル
  "UUdsNCWzRvVy51hWCcqqLOpA", // 志木防災
  "UUVaygvAFK3dhX70IT61bghg", // HADANO-Bridge-View
  "UUyoN_7A4wAhxT1lnkmDNyww", // 8 大和川水系 大和川 佐保川 曽我川
  "UUmZsoFIhz3x2WD6RpgzBsVA", // 4 淀川水系 木津川
  "UUXjqhxiyUIDNWF5qjYC6yCg", // ぐんまの道路ライブカメラ【中部地域2】
  "UUaNkfi08z3Xo3IMEOqWaa2w", // 群馬県庁32階ライブカメラ
  "UUtMHIWQqa1YK-mAKg3E2VOA", // 日本一の星空 長野県阿智村　ライブカメラ配信『日本一の星空 浪合パーク』
  "UUgxPy1pKN9Ah5bj2W9KYvAw", // 徳島 眉山・阿波おどり Live Camera
  "UUHJeBfnqnxCMbmReo_cxKKg", // 日本一の星空 長野県阿智村　ライブカメラ配信『天空の楽園 ヘブンスそのはら』
  "UUSNjhJfI5FVXx8xSDjNJhXQ", // 竹田健康財団
  "UUV8ozQObYE8PG1dGNttDkYg", // 群馬県太田市龍舞町ライブカメラ
  "UUqVgSCGTFvklYcoMaU-tvaA", // 遠野テレビ【公式】Kacomuチャンネル
  "UUc64ahhsLrWNH6XRlVXZFjQ", // 徳島県徳島市応神町古川戎子野ライブカメラ
  "UUxgmra63vcFgLji9jhAad9A", // 住田町【公式】
  "UU5TpCr5-eYaJ784Imt87n4Q", // 八千代市ライブカメラ LIVE YACHIYO
  "UUmSLlWU4A_JEgGwXHF8qjNQ", // 熱海市道路状況公式チャンネル
  "UUOnMCC5xCxGNKnFsT7hASIQ", // ライブカメラ山形
  "UUag8gWmatJmyF6WTZAf6mbw", // 常総デザイン
  "UUbC54g8cx22kk2w0eT-8qOQ", // 京都新聞
  "UU5MNHWRJRJ1buoVIg2sHmCw", // Livetakayama
  "UU9RIm5L_JmPnzSVX5F17CPQ", // セレクトちゃんねる
  "UUGKQq1FLs5D2Z2XbSPLBcvQ", // 天草みぞかショップ
  "UUQ015NynqGkmScpGKXbhCFw", // yagi norihiko
  "UUayPdTOk9BFT4iwkwZOiDpw", // Visit Nakatsugawa【中津川市観光情報】
  "UUJrDvNbGDWn0NcxhOyG8TmA", // 東京千鳥ヶ淵ライブカメラ
  "UU_sNGzPVa-xQhfmuU-aOZmQ", // DTC技術部
  "UUe0IyAHwKBq-ohmOxboQGEg", // 長野県軽井沢町1
  "UUtjoCIS31JfpltaGOZgdFtw", // 和歌山県高野町
  "UU693BB4qlwGfaqoMRsIyI4Q", // 日光市民病院
  "UUYtOWbcS1F56y5SR7HFmjFg", // 志賀高原 横手山・渋峠
  "UUcIywQS2c6bnzf27rg_xy3Q", // 小諸市公式チャンネル komorocity channel
  "UU_wYNBMqbB1SOo7BbY2k-DA", // 富士見高原ゴルフコース
  "UUGzmPMu9JG-u_zK82hc_g_w", // 夏油高原スキー場 / GETO KOGEN SKI RESORT
  "UUrNNR-KdmbpaV-uP_E8UpUg", // ハチ高原【鉢伏山】Live Cam
  "UU57srrDpMhtfYozG3fAHRMQ", // 霧ヶ峰高原ビバルデの丘
  "UU7oOa4k0ct8rvJvMU8znyEg", // 伊豆天城リゾート公式チャンネル
  "UUNt-rAHD7y9ErDC_cO-VfeA", // かみしほろスマートPASSチャンネル
  "UUkO182m4Q6ixdAiK_PjBcjA", // 団地管理組合法人京王富士スバル高原別荘地第一次
  "UUqptvzf0hRAA8lUdYLaPFmw", // 【公式】北海道北斗市役所
  "UUANnelBFKc87b7yujShu75w", // 城島高原cam
  "UUjWRnzuLd-LYnx7x71xemBw", // しらびそ高原
];

// 既定の設定（localStorageに無ければこれを使う）
const DEFAULTS = {
  // --- YouTube ---
  youtubeApiKey: "",
  // 既定ソース: 実在確認済みの再生リスト（DEFAULT_PLAYLISTS）。現在ライブ中のみ表示。
  youtubePlaylists: DEFAULT_PLAYLISTS,
  // 追加のキーワード検索（クォータ消費が大きい[100/回]ので既定OFF）。
  // ONにすると現在ライブ中のカメラを広く探索して件数が増える。重複は自動排除。
  youtubeSearchEnabled: false,
  youtubeSearchQueries: [
    "ライブカメラ", "富士山 ライブ", "海 ライブカメラ", "港 ライブカメラ", "空港 ライブカメラ",
    "駅 ライブカメラ", "川 ライブカメラ", "天気 ライブカメラ", "街 ライブ配信",
    "北海道 ライブカメラ", "東北 ライブカメラ", "東京 ライブカメラ", "横浜 ライブカメラ",
    "名古屋 ライブカメラ", "大阪 ライブカメラ", "京都 ライブカメラ", "神戸 ライブカメラ",
    "広島 ライブカメラ", "福岡 ライブカメラ", "沖縄 ライブカメラ", "live camera japan",
    // 自治体・防災系（公式機関のYouTube配信を拾う）
    "国土交通省 ライブカメラ", "河川 ライブカメラ 配信", "防災 ライブカメラ",
    "ダム ライブカメラ", "道路 ライブカメラ", "市役所 ライブカメラ",
    // 離島・自然・観光系
    "伊豆大島 ライブカメラ", "大島 ライブカメラ", "離島 ライブカメラ", "灯台 ライブカメラ", "滝 ライブカメラ",
    "スキー場 ライブカメラ", "動物園 ライブカメラ", "水族館 ライブカメラ", "商店街 ライブカメラ",
    // 東京都公式「伊豆・小笠原諸島港湾ライブカメラ」（元町港/岡田港/波浮港=大島 等の島嶼港を網羅）
    "伊豆 小笠原 港湾 ライブカメラ",
  ],

  // --- Windy Webcams ---
  windyApiKey: "",
  // ブラウザからの直接fetchはCORSで弾かれる場合があるため、
  // tools/fetch-windy.mjs で生成した data/windy.json をフォールバックに使う。
  windyClientFetch: true,
  // true: ライブ配信(player.live)を持つWindyカメラのみ表示。
  // false: スナップショット/タイムラプス型も含めて全部表示（=件数最大）。
  windyLiveOnly: false,

  // --- 表示 ---
  onlyWorking: true,          // 稼働中のみ表示（既定ON）
  enabledSources: { youtube: true, windy: true, direct: true },
  probeTimeoutMs: 9000,       // 直リンク画像プローブのタイムアウト
  autoRefreshMin: 0,          // 0=自動更新なし。>0で分間隔再チェック
};

const LS_KEY = "lcj.settings.v1";

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch (_) { saved = {}; }
  // config.local.js（gitignore済み）に書いた設定を「常に有効」にする（最優先）。
  // 優先順位: DEFAULTS < localStorage(画面保存) < config.local.js
  // → ファイルに書いた値は、過去の画面保存に邪魔されず確実に効く。
  const local = (typeof window !== "undefined" && window.LCJ_LOCAL) || {};
  const merged = {
    ...DEFAULTS,
    ...saved,
    ...local,
    enabledSources: { ...DEFAULTS.enabledSources, ...(saved.enabledSources || {}), ...(local.enabledSources || {}) },
    // 既定の厳選プレイリスト（島チャンネル等）は常に含める＋保存/ローカルの追加分を和集合
    youtubePlaylists: [...new Set([
      ...DEFAULTS.youtubePlaylists,
      ...(saved.youtubePlaylists || []),
      ...(local.youtubePlaylists || []),
    ])],
    // 検索クエリは画面編集不可。古い保存値で上書きされないよう常に file/DEFAULTS を使う。
    youtubeSearchQueries: local.youtubeSearchQueries || DEFAULTS.youtubeSearchQueries,
  };
  // 鍵は空文字を避けて file→保存→既定の順でフォールバック。
  merged.youtubeApiKey = (local.youtubeApiKey || saved.youtubeApiKey || DEFAULTS.youtubeApiKey || "").trim();
  merged.windyApiKey = (local.windyApiKey || saved.windyApiKey || DEFAULTS.windyApiKey || "").trim();
  return merged;
}

export function saveSettings(patch) {
  // 「画面で実際に変更した項目だけ」を保存する。
  // loadSettings()全体を保存すると、古いDEFAULTSのスナップショットが固定化されて
  // 後からの既定値更新を上書きしてしまうため、生のlocalStorageにpatchだけ重ねる。
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (_) { saved = {}; }
  const next = { ...saved, ...patch };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return loadSettings();
}

// lat/lng がどの地方に属するか。
// bboxは瀬戸内海(中国⇔四国)等で重複するため「先勝ち」だと松山/高松/八幡浜などの四国側が
// 中国に誤ラベルされる。内包する全bboxのうち「地方中心が最も近い」ものを採用して正す。
export function regionOf(lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null, bestD = Infinity;
  for (const r of REGIONS) {
    if (lat >= r.s && lat <= r.n && lng >= r.w && lng <= r.e) {
      const [cy, cx] = r.center;
      const d = (lat - cy) ** 2 + (lng - cx) ** 2;
      if (d < bestD) { bestD = d; best = r.id; }
    }
  }
  return best;
}
