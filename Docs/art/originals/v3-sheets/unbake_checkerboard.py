#!/usr/bin/env python3
"""Turn ChatGPT's PAINTED transparency checkerboard into a real alpha channel.

    python3 unbake_checkerboard.py sheet.png out.png

Every sheet comes back as an opaque RGB PNG with the checkerboard drawn into
it, whatever the prompt says — asking the model to fix its own channel costs
ten minutes and often never lands (LOG.md, SPR-S). This is the deterministic
version, and it is seconds.

The two greys are about 130 and 191 with antialiased values in between, so the
mask is ANY near-grey in a wide band — and then only the part of it CONNECTED
TO THE BORDER, which is what keeps a pale blanket, a grey cistern or a stone
roof from being punched out of the drawing.

A SECOND PASS TAKES THE ENCLOSED PATCHES the border cannot reach: the pane of
a lantern's glass, the mouth of a horn, the inside of a ring. What tells those
apart from a genuinely grey object is that the checkerboard is TWO greys —
a patch that holds both the dark square and the light one, and alternates
between them, is the pattern; a flat grey is a drawing.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

LO, HI = 115, 208          # the band the checkerboard's greys live in
CHROMA = 12                # how far from grey a background pixel may drift
DARK, LIGHT = 150, 170     # a patch holding both of these is the pattern
MIN_PATCH = 200            # px, under which a patch is a speck, not a pane
SPECK = 40                 # px, under which an island of drawing is a speck


def _components(mask):
    """Every 8-connected component of `mask`, as (ys, xs) index arrays."""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            seen[sy, sx] = True
            q = deque([(sy, sx)])
            ys, xs = [], []
            while q:
                y, x = q.popleft()
                ys.append(y)
                xs.append(x)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
            yield np.array(ys), np.array(xs)


def unbake(path: str, out: str) -> float:
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    grey = (abs(r - g) <= CHROMA) & (abs(g - b) <= CHROMA) & (abs(r - b) <= CHROMA)
    checker = grey & (r >= LO) & (r <= HI)
    h, w = checker.shape

    seen = np.zeros((h, w), dtype=bool)
    q: deque = deque()
    for x in range(w):
        for y in (0, h - 1):
            if checker[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if checker[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and checker[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))

    # THE ENCLOSED PATCHES. Everything still masked is a checker region the
    # border could not reach — the glass of a lantern, the bell of a horn. It
    # is the pattern, and not a grey object, when the patch holds BOTH of the
    # checkerboard's greys: a flat grey component keeps its alpha.
    rest = checker & ~seen
    for ys, xs in _components(rest):
        v = r[ys, xs]
        if len(ys) >= MIN_PATCH and v.min() <= DARK and v.max() >= LIGHT:
            seen[ys, xs] = True

    # One pass for the soft edge between the pattern and the drawing.
    fringe = grey & (r >= 90) & (r <= 230) & ~seen
    nb = np.zeros_like(seen)
    nb[1:, :] |= seen[:-1, :]
    nb[:-1, :] |= seen[1:, :]
    nb[:, 1:] |= seen[:, :-1]
    nb[:, :-1] |= seen[:, 1:]
    seen |= fringe & nb

    # And the specks: a handful of stray pixels the sheet leaves floating in
    # the empty quadrant, which `norm_sq.fish` would otherwise take for
    # content and size the whole sprite against.
    for ys, xs in _components(~seen):
        if len(ys) < SPECK:
            seen[ys, xs] = True

    alpha = np.where(seen, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), "RGBA").save(out)
    return float(seen.mean())


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    cut = unbake(sys.argv[1], sys.argv[2])
    print(f"{sys.argv[2]}: {cut:.1%} of the canvas is now transparent")
    if cut < 0.3:
        print("  …that looks low. Check the band above against this sheet's greys.")
