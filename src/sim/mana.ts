// Mana (Docs/features/08-magic.md §1): the only capped currency in the game,
// and the energy every tap on the ground is paid from.
//
// TWO DIALS THAT MUST KEEP DOING DIFFERENT JOBS (08-magic.md §2).
//
//   production (Mana/h) = the floor + the Sanctum
//   capacity   (pool)   = the base + the Sanctum + landmarks, the Watchtower
//                         and the world's Sanctuaries
//
// Production answers "how much do I get for free"; capacity answers "how big
// is a session, and how big is a refill". The Townhall touches neither, and a
// claim buys capacity, never rate, so every future refill is bigger. The two
// base dials are tuned together so an empty pool fills in about a night.
//
// NOTHING DRAINS IT but the player: taps, a city relic's activation, a world
// relic's spell, a fight, a Runestone queued (08-magic.md §3). There is no
// upkeep. Mana is a SPEND budget — it has to be able to run out, or there is
// nothing for a refill to sell (§6).
//
// THE POOL CAN EXCEED ITS CAP. A refill (adOffers.ts, or Gems) grants a full
// pool on top of whatever is banked, as do a quest's Mana and a refunded
// Runestone (08-magic.md §2.1); they go through `grantMana` or the wallet
// directly. Everything else clamps.
//
// Above the cap the regen clock keeps running and banks nothing, exactly as a
// full pool has always behaved — and it falls out of `addMana`'s ceiling
// rather than needing a branch in `accrueMana`: the units are computed, the
// anchor advances, `addMana` finds `before` already at or past the ceiling and
// returns 0. Do NOT "optimise" that into an early-out. Snapping the anchor to
// `toTime` for the over-cap case is what makes a window that CROSSES the cap
// end on a different instant under one-call replay than under stepped
// ticking, which is the one property commands.ts exists to guarantee.
//
// Accrual mirrors a house's rent exactly — whole units against a `lastManaAt`
// anchor — so the offline replay and the live tick land on the same integer.
// The pool is its only ceiling, away or not.

import { MANA, WORLD_BUILD, levelIndexed } from './data/definitions';
import { resolve } from './modifiers';
import { techMultiplier } from './techEffects';
import {
  addToWallet, getWallet, type GameState,
} from './state';

/**
 * Mana per hour: a flat floor, plus the Sanctum.
 *
 * The Townhall used to be the whole of it. It produces nothing now — it gates
 * and nothing else (Docs/features/08-magic.md §2) — so the Sanctum is the
 * engine as well as the reservoir, and the whole Mana curve lives in its
 * levels.
 *
 * The floor is what a kingdom regenerates before it has built anything, which
 * has to be non-zero or the opening session has no Mana to tap with.
 * Sanctuaries still buy CAPACITY rather than rate, so the two dials stay
 * genuinely different things.
 */
export function manaProduction(state: GameState): number {
  let base = MANA.basePerHour;
  for (const d of state.city.districts) {
    if (d.definitionId === 'Sanctum' && d.state === 'Built') {
      base += levelIndexed(MANA.sanctumPerHourPerLevel, d.level);
    }
  }
  // The tree's `manaRegen`: a share on the whole rate, so a rank is worth the
  // same to a new kingdom and to one with ten Sanctum levels.
  return Math.max(0, resolve(state, 'manaRegen', base * techMultiplier(state, 'manaRegen')));
}


/** What actually accrues, per hour. Nothing draws against it, so this is
 *  simply production — kept as its own name because every caller means "the
 *  rate the pool actually fills at", which is a claim worth being able to
 *  change in one place. */
export const manaNetRegen = (state: GameState): number => Math.max(0, manaProduction(state));

/**
 * The ceiling: a flat floor, the Sanctum's levels, and every sanctuary
 * claimed out in the fog. The Townhall is not in it — see `manaProduction`.
 *
 * The floor is 100 (`mana.base_cap`), and a new kingdom starts on exactly
 * that — the pool begins full, because every tap is paid from it. It moves
 * with `mana.base_per_hour`, never alone: the two are tuned together to keep
 * the pool filling a little SLOWER than a night away
 * (`08-magic.md` §2), so it can run out but never by much.
 *
 * Sanctuaries raise CAPACITY rather than rate, which is what makes exploring
 * compound. An ad pays a whole pool, so every shrine claimed makes every
 * future ad permanently bigger — a claim is worth more the longer you play,
 * instead of a flat +1/h that mattered most on the day you found it and less
 * every day after.
 */
