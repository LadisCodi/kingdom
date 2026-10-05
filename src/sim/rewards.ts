// ONE WAY IN FOR A REWARD (Docs/plans/relics-and-bag.md, step 4).
//
// A reward is coins, items and at most a pack. Every source that pays one —
// the pass, the Survey, a quest, a treasure, a lair, the store — describes it
// as a `Grant` and pays it here, so a coin lands in the purse its scope names
// (the player's Gems, the kingdom's Knowledge and Stardust, the city's
// goods), an item lands in the Bag and a pack in the collection's queue,
// without each source repeating the routing.

import { CURRENCIES, type PackTier } from './data/definitions';
import { grantItem } from './bag';
import { grantPack, type PackSource } from './collection';
import { payKnowledge } from './knowledge';
import { addToWallet, type CurrencyId, type GameState, type ItemId, type Wallet } from './state';

/** Items by count — a Bag in miniature. */
export type ItemStock = Partial<Record<ItemId, number>>;

export interface Grant {
  wallet: Wallet;
  items: ItemStock;
  pack: PackTier | null;
}

export const emptyGrant = (): Grant => ({ wallet: {}, items: {}, pack: null });

/** Does it pay anything at all? */
export const grantIsEmpty = (g: Grant): boolean =>
  g.pack === null
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

/** Pay a reward: coins, items, the pack. */
export function grant(state: GameState, g: Grant, source: PackSource): void {
  payWallet(state, g.wallet);
  for (const [id, n] of Object.entries(g.items) as Array<[ItemId, number]>) if (n) grantItem(state, id, n);
  if (g.pack !== null) grantPack(state, g.pack, source);
}
