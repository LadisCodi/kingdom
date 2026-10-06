from PIL import Image
R='/home/ladis/Proyectos/Codigames/kingdom-art/'
S=R+'Docs/art/ui/offer-kit/sheets/'
O=R+'src/ui/assets/'
def trim(im, thr=8):
    a=im.getchannel('A').point(lambda v:255 if v>thr else 0)
    return im.crop(a.getbbox())
k1=Image.open(S+'K1.png').convert('RGBA'); W,H=k1.size
rib=trim(k1.crop((0,0,W,620)))
plq=trim(k1.crop((0,620,1150,H)))
spk=trim(k1.crop((1150,620,W,H)),2)
def fitw(im,w): return im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
fitw(rib,1024).save(O+'offer-ribbon.png',optimize=True)
fitw(plq,512).save(O+'offer-plaque.png',optimize=True)
s=128*0.96/max(spk.size); sp=spk.resize((round(spk.width*s),round(spk.height*s)),Image.LANCZOS)
c=Image.new('RGBA',(128,128),(0,0,0,0)); c.paste(sp,((128-sp.width)//2,(128-sp.height)//2)); c.save(O+'sparkle.png',optimize=True)
k2=Image.open(S+'K2.png').convert('RGBA'); W,H=k2.size
fr=trim(k2.crop((0,0,850,H))); t=trim(k2.crop((850,0,1475,H))); g=trim(k2.crop((1475,0,W,H)))
print('raw sizes', rib.size, plq.size, spk.size, fr.size, t.size, g.size)
fr.resize((512,512),Image.LANCZOS).save(O+'offer-frame.png',optimize=True)
t.resize((256,256),Image.LANCZOS).save(O+'offer-tile.png',optimize=True)
g.resize((256,256),Image.LANCZOS).save(O+'offer-tile-gold.png',optimize=True)
