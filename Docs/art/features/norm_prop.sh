#!/usr/bin/env bash
# A map-feature master -> the game's sprite.
#
# A feature STANDS on its plot, so the renderer scales it to the plot's ground
# diamond (128px across for a 1x1) and puts its bottom edge on the diamond's
# bottom corner (src/render/iso.ts, drawStanding). Normalising is therefore
# just: trim to the ink, and scale so the ink is 256 wide -- twice the
# diamond, because the renderer scales down and never up. Height follows the
# art, and `spriteInkTop` reads back where the roof really is.
#
# It reports how tall the result is relative to its plot. Anything under about
# 0.8 has sprawled sideways instead of standing up, and will look squat.
set -euo pipefail
src=$1; out=$2
dims=$(magick "$src" -trim +repage -format "%wx%h" info:)
w=${dims%x*}; h=${dims#*x}
awk -v w="$w" -v h="$h" 'BEGIN{ printf "  ink %dx%d  height %.2f plots\n", w, h, h/w }'
magick "$src" -trim +repage -filter Lanczos -resize 256x -strip "$out"
echo "  wrote $out  $(magick identify -format '%wx%h' "$out")"
