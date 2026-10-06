// ONE WAY IN FOR A REWARD (Docs/plans/relics-and-bag.md, step 4).
//
// A reward is coins, items and relic fragments. Every source that pays one —
// the Survey, a quest, a treasure, a lair, the store — describes it
// as a `Grant` and pays it here, so a coin lands in the purse its scope names
// (the player's Gems, the kingdom's Knowledge and Stardust, the city's
// goods), an item lands in the Bag and fragments are rolled on the event
// that paid them, without each source repeating the routing.

import { CURRENCIES, ITEMS } from './data/definitions';
import { grantItem } from './bag';
import { dropFragments, type FragmentDrop } from './relics';
import { payKnowledge } from './knowledge';
import { addToWallet, type CurrencyId, type GameState, type ItemId, type Wallet } from './state';

/** Items by count — a Bag in miniature. */
export type ItemStock = Partial<Record<ItemId, number>>;

export interface Grant {
  wallet: Wallet;
  items: ItemStock;
  /** Relic fragments, of relics already met (sim/relics.ts). */
  fragments: number;
}

/** A column of item ids by level ('' for none): one more of the item at
 *  `level`, if the column names one the build knows. */
export function addItemAt(items: ItemStock, column: readonly string[] | undefined, level: number): void {
  const id = (column ?? [])[level - 1] ?? '';
  if (id !== '' && ITEMS[id as ItemId] !== undefined) items[id as ItemId] = (items[id as ItemId] ?? 0) + 1;
}

export const emptyGrant = (): Grant => ({ wallet: {}, items: {}, fragments: 0 });

/** Does it pay anything at all? */
export const grantIsEmpty = (g: Grant): boolean =>
  g.fragments === 0
  && Object.values(g.wallet).every((n) => !n)
  && Object.values(g.items).every((n) => !n);

/** Coins into the purse each one's scope names. Knowledge lands as a lump,
 *  over the bar's cap. */
export function payWallet(state: GameState, wallet: Wallet): void {
  for (const [c, n] of Object.entries(wallet) as Array<[CurrencyId, number]>) {
    if (!n) continue;
    if (c === 'Knowledge') payKnowledge(state, n);
    else if (CURRENCIES[c].scope === 'player') addToWallet(state.player.wallet, c, n);
    else if (CURRENCIES[c].scope === 'kingdom') addToWallet(state.kingdom.wallet, c, n);
    else addToWallet(state.city.wallet, c, n);
  }
}

/** Pay a reward: coins, items, and its fragments rolled on `parts` — the
 *  event that paid them (the source and what identifies it there). */
export function grant(state: GameState, g: Grant, parts: readonly (string | number)[]): FragmentDrop[] {
  payWallet(state, g.wallet);
  for (const [id, n] of Object.entries(g.items) as Array<[ItemId, number]>) if (n) grantItem(state, id, n);
  return g.fragments > 0 ? dropFragments(state, 'any', g.fragments, parts) : [];
}
