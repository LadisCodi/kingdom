#!/usr/bin/env python3
"""Unbake ChatGPT's painted transparency checkerboard — whatever shade it is.

    python3 unbake_adaptive.py render.png out.png

Same idea and same safety rule as
`Docs/art/originals/v3-sheets/unbake_checkerboard.py`: mask the near-greys of
the pattern, keep only the part CONNECTED TO THE BORDER, so pale art inside
the drawing survives. One difference, and it is the reason this file exists —
**the band is measured, not hardcoded.**

That script's band is 115–208, tuned to the sprite sheets' checkerboard
(~130/191). The hero portraits come back with a much PALER pattern (~230/250),
which falls straight through it: the Vampire Lord's render reported "0.0% of
the canvas is now transparent". So the two tones are read off the border ring,
which is background by construction, and the mask follows from them.

Also handles the case where the pattern is missing entirely and the background
came back as one flat colour — the ring is then a single tone and the same
border-connected fill does the job.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

CHROMA = 14        # how far from grey a background pixel may drift
TOL = 12           # slack around the measured tones
RING = 4           # how deep the sampled border ring is
FRINGE = 26        # extra reach for the one antialiased edge pass


def unbake(path: str, out: str) -> float:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h, w = r.shape
    grey = (abs(r - g) <= CHROMA) & (abs(g - b) <= CHROMA) & (abs(r - b) <= CHROMA)

    # The border ring is background by construction: measure the pattern there.
    ring = np.zeros((h, w), dtype=bool)
    ring[:RING, :] = ring[-RING:, :] = True
    ring[:, :RING] = ring[:, -RING:] = True
    tones = r[ring & grey]
    if tones.size < 100:
        raise SystemExit("the border ring is not grey — this render has a real backdrop, not a pattern")
    lo, hi = int(np.percentile(tones, 0.5)) - TOL, int(np.percentile(tones, 99.5)) + TOL
    print(f"measured pattern band: {lo}–{hi}  (ring samples: {tones.size})")

    checker = grey & (r >= lo) & (r <= hi)

    # The pattern's OWN signature, so an enclosed pocket of it can be removed
    # too. Border connectivity alone leaves the background trapped between an
    # arm and a coat, or inside the curve of a bow, and that is most of a
    # roster: the Vampire Lord's first pass left a slab of checkerboard behind
    # his rapier. A checkerboard alternates two exact tones every pixel, and a
    # drawing does not, so: near tone A with a neighbour near tone B, or the
    # reverse. Art has to be a 1px two-tone lattice to be caught by this.
    tv, tc = np.unique(r[ring & grey], return_counts=True)
    modes = [int(v) for _, v in sorted(zip(tc, tv), reverse=True)]
    a_tone = modes[0]
    b_tone = next((m for m in modes if abs(m - a_tone) > 3 * TOL), None)
    if b_tone is None:
        print(f"one flat background tone ({a_tone}) — no pattern to alternate")
        alternating = np.zeros((h, w), dtype=bool)
    else:
        print(f"pattern tones: {a_tone} and {b_tone}")
        near_a = grey & (abs(r - a_tone) <= TOL)
        near_b = grey & (abs(r - b_tone) <= TOL)

        def touches(mask: np.ndarray) -> np.ndarray:
            out = np.zeros_like(mask)
            out[1:, :] |= mask[:-1, :]
            out[:-1, :] |= mask[1:, :]
            out[:, 1:] |= mask[:, :-1]
            out[:, :-1] |= mask[:, 1:]
            return out

        alternating = (near_a & touches(near_b)) | (near_b & touches(near_a))

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

    seen |= alternating

    # Whatever pattern is left is an ENCLOSED pocket, and the alternation test
    # only bit its edges — the middle of an 8px checker square has no neighbour
    # of the other tone. So label what remains and judge each island as a
    # whole: a checkerboard island holds BOTH tones in quantity, a pale piece
    # of the drawing holds one. Only the pockets are left by now, so this walks
    # a few percent of the canvas, not all of it.
    if b_tone is not None:
        near_a = grey & (abs(r - a_tone) <= TOL)
        near_b = grey & (abs(r - b_tone) <= TOL)
        todo = checker & ~seen
        visited = np.zeros((h, w), dtype=bool)
        ys, xs = np.nonzero(todo)
        for sy, sx in zip(ys, xs):
            if visited[sy, sx]:
                continue
            comp, stack = [], [(sy, sx)]
            visited[sy, sx] = True
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and todo[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            if len(comp) < 200:
                continue
            cy = np.array([p[0] for p in comp])
            cx = np.array([p[1] for p in comp])
            share_a = near_a[cy, cx].mean()
            share_b = near_b[cy, cx].mean()
            if share_a > 0.15 and share_b > 0.15:
                seen[cy, cx] = True
                print(f"  removed an enclosed pocket of {len(comp)} px "
                      f"({share_a:.0%} / {share_b:.0%} two-tone)")

    # One pass for the soft edge between the pattern and the drawing.
    fringe = grey & (r >= lo - FRINGE) & (r <= hi + FRINGE) & ~seen
    nb = np.zeros_like(seen)
    nb[1:, :] |= seen[:-1, :]
    nb[:-1, :] |= seen[1:, :]
    nb[:, 1:] |= seen[:, :-1]
    nb[:, :-1] |= seen[:, 1:]
    seen |= fringe & nb

    alpha = np.where(seen, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA").save(out)
    share = seen.mean()
    print(f"{out}: {share * 100:.1f}% of the canvas is now transparent")
    if share < 0.2:
        print("  …that looks low for a centred figure. Look at the file before shipping it.")
    return share


if __name__ == "__main__":
    unbake(sys.argv[1], sys.argv[2])
