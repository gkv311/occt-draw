// Simple HTTP server script for NodeJS adjusted to set up standard MIME types and return CORS headers.
// Call with '--help' to see command-line syntax.
// Requires NodeJS and with 'live-server' package installed.

// server configuration
let config = {
  host: 'localhost',
  port: 8000,
  root: __dirname, // import.meta.url
  open: false, // open browser
  //logLevel: 2,
  middleware: [],
  // extensions
  customHeadersCors: true,
  customHeadersDump: false,
  customHeadersMaxAge: 0,
};

/** Auxiliary sleep (async) function. */
function sleepTimeout(theMs) {
  return new Promise((theResolve) => setTimeout(theResolve, theMs))
}

/** Function parsing boolean argument */
function parseOnOff(theVal) {
  const aVal = theVal.toLowerCase();
  if (aVal === '1' || aVal === 'on' || aVal === 'true') {
    return 1;
  } else if (aVal === '0' || aVal === 'off' || aVal === 'false') {
    return 0;
  }
  return -1;
}

/** Callback dumping HTTP request into console. */
function httpRequestDump(req, res, next) {
  console.log('req: ', req);
  next();
}

/** Callback adding CORS and COEP headers to HTTP request for multi-threaded WebAssembly. */
function httpRequestCors(req, res, next) {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin');
  next();
}

/** Callback adding CORS and COEP headers to HTTP request for multi-threaded WebAssembly. */
function httpRequestMaxAge(req, res, next) {
  res.setHeader('Cache-Control', `max-age=${config.customHeadersMaxAge}`);
  next();
}

(async() => {
  // process arguments
  let hasPortArg = false;
  const anArgVec = process.argv;
  const aNbArgs  = anArgVec.length;
  for (let anArgIter = 2; anArgIter < aNbArgs; ++anArgIter) {
    const anArg = anArgVec[anArgIter].toLowerCase();
    if ((anArg === '--port' || anArg === '-port') && (anArgIter + 1 < aNbArgs)) {
      hasPortArg = true;
      config.port = Number.parseInt(anArgVec[++anArgIter]);
    } else if ((anArg === '--address' || anArg === '-address') && (anArgIter + 1 < aNbArgs)) {
      config.host = anArgVec[++anArgIter];
    } else if ((anArg === '--directory' || anArg === '-d') && (anArgIter + 1 < aNbArgs)) {
      config.root = anArgVec[++anArgIter];
    } else if ((anArg === '--loglevel' || anArg === '-loglevel') && (anArgIter + 1 < aNbArgs)) {
      config.logLevel = anArgVec[++anArgIter];
    } else if (anArg === '--cors' || anArg === '-cors') {
      const aVal = parseOnOff((anArgIter + 1 < aNbArgs) ? anArgVec[anArgIter + 1] : '');
      if (aVal !== -1) { ++anArgIter; }
      config.customHeadersCors = aVal !== 0;
    } else if (anArg === '--dump' || anArg === '-dump') {
      const aVal = parseOnOff((anArgIter + 1 < aNbArgs) ? anArgVec[anArgIter + 1] : '');
      if (aVal !== -1) { ++anArgIter; }
      config.customHeadersDump = aVal !== 0;
    } else if ((anArg === '--maxage' || anArg === '-maxage') && (anArgIter + 1 < aNbArgs)) {
      config.customHeadersMaxAge = Number.parseInt(anArgVec[++anArgIter]);
    } else if (anArg === '--open' || anArg === '-open') {
      const aVal = parseOnOff((anArgIter + 1 < aNbArgs) ? anArgVec[anArgIter + 1] : '');
      if (aVal !== -1) { ++anArgIter; }
      config.open = aVal !== 0;
    } else if (anArg === '--help' || anArg === '-help') {
      console.info("Usage: node server.js [--address ADDRESS]=localhost [--port PORT]=8000\n\
                      [--cors 0|1]=1 [--dump 0|1]=0 [--directory DIR]=CWD\n\
                      [--maxage SECONDS]=0\n\
                      [--open 0|1]=0");
      return;
    } else if (!hasPortArg && !Number.isNaN(Number.parseInt(anArg))) {
      hasPortArg = true;
      config.port = Number.parseInt(anArg);
    } else {
      throw Error(`Syntax error at '${anArg}'`);
    }
  }

  if (config.customHeadersDump) { config.middleware.push(httpRequestDump); }
  if (config.customHeadersCors) { config.middleware.push(httpRequestCors); }
  if (config.customHeadersMaxAge !== 0) { config.middleware.push(httpRequestMaxAge); }

  // load package
  const liveServer = require('live-server');

  let aServer = liveServer.start(config);

  // server is started in background, but there is no Promise to wait for it...
  //await sleepTimeout(500);
  //liveServer.shutdown();
})();
