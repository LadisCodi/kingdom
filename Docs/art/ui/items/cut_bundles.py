# Cut Docs/art/ui/items/bundles-sheet.png (3×2, 512 px cells) into the store's
# bundle sprites, 256×256, the art ~232 px on its long side. Specks from a
# neighbouring cell (components under 2% of the largest) are dropped first,
# so they cannot widen the trim. Pure Python + Pillow.
from collections import deque
from PIL import Image

SHEET = 'Docs/art/ui/items/bundles-sheet.png'
NAMES = [('bundle_speed_s', 0, 0), ('bundle_speed_m', 1, 0), ('bundle_speed_l', 2, 0),
         ('bundle_res_s', 0, 1), ('bundle_res_m', 1, 1), ('bundle_builder', 2, 1)]

sheet = Image.open(SHEET).convert('RGBA')
for name, c, r in NAMES:
    cell = sheet.crop((c * 512, r * 512, c * 512 + 512, r * 512 + 512))
    w, h = cell.size
    alpha = cell.getchannel('A').load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if alpha[x, y] > 16 and not seen[y][x]:
                seen[y][x] = True
                q, px = deque([(x, y)]), []
                while q:
                    cx, cy = q.popleft()
                    px.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and alpha[nx, ny] > 16:
                                seen[ny][nx] = True
                                q.append((nx, ny))
                comps.append(px)
    biggest = max(len(p) for p in comps)
    pix = cell.load()
    for p in comps:
        if len(p) < 0.02 * biggest:
            for x, y in p:
                pix[x, y] = (0, 0, 0, 0)
    art = cell.crop(cell.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
    art.thumbnail((232, 232), Image.LANCZOS)
    out = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    out.paste(art, ((256 - art.width) // 2, (256 - art.height) // 2), art)
    out.save(f'src/render/assets/{name}.png')
