// THE AREA AND THE REACH, drawn as UI laid OVER the view.
//
// A building's work area (mockup:
// Docs/art/mockups/area-overlays/area-simple-2-two-tone.png) is a white line
// with rounded corners and a light sky-blue glow inside it, strongest against
// the line and fading most of a tile in, breathing slowly. Blue, because a
// gold tint on the grass did not read. All of it is vector: no art.
//
// The Townhall's reach is a red-brown ink dash-and-dot, laid from two pieces
// cut by Docs/art/originals/area-overlays/cut_ink.py:
//
//   * overlay_reach_dash — one edge of the reach: its dash, dot centre to dot
//                          centre, so a run of edges repeats with no seam;
//   * overlay_reach_dot  — the dot on every vertex of the reach, which is
//                          what keeps the pattern whole around a corner.
//
// Both are assembled in SCREEN space — a line is laid flat along each edge
// of the diamonds, never squashed onto the ground the way terrain art is —
// and the renderer draws them after the floor and before anything that
// stands, so trees and buildings stand in front of them.

import type { PlotBox } from './camera';
import { corners as diamondCorners, edge } from './iso';
import { spriteImage } from './sprites';
import { coordKey, type Coord } from '../sim/state';

type Side = 'N' | 'E' | 'S' | 'W';
type Point = [number, number];

/** One edge of an area, in screen space, with the lattice corners it runs
 *  between (square-grid vertex keys, exact where floats are not). */
interface InkEdge {
  a: Point;
  b: Point;
  va: string;
  vb: string;
  /** N/S edges lie on one screen diagonal, E/W on the other: a vertex where
   *  both meet is a corner. */
  slope: 0 | 1;
  /** Stable per edge, so a stroke's slice does not shimmer as the view pans. */
  seed: number;
  /** Across the cell, from this edge to the opposite one: the ground's own
   *  diagonal, so a band laid along it stays on the tile. */
  across: Point;
}

/** A cell's side as the corners of the square lattice it runs between —
 *  the sim's N/E/S/W on the grid the diamonds are drawn from (iso.ts: the
 *  diamond's top is the cell's own corner (x, y)). */
const LATTICE: Record<Side, [[number, number], [number, number]]> = {
  N: [[0, 0], [1, 0]],
  E: [[1, 0], [1, 1]],
  S: [[1, 1], [0, 1]],
  W: [[0, 1], [0, 0]],
};

/** From each side to the opposite one, as the difference of two corners. */
const ACROSS: Record<Side, ['top' | 'right' | 'bottom' | 'left', 'top' | 'right' | 'bottom' | 'left']> = {
  N: ['left', 'top'], E: ['top', 'right'], S: ['right', 'bottom'], W: ['bottom', 'left'],
};

function inkEdge(cell: Coord, side: Side, box: PlotBox): InkEdge {
  const [a, b] = edge(box, side);
  const c = diamondCorners(box);
  const [to, from] = ACROSS[side];
  const across: Point = [c[to][0] - c[from][0], c[to][1] - c[from][1]];
  const [[ax, ay], [bx, by]] = LATTICE[side];
  const va = `${cell.x + ax},${cell.y + ay}`;
  const vb = `${cell.x + bx},${cell.y + by}`;
  const seed = Math.imul(cell.x * 73856093 ^ cell.y * 19349663, 2654435761)
    ^ (side.charCodeAt(0) * 83492791);
  return { a, b, va, vb, slope: side === 'N' || side === 'S' ? 0 : 1, seed: seed >>> 0, across };
}

/** Every edge of an area that faces a cell outside it. */
function areaEdges(
  cells: readonly Coord[], cellRect: (c: Coord) => PlotBox,
): InkEdge[] {
  const inside = new Set(cells.map(coordKey));
  const out: InkEdge[] = [];
  for (const cell of cells) {
    const box = cellRect(cell);
    if (!inside.has(coordKey({ x: cell.x, y: cell.y - 1 }))) out.push(inkEdge(cell, 'N', box));
    if (!inside.has(coordKey({ x: cell.x + 1, y: cell.y }))) out.push(inkEdge(cell, 'E', box));
    if (!inside.has(coordKey({ x: cell.x, y: cell.y + 1 }))) out.push(inkEdge(cell, 'S', box));
    if (!inside.has(coordKey({ x: cell.x - 1, y: cell.y }))) out.push(inkEdge(cell, 'W', box));
  }
  return out;
}

