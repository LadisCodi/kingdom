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

/**
 * A building's art at a level, as the map draws it: the highest tier at or
 * below the level (`_l1`–`_l3`, `_l4`, `_l8`), then the bare sprite. A
 * plantable has no tiers: what it puts on the ground is its feature's art
 * (`plantsSprite`), so a card shows the field the player will see, never an
 * icon standing in for it.
 */
export function buildingArtUrl(sprite: string, level = 1, plantsSprite: string | null = null): string | null {
  if (plantsSprite !== null) return spriteUrl(plantsSprite);
  for (let l = Math.max(1, level); l >= 1; l--) {
    const url = spriteUrl(`${sprite}_l${l}`);
    if (url !== null) return url;
  }
  return spriteUrl(sprite);
}

/** The growth stage a planted feature draws at `progress` (0…1), or null
 *  when it has none (Docs/features/27-plantables.md §2). */
export const growthStage = (stem: string, progress: number): string | null =>
  pickGrowthStage(stem, progress, (key) => spriteUrl(key) !== null);

import { spriteImgAt } from './spritePool';
import { pickGrowthStage } from './growth';

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
 * Is sprite `key` INK at (u, v) — fractions of its width and height — or
 * transparent? For a tap on a drawing that is taller than the ground it
 * stands on: the hit is the picture's own pixels, not the box around it.
 * A 64-px-wide alpha mask, built once per sprite on first ask; false until
 * the image has loaded (or when it cannot be read, true: better a tap too
 * many on a site than one that falls through).
 */
const solidMasks = new Map<string, { w: number; h: number; alpha: Uint8Array } | null>();

export function spriteSolidAt(key: string, u: number, v: number): boolean {
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  let mask = solidMasks.get(key);
  if (mask === undefined) {
    const s = sprite(key);
    if (!s?.ready || s.img.naturalWidth === 0) return false; // ask again once it loads
    const w = Math.min(64, s.img.naturalWidth);
    const h = Math.max(1, Math.round((s.img.naturalHeight / s.img.naturalWidth) * w));
    try {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(s.img, 0, 0, w, h);
      const { data } = g.getImageData(0, 0, w, h);
      const alpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
      mask = { w, h, alpha };
    } catch {
      mask = null; // a tainted or unreadable canvas: the whole box is the hit
    }
    solidMasks.set(key, mask);
  }
  if (mask === null) return true;
  const x = Math.min(mask.w - 1, Math.floor(u * mask.w));
  const y = Math.min(mask.h - 1, Math.floor(v * mask.h));
  return mask.alpha[y * mask.w + x] > 32;
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
  const look = looks.get(ctx);
  ctx.drawImage((look && lookOf(key, s.img, look)) || s.img, x, y, w, h);
  return true;
}

/**
 * Draw sprite `key` as a THREE-SLICE across (x, y, w, h): its two ends, each
 * `capFraction` of its width, kept at their own shape and scaled to `h`, and
 * the middle stretched between them — so a plaque stays round-ended at any
 * width. Returns false when the image is not loaded.
 */
export function drawSpriteThreeSlice(
  ctx: CanvasRenderingContext2D,
  key: string,
  capFraction: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const s = sprite(key);
  if (!s?.ready) return false;
  const iw = s.img.naturalWidth;
  const ih = s.img.naturalHeight;
  const cap = iw * capFraction;
  const dcap = Math.min(w / 2, cap * (h / ih));
  ctx.drawImage(s.img, 0, 0, cap, ih, x, y, dcap, h);
  ctx.drawImage(s.img, cap, 0, iw - cap * 2, ih, x + dcap, y, w - dcap * 2, h);
  ctx.drawImage(s.img, iw - cap, 0, cap, ih, x + w - dcap, y, dcap, h);
  return true;
}

// ----------------------------------------------------------- baked looks
//
// `ctx.filter` re-filters every draw it is set for, every frame, and it is
// the dearest thing a frame can ask for: on the map it cost a fifth of the
// frame for ten draws. A look that only depends on the sprite is therefore
// baked ONCE, into a copy of it, and the copy is what is drawn.

