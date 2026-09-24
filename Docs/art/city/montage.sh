#!/usr/bin/env bash
# The second anchor: every sprite already accepted, on one sheet, at game size.
# Attached alongside style-reference.png so a new building matches the camera
# and the scale of the ones that landed (Docs/art/art-direction.md §9).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
shopt -s nullglob
files=("$here"/*_l1.png)
[ ${#files[@]} -eq 0 ] && { echo "  nada aceptado todavía"; exit 1; }
magick montage "${files[@]}" -tile 5x -geometry +14+14 \
  -background '#3b3b3b' -mode Concatenate -tile 5x "$here/_anchor.png" 2>/dev/null \
  || magick "${files[@]}" -background '#3b3b3b' -gravity south +append "$here/_anchor.png"
echo "  _anchor.png con ${#files[@]}: $(basename -a "${files[@]}" | tr '\n' ' ')"
