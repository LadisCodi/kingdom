#!/usr/bin/env bash
# Pull a terrain's variants onto the same tone as its first one.
#
# Four separate generations of "the same ground" drift: one comes back
# yellower, the next bluer, and the field then reads as a PATCHWORK of tiles
# rather than as one meadow -- which is worse than the repeat the variants
# were bought to fix. The detail is what should differ; the colour must not.
#
# Per channel, a linear map that gives each variant the reference's mean and
# spread:  out = (in - mean) * (refSd / sd) + refMean.  It moves the tone and
# leaves the drawing alone.
set -euo pipefail
id=$1
here="$(cd "$(dirname "$0")" && pwd)"
ref="$here/terrain_${id}.png"
[ -f "$ref" ] || { echo "  FAIL: no $ref to match against"; exit 1; }

stat() { magick "$1" -channel "$2" -separate -format "%[fx:mean] %[fx:standard_deviation]" info:; }

for v in 2 3 4; do
  t="$here/terrain_${id}_${v}.png"
  [ -f "$t" ] || continue
  args=()
  for ch in R G B; do
    read -r rm rs <<<"$(stat "$ref" "$ch")"
    read -r tm ts <<<"$(stat "$t" "$ch")"
    a=$(awk -v rs="$rs" -v ts="$ts" 'BEGIN{ printf "%.6f", (ts < 0.0001 ? 1 : rs/ts) }')
    b=$(awk -v rm="$rm" -v tm="$tm" -v a="$a" 'BEGIN{ printf "%.6f", rm - a*tm }')
    args+=(-channel "$ch" -function Polynomial "$a,$b")
  done
  magick "$t" "${args[@]}" +channel "$t"
  printf "  %s  matched to %s\n" "$(basename "$t")" "$(basename "$ref")"
done
