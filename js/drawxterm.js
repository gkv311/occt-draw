/**
 * Copyright © Kirill Gavrilov, 2021
 */

/**
 * Command in queue to execute.
 */
class DrawCommand
{
  /**
   * Main constructor.
   * @param[in] {string} theCmd command to execute
   * @param[in] {boolean} theToEcho print command to terminal
   */
  constructor (theCmd, theToEcho)
  {
    this.command = theCmd;
    this.toEcho  = theToEcho;
    this._myNext = null;
  }
};

/**
 * Queue of commands to execute.
 */
class DrawCommandQueue
{
  /**
   * Empty constructor.
   */
  constructor()
  {
    this._myFirst  = null;
    this._myLast   = null;
    this._myLength = 0;
  }

  /**
   * @return {boolean} TRUE if queue is empty
   */
  isEmpty()
  {
    return this._myLength === 0;
  }

  /**
   * @return {number} queue extent
   */
  extent()
  {
    return this._myLength;
  }

  /**
   * Add new command at the end of the queue.
   * @param[in] {DrawCommand} command to append into queue
   */
  add (theCmd)
  {
    if (this._myLast != null)
    {
      this._myLast._myNext = theCmd;
      this._myLast = theCmd;
      this._myLength += 1;
    }
    else
    {
      this._myFirst  = theCmd;
      this._myLast   = theCmd;
      this._myLength = 1;
    }
  }

  /**
   * Remove the first command in the queue and return it.
   * @return {DrawCommand} first command or NULL
   */
  pop()
  {
    if (this._myFirst == null)
    {
      return null;
    }

    let anItem = this._myFirst;
    this._myFirst = anItem._myNext;
    this._myLength -= 1;
    if (this._myLength === 0)
    {
      this._myLast = null;
    }

    anItem._myNext = null;
    return anItem;
  }
};

// prefix for DRAWEXE.data location
let _DRAWTERM_BASE_PREFIX = "/";
if (document.currentScript && document.currentScript.src.endsWith ("js/drawxterm.js"))
{
  // note - this will not work properly while importing module
  _DRAWTERM_BASE_PREFIX = document.currentScript.src.substring (0, document.currentScript.src.length - "js/drawxterm.js".length);
}

/**
 * Main class interface - used as a base for initialization of WebAssembly module.
 */
class DrawTerm
{

//#region Main interface

  /**
   * Check browser support.
   * @return {boolean} TRUE if WASM supported
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
   * Check if multithreading is allowed.
   */
  isAllowMultithreading()
  {
    return window.Worker !== undefined && window.Atomics !== undefined
        && window.SharedArrayBuffer !== undefined;
  }

  /**
   * Init Module and load WASM file.
   */
  async init()
  {
    // Try some workarounds to avoid terminal being displayed with standard fonts
    // (we want our custom fonts with narrower letters).
    document.fonts.ready.then ((theFontFaceSet) =>
    {
      //console.log (theFontFaceSet.size, 'FontFaces loaded. ' + document.fonts.check("15px 'Ubuntu Mono'"));
      document.getElementById ('termId').style.display = "block";
      //this._myTerm.reset();
      //this._myTerm.setOption('fontFamily', 'Courier');
      //this._myTerm.setOption('fontFamily', 'Ubuntu Mono');
    });

    let anErr = null;
    this.setBasePrefix (_DRAWTERM_BASE_PREFIX);

    let aBackProps = {};
    for (var aPropIter in this) { aBackProps[aPropIter] = this[aPropIter]; }

    try
    {
      await this.wasmLoad();
      //await createDRAWEXE (this);
    }
    catch (theErr1)
    {
      let toLoadThreads = this._myToPreferPthread && this.isAllowMultithreading();
      if (toLoadThreads)
      {
        try
        {
          // remove partially initialized fields
          for (var aPropIter in this)
          {
            if (aBackProps[aPropIter] === undefined) { delete this[aPropIter]; }
          }

          this._myIsWasmLoaded = false;
          this._myToPreferPthread = false;
          await this.wasmLoad();

          this.terminalWriteError (theErr1 + " [fallback to '" + this._myWasmBuild + "']");
        }
        catch (theErr2)
        {
          anErr = theErr2;
        }
      }
      else
      {
        anErr = theErr1;
      }
    }

    await document.fonts.ready;
    if (anErr != null)
    {
      this._myIsWasmLoaded = true;
      this.terminalWriteError (anErr);
      return Promise.reject (anErr);
    }

    this._onWasmCreated();
    return Promise.resolve (true);
  }

