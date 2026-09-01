#!/usr/bin/env fish
# anim_norm.fish <sheet.png> <frac> <out1:q1> [<out2:q2> ...]
# Animation-group normalizer: all listed quadrants get ONE common scale and a
# shared feet baseline, so frames register instead of jittering in size.
set sheet $argv[1]; set frac $argv[2]
set W (magick identify -format %w $sheet); set H (magick identify -format %h $sheet)
set hw (math "floor($W/2)"); set hh (math "floor($H/2)")
function geo_of
  switch $argv[1]
    case tl; echo {$argv[2]}x{$argv[3]}+0+0
    case tr; echo {$argv[2]}x{$argv[3]}+{$argv[2]}+0
    case bl; echo {$argv[2]}x{$argv[3]}+0+{$argv[3]}
    case br; echo {$argv[2]}x{$argv[3]}+{$argv[2]}+{$argv[3]}
  end
end
# First pass: bboxes and the group's max height/width.
set maxH 0; set maxW 0
set outs; set quads; set bws; set bhs; set bxs; set bys
for spec in $argv[3..-1]
  set parts (string split : $spec)
  set -a outs $parts[1]; set -a quads $parts[2]
  set geo (geo_of $parts[2] $hw $hh)
  magick $sheet -crop $geo +repage -alpha extract -threshold 10% -format "%@" info: | read bbox
  set bw (string split x $bbox)[1]
  set rest (string split x $bbox)[2]
  set bh (string split + $rest)[1]
  set bx (string split + $rest)[2]
  set by (string split + $rest)[3]
  set -a bws $bw; set -a bhs $bh; set -a bxs $bx; set -a bys $by
  if test $bh -gt $maxH; set maxH $bh; end
  if test $bw -gt $maxW; set maxW $bw; end
end
set s (math "min((128*$frac)/$maxH, (128*0.98)/$maxW)")
set baseline (math "floor(64 + ($maxH*$s)/2)")
# Second pass: crop each frame's bbox, common scale, feet on the baseline.
for i in (seq (count $outs))
  set geo (geo_of $quads[$i] $hw $hh)
  set tw (math "max(1, round($bws[$i]*$s))")
  set th (math "max(1, round($bhs[$i]*$s))")
  set px (math "floor(64 - $tw/2)")
  set py (math "floor($baseline - $th)")
  set tmp (mktemp --suffix=.png)
  magick $sheet -crop $geo +repage -crop {$bws[$i]}x{$bhs[$i]}+{$bxs[$i]}+{$bys[$i]} +repage $tmp
  magick -size 128x128 xc:none \( $tmp -filter point -resize {$tw}x{$th}\! \) \
    -geometry +{$px}+{$py} -composite $outs[$i]
  rm $tmp
  echo "$outs[$i] <- $quads[$i] scale=$s box={$tw}x{$th}"
end
