#!/usr/bin/env python3
"""Crop a consistent head-and-shoulders avatar out of a full-body master.

    python3 bust.py master.png out.png [side_fraction]

A troop is drawn at 48px in the squad slots, where a whole standing figure is
a smudge, so each one ships a bust beside its body
(Docs/art/portraits/unit-blocks.md §2).

The naive version — crop the top half, then fill a square — gives every unit a
DIFFERENT zoom, because the crop's aspect ratio follows the figure's: the
Warrior is narrow and came back tight on the face while the mounted Cavalry
came back wide. Four avatars at four zooms read as four mistakes in a row of
slots.

So the square is measured against the figure's HEIGHT, which is the one thing
the normalization already makes equal, and it is centred on the head rather
than on the image: for the Cavalry the head sits well left of centre, and
centring on the canvas would have cropped the rider out of his own portrait.
"""
import sys

import numpy as np
from PIL import Image

SIDE = 0.44        # of the figure's height — head, shoulders and a little chest
HEAD_BAND = 0.16   # the top slice of the figure used to find where the head is
TOP_MARGIN = 0.03  # of the side, so the crown is not flush against the edge


def bust(path: str, out: str, side_frac: float = SIDE) -> None:
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    if ys.size == 0:
        raise SystemExit("the master is empty")
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    height = bottom - top + 1

    # Where the head is: the horizontal centre of the figure's topmost band.
    band = int(top + HEAD_BAND * height)
    hx = xs[(ys >= top) & (ys <= band)]
    head_cx = int(hx.mean()) if hx.size else (left + right) // 2

    side = int(side_frac * height)
    y0 = int(top - TOP_MARGIN * side)
    x0 = head_cx - side // 2
    print(f"figure {right - left + 1}x{height} at ({left},{top})  head_cx={head_cx}  side={side}")

    # Pad rather than clamp: shifting the box would move the head off-centre,
    # and transparent margin costs nothing.
    pad = max(0, -x0, -y0, x0 + side - im.width, y0 + side - im.height) + 1
    if pad > 1:
        big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        big.paste(im, (pad, pad))
        im, x0, y0 = big, x0 + pad, y0 + pad

    im.crop((x0, y0, x0 + side, y0 + side)).resize((256, 256), Image.LANCZOS).save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    bust(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else SIDE)
