// Mana (Docs/features/08-magic.md §1): the only capped currency in the game, and
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
import { isTechComplete } from './research';
import { effect } from './upgrades';
import {
  addToWallet, getWallet, type GameState, type RuinId,
} from './state';

/**
 * Mana per hour: a flat floor, plus the Sanctum.
 *
 * The Townhall used to be the whole of it. It produces nothing now — it gates
 * and nothing else (Docs/features/08-magic.md §2) — so the Sanctum is the
 * engine as well as the reservoir, and the whole Mana curve lives in the
 * Magic tome where the fog, the landmarks and the ruins already are.
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
  // Ley Taps: the one thing that lets a landmark touch the RATE, and it is a
  // line the player researched rather than a property of the claim, so the
  // "capacity not production" rule for sanctuaries still holds by default.
  base += effect(state, 'LeyTaps') * claimedLandmarks(state);
  return Math.max(0, resolve(state, 'manaRegen', base));
}

const claimedLandmarks = (state: GameState): number =>
  Object.keys(state.landmarks.claimed).filter((id) => state.landmarks.claimed[id] === true).length;

const clearedRuins = (state: GameState): number => {
  let n = 0;
  for (const id of Object.keys(RUINS) as RuinId[]) if (state.ruinsCleared[id] === true) n += 1;
  return n;
};

/** What actually accrues, per hour. Nothing draws against it, so this is
 *  simply production — kept as its own name because every caller means "the
 *  rate the pool actually fills at", which is a claim worth being able to
 *  change in one place. */
export const manaNetRegen = (state: GameState): number => Math.max(0, manaProduction(state));

/**
 * The ceiling: a flat floor, the Sanctum's levels, and every sanctuary
 * claimed out in the fog. The Townhall is not in it — see `manaProduction`.
 *
 * The floor is 50, which is what `00-design-intent.md` has always said a new
 * kingdom starts with. The old `base_cap_per_townhall_level` opened at 100
 * and quietly contradicted it; Phase 0 was meant to catch that and did not.
 *
 * Sanctuaries raise CAPACITY rather than rate, which is what makes exploring
 * compound. An ad pays a whole pool, so every shrine claimed makes every
 * future ad permanently bigger — a claim is worth more the longer you play,
 * instead of a flat +1/h that mattered most on the day you found it and less
 * every day after.
 */
export function manaCap(state: GameState): number {
  let cap = MANA.baseCap + effect(state, 'DeepWells')
    + (isTechComplete(state, 'Meditation') ? MANA.meditationCap : 0);
  cap += Object.keys(state.landmarks.claimed).length * MANA.landmarkCap;
  for (const d of state.city.districts) {
    if (d.definitionId === 'Sanctum' && d.state === 'Built') {
      cap += levelIndexed(MANA.sanctumCapPerLevel, d.level);
    }
  }
  return Math.max(0, Math.round(resolve(state, 'manaCap', cap)));
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

/** Gems for a refill, priced on what is MISSING as a share of the cap: a
 *  FULL pool is `gemRefillFullPool` Gems — one $0.99 pouch, at every stage of
 *  the game (Docs/features/14-monetization.md §2.2) — and half a pool is half
 *  that. Never a price per Mana, which is what went stale as the pool grew
 *  (a flat 4 a Gem once made a full refill cost 83 Gems against a lifetime
 *  faucet of 75). A full pool costs 0. */
export const manaRefillGemCost = (state: GameState): number => {
  const cap = manaCap(state);
  if (cap <= 0) return 0;
  const missing = Math.max(0, cap - mana(state));
  return Math.ceil((missing / cap) * MANA.gemRefillFullPool);
};

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
 * Knowledge is the research clock, and its rate is the ground you have taken:
 * every ruin CLEARED, and (next step) every landmark claimed. Discovery pays
 * nothing; taking a dungeon to its bottom turns it into a permanent faucet.
 *
 * There is deliberately NO base rate. A player who claims nothing generates
 * nothing — Knowledge is not a wage for existing, it is what the land teaches
 * you once you have taken some of it. The safety valve is that era 1 of the
 * tree costs no Knowledge at all, so the opening hours run on Gold and time.
 * See Docs/features/07-research.md §3.
 *
 * KINGDOM-scoped: a technology is something the kingdom knows, so the tree
 * survives a province reset — and the contested landmarks that will pay it
 * lumps live on the world map, not in any one city. Modified by
 * knowledgeYield (the Wanderer's Compass). Same whole-units-against-an-anchor
 * shape as taxes and Mana, so all three replay identically.
 *
 * The rate CHANGES in play — a ruin cleared, a landmark claimed — and that is
 * safe without any settling step, because `advance` runs the continuous sims
 * up to a boundary BEFORE applying the discrete work at it. The anchor is
 * always `T0 + k × msPer` at the instant the rate moves, in a one-call replay
 * and in stepped ticking alike. That ordering is held by `taxes.test.ts` and
 * `workers.test.ts`; `expeditions.test.ts` holds the drip's own behaviour
 * across a rate change. An earlier draft added a `settleKnowledge` that
 * snapped the anchor at every rate change — it was unnecessary for the reason
 * above, and it silently discarded up to one unit each time it fired.
 */
export function knowledgePerHour(state: GameState): number {
  const cleared = clearedRuins(state);
  const claimed = claimedLandmarks(state);
  // Each source has its own line: Vigils per ruin, Wayposts per landmark —
  // and Scriptorium is a percentage on the whole, applied where the modifier
  // stack applies, so a relic and a rank read the same number the same way.
  // Per ruin: the drip, doubled by Sanctified Ruins, plus Vigils and — for
  // ground held to its deepest depth, which is what a clear IS — Conquest.
  const perRuin = KNOWLEDGE.dripPerClearedRuinPerHour
    * (isTechComplete(state, 'SanctifiedRuins') ? 2 : 1)
    + effect(state, 'Vigils')
    + (isTechComplete(state, 'Conquest') ? KNOWLEDGE.conquestPerClearedRuinPerHour : 0);
  const raw = cleared * perRuin
    + claimed * (KNOWLEDGE.perClaimedLandmarkPerHour + effect(state, 'Wayposts'));
  if (raw === 0) return 0;
  return Math.max(0, resolve(state, 'knowledgeYield', raw * (1 + effect(state, 'Scriptorium'))));
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
