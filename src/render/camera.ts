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

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(2.5, Math.max(0.4, this.zoom * factor));
  }

  screenToCell(sx: number, sy: number): Coord {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const wx = this.x + (sx - w / 2) / this.zoom;
    const wy = this.y + (sy - h / 2) / this.zoom;
    return { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) };
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
