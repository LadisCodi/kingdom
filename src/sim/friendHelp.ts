// Daily help between friends (Docs/features/15-social.md §3): what a help
// pays the helper, and what a friend's gift puts in the Bag. Which friend may
// be helped, and how often, is the social server's to say.

import { FRIEND_HELP, ITEMS } from './data/definitions';
import { grantItem } from './bag';
import { addMana, manaNetRegen } from './mana';
import { roundPrice } from './roundPrice';
import type { GameState, ItemId } from './state';

/** What a help pays the helper: minutes of their own Mana regeneration,
 *  at least 1. */
export const helpMana = (state: GameState): number =>
  Math.max(1, roundPrice(manaNetRegen(state) * FRIEND_HELP.helperManaMinutes / 60));

/** The helper is paid, up to the pool's ceiling. Returns what was banked. */
export const payHelper = (state: GameState): number => addMana(state, helpMana(state));

/** A friend's gift lands in the Bag; an item no longer authored is dropped. */
export function receiveGift(state: GameState, item: ItemId): void {
  if (ITEMS[item] !== undefined) grantItem(state, item);
}
