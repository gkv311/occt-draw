// Copyright © Kirill Gavrilov, 2021

//! Check browser support.
function isWasmSupported()
{
  try
  {
    if (typeof WebAssembly === "object"
     && typeof WebAssembly.instantiate === "function")
    {
      const aDummyModule = new WebAssembly.Module (Uint8Array.of (0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (aDummyModule instanceof WebAssembly.Module)
      {
        return new WebAssembly.Instance (aDummyModule) instanceof WebAssembly.Instance;
      }
    }
  }
  catch (e) {}
  return false;
}

var aTerm = null;
var THE_TERM_NAME = "Draw";
var aTermInCounter = 0;
var aTermLine = "";
var aTermHistory = [];
var aTermHistoryPos = -1;
var aNbTermInProgress = 0;
var isWasmLoaded = false;

//! Print normal message into terminal.
function termPrintMessage (theText)
{
  aTerm.write ("\n\r" + theText);
}

//! Print trace message into terminal.
function termPrintTrace (theText)
{
  aTerm.write ("\n\r\x1B[33m" + theText + "\x1B[0m");
}

//! Print info message into terminal.
function termPrintInfo (theText)
{
  aTerm.write ("\n\r\x1B[32;1m" + theText + "\x1B[0m");
}

//! Print warning message into terminal.
function termPrintWarning (theText)
{
  aTerm.write ("\n\r\x1B[33;1m" + theText + "\x1B[0m");
}

//! Print error message into terminal.
function termPrintError (theText)
{
  aTerm.write ("\n\r\x1B[31;1m" + theText + "\x1B[0m");
}

//! Function to download data to a file.
function termFileDownload (theData, theFileName, theType)
{
  var aFileBlob = new Blob ([theData], {type: theType});
  var aLinkElem = document.createElement("a");
  var anUrl = URL.createObjectURL (aFileBlob);
  aLinkElem.href = anUrl;
  aLinkElem.download = theFileName;
  document.body.appendChild (aLinkElem);
  aLinkElem.click();
  setTimeout (function() {
    document.body.removeChild (aLinkElem);
    window.URL.revokeObjectURL (anUrl);
  }, 0);
}

//! Evaluate a jsdownload command.
function termJsdownload (theArgs)
{
  console.warn(" @@ termJsdownload (" + theArgs + ")");
  var anArgs = theArgs.split (" ");
  if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
  {
    termPrintError ("Syntax error: wrong number of arguments");
    return;
  }
  var aFilePath = anArgs[0];
  var aFileName = aFilePath;
  if (anArgs.length >= 2)
  {
    aFileName = anArgs[1];
  }
  else
  {
    var aPathSplit = aFilePath.split ("/");
    if (aPathSplit.length > 1)
    {
      aFileName = aPathSplit[aPathSplit.length - 1];
    }
  }

  var aNameLower = aFilePath.toLowerCase();
  var aType = "application/octet-stream";
  if (aNameLower.endsWith (".png"))
  {
    aType = "image/png";
  }
  else if (aNameLower.endsWith (".jpg")
        || aNameLower.endsWith (".jpeg"))
  {
    aType = "image/jpeg";
  }
  try
  {
    var aData = DRAWEXE.FS.readFile (aFilePath);
    //console.warn(" @@ aData= (" + aData + ")");
    termPrintMessage ("downloading file '" + aFileName + "' of size " + aData.length + " bytes...");
    termFileDownload (aData, aFileName, aType);
  }
  catch (theError)
  {
    termPrintError ("Error: file '" + aFilePath + "' cannot be read with " + theError);
    return;
  }
}

//! Move terminal input to the newline with the "Draw> " prefix.
function termPrintInputLine (theLine)
{
  aTerm.write ("\n\r");
  aTerm.write ("\x1B[32;1m" + THE_TERM_NAME + "[" + (++aTermInCounter) + "]>\x1B[0m ");
}

//! Evaluate a command from the queue.
function termEvaluateCommand (theCmd)
{
//console.warn(" @@ termEvaluateCommand (" + theCmd + ")");
  if (theCmd !== "")
  {
    aTermHistoryPos = -1;
    aTermHistory.push (theCmd);
    if (theCmd.startsWith ("jsdownload "))
    {
      termJsdownload (theCmd.substring (11).trim());
    }
    else if (theCmd.startsWith ("jsdown "))
    {
      termJsdownload (theCmd.substring (7).trim());
    }
    else
    {
      DRAWEXE.eval (theCmd);
    }
  }
  --aNbTermInProgress;
}

//! Put command into the execution queue.
function termEvaluate (theToPrint)
{
  var aCmd = aTermLine;
  aTermLine = "";
//console.warn(" @@ termEvaluate (" + aCmd + ")");

  // run multiple commands with N*10ms delay so that the user will see the progress
  // (otherwise JavaScript will run all commands in one shot with hanging output)
  ++aNbTermInProgress;
  setTimeout (function() {
    if (theToPrint) { aTerm.write (aCmd); }
    termEvaluateCommand (aCmd);
    termPrintInputLine ("");
  }, (aNbTermInProgress - 1) * 10);
}

//! Stab indicating some progress while "DRAWEXE.wasm" is not yet loaded.
function termWasmLoadProgress()
{
  if (isWasmLoaded) { return; }
  aTerm.write (".");
  setTimeout (termWasmLoadProgress, 1000);
}

//! Terminal setup.
function termInit()
{
  aTerm = new Terminal({
    cols: 120,
    //fontFamily: `'Courier'`,
    fontFamily: `'Ubuntu Mono', monospace`
    //fontSize: 15,
    //rendererType: 'dom',
  });

  aTerm.open (document.getElementById ('termId'));
  if (!isWasmSupported())
  {
    aTerm.write ("\x1B[31;1mBrowser is too old - WebAssembly support is missing!\n\r"
               + "Please check updates or install a modern browser.\x1B[0m\n\r");
    return;
  }
  else
  {
    aTerm.write ("Loading/preparing 'DRAWEXE.wasm'...");
    setTimeout (termWasmLoadProgress, 1000);
  }

  aTerm.attachCustomKeyEventHandler (theEvent => {
    switch (theEvent.keyCode)
    {
      case 38: // ArrowUp
      case 40: // ArrowDown
      {
        // override up/down arrows to navigate through input history
        var aDir = theEvent.keyCode === 38 ? -1 : 1;
        if (theEvent.type !== "keydown")
        {
          return false;
        }

        // clear current input
        for (; aTermLine.length > 0; )
        {
          aTerm.write ('\b \b');
          aTermLine = aTermLine.substring (0, aTermLine.length - 1);
        }
        if (aTermHistory.length <= 0)
        {
          return false;
        }

        if (aTermHistoryPos != -1)
        {
          aTermHistoryPos += aDir;
          aTermHistoryPos = Math.max (Math.min (aTermHistoryPos, aTermHistory.length - 1), 0);
        }
        else
        {
          aTermHistoryPos = aTermHistory.length - 1;
        }

        var aHist = aTermHistory[aTermHistoryPos];
        aTermLine = aHist;
        aTerm.write (aHist);
        return false;
      }
      case 37: // ArrowLeft
      case 39: // ArrowRight
      case 46: // Delete
      {
        return false;
      }
      case 33: // PageUp
      case 34: // PageDown
      case 35: // End
      case 36: // Home
      {
        return false;
      }
    }
    return true;
  });
  aTerm.onData(theEvent => {
    var aNbNewLines = 0;
    for (var anIter = 0; anIter < theEvent.length; ++anIter)
    {
      let aChar = theEvent.charAt (anIter);
      if (aChar === "\x7f")
      {
        if (aTermLine.length > 0)
        {
          if (aNbNewLines == 0)
          {
            aTerm.write ('\b \b');
          }
          aTermLine = aTermLine.substring (0, aTermLine.length - 1);
        }
      }
      else if (aChar === "\x0d")
      {
        if (DRAWEXE.isComplete (aTermLine))
        {
          termEvaluate (aNbNewLines != 0);
          ++aNbNewLines;
        }
        else
        {
          aTermLine += "\n\r";
          if (aNbNewLines == 0)
          {
            aTerm.write ("\n\r> ");
          }
        }
      }
      // if (aChar === "\x1b[A"), "\x1b[B" up/down arrows are handled by attachCustomKeyEventHandler()
      else
      {
        if (aNbNewLines == 0)
        {
          aTerm.write (aChar);
        }
        aTermLine += aChar;
      }
    }
  });
  aTerm.focus();
}

// Try some workarounds to avoid terminal being displayed with standard fonts
// (we want our custom fonts with narrower letters).
termInit();
document.fonts.ready.then((fontFaceSet) => {
  //console.log(fontFaceSet.size, 'FontFaces loaded. ' + document.fonts.check("15px 'Ubuntu Mono'"));
  //termInit();
  document.getElementById ('termId').style.display = "block";
  //aTerm.reset();
  //aTerm.setOption('fontFamily', 'Courier');
  //aTerm.setOption('fontFamily', 'Ubuntu Mono');
})

//! Setup WebAssembly module callbacks.
var DRAWEXE =
{
  print: (function() {
    var anElement = document.getElementById('output');
    return function(theText) {
      console.warn(theText);
      aTerm.write ("\n\r");
      aTerm.write (theText);
    };
  })(),
  printErr: function(theText) {
    console.warn(theText);
    aTerm.write ("\n\r");
    aTerm.write (theText);
  },
  printMessage: function(theText, theGravity) {
    //console.warn(" @@ printMessage (" + theText + ")");
    switch (theGravity)
    {
      case 0: // trace
        termPrintTrace (theText);
        return;
      case 1: // info
        termPrintInfo (theText);
        return;
      case 2: // warning
        termPrintWarning (theText);
        return;
      case 3: // alarm
      case 4: // fail
        termPrintError (theText);
        return;
    }
    aTerm.write ("\n\r");
    aTerm.write (theText);
  },
  canvas: (function() {
    var aCanvas = document.getElementById('occViewerCanvas');
    return aCanvas;
  })(),
  locateFile: function(thePath, thePrefix) {
    //console.warn(" @@ locateFile(" + thePath + ", " + thePrefix + ")");
    // thePrefix is JS file directory - override location of our DRAWEXE.data
    //return thePrefix + thePath;
    return "wasm32/" + thePath;
  },

  onRuntimeInitialized: function() {
    //
  }
};

//! Create WebAssembly module instance and wait.
const DRAWEXEInitialized = createDRAWEXE(DRAWEXE);
DRAWEXEInitialized.then(function(Module) {
  if (aTerm != null)
  {
    isWasmLoaded = true;
    aTerm.write ("\n\r");
    //DRAWEXE.eval("dversion");

    // register JavaScript commands
    DRAWEXE.eval ("help jsdownload "
                + "{jsdownload filePath [fileName]"
                + "\n\t\t: Download file from emulated file system}"
                + " {JavaScript commands}");

    termPrintInputLine ("");
  }
});
