#!/usr/bin/env bash
# A terrain master -> the game's tile.
#
# A tile is a plain SQUARE patch of material, fully opaque, with no shape of
# its own: the renderer maps it corner to corner onto the cell's diamond
# (src/render/iso.ts, onDiamond), which is exactly what the isometric camera
# does to a square of ground. So normalising is only a resize onto 256x256 --
# twice the diamond's 128 across, because the renderer scales down, never up.
#
# What it CHECKS is the thing that goes wrong: any transparency at all means
# the model drew a shape instead of a texture, and the corners of that shape
# are exactly where four tiles meet.
set -euo pipefail
src=$1; out=$2
alpha=$(magick "$src" -alpha extract -format "%[fx:minima]" info:)
echo "  minimum opacity ${alpha}   (want 1: a texture, not a shape)"
awk -v a="$alpha" 'BEGIN{ if (a < 0.99) { print "  FAIL: the master has transparent pixels — it drew a tile, not a texture"; exit 1 } }'
magick "$src" -alpha off -filter Lanczos -resize 256x256! -strip "$out"
echo "  wrote $out  256x256"
