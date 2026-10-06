import sys
from collections import deque
from PIL import Image, ImageFilter
R='/home/ladis/Proyectos/Codigames/kingdom-art/'
SIZE, FILL, ALPHA = 256, 0.92, 24
def cut(src, cols, rows, names):
    im=Image.open(src).convert('RGBA'); w,h=im.size
    a=im.getchannel('A').load(); seen=bytearray(w*h); blobs=[]
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0*w+x0] or a[x0,y0]<=ALPHA: continue
            blob=[]; q=deque([(x0,y0)]); seen[y0*w+x0]=1
            while q:
                x,y=q.popleft(); blob.append((x,y))
                for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0<=nx<w and 0<=ny<h and not seen[ny*w+nx] and a[nx,ny]>ALPHA:
                        seen[ny*w+nx]=1; q.append((nx,ny))
            blobs.append(blob)
    big=max(len(b) for b in blobs); cells=[[] for _ in range(cols*rows)]
    def best(lo,hi,count):
        return min(range(lo,hi),key=count)
    ylines=[0]+[best(h*r//rows-60,h*r//rows+60,lambda y:sum(1 for x in range(w) if a[x,y]>ALPHA)) for r in range(1,rows)]+[h]
    xlines={}
    for r in range(rows):
        y0,y1=ylines[r],ylines[r+1]
        xlines[r]=[0]+[best(w*c//cols-60,w*c//cols+60,lambda x:sum(1 for y in range(y0,y1) if a[x,y]>ALPHA)) for c in range(1,cols)]+[w]
    def cellof(x,y):
        r=max(i for i in range(rows) if ylines[i]<=y)
        c=max(i for i in range(cols) if xlines[r][i]<=x)
        return r*cols+c
    for b in blobs:
        if len(b)<big*0.02: continue
        xs=[p[0] for p in b]; ys=[p[1] for p in b]
        if max(xs)-min(xs)>1.05*w/cols or max(ys)-min(ys)>1.05*h/rows:
            # two busts touching: split the blob by cell, pixel by pixel
            print('  split a merged blob in', src.split('/')[-1])
            parts={}
            for x,y in b: parts.setdefault(cellof(x,y),[]).append((x,y))
            big_part=max(len(v) for v in parts.values())
            for k,v in list(parts.items()):
                if len(v)<0.1*big_part:
                    nb=[j for j in (k-cols,k+cols,k-1,k+1) if j in parts and len(parts[j])>=0.1*big_part]
                    j=max(nb,key=lambda j:len(parts[j])); parts[j]=parts[j]+v; del parts[k]
                    print('  sliver of',len(v),'px from cell',k,'back to cell',j)
            for k,v in parts.items(): cells[k].append(v)
            continue
        cx=sum(xs)/len(b); cy=sum(ys)/len(b)
        cells[min(rows-1,int(cy*rows/h))*cols+min(cols-1,int(cx*cols/w))].append(b)
    for i,name in enumerate(names):
        pts=[p for b in cells[i] for p in b]
        mask=Image.new('L',im.size,0); mp=mask.load()
        for x,y in pts: mp[x,y]=255
        mask=mask.filter(ImageFilter.MaxFilter(5))
        piece=Image.new('RGBA',im.size,(0,0,0,0)); piece.paste(im,(0,0),mask)
        piece=piece.crop(piece.getbbox())
        s=SIZE*FILL/piece.width
        if piece.height*s>SIZE*0.97: s=SIZE*0.97/piece.height
        piece=piece.resize((round(piece.width*s),round(piece.height*s)),Image.LANCZOS)
        c=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0)); c.paste(piece,((SIZE-piece.width)//2,SIZE-piece.height))
        c.save(R+f'src/render/assets/{name}_avatar.png',optimize=True)
        print(name,len(cells[i]),'blobs',piece.size)
K=R+'Docs/art/ui/offer-kit/'
for sheet,cols,rows in [t for t in (('A',3,3),('B',3,3),('C',3,3),('D',3,2)) if t[0] in sys.argv[1:]]:
    names=open(K+f'refs/heroes-{sheet}.txt').read().split()
    cut(K+f'sheets/{sheet}.png',cols,rows,names)
