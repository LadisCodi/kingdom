#!/usr/bin/env bash
# norm_foot.sh master.png W H fill out.png
# For a loose building that norm_iso.py cannot measure (nothing traces the plot,
# or a windmill's sails are its widest points): trim, scale to `fill` of the
# canvas width (never taller than the canvas), and stand its lowest pixel on the
# canvas's bottom edge — the diamond's front corner, as every tier already does.
set -euo pipefail
m=$1; W=$2; H=$3; fill=$4; out=$5
bw=$(python3 -c "print(round($W*$fill))")
magick -size ${W}x${H} xc:none \( "$m" -trim +repage -filter Lanczos -resize "${bw}x${H}" \) \
  -gravity south -composite "$out"
magick "$out" -format "  $out %@\n" info:
