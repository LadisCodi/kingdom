// The world board's camera: a pan and a zoom over the flat hex plane
// (hexLayout.ts), between the two registers of Docs/features/19-world-map.md
// §1.2 — tactical (a hex ~130 px wide) and strategic (~45 px), and a little
// further out when that is what it takes to fit the whole board on a narrow
// screen.
//
// It answers the three calls `wireInput` makes (pan, zoom, zoom about a
// point), so the province's gestures drive it unchanged.

import type { Hex } from '../../sim/world/hex';
import { BOARD_RADIUS } from '../../sim/world/hex';
import { MAX_DPR } from '../camera';
import {
  BOARD_HALF_H, BOARD_HALF_W, HEX_R, HEX_W, STRATEGIC_W, hexToPlane, planeToHex,
} from './hexLayout';

/** What the camera needs of its canvas: its size on the page. */
export interface Viewport { clientWidth: number; clientHeight: number }

export class HexCamera {
  /** The plane point at the viewport's centre. */
  x = 0;
  y = 0;
  zoom = 1;

  constructor(private canvas: Viewport) {}

  /** The backing scale: the screen's, but never past the province's
   *  `MAX_DPR` — a 3× phone gains no detail, only 2.25 times the pixels. */
  get dpr(): number {
    return typeof window === 'undefined' ? 1 : Math.min(MAX_DPR, window.devicePixelRatio || 1);
  }

  /** As close as the board goes: the tactical register. */
  readonly maxZoom = 1;

  /** As far as it goes: the strategic register, or further if that is what
   *  it takes to see all eleven hexes across. */
  get minZoom(): number {
    const fit = this.canvas.clientWidth / ((2 * BOARD_RADIUS + 1.3) * HEX_W);
    return Math.max(0.1, Math.min(STRATEGIC_W / HEX_W, fit));
  }

  /** A hex's width on screen. */
  get hexWidth(): number {
    return HEX_W * this.zoom;
  }

  /** A hex's circumradius on screen. */
  get hexRadius(): number {
    return HEX_R * this.zoom;
  }

  hexToScreen(h: Hex): { x: number; y: number } {
    const p = hexToPlane(h);
    return {
      x: (p.x - this.x) * this.zoom + this.canvas.clientWidth / 2,
      y: (p.y - this.y) * this.zoom + this.canvas.clientHeight / 2,
    };
  }

  private screenToPlane(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.canvas.clientWidth / 2) / this.zoom + this.x,
      y: (sy - this.canvas.clientHeight / 2) / this.zoom + this.y,
    };
  }

  /** The hex under a screen point — on the board or not. */
  screenToHex(sx: number, sy: number): Hex {
    const p = this.screenToPlane(sx, sy);
    return planeToHex(p.x, p.y);
  }

  centerOnHex(h: Hex): void {
    this.fitPending = false;
    const p = hexToPlane(h);
    this.x = p.x;
    this.y = p.y;
    this.clamp();
  }

  /** A hex up close: the tactical register, centred on it. Needs no size
   *  from the canvas, so it holds for a board that is still hidden. */
  focusHex(h: Hex): void {
    this.zoom = this.maxZoom;
    this.centerOnHex(h);
  }

  /** A fit asked for while the canvas had no size yet (it is hidden until
   *  the scene switches), done on the first frame that has one. */
  private fitPending = false;

  /** The whole board, as far out as it goes. */
  fitBoard(): void {
    if (this.canvas.clientWidth === 0) {
      this.fitPending = true;
      return;
    }
    this.fitPending = false;
    this.zoom = this.minZoom;
    this.x = 0;
    this.y = 0;
  }

  /** Once a frame, before drawing: finish a pending fit, and keep the zoom
   *  inside its range if the screen changed size. */
  settle(): void {
    if (this.fitPending) this.fitBoard();
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom));
  }

  panByScreen(dx: number, dy: number): void {
    this.fitPending = false; // the player's gesture wins over a fit still waiting
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clamp();
  }

  zoomBy(factor: number): void {
    this.fitPending = false;
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    this.clamp();
  }

  zoomAbout(sx: number, sy: number, factor: number): void {
    const before = this.screenToPlane(sx, sy);
    this.zoomBy(factor);
    const after = this.screenToPlane(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  /** The centre never leaves the board. */
  private clamp(): void {
    this.x = Math.max(-BOARD_HALF_W, Math.min(BOARD_HALF_W, this.x));
    this.y = Math.max(-BOARD_HALF_H, Math.min(BOARD_HALF_H, this.y));
  }
}
