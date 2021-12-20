#!/usr/bin/env python3

# Run it from install folder with optional port argument
from http.server import HTTPServer, SimpleHTTPRequestHandler, test
import sys
class CORSRequestHandler (SimpleHTTPRequestHandler):
  def end_headers (self):
    # setup mandatory MIME types
    self.extensions_map.update({
      ".js": "application/javascript",
      ".wasm": "application/wasm",
    });

    # setup CORS and COEP policies to strict isolation and allowing multi-threaded WebAssembly
    self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
    self.send_header('Cross-Origin-Opener-Policy',   'same-origin')
    SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
  aPort = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
  test(CORSRequestHandler, HTTPServer, port=aPort)
