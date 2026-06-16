#!/usr/bin/env python3
# ============================================================================
# serve.py ― 開発用の静的サーバー（no-cache）
# ----------------------------------------------------------------------------
# ブラウザがJS/JSON/HTMLをキャッシュして「編集が反映されない」問題を防ぐため、
# すべてのレスポンスに Cache-Control: no-store を付けて配信する。
#
#   python3 serve.py            # ポート8011で起動
#   python3 serve.py 8000       # ポート指定
# ============================================================================
import os
import sys
import http.server
import socketserver

# このスクリプトのあるディレクトリ（= live-cam-japan）を配信ルートにする
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8011


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True  # 再起動時に「アドレス使用中」を避ける


with Server(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving live-cam-japan on http://localhost:{PORT}  (no-cache)")
    httpd.serve_forever()
