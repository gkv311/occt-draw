Open CASCADE Technology - Draw Harness
======================================

## About this project

![Open CASCADE Technology logo](/images/occt_draw_logo.png)

This is an experimental work-in-progress repository for a live DEMO of Draw Harness started within the browser.
The DEMO itself could be found here:<br>
https://gkv311.github.io/occt-draw/

The project implements a minimalistic web-page opening Draw Harness application from [Open CASCADE Technology](https://dev.opencascade.org) (or OCCT)
without installation in the system and executed directly by the browser.

![Draw Harness in browser - screenshot](/images/occt_draw_wasm_cutter.png)

Project consists of:
- Draw Harness application built as [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly) module,
  based on OCCT source code with statically linked MODELING, XDE, and VISUALIZATION plugins;
- Console interface based on [xterm.js](https://xtermjs.org/)
  executing Draw Harness commands and [Tcl](https://en.wikipedia.org/wiki/Tcl) scripts;
- Single WebGL canvas for OCCT 3D Viewer integration;

Requirements - any modern browser:
- Running 64-bit;
- Supporting *WebAssembly*;
- Hardware-accelerated *WebGL 2.0*;
- 3+ GB of memory (RAM) available on device.

Note that xterm.js might imply additional compatibility restrictions
(from official documentation: since xterm.js is typically implemented as a developer tool, only modern browsers are supported officially).
It is recommended using [Firefox](https://www.mozilla.org/en-US/firefox/).

Limitations:
- Multi-threading is disabled (due to browser security limitations);
- 32-bit address space (WASM64 is not yet available in browsers);
- Execution speed is expected to be slower than native application;
- No direct file-system support;
- Browser might report "hanging JavaScript script" on heavy operations;
- No OpenGL ES 3.2 / desktop OpenGL features (WebGL 2.0 is limited to OpenGL ES 3.0), e.g. no Ray-Tracing.

The project might be found useful to experienced OCCT users (to test something on-the-go)
as well as to newcomers to learn OCCT basics before involving into building / installation routines.

## About Draw Harness

Draw Harness is an open-source [Tcl](https://en.wikipedia.org/wiki/Tcl) command interpreter
used to test and demonstrate *Open CASCADE Technology* (OCCT) modeling libraries.

Draw Harness provides a set of manually written Tcl commands utilizing OCCT functionality,
providing a natural environment for interactive input.

Draw Harness allows:

- Performing modeling operations from OCCT.
- Performing import/export operations into STEP/IGES/glTF/STL file formats.
- Displaying and interacting with models in 3D Viewer, as well as making screenshots.
- Learning, evaluating, prototyping algorithms interactively - through command line input or available Tcl samples.
- Scripting operations using Tcl language for reuse in interactive and non-interactive modes.
- Automated non-regression testing of algorithms.
- Extending with own commands through writing Draw Plugins.

Draw Harness can be used on a wide range of platforms, including Windows, macOS, Linux,
and even directly in the browser as WebAssembly module (this project is a live DEMO of the latter)!

See also the [Draw Harness User Guide](https://dev.opencascade.org/doc/overview/html/occt_user_guides__test_harness.html).

## About Open CASCADE Technology

Open CASCADE Technology (OCCT) is an open source full-scale 3D geometry library.
Striving to be one of the best free cad software kernels, OCCT is widely used for the development of specialized programs
dealing with the following engineering and mechanical domains:
3D modeling (CAD), manufacturing (CAM), numerical simulation (CAE), measurement equipment (CMM) and quality control (CAQ).
Since its publication in 1999 as an open source CAD software kernel,
OCCT has been successfully used in numerous projects ranging from building and construction to aerospace and automotive.

Please visit official site for more information:<br/>
https://dev.opencascade.org
