#!/usr/bin/env bash
# A transition master -> the game's edge piece.
#
# An edge piece is NOT trimmed to its ink: WHERE the material sits inside the
# diamond is the whole point, so the canvas stays registered to the diamond it
# was drawn against. The master is square with the diamond centred, so the
# diamond is the full width and half the height; take that band and resize it
# onto 256x128, the canvas a tile lands on.
set -euo pipefail
src=$1; out=$2
dims=$(magick identify -format "%wx%h" "$src")
w=${dims%x*}; h=${dims#*x}
band=$((w / 2))
top=$(( (h - band) / 2 ))
magick "$src" -crop "${w}x${band}+0+${top}" +repage -filter Lanczos -resize 256x128! -strip "$out"

# Two things make a seam invisible, and both are worth failing on.
# The upper-right edge (the line from the top corner to the right corner)
# must be SOLID: sample a strip just inside it.
solid=$(magick "$out" -alpha extract -crop 112x40+136+6 +repage -format "%[fx:mean]" info:)
# The opposite third of the diamond must be EMPTY.
empty=$(magick "$out" -alpha extract -crop 70x50+8+40 +repage -format "%[fx:mean]" info:)
echo "  upper-right edge ${solid}  lower-left ${empty}   (want high, then near 0)"
awk -v s="$solid" 'BEGIN{ if (s < 0.55) print "  WARN: the upper-right edge is not solid — expect a seam" }'
awk -v e="$empty" 'BEGIN{ if (e > 0.20) print "  WARN: ink in the lower-left — this is not one edge" }'
echo "  wrote $out  256x128"
