#!/usr/bin/env python3
"""Cut the decorations sheet into sprites (Docs/plans/world-hex-art.md §3.1).

    cut_decos.py SHEET.png OUTDIR [--width 192]

The sheet is a 4x4 grid. In each cell only the shapes whose middle lies in
the cell's middle are kept — a tree top reaching up from the row below is
not the rock's — then the cell is trimmed to its opaque pixels, so the
sprite stands on its lowest one, and scaled down to at most WIDTH. Names
follow the rows of decorations.prompt.txt.
"""
import argparse
import numpy as np
from PIL import Image

NAMES = [
    'wdeco_tuft', 'wdeco_tuft_2', 'wdeco_tuft_3', 'wdeco_clover',
    'wdeco_bush', 'wdeco_bush_berries', 'wdeco_bushes', 'wdeco_fern',
    'wdeco_rock', 'wdeco_pebbles', 'wdeco_boulder', 'wdeco_stone',
    'wdeco_tree', 'wdeco_conifer', 'wdeco_tree_small', 'wdeco_flowers',
]

def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1
                stack = [(y, x)]
                lab[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n
                            stack.append((yy, xx))
    return lab, n

def own(cell: Image.Image) -> Image.Image:
    """The cell with only the shapes centred in its middle three quarters."""
    a = np.asarray(cell).copy()
    lab, n = label(a[:, :, 3] > 24)
    h, w = lab.shape
    keep = np.zeros_like(lab, bool)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if w * 0.125 <= xs.mean() <= w * 0.875 and h * 0.125 <= ys.mean() <= h * 0.875:
            keep |= lab == i
    # A shape's soft rim is below the threshold: keep what lies within 3 px.
    grown = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['MaxFilter']).MaxFilter(7))) > 0
    a[~grown] = 0
    return Image.fromarray(a, 'RGBA')

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('outdir')
    ap.add_argument('--width', type=int, default=192)
    a = ap.parse_args()
    img = Image.open(a.sheet).convert('RGBA')
    cw, ch = img.width / 4, img.height / 4
    for i, name in enumerate(NAMES):
        x, y = i % 4, i // 4
        cell = own(img.crop((round(x * cw), round(y * ch), round((x + 1) * cw), round((y + 1) * ch))))
        bbox = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        art = cell.crop(bbox)
        if art.width > a.width:
            art = art.resize((a.width, round(art.height * a.width / art.width)), Image.LANCZOS)
        art.save(f'{a.outdir}/{name}.png')
        print(name, art.size)

if __name__ == '__main__':
    main()
