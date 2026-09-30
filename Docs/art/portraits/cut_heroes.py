#!/usr/bin/env python3
"""Cut a hero sheet into its figures and land each in the build.

    python3 cut_heroes.py sheet.png hero_rogue hero_warden hero_joker [--out DIR]

The sheet is N full-body figures side by side on true alpha
(Docs/art/portraits/hero-illustrations.md §5). Figures overlap in COLUMNS —
one's dagger reaches under the next one's sword — so they are found as
connected blobs of opaque pixels instead, on a 4× coarser grid so a hairline
gap inside a figure does not split it. The N largest blobs are the figures;
every smaller one (a floating sparkle, a stardust mote) joins the figure whose
box is nearest.

Each figure is trimmed, fit into 512×706 and stood on the floor of a
512×768 frame — the normalization every hero shares (§6).
"""
import argparse
import os

import numpy as np
from PIL import Image

W, H, FIT_H, FLOOR = 512, 768, 706, 20
ALPHA = 24     # a pixel counts as "figure" once it is this opaque
CELL = 4       # the coarse grid the blobs are found on


def blobs(mask):
    """Label 4-connected blobs of a boolean grid; returns (labels, sizes)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes)
            lab[y0, x0] = n
            stack, size = [(y0, x0)], 0
            while stack:
                y, x = stack.pop()
                size += 1
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
            sizes.append(size)
    return lab, sizes


def box(lab, n):
    ys, xs = np.nonzero(lab == n)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def gap(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return dx * dx + dy * dy


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('ids', nargs='+')
    ap.add_argument('--out', default='src/render/assets')
    a = ap.parse_args()

    im = Image.open(a.sheet).convert('RGBA')
    px = np.array(im)
    px[px[:, :, 3] == 0, :3] = 0          # no colour hiding under alpha 0
    solid = px[:, :, 3] > ALPHA
    h, w = solid.shape
    coarse = solid[: h - h % CELL, : w - w % CELL]
    coarse = coarse.reshape(h // CELL, CELL, w // CELL, CELL).any(axis=(1, 3))
    lab, sizes = blobs(coarse)
    order = sorted(range(1, len(sizes)), key=lambda n: -sizes[n])
    if len(order) < len(a.ids):
        raise SystemExit(f'found {len(order)} blobs, expected {len(a.ids)}')
    figs = sorted(order[: len(a.ids)], key=lambda n: box(lab, n)[0])
    owner = {n: n for n in figs}
    boxes = {n: box(lab, n) for n in figs}
    for n in order[len(a.ids):]:
        b = box(lab, n)
        owner[n] = min(figs, key=lambda f: gap(b, boxes[f]))
    own = np.vectorize(lambda n: owner.get(n, 0))(lab)
    own = own.repeat(CELL, 0).repeat(CELL, 1)
    own = np.pad(own, ((0, h - own.shape[0]), (0, w - own.shape[1])))

    for f, hid in zip(figs, a.ids):
        one = px.copy()
        one[own != f] = 0
        fig = Image.fromarray(one)
        fig = fig.crop(fig.getbbox())
        s = min(W / fig.width, FIT_H / fig.height)
        fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
        frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        frame.paste(fig, ((W - fig.width) // 2, H - FLOOR - fig.height))
        path = os.path.join(a.out, f'{hid}.png')
        frame.save(path, optimize=True)
        print(f'{path}  box {boxes[f]}  scale {s:.2f}')


if __name__ == '__main__':
    main()
