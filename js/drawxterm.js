/**
 * Copyright © Kirill Gavrilov, 2021
 */

/**
 * Main class interface - used as a base for initialization of WebAssembly module.
 */
var DRAWEXE =
{

//#region Main interface

  /**
   * Check browser support.
   */
  isWasmSupported: function()
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
  },

  /**
   * Terminal setup - should be called before terminal usage.
   */
  termInit: function()
  {
    this._myTerm = new Terminal({
      cols: 120,
      //fontFamily: `'Courier'`,
      fontFamily: `'Ubuntu Mono', monospace`
      //fontSize: 15,
      //rendererType: 'dom',
    });

    this._myTerm.open (document.getElementById ('termId'));
    if (!this.isWasmSupported())
    {
      this.terminalWrite ("\x1B[31;1mBrowser is too old - WebAssembly support is missing!\n\r"
                        + "Please check updates or install a modern browser.\x1B[0m\n\r");
      return;
    }
    else
    {
      this.terminalWrite ("Loading/preparing 'DRAWEXE.wasm'...");
      setTimeout (() => { this._termWasmLoadProgress() }, 1000);
    }

    this._myTerm.attachCustomKeyEventHandler (theEvent => { return this._onTermKeyEvent (theEvent) });
    this._myTerm.onData ((theEvent) => { this._onTermDataInput (theEvent) });
    this._myTerm.focus();
  },

  /**
   * Print text into terminal.
   */
  terminalWrite: function (theText)
  {
    if (this._myTerm != null)
    {
      this._myTerm.write (theText);
    }
  },

  /**
   * Print normal message into terminal.
   */
  terminalWriteLine: function (theText)
  {
    this.terminalWrite ("\n\r" + theText);
  },

  /**
   * Print trace message into terminal.
   */
  terminalWriteTrace: function (theText)
  {
    this.terminalWrite ("\n\r\x1B[33m" + theText + "\x1B[0m");
  },

  /**
   * Print info message into terminal.
   */
  terminalWriteInfo: function (theText)
  {
    this.terminalWrite ("\n\r\x1B[32;1m" + theText + "\x1B[0m");
  },

  /**
   * Print warning message into terminal.
   */
  terminalWriteWarning: function (theText)
  {
    this.terminalWrite ("\n\r\x1B[33;1m" + theText + "\x1B[0m");
  },

  /**
   * Print error message into terminal.
   */
  terminalWriteError: function (theText)
  {
    this.terminalWrite ("\n\r\x1B[31;1m" + theText + "\x1B[0m");
  },

  /**
   * Move terminal input to the newline with the "Draw> " prefix.
   */
  terminalPrintInputLine: function (theLine)
  {
    this.terminalWrite ("\n\r");
    this.terminalWrite ("\x1B[32;1m" + this._myTermHello + "[" + (++this._myTermInCounter) + "]>\x1B[0m ");
  },

  /**
   * Evaluate a command from the queue.
   */
  termEvaluateCommand: function (theCmd)
  {
    //console.warn(" @@ termEvaluateCommand (" + theCmd + ")");
    if (theCmd !== "")
    {
      this._myTermHistoryPos = -1;
      this._myTermHistory.push (theCmd);
      if (theCmd.startsWith ("jsdownload "))
      {
        this._commandJsdownload (theCmd.substring (11).trim());
      }
      else if (theCmd.startsWith ("jsdown "))
      {
        this._commandJsdownload (theCmd.substring (7).trim());
      }
      else if (theCmd.startsWith ("download "))
      {
        this._commandJsdownload (theCmd.substring (9).trim());
      }
      else if (theCmd.startsWith ("jsupload "))
      {
        this._commandJsupload (theCmd.substring (9).trim());
      }
      else if (theCmd.startsWith ("upload "))
      {
        this._commandJsupload (theCmd.substring (7).trim());
      }
      else
      {
        this.eval (theCmd);
      }
    }
    --this._myNbTermInProgress;
  },

  /**
   * Put command into the execution queue.
   */
  termEvaluate: function (theToPrint)
  {
    var aCmd = this._myTermLine;
    this._myTermLine = "";
    //console.warn(" @@ termEvaluate (" + aCmd + ")");

    // run multiple commands with N*10ms delay so that the user will see the progress
    // (otherwise JavaScript will run all commands in one shot with hanging output)
    ++this._myNbTermInProgress;
    setTimeout (() => {
      if (theToPrint) { this.terminalWrite (aCmd); }
      this.termEvaluateCommand (aCmd);
      this.terminalPrintInputLine ("");
    }, (this._myNbTermInProgress - 1) * 10);
  },

  /**
   * Function to download data to a file.
   * @param {Uint8Array} theData [in] data to download
   * @param {string} theFileName [in] default file name to download data as
   * @param {string} theType [in] data MIME type
   */
  downloadDataFile: function (theData, theFileName, theType)
  {
    var aFileBlob = new Blob ([theData], {type: theType});
    var aLinkElem = document.createElement ("a");
    var anUrl = URL.createObjectURL (aFileBlob);
    aLinkElem.href = anUrl;
    aLinkElem.download = theFileName;
    document.body.appendChild (aLinkElem);
    aLinkElem.click();
    setTimeout (function() {
      document.body.removeChild (aLinkElem);
      window.URL.revokeObjectURL (anUrl);
    }, 0);
  },

  /**
   * Fetch remote file from specified URL and upload it to emulated file system.
   * @param {string} theFileUrl  [in] URL to load
   * @param {string} theFilePath [in] file path on emulated file system (or empty string to take name from URL)
   */
  uploadUrl: function (theFileUrl, theFilePath)
  {
    var aPathSplit = theFileUrl.split ("/");
    var aFileName  = theFileUrl;
    if (aPathSplit.length > 1)
    {
      aFileName = aPathSplit[aPathSplit.length - 1];
    }

    var aFilePath = theFilePath;
    if (aFilePath === "")
    {
      aFilePath = aFileName;
    }

    const aCheckStatusFunc = function (theResponse)
    {
      if (!theResponse.ok) { throw new Error (`HTTP ${theResponse.status} - ${theResponse.statusText}`); }
      return theResponse;
    };
    fetch (theFileUrl)
    .then (theResponse => aCheckStatusFunc (theResponse) && theResponse.arrayBuffer())
    .then (theBuffer => {
      var aDataArray = new Uint8Array (theBuffer);
      this.terminalWriteLine ("uploading file '" + aFileName + "' of size " + aDataArray.length + " bytes to '" + aFilePath + "'...");
      this.FS.writeFile (aFilePath, aDataArray);
      this.terminalPrintInputLine ("");
    })
    .catch (theErr => {
      this.terminalWriteError ("Error: " + theErr);
      this.terminalPrintInputLine ("");
    });
  },

  /**
   * Specify file on the local file system and upload it to emulated file system.
   * @param {string} theFilePath [in] file path on emulated file system (or empty string to take name from file)
   */
  uploadFile: function (theFilePath)
  {
    if (this._myFileInput == null)
    {
      this._myFileInput = document.createElement ("input");
      this._myFileInput.type = "file";
      this._myFileInput.style = "visibility:hidden";
      document.body.appendChild (this._myFileInput);
    }

    this._myFileInput.onchange = () => {
      if (this._myFileInput.files.length == 0)
      {
        this.terminalWriteError ("Error: no file chosen");
        return;
      }

      var aFile = this._myFileInput.files[0];
      var aReader = new FileReader();
      aReader.onload = () => {
        var aFilePath = theFilePath;
        if (aFilePath === "")
        {
          aFilePath = aFile.name;
        }

        var aDataArray = new Uint8Array (aReader.result);
        this.terminalWriteLine ("uploading file '" + aFile.name + "' of size " + aDataArray.length + " bytes to '" + aFilePath + "'...");
        this.FS.writeFile (aFilePath, aDataArray);
        this.terminalPrintInputLine ("")
      };
      aReader.readAsArrayBuffer (aFile);
    };
    this._myFileInput.click();
  },
