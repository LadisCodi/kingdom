// Population: housing, auto-assigned residents, passive tax gold, and the
// Townhall's villager-training queue.

import { CITY_DEF, DISTRICTS, TAP, levelIndexed } from './data/definitions';
import { districtAdjacency } from './adjacency';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import { isTechComplete } from './research';
import { effectiveAutoTapCooldownMs, effectiveTaxRate } from './upgrades';
import { payMana } from './mana';
import { addToWallet, type District, type GameState } from './state';

/** Capacity of ONE district at its CURRENT level (0 = houses nobody).
 *  The Communities tech adds +1 to every district that houses anyone. */
export function districtCapacity(state: GameState, district: District): number {
  const list = DISTRICTS[district.definitionId].populationCapacityPerLevel;
  if (list.length === 0) return 0;
  return levelIndexed(list, district.level) + (isTechComplete(state, 'Communities') ? 1 : 0);
}

/** Max population = Σ capacity over active (Built) districts. */
export function maxPopulation(state: GameState): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    total += districtCapacity(state, d);
  }
  return total;
}

/** AvailableWorkers = Population − Σ AssignedWorkers. */
export function availableWorkers(state: GameState): number {
  let assigned = 0;
  for (const d of state.city.districts) assigned += d.assignedWorkers;
  return state.city.population - assigned;
}

// ------------------------------------------------------------------ residents

/** Everyone with a roof: taxes only come from housed villagers. */
export const housedPopulation = (state: GameState): number =>
  Math.min(state.city.population, maxPopulation(state));

/** Gold per minute ONE house pays: residents × the (TradeRoutes-boosted)
 *  rate, plus flat adjacency bonuses/penalties from its built neighbors.
 *  Empty (or fully crowded-out) houses pay nothing — clamped at 0. */
export function houseGoldPerMinute(state: GameState, district: District): number {
  const residents = residentsOf(state, district);
  if (residents === 0) return 0;
  return Math.max(0, residents * effectiveTaxRate(state) + districtAdjacency(state, district));
}

/** City-wide tax income, gold per minute, over every built house. */
export function cityGoldPerMinute(state: GameState): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || districtCapacity(state, d) === 0) continue;
    total += houseGoldPerMinute(state, d);
  }
  return total;
}

/** Residents are AUTO-assigned: houses fill in build order, no player input
 *  (which house someone lives in has no mechanical effect beyond its tap). */
export function residentsOf(state: GameState, district: District): number {
  let remaining = state.city.population;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    const cap = districtCapacity(state, d);
    if (cap === 0) continue;
    const here = Math.min(cap, remaining);
    if (d.uniqueId === district.uniqueId) return here;
    remaining -= here;
  }
  return 0;
}

// -------------------------------------------------------------------- training

/**
 * Food for the NEXT villager, given how many you already have.
 *
 * Authored for the opening, exponential after it. The first handful of
 * villagers ARE the early game — each one is a decision the player makes
 * minutes apart, and the difference between 5 Food and 20 is the difference
 * between a beat and a formality. No `base × growth^n` can be made to say
 * 5, 20, 100, 300 without deforming everything past it, so it does not try:
 * `city.population_cost_first` lists the authored prices in order, and the
 * curve takes over from the LAST of them, so the two halves meet without a
 * step.
 */
export const populationCost = (currentPopulation: number): number => {
  const authored = CITY_DEF.populationCostFirst;
  if (currentPopulation < authored.length) return authored[currentPopulation];
  const last = authored[authored.length - 1];
  const beyond = currentPopulation - (authored.length - 1);
  return Math.round(last * CITY_DEF.populationCostGrowth ** beyond);
};

// Villagers used to have their own queue here — `city.training`, a bare count
// with one timestamp. They now share the city's one training line
// (`army.ts`), because they were always the same mechanic wearing different
// clothes: pay up front, wait a duration, one at a time per building. Keeping
// two of them meant two ways to be wrong about capacity, refunds and replay.
//
// `queueTraining` and `trainingCompletesAt` live in `army.ts` now.

// ---------------------------------------------------------------- house tap

