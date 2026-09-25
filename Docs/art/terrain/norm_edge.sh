#!/usr/bin/env bash
# A transition master -> the game's fringe.
#
# A fringe is a SQUARE with a band of material across its TOP, fading down
# into real transparency. The renderer maps that square onto the cell's
# diamond with the top edge landing on whichever side the neighbour is across
# (src/render/terrain.ts), so one piece serves all four sides.
set -euo pipefail
src=$1; out=$2
magick "$src" -filter Lanczos -resize 256x256! -strip "$out"

# Two things make a seam invisible, and both are worth failing on.
top=$(magick "$out" -alpha extract -crop 256x10+0+0 +repage -format "%[fx:mean]" info:)
bottom=$(magick "$out" -alpha extract -crop 256x150+0+106 +repage -format "%[fx:mean]" info:)
echo "  top band ${top}   bottom two thirds ${bottom}   (want ~1, then ~0)"
awk -v t="$top" 'BEGIN{ if (t < 0.92) print "  WARN: the top edge is not solid — expect a bright seam" }'
awk -v b="$bottom" 'BEGIN{ if (b > 0.08) print "  WARN: ink low in the frame — the fringe reaches too far in" }'
echo "  wrote $out  256x256"