  /**
   * Init Module and load WASM file.
   */
  async wasmLoad()
  {
    let toLoadThreads = this._myToPreferPthread && this.isAllowMultithreading();
    this._myWasmBuild = toLoadThreads ? "wasm32-pthread" : "wasm32";
    this.FS = null;
    try
    {
      this.mainScriptUrlOrBlob = './DRAWEXE.js'; // for pthreads
      let aModPath = this.locateFile ("DRAWEXE.js", "");
      let aRet = await fetch (aModPath);
      let aSrc = await aRet.text();
      if (!aRet.ok)
      {
        return Promise.reject (new Error ("Fail to fetch DRAWEXE.js; response finished with " + aRet.status));
      }
      aSrc += '\nexport default createDRAWEXE';
      const aBlob = new Blob ([aSrc], {type: 'text/javascript'});
      let aModCreator = await import (URL.createObjectURL (aBlob));
      await aModCreator.default (this);
      return Promise.resolve (true);
    }
    catch (theError)
    {
      return Promise.reject (new Error ("WebAssembly '" + this._myWasmBuild + "' initialization has failed:\r\n" + theError));
    }
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
    this._myTermLineCharPos = 0;  // Terminal input character position (relative to the tail)
    this._myTermHistory = [];     // Commands input history (activated by up/down arrows)
    this._myTermHistoryPos  = -1; // Currently displayed item from commands input history (activated by up/down arrows)
    this._myCmdTimeout = 10;      // command delay for setTimout()
    this._myCmdQueue = new DrawCommandQueue(); // commands queued for sequential processing via setTimout()
    this._myIsWasmLoaded = false; // WASM loading state
    this._myToPreferPthread = true;
    this._myFileInput = null;     // Hidden file input field

    // prefix for DRAWEXE.data location
    this._myBasePrefix = "/";
    this._myWasmBuild = "wasm32";

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
    this.locateFile   = this.locateFile.bind (this);
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

    // prevent page scrolling on mouse wheel even within an empty terminal / at the end of terminal scroll
    this._myTerm.element.addEventListener ("wheel", (theEvent) => { theEvent.preventDefault(); });
  }

  /**
   * Set prefix for DRAWEXE.data location.
   * @param[in] {string} thePrefix new prefix to set
   */
  setBasePrefix (thePrefix)
  {
    this._myBasePrefix = thePrefix;
  }

  /**
   * Set WASM build prefix for DRAWEXE.wasm location.
   * @param[in] {string} theBuild new prefix to set
   */
  setWasmBuild (theBuild)
  {
    this._myWasmBuild = theBuild;
  }

  /**
   * Return flag to prefer multi-threaded WASM build; should be called before init().
   */
  toPreferPthread()
  {
    return this._myToPreferPthread;
  }

  /**
   * Set flag to prefer multi-threaded WASM build; should be called before init().
   */
  setPreferPthread (theToPrefer)
  {
    this._myToPreferPthread = theToPrefer;
  }

  /**
   * Clear terminal.
   */
  terminalClear()
  {
    if (this._myTerm !== null)
    {
      this._myTerm.clear();
    }
  }

  /**
   * Print text into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWrite (theText)
  {
    if (this._myTerm !== null)
    {
      this._myTerm.write (theText);
    }
  }

  /**
   * Print text into terminal with automatic LF -> CRLF correction.
   * @param[in] {string} theText text to print
   */
  terminalWriteMultiline (theText)
  {
    if (this._myTerm !== null)
    {
      this._myTerm.write (theText.replace (/\n/g, '\n\r'));
    }
  }

