// Every image the game loads by hand, once per URL, and a count of how many
// are still on their way — which is what the loading screen waits on
// (ui/bootScreen.ts).
//
// An image counts as ready once it has DECODED, not merely arrived: on a
// phone the first draw of an undecoded bitmap decodes it on the spot and
// the frame stutters. The Image is kept, so the decoded bitmap stays warm.

export interface LoadedImage {
  img: HTMLImageElement;
  /** True once the image has loaded and decoded. A failed load never is. */
  ready: boolean;
  /** Settles when the image is ready or has failed — never rejects. */
  done: Promise<void>;
}

const images = new Map<string, LoadedImage>();
let settled = 0;

/** The image at `url`, requesting it the first time it is asked for. */
export function loadImage(url: string): LoadedImage {
  const known = images.get(url);
  if (known) return known;
  const img = new Image();
  const entry: LoadedImage = { img, ready: false, done: Promise.resolve() };
  entry.done = new Promise<void>((resolve) => {
    const finish = () => { settled += 1; resolve(); };
    img.onload = () => {
      // decode() is missing or refuses on some engines; a loaded image is
      // still drawable, it just decodes on first use.
      img.decode().catch(() => undefined).then(() => { entry.ready = true; finish(); });
    };
    img.onerror = finish;
  });
  img.src = url;
  images.set(url, entry);
  return entry;
}

/** How many images have been requested, and how many of them have settled. */
export const imageCounts = (): { requested: number; settled: number } =>
  ({ requested: images.size, settled });

/** Settles when every image requested so far has — later requests are not
 *  waited for; ask again. */
export const requestedImagesSettled = (): Promise<void> =>
  Promise.all([...images.values()].map((e) => e.done)).then(() => undefined);

/**
 * Request every URL in `urls`, at most `parallel` at a time, so a background
 * preload never crowds out an image the screen is waiting for.
 */
export async function preloadImages(urls: Iterable<string>, parallel = 4): Promise<void> {
  const queue = [...new Set(urls)].filter((u) => !images.has(u));
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) await loadImage(url).done;
  };
  await Promise.all(Array.from({ length: parallel }, worker));
}
