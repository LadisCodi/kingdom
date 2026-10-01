import type { Coord } from '../sim/state';
import { TILE_H, TILE_W } from './palette';

/**
 * How cell coordinates reach the screen: a 2:1 isometric projection, every
 * cell a diamond twice as wide as it is tall, a building rising out of it.
 * The game and the map editor share it, so the editor shows the province
 * exactly as the player will see it.
 */

/** A plot's ground shape on screen: the bounding box of its diamond, which
 *  is all any caller needs to place art, outlines and labels. */
export interface PlotBox {
  x: number; // left edge of the bounding box
  y: number; // top edge
  w: number; // width
  h: number; // height
}

export class Camera {
  x = 0; // projected-plane coords of the viewport centre
  y = 0;
  zoom = 1;
  /** How far out the wheel may go. The game's phone frame never needs to see
   *  past a few rings; the map editor sets it lower to frame the whole
   *  province. */
  minZoom = 0.4;

  constructor(private canvas: HTMLCanvasElement) {}

  get dpr(): number {
    return window.devicePixelRatio || 1;
  }

  /** A cell's ground diamond on screen: `tileW` across, `tileH` down. */
  get tileW(): number {
    return TILE_W * this.zoom;
  }

  get tileH(): number {
    return TILE_H * this.zoom;
  }

  /**
   * ONE CELL'S WORTH OF PIXELS, for things that are sized rather than placed:
   * label sizes, bar lengths, how big a villager is drawn. It is deliberately
   * neither `tileW` nor `tileH` — a diamond is wide and flat, and a number
   * set in its full width would be twice the size of the same number on the
   * old square grid.
   */
  get unit(): number {
    return this.tileW / 2;
  }

  // ------------------------------------------------------------ projection

  /** A point in CELL space (fractional is fine) to the projected plane, at
   *  zoom 1 and before the camera is subtracted. */
  private project(cx: number, cy: number): { x: number; y: number } {
    // The 2:1 isometric pair: one step in +x goes right and down, one step in
    // +y goes left and down, each by half a tile.
    return { x: (cx - cy) * (TILE_W / 2), y: (cx + cy) * (TILE_H / 2) };
  }

  /** The inverse of `project`, back to fractional cell space. */
  private unproject(px: number, py: number): { x: number; y: number } {
    const u = px / TILE_W; // (cx - cy) / 2
    const v = py / TILE_H; // (cx + cy) / 2
    return { x: v + u, y: v - u };
  }

