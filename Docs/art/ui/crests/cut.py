import sys
from PIL import Image
S, OUT = sys.argv[1], sys.argv[2]
W, H = 144, 160

def cells(img, cols, rows):
    cw, ch = img.width / cols, img.height / rows
    for r in range(rows):
        for c in range(cols):
            cell = img.crop((round(c*cw), round(r*ch), round((c+1)*cw), round((r+1)*ch)))
            # keep only solid-ish alpha for the bbox (drop faint haze)
            a = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0)
            yield cell.crop(a.getbbox())

# FIELDS: one common scale (the largest), so every field lands identically.
fields = list(cells(Image.open(f'{S}/crest-fields-sheet.png').convert('RGBA'), 4, 2))
names = ['gules', 'azure', 'vert', 'purpure', 'sable', 'tenne', 'celeste', 'murrey']
sw = max(f.width for f in fields); sh = max(f.height for f in fields)
k = min((W - 2) / sw, H / sh)
for n, f in zip(names, fields):
    g = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(g, ((W - g.width) // 2, H - g.height))
    canvas.save(f'{OUT}/field-{n}.png')
    print(n, f.size, g.size)

# CHARGES: each fits a box on the field's centre, a little above the shield's.
charges = list(cells(Image.open(f'{S}/crest-charges-sheet.png').convert('RGBA'), 4, 3))
ids = ['lion', 'fleur', 'tree', 'crown', 'tower', 'star', 'eagle', 'key', 'swords', 'dragon', 'stag', 'ship']
BW, BH, CX, CY = 88, 88, W / 2, 76
for n, c in zip(ids, charges):
    s = min(BW / c.width, BH / c.height)
    g = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(g, (round(CX - g.width / 2), round(CY - g.height / 2)))
    canvas.save(f'{OUT}/charge-{n}.png')
    print(n, c.size, g.size)
