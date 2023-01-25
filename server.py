#!/usr/bin/env python3

# Simple HTTP server script adjusted to set up standard MIME types and return CORS headers.
# Call with '--help' to see command-line syntax.
# Requires Python 3.7 or later.

import sys
import os

from http.server import HTTPServer, SimpleHTTPRequestHandler

hasThreadedServer: bool = sys.version_info.major >= 4 or sys.version_info.minor >= 7
if hasThreadedServer:
  from http.server import ThreadingHTTPServer

THE_ADDRESS: str = "localhost"
THE_PORT: int = 8000
THE_HEADERS_CORS: bool = True
THE_HEADERS_MAX_AGE: int = 2
THE_CHECK_LAST_MODIFIED: bool = True
THE_ROOT_FOLDER: str = os.getcwd()

class CustomHttpRequestHandler (SimpleHTTPRequestHandler):
  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=THE_ROOT_FOLDER, **kwargs)

  def end_headers (self):
    # setup mandatory MIME types
    self.extensions_map.update({
      ".js": "application/javascript",
      ".wasm": "application/wasm",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
    });

    # setup CORS and COEP policies to strict isolation and allowing multi-threaded WebAssembly
    if THE_HEADERS_CORS:
      self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
      self.send_header('Cross-Origin-Opener-Policy',   'same-origin')

    if THE_HEADERS_MAX_AGE != -1:
      self.send_header('Cache-Control', 'max-age={0}'.format (THE_HEADERS_MAX_AGE))

    SimpleHTTPRequestHandler.end_headers(self)

  def do_GET(self):
    if not THE_CHECK_LAST_MODIFIED:
      SimpleHTTPRequestHandler.do_GET(self)
      return

    self.path_local = os.path.join (THE_ROOT_FOLDER, self.path.lstrip ('/'))
    if not os.path.exists (self.path_local) or not os.path.isfile (self.path_local):
      SimpleHTTPRequestHandler.do_GET(self)
      return

    # find MIME type
    aContentType = ([aContentType for ext, aContentType in sorted(self.extensions_map.items(), reverse = True)\
                     if self.path_local.endswith (ext)] + ['application/octet-stream'])[0]

    # check modifications
    aCheckModifDate = self.headers.get ('If-Modified-Since')
    aLastModified = self.date_time_string (os.stat (self.path_local).st_mtime)

    if aLastModified == aCheckModifDate:
      self.protocol_version = 'HTTP/1.1'
      self.send_response (304)
      self.end_headers()
      return

    # return file content
    with open (self.path_local, 'rb') as aFile:
      aFileContent = aFile.read()

    self.protocol_version = 'HTTP/1.1'
    self.send_response (200)
    self.send_header ('Content-Length', len (aFileContent))
    self.send_header ('Content-Type', aContentType)
    self.send_header ('Last-Modified', aLastModified)
    self.end_headers()
    self.wfile.write (aFileContent)
    return

if __name__ == '__main__':
  hasPortArg: bool = False
  aNbArgs: int = len(sys.argv)
  anArgIter: int = 1
  while anArgIter < aNbArgs:
    anArg: str = sys.argv[anArgIter]
    isParsed: bool = False
    if anArgIter + 1 < aNbArgs:
      isParsed = True
      if (anArg.lower() == "--port") or (anArg.lower() == "-port"):
        hasPortArg = True
        anArgIter += 1
        THE_PORT = int(sys.argv[anArgIter])
      elif (anArg.lower() == "--address") or (anArg.lower() == "-address"):
        anArgIter += 1
        THE_ADDRESS = sys.argv[anArgIter]
      elif (anArg.lower() == "--directory") or (anArg.lower() == "-d"):
        anArgIter += 1
        THE_ROOT_FOLDER = sys.argv[anArgIter]
      elif (anArg.lower() == "--cors") or (anArg.lower() == "-cors"):
        anArgIter += 1
        isOn: int = int(sys.argv[anArgIter])
        THE_HEADERS_CORS = isOn != 0
      elif (anArg.lower() == "--threaded") or (anArg.lower() == "-threaded"):
        anArgIter += 1
        isOn: int = int(sys.argv[anArgIter])
        hasThreadedServer = isOn != 0
      elif (anArg.lower() == "--maxage") or (anArg.lower() == "-maxage"):
        anArgIter += 1
        THE_HEADERS_MAX_AGE = int(sys.argv[anArgIter])
      elif (anArg.lower() == "--checklastmodified") or (anArg.lower() == "-checklastmodified"):
        anArgIter += 1
        isOn: int = int(sys.argv[anArgIter])
        THE_CHECK_LAST_MODIFIED = isOn != 0
      else:
        isParsed = False

    if isParsed:
      anArgIter += 1
      continue

    if (anArg.lower() == "--help") or (anArg.lower() == "-help"):
      print ("Usage: server.py [--address ADDRESS]=localhost [--port PORT]=8000\n\
                 [--cors 0|1]=1 [--threaded 0|1]=1 [--directory DIR]=CWD\n\
                 [--maxage SECONDS]=2 [--checklastmodified 0|1]=1")
      sys.exit (0)
    elif not hasPortArg:
      hasPortArg = True
      THE_PORT = int(anArg)
    else:
      print ("Syntax error at '{0}'".format (anArg))
      sys.exit (1)

    anArgIter += 1

  if hasThreadedServer:
    anHttpServer = ThreadingHTTPServer ((THE_ADDRESS, THE_PORT), CustomHttpRequestHandler)
  else:
    anHttpServer = HTTPServer ((THE_ADDRESS, THE_PORT), CustomHttpRequestHandler)

  print ("Serving  http://{0}:{1}/  [CORS:{2} THREADS:{3} MAXAGE:{4}]"
         .format (anHttpServer.server_address[0], anHttpServer.server_address[1], THE_HEADERS_CORS, hasThreadedServer, THE_HEADERS_MAX_AGE))

  anHttpServer.serve_forever()
