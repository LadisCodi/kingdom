"""Cut a 3x2 fragment sheet into six sprites, by silhouette.

Every opaque blob goes to the cell holding its centre, so a spark or a glow
leaning over a gutter goes home with its own fragment. Cells read left to
right, top to bottom: pieces 1-5, then the keystone (slot 5). Each fragment
is trimmed and centred on a square canvas at `FILL` of its side.

  python3 -I cut.py sheet.png out_dir prefix
  → out_dir/<prefix>0.png … <prefix>5.png
"""
import sys
from collections import deque
from PIL import Image

COLS, ROWS, SIZE, FILL, ALPHA, MIN_PX = 3, 2, 128, 0.9, 12, 24

src, out, prefix = sys.argv[1:]
im = Image.open(src).convert('RGBA')
w, h = im.size
a = im.getchannel('A').load()
seen = bytearray(w * h)
cells = [[] for _ in range(COLS * ROWS)]
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
        col = min(COLS - 1, int(cx * COLS / w))
        row = min(ROWS - 1, int(cy * ROWS / h))
        cells[row * COLS + col].append(blob)

for i, blobs in enumerate(cells):
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for b in blobs:
        for x, y in b:
            mp[x, y] = 255
    piece = Image.new('RGBA', im.size, (0, 0, 0, 0))
    piece.paste(im, (0, 0), mask)
    piece = piece.crop(piece.getbbox())
    side = max(piece.size)
    scale = SIZE * FILL / side
    piece = piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(piece, ((SIZE - piece.width) // 2, (SIZE - piece.height) // 2))
    canvas.save(f'{out}/{prefix}{i}.png', optimize=True)
    print(f'{prefix}{i}', len(blobs), 'blobs', piece.size)
