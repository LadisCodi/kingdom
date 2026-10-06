# Cut the gem sheet (lit left, empty socket right) into two square 256 px
# PNGs with the gem's HUB at the centre, for a 72-degree conic mask. A
# pentagon with a vertex up has its centre 1/(1+cos 36°) ≈ 55% down its box,
# not halfway: python3 cut_gem.py gem-sheet.png out_dir
import math
import sys
from PIL import Image

HUB = 1 / (1 + math.cos(math.radians(36)))
sheet = Image.open(sys.argv[1]).convert('RGBA')
w, h = sheet.size
for i, name in enumerate(['ascension-gem-lit', 'ascension-gem-empty']):
    half = sheet.crop((i * w // 2, 0, (i + 1) * w // 2, h))
    box = half.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    gem = half.crop(box)
    hub_y = gem.height * HUB
    reach = max(gem.width / 2, hub_y, gem.height - hub_y)
    side = int(2 * reach * 1.04)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(gem, (round(side / 2 - gem.width / 2), round(side / 2 - hub_y)))
    canvas.resize((256, 256), Image.LANCZOS).save(f'{sys.argv[2]}/{name}.png')
    print(name, gem.size)