/** Every vertex the border passes through, once. */
function vertices(edges: readonly InkEdge[]): Point[] {
  const at = new Map<string, Point>();
  for (const e of edges) { at.set(e.va, e.a); at.set(e.vb, e.b); }
  return [...at.values()];
}

/** Lay `img` (or a slice of it, from `sx`, `sw` source pixels wide) flat
 *  along a→b, `height` tall and centred on the edge, `over` past each end. */
function lay(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  sx: number, sw: number, a: Point, b: Point, height: number, over: number,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(img, sx, 0, sw, img.naturalHeight, -over, -height / 2, len + over * 2, height);
  ctx.restore();
}

function stamp(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: Point, w: number): void {
  const h = w * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, p[0] - w / 2, p[1] - h / 2, w, h);
}

/**
 * THE GLOW: along every outside edge, a band laid across its own tile — a
 * parallelogram on the ground's diagonal, so a straight run of edges gives
 * one seamless band — shaded from the tint on the edge to nothing inside.
 * The gradient runs perpendicular to the edge ON SCREEN, which is what makes
 * it even along the edge. Where two bands meet at a corner they add up, and
 * the corner glows a little brighter.
 */
function glow(ctx: CanvasRenderingContext2D, edges: readonly InkEdge[], alpha: number): void {
  for (const e of edges) {
    const v: Point = [e.across[0] * GLOW_DEPTH, e.across[1] * GLOW_DEPTH];
    const dx = e.b[0] - e.a[0];
    const dy = e.b[1] - e.a[1];
    const len = Math.hypot(dx, dy) || 1;
    // The unit normal on screen, pointing inside, and how far in the band's
    // inner edge lies along it.
    let nx = -dy / len;
    let ny = dx / len;
    let depth = v[0] * nx + v[1] * ny;
    if (depth < 0) { nx = -nx; ny = -ny; depth = -depth; }
    const g = ctx.createLinearGradient(e.a[0], e.a[1], e.a[0] + nx * depth, e.a[1] + ny * depth);
    g.addColorStop(0, `rgba(${GLOW_RGB}, ${alpha.toFixed(3)})`);
    g.addColorStop(0.5, `rgba(${GLOW_RGB}, ${(alpha * 0.45).toFixed(3)})`);
    g.addColorStop(1, `rgba(${GLOW_RGB}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(...e.a);
    ctx.lineTo(...e.b);
    ctx.lineTo(e.b[0] + v[0], e.b[1] + v[1]);
    ctx.lineTo(e.a[0] + v[0], e.a[1] + v[1]);
    ctx.closePath();
    ctx.fill();
  }
}

/** How the overlays are sized: `unit` is a cell's worth of pixels. */
const LINE_PX = 0.05;    // the area's line, as a fraction of a cell
const ROUND_PX = 0.14;   // the radius a corner of the line is rounded to
const LINE = 'rgba(255, 255, 255, 0.9)';
/** The glow: sky blue, `GLOW_ALPHA` against the line and gone `GLOW_DEPTH`
 *  of a cell in, breathing between `BREATH_LOW` and full once a period. */
const GLOW_RGB = '125, 205, 255';
const GLOW_ALPHA = 0.7;
const GLOW_DEPTH = 0.9;
const BREATH_MS = 2600;
const BREATH_LOW = 0.45;
const DASH_PX = 0.07;    // the reach's dash, thickness as a fraction of a cell
const DOT_DASHES = 1.5;  // the reach's dot, across, in dash thicknesses

/** The border as closed loops. `areaEdges` walks every cell clockwise, so
 *  each edge ends where the next one along the border begins. */
function loops(edges: readonly InkEdge[]): InkEdge[][] {
  const from = new Map<string, InkEdge[]>();
  for (const e of edges) from.set(e.va, [...(from.get(e.va) ?? []), e]);
  const used = new Set<InkEdge>();
  const out: InkEdge[][] = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: InkEdge[] = [];
    let cur: InkEdge | undefined = start;
    while (cur && !used.has(cur)) {
      used.add(cur);
      loop.push(cur);
      cur = from.get(cur.vb)?.find((n) => !used.has(n));
    }
    out.push(loop);
  }
  return out;
}

const midpoint = (e: InkEdge): Point => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];

/** Trace the border with its corners rounded: from each edge's midpoint to
 *  the next, bending through the vertex between them. A straight run's
 *  vertex is on the line already, and arcTo draws it straight. */
function borderPath(ctx: CanvasRenderingContext2D, edges: readonly InkEdge[], r: number): void {
  ctx.beginPath();
  for (const loop of loops(edges)) {
    const closed = loop[loop.length - 1].vb === loop[0].va;
    if (!closed) {
      ctx.moveTo(...loop[0].a);
      for (const e of loop) ctx.lineTo(...e.b);
      continue;
    }
    ctx.moveTo(...midpoint(loop[0]));
    for (let i = 0; i < loop.length; i++) {
      const next = loop[(i + 1) % loop.length];
      ctx.arcTo(loop[i].b[0], loop[i].b[1], ...midpoint(next), r);
    }
    ctx.closePath();
  }
}

/** A building's work area (or any AREA the markers carry): the breathing
 *  glow inside its edge, then the two-tone line round it. `now` is the
 *  wall clock the breath runs on (performance.now(), never the sim's). */
export function drawArea(
  ctx: CanvasRenderingContext2D, cells: readonly Coord[],
  cellRect: (c: Coord) => PlotBox, diamondPath: (b: PlotBox) => void, unit: number, now: number,
): void {
  if (cells.length === 0) return;
  const edges = areaEdges(cells, cellRect);
  const breath = BREATH_LOW + (1 - BREATH_LOW)
    * (0.5 - 0.5 * Math.cos((2 * Math.PI * (now % BREATH_MS)) / BREATH_MS));

  ctx.save();
  ctx.beginPath();
  for (const cell of cells) diamondPath(cellRect(cell));
  ctx.clip();
  glow(ctx, edges, GLOW_ALPHA * breath);
  ctx.restore();

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  borderPath(ctx, edges, Math.max(2, unit * ROUND_PX));
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(2, unit * LINE_PX);
  ctx.stroke();
  ctx.restore();
}

/** The Townhall's reach: a dash along every edge of the border and a dot
 *  on every vertex of it, so the pattern runs unbroken round a turn. */
export function drawReachInk(
  ctx: CanvasRenderingContext2D, border: ReadonlyArray<{ cell: Coord; sides: readonly Side[] }>,
  cellRect: (c: Coord) => PlotBox, unit: number, fallback: string,
): void {
  if (border.length === 0) return;
  const edges: InkEdge[] = [];
  for (const { cell, sides } of border) {
    const box = cellRect(cell);
    for (const side of sides) edges.push(inkEdge(cell, side, box));
  }
  const dash = spriteImage('overlay_reach_dash');
  const dot = spriteImage('overlay_reach_dot');
  if (!dash || !dot) {
    ctx.save();
    ctx.strokeStyle = fallback;
    ctx.lineWidth = 2;
    ctx.setLineDash([Math.max(4, unit * 0.18), Math.max(3, unit * 0.12)]);
    ctx.beginPath();
    for (const e of edges) { ctx.moveTo(...e.a); ctx.lineTo(...e.b); }
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Sized by the cell, not by the edge: the dash fills its edge lengthwise
  // and keeps a fixed thickness (the sheet's dash is 20 of its 48 rows, its
  // dot 30 of its 50 columns).
  const thick = Math.max(2, unit * DASH_PX);
  for (const e of edges) lay(ctx, dash, 0, dash.naturalWidth, e.a, e.b, thick * (48 / 20), 0);
  const dotW = thick * DOT_DASHES * (50 / 30);
  for (const p of vertices(edges)) stamp(ctx, dot, p, dotW);
}
