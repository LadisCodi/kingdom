// What the header is holding back while a reward flies in.
//
// A claim puts the reward in the wallet at once — the sim does not wait for
// an animation — but the header should count it in as each fragment LANDS.
// So the flight holds the amount here when it starts, and releases a share
// per fragment; the header draws `wallet − held`. Presentation only: nothing
// in the sim reads this.

import type { CurrencyId } from '../sim/state';

const held = new Map<CurrencyId, number>();
const listeners: Array<() => void> = [];

const changed = () => { for (const fn of listeners) fn(); };

/** How much of this coin the header is not showing yet. */
export const heldOf = (c: CurrencyId): number => held.get(c) ?? 0;

export function hold(c: CurrencyId, amount: number): void {
  held.set(c, heldOf(c) + amount);
  changed();
}

export function release(c: CurrencyId, amount: number): void {
  const left = Math.max(0, heldOf(c) - amount);
  if (left === 0) held.delete(c);
  else held.set(c, left);
  changed();
}

export function onHoldChange(fn: () => void): void {
  listeners.push(fn);
}
