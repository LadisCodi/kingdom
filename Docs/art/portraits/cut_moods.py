#!/usr/bin/env python3
"""Cut a sheet of one character's moods into the build, all at ONE scale.

    python3 cut_moods.py sheet.png portrait_hob_happy portrait_hob_worried \
        portrait_hob_surprised [--scale 0.62] [--out DIR]

Unlike cut_heroes.py, which fits every figure to the frame on its own, the
figures of a mood sheet share one scale — the sheet's, or `--scale` to match
the character's rest pose — so a change of face never changes their size. Each
stands on the floor of the 512×768 frame, centred on its FEET (the bottom rows
of the figure), not its box: a raised hand or an axe never shifts the body —
unless that would leave the frame, when it is slid back inside.
"""
import argparse
import os

import numpy as np
from PIL import Image

from cut_heroes import ALPHA, CELL, FIT_H, FLOOR, H, W, blobs, box, gap

FEET = 0.06  # the bottom share of a figure read as its feet


def figures(path, count):
    px = np.array(Image.open(path).convert('RGBA'))
    px[px[:, :, 3] == 0, :3] = 0
    solid = px[:, :, 3] > ALPHA
    h, w = solid.shape
    coarse = solid[: h - h % CELL, : w - w % CELL]
    coarse = coarse.reshape(h // CELL, CELL, w // CELL, CELL).any(axis=(1, 3))
    lab, sizes = blobs(coarse)
    order = sorted(range(1, len(sizes)), key=lambda n: -sizes[n])
    if len(order) < count:
        raise SystemExit(f'found {len(order)} blobs, expected {count}')
    figs = sorted(order[:count], key=lambda n: box(lab, n)[0])
    boxes = {n: box(lab, n) for n in figs}
    owner = {n: n for n in figs}
    for n in order[count:]:
        owner[n] = min(figs, key=lambda f: gap(box(lab, n), boxes[f]))
    own = np.vectorize(lambda n: owner.get(n, 0))(lab)
    own = own.repeat(CELL, 0).repeat(CELL, 1)
    own = np.pad(own, ((0, h - own.shape[0]), (0, w - own.shape[1])))
    out = []
    for f in figs:
        one = px.copy()
        one[own != f] = 0
        img = Image.fromarray(one)
        out.append(img.crop(img.getbbox()))
    return out


def feet_x(img):
    a = np.array(img)[:, :, 3] > ALPHA
    rows = a[int(a.shape[0] * (1 - FEET)):]
    xs = np.nonzero(rows.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('ids', nargs='+')
    ap.add_argument('--scale', type=float)
    ap.add_argument('--out', default='src/render/assets')
    a = ap.parse_args()

    figs = figures(a.sheet, len(a.ids))
    s = a.scale or min(min(W / f.width, FIT_H / f.height) for f in figs)
    for fig, hid in zip(figs, a.ids):
        fx = feet_x(fig) * s
        fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
        frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        # Feet first; a figure that would leave the frame (a jump, one foot
        # up) is slid back inside it.
        left = min(max(round(W / 2 - fx), 0), W - fig.width)
        frame.paste(fig, (left, H - FLOOR - fig.height), fig)
        path = os.path.join(a.out, f'{hid}.png')
        frame.save(path, optimize=True)
        clipped = fig.width > W or fig.height > H - FLOOR
        print(f'{path}  scale {s:.3f}{"  CLIPPED" if clipped else ""}')


if __name__ == '__main__':
    main()