//#endregion

//!#region Internal methods

  /**
   * Stab indicating some progress while "DRAWEXE.wasm" is not yet loaded.
   */
  _termWasmLoadProgress: function()
  {
    if (this._myIsWasmLoaded) { return; }
    this.terminalWrite (".");
    setTimeout (() => { this._termWasmLoadProgress() }, 1000);
  },

  /**
   * Terminal custom key event handler.
   */
  _onTermKeyEvent: function (theEvent)
  {
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
        for (; this._myTermLine.length > 0; )
        {
          this.terminalWrite ('\b \b');
          this._myTermLine = this._myTermLine.substring (0, this._myTermLine.length - 1);
        }
        if (this._myTermHistory.length <= 0)
        {
          return false;
        }

        if (this._myTermHistoryPos != -1)
        {
          this._myTermHistoryPos += aDir;
          this._myTermHistoryPos = Math.max (Math.min (this._myTermHistoryPos, this._myTermHistory.length - 1), 0);
        }
        else
        {
          this._myTermHistoryPos = this._myTermHistory.length - 1;
        }

        var aHist = this._myTermHistory[this._myTermHistoryPos];
        this._myTermLine = aHist;
        this.terminalWrite (aHist);
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
  },

  /**
   * Terminal data input callback.
   */
  _onTermDataInput: function (theEvent)
  {
    var aNbNewLines = 0;
    for (var anIter = 0; anIter < theEvent.length; ++anIter)
    {
      let aChar = theEvent.charAt (anIter);
      if (aChar === "\x7f")
      {
        if (this._myTermLine.length > 0)
        {
          if (aNbNewLines == 0)
          {
            this.terminalWrite ('\b \b');
          }
          this._myTermLine = this._myTermLine.substring (0, this._myTermLine.length - 1);
        }
      }
      else if (aChar === "\x0d")
      {
        if (this.isComplete (this._myTermLine))
        {
          this.termEvaluate (aNbNewLines != 0);
          ++aNbNewLines;
        }
        else
        {
          this._myTermLine += "\n\r";
          if (aNbNewLines == 0)
          {
            this.terminalWrite ("\n\r> ");
          }
        }
      }
      // if (aChar === "\x1b[A"), "\x1b[B" up/down arrows are handled by attachCustomKeyEventHandler()
      else
      {
        if (aNbNewLines == 0)
        {
          this.terminalWrite (aChar);
        }
        this._myTermLine += aChar;
      }
    }
  },
