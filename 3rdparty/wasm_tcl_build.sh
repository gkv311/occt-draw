#!/bin/bash

# This is helpful script to perform building of Tcl for WebAssembly platform
# https://www.tcl.tk/software/tcltk/download.html

EMSDK_ROOT="/home/develop/wasm/emsdk"

# go to the script directory
aScriptPath=${BASH_SOURCE%/*}
if [ -d "$aScriptPath" ]; then
  cd "$aScriptPath"
fi

# define number of jobs from available CPU cores
aNbJobs="$(getconf _NPROCESSORS_ONLN)"
set -o pipefail

aPathBak="$PATH"
aTclRoot="$PWD"

OUTPUT_FOLDER="$aTclRoot/install/tcl-wasm32"
rm -f -r "$OUTPUT_FOLDER"
mkdir -p "$OUTPUT_FOLDER"
cp -f    "$aTclRoot/license.terms" "$OUTPUT_FOLDER"
cp -f    "$aTclRoot/README.md"     "$OUTPUT_FOLDER"
echo "Output directory: $OUTPUT_FOLDER"

. "${EMSDK_ROOT}/emsdk_env.sh"
#export "PATH=$EMSDK_ROOT/upstream/bin:$aPathBak"
#export "CC=emcc"
#export "AR=llvm-ar"
#export "RANLIB=llvm-ranlib"
#export "CFLAGS=$aCFlags"
pushd "$aTclRoot/unix"
#./configure --build x86_64-linux --host wasm32 --prefix=${OUTPUT_FOLDER} 2>&1 | tee $OUTPUT_FOLDER/config-wasm32.log
emconfigure ./configure --prefix=${OUTPUT_FOLDER} --enable-shared=no 2>&1 | tee $OUTPUT_FOLDER/config-wasm32.log
aResult=$?; if [[ $aResult != 0 ]]; then echo "FAILED configure"; exit $aResult; fi
emmake make clean
emmake make -j$aNbJobs
aResult=$?; if [[ $aResult != 0 ]]; then echo "FAILED make"; exit $aResult; fi
emmake make install
popd
export "PATH=$aPathBak"

rm $OUTPUT_FOLDER/../tcl-wasm32.7z &>/dev/null
7za a -t7z -m0=lzma -mx=9 -mfb=64 -md=32m -ms=on $OUTPUT_FOLDER/../tcl-wasm32.7z $OUTPUT_FOLDER
