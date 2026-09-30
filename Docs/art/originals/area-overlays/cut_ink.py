"""Cut the ink overlay pieces out of ChatGPT's sheet (ink-pieces-sheet.png).

The sheet is ink on flat white, so alpha is recovered from the ink's own
colour: a pixel c = a·ink + (1 − a)·white gives a = (255 − c) / (255 − ink).
Writes into src/render/assets/:
  overlay_ink_line.png   — the area's edge, a horizontal stroke (sliced per edge)
  overlay_ink_knot.png   — the blot that sits on every corner of the area
  overlay_reach_dash.png — one edge of the reach: the dash, dot centre to dot centre
  overlay_reach_dot.png  — the dot on every vertex of the reach
  overlay_parchment.png  — the area's wash, made seamless (opaque, tiled in code)
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parents[3] / 'src' / 'render' / 'assets'
rgb = np.asarray(Image.open(HERE / 'ink-pieces-sheet.png').convert('RGB')).astype(np.float32)
H, W, _ = rgb.shape
dark = (255 - rgb.min(axis=2)) > 40  # anything that is not paper

def bbox(mask):
    ys, xs = np.nonzero(mask)
    return ys.min(), ys.max() + 1, xs.min(), xs.max() + 1

def unmix(region, pad=6):
    """Ink colour from the darkest tenth, then alpha per pixel."""
    lum = region.mean(axis=2)
    core = region[lum <= np.percentile(lum[lum < 200], 10)]
    ink = np.median(core, axis=0)
    a = ((255 - region) / np.maximum(1, 255 - ink)).mean(axis=2)
    a = np.clip((a - 0.06) / 0.94, 0, 1)  # drop the paper's faint grain
    out = np.zeros(region.shape[:2] + (4,), np.uint8)
    out[..., :3] = ink.astype(np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
    return out

def save(arr, name):
    Image.fromarray(arr).save(OUT / name)
    print(name, arr.shape[1], 'x', arr.shape[0])

def band(y0, y1):
    m = np.zeros_like(dark); m[y0:y1] = dark[y0:y1]; return m

# Row 1: the line. Trim its flat ends; keep the stroke's own height plus a margin.
y0, y1, x0, x1 = bbox(band(0, 170))
line = unmix(rgb[y0 - 4:y1 + 4, x0 + 24:x1 - 24])
save(line, 'overlay_ink_line.png')

# Row 2: dots and dashes, found as runs of ink along the row's centre.
y0, y1, x0, x1 = bbox(band(170, 320))
cy = (y0 + y1) // 2
col = dark[y0:y1].any(axis=0)
runs, start = [], None
for x in range(W):
    if col[x] and start is None: start = x
    if not col[x] and start is not None: runs.append((start, x)); start = None
dots = [r for r in runs if r[1] - r[0] < 80]
dashes = [r for r in runs if r[1] - r[0] >= 80]
d0, d1 = dots[0], dots[1]
c0, c1 = (d0[0] + d0[1]) // 2, (d1[0] + d1[1]) // 2
dash = unmix(rgb[y0 - 4:y1 + 4, c0:c1].copy())
dash[:, : d0[1] - c0 + 1, 3] = 0          # the dot is drawn on its own
dash[:, d1[0] - c0 - 1:, 3] = 0
save(dash, 'overlay_reach_dash.png')
save(unmix(rgb[y0 - 4:y1 + 4, d0[0] - 4:d0[1] + 4]), 'overlay_reach_dot.png')

# Row 3 left: the knot.
y0, y1, x0, x1 = bbox(band(320, H) & (np.arange(W)[None, :] < W // 2))
save(unmix(rgb[y0 - 4:y1 + 4, x0 - 4:x1 + 4]), 'overlay_ink_knot.png')

# Row 3 right: the parchment, inset off its edge, then made seamless by
# crossfading it with itself rolled half a tile (its edges become its middle).
pm = (rgb[320:, W // 2:].min(axis=2) < 245)
ys, xs = np.nonzero(pm)
p = rgb[320 + ys.min() + 24:320 + ys.max() - 24, W // 2 + xs.min() + 24:W // 2 + xs.max() - 24]
n = min(p.shape[:2]); p = p[:n, :n]
r = np.roll(p, (n // 2, n // 2), axis=(0, 1))
t = np.linspace(-1, 1, n)
w = np.clip(1 - np.maximum(np.abs(t)[:, None], np.abs(t)[None, :]), 0, 1)[..., None] ** 0.6
seam = (p * w + r * (1 - w))
img = Image.fromarray(seam.astype(np.uint8)).resize((256, 256), Image.LANCZOS)
img.save(OUT / 'overlay_parchment.png'); print('overlay_parchment.png 256 x 256')
