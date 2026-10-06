# Cut the Novice Pack sheet (2x2, true alpha) and size the card illustration.
from PIL import Image
R='/home/ladis/Proyectos/Codigames/kingdom-art/'
N=R+'Docs/art/ui/offer-kit/novice/'
O=R+'src/ui/assets/'
def trim(im, thr=8):
    a=im.getchannel('A').point(lambda v:255 if v>thr else 0)
    return im.crop(a.getbbox())
def place(im, w, h=None, fill=0.92):
    s=min(w*fill/im.width, (h*fill/im.height) if h else 1e9)
    if h is None: h=round(im.height*s/fill)
    sp=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(w,h),(0,0,0,0)); c.paste(sp,((w-sp.width)//2,(h-sp.height)//2)); return c
sh=Image.open(N+'novice_sheet_raw.png').convert('RGBA'); W,H=sh.size; mx,my=W//2,H//2
q=lambda x0,y0,x1,y1: trim(sh.crop((x0,y0,x1,y1)))
place(q(0,0,mx,my),256,256).save(O+'offer-seal.png',optimize=True)
place(q(mx,0,W,my),256,256).save(O+'offer-gem-sack.png',optimize=True)
place(q(0,my,mx,H),256).save(O+'offer-gift-tag.png',optimize=True)
place(q(mx,my,W,H),256).save(O+'offer-chain-plate.png',optimize=True)
art=Image.open(N+'novice_art_raw.png').convert('RGB')
# 1586x992 is 1.599:1 — trim a pixel row/col to exact 16:10 before resizing
w,h=art.size; th=round(w/1.6)
if th<=h: art=art.crop((0,(h-th)//2,w,(h-th)//2+th))
art.resize((1280,800),Image.LANCZOS).save(R+'src/render/assets/offer_novice_art.png',optimize=True)
