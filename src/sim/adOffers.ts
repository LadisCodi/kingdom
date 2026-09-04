// Rewarded-ad offers (Docs/features/08-magic.md §6): the first monetisation
// surface, and the thing the Mana pool was made scarce FOR.
//
// Mana is the energy every tap is paid from, and `magic.md` records that its
// tuning law was suspended deliberately — cap 50 against 4/h is a 12.5 h
// refill, past the 8 h offline cap — so that a refill has something to sell.
// This is the refill: a full pool's worth of Mana for watching a video.
//
// THE REWARD LANDS ON TOP OF THE CAP. It is the one grant in the game that
// may overcharge the pool (`grantMana`), because a reward clamped to a
// ceiling the player is already near would pay nothing and read as broken.
// While the pool is over its ceiling the regen clock runs and banks nothing —
// the rule a full pool has always followed.
//
// WHY THIS IS NOT A BOUNDARY SOURCE. A recurring 30-90 s timer registered in
// `advance()` would propose ~86,400 boundaries across a 30-day absence,
// against a MAX_BOUNDARY_STEPS of 10,000 — and the tail advance in save.ts is
// UNCAPPED, so the loop would break silently and drop real discrete work. It
// would also make the offer's timing depend on how often the sim happened to
// sample Mana, which is precisely the property this codebase asserts
// everywhere it can.
//
// So `advance()` never touches an offer. `refreshAdOffer` runs from the live
// tick instead. That is sound because the offer is an opportunity shown to a
// player rather than economy: nothing else in the sim reads it, claiming is
// always a live action, and every `payMana` call site is a player command —
// so during a replay the pool only ever RISES and the latch cannot be raced.

import { AD } from './data/definitions';
import { grantMana, mana, manaCap } from './mana';
import { rand } from './rng';
import type { GameState } from './state';

/**
 * How long until the next offer, in ms.
 *
 * Keyed on the persisted claim counter, never on the clock: `rng.ts` requires
 * the parts to identify the EVENT rather than the moment it was asked, which
 * is what makes the same save roll the same next interval. Whole ms, because
 * every other instant in the sim is an integer.
 */
export function adCooldownMs(state: GameState): number {
  const { cooldownMinSeconds: min, cooldownMaxSeconds: max } = AD;
  const roll = rand(state.seed, 'adOffer', state.ads.claims);
  return Math.round((min + roll * (max - min)) * 1000);
}

/** A whole pool, on top of whatever is banked. */
export const adOfferReward = (state: GameState): number => manaCap(state);

/** Below this the player is short enough for an offer to be a kindness rather
 *  than an interruption. */
export const adOfferEligible = (state: GameState): boolean =>
  mana(state) < manaCap(state) * AD.eligibleBelowFraction;

/** Is there an offer on screen right now? */
export const adOfferPending = (state: GameState): boolean => state.ads.pending;

/**
 * The latch. Called from the live tick, never from `advance()`.
 *
 * Once an offer is up it STAYS up until claimed — it does not withdraw
 * because regen nudged the pool back over half. An offer that appeared and
 * then evaporated would read as the game changing its mind.
 */
export function refreshAdOffer(state: GameState, now: number): void {
  if (state.ads.pending) return;
  if (now < state.ads.readyAt) return;
  if (!adOfferEligible(state)) return;
  state.ads.pending = true;
}

export type ClaimAdResult = 'Claimed' | 'NoOffer';

/**
 * Take the reward and start the next cooldown.
 *
 * `claims` is incremented BEFORE the roll so consecutive cooldowns are drawn
 * from consecutive keys — the counter is the key, and reusing one would make
 * two claims in a row wait exactly the same time.
 */
export function claimAdOffer(state: GameState, now: number): ClaimAdResult {
  if (!state.ads.pending) return 'NoOffer';
  grantMana(state, adOfferReward(state));
  state.ads.pending = false;
  state.ads.claims += 1;
  state.ads.readyAt = now + adCooldownMs(state);
  return 'Claimed';
}
