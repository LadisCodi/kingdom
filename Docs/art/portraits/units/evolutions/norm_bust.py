#!/usr/bin/env python3
"""Cut a sheet of cut-out busts into one file per bust, all framed alike.

    norm_bust.py SHEET COLS ROWS OUT_PREFIX [SIZE]

Cells are read left to right, top to bottom; an empty cell is skipped. Each
bust keeps the scale the sheet drew it at (the sheet already holds the face
size steady across ranks), and is placed on a SIZE x SIZE transparent canvas
with its flat bottom cut on the canvas's bottom edge and its shoulders
centred — so every unit's bust sits on any base the UI draws under it the
same way (Docs/art/portraits/unit-blocks.md §2).
"""
import sys
from PIL import Image

sheet, cols, rows, prefix = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
size = int(sys.argv[5]) if len(sys.argv) > 5 else 512
img = Image.open(sheet).convert('RGBA')
cw, ch = img.width // cols, img.height // rows
n = 0
for r in range(rows):
    for c in range(cols):
        cell = img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        alpha = cell.getchannel('A').point(lambda a: 255 if a > 40 else 0)
        box = alpha.getbbox()
        if box is None or (box[2] - box[0]) * (box[3] - box[1]) < cw * ch * 0.05:
            continue
        bust = cell.crop(box)
        # The shoulders' centre: the opaque span of the bottom rows.
        a = bust.getchannel('A')
        y = bust.height - 3
        xs = [x for x in range(bust.width) if a.getpixel((x, y)) > 40]
        mid = (xs[0] + xs[-1]) / 2 if xs else bust.width / 2
        scale = size / cw
        bust = bust.resize((max(1, round(bust.width * scale)), max(1, round(bust.height * scale))), Image.LANCZOS)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(bust, (round(size / 2 - mid * scale), size - bust.height), bust)
        n += 1
        out.save(f'{prefix}{n}.png', optimize=True)
        print(f'{prefix}{n}.png')
