/**
 * Copyright © Kirill Gavrilov, 2021
 */

/**
 * Main class interface - used as a base for initialization of WebAssembly module.
 */
class DrawTerm
{

//#region Main interface

  /**
   * Check browser support.
   */
  isWasmSupported() // static
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
    catch (theErr) {}
    return false;
  }

  /**
   * Terminal setup.
   */
  constructor()
  {
  //#region Class properties
    // use old initialization style for compatibility with old browsers
    this._myTerm = null;          // Terminal object
    this._myTermHello = "Draw";   // Terminal hello message
    this._myTermInCounter = 0;    // Number of manually entered into Terminal commands
    this._myTermLine = "";        // Terminal input
    this._myTermHistory = [];     // Commands input history (activated by up/down arrows)
    this._myTermHistoryPos  = -1; // Currently displayed item from commands input history (activated by up/down arrows)
    this._myNbTermInProgress = 0; // Number of commands queued for sequential processing via setTimout()
    this._myIsWasmLoaded = false; // WASM loading state
    this._myFileInput = null;     // Hidden file input field

    // define WebGL canvas for WebAssembly viewer
    this.canvas = document.getElementById ('occViewerCanvas'); // canvas element for OpenGL context
    this.canvas.tabIndex = -1;
    this.canvas.onclick = (theEvent) =>
    {
      this.canvas.focus()
    };

    // tell Emscripten and Draw Harness to not use std::cin for commands input
    this.noExitRuntime = true;

    // bind WebAssembly callbacks to this context
    this.print        = this.print.bind (this);
    this.printErr     = this.printErr.bind (this);
    this.printMessage = this.printMessage.bind (this);
  //#endregion

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
  }

  /**
   * Print text into terminal.
   */
  terminalWrite (theText)
  {
    if (this._myTerm != null)
    {
      this._myTerm.write (theText);
    }
  }

  /**
   * Print normal message into terminal.
   */
  terminalWriteLine (theText)
  {
    this.terminalWrite ("\n\r" + theText);
  }

  /**
   * Print trace message into terminal.
   */
  terminalWriteTrace (theText)
  {
    this.terminalWrite ("\n\r\x1B[33m" + theText + "\x1B[0m");
  }

  /**
   * Print info message into terminal.
   */
  terminalWriteInfo (theText)
  {
    this.terminalWrite ("\n\r\x1B[32;1m" + theText + "\x1B[0m");
  }

  /**
   * Print warning message into terminal.
   */
  terminalWriteWarning (theText)
  {
    this.terminalWrite ("\n\r\x1B[33;1m" + theText + "\x1B[0m");
  }

  /**
   * Print error message into terminal.
   */
  terminalWriteError (theText)
  {
    this.terminalWrite ("\n\r\x1B[31;1m" + theText + "\x1B[0m");
  }

  /**
   * Move terminal input to the newline with the "Draw> " prefix.
   */
  terminalPrintInputLine (theLine)
  {
    this.terminalWrite ("\n\r");
    this.terminalWrite ("\x1B[32;1m" + this._myTermHello + "[" + (++this._myTermInCounter) + "]>\x1B[0m ");
  }

  /**
   * Evaluate a command from the queue.
   */
  termEvaluateCommand (theCmd)
  {
    //console.warn(" @@ termEvaluateCommand (" + theCmd + ")");
    if (theCmd !== "")
    {
      this._myTermHistoryPos = -1;
      this._myTermHistory.push (theCmd);
      try
      {
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
      catch (theErr)
      {
        this.terminalWriteError ("Internal error: " + theErr);
        this.terminalPrintInputLine ("");
        throw theErr;
      }
    }
    --this._myNbTermInProgress;
  }

  /**
   * Put command into the execution queue.
   */
  termEvaluate (theToPrint)
  {
    let aCmd = this._myTermLine;
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
  }

  /**
   * Function to download data to a file.
   * @param {Uint8Array} theData [in] data to download
   * @param {string} theFileName [in] default file name to download data as
   * @param {string} theType [in] data MIME type
   */
  downloadDataFile (theData, theFileName, theType)
  {
    let aFileBlob = new Blob ([theData], { type: theType });
    let aLinkElem = document.createElement ("a");
    let anUrl = URL.createObjectURL (aFileBlob);
    aLinkElem.href = anUrl;
    aLinkElem.download = theFileName;
    document.body.appendChild (aLinkElem);
    aLinkElem.click();
    setTimeout (function() {
      document.body.removeChild (aLinkElem);
      window.URL.revokeObjectURL (anUrl);
    }, 0);
  }

  /**
   * Fetch remote file from specified URL and upload it to emulated file system.
   * @param {string} theFileUrl  [in] URL to load
   * @param {string} theFilePath [in] file path on emulated file system (or empty string to take name from URL)
   */
  uploadUrl (theFileUrl, theFilePath)
  {
    let aPathSplit = theFileUrl.split ("/");
    let aFileName  = theFileUrl;
    if (aPathSplit.length > 1)
    {
      aFileName = aPathSplit[aPathSplit.length - 1];
    }

    let aFilePath = theFilePath;
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
      let aDataArray = new Uint8Array (theBuffer);
      this.terminalWriteLine ("uploading file '" + aFileName + "' of size " + aDataArray.length + " bytes to '" + aFilePath + "'...");
      this.FS.writeFile (aFilePath, aDataArray);
      this.terminalPrintInputLine ("");
    })
    .catch (theErr => {
      this.terminalWriteError ("Error: " + theErr);
      this.terminalPrintInputLine ("");
    });
  }

  /**
   * Specify file on the local file system and upload it to emulated file system.
   * @param {string} theFilePath [in] file path on emulated file system (or empty string to take name from file)
   */
  uploadFile (theFilePath)
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

      let aFile = this._myFileInput.files[0];
      let aReader = new FileReader();
      aReader.onload = () => {
        let aFilePath = theFilePath;
        if (aFilePath === "")
        {
          aFilePath = aFile.name;
        }

        let aDataArray = new Uint8Array (aReader.result);
        this.terminalWriteLine ("uploading file '" + aFile.name + "' of size " + aDataArray.length + " bytes to '" + aFilePath + "'...");
        this.FS.writeFile (aFilePath, aDataArray);
        this.terminalPrintInputLine ("")
      };
      aReader.readAsArrayBuffer (aFile);
    };
    this._myFileInput.click();
  }
