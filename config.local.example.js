// ============================================================================
// config.local.example.js ― ローカル設定のテンプレート（このファイルはコミット可）
// ----------------------------------------------------------------------------
// 使い方:
//   1. このファイルを config.local.js にコピー（cp config.local.example.js config.local.js）
//   2. config.local.js を開いて、自分のAPIキーを貼り付け
//   3. アプリを開くと、ポート/ブラウザが変わってもキー再入力なしで動作
//
// config.local.js は .gitignore 済み（鍵が平文で残るためコミット禁止）。
// ============================================================================
window.LCJ_LOCAL = {
  youtubeApiKey: "",      // YouTube Data API v3 のキー
  windyApiKey: "",        // Windy Webcams のキー
  youtubeSearchEnabled: true,  // キーワード検索で件数を増やす
  windyLiveOnly: false,        // Windyを全件表示（件数最大）
};
