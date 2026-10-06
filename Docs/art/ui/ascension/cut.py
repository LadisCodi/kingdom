# Cut the ascension sheet (lit star left, empty socket right) into two square
# 256 px PNGs centred on the star's hub, so a CSS conic mask can reveal one
# petal per 60 degrees: python3 cut.py sheet.png out_dir
import sys
from PIL import Image

sheet = Image.open(sys.argv[1]).convert('RGBA')
w, h = sheet.size
for i, name in enumerate(['ascension-star-lit', 'ascension-star-empty']):
    half = sheet.crop((i * w // 2, 0, (i + 1) * w // 2, h))
    box = half.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    star = half.crop(box)
    side = int(max(star.size) * 1.04)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(star, ((side - star.width) // 2, (side - star.height) // 2))
    canvas.resize((256, 256), Image.LANCZOS).save(f'{sys.argv[2]}/{name}.png')
    print(name, star.size)
