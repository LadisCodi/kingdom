#!/usr/bin/env python3
"""Cut a 2x2 sheet of full figures (ranks II-V) into the game's 512x768 files.

    norm_body.py SHEET OUT_STEM        # writes OUT_STEM_e2.png … OUT_STEM_e5.png

Each quadrant is trimmed to its figure and fitted into 492x706 (the troops'
figure box: `resize x706`, feet 20px off the bottom), standing on the same
baseline and centred, so a rank drops into the panel exactly where rank I
stands (Docs/art/portraits/unit-blocks.md §2).
"""
import sys
from PIL import Image

sheet, stem = sys.argv[1], sys.argv[2]
W, H, BOX_W, BOX_H, FOOT = 512, 768, 492, 706, 20
img = Image.open(sheet).convert('RGBA')
qw, qh = img.width // 2, img.height // 2
for i, (c, r) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
    q = img.crop((c * qw, r * qh, (c + 1) * qw, (r + 1) * qh))
    box = q.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    fig = q.crop(box)
    s = min(BOX_W / fig.width, BOX_H / fig.height)
    fig = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(fig, ((W - fig.width) // 2, H - FOOT - fig.height), fig)
    path = f'{stem}_e{i + 2}.png'
    out.save(path, optimize=True)
    print(path)
