"""Cut a sheet of hero fragments into 256 px sprites, by connected blob.

Neighbouring pieces can touch (a knob reaching into the next cell), so the
alpha mask is first eroded until it falls apart into one core per piece; the
`count` largest cores are the seeds, ordered by grid cell, and every opaque
pixel then joins the seed it reaches first through opaque pixels (a
multi-source flood fill). Specks no seed reaches are dropped. Each piece is
trimmed and centred on a 256 px transparent square at 90% of its longer side.

  python3 -I cut.py sheet.png cols rows out_dir name1 name2 ...
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

SIZE, FILL, ALPHA, ERODE = 256, 0.90, 24, 9

src, cols, rows, out, *names = sys.argv[1:]
cols, rows = int(cols), int(rows)
count = len(names)
im = Image.open(src).convert('RGBA')
w, h = im.size
alpha = im.getchannel('A')
solid = alpha.point(lambda v: 255 if v > ALPHA else 0)
s = solid.load()


def components(px):
    seen = bytearray(w * h)
    found = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or not px[x0, y0]:
                continue
            blob, q = [], deque([(x0, y0)])
            seen[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            found.append(blob)
    return found


def cell(b):
    cx = sum(p[0] for p in b) / len(b)
    cy = sum(p[1] for p in b) / len(b)
    return min(rows - 1, int(cy * rows / h)) * cols + min(cols - 1, int(cx * cols / w))
# Erode harder until the cores fall into one per cell.
for erode in range(ERODE, 80, 4):
    core = solid.filter(ImageFilter.MinFilter(2 * erode + 1))
    seeds = [b for b in components(core.load()) if len(b) > 2000]
    seeds = sorted(seeds, key=len, reverse=True)[:count]
    if len(seeds) == count and len({cell(b) for b in seeds}) == count:
        break
else:
    raise SystemExit('pieces never separate')
seeds.sort(key=cell)

owner = [-1] * (w * h)
q = deque()
for i, b in enumerate(seeds):
    for x, y in b:
        owner[y * w + x] = i
        q.append((x, y))
while q:
    x, y = q.popleft()
    o = owner[y * w + x]
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and owner[ny * w + nx] < 0 and s[nx, ny]:
            owner[ny * w + nx] = o
            q.append((nx, ny))

for i, name in enumerate(names):
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if owner[row + x] == i:
                mp[x, y] = 255
    # Plus a 2 px ring, so the faint anti-aliased fringe comes too — but
    # never a pixel that belongs to a neighbour.
    ring = mask.filter(ImageFilter.MaxFilter(5)).load()
    for y in range(h):
        row = y * w
        for x in range(w):
            if ring[x, y] and owner[row + x] in (-1, i):
                mp[x, y] = 255
    piece = Image.new('RGBA', im.size, (0, 0, 0, 0))
    piece.paste(im, (0, 0), mask)
    piece = piece.crop(piece.getbbox())
    scale = SIZE * FILL / max(piece.size)
    piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(piece, ((SIZE - piece.width) // 2, (SIZE - piece.height) // 2))
    canvas.save(f'{out}/{name}.png', optimize=True)
    print(name, 'cell', cell(seeds[i]), piece.size)
