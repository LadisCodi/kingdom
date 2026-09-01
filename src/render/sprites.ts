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
