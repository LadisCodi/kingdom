// THE INK OVERLAYS: a building's work area and the Townhall's reach, drawn as
// a mapmaker's ink laid OVER the view (mockup:
// Docs/art/mockups/area-overlays/area-overlays-c2.png).
//
// They are UI, not ground, so they are assembled in SCREEN space: a stroke is
// laid flat along each edge of the area's diamonds, never squashed onto the
// ground the way terrain art is, and a dot stays round whatever the slope.
// The renderer draws them after the floor and before anything that stands,
// so trees and buildings stand in front of the line.
//
// Five pieces, cut from one ChatGPT sheet by
// Docs/art/originals/area-overlays/cut_ink.py:
//
//   * overlay_ink_line   — a long horizontal nib stroke; each edge takes a
//                          slice of it, so neighbouring edges are not copies;
//   * overlay_ink_knot   — a blot on every corner, where two strokes turn;
//   * overlay_parchment  — the wash over the area's tiles, tiled seamlessly;
//   * overlay_reach_dash — one edge of the reach: its dash, dot centre to dot
//                          centre, so a run of edges repeats with no seam;
//   * overlay_reach_dot  — the dot on every vertex of the reach, which is
//                          what keeps the pattern whole around a corner.
//
// Until the pieces have loaded, both fall back to plain vector lines.

import type { PlotBox } from './camera';
import { edge } from './iso';
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

function inkEdge(cell: Coord, side: Side, box: PlotBox): InkEdge {
  const [a, b] = edge(box, side);
  const [[ax, ay], [bx, by]] = LATTICE[side];
  const va = `${cell.x + ax},${cell.y + ay}`;
  const vb = `${cell.x + bx},${cell.y + by}`;
  const seed = Math.imul(cell.x * 73856093 ^ cell.y * 19349663, 2654435761)
    ^ (side.charCodeAt(0) * 83492791);
  return { a, b, va, vb, slope: side === 'N' || side === 'S' ? 0 : 1, seed: seed >>> 0 };
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

/** The vertices where the border TURNS — both slopes meet there. */
function corners(edges: readonly InkEdge[]): Point[] {
  const at = new Map<string, { p: Point; slopes: number }>();
  for (const e of edges) {
    for (const [k, p] of [[e.va, e.a], [e.vb, e.b]] as Array<[string, Point]>) {
      const v = at.get(k) ?? { p, slopes: 0 };
      v.slopes |= 1 << e.slope;
      at.set(k, v);
    }
  }
  return [...at.values()].filter((v) => v.slopes === 3).map((v) => v.p);
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

let parchment: { img: HTMLImageElement; pattern: CanvasPattern } | null = null;
function parchmentPattern(ctx: CanvasRenderingContext2D, img: HTMLImageElement): CanvasPattern | null {
  if (parchment?.img !== img) {
    const pattern = ctx.createPattern(img, 'repeat');
    if (!pattern) return null;
    parchment = { img, pattern };
  }
  return parchment.pattern;
}

/** How the overlays are sized: `unit` is a cell's worth of pixels. */
const LINE_PX = 0.055;   // the area's stroke, as a fraction of a cell
const KNOT_PX = 2.3;     // a corner's blot, in strokes
const WASH_ALPHA = 0.4;  // how much parchment the area's tiles take
const PARCHMENT_CELLS = 1.6; // one parchment tile spans this many cells

/** A building's work area (or any AREA the markers carry): the parchment
 *  wash over its tiles, the ink stroke round its edge, a knot on each turn. */
export function drawAreaInk(
  ctx: CanvasRenderingContext2D, cells: readonly Coord[],
  cellRect: (c: Coord) => PlotBox, diamondPath: (b: PlotBox) => void, unit: number,
  fallback: { fill: string; stroke: string },
): void {
  if (cells.length === 0) return;
  const edges = areaEdges(cells, cellRect);
  const line = spriteImage('overlay_ink_line');
  const knot = spriteImage('overlay_ink_knot');
  const wash = spriteImage('overlay_parchment');

  ctx.save();
  ctx.beginPath();
  for (const cell of cells) diamondPath(cellRect(cell));
  const pattern = wash ? parchmentPattern(ctx, wash) : null;
  if (pattern) {
    const k = (unit * PARCHMENT_CELLS) / wash!.naturalWidth;
    pattern.setTransform(new DOMMatrix().scale(k));
    ctx.globalAlpha = WASH_ALPHA;
    ctx.fillStyle = pattern;
  } else {
    ctx.fillStyle = fallback.fill;
  }
  ctx.fill();
  ctx.restore();

  const stroke = Math.max(2, unit * LINE_PX);
  if (!line || !knot) {
    ctx.save();
    ctx.strokeStyle = fallback.stroke;
    ctx.lineWidth = stroke;
    ctx.beginPath();
    for (const e of edges) { ctx.moveTo(...e.a); ctx.lineTo(...e.b); }
    ctx.stroke();
    ctx.restore();
    return;
  }
  // The strip carries a margin above and below its stroke (the sheet's
  // stroke is 22 of its 28 rows), so it is drawn that much taller.
  const height = stroke * (line.naturalHeight / 22);
  const scale = line.naturalHeight / height; // source pixels per screen pixel
  for (const e of edges) {
    const len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) + stroke;
    const sw = Math.min(line.naturalWidth, len * scale);
    const sx = (e.seed % 1000) / 1000 * (line.naturalWidth - sw);
    lay(ctx, line, sx, sw, e.a, e.b, height, stroke / 2);
  }
  for (const p of corners(edges)) stamp(ctx, knot, p, stroke * KNOT_PX);
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
  for (const e of edges) {
    const len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
    lay(ctx, dash, 0, dash.naturalWidth, e.a, e.b,
      len * (dash.naturalHeight / dash.naturalWidth), 0);
  }
  // The dot keeps the sheet's own proportion to its dash.
  const len = Math.hypot(edges[0].b[0] - edges[0].a[0], edges[0].b[1] - edges[0].a[1]);
  const dotW = len * (dot.naturalWidth / dash.naturalWidth);
  for (const p of vertices(edges)) stamp(ctx, dot, p, dotW);
}
