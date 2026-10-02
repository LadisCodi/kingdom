#!/usr/bin/env bash
# The Royal Survey's pieces (Docs/art/ui/mockups/royal-survey-prompts.md):
# the ChatGPT originals in this folder, trimmed and sized into src/ui/assets.
# The plank and the plate take their twins' exact pixel sizes, so they share
# their nine-slice numbers.
set -euo pipefail
cd "$(dirname "$0")"
out=../../../../src/ui/assets
square() { magick "$1" -trim +repage -background none -gravity center -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" -resize "$2x$2" "$out/$3"; }
square survey-compass-raw.png 256 survey-compass.png
square survey-chest-raw.png 320 survey-chest.png
magick plank-gold-raw.png -trim +repage -resize '765x170!' "$out/plank-gold.png"
magick plate-gold-raw.png -trim +repage -resize '572x258!' "$out/plate-gold.png"
magick survey-map-raw.png -resize '1500x500^' -gravity center -extent 1500x500 -quality 85 "$out/survey-map.jpg"
