#!/usr/bin/env bash
set -e
cd /home/angel/git/robotraca/twa
BW=/tmp/claude-1000/-home-angel-git-robotraca/490f8530-e008-4bfd-9739-e38a93dee561/scratchpad/node_modules/.bin/bubblewrap
PW=$(grep '^password' KEYSTORE-INFO.txt | awk '{print $3}')
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PW"
export BUBBLEWRAP_KEY_PASSWORD="$PW"

echo "=== STEP 1: update (genera proyecto Android desde twa-manifest.json) ==="
"$BW" update --skipVersionUpgrade 2>&1 || "$BW" update 2>&1

echo "=== STEP 2: build (.aab + .apk) ==="
"$BW" build --skipPwaValidation 2>&1

echo "=== RESULTADO ==="
ls -la *.aab *.apk 2>&1
