// The sim's public command API and the unified advance: one event-ordered pass
// serves both the live once-per-second tick and offline replay.

import {
  CITY_DEF, CURRENCIES, DISTRICTS, KINGDOM_DEF, TOWNHALL_CYCLE,
} from './data/definitions';
import {
  buildDurationForCell, buildCost as buildCostFormula, nextBuildCost,
  districtCount, placementBlock, requiredTownhallLevel, upgradeCost, upgradeDuration,
} from './districts';
import { revealAroundDistrict } from './fog';
import type { MapData } from './grid';
import { tapCell, type TapCellResult } from './harvest';
import { advanceQueue } from './queue';
import { advanceResearch } from './research';
import {
  addWorker, advanceWorkers, assignableWorkerLimit, removeWorker, type DepositEvent,
} from './workers';
import {
  addToWallet, completesAt, districtById, getWallet, newId, remainingSeconds, townhall,
  type Coord, type CurrencyId, type District, type DistrictId, type GameState,
  type QueueItem, type ResearchId, type Rng, type Wallet,
} from './state';

// ------------------------------------------------------------------- wallets

export const canAfford = (wallet: Wallet, cost: Wallet): boolean =>
  Object.entries(cost).every(([c, amount]) => getWallet(wallet, c as CurrencyId) >= amount);

const pay = (wallet: Wallet, cost: Wallet): void => {
  for (const [c, amount] of Object.entries(cost)) addToWallet(wallet, c as CurrencyId, -amount);
};

const refund = (wallet: Wallet, cost: Wallet): void => {
  for (const [c, amount] of Object.entries(cost)) addToWallet(wallet, c as CurrencyId, amount);
};

// ------------------------------------------------------------------ building

export type EnqueueBuildResult = 'Started' | 'QueueFull' | 'NotEnoughResources' | 'InvalidCell';

export function enqueueBuild(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
): EnqueueBuildResult {
  if (state.city.queue.length >= CITY_DEF.buildQueueCapacity) return 'QueueFull';
  if (placementBlock(state, map, definitionId, cell) !== null) return 'InvalidCell';
  const cost = nextBuildCost(state, definitionId);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  const district: District = {
    uniqueId: newId(state, `district_${definitionId}`),
    definitionId,
    level: 1,
    assignedWorkers: 0,
    location: cell,
    state: 'UnderConstruction',
    visualVariant: 1,
  };
  const duration = buildDurationForCell(state, definitionId, cell, map);
  state.city.districts.push(district);
  state.city.queue.push({
    uniqueId: `BuildItem_${district.uniqueId}`,
    kind: 'build',
    districtUniqueId: district.uniqueId,
    durationSeconds: duration,
    startedAt: null,
  });
  return 'Started';
}

export type UpgradeResult =
  | 'Started' | 'AtMaxLevel' | 'AlreadyUpgrading' | 'RequirementsNotMet'
  | 'QueueFull' | 'NotEnoughResources';

export function upgradeDistrict(state: GameState, districtUniqueId: string): UpgradeResult {
  const district = districtById(state, districtUniqueId);
  if (!district) return 'RequirementsNotMet';
  const def = DISTRICTS[district.definitionId];
  if (district.level >= def.maxLevel) return 'AtMaxLevel';
  if (state.city.queue.some((q) => q.kind === 'upgrade' && q.districtUniqueId === districtUniqueId)) {
    return 'AlreadyUpgrading';
  }
  if (townhall(state).level < requiredTownhallLevel(district.definitionId, district.level + 1)) {
    return 'RequirementsNotMet';
  }
  if (state.city.queue.length >= CITY_DEF.buildQueueCapacity) return 'QueueFull';
  const cost = upgradeCost(district.definitionId, districtCount(state, district.definitionId), district.level);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.city.queue.push({
    uniqueId: `UpgradeItem_${district.uniqueId}_${district.level + 1}`,
    kind: 'upgrade',
    districtUniqueId: district.uniqueId,
    targetLevel: district.level + 1,
    durationSeconds: upgradeDuration(district.definitionId, district.level),
    startedAt: null,
  });
  return 'Started';
}