/** What a sprite looks like through the fog: CSS `brightness() saturate()`. */
export interface SpriteLook {
  brightness: number;
  saturate: number;
}

/** The look each context is drawing sprites in, while one is set. */
const looks = new WeakMap<CanvasRenderingContext2D, SpriteLook>();

/** A baked copy is never wider than this: the largest art (a 3×3 mountain)
 *  is half again as wide, and a dimmed copy of it at full size is six
 *  megabytes for a thing seen through fog. */
const MAX_BAKE_W = 1024;

/**
 * Draw every sprite `draw` draws in `look` — what `ctx.filter =
 * 'brightness(b) saturate(s)'` did, from a copy baked once per sprite and
 * look. Glyph fallbacks are not dimmed; they are a placeholder for art.
 */
export function withSpriteLook(ctx: CanvasRenderingContext2D, look: SpriteLook, draw: () => void): void {
  const prev = looks.get(ctx);
  looks.set(ctx, look);
  try {
    draw();
  } finally {
    if (prev === undefined) looks.delete(ctx);
    else looks.set(ctx, prev);
  }
}

const baked = new Map<string, HTMLCanvasElement | null>();

/** A scratch copy of `img`, at most MAX_BAKE_W wide. */
function bakeCanvas(img: HTMLImageElement): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const scale = Math.min(1, MAX_BAKE_W / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return { c, g };
}

/**
 * The sprite in `look`, baked by hand rather than through `ctx.filter`, so
 * it comes out the same on an engine whose canvas has no filters: the CSS
 * saturate matrix, then the brightness multiply, in sRGB as the filter
 * functions are. Null when the pixels cannot be read.
 */
function lookOf(key: string, img: HTMLImageElement, look: SpriteLook): HTMLCanvasElement | null {
  const id = `${key}|${look.brightness}|${look.saturate}`;
  const known = baked.get(id);
  if (known !== undefined) return known;
  let out: HTMLCanvasElement | null = null;
  try {
    const { c, g } = bakeCanvas(img);
    const px = g.getImageData(0, 0, c.width, c.height);
    const d = px.data;
    const s = look.saturate;
    const b = look.brightness;
    const m = [
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
    ].map((v) => v * b);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const gr = d[i + 1];
      const bl = d[i + 2];
      d[i] = m[0] * r + m[1] * gr + m[2] * bl;
      d[i + 1] = m[3] * r + m[4] * gr + m[5] * bl;
      d[i + 2] = m[6] * r + m[7] * gr + m[8] * bl;
    }
    g.putImageData(px, 0, 0);
    out = c;
  } catch {
    out = null; // unreadable: drawn as it is
  }
  baked.set(id, out);
  return out;
}

/** A soft glow the shape of a sprite, and how far it spills past it. */
interface Glow { c: HTMLCanvasElement; pad: number }
const glows = new Map<string, Glow | null>();

/**
 * The sprite's shape in `color`, blurred by `radius` baked pixels — the
 * shadow half of CSS `drop-shadow(0 0 radius color)`. Made with the canvas
 * shadow, drawn far off the canvas so only its shadow lands, which every
 * engine has.
 */
