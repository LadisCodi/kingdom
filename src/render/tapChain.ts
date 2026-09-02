// Priority-ordered chain of cell-tap handlers: the first handler that consumes
// the tap wins (Docs/09). Priorities: casting 320, moving a building 310,
// placement 300, sites 100, fog reveal 50, cell info 0.
//
// The three targeting modes sit at the top and in the order they were most
// recently entered, because they are mutually exclusive: only one of them can
// be active, and whichever it is must swallow every map tap so a stray press
// cannot open a card behind the ghost.

import type { Coord } from '../sim/state';

export interface TapHandler {
  priority: number;
  handle(cell: Coord): boolean; // true = consumed
}

export class TapChain {
  private handlers: TapHandler[] = [];

  register(handler: TapHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  dispatch(cell: Coord): void {
    for (const h of this.handlers) {
      if (h.handle(cell)) return;
    }
  }
}
