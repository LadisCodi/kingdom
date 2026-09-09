// The character atlas, on the canvas: every animated person and animal on the
// map is a rect out of one bitmap, planted by its FEET.
//
// Companion to sprites.ts, which owns the per-tile building art. The two are
// separate because the frames here are tiny (≈12–20 px wide) and drawn at an
// integer multiple, whereas a building fills its cell at whatever the zoom is.
// Frame geometry — rects and feet anchors — comes from the generated index;
// this module only knows how to put a frame on the ground.

import atlasUrl from './characters/atlas.png?url';
import { CHARACTERS, type CharFrame } from './characters/atlas.generated';
import { FRAME_MS } from './cast';

const atlas = { img: new Image(), ready: false };
atlas.img.onload = () => { atlas.ready = true; };
atlas.img.src = atlasUrl;

/** The frame `anim` of `character` shows at time `t`, or null when the atlas
 *  has no such animation. Cadence is per animation (`FRAME_MS`). */
export function frameAt(character: string, anim: string, t: number): CharFrame | null {
  const frames = CHARACTERS[character]?.[anim];
  if (!frames || frames.length === 0) return null;
  const ms = FRAME_MS[anim] ?? 300;
  return frames[Math.floor(t / ms) % frames.length];
}

/**
 * Nearest-neighbour scale for a character standing on a cell `size` px wide.
 *
 * The pack's people are ≈22 px tall and the legacy worker stands 0.6 of a
 * cell, so 2× at zoom 1 (72 px cells) keeps the same silhouette on screen.
 * Whole numbers only: a fractional scale doubles some source pixels and not
 * others, which is what makes pixel art shimmer while it walks.
 */
export const unitScale = (size: number): number => Math.max(1, Math.round(size / 36));

/**
 * Draw one frame with its feet at (feetX, feetY), `scale` screen px per
 * source px, mirrored about the feet when `flip`.
 *
 * Returns false when the atlas has not loaded or the animation does not
 * exist — same contract as `drawSprite`, so the caller can fall through to
 * the legacy sprite chain and the emoji beneath it.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  character: string,
  anim: string,
  t: number,
  feetX: number,
  feetY: number,
  scale: number,
  flip = false,
): boolean {
  if (!atlas.ready) return false;
  const f = frameAt(character, anim, t);
  if (!f) return false;
  const [sx, sy, w, h, ax] = f;
  const dw = w * scale;
  const dh = h * scale;
  // Snap the feet to whole pixels so the integer scale actually lands on the
  // pixel grid; the anchor then places the body, not the bitmap.
  const fx = Math.round(feetX);
  const fy = Math.round(feetY);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.save();
    ctx.translate(fx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas.img, sx, sy, w, h, -ax * scale, fy - dh, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(atlas.img, sx, sy, w, h, fx - ax * scale, fy - dh, dw, dh);
  }
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}