//#endregion

//!#region Internal methods

  /**
   * Stab indicating some progress while "DRAWEXE.wasm" is not yet loaded.
   */
  _termWasmLoadProgress()
  {
    if (this._myIsWasmLoaded) { return; }
    this.terminalWrite (".");
    setTimeout (() => { this._termWasmLoadProgress() }, 1000);
  }

  /**
   * Terminal custom key event handler.
   */
  _onTermKeyEvent (theEvent)
  {
    switch (theEvent.keyCode)
    {
      case 38: // ArrowUp
      case 40: // ArrowDown
      {
        // override up/down arrows to navigate through input history
        let aDir = theEvent.keyCode === 38 ? -1 : 1;
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

        let aHist = this._myTermHistory[this._myTermHistoryPos];
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
  }

  /**
   * Terminal data input callback.
   */
  _onTermDataInput (theEvent)
  {
    let aNbNewLines = 0;
    for (let anIter = 0; anIter < theEvent.length; ++anIter)
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
  }
//#endregion

//#region Additional Tcl commands implemented in JavaScript

  /**
   * Evaluate jsdownload command downloading file from emulated file system.
   */
  _commandJsdownload (theArgs)
  {
    let anArgs = theArgs.split (" ");
    if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
    {
      this.terminalWriteError ("Syntax error: wrong number of arguments");
      return;
    }

    let aFilePath = anArgs[0];
    let aFileName = aFilePath;
    if (anArgs.length >= 2)
    {
      aFileName = anArgs[1];
    }
    else
    {
      let aPathSplit = aFilePath.split ("/");
      if (aPathSplit.length > 1)
      {
        aFileName = aPathSplit[aPathSplit.length - 1];
      }
    }

    let aNameLower = aFilePath.toLowerCase();
    let aType = "application/octet-stream";
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
      let aData = this.FS.readFile (aFilePath);
      this.terminalWriteLine ("downloading file '" + aFileName + "' of size " + aData.length + " bytes...");
      this.downloadDataFile (aData, aFileName, aType);
    }
    catch (theError)
    {
      this.terminalWriteError ("Error: file '" + aFilePath + "' cannot be read with " + theError);
    }
  }

  /**
   * Evaluate jsupload command uploaded file to emulated file system.
   */
  _commandJsupload (theArgs)
  {
    let anArgs = theArgs.split (" ");
    if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
    {
      this.terminalWriteError ("Syntax error: wrong number of arguments");
      return;
    }

    let aFileUrl = anArgs[0];
    let aFilePath = "";
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
  }
//#endregion

//#region WebAssembly module interface

  /**
   * C++ std::cout callback redirecting to Terminal.
   */
  print (theText) {
    console.warn (theText);
    this.terminalWrite ("\n\r");
    this.terminalWrite (theText);
  }

  /**
   * C++ std::cerr callback redirecting to Terminal.
   */
  printErr (theText) {
    console.warn (theText);
    this.terminalWrite ("\n\r");
    this.terminalWrite (theText);
  }

  /**
   * C++ Message::Send() callback redirecting to Terminal.
   */
  printMessage (theText, theGravity) {
    //console.warn(" @@ printMessage (" + theText + ")");
    switch (theGravity)
    {
      case 0: // trace
        this.terminalWriteTrace (theText);
        return;
      case 1: // info
        this.terminalWriteInfo (theText);
        return;
      case 2: // warning
        this.terminalWriteWarning (theText);
        return;
      case 3: // alarm
      case 4: // fail
        this.terminalWriteError (theText);
        return;
    }
    this.terminalWrite ("\n\r");
    this.terminalWrite (theText);
  }

  /**
   * Callback returning file path for loading WebAssembly components.
   */
  locateFile (thePath, thePrefix) {
    //console.warn(" @@ locateFile(" + thePath + ", " + thePrefix + ")");
    // thePrefix is JS file directory - override location of our DRAWEXE.data
    //return thePrefix + thePath;
    return "wasm32/" + thePath;
  }

  /**
   * WebAssembly module callback on runtime initialization.
   */
  onRuntimeInitialized() {
    //
  }

  /**
   * WASM creation callback - manually called from Promise.
   */
  _onWasmCreated (theModule)
  {
    //let Module = theModule;
    this._myIsWasmLoaded = true;
    this.terminalWrite ("\n\r");
    //this.eval ("dversion");

    // register JavaScript commands
    this.eval ("help jsdownload "
             + "{jsdownload filePath [fileName]"
             + "\n\t\t: Download file from emulated file system"
             + "\n\t\t:   filePath file path within emulated file system to download;"
             + "\n\t\t:   fileName file name to download.}"
             + " {JavaScript commands}");
    this.eval ("help jsupload "
             + "{jsupload fileUrl [filePath]"
             + "\n\t\t: Upload file to emulated file system"
             + "\n\t\t:   fileUrl  URL on server or . to show open file dialog;"
             + "\n\t\t:   filePath file path within emulated file system to create.}"
             + " {JavaScript commands}");

    this.terminalPrintInputLine ("");
  }
//#endregion

};

//! Create WebAssembly module instance and wait.
var DRAWEXE = new DrawTerm();
var aDrawWasmLoader = createDRAWEXE (DRAWEXE);
aDrawWasmLoader.catch ((theError) =>
{
  DRAWEXE._myIsWasmLoaded = true;
  DRAWEXE.terminalWriteError ("WebAssebly initialization has failed:\r\n" + theError);
});

document.fonts.ready.then ((theFontFaceSet) => {
  // Try some workarounds to avoid terminal being displayed with standard fonts
  // (we want our custom fonts with narrower letters).
  //console.log (theFontFaceSet.size, 'FontFaces loaded. ' + document.fonts.check("15px 'Ubuntu Mono'"));
  document.getElementById ('termId').style.display = "block";
  //DRAWEXE._myTerm.reset();
  //DRAWEXE._myTerm.setOption('fontFamily', 'Courier');
  //DRAWEXE._myTerm.setOption('fontFamily', 'Ubuntu Mono');
  return aDrawWasmLoader;
}).then ((theModule) =>
{
  DRAWEXE._onWasmCreated (theModule)
  return Promise.resolve (true);
}).catch ((theError) =>
{
  //
});
