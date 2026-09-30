// THE AREA AND THE REACH, drawn as UI laid OVER the view.
//
// A building's work area (mockup:
// Docs/art/mockups/area-overlays/area-simple-2-two-tone.png) is a white line
// with rounded corners and a light sky-blue glow inside it, strongest against
// the line and fading most of a tile in, breathing slowly. Blue, because a
// gold tint on the grass did not read. All of it is vector: no art.
//
// The Townhall's reach (mockup:
// Docs/art/mockups/area-overlays/reach-simple-2-dots-shadow.png) is a line
// of white dots, each ringed in a thin dark outline, with a soft shadow on
// the far side only — the side past the limit.
//
// Both are drawn in SCREEN space — a dot stays round and a line even
// whatever the slope — and the renderer draws them after the floor and
// before anything that stands, so trees and buildings stand in front.

import type { PlotBox } from './camera';
import { corners as diamondCorners, edge } from './iso';
import { coordKey, type Coord } from '../sim/state';

type Side = 'N' | 'E' | 'S' | 'W';
type Point = [number, number];

/** One edge of an area, in screen space, with the lattice corners it runs
 *  between (square-grid vertex keys, exact where floats are not). */
interface BorderEdge {
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

function borderEdge(cell: Coord, side: Side, box: PlotBox): BorderEdge {
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
): BorderEdge[] {
  const inside = new Set(cells.map(coordKey));
  const out: BorderEdge[] = [];
  for (const cell of cells) {
    const box = cellRect(cell);
    if (!inside.has(coordKey({ x: cell.x, y: cell.y - 1 }))) out.push(borderEdge(cell, 'N', box));
    if (!inside.has(coordKey({ x: cell.x + 1, y: cell.y }))) out.push(borderEdge(cell, 'E', box));
    if (!inside.has(coordKey({ x: cell.x, y: cell.y + 1 }))) out.push(borderEdge(cell, 'S', box));
    if (!inside.has(coordKey({ x: cell.x - 1, y: cell.y }))) out.push(borderEdge(cell, 'W', box));
  }
  return out;
}

/** Every vertex the border passes through, once. */
function vertices(edges: readonly BorderEdge[]): Point[] {
  const at = new Map<string, Point>();
  for (const e of edges) { at.set(e.va, e.a); at.set(e.vb, e.b); }
  return [...at.values()];
}

/**
 * THE GLOW: along every outside edge, a band laid across its own tile — a
 * parallelogram on the ground's diagonal, so a straight run of edges gives
 * one seamless band — shaded from the tint on the edge to nothing inside.
 * The gradient runs perpendicular to the edge ON SCREEN, which is what makes
 * it even along the edge. Where two bands meet at a corner they add up, and
 * the corner glows a little brighter.
 */
function glow(ctx: CanvasRenderingContext2D, edges: readonly BorderEdge[], alpha: number): void {
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
const DOT_PX = 0.075;    // the reach's dot, across, as a fraction of a cell
const DOTS_PER_EDGE = 4; // one on the vertex, three between
const DOT_RING = 'rgba(30, 24, 16, 0.75)';
/** The shadow past the reach: this dark against the line, gone
 *  `SHADE_DEPTH` of a cell out. */
const SHADE_RGB = '8, 12, 18';
const SHADE_ALPHA = 0.4;
const SHADE_DEPTH = 0.34;

/** The border as closed loops. `areaEdges` walks every cell clockwise, so
 *  each edge ends where the next one along the border begins. */
function loops(edges: readonly BorderEdge[]): BorderEdge[][] {
  const from = new Map<string, BorderEdge[]>();
  for (const e of edges) from.set(e.va, [...(from.get(e.va) ?? []), e]);
  const used = new Set<BorderEdge>();
  const out: BorderEdge[][] = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: BorderEdge[] = [];
    let cur: BorderEdge | undefined = start;
    while (cur && !used.has(cur)) {
      used.add(cur);
      loop.push(cur);
      cur = from.get(cur.vb)?.find((n) => !used.has(n));
    }
    out.push(loop);
  }
  return out;
}

const midpoint = (e: BorderEdge): Point => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];

/** Trace the border with its corners rounded: from each edge's midpoint to
 *  the next, bending through the vertex between them. A straight run's
 *  vertex is on the line already, and arcTo draws it straight. */
function borderPath(ctx: CanvasRenderingContext2D, edges: readonly BorderEdge[], r: number): void {
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

/** The same line round an area, without the glow: where a building may go
 *  while it is being placed, drawn in the range's vocabulary so the two read
 *  as one kind of mark — the glow is what says "this is its range". */
export function drawAreaLine(
  ctx: CanvasRenderingContext2D, cells: readonly Coord[],
  cellRect: (c: Coord) => PlotBox, unit: number,
): void {
  if (cells.length === 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  borderPath(ctx, areaEdges(cells, cellRect), Math.max(2, unit * ROUND_PX));
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(2, unit * LINE_PX);
  ctx.stroke();
  ctx.restore();
}

/** The Townhall's reach: the shadow on the far side of every border edge,
 *  then a dot on every vertex and `DOTS_PER_EDGE - 1` between. */
export function drawReach(
  ctx: CanvasRenderingContext2D, border: ReadonlyArray<{ cell: Coord; sides: readonly Side[] }>,
  cellRect: (c: Coord) => PlotBox, unit: number,
): void {
  if (border.length === 0) return;
  const edges: BorderEdge[] = [];
  for (const { cell, sides } of border) {
    const box = cellRect(cell);
    for (const side of sides) edges.push(borderEdge(cell, side, box));
  }
  // The shadow is the glow turned outward: the cell on the border is inside
  // the reach, so its band is laid across the neighbour past the edge.
  ctx.save();
  for (const e of edges) {
    const v: Point = [-e.across[0] * SHADE_DEPTH, -e.across[1] * SHADE_DEPTH];
    const dx = e.b[0] - e.a[0];
    const dy = e.b[1] - e.a[1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    let depth = v[0] * nx + v[1] * ny;
    if (depth < 0) { nx = -nx; ny = -ny; depth = -depth; }
    const g = ctx.createLinearGradient(e.a[0], e.a[1], e.a[0] + nx * depth, e.a[1] + ny * depth);
    g.addColorStop(0, `rgba(${SHADE_RGB}, ${SHADE_ALPHA})`);
    g.addColorStop(1, `rgba(${SHADE_RGB}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(...e.a);
    ctx.lineTo(...e.b);
    ctx.lineTo(e.b[0] + v[0], e.b[1] + v[1]);
    ctx.lineTo(e.a[0] + v[0], e.a[1] + v[1]);
    ctx.closePath();
    ctx.fill();
  }

  const r = Math.max(1.5, (unit * DOT_PX) / 2);
  const dots: Point[] = vertices(edges);
  for (const e of edges) {
    for (let k = 1; k < DOTS_PER_EDGE; k++) {
      const t = k / DOTS_PER_EDGE;
      dots.push([e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t]);
    }
  }
  ctx.beginPath();
  for (const [x, y] of dots) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = DOT_RING;
  ctx.lineWidth = Math.max(1, r * 0.35);
  ctx.stroke();
  ctx.restore();
}
