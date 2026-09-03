// Sprite store. Any PNG dropped into ./assets/ is picked up by filename
// stem via Vite's import.meta.glob — adding art needs no code changes.
// Until an image exists (and has finished loading) every call site falls
// back to its emoji glyph, so art can land one file at a time.

const urls = import.meta.glob('./assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

interface Entry {
  img: HTMLImageElement;
  ready: boolean;
}

const sprites = new Map<string, Entry>();
for (const [path, url] of Object.entries(urls)) {
  const key = path.slice('./assets/'.length, -'.png'.length);
  const entry: Entry = { img: new Image(), ready: false };
  entry.img.onload = () => {
    entry.ready = true;
  };
  entry.img.src = url;
  sprites.set(key, entry);
}

/** The URL Vite emitted for a sprite, for the DOM to use in an <img>.
 *  Null when there is no such art — the caller falls back to an icon. */
export const spriteUrl = (key: string): string | null =>
  urls[`./assets/${key}.png`] ?? null;

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
  const s = sprites.get(key);
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

const atlas: Entry = { img: new Image(), ready: false };
atlas.img.onload = () => { atlas.ready = true; };
atlas.img.src = atlasUrl;

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
