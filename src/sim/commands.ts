// The sim's public command API and the unified advance: one event-ordered pass
// serves both the live once-per-second tick and offline replay.

import { CITY_DEF, DISTRICTS, TRAINING } from './data/definitions';
import {
  buildDurationForCell, buildCost as buildCostFormula, nextBuildCost,
  districtCount, placementBlock, requiredTechForLevel, requiredTownhallLevel,
  upgradeCost, upgradeDuration,
} from './districts';
import { revealAroundDistrict } from './fog';
import type { MapData } from './grid';
import {
  advanceRespawns, collectTap, tapCell, type CollectTapResult, type TapCellResult,
} from './harvest';
import { advanceCityLife } from './population';
import { advanceQueue } from './queue';
import { advanceResearch, isTechComplete } from './research';
import { canAfford, effectiveAmount, pay, refund } from './wallet';
import {
  addWorker, advanceWorkers, assignableWorkerLimit, removeWorker, type DepositEvent,
} from './workers';
import {
  addToWallet, completesAt, districtById, getWallet, newId, remainingSeconds, townhall,
  type Coord, type District, type DistrictId, type GameState,
  type QueueItem, type Rng, type TechId,
} from './state';

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
  const gateTech = requiredTechForLevel(district.definitionId, district.level + 1);
  if (gateTech !== null && !isTechComplete(state, gateTech)) return 'RequirementsNotMet';
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

export type AssignWorkerResult = 'Assigned' | 'Unassigned' | 'NoFreeWorkers' | 'AtCapacity' | 'NotAWorkerDistrict' | 'NoWorkers';

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
    if (district.assignedWorkers >= assignableWorkerLimit(district)) return 'AtCapacity';
    addWorker(state, map, district, now);
    return 'Assigned';
  }
  if (district.assignedWorkers === 0) return 'NoWorkers';
  removeWorker(state, district);
  wakeIdleWorkersAt(state, now); // a freed claim may unblock an Idle worker
  return 'Unassigned';
}

// -------------------------------------------------------------- townhall tap

export type TownhallTapResult = 'Boosted' | 'TrainingComplete' | 'NoTraining';

/** Tap the Townhall: add tapBoostSeconds of progress to the villager
 *  currently in training (completing it early when the boost covers the
 *  remainder — the next queued villager then starts immediately). */
export function townhallTap(state: GameState, now: number): TownhallTapResult {
  if (state.city.training === null) return 'NoTraining';
  state.city.training.startedAt -= TRAINING.tapBoostSeconds * 1000;
  return advanceCityLife(state, now).trained > 0 ? 'TrainingComplete' : 'Boosted';
}

// ------------------------------------------------------------------- advance

export interface AdvanceResult {
  deposits: DepositEvent[];
  completedItems: QueueItem[];
  completedResearch: TechId[];
  goldEarned: number; // passive tax gold accrued in this window
  trainedPopulation: number; // villagers who finished training
}

/**
 * Advance the whole sim from state.lastAdvance to `toTime`. Queue completions
 * are interleaved chronologically with the worker simulation so a FarmLands
 * finishing mid-absence starts being worked at its completion time, not at
 * load time. Also used verbatim by the live once-per-second tick.
 */
export function advance(state: GameState, map: MapData, toTime: number): AdvanceResult {
  const result: AdvanceResult = {
    deposits: [], completedItems: [], completedResearch: [], goldEarned: 0, trainedPopulation: 0,
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
    advanceRespawns(state, map, tNext);
    result.deposits.push(...advanceWorkers(state, map, tNext));
    // Taxes/training up to the cursor too: a Housing completing mid-absence
    // starts collecting taxes at its completion time, not at load time.
    const life = advanceCityLife(state, tNext);
    result.goldEarned += life.gold;
    result.trainedPopulation += life.trained;
    cursor = tNext;
  }
  advanceRespawns(state, map, toTime);
  result.deposits.push(...advanceWorkers(state, map, toTime));
  const life = advanceCityLife(state, toTime);
  result.goldEarned += life.gold;
  result.trainedPopulation += life.trained;
  result.completedResearch.push(...advanceResearch(state, toTime));
  state.lastAdvance = toTime;
  return result;
}

export { canAfford, effectiveAmount, collectTap, tapCell, assignableWorkerLimit };
export type { CollectTapResult, TapCellResult };

export type { Rng };
