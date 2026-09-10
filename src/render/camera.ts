import type { Coord } from '../sim/state';
import { TILE_SIZE } from './palette';

export class Camera {
  x = 0; // world coords of the viewport center
  y = 0;
  zoom = 1;

  constructor(private canvas: HTMLCanvasElement) {}

  get dpr(): number {
    return window.devicePixelRatio || 1;
  }

  centerOnCell(cell: Coord): void {
    this.x = (cell.x + 0.5) * TILE_SIZE;
    this.y = (cell.y + 0.5) * TILE_SIZE;
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
    // World point of the footprint's centre.
    const wx = (cell.x + size.x / 2) * TILE_SIZE;
    const wy = (cell.y + size.y / 2) * TILE_SIZE;
    // cellToScreen: sy = (wy - this.y) * zoom + h / 2  →  solve for this.y.
    this.x = wx;
    this.y = wy - (bandMid - h / 2) / this.zoom;
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(2.5, Math.max(0.4, this.zoom * factor));
  }

  screenToCell(sx: number, sy: number): Coord {
    const c = this.screenToCellExact(sx, sy);
    return { x: Math.floor(c.x), y: Math.floor(c.y) };
  }

  /** The FRACTIONAL cell under a screen point. Zooming about the pointer needs
   *  the sub-cell position, which the floored form has already thrown away. */
  screenToCellExact(sx: number, sy: number): { x: number; y: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (this.x + (sx - w / 2) / this.zoom) / TILE_SIZE,
      y: (this.y + (sy - h / 2) / this.zoom) / TILE_SIZE,
    };
  }

  /** Is this cell inside the viewport (plus a cell of margin)? The strike
   *  feedback asks: a hit you cannot see should not make a sound. */
  isCellVisible(cell: Coord): boolean {
    const { x, y, size } = this.cellToScreen(cell);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return x > -size && y > -size && x < w + size && y < h + size;
  }

  cellToScreen(cell: Coord): { x: number; y: number; size: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (cell.x * TILE_SIZE - this.x) * this.zoom + w / 2,
      y: (cell.y * TILE_SIZE - this.y) * this.zoom + h / 2,
      size: TILE_SIZE * this.zoom,
    };
  }
}
