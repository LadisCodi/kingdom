#!/usr/bin/env python3
"""cut.py sheet.png album outdir  — find the white gutters of a 3x3 sheet, cut the nine cells,
inset them a little and rescale to 256x256 as card_<album>_<slot>.png."""
import sys, subprocess
from PIL import Image
sheet, album, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(sheet).convert('RGB'); W, H = im.size
px = im.load()
def is_white(v): return all(c > 235 for c in v)
def runs(axis):
    n = W if axis == 'x' else H; m = H if axis == 'x' else W
    white = []
    for i in range(n):
        cnt = 0
        for j in range(0, m, 4):
            v = px[i, j] if axis == 'x' else px[j, i]
            if is_white(v): cnt += 1
        white.append(cnt / (m / 4) > 0.9)
    # segments of non-white
    segs = []; start = None
    for i, w in enumerate(white + [True]):
        if not w and start is None: start = i
        if w and start is not None:
            if i - start > n * 0.15: segs.append((start, i))
            start = None
    return segs
xs, ys = runs('x'), runs('y')
print('cols', xs, 'rows', ys)
assert len(xs) == 3 and len(ys) == 3, 'did not find a 3x3 grid'
slot = 0
for (y0, y1) in ys:
    for (x0, x1) in xs:
        # square crop inset 6px, centred
        s = min(x1 - x0, y1 - y0) - 12
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        box = (cx - s // 2, cy - s // 2, cx - s // 2 + s, cy - s // 2 + s)
        out = f'{outdir}/card_{album}_{slot}.png'
        im.crop(box).resize((256, 256), Image.LANCZOS).save(out, optimize=True)
        print(out, box)
        slot += 1