export function manaCap(state: GameState): number {
  let cap = MANA.baseCap;
  cap += Object.keys(state.landmarks.claimed).length * MANA.landmarkCap;
  // The Watchtower, repaired, is a landmark's worth (22-progression.md §5).
  if (state.city.districts.some((d) => d.definitionId === 'Watchtower' && d.state === 'Built')) cap += MANA.landmarkCap;
  // Each Sanctuary held and on the chain, on the world board (19 §8).
  cap += state.world.sanctuaries * WORLD_BUILD.sanctuaryManaCap;
  for (const d of state.city.districts) {
    if (d.definitionId === 'Sanctum' && d.state === 'Built') {
      cap += levelIndexed(MANA.sanctumCapPerLevel, d.level);
    }
  }
  // Deep Wells and Meditation: a share of the WHOLE pool, landmarks and
  // Sanctum included, so a rank never shrinks into the noise as the pool
  // grows.
  return Math.max(0, Math.round(resolve(state, 'manaCap', cap * techMultiplier(state, 'manaCap'))));
}

export const mana = (state: GameState): number => getWallet(state.city.wallet, 'Mana');

/**
 * The ONE place Mana is clamped. `addToWallet` deliberately does not clamp —
 * it is used by nine callers for ten currencies, none of which has a ceiling —
 * so the overflow rule lives here, where the ceiling is known.
 *
 * Returns the amount actually banked; the difference is what spilled.
 */
export function addMana(state: GameState, amount: number): number {
  const cap = manaCap(state);
  const before = mana(state);
  // The ceiling is the cap OR what is already banked, whichever is higher: an
  // overcharged pool is above the cap ON PURPOSE, and a routine grant must
  // never confiscate it on the way past.
  const after = Math.min(Math.max(cap, before), Math.max(0, before + amount));
  state.city.wallet.Mana = after;
  return after - before;
}

/**
 * The ONE path that may take the pool past its ceiling.
 *
 * Rewards that are explicitly "a whole pool, on top of what you have" — the
 * ad offer today — come through here. Everything else uses `addMana` and
 * stops at the cap, so the overflow stays a thing the player was deliberately
 * given rather than something any grant can cause by accident.
 */
export function grantMana(state: GameState, amount: number): number {
  const before = mana(state);
  const after = Math.max(0, before + amount);
  state.city.wallet.Mana = after;
  return after - before;
}

export const canPayMana = (state: GameState, cost: number): boolean => mana(state) >= cost;

export function payMana(state: GameState, cost: number): boolean {
  if (!canPayMana(state, cost)) return false;
  addToWallet(state.city.wallet, 'Mana', -cost);
  return true;
}

/** Hours from empty to full at the current net rate; Infinity when stalled. */
export const manaFillHours = (state: GameState): number => {
  const rate = manaNetRegen(state);
  return rate <= 0 ? Infinity : manaCap(state) / rate;
};

/**
 * Milliseconds until the next whole Mana lands, or null when none will: the
 * rate is zero, or the pool is at (or past) its ceiling and the unit would
 * spill. Read off the same anchor `accrueMana` advances, so the countdown
 * reaches zero on the tick that pays it.
 */
export function msToNextMana(state: GameState, now: number): number | null {
  const rate = manaNetRegen(state);
  if (rate <= 0 || mana(state) >= manaCap(state)) return null;
  const msPerMana = 3_600_000 / rate;
  const elapsed = Math.max(0, now - state.city.lastManaAt);
  return msPerMana - (elapsed % msPerMana);
}

/** Accrue whole Mana against the anchor, exactly as a house accrues rent.
 *  Runs in `runContinuous`; the pool is its only ceiling. */
export function accrueMana(state: GameState, toTime: number): number {
  const rate = manaNetRegen(state);
  if (rate <= 0) {
    // Nobody is producing: do not bank the elapsed time against a future rate.
    state.city.lastManaAt = Math.max(state.city.lastManaAt, toTime);
    return 0;
  }
  const msPerMana = 3_600_000 / rate;
  const units = Math.floor((toTime - state.city.lastManaAt) / msPerMana);
  if (units <= 0) return 0;
  state.city.lastManaAt += units * msPerMana;
  // A full pool still consumes the clock — the overflow is the pressure, and
  // banking it would remove the reason to come back before it fills.
  return addMana(state, units);
}

/** Both ways to buy a pool back — the video's allowance and the Gem ladder —
 *  live in `manaRefill.ts`, because a refill is one offer with two tills and
 *  a day that limits both. */
