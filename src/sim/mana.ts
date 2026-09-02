// Mana (Docs/features/magic.md §1): the only capped currency in the game, and
// the only pressure the design applies to a player who stays away.
//
// TWO DIALS THAT MUST KEEP DOING DIFFERENT JOBS.
//
//   production (Mana/h) = Townhall level
//   capacity   (pool)   = Townhall level + the Sanctum + sanctuaries claimed
//
// Production answers "how much do I get for free"; capacity answers "how big
// is a session, and how big is an ad". Conflating them would waste both.
//
// SANCTUARIES BUY CAPACITY, NOT RATE (2026-09-02). They used to pay +1 Mana/h
// each, which mattered most on the day you found one and less every day
// after. Against a pool the ad reward is measured in, a claim instead makes
// every future ad permanently bigger — so exploring compounds rather than
// decays, and the map is worth clearing at any stage of the game.
//
// NOTHING DRAINS IT. Relics used to charge an hourly upkeep while attuned;
// that was removed once Mana became the energy every tap is paid from, because
// the two jobs fought: a player wearing the relic set had no pool left to play
// with, and at Townhall 1 the full set drew exactly what the Townhall made, so
// wearing everything stalled the pool dead. Mana is a tap budget now, and the
// only thing that spends it is the player.
//
// THE TUNING LAW IS SUSPENDED (2026-09-02). It was cap ≈ 8 × net regen, which
// kept "an overnight absence fills the pool exactly" true at every stage. That
// law belonged to a pool whose only job was sustaining artifacts — an ABSENCE
// budget. Mana is now the energy every tap is paid from, so the pool is a
// SPEND budget, and the two want opposite things: an absence budget should
// refill exactly overnight, while a spend budget has to be able to run out or
// there is nothing for a refill to sell. See magic.md §"The tuning law".
//
// THE POOL CAN EXCEED ITS CAP. An ad reward (adOffers.ts) grants a full pool
// on top of whatever is banked. Only `grantMana` may cross the ceiling;
// everything else clamps.
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
// Accrual mirrors accrueTaxes exactly — whole units against a `lastManaAt`
// anchor — so the offline replay and the live tick land on the same integer.
// Mana regen IS city idle production, so it IS subject to the 8h cap.

import { KNOWLEDGE, MANA, RUINS, levelIndexed } from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { resolve } from './modifiers';
import {
  addToWallet, getWallet, townhall, type GameState, type RuinId,
} from './state';

/** Mana per hour. The Townhall alone — sanctuaries buy CAPACITY now, not
 *  rate, so the two dials stay genuinely different things. */
export function manaProduction(state: GameState): number {
  const base = levelIndexed(MANA.productionPerTownhallLevel, townhall(state).level);
  return Math.max(0, resolve(state, 'manaRegen', base));
}

/** What actually accrues, per hour. Nothing draws against it, so this is
 *  simply production — kept as its own name because every caller means "the
 *  rate the pool actually fills at", which is a claim worth being able to
 *  change in one place. */
export const manaNetRegen = (state: GameState): number => Math.max(0, manaProduction(state));

/**
 * The ceiling: the Townhall's own pool, the Sanctum's, and every sanctuary
 * claimed out in the fog.
 *
 * Sanctuaries raise CAPACITY rather than rate, which is what makes exploring
 * compound. An ad pays a whole pool, so every shrine claimed makes every
 * future ad permanently bigger — a claim is worth more the longer you play,
 * instead of a flat +1/h that mattered most on the day you found it and less
 * every day after.
 */
export function manaCap(state: GameState): number {
  let cap = levelIndexed(MANA.baseCapPerTownhallLevel, townhall(state).level);
  cap += Object.keys(state.landmarks.claimed).length * MANA.landmarkCap;
  for (const d of state.city.districts) {
    if (d.definitionId === 'Sanctum' && d.state === 'Built') {
      cap += levelIndexed(MANA.sanctumCapPerLevel, d.level);
    }
  }
  return cap;
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

/** Accrue whole Mana against the anchor, exactly as accrueTaxes does for Gold.
 *  Runs in `runContinuous`, so it is city production and the 8h offline cap
 *  applies to it. */
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

/** Gems for a refill, priced on what is MISSING (so a full pool costs 0). */
export const manaRefillGemCost = (state: GameState): number =>
  Math.ceil(Math.max(0, manaCap(state) - mana(state)) / MANA.gemRefillPerGem);

export type RefillResult = 'Refilled' | 'AlreadyFull' | 'NotEnoughGems';

export function refillManaWithGems(state: GameState): RefillResult {
  const cost = manaRefillGemCost(state);
  if (cost <= 0) return 'AlreadyFull';
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  addMana(state, manaCap(state));
  return 'Refilled';
}

// ------------------------------------------------------------- the Knowledge drip

/**
 * Knowledge accrues from every ruin the player has CLEARED — not from every
 * ruin they have found. Discovery pays nothing; taking a dungeon to its bottom
 * turns it into a permanent faucet.
 *
 * That is what keeps the currency honest now that it buys nothing but heroes
 * and relics: the levelling arc is fed by the system it feeds. It still gives
 * the arc a floor that survives between expeditions — five cleared ruins drip
 * ~240 a day whether or not a party is out — but the floor has to be earned
 * one dungeon at a time.
 *
 * Kingdom-scoped, like the currency itself, and modified by knowledgeYield (the
 * Wanderer's Compass). Same whole-units-against-an-anchor shape as taxes and
 * Mana, so all three replay identically.
 */
export function knowledgePerHour(state: GameState): number {
  let cleared = 0;
  for (const id of Object.keys(RUINS) as RuinId[]) {
    if (state.ruinsCleared[id] === true) cleared += 1;
  }
  if (cleared === 0) return 0;
  return Math.max(
    0, resolve(state, 'knowledgeYield', cleared * KNOWLEDGE.dripPerClearedRuinPerHour),
  );
}

export function accrueKnowledge(state: GameState, toTime: number): number {
  const rate = knowledgePerHour(state);
  if (rate <= 0) {
    state.kingdom.lastKnowledgeAt = Math.max(state.kingdom.lastKnowledgeAt, toTime);
    return 0;
  }
  const msPer = 3_600_000 / rate;
  const units = Math.floor((toTime - state.kingdom.lastKnowledgeAt) / msPer);
  if (units <= 0) return 0;
  state.kingdom.lastKnowledgeAt += units * msPer;
  addToWallet(state.kingdom.wallet, 'Knowledge', units);
  recordResourceDiscovery(state, 'Knowledge');
  return units;
}