//#endregion

//#region Additional Tcl commands implemented in JavaScript

  /**
   * Evaluate jsdownload command downloading file from emulated file system.
   */
  _commandJsdownload: function (theArgs)
  {
    var anArgs = theArgs.split (" ");
    if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
    {
      this.terminalWriteError ("Syntax error: wrong number of arguments");
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
      var aData = this.FS.readFile (aFilePath);
      this.terminalWriteLine ("downloading file '" + aFileName + "' of size " + aData.length + " bytes...");
      this.downloadDataFile (aData, aFileName, aType);
    }
    catch (theError)
    {
      this.terminalWriteError ("Error: file '" + aFilePath + "' cannot be read with " + theError);
    }
  },

  /**
   * Evaluate jsupload command uploaded file to emulated file system.
   */
  _commandJsupload: function (theArgs)
  {
    var anArgs = theArgs.split (" ");
    if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
    {
      this.terminalWriteError ("Syntax error: wrong number of arguments");
      return;
    }

    var aFileUrl = anArgs[0];
    var aFilePath = "";
    if (anArgs.length >= 2)
    {
      aFilePath = anArgs[1];
    }

    if (aFileUrl === ".")
    {
      this.uploadFile (aFilePath)
    }
    else
    {
      this.uploadUrl (aFileUrl, aFilePath);
    }
  },
//#endregion

