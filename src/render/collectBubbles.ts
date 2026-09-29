// THE COLLECT BUBBLE — a parchment speech bubble over every building with
// something in its store, carrying the icon of what a tap would collect
// (Docs/features/03-economy.md §3.2, the mockup in Docs/art/mockups/).
//
// It is the UI tooltip's bubble living in the world: parchment, a thin brown
// rim, a tail pointing down at the roof, a soft shadow. It bobs so a city of
// full stores reads at a glance, pops in when a store first has something,
// and gives a small hop when a haul lands in it. A FULL store — the building
// has stopped — rims it in red.
//
// Drawn over the world (buildings, people, markers) and under the DOM UI,
// which the canvas always is. Presentation only: nothing here feeds the sim.
//
// This file is the clock-side state the presenter owns; the drawing is
// ./collectBubbleArt.ts, which needs the sprite atlas.

import { coordKey, type Coord } from '../sim/state';

const POP_MS = 220;
const HOP_MS = 260;

/** The clock-side half: when each bubble appeared, and when it last hopped. */
export class CollectBubbles {
  private shownSince = new Map<string, number>();
  private hopAt = new Map<string, number>();

  /** A haul landed in the building at `cell`. */
  bump(cell: Coord): void {
    this.hopAt.set(coordKey(cell), performance.now());
  }

  /** How far into its pop-in this bubble is, [0, 1]; stamps the first sight. */
  appear(id: string, now: number): number {
    const since = this.shownSince.get(id);
    if (since === undefined) {
      this.shownSince.set(id, now);
      return 0;
    }
    return Math.min(1, (now - since) / POP_MS);
  }

  /** The store emptied: the next bubble here pops in afresh. */
  forget(id: string): void {
    this.shownSince.delete(id);
  }

  /** The hop a fresh haul gives, [0, 1] and back to 0. */
  hop(cell: Coord, now: number): number {
    const at = this.hopAt.get(coordKey(cell));
    if (at === undefined) return 0;
    const t = (now - at) / HOP_MS;
    if (t >= 1) {
      this.hopAt.delete(coordKey(cell));
      return 0;
    }
    return Math.sin(t * Math.PI);
  }
}
