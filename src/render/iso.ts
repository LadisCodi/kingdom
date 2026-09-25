// The four shapes an isometric world is drawn out of.
//
// Everything on the ground is a DIAMOND — a terrain tile, a fog scrim, a
// placement outline, the wash under a spell — and everything that stands on
// the ground is a picture whose bottom edge sits on that diamond's bottom
// corner. Those two rules are the whole projection at the drawing end; the
// maths that gets from a cell to a diamond is `Camera` (src/render/camera.ts).
//
// Every helper here takes a plot's BOUNDING BOX (`PlotBox`), because that is
// what the camera returns and because an inset or a label is easier to
// express against a box than against four corners.

import type { PlotBox } from './camera';
import { drawSprite, spriteAspect, spriteInkTop } from './sprites';

/** The four corners of a plot's ground diamond, clockwise from the top. */
export interface Corners {
  top: [number, number];
  right: [number, number];
  bottom: [number, number];
  left: [number, number];
}

export function corners(box: PlotBox, inset = 0): Corners {
  // An inset shrinks the diamond about its centre. Scaling both axes by the
  // same fraction keeps it 2:1, which a constant pixel inset would not.
  const k = box.w === 0 ? 0 : 1 - (inset * 2) / box.w;
  const hw = (box.w / 2) * k;
  const hh = (box.h / 2) * k;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    top: [cx, cy - hh],
    right: [cx + hw, cy],
    bottom: [cx, cy + hh],
    left: [cx - hw, cy],
  };
}

/** Trace a plot's diamond into the current path. Does not begin or close it,
 *  so a caller can batch many cells into one fill. */
export function diamondPath(ctx: CanvasRenderingContext2D, box: PlotBox, inset = 0): void {
  const c = corners(box, inset);
  ctx.moveTo(...c.top);
  ctx.lineTo(...c.right);
  ctx.lineTo(...c.bottom);
  ctx.lineTo(...c.left);
  ctx.closePath();
}

export function fillDiamond(ctx: CanvasRenderingContext2D, box: PlotBox, inset = 0): void {
  ctx.beginPath();
  diamondPath(ctx, box, inset);
  ctx.fill();
}

export function strokeDiamond(ctx: CanvasRenderingContext2D, box: PlotBox, inset = 0): void {
  ctx.beginPath();
  diamondPath(ctx, box, inset);
  ctx.stroke();
}

/**
 * WHICH SCREEN EDGE OF A DIAMOND IS WHICH COMPASS SIDE OF A CELL.
 *
 * A border that traces the outside of an area — the Townhall's reach, a
 * spell's footprint, a working area — asks the sim which of a cell's four
 * neighbours is outside, and the sim answers in N/S/E/W on a square grid.
 * Rotating that answer onto the diamond is this table and nothing else:
 * the cell's north edge runs from its TOP corner to its RIGHT corner, and
 * round from there.
 */
export function edge(box: PlotBox, side: 'N' | 'E' | 'S' | 'W'):
[[number, number], [number, number]] {
  const c = corners(box);
  if (side === 'N') return [c.top, c.right];
  if (side === 'E') return [c.right, c.bottom];
  if (side === 'S') return [c.bottom, c.left];
  return [c.left, c.top];
}

/** Add one cell edge to the current path. */
export function edgePath(
  ctx: CanvasRenderingContext2D,
  box: PlotBox,
  side: 'N' | 'E' | 'S' | 'W',
): void {
  const [a, b] = edge(box, side);
  ctx.moveTo(...a);
  ctx.lineTo(...b);
}

/**
 * DRAW THE GROUND OF ONE PLOT.
 *
 * The art fills the plot's bounding box and is then CLIPPED to the diamond,
 * so a tile can never bleed into its neighbours whatever shape the artist
 * drew — a square top-down texture lands as a proper isometric tile, and a
 * diamond-shaped one is left exactly as it is. Returns false when the art is
 * missing, so the caller falls back to `fillDiamond` in the terrain colour.
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  key: string,
  box: PlotBox,
): boolean {
  ctx.save();
  ctx.beginPath();
  diamondPath(ctx, box);
  ctx.clip();
  // Drawn one pixel PROUD of the diamond on every side, then clipped back to
  // it. Art arrives with a soft anti-aliased rim, and a soft rim landing
  // exactly on the edge leaves a hairline of background showing between two
  // tiles that are meant to be one field. Overdrawing puts the rim outside
  // the clip, so what ends the tile is the clip — and two neighbours share
  // that edge exactly.
  const bleed = 1;
  const drew = drawSprite(
    ctx, key,
    box.x - bleed, box.y - bleed / 2, box.w + bleed * 2, box.h + bleed,
  );
  ctx.restore();
  return drew;
}

/**
 * DRAW A THING THAT STANDS ON THE GROUND.
 *
 * Building art is authored exactly as wide as its plot's ground diamond, with
 * the building's base on the image's bottom edge and clear sky above it
 * (Docs/art/art-direction.md §3.1). So the rule is: scale the image to the
 * diamond's width, and put its bottom edge on the diamond's BOTTOM CORNER.
 * Whatever headroom the artist left rises into the sky, and a taller building
 * is taller art rather than a different anchor.
 *
 * `baseX`/`baseY` come from `Camera.plotBase`. Returns HOW TALL THE BUILDING
 * IS in screen px — the drawn ink, not the canvas, so a caller can hang a
 * label just clear of the roof — and zero when the art is missing or still
 * loading, which is the glyph fallback's cue.
 */
export function drawStanding(
  ctx: CanvasRenderingContext2D,
  key: string,
  baseX: number,
  baseY: number,
  plotW: number,
): number {
  const aspect = spriteAspect(key);
  if (aspect === null) return 0;
  const h = plotW * aspect;
  if (!drawSprite(ctx, key, baseX - plotW / 2, baseY - h, plotW, h)) return 0;
  // The INK's height, not the canvas's: the headroom above a short building
  // is sky, and a label hung on it would float there.
  return h * (1 - spriteInkTop(key));
}
