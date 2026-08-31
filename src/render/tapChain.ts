// Priority-ordered chain of cell-tap handlers: the first handler that consumes
// the tap wins (Docs/09). Priorities: placement 300,
// expansion 100, fog reveal 50, cell info 0.

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
