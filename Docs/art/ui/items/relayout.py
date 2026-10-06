# Re-lay a generated icon sheet onto a roomy, even grid for `npm run art`.
#
#   python3 Docs/art/ui/items/relayout.py RAW.png ROWS COLS OUT.png
#
# A tight sheet (UI-I2's 7 columns) lets a hammer head or an anvil reach into
# the neighbouring cell, and an even-grid slice then cuts it off one icon and
# pastes it on the next. Here every connected blob goes to the cell its centre
# falls in, and each cell's blobs are centred on a 640 px cell of the output,
# so the slicer sees clean gutters. Blobs are found on SOLID pixels, since two
# 24h glows touch; the soft pixels round a blob (a glow) come along with it
# unless another blob owns them. Pure Python + Pillow (no scipy here).
import sys
from collections import deque
from PIL import Image

raw, rows, cols, out_path = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
CELL = 640
SOLID = 160
PAD = 14
img = Image.open(raw).convert('RGBA')
w, h = img.size
alpha = img.getchannel('A').load()
seen = bytearray(w * h)
owner = [-1] * (w * h)
cells: dict[tuple[int, int], list[tuple[int, int, int, int]]] = {}
masks = Image.new('L', (w, h), 0)
labels: list[list[tuple[int, int]]] = []

for y in range(h):
    for x in range(w):
        if alpha[x, y] > SOLID and not seen[y * w + x]:
            seen[y * w + x] = 1
            q, px = deque([(x, y)]), []
            while q:
                cx, cy = q.popleft()
                px.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and alpha[nx, ny] > SOLID:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
            for qx, qy in px:
                owner[qy * w + qx] = len(labels)
            labels.append(px)

biggest = max(len(p) for p in labels)
groups: dict[tuple[int, int], list[int]] = {}
for n, px in enumerate(labels):
    if len(px) < 0.002 * biggest:
        continue  # a speck
    xs = [p[0] for p in px]
    ys = [p[1] for p in px]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    key = (min(rows - 1, int(cy * rows / h)), min(cols - 1, int(cx * cols / w)))
    groups.setdefault(key, []).append(n)

out = Image.new('RGBA', (cols * CELL, rows * CELL), (0, 0, 0, 0))
src = img.load()
for (r, c), comps in sorted(groups.items()):
    pts = [p for n in comps for p in labels[n]]
    x0, y0 = max(0, min(p[0] for p in pts) - PAD), max(0, min(p[1] for p in pts) - PAD)
    x1, y1 = min(w, max(p[0] for p in pts) + 1 + PAD), min(h, max(p[1] for p in pts) + 1 + PAD)
    mine = set(comps)
    if x1 - x0 > CELL - 40 or y1 - y0 > CELL - 40:
        sys.exit(f'cell {r},{c} is {x1 - x0}x{y1 - y0}: two icons touch')
    art = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    ap = art.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            o = owner[y * w + x]
            if o in mine or (o == -1 and alpha[x, y] > 0):
                ap[x - x0, y - y0] = src[x, y]
    out.paste(art, (c * CELL + (CELL - art.width) // 2, r * CELL + (CELL - art.height) // 2), art)
    print(f'cell {r},{c}: {len(comps)} blob(s), {art.width}x{art.height}')
out.save(out_path)
