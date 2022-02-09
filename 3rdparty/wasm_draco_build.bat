@echo OFF

rem Auxiliary script for semi-automated building of Draco library as WebAssembly library.
rem https://github.com/google/draco

set "aDracoSrc=%~dp0"
set "aBuildRoot=%aDracoSrc%\work"

set aNbJobs=%NUMBER_OF_PROCESSORS%

rem Paths to 3rd-party tools and libraries
set "aCmakeBin=c:\CMake\bin"
set "EMSDK_ROOT=c:\emsdk"
set "EMSCRIPTEN=%EMSDK_ROOT%/upstream/emscripten"
set "PATH=%EMSDK_ROOT%\python\3.9.2-1_64bit;%PATH%"

rem Build stages to perform
set "toCMake=1"
set "toClean=1"
set "toMake=1"
set "toInstall=1"
set "toDebug=0"

call "%EMSDK_ROOT%\emsdk_env.bat"
set "aToolchain=%EMSDK%/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"
if not ["%aCmakeBin%"] == [""] ( set "PATH=%aCmakeBin%;%PATH%" )

set "aBuildType=Release"
set "aBuildTypePrefix="
if ["%toDebug%"] == ["1"] (
  set "aBuildType=Debug"
  set "aBuildTypePrefix=-debug"
)

call :cmakeGenerate
if not ["%1"] == ["-nopause"] (
  pause
)

goto :eof

:cmakeGenerate
set "aPlatformAndCompiler=wasm32%aBuildTypePrefix%"
set "aWorkDir=%aBuildRoot%\draco-%aPlatformAndCompiler%-make"
set "aDestDir=%aBuildRoot%\draco-%aPlatformAndCompiler%"
set "aLogFile=%aBuildRoot%\draco-%aPlatformAndCompiler%-build.log"
if ["%toCMake%"] == ["1"] (
  if ["%toClean%"] == ["1"] (
    rmdir /S /Q %aWorkDir%"
    rmdir /S /Q %aDestDir%"
  )
)
if not exist "%aWorkDir%" ( mkdir "%aWorkDir%" )
if     exist "%aLogFile%" ( del   "%aLogFile%" )

pushd "%aWorkDir%"

if ["%toCMake%"] == ["1"] (
  cmake -G "MinGW Makefiles" ^
 -D CMAKE_TOOLCHAIN_FILE:FILEPATH="%aToolchain%" ^
 -D CMAKE_BUILD_TYPE:STRING="%aBuildType%" ^
 -D CMAKE_INSTALL_PREFIX:PATH="%aDestDir%" ^
 -D BUILD_LIBRARY_TYPE:STRING="Static" ^
 -D DRACO_WASM:BOOL="ON" ^
 -D DRACO_JS_GLUE:BOOL="OFF" ^
 "%aDracoSrc%"

rem -D DRACO_POINT_CLOUD_COMPRESSION:BOOL="OFF" ^
rem -D DRACO_MESH_COMPRESSION:BOOL="OFF" ^
 
  if errorlevel 1 (
    popd
    pause
    exit /B
    goto :eof
  )
)
if ["%toClean%"] == ["1"] (
  mingw32-make clean
)

if ["%toMake%"] == ["1"] (
  echo Building...
  mingw32-make -j %aNbJobs% 2>> "%aLogFile%"
  if errorlevel 1 (
    type "%aLogFile%"
    popd
    pause
    exit /B
    goto :eof
  )
  type "%aLogFile%"
)

if ["%toInstall%"] == ["1"] (
  mingw32-make install 2>> "%aLogFile%"
  if errorlevel 1 (
    type "%aLogFile%"
    popd
    pause
    exit /B
    goto :eof
  )
)
popd

goto :eof
