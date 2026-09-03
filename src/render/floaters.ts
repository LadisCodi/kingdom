// Floating world-space feedback texts ("+N", reveal costs, "Grow trees").

import type { Coord } from '../sim/state';

export interface Floater {
  cell: Coord;
  text: string;
  bornAt: number;
  color?: string;
  /** A UI-atlas icon drawn BEFORE the text, so a floater reads `(icon) +2`
   *  like every other label on the map. An atlas NAME, never an emoji in the
   *  string — see `drawIcon` in ./sprites.ts for why. */
  icon?: string;
}

const LIFETIME_MS = 1200;

export class Floaters {
  private items: Floater[] = [];

  add(cell: Coord, text: string, icon?: string, color?: string): void {
    this.items.push({ cell, text, bornAt: performance.now(), color, icon });
  }

  /** Live floaters with their age fraction [0,1]; prunes the dead. */
  alive(): Array<Floater & { t: number }> {
    const now = performance.now();
    this.items = this.items.filter((f) => now - f.bornAt < LIFETIME_MS);
    return this.items.map((f) => ({ ...f, t: (now - f.bornAt) / LIFETIME_MS }));
  }
}
