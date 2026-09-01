#!/usr/bin/env fish
set sheet $argv[1]; set q $argv[2]; set frac $argv[3]; set out $argv[4]
set W (magick identify -format %w $sheet); set H (magick identify -format %h $sheet)
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
set tw (math "floor(256*$frac)"); set th (math "floor(128*$frac)")
magick -size 256x128 xc:none \( $tmp -crop $bbox +repage -filter point -resize {$tw}x{$th} \) \
  -gravity center -composite $out
rm $tmp
echo "$out frac=$frac bbox=$bbox"
