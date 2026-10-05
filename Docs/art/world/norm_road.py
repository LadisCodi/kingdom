#!/usr/bin/env python3
"""Make the road strip tile (Docs/plans/world-districts.md §3).

    norm_road.py STRIP.png OUT.png [--overlap 200] [--height 192]

Crops the strip to its opaque band, cross-fades its last OVERLAP columns
into its first so its right edge runs on into its left, and scales it to
HEIGHT. Lanczos.
"""
import argparse
import numpy as np
from PIL import Image

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('strip'); ap.add_argument('out')
    ap.add_argument('--overlap', type=int, default=200)
    ap.add_argument('--height', type=int, default=192)
    a = ap.parse_args()
    im = np.asarray(Image.open(a.strip).convert('RGBA')).astype(np.float64)
    rows = np.where(im[:, :, 3].max(axis=1) > 8)[0]
    im = im[max(0, rows.min() - 4):rows.max() + 5]
    w, o = im.shape[1], a.overlap
    tile = im[:, :w - o].copy()
    t = np.linspace(0.0, 1.0, o)[None, :, None]
    tile[:, :o] = im[:, :o] * t + im[:, w - o:] * (1 - t)
    out = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8), 'RGBA')
    scale = a.height / out.height
    out = out.resize((round(out.width * scale), a.height), Image.LANCZOS)
    out.save(a.out)
    seam = np.abs(np.asarray(out, float)[:, 0] - np.asarray(out, float)[:, -1]).mean()
    print(f'{a.out}: {out.width}x{out.height}, seam {seam:.2f}')

if __name__ == '__main__':
    main()