export type CancelResult = 'Cancelled' | 'NotFound' | 'NotCancellable';

/** Cancel a queued BUILD: remove item + district, refund the cost recomputed
 *  after removal so the count multiplier matches what was actually paid. */
export function cancelQueueItem(state: GameState, itemId: string): CancelResult {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item) return 'NotFound';
  if (item.kind !== 'build') return 'NotCancellable';
  const district = districtById(state, item.districtUniqueId);
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  if (district) {
    state.city.districts.splice(state.city.districts.indexOf(district), 1);
    // Refund recomputed with the count AFTER removal, matching what was paid.
    const cost = buildCostFormula(district.definitionId, districtCount(state, district.definitionId));
    refund(state.city.wallet, cost);
  }
  return 'Cancelled';
}

// --------------------------------------------------------------- completions

/** Idle workers re-check availability from `t` (never retroactively earlier). */
export function wakeIdleWorkersAt(state: GameState, t: number): void {
  for (const w of state.workers) {
    if (w.activity === 'Idle') w.stateStartedAt = Math.max(w.stateStartedAt, t);
  }
}

function completeQueueItem(state: GameState, map: MapData, item: QueueItem, t: number): void {
  const district = districtById(state, item.districtUniqueId);
  if (!district) return;
  if (item.kind === 'build') {
    district.state = 'Built';
    revealAroundDistrict(state, map, district); // the new building pushes back the fog
  } else {
    district.level = item.targetLevel ?? district.level + 1;
  }
  wakeIdleWorkersAt(state, t); // new workable cells / bigger radius from t on
}

export type RushResult = 'Success' | 'NotFound' | 'NotEnoughGems';

/** gemCost = max(1, ceil(remainingSeconds / 10)) — 10 seconds per gem. */
export const gemRushCost = (item: QueueItem, now: number): number =>
  Math.max(1, Math.ceil(remainingSeconds(item, now) / 10));

export function finishWithGems(
  state: GameState,
  map: MapData,
  itemId: string,
  now: number,
): RushResult {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item) return 'NotFound';
  const cost = gemRushCost(item, now);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  // Remove from the queue FIRST so the advance can't double-complete it.
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  completeQueueItem(state, map, item, now);
  return 'Success';
}

// ------------------------------------------------------------------- workers

export type AssignWorkerResult = 'Assigned' | 'Unassigned' | 'NoFreeWorkers' | 'NoMoreTiles' | 'NotAWorkerDistrict' | 'NoWorkers';

export function changeWorkers(
  state: GameState,
  map: MapData,
  districtUniqueId: string,
  delta: 1 | -1,
  now: number,
): AssignWorkerResult {
  const district = districtById(state, districtUniqueId);
  if (!district || DISTRICTS[district.definitionId].maxWorkersPerLevel.length === 0) {
    return 'NotAWorkerDistrict';
  }
  if (delta === 1) {
    const assigned = state.city.districts.reduce((s, d) => s + d.assignedWorkers, 0);
    if (state.city.population - assigned < 1) return 'NoFreeWorkers';
    if (district.assignedWorkers >= assignableWorkerLimit(state, map, district)) return 'NoMoreTiles';
    addWorker(state, map, district, now);
    return 'Assigned';
  }
  if (district.assignedWorkers === 0) return 'NoWorkers';
  removeWorker(state, district);
  wakeIdleWorkersAt(state, now); // a freed claim may unblock an Idle worker
  return 'Unassigned';
}

// -------------------------------------------------------------- townhall tap

export interface TownhallCycle {
  progress: number; // 0..1
  remainingSeconds: number;
  payout: number;
}

export function townhallCycle(state: GameState, now: number): TownhallCycle {
  const th = townhall(state);
  const cycleMs = TOWNHALL_CYCLE.cycleSeconds * 1000;
  const startedAt = th.cycleStartedAt ?? now;
  const elapsed = Math.min(cycleMs, Math.max(0, now - startedAt));
  return {
    progress: elapsed / cycleMs,
    remainingSeconds: (cycleMs - elapsed) / 1000,
    payout: TOWNHALL_CYCLE.silverPerPopulation * state.city.population,
  };
}

