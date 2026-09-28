import { describe, expect, it } from 'vitest';
import { Camera } from '../src/render/camera';
import { FLAT_TILE, TILE_H, TILE_W } from '../src/render/palette';

const canvas = (w = 800, h = 600) =>
  ({ clientWidth: w, clientHeight: h }) as unknown as HTMLCanvasElement;

const iso = (w = 800, h = 600) => new Camera(canvas(w, h));
const flat = () => new Camera(canvas(), 'flat');

describe('the 2:1 isometric projection', () => {
  it('draws every cell as a diamond exactly twice as wide as it is tall', () => {
    const c = iso();
    for (const zoom of [0.4, 1, 1.7, 2.5]) {
      c.zoom = zoom;
      const box = c.cellToScreen({ x: 3, y: -2 });
      expect(box.w).toBeCloseTo(box.h * 2, 10);
      expect(box.w).toBeCloseTo(TILE_W * zoom, 10);
      expect(box.h).toBeCloseTo(TILE_H * zoom, 10);
    }
  });

  it('keeps a footprint 2:1 too — a plot is (w + h) half tiles each way', () => {
    const c = iso();
    for (const span of [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]) {
      const box = c.plotBox({ x: 0, y: 0 }, span);
      expect(box.w).toBeCloseTo((span.x + span.y) * (TILE_W / 2), 10);
      expect(box.h).toBeCloseTo((span.x + span.y) * (TILE_H / 2), 10);
      expect(box.w).toBeCloseTo(box.h * 2, 10);
    }
  });

  it('puts one step in +x to the right and one in +y to the left', () => {
    const c = iso();
    const o = c.cellToScreen({ x: 0, y: 0 });
    const east = c.cellToScreen({ x: 1, y: 0 });
    const south = c.cellToScreen({ x: 0, y: 1 });
    expect(east.x - o.x).toBeCloseTo(TILE_W / 2, 10);
    expect(east.y - o.y).toBeCloseTo(TILE_H / 2, 10);
    expect(south.x - o.x).toBeCloseTo(-TILE_W / 2, 10);
    expect(south.y - o.y).toBeCloseTo(TILE_H / 2, 10);
  });

  it('draws a larger x + y nearer the viewer — which is the painter order', () => {
    const c = iso();
    const depth = (x: number, y: number) => {
      const b = c.cellToScreen({ x, y });
      return b.y + b.h; // the diamond's bottom corner
    };
    expect(depth(0, 0)).toBeLessThan(depth(1, 0));
    expect(depth(1, 0)).toBeCloseTo(depth(0, 1), 10); // same diagonal, same depth
    expect(depth(0, 1)).toBeLessThan(depth(1, 1));
  });
});

describe('picking', () => {
  it('round-trips the centre of a cell back to that cell', () => {
    const c = iso();
    c.zoom = 1.3;
    c.centerOnCell({ x: 7, y: 4 });
    for (const cell of [
      { x: 0, y: 0 }, { x: 7, y: 4 }, { x: -3, y: 9 }, { x: 12, y: -6 }, { x: 5, y: 5 },
    ]) {
      const b = c.cellToScreen(cell);
      expect(c.screenToCell(b.x + b.w / 2, b.y + b.h / 2)).toEqual(cell);
    }
  });

  it('picks the cell the point is really in, not the one whose box it is in', () => {
    // The top-left of a cell's BOUNDING BOX is outside its diamond — it
    // belongs to the neighbour up and to the left. A square-grid inverse
    // would have answered with the cell itself.
    const c = iso();
    const b = c.cellToScreen({ x: 4, y: 4 });
    expect(c.screenToCell(b.x + 1, b.y + 1)).not.toEqual({ x: 4, y: 4 });
  });

  it('covers the whole viewport, which its two diagonal corners do not', () => {
    // In cell space the viewport is a DIAMOND, so the top-left and
    // bottom-right screen corners no longer bound it: the cells at the top
    // RIGHT of the screen are further back than either of them, and a
    // renderer walking only between those two would leave them undrawn.
    const c = iso(800, 600);
    const v = c.visibleCells(0);
    const tl = c.screenToCellExact(0, 0);
    const br = c.screenToCellExact(800, 600);
    expect(v.y0).toBeLessThan(Math.floor(tl.y));
    expect(v.y1).toBeGreaterThan(Math.ceil(br.y));
    for (const [sx, sy] of [[0, 0], [800, 0], [0, 600], [800, 600]] as const) {
      const cell = c.screenToCellExact(sx, sy);
      expect(cell.x).toBeGreaterThanOrEqual(v.x0);
      expect(cell.x).toBeLessThanOrEqual(v.x1);
      expect(cell.y).toBeGreaterThanOrEqual(v.y0);
      expect(cell.y).toBeLessThanOrEqual(v.y1);
    }
  });

  it('pins the world point under the pointer while zooming', () => {
    const c = iso();
    const before = c.screenToCellExact(210, 480);
    c.zoomAbout(210, 480, 1.4);
    const after = c.screenToCellExact(210, 480);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });
});

describe("the map editor's flat camera", () => {
  it('keeps square cells, because it paints data and not a world', () => {
    const c = flat();
    const box = c.cellToScreen({ x: 2, y: 5 });
    expect(box.w).toBe(FLAT_TILE);
    expect(box.h).toBe(FLAT_TILE);
  });

  it('lays a footprint out as a plain rectangle', () => {
    const box = flat().plotBox({ x: 0, y: 0 }, { x: 2, y: 1 });
    expect(box.w).toBe(2 * FLAT_TILE);
    expect(box.h).toBe(1 * FLAT_TILE);
  });

  it('round-trips a cell centre the same way the iso camera does', () => {
    const c = flat();
    const b = c.cellToScreen({ x: -4, y: 11 });
    expect(c.screenToCell(b.x + b.w / 2, b.y + b.h / 2)).toEqual({ x: -4, y: 11 });
  });
});
