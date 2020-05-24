#!/bin/sh

platform="$1"
dir=$(mktemp -d)
cp -r ./src/* "$dir"
cp -rf ./platform/$platform/* "$dir"
cp ../LICENSE.md "$dir"
[ $platform != "firefox" ] && curl https://unpkg.com/webextension-polyfill@0.6.0/dist/browser-polyfill.min.js -s -o "$dir/browser-polyfill.min.js"

(cd "$dir" && zip -qr "videosync-$platform.zip" ./) && cp "$dir/videosync-$platform.zip" ./ && rm -r "$dir"
