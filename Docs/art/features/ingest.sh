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
# Half scale on the way in, EXCEPT for something that spans cells: a 3x3 is
# drawn 768 px wide at zoom 1, and halving the render would have the game
# upscaling it from the moment it appears.
fp=$(node -e "process.stdout.write(String(require('$here/props.json')['$id'].footprint ?? 1))")
if [ "$fp" -gt 1 ]; then
  magick "$src" -strip "$master"
else
  magick "$src" -resize 50% -strip "$master"
fi
corner=$(magick "$master" -format "%[pixel:p{0,0}]" info:)
echo "  master $(magick identify -format '%wx%h' "$master")  corner $corner"
[ "$corner" = "srgba(0,0,0,0)" ] || { echo "  FAIL: the background is not transparent"; exit 1; }
scale=$(node -e "process.stdout.write(String(require('$here/props.json')['$id'].scale ?? 1))")
plots=$(node -e "process.stdout.write(String(require('$here/props.json')['$id'].canvasPlots ?? 2))")
seat=$(node -e "process.stdout.write(String(require('$here/props.json')['$id'].seat ?? 'ground'))")
"$here/norm_prop.sh" "$master" "$here/$id.png" "$scale" "$plots" "$fp" "$seat"
# A field has to tile, so its soil is checked against the camera it claims.
# An `if`, not `[ ... ] && ...`: as the last line of a `set -e` script that
# idiom exits 1 for every asset that is NOT a field, which is most of them.
tpl=$(node -e "process.stdout.write(String(require('$here/props.json')['$id'].template ?? ''))")
if [ "$tpl" = field ]; then
  node "$here/check_field.mjs" "$here/$id.png"
fi
