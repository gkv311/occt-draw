#!/bin/bash

# Small help to build OCCT by Emscripten.
# https://dev.opencascade.org

# go to the script directory
aScriptPath=${BASH_SOURCE%/*}; if [ -d "${aScriptPath}" ]; then cd "$aScriptPath"; fi; aScriptPath="$PWD";

EMSDK_ROOT=~/develop/emsdk
anOcctName=occt

source $EMSDK_ROOT/emsdk_env.sh
CMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
CMAKE_BUILD_TYPE=Release

aSrcRoot=${aScriptPath}/${anOcctName}.git
aBuildRoot=${aScriptPath}/wasm-make
aDestRoot=${aScriptPath}/wasm
#git clone https://gitlab.freedesktop.org/freetype/freetype.git freetype.git -b VER-2-10-4
FREETYPE_DIR=${aDestRoot}/freetype-2.10.4

#git clone https://github.com/Tencent/rapidjson.git rapidjson.git -b 9bd618f545ab647e2c3bcbf2f1d87423d6edf800
RAPIDJSON_DIR=${aScriptPath}/rapidjson-1.1.0.git

#git clone https://github.com/google/draco.git draco.git -b 1.5.7
DRACO_DIR=${aDestRoot}/draco-1.5.7

#git clone https://github.com/gkv311/tcl.git -b core-8-6-11-wasm
TCL_DIR=${aDestRoot}/tcl-8.6.11

rm -r -f "${aBuildRoot}"
mkdir -p "${aBuildRoot}"

set -o pipefail

function buildArch {
  anArch=$1

  CMAKE_C_FLAGS=
  CMAKE_LINKER_FLAGS=
  # wasm-exceptions are supported by all major browsers,
  # reduces WASM size and considerably speed-ups C++ exception handling.
  # But Emscripten 4.0.2 fails with internal error when linking DRAWEXE
  # when -fwasm-exceptions combined with OCC_CONVERT_SIGNALS,
  # while we want SIGSEV to be catched by DRAW...
  #CMAKE_C_FLAGS="-fwasm-exceptions"
  if [ "$anArch" == "wasm32" ]; then
    CMAKE_C_FLAGS=
  elif [ "$anArch" == "wasm32-pthread" ]; then
    # -sMALLOC=mimalloc is faster, but allocates more memory
    # -sMAXIMUM_MEMORY=3328MB could be set for modern browsers to expand 2GB limit
    CMAKE_C_FLAGS="-pthread"
  elif [ "$anArch" == "wasm64" ]; then
    CMAKE_C_FLAGS="-sMEMORY64=1"
    CMAKE_LINKER_FLAGS="-sMEMORY64=1 -sMAXIMUM_MEMORY=8000MB"
  elif [ "$anArch" == "wasm64-pthread" ]; then
    CMAKE_C_FLAGS="-pthread -sMEMORY64=1"
    CMAKE_LINKER_FLAGS="-sMEMORY64=1 -sMAXIMUM_MEMORY=8000MB -sMALLOC=mimalloc"
  fi

  aBuildPath=${aBuildRoot}/${anOcctName}-${anArch}-make
  aLogFile=${aBuildPath}/build.log

  CMAKE_INSTALL_PREFIX=${aDestRoot}/${anOcctName}-${anArch}
  rm -r -f "$aLogFile"
  rm -r -f "$CMAKE_INSTALL_PREFIX"
  mkdir -p "${aBuildPath}"
  echo "Building log" > "$aLogFile"
  aTimeZERO=$SECONDS

  FREETYPE_DIR_ARCH=${FREETYPE_DIR}-${anArch}
  DRACO_DIR_ARCH=${DRACO_DIR}-${anArch}
  TCL_DIR_ARCH=${TCL_DIR}-${anArch}

  cmake -G "Ninja" \
   -D CMAKE_TOOLCHAIN_FILE:FILEPATH="$CMAKE_TOOLCHAIN_FILE" \
   -D CMAKE_BUILD_TYPE:STRING="$CMAKE_BUILD_TYPE" \
   -D CMAKE_C_FLAGS:STRING="$CMAKE_C_FLAGS" \
   -D CMAKE_CXX_FLAGS:STRING="$CMAKE_C_FLAGS" \
   -D CMAKE_EXE_LINKER_FLAGS:STRING="$CMAKE_LINKER_FLAGS" \
   -D CMAKE_SHARED_LINKER_FLAGS:STRING="$CMAKE_LINKER_FLAGS" \
   -D INSTALL_DIR:PATH="$CMAKE_INSTALL_PREFIX" \
   -D INSTALL_DIR_INCLUDE:STRING="inc" \
   -D INSTALL_DIR_RESOURCE:STRING="src" \
   -D BUILD_LIBRARY_TYPE:STRING="Static" \
   -D BUILD_DOC_Overview:BOOL="OFF" \
   -D BUILD_MODULE_Draw:BOOL="ON" \
   -D BUILD_SOVERSION_NUMBERS=0 \
   -D USE_FREETYPE:BOOL="ON" \
   -D 3RDPARTY_FREETYPE_DIR:PATH="${FREETYPE_DIR_ARCH}" \
   -D 3RDPARTY_FREETYPE_LIBRARY_DIR:PATH="${FREETYPE_DIR_ARCH}/lib" \
   -D 3RDPARTY_FREETYPE_LIBRARY:FILEPATH="${FREETYPE_DIR_ARCH}/lib/libfreetype.a" \
   -D 3RDPARTY_FREETYPE_INCLUDE_DIR_freetype2:FILEPATH="${FREETYPE_DIR_ARCH}/include/freetype2" \
   -D 3RDPARTY_FREETYPE_INCLUDE_DIR_ft2build:FILEPATH="${FREETYPE_DIR_ARCH}/include/freetype2" \
   -D USE_RAPIDJSON:BOOL="ON" \
   -D 3RDPARTY_RAPIDJSON_DIR:PATH="${RAPIDJSON_DIR}" \
   -D USE_DRACO:BOOL="ON" \
   -D 3RDPARTY_DRACO_DIR:PATH="${DRACO_DIR_ARCH}" \
   -D 3RDPARTY_DRACO_INCLUDE_DIR:PATH="${DRACO_DIR_ARCH}/include" \
   -D 3RDPARTY_DRACO_LIBRARY_DIR:PATH="${DRACO_DIR_ARCH}/lib" \
   -D 3RDPARTY_DRACO_LIBRARY:FILEPATH="${DRACO_DIR_ARCH}/lib/libdraco.a" \
   -D USE_TK:BOOL="OFF" \
   -D 3RDPARTY_TCL_DIR:PATH="${TCL_DIR_ARCH}" \
   -D 3RDPARTY_TCL_INCLUDE_DIR:PATH="${TCL_DIR_ARCH}/include" \
   -D 3RDPARTY_TCL_LIBRARY_DIR:PATH="${TCL_DIR_ARCH}/lib" \
   -D 3RDPARTY_TCL_LIBRARY:FILEPATH="${TCL_DIR_ARCH}/lib/libtcl8.6.a" \
   -B "$aBuildPath" -S "$aSrcRoot" 2>&1 | tee "$aLogFile"
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi

  cmake --build "$aBuildPath" --config Release --target clean
  cmake --build "$aBuildPath" --config Release 2>&1 | tee "$aLogFile"
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi
  cmake --build "$aBuildPath" --config Release --target install 2>&1 | tee "$aLogFile"

  aDur=$(($SECONDS - $aTimeZERO))
  echo Building time: $aDur sec | tee "$aLogFile"

  #7za a -t7z -m0=lzma -mx=9 -mfb=64 -md=32m -ms=on "$aBuildRoot/${anOcctName}-${anArch}.7z" "$CMAKE_INSTALL_PREFIX"
}

#for anArchIter in wasm32
for anArchIter in wasm32 wasm32-pthread wasm64 wasm64-pthread
do
  buildArch $anArchIter
done
