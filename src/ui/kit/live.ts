// The half of a screen that TICKS, kept apart from the half that does not.
//
// A screen built once (the district card, the header, the pills) still has
// a few lines that move every second — a countdown, a progress trough, a
// price that falls as the wait shortens. Rebuilding the whole screen for them
// is what made images blink and scroll jump; leaving them stale is not an
// option either. A live part is the middle: one node, one string that says
// what it shows, rebuilt only when that string moves — and the node it
// replaces hands its sprites back to the pool first, so a portrait inside a
// live part never re-decodes either.

import { releaseSprites } from '../../render/spritePool';

interface Part {
  node: HTMLElement;
  sig: string;
  sigOf: () => string;
  build: () => HTMLElement;
}

export class LiveParts {
  private readonly parts: Part[] = [];

  /** Build the node now and remember how to tell when it is stale. */
  add(sigOf: () => string, build: () => HTMLElement): HTMLElement {
    const node = build();
    this.parts.push({ node, sig: sigOf(), sigOf, build });
    return node;
  }

  /** Swap every part whose reading moved; touch nothing else. */
  refresh(): void {
    for (const p of this.parts) {
      const sig = p.sigOf();
      if (sig === p.sig) continue;
      p.sig = sig;
      const fresh = p.build();
      releaseSprites(p.node);
      p.node.replaceWith(fresh);
      p.node = fresh;
    }
  }
}
