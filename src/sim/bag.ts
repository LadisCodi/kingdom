// THE BAG (Docs/proposals/inventory.md, Docs/plans/relics-and-bag.md).
//
// Everything the player owns that is not a currency or a building, held
// until it is USED. Three rules this file keeps:
//
//  1. AN ITEM IS NOT A CURRENCY. Nothing prices anything in items; an item
//     leaves the Bag only by being used.
//  2. A CHEST IS A DURATION OF THE PLAYER'S OWN PRODUCTION, read at the
//     moment of use (`cityMakesPerSecond`), never a fixed amount — the
//     `tap.workSeconds` rule. Its floor (`bag.chestFloorPerHour`) is what a
//     coin the city barely makes yet still pays.
//  3. A USE IS A COMMAND. It reads the state as `advance()` left it and
//     lands in the wallet, past any store — the offline replay never sees it.

import { track } from './analytics';
import { BAG, ITEMS, type ItemDef } from './data/definitions';
import { cityMakesPerSecond } from './production';
import { addToWallet, type GameState, type ItemId, type Wallet } from './state';

export const itemDef = (id: ItemId): ItemDef | undefined => ITEMS[id];

/** The Bag's tabs (Docs/art/ui-inventory.md §3.2). Relics joins them when
 *  relics are found rather than collected. */
export const BAG_TABS = ['Resources', 'Speed ups', 'Boosts', 'Other'] as const;
export type BagTab = typeof BAG_TABS[number];

const TAB_OF_KIND: Record<ItemDef['kind'], BagTab> = { chest: 'Resources', speedup: 'Speed ups' };

/** Which tab an item is shown in: a fact of its kind. */
export const bagTabOf = (id: ItemId): BagTab => TAB_OF_KIND[ITEMS[id].kind];

/** How many of this item the Bag holds. */
export const itemCount = (state: GameState, id: ItemId): number => state.bag.held[id] ?? 0;

/** Every item held, in file order — the Bag's order. */
export const heldItems = (state: GameState): ItemId[] =>
  (Object.keys(ITEMS) as ItemId[]).filter((id) => itemCount(state, id) > 0);

/** Put `n` of an item in the Bag. It is fresh until its tile is tapped. */
export function grantItem(state: GameState, id: ItemId, n = 1): void {
  if (ITEMS[id] === undefined || !(n > 0)) return;
  state.bag.held[id] = itemCount(state, id) + n;
  state.bag.fresh[id] = true;
  state.bag.badge += n;
}

/** What ONE of this chest pays, now: its seconds of what the city makes of
 *  its coin, floored. Nothing for an item that is not a chest. */
export function chestValue(state: GameState, id: ItemId): Wallet {
  const def = ITEMS[id];
  if (def === undefined || def.kind !== 'chest' || def.coin === null) return {};
  const made = cityMakesPerSecond(state, def.coin) * def.seconds;
  const floor = (BAG.chestFloorPerHour * def.seconds) / 3600;
  return { [def.coin]: Math.round(Math.max(floor, made)) };
}

export type UseItemResult = 'Used' | 'NotHeld' | 'UnknownItem' | 'NeedsATimer';

/**
 * Use `n` of an item. A chest pays `n` times what one pays: it lands in the
 * wallet, not in a store, so a second chest reads the same rate as the first
 * and Use ×N is exactly N single uses.
 */
export function useItem(state: GameState, id: ItemId, n: number): UseItemResult {
  const def = ITEMS[id];
  if (def === undefined) return 'UnknownItem';
  // A speed-up is used ON a timer (sim/speedups.ts), never from the Bag alone.
  if (def.kind === 'speedup') return 'NeedsATimer';
  if (!(n >= 1) || !Number.isInteger(n) || itemCount(state, id) < n) return 'NotHeld';
  const one = chestValue(state, id);
  for (const [c, amount] of Object.entries(one) as Array<[keyof Wallet, number]>) {
    addToWallet(state.city.wallet, c, amount * n);
  }
  const left = itemCount(state, id) - n;
  if (left > 0) state.bag.held[id] = left;
  else {
    delete state.bag.held[id];
    delete state.bag.fresh[id];
  }
  track(state, 'item_used', { item: id, count: n });
  return 'Used';
}

/** The tile was tapped: it is no longer new. */
export function markItemSeen(state: GameState, id: ItemId): void {
  delete state.bag.fresh[id];
}

/** The Bag was opened: the nav's orb clears. */
export function markBagOpened(state: GameState): void {
  state.bag.badge = 0;
}
