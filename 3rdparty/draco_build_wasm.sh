#!/bin/bash

# Small help to build Draco by Emscripten for Draw Harness.
# https://github.com/google/draco.git

# go to the script directory
aScriptPath=${BASH_SOURCE%/*}; if [ -d "${aScriptPath}" ]; then cd "$aScriptPath"; fi; aScriptPath="$PWD";

EMSDK_ROOT=~/develop/emsdk
aDraco=draco-1.5.7

source $EMSDK_ROOT/emsdk_env.sh
export EMSCRIPTEN=$EMSDK/upstream/emscripten
CMAKE_TOOLCHAIN_FILE=$EMSCRIPTEN/cmake/Modules/Platform/Emscripten.cmake
CMAKE_BUILD_TYPE=Release

aSrcRoot=${aScriptPath}/${aDraco}.git
aBuildRoot=${aScriptPath}/wasm-make
aDestRoot=${aScriptPath}/wasm

rm -r -f ${aBuildRoot}
mkdir -p ${aBuildRoot}

set -o pipefail

function buildArch {
  anArch=$1

  CMAKE_C_FLAGS=
  #CMAKE_C_FLAGS="-fwasm-exceptions"
  if [ "$anArch" == "wasm32" ]; then
    CMAKE_C_FLAGS=
  elif [ "$anArch" == "wasm32-pthread" ]; then
    CMAKE_C_FLAGS="-pthread"
  elif [ "$anArch" == "wasm64" ]; then
    CMAKE_C_FLAGS="-sMEMORY64=1"
  elif [ "$anArch" == "wasm64-pthread" ]; then
    CMAKE_C_FLAGS="-pthread -sMEMORY64=1"
  fi

  aBuildPath=${aBuildRoot}/${aDraco}-${anArch}-make
  CMAKE_INSTALL_PREFIX=${aDestRoot}/${aDraco}-${anArch}
  rm -r -f ${CMAKE_INSTALL_PREFIX}

  cmake -G "Ninja" \
   -D CMAKE_TOOLCHAIN_FILE:FILEPATH="$CMAKE_TOOLCHAIN_FILE" \
   -D CMAKE_BUILD_TYPE:STRING="$CMAKE_BUILD_TYPE" \
   -D CMAKE_INSTALL_PREFIX:STRING="$CMAKE_INSTALL_PREFIX" \
   -D CMAKE_C_FLAGS:STRING="$CMAKE_C_FLAGS" \
   -D CMAKE_CXX_FLAGS:STRING="$CMAKE_C_FLAGS" \
   -D DRACO_WASM:BOOl="ON" \
   -D DRACO_JS_GLUE:BOOl="OFF" \
   -B "$aBuildPath" -S "$aSrcRoot"
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi

  cmake --build "$aBuildPath" --config Release --target clean
  cmake --build "$aBuildPath" --config Release
  aResult=$?; if [[ $aResult != 0 ]]; then exit $aResult; fi
  cmake --build "$aBuildPath" --config Release --target install

  #7za a -t7z -m0=lzma -mx=9 -mfb=64 -md=32m -ms=on "$aBuildRoot/${aDraco}-${anArch}.7z" "$CMAKE_INSTALL_PREFIX"
}

#for anArchIter in wasm32
for anArchIter in wasm32 wasm32-pthread wasm64 wasm64-pthread
do
  buildArch $anArchIter
done