//#region WebAssembly module interface

  /**
   * C++ std::cout callback redirecting to Terminal.
   */
  print: function (theText) {
    console.warn (theText);
    DRAWEXE.terminalWrite ("\n\r");
    DRAWEXE.terminalWrite (theText);
  },

  /**
   * C++ std::cerr callback redirecting to Terminal.
   */
  printErr: function (theText) {
    console.warn (theText);
    DRAWEXE.terminalWrite ("\n\r");
    DRAWEXE.terminalWrite (theText);
  },

  /**
   * C++ Message::Send() callback redirecting to Terminal.
   */
  printMessage: function (theText, theGravity) {
    //console.warn(" @@ printMessage (" + theText + ")");
    switch (theGravity)
    {
      case 0: // trace
        DRAWEXE.terminalWriteTrace (theText);
        return;
      case 1: // info
        DRAWEXE.terminalWriteInfo (theText);
        return;
      case 2: // warning
        DRAWEXE.terminalWriteWarning (theText);
        return;
      case 3: // alarm
      case 4: // fail
        DRAWEXE.terminalWriteError (theText);
        return;
    }
    DRAWEXE.terminalWrite ("\n\r");
    DRAWEXE.terminalWrite (theText);
  },

  /**
   * Callback returning canvas element for OpenGL context.
   */
  canvas: (function() {
    var aCanvas = document.getElementById('occViewerCanvas');
    return aCanvas;
  })(),

  /**
   * Callback returning file path for loading WebAssembly components.
   */
  locateFile: function(thePath, thePrefix) {
    //console.warn(" @@ locateFile(" + thePath + ", " + thePrefix + ")");
    // thePrefix is JS file directory - override location of our DRAWEXE.data
    //return thePrefix + thePath;
    return "wasm32/" + thePath;
  },

  /**
   * WebAssembly module callback on runtime initialization.
   */
  onRuntimeInitialized: function() {
    //
  },
//#endregion

//#region Class properties

  /**
   * Terminal object.
   */
  _myTerm: null,

  /**
   * Terminal hello message.
   */
  _myTermHello: "Draw",

  /**
   * Number of manually entered into Terminal commands.
   */
  _myTermInCounter: 0,

  /**
   * Terminal input.
   */
  _myTermLine: "",

  /**
   * Commands input history (activated by up/down arrows).
   */
  _myTermHistory: [],

  /**
   * Currently displayed item from commands input history (activated by up/down arrows).
   */
  _myTermHistoryPos: -1,

  /**
   * Number of commands queued for sequential processing via setTimout().
   */
  _myNbTermInProgress:  0,

  /**
   * WASM loading state.
   */
  _myIsWasmLoaded: false,

  /**
   * Hidden file input field.
   */
  _myFileInput: null
//#endregion
};

// Try some workarounds to avoid terminal being displayed with standard fonts
// (we want our custom fonts with narrower letters).
DRAWEXE.termInit();
document.fonts.ready.then((fontFaceSet) => {
  //console.log(fontFaceSet.size, 'FontFaces loaded. ' + document.fonts.check("15px 'Ubuntu Mono'"));
  //DRAWEXE.termInit();
  document.getElementById ('termId').style.display = "block";
  //DRAWEXE._myTerm.reset();
  //DRAWEXE._myTerm.setOption('fontFamily', 'Courier');
  //DRAWEXE._myTerm.setOption('fontFamily', 'Ubuntu Mono');
})

//! Create WebAssembly module instance and wait.
const DRAWEXEInitialized = createDRAWEXE(DRAWEXE);
DRAWEXEInitialized.then(function(Module) {
  if (DRAWEXE._myTerm != null)
  {
    DRAWEXE._myIsWasmLoaded = true;
    DRAWEXE.terminalWrite ("\n\r");
    //DRAWEXE.eval("dversion");

    // register JavaScript commands
    DRAWEXE.eval ("help jsdownload "
                + "{jsdownload filePath [fileName]"
                + "\n\t\t: Download file from emulated file system"
                + "\n\t\t:   filePath file path within emulated file system to download;"
                + "\n\t\t:   fileName file name to download.}"
                + " {JavaScript commands}");
    DRAWEXE.eval ("help jsupload "
                + "{jsupload fileUrl [filePath]"
                + "\n\t\t: Upload file to emulated file system"
                + "\n\t\t:   fileUrl  URL on server or . to show open file dialog;"
                + "\n\t\t:   filePath file path within emulated file system to create.}"
                + " {JavaScript commands}");

    DRAWEXE.terminalPrintInputLine ("");
  }
});
