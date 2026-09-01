#!/usr/bin/env fish
# quad.fish <sheet.png> <quadrant: tl|tr|bl|br> <out.png>
# Crops a 2x2 sheet quadrant, recenters the sprite on its transparent
# canvas, and nearest-neighbor downscales to 128x128.
set sheet $argv[1]; set q $argv[2]; set out $argv[3]
set W (magick identify -format %w $sheet); set H (magick identify -format %h $sheet)
set hw (math "floor($W/2)"); set hh (math "floor($H/2)")
switch $q
  case tl; set geo {$hw}x{$hh}+0+0
  case tr; set geo {$hw}x{$hh}+{$hw}+0
  case bl; set geo {$hw}x{$hh}+0+{$hh}
  case br; set geo {$hw}x{$hh}+{$hw}+{$hh}
end
set tmp (mktemp --suffix=.png)
magick $sheet -crop $geo +repage $tmp
# bounding box of non-transparent content
set bbox (magick $tmp -alpha extract -threshold 10% -format "%@" info:)
set bw (string split x $bbox)[1]
set rest (string split x $bbox)[2]
set bh (string split + $rest)[1]
set bx (string split + $rest)[2]
set by (string split + $rest)[3]
# recenter sprite on a fresh transparent canvas of the same quadrant size
set cx (math "floor(($hw - $bw)/2)")
set cy (math "floor(($hh - $bh)/2)")
magick -size {$hw}x{$hh} xc:none \( $tmp -crop {$bw}x{$bh}+{$bx}+{$by} +repage \) \
  -geometry +{$cx}+{$cy} -composite -filter point -resize 128x128 $out
rm $tmp
echo "$out <- $q bbox=$bbox"
