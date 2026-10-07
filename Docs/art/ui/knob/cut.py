"""Cut the knob sheet (sheet.png) into its pieces, by solid blob.

Each piece is the bounding box of a connected region of alpha > 160 (the
stray faint pixels round the sheet are dropped), padded by the soft edge,
then fitted, centred, onto a square canvas.

    python3 Docs/art/ui/knob/cut.py
"""
from collections import deque
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parents[3] / 'src' / 'ui' / 'assets'

# Reading order (rows, then left to right) → file and canvas size.
PIECES = [
    ('world-knob-city.png', 256),
    ('world-knob-home.png', 256),
    ('notice-bubble.png', 256),
    ('notice-badge-world.png', 96),
    ('notice-badge-city.png', 96),
]


def blobs(img: Image.Image) -> list[tuple[int, int, int, int]]:
    w, h = img.size
    a = img.getchannel('A').load()
    seen = bytearray(w * h)
    found = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if seen[y * w + x] or a[x, y] <= 160:
                continue
            q = deque([(x, y)])
            seen[y * w + x] = 1
            x0, y0, x1, y1, n = x, y, x, y, 0
            while q:
                cx, cy = q.popleft()
                n += 1
                x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] > 160:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            found.append((n, (x0, y0, x1, y1)))
    biggest = max(n for n, _ in found)
    boxes = [b for n, b in found if n > biggest * 0.02]
    # Rows by centre height, then left to right.
    return sorted(boxes, key=lambda b: (round((b[1] + b[3]) / 2 / 300), b[0]))


def main() -> None:
    sheet = Image.open(HERE / 'sheet.png').convert('RGBA')
    boxes = blobs(sheet)
    assert len(boxes) == len(PIECES), f'{len(boxes)} pieces on the sheet, expected {len(PIECES)}'
    for (name, size), (x0, y0, x1, y1) in zip(PIECES, boxes):
        pad = 6
        piece = sheet.crop((x0 - pad, y0 - pad, x1 + 1 + pad, y1 + 1 + pad))
        side = max(piece.size)
        square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        square.paste(piece, ((side - piece.width) // 2, (side - piece.height) // 2))
        square.resize((size, size), Image.LANCZOS).save(ASSETS / name)
        print(name, piece.size, '→', size)


if __name__ == '__main__':
    main()
