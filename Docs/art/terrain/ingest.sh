#!/usr/bin/env bash
# Newest PNG in ~/Downloads -> master -> the game's tile.
#   ./ingest.sh grassland 1      (a tile)
#   ./ingest.sh grassland edge   (a transition piece)
set -euo pipefail
id=$1; which=$2
here="$(cd "$(dirname "$0")" && pwd)"
src=$(ls -t ~/Downloads/*.png | head -1)
# The newest download must actually be the one just generated. Without this
# the script silently normalises whatever was in ~/Downloads last -- which is
# how a Rune Carver once became a grassland tile.
age=$(( $(date +%s) - $(stat -f %m "$src") ))
[ "$age" -lt 300 ] || {
  echo "  FAIL: newest download is ${age}s old — the download did not land"
  echo "         $src"
  exit 1
}
master="$here/$id-$which.master.png"
# Half scale on the way in: the master exists to re-normalise without asking
# ChatGPT again, not to be printed.
magick "$src" -resize 50% -strip "$master"

echo "  master $(magick identify -format '%wx%h' "$master")"

if [ "$which" = edge ]; then
  # A fringe is the only piece with transparency, and it must be real alpha.
  corner=$(magick "$master" -format "%[pixel:p{0,0}]" info:)
  [ "$corner" = "srgba(0,0,0,0)" ] || {
    echo "  FAIL: the fringe's background is not transparent (corner $corner)"; exit 1; }
  "$here/norm_edge.sh" "$master" "$here/terrain_${id}_edge.png"
elif [ "$which" = 1 ]; then
  "$here/norm_tile.sh" "$master" "$here/terrain_${id}.png"
else
  "$here/norm_tile.sh" "$master" "$here/terrain_${id}_${which}.png"
fi
