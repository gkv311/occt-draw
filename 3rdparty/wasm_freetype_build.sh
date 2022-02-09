#!/bin/bash

# Pseudo-script for building OCCT using Emscripten SDK with dependencies.
# DON'T RUN AS IS - write own script instead.

BUILD_DIR=~/build
THIRDPARTY_DIR=~/3rdparty

mkdir $BUILD_DIR
mkdir $THIRDPARTY_DIR
pushd $BUILD_DIR

# build FreeType
git clone --depth 1 --branch VER-2-10-4 https://gitlab.freedesktop.org/freetype/freetype.git "${BUILD_DIR}/freetype2.git"

mkdir "${BUILD_DIR}/freetype2-make"
pushd "${BUILD_DIR}/freetype2-make"
emcmake cmake "${BUILD_DIR}/freetype2.git" \
 -D CMAKE_INSTALL_PREFIX:PATH="$THIRDPARTY_DIR/freetype2" \
 -G 'Ninja'
ninja install
popd

# build Draco
git clone --depth 1 --branch 1.4.1 https://github.com/google/draco.git "${BUILD_DIR}/draco.git"

export EMSCRIPTEN=/emsdk/upstream/emscripten
mkdir "${BUILD_DIR}/draco-make"
pushd "${BUILD_DIR}/draco-make"
emcmake cmake "${BUILD_DIR}/draco.git" \
 -D CMAKE_INSTALL_PREFIX:PATH="$THIRDPARTY_DIR/draco" \
 -D CMAKE_BUILD_TYPE:STRING="Release" \
 -D DRACO_JS_GLUE:BOOL="OFF" \
 -G 'Ninja'
ninja install
popd

# build rapidjson
git clone --depth 1 --branch v1.1.0 https://github.com/Tencent/rapidjson.git "${THIRDPARTY_DIR}/rapidjson"

# build occt
git clone --depth 1 --branch IR-2022-02-04 https://git.dev.opencascade.org/repos/occt.git "${BUILD_DIR}/occt.git"

mkdir "${BUILD_DIR}/occt-make"
pushd "${BUILD_DIR}/occt-make"
emcmake cmake /occt \
 -DINSTALL_DIR=$THIRDPARTY_DIR/occt \
 -DBUILD_MODULE_Draw:BOOL=FALSE \
 -DBUILD_LIBRARY_TYPE="Static" \
 -DBUILD_DOC_Overview:BOOL=FALSE \
 -DCMAKE_BUILD_TYPE=release \
 -D3RDPARTY_FREETYPE_INCLUDE_DIR_freetype2=$THIRDPARTY_DIR/freetype2/include \
 -D3RDPARTY_FREETYPE_INCLUDE_DIR_ft2build=$THIRDPARTY_DIR/freetype2/include/freetype2 \
 -D3RDPARTY_FREETYPE_LIBRARY_DIR=$THIRDPARTY_DIR/freetype2/lib \
 -DUSE_RAPIDJSON:BOOL=ON \
 -DUSE_GLES2:BOOL=OFF \
 -D3RDPARTY_RAPIDJSON_INCLUDE_DIR=$THIRDPARTY_DIR/rapidjson/include \
 -DUSE_DRACO:BOOL=ON \
 -D3RDPARTY_DRACO_INCLUDE_DIR=$THIRDPARTY_DIR/draco/include \
 -D3RDPARTY_DRACO_LIBRARY_DIR_draco=$THIRDPARTY_DIR/draco/lib \
 -G 'Ninja'
ninja install

# build occt-pthread
mkdir "${BUILD_DIR}/occt-pthread-make"
pushd "${BUILD_DIR}/occt-pthread-make"
emcmake cmake /occt \
 -DCMAKE_CXX_FLAGS="-pthread" \
 -DINSTALL_DIR=$THIRDPARTY_DIR/occt-pthread \
 -DBUILD_MODULE_Draw:BOOL=FALSE \
 -DBUILD_LIBRARY_TYPE="Static" \
 -DBUILD_DOC_Overview:BOOL=FALSE \
 -DCMAKE_BUILD_TYPE=release \
 -D3RDPARTY_FREETYPE_INCLUDE_DIR_freetype2=$THIRDPARTY_DIR/freetype2/include \
 -D3RDPARTY_FREETYPE_INCLUDE_DIR_ft2build=$THIRDPARTY_DIR/freetype2/include/freetype2 \
 -D3RDPARTY_FREETYPE_LIBRARY_DIR=$THIRDPARTY_DIR/freetype2/lib \
 -DUSE_RAPIDJSON:BOOL=ON \
 -DUSE_GLES2:BOOL=OFF \
 -D3RDPARTY_RAPIDJSON_INCLUDE_DIR=$THIRDPARTY_DIR/rapidjson/include \
 -DUSE_DRACO:BOOL=ON \
 -D3RDPARTY_DRACO_INCLUDE_DIR=$THIRDPARTY_DIR/draco/include \
 -D3RDPARTY_DRACO_LIBRARY_DIR_draco=$THIRDPARTY_DIR/draco/lib \
 -G 'Ninja'
 ninja install
 popd
