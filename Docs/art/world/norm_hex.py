#!/usr/bin/env python3
"""Cut one sprite out of a ChatGPT sheet and fit it to a world hex
(Docs/plans/world-hex-art.md §2).

    norm_hex.py SHEET.png PART OUT.png [--fill 0.9]

PART is `left`, `right`, or a quadrant `tl`/`tr`/`bl`/`br`. The cut is trimmed
to its opaque pixels, scaled so its width is FILL of a 512 px canvas (the hex's
width at 2x), and centred on that canvas with its lowest opaque row on the
canvas's bottom edge: the game stands the canvas's bottom on the hex's foot
line. Lanczos, never nearest-neighbour.
"""
import argparse
from PIL import Image

W = 512

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('part'); ap.add_argument('out')
    ap.add_argument('--fill', type=float, default=0.9)
    a = ap.parse_args()
    img = Image.open(a.sheet).convert('RGBA')
    w, h = img.size
    boxes = {
        'left': (0, 0, w // 2, h), 'right': (w // 2, 0, w, h),
        'tl': (0, 0, w // 2, h // 2), 'tr': (w // 2, 0, w, h // 2),
        'bl': (0, h // 2, w // 2, h), 'br': (w // 2, h // 2, w, h),
    }
    part = img.crop(boxes[a.part])
    # Ignore faint haze when trimming: only clearly opaque pixels count.
    mask = part.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise SystemExit('nothing opaque in that part')
    art = part.crop(bbox)
    scale = W * a.fill / art.width
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, art.height + 4), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((W - art.width) // 2, 2))
    canvas.save(a.out)
    print(f'{a.out}: {canvas.width}x{canvas.height}, art {art.width}x{art.height} (x{scale:.3f})')

if __name__ == '__main__':
    main()