function glowOf(key: string, img: HTMLImageElement, radius: number, color: string): Glow | null {
  const id = `${key}|${radius}|${color}`;
  const known = glows.get(id);
  if (known !== undefined) return known;
  const scale = Math.min(1, MAX_BAKE_W / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  // A blur of r is a Gaussian of deviation r / 2; three deviations is all of it.
  const pad = Math.ceil(radius * 1.5) + 1;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d')!;
  const off = c.width + w;
  g.shadowColor = color;
  g.shadowBlur = radius;
  g.shadowOffsetX = off;
  g.drawImage(img, pad - off, pad, w, h);
  const glow = { c, pad };
  glows.set(id, glow);
  return glow;
}

/**
 * A glow round sprite `key` filling (x, y, w, h), `radius` screen px soft —
 * drawn UNDER the sprite, at whatever `globalAlpha` the caller set. The
 * baked radius is rounded to a whole pixel of the copy, so a zoom does not
 * re-bake it. False while the art is missing or loading.
 */
export function drawSpriteGlow(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: string,
): boolean {
  const s = sprite(key);
  if (!s?.ready || s.img.naturalWidth === 0 || w <= 0) return false;
  const bakeW = Math.max(1, Math.round(s.img.naturalWidth * Math.min(1, MAX_BAKE_W / s.img.naturalWidth)));
  const k = w / bakeW; // screen px per baked px
  const glow = glowOf(key, s.img, Math.max(1, Math.round(radius / k)), color);
  if (!glow) return false;
  const pad = glow.pad * k;
  ctx.drawImage(glow.c, x - pad, y - pad, w + pad * 2, h + pad * 2);
  return true;
}

/** One solid-colour silhouette per sprite and colour, at the art's own size:
 *  the ghost's outline is drawn from it every frame. */
const silhouettes = new Map<string, HTMLCanvasElement>();

/** The sprite's silhouette in one colour, cached per sprite and colour. */
function silhouetteOf(key: string, color: string): HTMLCanvasElement | null {
  const s = sprite(key);
  if (!s?.ready) return null;
  const id = `${key}|${color}`;
  let sil = silhouettes.get(id);
  if (!sil) {
    sil = document.createElement('canvas');
    sil.width = s.img.naturalWidth;
    sil.height = s.img.naturalHeight;
    const c = sil.getContext('2d')!;
    c.drawImage(s.img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, sil.width, sil.height);
    silhouettes.set(id, sil);
  }
  return sil;
}

/**
 * An OUTLINE round sprite `key` filling (x, y, w, h): its silhouette in
 * `color`, stamped `px` pixels out in eight directions. Drawn UNDER the
 * sprite, so only the ring round its edge shows. False while the art is
 * missing or loading.
 */
export function drawSpriteOutline(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  px: number,
): boolean {
  const sil = silhouetteOf(key, color);
  if (!sil) return false;
  // The ring alone, on a scratch canvas: the eight stamps, then the
  // silhouette itself cut back out — so a TRANSLUCENT sprite drawn over it
  // shows the ground through its body, not a white fill.
  const scale = ctx.getTransform().a || 1;
  const pad = Math.ceil(px) + 1;
  const cw = Math.ceil((w + pad * 2) * scale);
  const ch = Math.ceil((h + pad * 2) * scale);
  if (cw <= 0 || ch <= 0) return true;
  ringCanvas ??= document.createElement('canvas');
  if (ringCanvas.width < cw || ringCanvas.height < ch) {
    ringCanvas.width = Math.max(ringCanvas.width, cw);
    ringCanvas.height = Math.max(ringCanvas.height, ch);
  }
  const r = ringCanvas.getContext('2d')!;
  r.setTransform(1, 0, 0, 1, 0, 0);
  r.clearRect(0, 0, cw, ch);
  r.setTransform(scale, 0, 0, scale, 0, 0);
  const d = px * Math.SQRT1_2;
  r.globalCompositeOperation = 'source-over';
  for (const [ox, oy] of [[px, 0], [-px, 0], [0, px], [0, -px], [d, d], [-d, d], [d, -d], [-d, -d]]) {
    r.drawImage(sil, pad + ox, pad + oy, w, h);
  }
  r.globalCompositeOperation = 'destination-out';
  r.drawImage(sil, pad, pad, w, h);
  r.globalCompositeOperation = 'source-over';
  ctx.drawImage(ringCanvas, 0, 0, cw, ch, x - pad, y - pad, cw / scale, ch / scale);
  return true;
}
let ringCanvas: HTMLCanvasElement | null = null;

/**
 * Sprite `key`'s silhouette in `color` filling (x, y, w, h), at whatever
 * `globalAlpha` the caller set — a wash laid OVER the sprite, as the red on
 * a ghost that may not stand where it is. False while the art is loading.
 */
export function drawSpriteTint(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): boolean {
  const sil = silhouetteOf(key, color);
  if (!sil) return false;
  ctx.drawImage(sil, x, y, w, h);
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