  /**
   * Print normal message into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWriteLine (theText)
  {
    this.terminalWrite ("\n\r" + theText);
  }

  /**
   * Print trace message into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWriteTrace (theText)
  {
    this.terminalWriteMultiline ("\n\r\x1B[33m" + theText + "\x1B[0m");
  }

  /**
   * Print info message into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWriteInfo (theText)
  {
    this.terminalWriteMultiline ("\n\r\x1B[32;1m" + theText + "\x1B[0m");
  }

  /**
   * Print warning message into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWriteWarning (theText)
  {
    this.terminalWriteMultiline ("\n\r\x1B[33;1m" + theText + "\x1B[0m");
  }

  /**
   * Print error message into terminal.
   * @param[in] {string} theText text to print
   */
  terminalWriteError (theText)
  {
    this.terminalWriteMultiline ("\n\r\x1B[31;1m" + theText + "\x1B[0m");
  }

  /**
   * Move terminal input to the newline with the "Draw> " prefix.
   * @param[in] {string} theLine text to print
   */
  terminalPrintInputLine (theLine)
  {
    this.terminalWrite ("\n\r");
    this.terminalWrite ("\x1B[32;1m" + this._myTermHello + "[" + (++this._myTermInCounter) + "]>\x1B[0m ");
  }

  /**
   * Evaluate a sequence of command.
   * @param[in] {string} theCommands commands as a line-separated string
   */
  terminalPasteScript (theCommands)
  {
    if (this._myTerm !== null)
    {
      if (!theCommands.endsWith ("\n"))
      {
        theCommands += "\n";
      }
      this._myTerm.paste (theCommands);
    }
  }

  /**
   * Evaluate a command from the queue.
   * @param[in] {string} theCmd command to execute
   * @return {Promise} evaluation result as promise
   */
  termEvaluateCommand (theCmd)
  {
    //console.warn(" @@ termEvaluateCommand (" + theCmd + ")");
    if (theCmd === "")
    {
      return Promise.resolve (true);
    }

    this._myTermHistoryPos = -1;
    if (!theCmd.startsWith ("#") && !theCmd.includes ("\n"))
    {
      this._myTermHistory.push (theCmd);
    }
    try
    {
      let aRes = true;
      if (theCmd.startsWith ("jsdownload "))
      {
        aRes = this._commandJsdownload (theCmd.substring (11).trim());
      }
      else if (theCmd.startsWith ("jsdown "))
      {
        aRes = this._commandJsdownload (theCmd.substring (7).trim());
      }
      else if (theCmd.startsWith ("download "))
      {
        aRes = this._commandJsdownload (theCmd.substring (9).trim());
      }
      else if (theCmd.startsWith ("jsupload "))
      {
        return this._commandJsupload (theCmd.substring (9).trim());
      }
      else if (theCmd.startsWith ("upload "))
      {
        return this._commandJsupload (theCmd.substring (7).trim());
      }
      else if (theCmd.startsWith ("jsasync "))
      {
        return new Promise ((theResolve, theReject) => {
          this.evalAsyncCompleted = (theResult) => {
            this.evalAsyncCompleted = undefined;
            theResolve (theResult === 1);
          };
          this.evalAsyncCompleted = this.evalAsyncCompleted.bind (this);
          this.evalAsync (theCmd.substring (8).trim());
        });
      }
      else
      {
        this.eval (theCmd);
      }
      if (aRes)
      {
        return Promise.resolve (true);
      }
      return Promise.reject (new Error ("Command evaluation failed"));
    }
    catch (theErr)
    {
      return Promise.reject (new InternalError (theErr));
    }
  }