  /** Projected-plane point to screen px. */
  private toScreen(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.x) * this.zoom + this.canvas.clientWidth / 2,
      y: (py - this.y) * this.zoom + this.canvas.clientHeight / 2,
    };
  }

  // --------------------------------------------------------------- reading

  /**
   * The ground shape of a `span` plot anchored at `cell`, as a bounding box.
   *
   * Under `'iso'` a w×h plot's diamond is `(w + h)` half-tiles across and
   * `(w + h)` half-tiles down — ALWAYS 2:1, whatever the footprint. That is
   * the number every piece of building art is authored to
   * (Docs/art/art-direction.md §3.1).
   */
  plotBox(cell: Coord, span: { x: number; y: number } = { x: 1, y: 1 }): PlotBox {
    const mid = this.project(cell.x + span.x / 2, cell.y + span.y / 2);
    const centre = this.toScreen(mid.x, mid.y);
    const w = (span.x + span.y) * (TILE_W / 2) * this.zoom;
    const h = (span.x + span.y) * (TILE_H / 2) * this.zoom;
    return { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
  }

  /** The single cell at `cell`. `plotBox` with a 1×1 span. */
  cellToScreen(cell: Coord): PlotBox {
    return this.plotBox(cell);
  }

  /**
   * THE POINT A BUILDING STANDS ON: the bottom corner of its plot's ground
   * diamond, and how wide that diamond is. Art is drawn with its bottom edge
   * here and its own aspect above — which is what makes a building rise out
   * of its plot instead of leaning forward over it.
   */
  plotBase(cell: Coord, span: { x: number; y: number } = { x: 1, y: 1 }):
  { x: number; y: number; w: number } {
    const box = this.plotBox(cell, span);
    return { x: box.x + box.w / 2, y: box.y + box.h, w: box.w };
  }

  // -------------------------------------------------------------- movement

  /** Centre the view on a plot — a cell, or a building's whole footprint
   *  when `span` is given, so a 2×2 hall is centred on its middle rather
   *  than on its corner cell. */
  centerOnCell(cell: Coord, span: { x: number; y: number } = { x: 1, y: 1 }): void {
    const p = this.project(cell.x + span.x / 2, cell.y + span.y / 2);
    this.x = p.x;
    this.y = p.y;
  }

  /**
   * Centre a footprint in the band of the screen that is still MAP: between
   * `top` and `bottom` in screen px (the header's bottom edge and a card's
   * top edge). A card about a building used to slide up over the very thing
   * it described; the building now moves into the sky the card leaves.
   * `size` is the footprint in cells, anchored top-left at `cell`.
   */
  centerFootprintWithin(cell: Coord, size: { x: number; y: number }, top: number, bottom: number): void {
    const h = this.canvas.clientHeight;
    const bandMid = (Math.max(0, top) + Math.min(h, bottom)) / 2;
    const p = this.project(cell.x + size.x / 2, cell.y + size.y / 2);
    // toScreen: sy = (p.y - this.y) * zoom + h / 2  →  solve for this.y.
    this.x = p.x;
    this.y = p.y - (bandMid - h / 2) / this.zoom;
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(2.5, Math.max(this.minZoom, this.zoom * factor));
  }

  /** Zoom keeping the world point under (sx, sy) pinned to (sx, sy). Lives
   *  here because only the camera knows how a screen point becomes a world
   *  one, and that answer now depends on the projection. */
  zoomAbout(sx: number, sy: number, factor: number): void {
    const before = this.screenToPlane(sx, sy);
    this.zoomBy(factor);
    const after = this.screenToPlane(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  // --------------------------------------------------------------- picking

  screenToCell(sx: number, sy: number): Coord {
    const c = this.screenToCellExact(sx, sy);
    return { x: Math.floor(c.x), y: Math.floor(c.y) };
  }

  /** The FRACTIONAL cell under a screen point. Zooming about the pointer needs
   *  the sub-cell position, which the floored form has already thrown away. */
  screenToCellExact(sx: number, sy: number): { x: number; y: number } {
    const p = this.screenToPlane(sx, sy);
    return this.unproject(p.x, p.y);
  }

  private screenToPlane(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - this.canvas.clientWidth / 2) / this.zoom,
      y: this.y + (sy - this.canvas.clientHeight / 2) / this.zoom,
    };
  }

  /**
   * The cell-space box that covers the whole viewport, plus `margin` cells.
   *
   * Under `'iso'` the viewport's rectangle is a DIAMOND in cell space, so the
   * four screen corners are unprojected and the box is taken around them —
   * a renderer walking rows would otherwise miss the cells at the left and
   * right points of the screen.
   */
  visibleCells(margin = 1): { x0: number; y0: number; x1: number; y1: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const corners = [
      this.screenToCellExact(0, 0),
      this.screenToCellExact(w, 0),
      this.screenToCellExact(0, h),
      this.screenToCellExact(w, h),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    return {
      x0: Math.floor(Math.min(...xs)) - margin,
      y0: Math.floor(Math.min(...ys)) - margin,
      x1: Math.ceil(Math.max(...xs)) + margin,
      y1: Math.ceil(Math.max(...ys)) + margin,
    };
  }

  /** Is this cell inside the viewport (plus a cell of margin)? The strike
   *  feedback asks: a hit you cannot see should not make a sound. */
  isCellVisible(cell: Coord): boolean {
    const { x, y, w: bw, h: bh } = this.cellToScreen(cell);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return x > -bw * 2 && y > -bh * 2 && x < w + bw && y < h + bh;
  }
}
