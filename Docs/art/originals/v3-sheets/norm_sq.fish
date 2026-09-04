#!/usr/bin/env fish
# norm_sq.fish <sheet.png> <quadrant tl|tr|bl|br> <fill fraction 0-1> <out.png> [target px = 128] [target_h = target]
# The generalized norm.fish: crop one quadrant of a 2x2 sheet, trim it to its
# content, and rescale that onto a WxH transparent canvas at `frac` of its
# smaller side. `norm.fish` is this at 128x128, `norm_wide.fish` at 256x128.
set sheet $argv[1]; set q $argv[2]; set frac $argv[3]; set out $argv[4]
set W (magick identify -format %w $sheet); set H (magick identify -format %h $sheet)
set tw 128; set th 128
if set -q argv[5]; set tw $argv[5]; set th $argv[5]; end
if set -q argv[6]; set th $argv[6]; end
set hw (math "floor($W/2)"); set hh (math "floor($H/2)")
switch $q
  case tl; set geo {$hw}x{$hh}+0+0
  case tr; set geo {$hw}x{$hh}+{$hw}+0
  case bl; set geo {$hw}x{$hh}+0+{$hh}
  case br; set geo {$hw}x{$hh}+{$hw}+{$hh}
end
set tmp (mktemp --suffix=.png)
magick $sheet -crop $geo +repage -alpha extract -threshold 10% -format "%@" info: | read bbox
magick $sheet -crop $geo +repage $tmp
set box (math "floor("(math "min($tw,$th)")"*$frac)")
magick -size {$tw}x{$th} xc:none \( $tmp -crop $bbox +repage -filter point -resize {$box}x{$box} \) \
  -gravity center -composite $out
rm $tmp
echo "$out $tw x $th frac=$frac bbox=$bbox"
