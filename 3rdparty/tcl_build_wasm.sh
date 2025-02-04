#!/bin/bash

# Small help to build Tcl by Emscripten for Draw Harness.
# https://www.tcl-lang.org or https://github.com/gkv311/tcl.git

# go to the script directory
aScriptPath=${BASH_SOURCE%/*}; if [ -d "${aScriptPath}" ]; then cd "$aScriptPath"; fi; aScriptPath="$PWD";

EMSDK_ROOT=~/develop/emsdk
aTclName=tcl-8.6.11

source $EMSDK_ROOT/emsdk_env.sh
CMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
CMAKE_BUILD_TYPE=Release

aSrcRoot=${aScriptPath}/${aTclName}.git
aBuildRoot=${aScriptPath}/wasm-make
aDestRoot=${aScriptPath}/wasm

rm -r -f ${aBuildRoot}
mkdir -p ${aBuildRoot}

set -o pipefail

# define number of jobs from available CPU cores
aNbJobs="$(getconf _NPROCESSORS_ONLN)"

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

  aSrcCopy=${aBuildRoot}/${aTclName}-${anArch}-src
  rm -r -f "$aSrcCopy"
  cp -r -f "$aSrcRoot" "$aSrcCopy"

  aBuildPath=${aBuildRoot}/${aTclName}-${anArch}-make
  CMAKE_INSTALL_PREFIX=${aDestRoot}/${aTclName}-${anArch}
  rm -r -f ${CMAKE_INSTALL_PREFIX}
  mkdir -p "$CMAKE_INSTALL_PREFIX"
  cp -f    "$aSrcRoot/license.terms" "$CMAKE_INSTALL_PREFIX/"
  cp -f    "$aSrcRoot/README.md"     "$CMAKE_INSTALL_PREFIX/"
  echo "Output directory: $CMAKE_INSTALL_PREFIX"

  pushd "$aSrcCopy/unix"
  export "CFLAGS=$CMAKE_C_FLAGS"
  export "CXXFLAGS=$CMAKE_C_FLAGS"
  #./configure --build x86_64-linux --host wasm32 --prefix=${CMAKE_INSTALL_PREFIX} 2>&1 | tee $CMAKE_INSTALL_PREFIX/config-wasm32.log
  emconfigure ./configure --host wasm32 --prefix=${CMAKE_INSTALL_PREFIX} --enable-shared=no --enable-threads=no 2>&1 | tee $CMAKE_INSTALL_PREFIX/config-wasm32.log
  aResult=$?; if [[ $aResult != 0 ]]; then echo "FAILED configure"; exit $aResult; fi
  emmake make clean
  emmake make -j$aNbJobs
  aResult=$?; if [[ $aResult != 0 ]]; then echo "FAILED make"; exit $aResult; fi
  emmake make install
  popd

  export "CFLAGS="
  export "CXXFLAGS="
  #7za a -t7z -m0=lzma -mx=9 -mfb=64 -md=32m -ms=on "$aBuildRoot/${aTclName}-${anArch}.7z" "$CMAKE_INSTALL_PREFIX"
}

#for anArchIter in wasm32
for anArchIter in wasm32 wasm32-pthread wasm64 wasm64-pthread
do
  buildArch $anArchIter
done