  /**
   * Function to download data to a file.
   * @param[in] {Uint8Array} theData data to download
   * @param[in] {string} theFileName default file name to download data as
   * @param[in] {string} theType data MIME type
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
   * @param[in] {string} theFileUrl  URL to load
   * @param[in] {string} theFilePath file path on emulated file system (or empty string to take name from URL)
   * @param[in] {boolean} theToPreload decode image file using Emscripten plugins
   * @return {Promise} evaluation result as promise returning TRUE or Error
   */
  uploadUrl (theFileUrl, theFilePath, theToPreload)
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
      if (!theResponse.ok) { throw new Error ("HTTP " + theResponse.status + " - " + theResponse.statusText + " (URL: '" + theFileUrl + "')"); }
      return theResponse;
    };

    return new Promise ((theResolve, theReject) =>
    {
      fetch (theFileUrl)
      .then (theResponse => aCheckStatusFunc (theResponse) && theResponse.arrayBuffer())
      .then (theBuffer => {
        let aDataArray = new Uint8Array (theBuffer);
        this.terminalWriteLine ("uploading file '" + aFileName + "' of size " + aDataArray.length + " bytes to '" + aFilePath + "'...");
        this.FS.writeFile (aFilePath, aDataArray);
        if (theToPreload)
        {
          // decode image
          this.FS.createPreloadedFile (!aFilePath.startsWith ("/") ? this.FS.cwd() : "/",
                                       aFilePath,
                                       aDataArray, true, true,
                                       () => { theResolve (true); this.terminalPrintInputLine (""); },
                                       () => { theReject (new Error ("Preload '" + aFilePath + "' failed")); },
                                       true); // file is already created
        }
        else
        {
          this.terminalPrintInputLine ("");
          theResolve (true);
        }
      })
      .catch (theErr => {
        theReject (theErr);
      });
    });
  }

  /**
   * Specify file on the local file system and upload it to emulated file system.
   * @param[in] {string} theFilePath file path on emulated file system (or empty string to take name from file)
   * @param[in] {boolean} theToPreload decode image file using Emscripten plugins
   * @return {Promise} evaluation result as promise returning TRUE or Error
   */
  uploadFile (theFilePath, theToPreload)
  {
    if (this._myFileInput == null)
    {
      this._myFileInput = document.createElement ("input");
      this._myFileInput.type = "file";
      this._myFileInput.style = "visibility:hidden";
      document.body.appendChild (this._myFileInput);
    }

    return new Promise ((theResolve, theReject) =>
    {
      // File Input is a total failure in HTML, as there is NO event for handling user Cancel.
      // Window focus change event is tracked instead to avoid DRAWEXE handling forever.
      let hasResult = false;
      const aCancelListener = () => {
        window.removeEventListener ('focus',    aCancelListener);
        window.removeEventListener ('touchend', aCancelListener);
        setTimeout (() =>
        {
          if (!hasResult)
          {
            theReject (new Error ("no file chosen"));
          }
        }, 1000); // wait for a second as focus and onchange events happen simultaneously
      };
      window.addEventListener ('focus',    aCancelListener, { once: true });
      window.addEventListener ('touchend', aCancelListener, { once: true });

      this._myFileInput.onchange = () => {
        hasResult = true;
        window.removeEventListener ('focus',    aCancelListener);
        window.removeEventListener ('touchend', aCancelListener);
        if (this._myFileInput.files.length == 0)
        {
          theReject (new Error ("no file chosen"));
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
          if (theToPreload)
          {
            // implicitly decode image
            this.FS.createPreloadedFile (!aFilePath.startsWith ("/") ? this.FS.cwd() : "/",
                                         aFilePath,
                                         aDataArray, true, true,
                                         () => { theResolve (true); this.terminalPrintInputLine (""); },
                                         () => { theReject (new Error ("Preload failed")); },
                                         true); // file is already created
          }
          else
          {
            this.terminalPrintInputLine ("");
            theResolve (true);
          }
        };
        aReader.readAsArrayBuffer (aFile);
      };
      this._myFileInput.click();
    })
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
   * @param[in] {KeyboardEvent} theEvent input key
   * @return {boolean} FALSE if key should be ignored
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
        this._myTermLineCharPos = 0;
        this.terminalWrite (aHist);
        return false;
      }
      case 37: // ArrowLeft
      {
        if (theEvent.type === "keydown")
        {
          if (this._myTermLineCharPos > -this._myTermLine.length)
          {
            --this._myTermLineCharPos;
            this.terminalWrite ("\x1b[1D");
          }
        }
        return false;
      }
      case 39: // ArrowRight
      {
        if (theEvent.type === "keydown")
        {
          if (this._myTermLineCharPos < 0)
          {
            ++this._myTermLineCharPos;
            this.terminalWrite ("\x1b[1C");
          }
        }
        return false;
      }
      case 8: // Backspace
      {
        if (theEvent.type !== "keydown")
        {
          return false;
        }

        if (this._myTermLineCharPos < 0)
        {
          // remove character in the middle
          if (this._myTermLineCharPos > -this._myTermLine.length)
          {
            let aFront = this._myTermLine.substring (0, this._myTermLine.length + this._myTermLineCharPos - 1);
            let aTail  = this._myTermLine.substring (this._myTermLine.length + this._myTermLineCharPos);
            this.terminalWrite ("\b" + aTail + " ");
            this.terminalWrite ("\x1b[" + (-this._myTermLineCharPos + 1) + "D");
            this._myTermLine = aFront + aTail;
          }
        }
        else if (this._myTermLine.length > 0)
        {
          this.terminalWrite ('\b \b');
          this._myTermLine = this._myTermLine.substring (0, this._myTermLine.length - 1);
        }
        return false;
      }
      case 46: // Delete
      {
        if (theEvent.type === "keydown"
         && this._myTermLineCharPos < 0)
        {
          let aFront = this._myTermLine.substring (0, this._myTermLine.length + this._myTermLineCharPos);
          let aTail  = this._myTermLine.substring (this._myTermLine.length + this._myTermLineCharPos + 1);
          this.terminalWrite (aTail + " ");
          this.terminalWrite ("\x1b[" + (-this._myTermLineCharPos) + "D");
          this._myTermLine = aFront + aTail;
          ++this._myTermLineCharPos;
        }
        return false;
      }
      case 33: // PageUp
      case 34: // PageDown
      {
        if (theEvent.type === "keydown")
        {
          this._myTerm.scrollPages (theEvent.keyCode == 33 ? -1 : 1);
        }
        return false;
      }
      case 35: // End
      {
        if (theEvent.type === "keydown")
        {
          if (this._myTermLineCharPos < 0)
          {
            let aDelta = -this._myTermLineCharPos;
            this._myTermLineCharPos = 0;
            this.terminalWrite ("\x1b[" + aDelta + "C");
          }
        }
        return false;
      }
      case 36: // Home
      {
        if (theEvent.type === "keydown")
        {
          if (this._myTermLineCharPos > -this._myTermLine.length)
          {
            let aDelta = this._myTermLine.length + this._myTermLineCharPos;
            this._myTermLineCharPos = -this._myTermLine.length;
            this.terminalWrite ("\x1b[" + aDelta + "D");
          }
        }
        return false;
      }
      case 45: // insert
      {
        return false;
      }
      case 112: // F1
      case 113:
      case 114:
      case 115:
      case 116:
      case 117:
      case 118:
      case 119:
      case 120:
      case 121:
      case 122:
      case 123: // F12
      {
        return false;
      }
    }

    // handle copy-paste via Ctrl+C and Ctrl+V
    if (theEvent.key === 'c' && theEvent.ctrlKey)
    {
      let isCopyDone = document.execCommand ('copy');
      return false;
    }
    if (theEvent.key === 'v' && theEvent.ctrlKey)
    {
      return false;
    }

    return true;
  }

  /**
   * Terminal data input callback.
   * @param[in] {string} theEvent input data as string
   */
  _onTermDataInput (theEvent)
  {
    let aNbNewLines = 0;
    for (let anIter = 0; anIter < theEvent.length; ++anIter)
    {
      let aChar = theEvent.charAt (anIter);
      if (aChar === "\x0d") // CR
      {
        this._myTermLineCharPos = 0;
        let aCmd = this._myTermLine;
        if (aCmd.endsWith ("\\"))
        {
          // handle trailing slash (multiline input)
          this._myTermLine = this._myTermLine.substring (0, this._myTermLine.length - 1);
          if (aNbNewLines == 0)
          {
            this.terminalWrite ("\n\r> ");
          }
        }
        else if (!this.isComplete (aCmd))
        {
          // handle incomplete Tcl input (missing closing bracket)
          this._myTermLine += "\n\r";
          if (aNbNewLines == 0)
          {
            this.terminalWrite ("\n\r> ");
          }
        }
        else
        {
          this._myTermLine = "";
          this._termQueueCommand (aCmd, aNbNewLines != 0);
          ++aNbNewLines;
        }
      }
      // if (aChar === "\x1b[A"), "\x1b[B" up/down arrows are handled by attachCustomKeyEventHandler()
      else // normal symbol
      {
        if (this._myTermLineCharPos < 0)
        {
          // insert character
          let aFront = this._myTermLine.substring (0, this._myTermLine.length + this._myTermLineCharPos);
          let aTail  = this._myTermLine.substring (this._myTermLine.length + this._myTermLineCharPos);
          this.terminalWrite (aChar + aTail);
          this.terminalWrite ("\x1b[" + (-this._myTermLineCharPos) + "D");
          this._myTermLine = aFront + aChar + aTail;
        }
        else
        {
          // append character
          if (aNbNewLines == 0)
          {
            this.terminalWrite (aChar);
          }
          this._myTermLine += aChar;
        }
      }
    }
  }

  /**
   * Put command into the execution queue.
   * @param[in] {string} theCmd command to execute
   * @param[in] {boolean} theToEcho print command to terminal
   */
  _termQueueCommand (theCmd, theToEcho)
  {
    //console.warn(" @@ _termQueueCommand (" + theCmd + ")");
    // run multiple commands with delay so that the user will see the progress
    // (otherwise JavaScript will run all commands in one shot with hanging output)
    this._myCmdQueue.add (new DrawCommand (theCmd, theToEcho));
    if (this._myCmdQueue.extent() == 1)
    {
      setTimeout (() => { this._termPopCommandFromQueue(); }, this._myCmdTimeout);
    }
  }

  /**
   * Pop and evaluate a command from the queue.
   */
  _termPopCommandFromQueue()
  {
    let aCmd = this._myCmdQueue.pop();
    if (aCmd === null)
    {
      return;
    }

    if (aCmd.toEcho)
    {
      this.terminalWrite (aCmd.command);
    }

    this.termEvaluateCommand (aCmd.command).then ((theCmdStatus) =>
    {
      this.terminalPrintInputLine ("");
      if (!this._myCmdQueue.isEmpty())
      {
        setTimeout (() => { this._termPopCommandFromQueue(); }, this._myCmdTimeout);
      }
    }).catch ((theErr) =>
    {
      //this.terminalPrintInputLine ("");
      this.terminalWriteError (theErr);
      this.terminalPrintInputLine ("");
      if (!this._myCmdQueue.isEmpty())
      {
        setTimeout (() => { this._termPopCommandFromQueue(); }, this._myCmdTimeout);
      }
    });
  }
