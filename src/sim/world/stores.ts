// When a world district's store is ready to collect (19 §7.1): the board
// draws its bubble, and a tap on the hex collects it rather than opening its
// card — as a tap on a city building does.

import type { HexControl } from './source';

/** A quarter full, or any precious material at all. */
export function worldStoreReady(h: Pick<HexControl, 'held' | 'active' | 'burnt' | 'stores' | 'precious'>): boolean {
  if (!h.held || !h.active || h.burnt === true) return false;
  const s = h.stores;
  if (s !== null && s.cap > 0 && s.amount >= Math.max(1, s.cap * 0.25)) return true;
  return h.precious != null && h.precious.amount >= 1;
}
