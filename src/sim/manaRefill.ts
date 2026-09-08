// The refill (Docs/features/08-magic.md §6): the two ways to buy a pool back,
// and the day that limits both.
//
// ONE REWARD, TWO PRICES. A refill is always a WHOLE POOL, on top of whatever
// is banked (`grantMana`) — the video pays it and the Gems pay it, so the two
// buttons in the Mana sheet are the same offer at different tills. That is
// what keeps the Gem price honest: what rises through the day is the RUNG, not
// the size of the pool it buys, so a refill never has to be priced per Mana
// (which is what went stale as the cap grew).
//
// TWO COUNTERS, ONE DAY. `watched` and `bought` are separate allowances:
// spending the five videos does not close the Gem ladder, and buying five
// pools does not cost the player a video. Both roll at UTC midnight, for the
// reason `daily.ts` gives — the sim may not read a clock it was not handed,
// and a rollover at a different local hour per player costs nothing on a
// mechanic that never punishes a miss.
//
// THE GEM LADDER'S LENGTH IS THE GEM CAP. `mana.gem_refill_costs` has one
// entry per rung, and when the rungs run out so do the purchases — a ladder
// with no top would need a price that repeats, and a price that repeats is a
// dial nobody can reason about.
//
// LAZY AND IDEMPOTENT, exactly as `heroes.ts` rolls a banner's free pulls:
// every reader rolls the ledger onto today, so nothing has to happen at
// midnight and a stale day can never leak into a count.
//
// NOT A BOUNDARY SOURCE, for `adOffers.ts`'s reason verbatim: a daily
// rollover registered in `advance()` would propose a boundary a day across a
// long absence for no simulation benefit, and nothing in the sim reads these
// counters — buying and claiming are always live player commands.

import { AD, MANA } from './data/definitions';
import { dayIndex } from './daily';
import { grantMana, mana, manaCap } from './mana';
import { addToWallet, getWallet, type GameState } from './state';

type Ledger = GameState['ads']['refills'];

/** The ledger, rolled onto today. Every reader calls it. */
function roll(state: GameState, now: number): Ledger {
  const today = dayIndex(now);
  if (state.ads.refills.day !== today) {
    state.ads.refills = { day: today, watched: 0, bought: 0 };
  }
  return state.ads.refills;
}

/** Today's counts, without writing anything — for a read that must stay pure
 *  (a UI draw, a save). */
const counts = (state: GameState, now: number): Ledger =>
  (state.ads.refills.day === dayIndex(now)
    ? state.ads.refills
    : { day: dayIndex(now), watched: 0, bought: 0 });

/** How many refills the videos have left today. */
export const watchedRefillsLeft = (state: GameState, now: number): number =>
  Math.max(0, AD.manaRefillsPerDay - counts(state, now).watched);

/** How many the Gem ladder has left today — its remaining rungs. */
export const boughtRefillsLeft = (state: GameState, now: number): number =>
  Math.max(0, MANA.gemRefillCosts.length - counts(state, now).bought);

/** Which rung the next purchase would stand on, 1-based, for the copy that
 *  says "the 3rd of the day". */
export const nextRefillRung = (state: GameState, now: number): number =>
  counts(state, now).bought + 1;

/** Called when a video pays a refill. The allowance is the sim's to spend. */
export function recordWatchedRefill(state: GameState, now: number): void {
  roll(state, now).watched += 1;
}

/**
 * Gems for the next refill today, or null when the ladder is spent.
 *
 * A rising price, indexed by purchases already made TODAY — never by what is
 * missing from the pool, because the reward is a whole pool either way.
 */
export const manaRefillGemCost = (state: GameState, now: number): number | null => {
  const i = counts(state, now).bought;
  return MANA.gemRefillCosts[i] ?? null;
};

export type RefillResult = 'Refilled' | 'AlreadyFull' | 'NotEnoughGems' | 'NoneLeft';

/** Buy a whole pool. The same reward the video pays, at today's rung. */
export function refillManaWithGems(state: GameState, now: number): RefillResult {
  const cost = manaRefillGemCost(state, now);
  if (cost === null) return 'NoneLeft';
  if (mana(state) >= manaCap(state)) return 'AlreadyFull';
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  // On TOP of the ceiling, exactly as the ad reward lands: a refill the player
  // paid for must never pay less than the video does.
  grantMana(state, manaCap(state));
  roll(state, now).bought += 1;
  return 'Refilled';
}
