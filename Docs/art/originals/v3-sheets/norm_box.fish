#!/usr/bin/env fish
# norm_box.fish <sheet.png> <crop geometry WxH+X+Y> <fill fraction> <out.png> [target w = 128] [target h = w]
# `norm_sq.fish` for the sheet whose vignette crossed a canvas midline: takes an
# explicit crop box instead of a quadrant, so the split can be moved into the
# real gap between two vignettes (find it with the alpha column profile —
# `-crop <row> -alpha extract -resize '1024x1!' txt:-` and look for the zero run).
set sheet $argv[1]; set geo $argv[2]; set frac $argv[3]; set out $argv[4]
set tw 128; set th 128
if set -q argv[5]; set tw $argv[5]; set th $argv[5]; end
if set -q argv[6]; set th $argv[6]; end
set tmp (mktemp --suffix=.png)
magick $sheet -crop $geo +repage -alpha extract -threshold 10% -format "%@" info: | read bbox
magick $sheet -crop $geo +repage $tmp
set box (math "floor("(math "min($tw,$th)")"*$frac)")
magick -size {$tw}x{$th} xc:none \( $tmp -crop $bbox +repage -filter point -resize {$box}x{$box} \) \
  -gravity center -composite $out
rm $tmp
echo "$out $tw x $th frac=$frac crop=$geo bbox=$bbox"
