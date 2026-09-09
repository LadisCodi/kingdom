"""Exact alpha from one image composited over black and over white.

Over black:  B = a*C          Over white:  W = a*C + (1-a)
=> a = 1 - (W - B)   and   C = B / a

Only valid if the two files are the same render. This script measures that
before it trusts it.
"""
import sys
import numpy as np
from PIL import Image

blk = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.float64) / 255.0
wht = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.float64) / 255.0
out = sys.argv[3]

d = wht - blk                       # (1-a) per channel, ideally identical
# Agreement between channels is the honesty check: for a真 composite the three
# channels must give the SAME (1-a).
spread = d.max(axis=2) - d.min(axis=2)
print(f"channel spread of (1-a):  mean={spread.mean():.4f}  p99={np.percentile(spread,99):.4f}  max={spread.max():.4f}")
print(f"(W-B) out of [0,1] range: {(d < -0.02).mean()*100:.3f}% negative, {(d > 1.02).mean()*100:.3f}% over 1")

a = np.clip(1.0 - d.mean(axis=2), 0.0, 1.0)
hist, edges = np.histogram(a, bins=[0, .001, .05, .25, .5, .75, .95, .999, 1.001])
print("alpha histogram:")
for h, lo, hi in zip(hist, edges[:-1], edges[1:]):
    print(f"  {lo:.3f}–{hi:.3f}: {h/a.size*100:8.4f}%   ({h} px)")

# Unpremultiply. Where alpha is tiny the colour is unknowable, so leave it 0.
safe = a > 0.004
c = np.zeros_like(blk)
c[safe] = np.clip(blk[safe] / a[safe, None], 0.0, 1.0)

rgba = np.dstack([c, a])
Image.fromarray((rgba * 255.0 + 0.5).astype(np.uint8), 'RGBA').save(out)
print(f"wrote {out}")
