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
import { drawSprite, drawSpriteGlow, drawSpriteOutline, drawSpriteTint, spriteAspect, spriteInkTop } from './sprites';

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
export function diamondPath(ctx: CanvasPath, box: PlotBox, inset = 0): void {
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

/** The four sides of a cell, in the sim's compass, and the corners of the
 *  diamond each one runs between (clockwise from the top). */
const EDGE_CORNERS = {
  N: ['top', 'right', 'left'],
  E: ['right', 'bottom', 'top'],
  S: ['bottom', 'left', 'right'],
  W: ['left', 'top', 'bottom'],
} as const;

/**
 * DRAW A SQUARE PICTURE ONTO A PLOT'S DIAMOND.
 *
 * Ground art is authored as a plain SQUARE patch of material seen from
 * straight above — no silhouette, no transparency, no shape at all. This maps
 * that square onto the diamond corner to corner, which is simply what the
 * isometric camera does to a square of ground: the picture's own top-left
 * corner lands on the diamond's `side` corner, and the whole square covers
 * the whole diamond with nothing left over.
 *
 * Asking an image model to draw the diamond itself was the mistake this
 * replaces. A flat surface has no silhouette, so its outline is the one thing
 * the model has no reference for, and what came back was a rounded lozenge
 * whose chamfered corners are exactly where four tiles meet.
 *
 * `side` says which edge of the diamond the source's TOP edge lands on. The
 * ground uses 'N' and never thinks about it; a FRINGE is drawn with its own
 * side, which is how one authored piece serves all four without being
 * mirrored — the basis is rotated, not reflected.
 *
 * `bleed` grows the destination a hair so two neighbours overlap instead of
 * meeting on an anti-aliased edge, where each would contribute half and the
 * background would show through as a hairline.
 */
export function onDiamond(
  ctx: CanvasRenderingContext2D,
  box: PlotBox,
  side: 'N' | 'E' | 'S' | 'W',
  draw: () => void,
  bleed = 1.004,
): void {
  const c = corners({ ...box, w: box.w * bleed, h: box.h * bleed });
  const [p, q, r] = EDGE_CORNERS[side].map((k) => c[k]);
  ctx.save();
  // The unit square (u, v) goes to p + u·(q − p) + v·(r − p). A rhombus's
  // fourth corner is q + (r − p), so (1, 1) lands on it and the cover is
  // exact.
  ctx.transform(q[0] - p[0], q[1] - p[1], r[0] - p[0], r[1] - p[1], p[0], p[1]);
  draw();
  ctx.restore();
}

/**
 * DRAW THE GROUND OF ONE PLOT: its square of material, laid on the diamond.
 * Returns false when the art is missing, so the caller falls back to
 * `fillDiamond` in the terrain colour.
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  key: string,
  box: PlotBox,
): boolean {
  let drew = false;
  onDiamond(ctx, box, 'N', () => {
    drew = drawSprite(ctx, key, 0, 0, 1, 1);
  });
  return drew;
}

/**
 * HOW WIDE A FEATURE'S CANVAS IS, in plots.
 *
 * A building is drawn exactly to its plot, so its art is one plot across.
 * A feature is not: a stand of trees spreads half a tile past its own
 * ground and overlaps its neighbours, which is what makes a wood read as a
 * wood rather than as a row of separate tiles — and a boar covers a
 * fraction of a tile. Both have to fit the same canvas, so the canvas is
 * TWO plots wide and the thing sits somewhere inside it
 * (Docs/art/features/props.json says where).
 */
export const FEATURE_PLOTS = 2;

/**
 * The canvas width, in plots, of one feature's art. A crop plot was a
 * building before it was a feature, and its art is still a building's —
 * one plot across, its soil the plot's own diamond — so it is the exception.
 */
const ONE_PLOT_FEATURES: ReadonlySet<string> = new Set(['farmlands']);
export const featurePlots = (sprite: string): number =>
  ONE_PLOT_FEATURES.has(sprite) ? 1 : FEATURE_PLOTS;

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
 * `canvasPlots` says how many plots wide the AUTHORED CANVAS is, which is not
 * always one. A building is drawn exactly to its plot, so its canvas is the
 * plot and the default holds. A FEATURE is not: a stand of trees spreads
 * half a tile past its own ground and a boar covers a fraction of it, and a
 * canvas that is only one plot wide can express the boar but not the trees —
 * the drawing would have to be wider than the file. So features are authored
 * on a canvas TWO plots across, with the thing itself somewhere inside it,
 * and pass 2.
 *
 * `baseX`/`baseY` come from `Camera.plotBase`. Returns HOW TALL THE BUILDING
 * IS in screen px — the drawn ink, not the canvas, so a caller can hang a
 * label just clear of the roof — and zero when the art is missing or still
 * loading, which is the glyph fallback's cue.
 */
/** The outline round what `drawStanding` would draw with the same numbers —
 *  the placement ghost's rim (sprites.ts `drawSpriteOutline`). */
export function drawStandingOutline(
  ctx: CanvasRenderingContext2D,
  key: string,
  baseX: number,
  baseY: number,
  plotW: number,
  color: string,
  px: number,
): boolean {
  const aspect = spriteAspect(key);
  if (aspect === null) return false;
  const h = plotW * aspect;
  return drawSpriteOutline(ctx, key, baseX - plotW / 2, baseY - h, plotW, h, color, px);
}

/** A wash of `color` over what `drawStanding` would draw with the same
 *  numbers (sprites.ts `drawSpriteTint`). */
export function drawStandingTint(
  ctx: CanvasRenderingContext2D,
  key: string,
  baseX: number,
  baseY: number,
  plotW: number,
  color: string,
): boolean {
  const aspect = spriteAspect(key);
  if (aspect === null) return false;
  const h = plotW * aspect;
  return drawSpriteTint(ctx, key, baseX - plotW / 2, baseY - h, plotW, h, color);
}

/** A soft glow round what `drawStanding` would draw with the same numbers,
 *  `radius` screen px soft — the open card's pulse (sprites.ts
 *  `drawSpriteGlow`). */
export function drawStandingGlow(
  ctx: CanvasRenderingContext2D,
  key: string,
  baseX: number,
  baseY: number,
  plotW: number,
  radius: number,
  color: string,
): boolean {
  const aspect = spriteAspect(key);
  if (aspect === null) return false;
  const h = plotW * aspect;
  return drawSpriteGlow(ctx, key, baseX - plotW / 2, baseY - h, plotW, h, radius, color);
}

export function drawStanding(
  ctx: CanvasRenderingContext2D,
  key: string,
  baseX: number,
  baseY: number,
  plotW: number,
  canvasPlots = 1,
): number {
  const aspect = spriteAspect(key);
  if (aspect === null) return 0;
  plotW *= canvasPlots;
  const h = plotW * aspect;
  if (!drawSprite(ctx, key, baseX - plotW / 2, baseY - h, plotW, h)) return 0;
  // The INK's height, not the canvas's: the headroom above a short building
  // is sky, and a label hung on it would float there.
  return h * (1 - spriteInkTop(key));
}