//#endregion

//#region Additional Tcl commands implemented in JavaScript

  /**
   * Evaluate jsdownload command downloading file from emulated file system.
   * @param[in] {string} theArgs command arguments as string
   * @return {boolean} evaluation result
   */
  _commandJsdownload (theArgs)
  {
    let anArgs = theArgs.split (" ");
    if (theArgs === "" || (anArgs.length != 1 && anArgs.length != 2))
    {
      this.terminalWriteError ("Syntax error: wrong number of arguments");
      return false;
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
      return true;
    }
    catch (theError)
    {
      this.terminalWriteError ("Error: file '" + aFilePath + "' cannot be read with " + theError);
      return false;
    }
  }

  /**
   * Evaluate jsupload command uploaded file to emulated file system.
   * @param[in] {string} theArgs command arguments as string
   * @return {Promise} evaluation result as promise
   */
  _commandJsupload (theArgs)
  {
    let anArgs = theArgs.split (" ").filter (theVal => theVal !== "");
    let toPreload = true; // TODO - make optional
    let aSrcList = [];
    let aDstList = [];
    for (let anArgIter = 0; anArgIter < anArgs.length; ++anArgIter)
    {
      let aParam = anArgs[anArgIter];
      if (aParam === "")
      {
        continue;
      }

      let aFilePath = "";
      aSrcList.push (aParam);
      if (anArgIter + 2 < anArgs.length
       && anArgs[anArgIter + 1] === "-path")
      {
        aFilePath = anArgs[anArgIter + 2];
        anArgIter += 2;
      }
      aDstList.push (aFilePath);
    }
    if (aSrcList.length === 0)
    {
      return Promise.reject (new SyntaxError ("wrong number of arguments"));
    }

    let aPromises = [];
    for (let aFileIter = 0; aFileIter < aSrcList.length; ++aFileIter)
    {
      let aFileUrl  = aSrcList[aFileIter];
      let aFilePath = aDstList[aFileIter];
      if (aFileUrl === ".")
      {
        aPromises.push (this.uploadFile (aFilePath, toPreload));
      }
      else
      {
        aPromises.push (this.uploadUrl (aFileUrl, aFilePath, toPreload));
      }
    }
    if (aPromises.length === 1)
    {
      return aPromises[0];
    }
    if (typeof Promise.allSettled === "function")
    {
      return new Promise ((theResolve, theReject) =>
      {
        Promise.allSettled (aPromises)
          .then (theResults =>
          {
            let aFailList = "";
            let nbFails = 0;
            theResults.forEach ((aResIter) => {
              if (aResIter.status === "rejected")
              {
                ++nbFails;
                if (aFailList.length !== 0)
                {
                  aFailList += "\r\n";
                }
                aFailList += aResIter.reason;
              }
            });

            if (nbFails === 0)
            {
              theResolve (true);
            }
            else
            {
              theReject (new Error (aFailList));
            }
          });
      });
    }
    return Promise.all (aPromises);
  }
