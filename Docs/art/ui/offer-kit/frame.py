from PIL import Image
R='/home/ladis/Proyectos/Codigames/kingdom-art/'
S=R+'Docs/art/ui/offer-kit/sheets/'
O=R+'src/ui/assets/'
def trim(im, thr=8):
    a=im.getchannel('A').point(lambda v:255 if v>thr else 0)
    return im.crop(a.getbbox())
def square(im, size):
    # uniform scale to the shorter side, then splice the longer axis at its middle
    s=size/min(im.size); im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    w,h=im.size; out=Image.new('RGBA',(size,size),(0,0,0,0)); half=size//2
    if w>h:
        out.paste(im.crop((0,0,half,h)),(0,0)); out.paste(im.crop((w-(size-half),0,w,h)),(half,0))
    else:
        out.paste(im.crop((0,0,w,half)),(0,0)); out.paste(im.crop((0,h-(size-half),w,h)),(0,half))
    return out
k2=Image.open(S+'K2.png').convert('RGBA'); W,H=k2.size
fr=trim(k2.crop((0,0,850,H))); t=trim(k2.crop((850,0,1475,H))); g=trim(k2.crop((1475,0,W,H)))
square(fr,512).save(O+'offer-frame.png',optimize=True)
square(t,256).save(O+'offer-tile.png',optimize=True)
square(g,256).save(O+'offer-tile-gold.png',optimize=True)
# border thickness: from each edge, along the midlines, to the first parchment pixel
im=Image.open(O+'offer-frame.png').convert('RGBA'); p=im.load()
def parch(c): r,g,b,a=c; return a>200 and r>215 and g>185 and b>120
def run(pts):
    for i,(x,y) in enumerate(pts):
        if parch(p[x,y]): return i
res={}
for frac in (0.3,0.5,0.7):
    m=int(512*frac)
    res[frac]=(run([(x,m) for x in range(512)]), run([(511-x,m) for x in range(512)]), run([(m,y) for y in range(512)]), run([(m,511-y) for y in range(512)]))
print('L R T B', res)
