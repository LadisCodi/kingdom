// Population: housing, auto-assigned residents, passive tax gold, and the
// Townhall's villager-training queue.

import { CITY_DEF, DISTRICTS, TAP, TRAINING, levelIndexed } from './data/definitions';
import { districtAdjacency } from './adjacency';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import { isTechComplete } from './research';
import { effectiveAutoTapCooldownMs, effectiveTaxRate } from './upgrades';
import { payMana } from './mana';
import { addToWallet, type District, type GameState } from './state';
import { canAfford, pay } from './wallet';

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
    repriceTaxAnchor(state, t, rateBefore);
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
  recordResourceDiscovery(state, 'Gold');
  recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: units });
  state.city.lastTaxAt += units * msPerGold;
  out.gold += units;
}
