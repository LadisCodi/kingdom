// The character atlas, on the canvas: every animated person and animal on the
// map is a rect out of one bitmap, planted by its FEET.
//
// Companion to sprites.ts, which owns the per-tile building art. The two are
// separate because the frames here are tiny (≈12–20 px wide) and drawn at an
// integer multiple, whereas a building fills its cell at whatever the zoom is.
// Frame geometry — rects and feet anchors — comes from the generated index;
// this module only knows how to put a frame on the ground.

import atlasUrl from './characters/atlas.png?url';
import { CHARACTERS, CHAR_HEIGHT, type CharFrame } from './characters/atlas.generated';
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
 * HOW TALL A PERSON STANDS, as a fraction of a plot's ground diamond width.
 *
 * It is the yardstick the whole map is scaled against — a boar is about half
 * of it, a cottage four times it, a stand of trees three and a half
 * (Docs/art/features/props.json). 0.38 puts a villager a little under a
 * cottage's door, which is where the eye expects a person.
 */
export const UNIT_PLOTS = 0.38;

/**
 * How many screen pixels tall a person should be drawn, given `size` — one
 * cell's worth of pixels, which is half the diamond's width (Camera.unit).
 */
export const unitHeight = (size: number): number => size * 2 * UNIT_PLOTS;

/**
 * Draw one frame with its feet at (feetX, feetY), standing `targetH` screen
 * pixels tall, mirrored about the feet when `flip`.
 *
 * A HEIGHT and not a scale, because the pack is not one resolution: the
 * legacy sprites are 22 px people and the new ones are rendered at ten times
 * that. The scale comes from the character's own `CHAR_HEIGHT`, so both
 * stand the same height on the grass.
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
  targetH: number,
  flip = false,
): boolean {
  if (!atlas.ready) return false;
  const f = frameAt(character, anim, t);
  if (!f) return false;
  const [sx, sy, w, h, ax] = f;
  const nominal = CHAR_HEIGHT[character] ?? h;
  const scale = targetH / nominal;
  const dw = w * scale;
  const dh = h * scale;
  // Snap the feet to whole pixels so the integer scale actually lands on the
  // pixel grid; the anchor then places the body, not the bitmap.
  const fx = scale >= 1 ? Math.round(feetX) : feetX;
  const fy = scale >= 1 ? Math.round(feetY) : feetY;
  // Nearest neighbour only when a source pixel is being MAGNIFIED, which is
  // the legacy pack: a fractional magnification doubles some source pixels
  // and not others, and that is what makes pixel art shimmer as it walks.
  // The new art is always being scaled DOWN, where nearest neighbour is
  // simply aliasing.
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = scale < 1;
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
