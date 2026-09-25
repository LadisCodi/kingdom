#!/usr/bin/env bash
# A terrain master -> the game's tile.
#
# A ground tile is a DIAMOND that fills its canvas: 2:1, twice as wide as it
# is tall, transparent outside it. So normalising is a trim to the opaque
# region and a resize onto 256x128 -- twice the 128x64 the game draws at,
# because the renderer scales down and never up.
#
# It reports the master's own ratio BEFORE the resize. A master far from 2:1
# was drawn in the wrong camera and the squash will show whatever the output
# size says, so outside 1.80-2.20 this is an error and not a warning.
set -euo pipefail
src=$1; out=$2
dims=$(magick "$src" -trim +repage -format "%wx%h" info:)
w=${dims%x*}; h=${dims#*x}
ratio=$(echo "scale=2; $w / $h" | bc)
echo "  ink ${w}x${h}  ratio ${ratio}:1"
ok=$(echo "$ratio >= 1.80 && $ratio <= 2.20" | bc)
[ "$ok" = 1 ] || { echo "  FAIL: ${ratio}:1 is not the 2:1 camera — regenerate"; exit 1; }
magick "$src" -trim +repage -filter Lanczos -resize 256x128! -strip "$out"
echo "  wrote $out  256x128"