/**
 * The house tap (Docs/features/balancing-v2.md §1.1, revised 2026-09-02).
 *
 * A house taps like a TREE: as many times as you like, as fast as you like.
 * What bounds it is **Mana** — one per tap — so the ceiling is the size of the
 * pool rather than a per-house timer.
 *
 * This replaces a 60s per-house collection cycle. The cycle did bound the tap,
 * but it bounded it with a wait, and a wait is not a decision: there was
 * nothing to spend, nothing to run out of, and nothing to buy. Paying Mana
 * makes the same tap a draw against a pool the player can see, plan around and
 * refill — and it puts the city's most-used verb on the one currency the
 * design already builds pressure with.
 *
 * The boost is still scaled by this house's SHARE of city income, which is
 * what stops a large city minting more per tap than a small one: a full sweep
 * pulls forward one tapBoostSeconds of the WHOLE city's income and costs one
 * Mana per house, whatever the city's size.
 *
 * Holding is paced by the same auto-tap cooldown a held tree uses, and a
 * DELIBERATE tap is never paced — the asymmetry `effectiveAutoTapCooldownMs`
 * exists to preserve.
 */
export type HouseTapResult = 'Collected' | 'NoResidents' | 'NoMana' | 'TooSoon';

/**
 * Collect a house early. Returns the gold that matured from the pull-forward.
 *
 * `autoRepeat` marks the held-pointer path, which waits out the auto-tap
 * cooldown; a deliberate tap never does.
 */
export function houseTap(
  state: GameState,
  district: District,
  now: number,
  autoRepeat = false,
): { result: HouseTapResult; gold: number } {
  if (residentsOf(state, district) === 0) return { result: 'NoResidents', gold: 0 };
  if (autoRepeat && now - state.lastCollectTapAt < effectiveAutoTapCooldownMs(state)) {
    return { result: 'TooSoon', gold: 0 };
  }
  const cityRate = cityGoldPerMinute(state);
  if (cityRate <= 0) return { result: 'NoResidents', gold: 0 };
  // Charged LAST, so a tap that could not have paid out never takes the Mana.
  if (!payMana(state, TAP.manaCost)) return { result: 'NoMana', gold: 0 };
  const share = houseGoldPerMinute(state, district) / cityRate;
  district.lastTapAt = now;
  state.lastCollectTapAt = now;
  state.city.lastTaxAt -= TAP.boostSeconds * 1000 * share;
  return { result: 'Collected', gold: advanceCityLife(state, now).gold };
}

/**
 * The tax rate just changed at `t`: rescale the partial progress since the
 * anchor so the elapsed stretch is not repriced at the new rate.
 *
 * This used to be four inline lines that only training completion ran, so a
 * Housing finishing, `Communities` landing, or a taxRate modifier expiring all
 * quietly repriced their partial stretch. `applyDueAt` now brackets its whole
 * batch with `repriceTaxAnchorAround`, which means ONE call site covers every
 * boundary kind there will ever be.
 */
export function repriceTaxAnchor(state: GameState, t: number, rateBefore: number): void {
  const rateAfter = cityGoldPerMinute(state);
  if (rateAfter !== rateBefore && rateBefore > 0 && rateAfter > 0) {
    state.city.lastTaxAt = t - ((t - state.city.lastTaxAt) * rateBefore) / rateAfter;
  }
}

/** Run `work` (anything that might move the tax rate) with the anchor
 *  repriced across it. */
export function repriceTaxAnchorAround(state: GameState, t: number, work: () => void): void {
  const rateBefore = cityGoldPerMinute(state);
  work();
  repriceTaxAnchor(state, t, rateBefore);
}

// ------------------------------------------------------- taxes + training tick

/**
 * Advance passive taxes to `toTime`. Gold accrues in WHOLE units against the
 * lastTaxAt anchor.
 *
 * It used to interleave villager completions itself, so a villager finishing
 * mid-window started paying taxes from that moment. It no longer has to: a
 * completion is a BOUNDARY now, so `advance()` splits the window at it and
 * `repriceTaxAnchor` runs at the exact instant the rate changed. Same
 * property, one mechanism instead of two.
 */
export function advanceCityLife(state: GameState, toTime: number): { gold: number } {
  const result = { gold: 0 };
  accrueTaxes(state, toTime, result);
  return result;
}

function accrueTaxes(state: GameState, toTime: number, out: { gold: number }): void {
  const rate = cityGoldPerMinute(state); // all houses, adjacency included
  if (rate <= 0) {
    state.city.lastTaxAt = Math.max(state.city.lastTaxAt, toTime); // nobody pays: no banking
    return;
  }
  const msPerGold = 60_000 / rate;
  const units = Math.floor((toTime - state.city.lastTaxAt) / msPerGold);
  if (units <= 0) return;
  addToWallet(state.city.wallet, 'Gold', units);
  recordResourceDiscovery(state, 'Gold');
  recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: units });
  state.city.lastTaxAt += units * msPerGold;
  out.gold += units;
}
