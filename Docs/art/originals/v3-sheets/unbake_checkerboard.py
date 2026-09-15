#!/usr/bin/env python3
"""Turn ChatGPT's PAINTED transparency checkerboard into a real alpha channel.

    python3 unbake_checkerboard.py sheet.png out.png

Every sheet comes back as an opaque RGB PNG with the checkerboard drawn into
it, whatever the prompt says — asking the model to fix its own channel costs
ten minutes and often never lands (LOG.md, SPR-S). This is the deterministic
version, and it is seconds.

THE TWO GREYS ARE NOT ALWAYS THE SAME TWO. The building sheets came back at
about 130 and 191; the album medallions of 2026-09-15 came back at 209 and
253, which a fixed band misses entirely (1.1% cut instead of 80%). So the pair
is MEASURED off the canvas border — the one place the sheet is certainly
background — and the band is built around it. The constants below are only the
fallback for a border that is not a checkerboard at all.

The mask is any near-grey in that band, and then only the part of it CONNECTED
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

LO, HI = 115, 208          # the FALLBACK band, when the border reads nothing
CHROMA = 12                # how far from grey a background pixel may drift
MARGIN = 14                # how far past each measured grey the band reaches
MIN_PATCH = 200            # px, under which a patch is a speck, not a pane
SPECK = 40                 # px, under which an island of drawing is a speck
RING = 6                   # px of border to measure the checkerboard from


def _band(r, g, b):
    """The two checkerboard greys, measured off the canvas border.

    The border ring is background on every sheet the model returns — a
    medallion or a lantern never reaches the edge — so its two most common
    near-grey values ARE the pattern. Returns the band to mask and the
    midpoint that tells the dark square from the light one.
    """
    ring = np.concatenate([
        np.stack([c[:RING, :].ravel() for c in (r, g, b)], 1),
        np.stack([c[-RING:, :].ravel() for c in (r, g, b)], 1),
        np.stack([c[:, :RING].ravel() for c in (r, g, b)], 1),
        np.stack([c[:, -RING:].ravel() for c in (r, g, b)], 1),
    ])
    grey = ring[(abs(ring[:, 0] - ring[:, 1]) <= CHROMA)
                & (abs(ring[:, 1] - ring[:, 2]) <= CHROMA)
                & (abs(ring[:, 0] - ring[:, 2]) <= CHROMA)]
    if len(grey) < ring.shape[0] // 2:
        return LO, HI, (LO + HI) // 2     # the border is not background
    vals, counts = np.unique(grey[:, 0], return_counts=True)
    # The two peaks, far enough apart to be the two squares rather than one
    # square and its own antialiasing.
    first = int(vals[counts.argmax()])
    apart = abs(vals.astype(int) - first) >= 8
    second = int(vals[apart][counts[apart].argmax()]) if apart.any() else first
    lo, hi = min(first, second), max(first, second)
    return lo - MARGIN, hi + MARGIN, (lo + hi) // 2


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
    lo, hi, mid = _band(r, g, b)
    checker = grey & (r >= lo) & (r <= hi)
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
        if len(ys) >= MIN_PATCH and v.min() < mid and v.max() > mid:
            seen[ys, xs] = True

    # One pass for the soft edge between the pattern and the drawing.
    fringe = grey & (r >= lo - 25) & (r <= hi + 22) & ~seen
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
