#!/usr/bin/env bash
# Take the newest PNG out of ~/Downloads, check it is a usable master, and
# normalise it onto its footprint's canvas.
#   ./ingest.sh housing 1 1 housing_l1.png
set -euo pipefail
slug=$1; fw=$2; fh=$3; out=$4
here="$(cd "$(dirname "$0")" && pwd)"
src=$(ls -t ~/Downloads/*.png | head -1)
master="$here/$slug-l1.master.png"
cp "$src" "$master"

corner=$(magick "$master" -format "%[pixel:p{0,0}]" info:)
dims=$(magick identify -format "%wx%h" "$master")
comp=$(magick "$master" -alpha extract -threshold 50% \
        -define connected-components:area-threshold=120 \
        -define connected-components:verbose=true -connected-components 8 null: 2>/dev/null \
        | grep -c 'srgb(255,255,255)' || true)
echo "  master $dims  esquina $corner  componentes opacos $comp"
[ "$corner" = "srgba(0,0,0,0)" ] || { echo "  FALLO: el fondo no es transparente"; exit 1; }

python3 "$here/norm_iso.py" "$master" "$fw" "$fh" "$here/$out"
