// The <img> pool behind every sprite the DOM shows. DOM-free at import time
// (nothing here runs until a render asks), so ui/kit/host.ts can import it
// under node — sprites.ts, which creates Images as it loads, cannot be.

// ------------------------------------------------------------ the img pool

/**
 * One `<img>` per sprite use, kept and handed back out.
 *
 * A screen host rebuilds its subtree on every notify (kit/host.ts), and an
 * `<img>` created fresh each time is a new element that has to decode before
 * its first paint — so a grid of portraits blinked once a second, worst on
 * iOS. A decoded image belongs to the ELEMENT, not the URL, so the fix is to
 * keep the element: `releaseSprites` returns every pooled `<img>` under the
 * subtree about to be thrown away, and the render that follows takes the
 * same nodes back out. Nothing re-decodes; the node just moves.
 *
 * Pooled elements carry `data-sprite` = their URL so release knows which
 * `<img>`s are ours. Two live uses of one URL are two nodes.
 */
const pool = new Map<string, HTMLImageElement[]>();

/** An `<img>` for an already-resolved sprite URL, from the pool when one is
 *  free. `className` is set every time: the same node may wear a different
 *  class in its next life. */
export function spriteImgAt(url: string, className = ''): HTMLImageElement {
  const free = pool.get(url);
  const img = free?.pop() ?? document.createElement('img');
  if (img.getAttribute('data-sprite') !== url) {
    img.src = url;
    img.alt = '';
    img.setAttribute('data-sprite', url);
  }
  img.className = className;
  return img;
}

/** Hand every pooled `<img>` under `root` back, before `root` is rebuilt. */
export function releaseSprites(root: ParentNode): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[data-sprite]')) {
    const url = img.getAttribute('data-sprite')!;
    const free = pool.get(url);
    if (free === undefined) pool.set(url, [img]);
    else if (!free.includes(img)) free.push(img);
  }
}

/** Test seam: how many free nodes the pool holds for a URL. */
export const pooledCount = (url: string): number => pool.get(url)?.length ?? 0;
