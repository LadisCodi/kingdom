#!/usr/bin/env bash
# Cut the unlock-splash icon sheets into src/render/assets/unlock_<id>.png.
# Each icon is found as a connected blob of the alpha (specks under 5,000 px
# dropped), read in quadrant order tl tr bl br, cropped to its box, then its
# longest side is fitted at its fill of a SIZE x SIZE transparent square (Lanczos).
# Run from the repo root.
set -euo pipefail
SIZE=512   # a tall icon (the globe) gets a larger fill to weigh the same
D=Docs/art/ui/unlock; OUT=src/render/assets
cut_sheet() { # fill sheet id...   (ids in quadrant order: tl tr bl br)
  local box; box=$(awk "BEGIN{print int($SIZE*$1)}"); shift
  local sheet=$1; shift
  local w h; w=$(magick identify -format %w "$sheet"); h=$(magick identify -format %h "$sheet")
  # "geometry cx cy" per blob, then quadrant rank = 2*(cy>h/2) + (cx>w/2)
  mapfile -t blobs < <(magick "$sheet" -alpha extract -threshold 4% -morphology Dilate Disk:6 \
      -define connected-components:verbose=true -define connected-components:area-threshold=5000 \
      -connected-components 8 null: | awk -v w="$w" -v h="$h" '/srgb\(255,255,255\)/ {
        split($3, c, ","); print 2*(c[2]>h/2) + (c[1]>w/2), $2 }' | sort -n | cut -d' ' -f2)
  [ ${#blobs[@]} -eq $# ] || { echo "$sheet: ${#blobs[@]} blobs for $# ids" >&2; exit 1; }
  local i=0
  for id in "$@"; do
    magick "$sheet" -crop "${blobs[$i]}" +repage -trim +repage \
      -filter Lanczos -resize ${box}x${box} \
      -background none -gravity center -extent ${SIZE}x${SIZE} "$OUT/unlock_$id.png"
    echo "$OUT/unlock_$id.png  <- ${blobs[$i]}"
    i=$((i+1))
  done
}
cut_sheet 0.88 $D/sheet-1-mechanics.png build research heroes relics
cut_sheet 0.88 $D/sheet-2-books.png     book_warfare book_magic book_sagas book_atlas
cut_sheet 0.96 $D/sheet-3-world.png     world
# The Bag (2026-10-05): one icon alone on its sheet — trimmed and fitted.
magick $D/sheet-4-bag.png -trim +repage -filter Lanczos -resize 450x450 \
  -background none -gravity center -extent ${SIZE}x${SIZE} PNG32:$OUT/unlock_bag.png
