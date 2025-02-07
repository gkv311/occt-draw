#!/bin/bash

# Small help to build FreeType by Emscripten for Draw Harness.
# https://www.freetype.org

# go to the script directory
aScriptPath=${BASH_SOURCE%/*}; if [ -d "${aScriptPath}" ]; then cd "$aScriptPath"; fi; aScriptPath="$PWD";

EMSDK_ROOT=~/develop/emsdk
aFreeType=freetype-2.10.4

source $EMSDK_ROOT/emsdk_env.sh
CMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
CMAKE_BUILD_TYPE=Release

aSrcRoot=${aScriptPath}/${aFreeType}.git
aBuildRoot=${aScriptPath}/wasm-make
aDestRoot=${aScriptPath}/wasm

mkdir -p ${aBuildRoot}

set -o pipefail

function buildArch {
  anArch=$1

  CMAKE_C_FLAGS=
  if [ "$anArch" == "wasm32-pthread" ]; then
    CMAKE_C_FLAGS="-pthread"
  elif [ "$anArch" == "wasm64" ]; then
    CMAKE_C_FLAGS="-sMEMORY64=1"
  elif [ "$anArch" == "wasm64-pthread" ]; then
    CMAKE_C_FLAGS="-pthread -sMEMORY64=1"
  fi

  aBuildPath=${aBuildRoot}/${aFreeType}-${anArch}-make
  CMAKE_INSTALL_PREFIX=${aDestRoot}/${aFreeType}-${anArch}
  rm -r -f ${aBuildPath}
  rm -r -f ${CMAKE_INSTALL_PREFIX}

  cmake -G "Ninja" \
   -D CMAKE_TOOLCHAIN_FILE:FILEPATH="$CMAKE_TOOLCHAIN_FILE" \
   -D CMAKE_BUILD_TYPE:STRING="$CMAKE_BUILD_TYPE" \
   -D CMAKE_INSTALL_PREFIX:STRING="$CMAKE_INSTALL_PREFIX" \
   -D CMAKE_C_FLAGS:STRING="$CMAKE_C_FLAGS" \
   -B "$aBuildPath" -S "$aSrcRoot"
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi

  cmake --build "$aBuildPath" --config Release --target clean
  cmake --build "$aBuildPath" --config Release
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi
  cmake --build "$aBuildPath" --config Release --target install

  cp -f "$aSrcRoot/LICENSE.TXT"    "$CMAKE_INSTALL_PREFIX/"
  cp -f "$aSrcRoot/docs/FTL.TXT"   "$CMAKE_INSTALL_PREFIX/"
  cp -f "$aSrcRoot/docs/GPLv2.TXT" "$CMAKE_INSTALL_PREFIX/"
  cp -f "$aSrcRoot/docs/CHANGES"   "$CMAKE_INSTALL_PREFIX/"
  cp -f "$aSrcRoot/docs/README"    "$CMAKE_INSTALL_PREFIX/"
  #7za a -t7z -m0=lzma -mx=9 -mfb=64 -md=32m -ms=on "$aBuildRoot/${aFreeType}-${anArch}.7z" "$CMAKE_INSTALL_PREFIX"
}

#for anArchIter in wasm32
for anArchIter in wasm32 wasm32-pthread wasm64 wasm64-pthread
do
  buildArch $anArchIter
done
