// Population: housing, auto-assigned residents, passive tax gold, and the
// Townhall's villager-training queue.

import { CITY_DEF, DISTRICTS, TAXES, TRAINING } from './data/definitions';
import { districtAdjacency } from './adjacency';
import { recordQuestEvent } from './quests';
import { effectiveCollectCooldownMs, effectiveTaxRate } from './upgrades';
import { addToWallet, type District, type GameState } from './state';
import { canAfford, pay } from './wallet';

/** Max population = Σ PopulationCapacity over active (Built) districts. */
export function maxPopulation(state: GameState): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    total += DISTRICTS[d.definitionId].populationCapacity;
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
    if (d.state !== 'Built' || DISTRICTS[d.definitionId].populationCapacity === 0) continue;
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
    const cap = DISTRICTS[d.definitionId].populationCapacity;
    if (cap === 0) continue;
    const here = Math.min(cap, remaining);
    if (d.uniqueId === district.uniqueId) return here;
    remaining -= here;
  }
  return 0;
}

// -------------------------------------------------------------------- training

/** cost = round(base × growth^(currentPopulation − 1)) Food. */
export const populationCost = (currentPopulation: number): number =>
  Math.round(
    CITY_DEF.populationCostBase * CITY_DEF.populationCostGrowth ** (currentPopulation - 1),
  );

/** Villagers already paid for but not yet delivered. */
export const queuedTraining = (state: GameState): number =>
  state.city.training?.queued ?? 0;

export type QueueTrainingResult = 'Queued' | 'AtMax' | 'NotEnoughResources';

/** Queue one villager at the Townhall: Food paid up front (priced as if the
 *  queue already delivered), then TRAINING.seconds each, one after another.
 *  Queueing is limited only by housing capacity and the Food on hand. */
export function queueTraining(state: GameState, now: number): QueueTrainingResult {
  const pending = queuedTraining(state);
  if (state.city.population + pending >= maxPopulation(state)) return 'AtMax';
  const cost = { Food: populationCost(state.city.population + pending) };
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  if (state.city.training === null) state.city.training = { queued: 1, startedAt: now };
  else state.city.training.queued += 1;
  return 'Queued';
}

/** When the villager currently in training completes; null when idle. */
export const trainingCompletesAt = (state: GameState): number | null =>
  state.city.training === null
    ? null
    : state.city.training.startedAt + TRAINING.seconds * 1000;

// ---------------------------------------------------------------- house tap

export type HouseTapResult = 'Boosted' | 'NoResidents' | 'OnCooldown';

/** Tap a lived-in house: fast-forward the CITY tax clock by
 *  taxes.tap_boost_seconds — the building-timer twin of the Townhall's
 *  training boost. Paced by the shared collect cooldown (QuickHands helps),
 *  and houses never exhaust — that mechanic is for natural cells only.
 *  Returns any gold that matured from the boost. */
export function houseTap(
  state: GameState,
  district: District,
  now: number,
): { result: HouseTapResult; gold: number } {
  if (residentsOf(state, district) === 0) return { result: 'NoResidents', gold: 0 };
  if (now - state.lastCollectTapAt < effectiveCollectCooldownMs(state)) {
    return { result: 'OnCooldown', gold: 0 };
  }
  state.lastCollectTapAt = now;
  state.city.lastTaxAt -= TAXES.tapBoostSeconds * 1000;
  return { result: 'Boosted', gold: advanceCityLife(state, now).gold };
}

// ------------------------------------------------------- taxes + training tick

/** Advance passive taxes AND the training queue to `toTime`, interleaved so a
 *  villager finishing mid-window starts paying taxes from that moment — the
 *  one-call offline replay lands exactly where stepped ticking would.
 *  Tax gold accrues in WHOLE units against the lastTaxAt anchor. */
export function advanceCityLife(
  state: GameState,
  toTime: number,
): { gold: number; trained: number } {
  const result = { gold: 0, trained: 0 };
  for (;;) {
    const completes = trainingCompletesAt(state);
    const t = completes !== null && completes <= toTime ? completes : toTime;
    accrueTaxes(state, t, result);
    if (t === toTime && (completes === null || completes > toTime)) break;
    // One villager finished: +1 population, the next starts immediately.
    const training = state.city.training!;
    const rateBefore = cityGoldPerMinute(state);
    state.city.population += 1;
    result.trained += 1;
    training.queued -= 1;
    if (training.queued > 0) training.startedAt = t;
    else state.city.training = null;
    // The tax rate just changed: rescale the partial progress since the
    // anchor so the elapsed stretch isn't repriced at the new rate.
    const rateAfter = cityGoldPerMinute(state);
    if (rateAfter !== rateBefore && rateBefore > 0 && rateAfter > 0) {
      state.city.lastTaxAt = t - ((t - state.city.lastTaxAt) * rateBefore) / rateAfter;
    }
  }
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
  recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: units });
  state.city.lastTaxAt += units * msPerGold;
  out.gold += units;
}