function advanceTownhall(state: GameState, toTime: number): number {
  const th = townhall(state);
  if (th.cycleStartedAt === undefined) th.cycleStartedAt = toTime;
  const cycleMs = TOWNHALL_CYCLE.cycleSeconds * 1000;
  let paid = 0;
  while (th.cycleStartedAt + cycleMs <= toTime) {
    const payout = TOWNHALL_CYCLE.silverPerPopulation * state.city.population;
    addToWallet(state.city.wallet, 'Silver', payout);
    paid += payout;
    th.cycleStartedAt += cycleMs;
  }
  return paid;
}

/** Tap the Townhall: add tapBoostSeconds of progress to the current cycle
 *  (paying out immediately if that completes it). Never exhausts. */
export function townhallTap(state: GameState, now: number): number {
  const th = townhall(state);
  th.cycleStartedAt = (th.cycleStartedAt ?? now) - TOWNHALL_CYCLE.tapBoostSeconds * 1000;
  return advanceTownhall(state, now);
}

// ---------------------------------------------------------------- mana trickle

function accrueMana(state: GameState, toTime: number): void {
  const rate = KINGDOM_DEF.manaPerHour / 60; // per minute
  const cap = CURRENCIES.Mana.cap!;
  const current = getWallet(state.kingdom.wallet, 'Mana');
  if (current >= cap) {
    state.kingdom.manaLastProduction = toTime; // overflow lost, as before
    return;
  }
  const minutes = (toTime - state.kingdom.manaLastProduction) / 60_000;
  const produced = Math.trunc(rate * minutes);
  if (produced <= 0) return; // keep the sub-unit remainder
  state.kingdom.manaLastProduction += (produced / rate) * 60_000;
  addToWallet(state.kingdom.wallet, 'Mana', Math.min(produced, cap - current));
}

// ------------------------------------------------------------------- advance

export interface AdvanceResult {
  deposits: DepositEvent[];
  completedItems: QueueItem[];
  completedResearch: ResearchId[];
  townhallPaid: number;
}

/**
 * Advance the whole sim from state.lastAdvance to `toTime`. Queue completions
 * are interleaved chronologically with the worker simulation so a FarmLands
 * finishing mid-absence starts being worked at its completion time, not at
 * load time. Also used verbatim by the live once-per-second tick.
 */
export function advance(state: GameState, map: MapData, toTime: number): AdvanceResult {
  const result: AdvanceResult = {
    deposits: [], completedItems: [], completedResearch: [], townhallPaid: 0,
  };
  let cursor = Math.min(state.lastAdvance, toTime);
  const builders = Math.max(1, state.kingdom.maxBuilders);
  for (;;) {
    // Stamp/complete queue work due at the cursor (items enqueued since the
    // last advance get stamped here — within one tick of their enqueue).
    const done = advanceQueue(state.city.queue, cursor, builders);
    for (const item of done) {
      completeQueueItem(state, map, item, Math.min(completesAt(item), cursor));
      result.completedItems.push(item);
    }
    // Next queue completion inside the window?
    let tNext = Infinity;
    for (const item of state.city.queue.slice(0, builders)) {
      if (item.startedAt !== null) tNext = Math.min(tNext, completesAt(item));
    }
    if (tNext > toTime) break;
    result.deposits.push(...advanceWorkers(state, map, tNext));
    cursor = tNext;
  }
  result.deposits.push(...advanceWorkers(state, map, toTime));
  result.townhallPaid = advanceTownhall(state, toTime);
  const finishedResearch = advanceResearch(state, toTime);
  if (finishedResearch) result.completedResearch.push(finishedResearch);
  accrueMana(state, toTime);
  // Expired spells just lapse — Rain's boost was applied when it mattered.
  state.activeSpells = state.activeSpells.filter((s) => s.expiresAt > toTime);
  state.lastAdvance = toTime;
  return result;
}

export { tapCell, assignableWorkerLimit };
export type { TapCellResult };

export type { Rng };
