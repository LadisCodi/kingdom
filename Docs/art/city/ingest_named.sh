#!/usr/bin/env bash
# ingest_named.sh <slug-lN> <fw> <fh> [foot FILL]
# Take ~/Descargas/kd-<slug-lN>.png, keep it as the master (half scale), and
# normalise it into Docs/art/city and src/render/assets — through norm_iso.py,
# or norm_foot.sh with `foot FILL` for a loose building.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; name=$1; fw=$2; fh=$3
src=~/Descargas/kd-$name.png
asset=$(echo "$name" | sed 's/-l\([0-9]\)$/_l\1/; s/-ruin$/_ruin/' | tr - _)
master="$here/$name.master.png"
magick "$src" -resize 50% -strip "$master"
corner=$(magick "$master" -format "%[pixel:p{0,0}]" info:)
[ "$corner" = "srgba(0,0,0,0)" ] || { echo "FALLO: $name no es transparente ($corner)"; exit 1; }
W=$((64 * (fw + fh))); H=$(( 32 * (fw + fh) + ( (fw == 2 && fh == 2) ? 192 : 128 ) ))
if [ "${4:-}" = foot ]; then "$here/norm_foot.sh" "$master" $W $H "$5" "$here/$asset.png" >/dev/null
else python3 "$here/norm_iso.py" "$master" $fw $fh "$here/$asset.png" 2>/dev/null | grep proyec || true; fi
cp "$here/$asset.png" "$here/../../../src/render/assets/$asset.png"
echo "$asset.png $(magick "$here/$asset.png" -format '%wx%h %@' info:)"
