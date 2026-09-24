#!/usr/bin/env python3
"""Normalise an isometric city master render onto the canvas its footprint asks for.

The successor to the pixel era's norm_sq.fish: same job — trim to content and
place it on a fixed canvas — but smooth-scaled, and anchored on the GROUND
DIAMOND's centre rather than on the image's centre (Docs/art/art-direction.md §3).

    python3 norm_iso.py master.png 2 2 out.png

Footprint w h in TILES. The ground diamond of a w x h plot is 128*w wide.
The master's leftmost and rightmost opaque pixels are taken to be that
diamond's left and right vertices, which is true when the building's own wall
or base traces the plot; pass --half-width to override.
"""
import argparse, subprocess, sys

TILE_W, TILE_H = 128, 64
HEADROOM = {(1, 1): 128, (2, 1): 128, (1, 2): 128, (2, 2): 192, (3, 3): 256}

def ground(fw, fh):
    """A w x h plot's ground diamond, in px. Always 2:1."""
    return TILE_W // 2 * (fw + fh), TILE_H // 2 * (fw + fh)

def alpha_extents(path):
    raw = subprocess.run(['magick', path, '-alpha', 'extract', '-depth', '8', 'pgm:-'],
                         capture_output=True, check=True).stdout
    i, f = 0, []
    while len(f) < 4:
        j = raw.index(b'\n', i); line = raw[i:j]; i = j + 1
        if not line.startswith(b'#'):
            f += line.split()
    w, h, px = int(f[1]), int(f[2]), raw[i:]
    op = lambda x, y: px[y * w + x] > 32
    cols = [x for x in range(w) if any(op(x, y) for y in range(h))]
    rows = [y for y in range(h) if any(op(x, y) for x in range(w))]
    L, R = cols[0], cols[-1]
    yL = [y for y in range(h) if op(L, y)]
    yR = [y for y in range(h) if op(R, y)]
    centre_y = (sum(yL) / len(yL) + sum(yR) / len(yR)) / 2
    return dict(w=w, h=h, L=L, R=R, T=rows[0], B=rows[-1],
                cx=(L + R) / 2, cy=centre_y)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('master'); ap.add_argument('fw', type=int); ap.add_argument('fh', type=int)
    ap.add_argument('out'); ap.add_argument('--half-width', type=float, default=None)
    a = ap.parse_args()

    e = alpha_extents(a.master)
    diamond_w, diamond_h = ground(a.fw, a.fh)
    canvas_w = diamond_w
    canvas_h = diamond_h + HEADROOM.get((a.fw, a.fh), 128)
    anchor = (canvas_w / 2, canvas_h - diamond_h / 2)

    src_half = a.half_width if a.half_width else (e['R'] - e['L']) / 2
    scale = (diamond_w / 2) / src_half
    ratio = src_half / (e['B'] - e['cy'])
    print(f"  master {e['w']}x{e['h']}  contenido {e['R']-e['L']}x{e['B']-e['T']}")
    print(f"  proyección medida  {ratio:.2f} : 1   (2.00 = isométrica 2:1)")
    if not 1.85 <= ratio <= 2.15:
        print(f"  AVISO: la proyección no es 2:1. Regenera antes de usar esto.", file=sys.stderr)
    print(f"  escala {scale:.4f}  ->  lienzo {canvas_w}x{canvas_h}, ancla {anchor}")

    nw, nh = e['w'] * scale, e['h'] * scale
    # dónde cae el centro del rombo tras escalar, y cuánto desplazarlo hasta el ancla
    off_x = anchor[0] - e['cx'] * scale
    off_y = anchor[1] - e['cy'] * scale
    # componer sobre un lienzo vacío: -extent invierte el signo del offset y
    # coloca por origen de recorte, que no es lo que queremos.
    subprocess.run(['magick', '-size', f'{canvas_w}x{canvas_h}', 'xc:none',
                    '(', a.master, '-filter', 'Lanczos', '-resize', f'{nw}x{nh}!', ')',
                    '-geometry', f'{off_x:+.0f}{off_y:+.0f}', '-composite', a.out], check=True)
    print(f"  escrito {a.out}")

if __name__ == '__main__':
    main()