//#endregion

//#region WebAssembly module interface

  /**
   * C++ std::cout callback redirecting to Terminal.
   * @param[in] {string} theText text to print
   */
  print (theText)
  {
    console.warn (theText);
    this.printMessage (theText, -1);
  }

  /**
   * C++ std::cerr callback redirecting to Terminal.
   * @param[in] {string} theText text to print
   */
  printErr (theText)
  {
    console.warn (theText);
    this.printMessage (theText, -1);
  }

  /**
   * C++ Message::Send() callback redirecting to Terminal.
   * @param[in] {string} theText text to print
   * @param[in] {number} theGravity message gravity within 0..4 range
   */
  printMessage (theText, theGravity)
  {
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
    this.terminalWriteMultiline (theText);
  }

  /**
   * Callback returning file path for loading WebAssembly components.
   * @param[in] {string} thePath file path to locate
   * @param[in] {string} thePrefix default file prefix
   * @return {string} full path to the resource
   */
  locateFile (thePath, thePrefix)
  {
    //console.warn(" @@ locateFile(" + thePath + ", " + thePrefix + ")");
    // thePrefix is JS file directory - override location of our DRAWEXE.data
    //return thePrefix + thePath;
    return this._myBasePrefix + this._myWasmBuild + "/" + thePath;
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
  _onWasmCreated()
  {
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
             + "{jsupload fileUrl1 [-path filePath1] [fileUrl2 [-path filePath2]] ..."
             + "\n\t\t: Upload files to emulated file system"
             + "\n\t\t:   fileUrl  URL on server or . to show open file dialog;"
             + "\n\t\t:   filePath file path within emulated file system to create.}"
             + " {JavaScript commands}");
    this.eval ("help jsasync "
             + "{jsasync command ..."
             + "\n\t\t: Run Tcl command asynchronously.}"
             + " {JavaScript commands}");

    this.terminalPrintInputLine ("");
  }
//#endregion

};

//! Create WebAssembly module instance and wait.
var DRAWEXE = new DrawTerm();
createDRAWEXE = function() { return DRAWEXE.init(); };
