"""Cut a 2x2 relic sheet into four 256 px sprites, by silhouette.

Every opaque blob is assigned to the quadrant holding its centre, so a glow
or a sparkle that leans over a midline still goes home with its own relic and
nothing of a neighbour comes along. Each relic is trimmed and centred on a
square canvas at `FILL` of its side.

  python3 -I cut.py sheet.png out_dir tl_name tr_name bl_name br_name
"""
import sys
from collections import deque
from PIL import Image

SIZE, FILL, ALPHA, MIN_PX = 256, 0.90, 12, 12

src, out, *names = sys.argv[1:]
im = Image.open(src).convert('RGBA')
w, h = im.size
a = im.getchannel('A').load()
seen = bytearray(w * h)
quads = [[] for _ in range(4)]
for y0 in range(h):
    for x0 in range(w):
        if seen[y0 * w + x0] or a[x0, y0] <= ALPHA:
            continue
        blob, q = [], deque([(x0, y0)])
        seen[y0 * w + x0] = 1
        while q:
            x, y = q.popleft()
            blob.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] > ALPHA:
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))
        if len(blob) < MIN_PX:
            continue
        cx = sum(p[0] for p in blob) / len(blob)
        cy = sum(p[1] for p in blob) / len(blob)
        quads[(cy >= h / 2) * 2 + (cx >= w / 2)].append(blob)

px = im.load()
for blobs, name in zip(quads, names):
    pts = [p for b in blobs for p in b]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    # Keep the faint fringe of the glow too: every pixel with any alpha
    # inside the blobs' box, plus a small margin, as long as it is closer to
    # this relic than to the midline's far side.
    x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    m = 6
    x0, y0 = max(0, x0 - m), max(0, y0 - m)
    x1, y1 = min(w, x1 + m), min(h, y1 + m)
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for x, y in pts:
        mp[x, y] = 255
    from PIL import ImageFilter
    mask = mask.filter(ImageFilter.MaxFilter(2 * m + 1))
    piece = Image.new('RGBA', im.size, (0, 0, 0, 0))
    piece.paste(im, (0, 0), mask)
    piece = piece.crop((x0, y0, x1, y1))
    piece = piece.crop(piece.getbbox())
    side = max(piece.size)
    scale = SIZE * FILL / side
    piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(piece, ((SIZE - piece.width) // 2, (SIZE - piece.height) // 2))
    canvas.save(f'{out}/{name}.png', optimize=True)
    print(name, len(blobs), 'blobs', piece.size)
