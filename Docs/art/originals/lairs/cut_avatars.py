# Cut a 2x2 sheet of round medallion avatars into 256px files, sized by the
# RING, not by the ink: a spear or a wolf poking out of the medallion must not
# shrink the medallion (the game masks the portrait to a circle anyway).
#   python3 cut_avatars.py sheet.png out_tl.png out_tr.png out_bl.png out_br.png
#   python3 cut_avatars.py single.png out.png      (one medallion on the canvas)
import sys
from PIL import Image
sheet = Image.open(sys.argv[1]).convert('RGBA')
W, H = sheet.size
outs = sys.argv[2:6]
single = len(outs) == 1
for i, out in enumerate(outs):
    if single:
        q = sheet
    else:
        qx, qy = (i % 2) * W // 2, (i // 2) * H // 2
        q = sheet.crop((qx, qy, qx + W // 2, qy + H // 2))
    a = q.getchannel('A')
    w, h = q.size
    rows = [y for y in range(h) if any(a.getpixel((x, y)) > 128 for x in range(0, w, 2))]
    top, bot = rows[0], rows[-1]
    # The ring's widest row is its vertical middle; its span there, trimmed of
    # anything outside the ring, is the diameter. Use the rows just inside the
    # top of the ring, where nothing protrudes, to find the centre column.
    def span(y):
        xs = [x for x in range(w) if a.getpixel((x, y)) > 128]
        return (xs[0], xs[-1]) if xs else None
    d = bot - top
    y = top + d // 8
    s = span(y)
    cx = (s[0] + s[1]) / 2
    cy = top + d / 2
    half = d / 2 * 1.02
    box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
    img = q.crop(box).resize((256, 256), Image.LANCZOS)
    img.save(out)
    print(out, 'ring', d, 'centre', cx, cy)
