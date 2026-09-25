#!/usr/bin/env bash
# Newest download -> master -> the game's feature sprite.
#   ./ingest.sh forest
set -euo pipefail
id=$1
here="$(cd "$(dirname "$0")" && pwd)"
src=$(ls -t ~/Downloads/*.png 2>/dev/null | head -1)
[ -n "$src" ] || { echo "  FAIL: no PNG in ~/Downloads"; exit 1; }
[ -f "$here/_marker" ] || { echo "  FAIL: run ./prep.sh before the grab"; exit 1; }
[ "$src" -nt "$here/_marker" ] || { echo "  FAIL: the newest download predates this grab"; exit 1; }
master="$here/$id.master.png"
magick "$src" -resize 50% -strip "$master"
corner=$(magick "$master" -format "%[pixel:p{0,0}]" info:)
echo "  master $(magick identify -format '%wx%h' "$master")  corner $corner"
[ "$corner" = "srgba(0,0,0,0)" ] || { echo "  FAIL: the background is not transparent"; exit 1; }
"$here/norm_prop.sh" "$master" "$here/$id.png"
