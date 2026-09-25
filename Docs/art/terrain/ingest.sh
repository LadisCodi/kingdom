#!/usr/bin/env bash
# Newest PNG in ~/Downloads -> master -> the game's tile.
#   ./ingest.sh grassland 1      (a tile)
#   ./ingest.sh grassland edge   (a transition piece)
set -euo pipefail
id=$1; which=$2
here="$(cd "$(dirname "$0")" && pwd)"
# `prep.sh` touches _marker; the download has to be NEWER than it.
#
# Matching "the newest PNG in ~/Downloads" alone is how a Rune Carver once
# became a grassland tile, and later how a download that never landed let the
# PREVIOUS tile be ingested twice under two names -- silently, because the
# stale file was only a few minutes old. A marker catches both: it is the
# moment this grab began, and nothing older than it can be this grab.
shopt -s nullglob
src=$(ls -t ~/Downloads/*.png 2>/dev/null | head -1)
[ -n "$src" ] || { echo "  FAIL: no PNG in ~/Downloads at all"; exit 1; }
[ -f "$here/_marker" ] || { echo "  FAIL: run ./prep.sh before the grab"; exit 1; }
[ "$src" -nt "$here/_marker" ] || {
  echo "  FAIL: the newest download predates this grab — it did not land"
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
