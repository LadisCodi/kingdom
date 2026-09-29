// Sprite store. Any PNG dropped into ./assets/ is picked up by filename
// stem via Vite's import.meta.glob — adding art needs no code changes.
// Until an image exists (and has finished loading) every call site falls
// back to its emoji glyph, so art can land one file at a time.
//
// A sprite is requested the first time something asks for it, not when this
// module loads: the first frame then fetches only what it shows, the loading
// screen waits for exactly that (ui/bootScreen.ts), and `preloadAllSprites`
// brings in the rest behind it.

import { loadImage, preloadImages, type LoadedImage } from './imageLoad';

const urls = import.meta.glob('./assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const spriteKeys = new Map<string, string>(); // key → url
for (const [path, url] of Object.entries(urls)) {
  spriteKeys.set(path.slice('./assets/'.length, -'.png'.length), url);
}

/** The sprite's image, requesting it on first use; undefined when there is
 *  no such art. */
function sprite(key: string): LoadedImage | undefined {
  const url = spriteKeys.get(key);
  return url === undefined ? undefined : loadImage(url);
}

/** Request every sprite not yet asked for, a few at a time. */
export const preloadAllSprites = (): Promise<void> => preloadImages(spriteKeys.values());

/** The URL Vite emitted for a sprite, for the DOM to use in an <img>.
 *  Null when there is no such art — the caller falls back to an icon. */
export const spriteUrl = (key: string): string | null =>
  urls[`./assets/${key}.png`] ?? null;

import { spriteImgAt } from './spritePool';

// The <img> pool lives in its own DOM-free-at-import module so the screen
// host (ui/kit/host.ts) can import it under node; this file creates Images
// the moment it loads.
export { releaseSprites, spriteImgAt } from './spritePool';

/** `spriteImgAt` by sprite name; null when there is no such art, so the
 *  caller can fall back to its icon the way it always has. */
export function spriteImg(key: string, className = ''): HTMLImageElement | null {
  const url = spriteUrl(key);
  return url === null ? null : spriteImgAt(url, className);
}

/**
 * The authored height of a sprite as a fraction of its width. Null when the
 * art is missing or has not loaded — which is also the signal not to draw.
 *
 * It is what makes a building's HEADROOM an art decision rather than a code
 * one: a piece standing on the ground is scaled to its plot's diamond width
 * and keeps this ratio above it, so a taller tier is a taller PNG and no
 * table anywhere needs editing (Docs/art/art-direction.md §3.1).
 */
export const spriteAspect = (key: string): number | null => {
  const s = sprite(key);
  if (!s?.ready || s.img.naturalWidth === 0) return null;
  return s.img.naturalHeight / s.img.naturalWidth;
};

/**
 * WHERE THE ROOF IS: how far down a sprite its first opaque row sits, as a
 * fraction of its height.
 *
 * Building art is authored on a canvas with HEADROOM above the plot — enough
 * sky for the tallest tier — and a short building does not use all of it
 * (Docs/art/art-direction.md §3.1). A label hung on the top of the canvas
 * therefore floats in empty air. Measured once per sprite and cached: the
 * scan is on a 64px-wide copy, so it costs a fraction of a millisecond and
 * never runs again.
 */
const inkTops = new Map<string, number>();

export function spriteInkTop(key: string): number {
  const cached = inkTops.get(key);
  if (cached !== undefined) return cached;
  const s = sprite(key);
  if (!s?.ready || s.img.naturalWidth === 0) return 0; // ask again once it loads
  const w = Math.min(64, s.img.naturalWidth);
  const h = Math.max(1, Math.round((s.img.naturalHeight / s.img.naturalWidth) * w));
  let top = 0;
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(s.img, 0, 0, w, h);
    const { data } = g.getImageData(0, 0, w, h);
    let row = 0;
    outer: for (; row < h; row++) {
      for (let x = 0; x < w; x++) if (data[(row * w + x) * 4 + 3] > 8) break outer;
    }
    top = row / h;
  } catch {
    top = 0; // a tainted or unreadable canvas: treat the whole image as ink
  }
  inkTops.set(key, top);
  return top;
}

/**
 * Draw sprite `key` filling (x, y, w, h). Returns false when the image is
 * missing or not yet loaded — the caller draws its glyph fallback instead.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const s = sprite(key);
  if (!s?.ready) return false;
  ctx.drawImage(s.img, x, y, w, h);
  return true;
}

// ---------------------------------------------------------------- UI atlas

// The UI icon atlas, on the CANVAS. The DOM has had these since the atlas
// landed (src/ui/kit/icon.ts); the map was still drawing emoji into strings,
// which is the one thing `CLAUDE.md` says never to do quietly — an emoji
// renders from the system face and is visibly not pixel art next to the
// world's own sprites.
//
// `atlas.generated.ts` is DOM-free by design (its own header says so, because
// tests import it under node), so reading it here costs nothing.
import atlasUrl from '../ui/assets/ui-atlas.png?url';
import { ATLAS_CELL, ATLAS_COLS, ICON_INDEX } from '../ui/kit/atlas.generated';

// Every screen draws from it, so it is requested as soon as this loads.
const atlas = loadImage(atlasUrl);

/** Below this draw size the atlas's small variants read better — the same
 *  call the DOM makes with `size: 'sm'`. */
const SMALL_ICON_PX = 22;

/**
 * Draw UI icon `name` into a `size`x`size` box at (x, y).
 *
 * Returns false when the atlas has no such cell or has not loaded — same
 * contract as `drawSprite`, so a caller can fall back to its glyph and art
 * can land one sheet at a time.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  size: number,
): boolean {
  if (!atlas.ready) return false;
  const key = size <= SMALL_ICON_PX && `${name}-sm` in ICON_INDEX ? `${name}-sm` : name;
  const index = (ICON_INDEX as Record<string, number>)[key];
  if (index === undefined) return false;
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  // Nearest-neighbour, or a 32px cell scaled to 16 turns to mush.
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas.img, col * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL,
    Math.round(x), Math.round(y), size, size,
  );
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}
