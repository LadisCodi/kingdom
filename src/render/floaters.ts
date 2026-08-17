// Floating world-space feedback texts ("+N", reveal costs, "Grow trees").

import type { Coord } from '../sim/state';

export interface Floater {
  cell: Coord;
  text: string;
  bornAt: number;
  color?: string;
}

const LIFETIME_MS = 1200;

export class Floaters {
  private items: Floater[] = [];

  add(cell: Coord, text: string, color?: string): void {
    this.items.push({ cell, text, bornAt: performance.now(), color });
  }

  /** Live floaters with their age fraction [0,1]; prunes the dead. */
  alive(): Array<Floater & { t: number }> {
    const now = performance.now();
    this.items = this.items.filter((f) => now - f.bornAt < LIFETIME_MS);
    return this.items.map((f) => ({ ...f, t: (now - f.bornAt) / LIFETIME_MS }));
  }
}
