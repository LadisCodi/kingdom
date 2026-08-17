// The sim's public command API: plain functions (state, args, now, rng) → result
// enums. The UI layer calls only these (plus the query helpers they re-export).

import { CITY_DEF, DISTRICTS } from './data/definitions';
import { accrueAll, collectFromDistrict, type ProductionReport } from './economy';
import {
  buildCostForCell, buildDurationForCell, buildCost as buildCostFormula,
  districtCount, placementBlock, requiredTownhallLevel, upgradeCost, upgradeDuration,
} from './districts';
import { townhallDistance, type MapData } from './grid';
import { recalculateCityProduction } from './recalc';
import { advanceQueue } from './queue';
import { expireSpells } from './spells';
import { assignableWorkerLimit } from './workedUnits';
import {
  addToWallet, getWallet, newId, remainingSeconds, townhall,
  type Coord, type CurrencyId, type District, type DistrictId, type GameState,
  type QueueItem, type Rng, type Wallet,
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
  now: number,
  rng: Rng,
): EnqueueBuildResult {
  void now; void rng;
  if (state.city.queue.length >= CITY_DEF.buildQueueCapacity) return 'QueueFull';
  if (placementBlock(state, map, definitionId, cell) !== null) return 'InvalidCell';
  const cost = buildCostForCell(state, definitionId, cell, map);
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
    generators: [],
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
  const district = state.city.districts.find((d) => d.uniqueId === districtUniqueId);
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
export function cancelQueueItem(state: GameState, map: MapData, itemId: string): CancelResult {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item) return 'NotFound';
  if (item.kind !== 'build') return 'NotCancellable';
  const district = state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  if (district) {
    state.city.districts.splice(state.city.districts.indexOf(district), 1);
    const cost = buildCostFormula(
      district.definitionId,
      districtCount(state, district.definitionId), // count AFTER removal
      townhallDistance(map, district.location),
    );
    refund(state.city.wallet, cost);
  }
  return 'Cancelled';
}

// --------------------------------------------------------------- completions

function completeQueueItem(state: GameState, map: MapData, item: QueueItem, now: number, rng: Rng): void {
  const district = state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
  if (!district) return;
  if (item.kind === 'build') district.state = 'Built';
  else district.level = item.targetLevel ?? district.level + 1;
  recalculateCityProduction(state, map, now, rng);
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
  rng: Rng,
): RushResult {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item) return 'NotFound';
  const cost = gemRushCost(item, now);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  // Remove from the queue FIRST so the per-second driver can't double-complete it.
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  completeQueueItem(state, map, item, now, rng);
  return 'Success';
}

// ------------------------------------------------------------------- workers

export type AssignWorkerResult = 'Assigned' | 'Unassigned' | 'NoFreeWorkers' | 'NoMoreTiles' | 'NotAWorkerDistrict';

export function changeWorkers(
  state: GameState,
  map: MapData,
  districtUniqueId: string,
  delta: 1 | -1,
  now: number,
  rng: Rng,
): AssignWorkerResult {
  const district = state.city.districts.find((d) => d.uniqueId === districtUniqueId);
  if (!district || DISTRICTS[district.definitionId].maxWorkersPerLevel.length === 0) {
    return 'NotAWorkerDistrict';
  }
  if (delta === 1) {
    const assigned = state.city.districts.reduce((s, d) => s + d.assignedWorkers, 0);
    if (state.city.population - assigned < 1) return 'NoFreeWorkers';
    if (district.assignedWorkers >= assignableWorkerLimit(state, map, district)) return 'NoMoreTiles';
    district.assignedWorkers += 1;
    recalculateCityProduction(state, map, now, rng);
    return 'Assigned';
  }
  if (district.assignedWorkers > 0) {
    district.assignedWorkers -= 1;
    recalculateCityProduction(state, map, now, rng);
  }
  return 'Unassigned';
}

// ---------------------------------------------------------------------- tick

export interface TickResult {
  production: Map<string, ProductionReport>; // wallet-direct deposits, for "+N" floaters
  completedItems: QueueItem[];
  regrownCells: Coord[];
}

/** The single once-per-second tick (fidelity fix b: exactly one driver). */
export function tick(state: GameState, map: MapData, now: number, rng: Rng): TickResult {
  const production = accrueAll(state, now);
  const completedItems = advanceQueue(state.city.queue, now, Math.max(1, state.kingdom.maxBuilders));
  for (const item of completedItems) completeQueueItem(state, map, item, now, rng);
  const regrownCells = expireSpells(state, map, now, rng);
  return { production, completedItems, regrownCells };
}

export { collectFromDistrict };
