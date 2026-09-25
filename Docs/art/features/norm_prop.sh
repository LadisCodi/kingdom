#!/usr/bin/env bash
# A map-feature master -> the game's sprite.
#
# A feature STANDS on its plot, so the renderer scales it to the plot's ground
# diamond (128px across for a 1x1) and puts its bottom edge on the diamond's
# bottom corner (src/render/iso.ts, drawStanding). One rule, no exceptions.
#
# HOW BIG THE THING IS, though, is not one rule. A boar is knee-high on a
# farmhand and a forest towers over a cottage, and the renderer has no way to
# know which is which. So the size is AUTHORED, as `scale` in props.json --
# the fraction of the plot's diamond the drawing spans -- and BAKED IN here:
# the ink is scaled to that fraction and centred on a full-width canvas, its
# feet on the bottom edge. The renderer keeps its single rule and the sprite
# carries its own size.
#
# It reports the drawn height in plots, which is what to compare against a
# villager (about 0.35 of a plot tall) and a 1x1 cottage (about 1.5).
set -euo pipefail
src=$1; out=$2; scale=${3:-1}

W=256                                   # twice the 1x1 diamond; we scale down
inkw=$(awk -v s="$scale" -v w="$W" 'BEGIN{ printf "%d", w*s }')
dims=$(magick "$src" -trim +repage -format "%wx%h" info:)
w=${dims%x*}; h=${dims#*x}
tall=$(awk -v w="$w" -v h="$h" -v s="$scale" 'BEGIN{ printf "%.2f", (h/w)*s }')
echo "  ink ${w}x${h}  scale ${scale}  -> ${tall} plots tall"

magick "$src" -trim +repage -filter Lanczos -resize "${inkw}x" \
  -background none -gravity South -extent "${W}x" -strip "$out"
echo "  wrote $out  $(magick identify -format '%wx%h' "$out")"
