# Fit the regenerated (blue-gem) illustrations to the sizes the game uses.
#   python3 place.py   (from anywhere; paths are absolute to the repo)
import os
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..')) + '/'
M = R + 'Docs/art/ui/gems/illustrations/'

def trim(im, thr=8):
    a = im.getchannel('A').point(lambda v: 255 if v > thr else 0)
    return im.crop(a.getbbox())

def place(im, w, h, fill):
    s = min(w * fill / im.width, h * fill / im.height)
    sp = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    c.paste(sp, ((w - sp.width) // 2, (h - sp.height) // 2))
    return c

def alpha(name, out, w, h, fill):
    p = M + name
    if os.path.exists(p):
        place(trim(Image.open(p).convert('RGBA')), w, h, fill).save(R + out, optimize=True)
        print('wrote', out)

# The card: opaque, 16:10, 1280x800 (as Docs/art/ui/offer-kit/novice/cut.py).
p = M + 'novice_card.master.png'
if os.path.exists(p):
    art = Image.open(p).convert('RGB'); w, h = art.size; th = round(w / 1.6)
    if th <= h: art = art.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    art.resize((1280, 800), Image.LANCZOS).save(R + 'src/render/assets/offer_novice_art.png', optimize=True)
    print('wrote offer_novice_art.png')
alpha('first_purchase.master.png', 'src/render/assets/offer_first_purchase.png', 512, 512, 0.92)
alpha('novice_icon.master.png', 'src/render/assets/offer_novice_1.png', 512, 512, 0.92)
alpha('novice_cutout.master.png', 'src/render/assets/offer_novice_cutout.png', 923, 1024, 1.0)
alpha('survey_chest.master.png', 'src/ui/assets/survey-chest.png', 320, 320, 1.0)
