// The sim's public command API and the unified advance: one event-ordered pass
// serves both the live once-per-second tick and offline replay.

import { DISTRICTS, KINGDOM_DEF, TECHNOLOGIES,
} from './data/definitions';
import {
  buildDurationForCell, buildCost as buildCostFormula, canMoveDistrict, nextBuildCost,
  districtCount, placementBlock, requiredTechForLevel, requiredTownhallLevel,
  upgradeCost, upgradeDuration,
} from './districts';
import { advanceTraining, nextTrainingCompletion } from './army';
import { advanceDelves, nextDelveBoundary, type DelveEvent } from './expeditions';
import { revealAroundDistrict } from './fog';
import {
  advanceSchedule, nextScheduleBoundary, type ScheduleEvent,
} from './timeline';
import type { MapData } from './grid';
import {
  advanceRespawns, collectTap, tapCell, type CollectTapResult, type TapCellResult,
} from './harvest';
import { accrueKnowledge, accrueMana } from './mana';
import { advanceCityLife, repriceTaxAnchorAround } from './population';
import { advanceQueue } from './queue';
import { advanceResearch, isTechComplete, techCompletesAt } from './research';
import { pruneExpiredModifiers, nextModifierExpiry, type Modifier } from './modifiers';
import { canAfford, pay, refund } from './wallet';
import {
  addWorker, advanceWorkers, assignableWorkerLimit, relocateCrew, removeWorker,
  type DepositEvent, type StrikeEvent,
} from './workers';
import {
  addToWallet, builderCount, buildQueueCapacity, completesAt, districtById, getWallet,
  newId, remainingSeconds, townhall,
  type Coord, type District, type DistrictId, type GameState,
  type QueueItem, type TechId, type UnitId,
} from './state';

// ------------------------------------------------------------------ building

export type GrantBuilderResult = 'Granted' | 'AtCeiling';

/**
 * Hire a builder, free: one more job the city can have in flight.
 *
 * The unpriced door. Quests, events and `?dev` grant builders; the PLAYER
 * buys one through `buyBuilder` below. Keeping the grant and the purchase
 * apart is what lets a future event hand out a temporary builder without
 * teaching the price curve anything.
 */
export function grantBuilder(state: GameState): GrantBuilderResult {
  if (state.kingdom.builders >= KINGDOM_DEF.maxBuilders) return 'AtCeiling';
  state.kingdom.builders += 1;
  return 'Granted';
}

/**
 * Gems for the NEXT builder, on the same escalating-slot curve the research,
 * party and attunement slots already use: `round(base x growth^purchased)`.
 *
 * `purchased` is derived — `builders - startBuilders` — rather than counted
 * in its own save field, because the two can never disagree that way. The
 * cost of that: a granted builder makes the next PURCHASED one dearer. That
 * is the right way round for a gift, and the alternative (a separate counter)
 * is a field that has to be migrated and kept honest forever.
 */
export const builderGemCost = (state: GameState): number =>
  Math.round(
    KINGDOM_DEF.builderGemCostBase
    * KINGDOM_DEF.builderGemCostGrowth ** Math.max(0, state.kingdom.builders - KINGDOM_DEF.startBuilders),
  );

export type BuyBuilderResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

/** The player's own purchase. Same shape as `buySlot` / `buyPartySlot`. */
export function buyBuilder(state: GameState): BuyBuilderResult {
  if (state.kingdom.builders >= KINGDOM_DEF.maxBuilders) return 'AtMax';
  const cost = builderGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.kingdom.builders += 1;
  return 'Purchased';
}

/** `NoBuilderFree`, not `QueueFull`: nothing is queued and nothing waits —
 *  every builder is already on a job. It is the moment the Gem offer exists
 *  for (`Docs/features/06-construction.md`). */
export type EnqueueBuildResult =
  | 'Started' | 'NoBuilderFree' | 'NotEnoughResources' | 'InvalidCell';

export function enqueueBuild(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
): EnqueueBuildResult {
  if (state.city.queue.length >= buildQueueCapacity(state)) return 'NoBuilderFree';
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

// ------------------------------------------------------------------- moving

export type MoveDistrictResult =
  | 'Moved' | 'NotFound' | 'Immovable' | 'InvalidCell' | 'SameCell';

/**
 * Pick a built building up and put it down somewhere else. **Free, instant,
 * and it never fails halfway.**
 *
 * Free because the alternative is a tax on tidying up, and this is a game
 * whose first promise is that nothing you own is ever taken from you. A move
 * costs the player nothing and gains them nothing directly — what it changes
 * is position, and position is already priced by everything that reads it:
 * housing adjacency, influence radius, worker walking distance.
 *
 * Which is why it goes through `repriceTaxAnchorAround`. Moving a house in or
 * out of a neighbour's range changes the city's gold rate at this instant,
 * and the tax anchor has to be settled at the instant the rate changed or the
 * player is paid the new rate for time already elapsed at the old one. That
 * is the same mechanism a completed build uses; a move is just another thing
 * that reprices the city.
 */
export function moveDistrict(
  state: GameState,
  map: MapData,
  districtUniqueId: string,
  cell: Coord,
  now: number,
): MoveDistrictResult {
  const district = districtById(state, districtUniqueId);
  if (!district) return 'NotFound';
  if (!canMoveDistrict(district)) return 'Immovable';
  if (district.location.x === cell.x && district.location.y === cell.y) return 'SameCell';
  if (placementBlock(state, map, district.definitionId, cell, district.uniqueId) !== null) {
    return 'InvalidCell';
  }
  const from = district.location;
  repriceTaxAnchorAround(state, now, () => {
    district.location = cell;
  });
  relocateCrew(state, map, district, from, now);
  // The new address pushes back the fog exactly as finishing a build does —
  // otherwise a building could be moved to the frontier and sit there staring
  // at ground it has already paid to see.
  revealAroundDistrict(state, map, district);
  // Its old neighbours may have cells free now, and its new ones may not.
  wakeIdleWorkersAt(state, now);
  return 'Moved';
}

export type UpgradeResult =
  | 'Started' | 'AtMaxLevel' | 'AlreadyUpgrading' | 'RequirementsNotMet'
  | 'NoBuilderFree' | 'NotEnoughResources';

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
  if (state.city.queue.length >= buildQueueCapacity(state)) return 'NoBuilderFree';
  const cost = upgradeCost(district.definitionId, districtCount(state, district.definitionId), district.level);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.city.queue.push({
    uniqueId: `UpgradeItem_${district.uniqueId}_${district.level + 1}`,
    kind: 'upgrade',
    districtUniqueId: district.uniqueId,
    targetLevel: district.level + 1,
    durationSeconds: upgradeDuration(state, district.definitionId, district.level),
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

// The Townhall no longer answers a tap. A training queue is a FIXED duration
// and a tap is a scaling one, so a maxed thumb would finish a 20-second
// villager in a single press — `Docs/features/04-harvest.md` §4.2. Timers are
// hurried with Gems; Mana buys work, and a queue is not work.

// ------------------------------------------------------------------- advance
//
// THE BOUNDARY LOOP. `advance` splits its window at every moment discrete work
// falls due, and runs the continuous sims only BETWEEN those moments. Three
// properties hold, and every future boundary source must preserve them:
//
//  1. Termination is structural. `consider` only accepts `at > after`, and
//     `applyDueAt(cursor)` drains every source AT the cursor before
//     `nextBoundary` is asked — so the cursor strictly increases. The step cap
//     is a seatbelt, not the mechanism.
//  2. Boundaries are absolute-time, not tick-relative. That is *why* stepped
//     ticking and one-call offline replay converge exactly rather than
//     approximately: a tech completing at C splits the window at C in both.
//  3. A boundary landing exactly on `toTime` is still applied, because
//     `applyDueAt` sits at the top of the loop body (tests/research.test.ts
//     relies on this).
//
// Deliberately preserved: there is no trailing `applyDueAt(toTime)`. The old
// code never called `advanceQueue` at `toTime` either, and adding one would
// change when a newly enqueued item is stamped.
//
// Deliberately NOT a boundary: feature respawns. Over an 8h replay a finite
// feature can cycle dozens of times, and each boundary costs a full
// `advanceWorkers` sweep — O(workers × workableCells) with a fresh allocation
// per worker. Thousands of boundaries would turn a ~10-iteration replay into a
// multi-second one, to fix an inaccuracy both paths share identically.

export interface AdvanceResult {
  /** Axe-lands-on-cell events: the renderer hits the CELL with them. */
  strikes: StrikeEvent[];
  /** Haul-lands-at-building events: the wallet moved, so the number pops
   *  at the BUILDING. The gap between a strike and its deposit is the walk. */
  deposits: DepositEvent[];
  completedItems: QueueItem[];
  completedResearch: TechId[];
  goldEarned: number; // passive tax gold accrued in this window
  trainedPopulation: number; // villagers who finished training
  /** Modifiers whose window closed inside this advance — the "your Haste ran
   *  out while you were away" half of the offline report. */
  expiredModifiers: Modifier[];
  manaEarned: number;
  knowledgeEarned: number;
  /** Units that finished training in this window. */
  trainedUnits: UnitId[];
  /** Depths resolved, checkpoints reached, runs ended. */
  delveEvents: DelveEvent[];
  /** Windows that opened or closed — including ones that did BOTH while the
   *  player was away, which is the payoff for absolute-time boundaries. */
  scheduleEvents: ScheduleEvent[];
}

const emptyResult = (): AdvanceResult => ({
  strikes: [], deposits: [], completedItems: [], completedResearch: [], goldEarned: 0,
  trainedPopulation: 0, expiredModifiers: [], manaEarned: 0, knowledgeEarned: 0,
  trainedUnits: [], delveEvents: [], scheduleEvents: [],
});

/** Discrete work due AT `t`: everything that changes another subsystem's inputs. */
function applyDueAt(
  state: GameState,
  map: MapData,
  t: number,
  builders: number,
  out: AdvanceResult,
): void {
  // Bracketed so the tax anchor is repriced across the WHOLE batch: one call
  // site covers a Housing completing, Communities landing and a taxRate
  // modifier expiring, instead of only the training completion that used to
  // remember to do it.
  repriceTaxAnchorAround(state, t, () => {
    for (const item of advanceQueue(state.city.queue, t, builders)) {
      completeQueueItem(state, map, item, Math.min(completesAt(item), t));
      out.completedItems.push(item);
    }
    const finished = advanceResearch(state, t);
    out.completedResearch.push(...finished);
    // Farsight widens what every STANDING building can see, not only the next
    // one built — so a rank landing re-applies each district's fog radii. It
    // happens here, inside the walk, because this is where the map is; and it
    // is deterministic, so replay and stepped ticking discover the same cells.
    if (finished.some((id) => TECHNOLOGIES[id].line === 'Farsight')) {
      for (const d of state.city.districts) {
        if (d.state === 'Built') revealAroundDistrict(state, map, d);
      }
    }
    out.expiredModifiers.push(...pruneExpiredModifiers(state, t));
    // One line, two kinds of trainee: villagers land on the population, units
    // in the army, and the caller is told about each separately.
    for (const trainee of advanceTraining(state, t)) {
      if (trainee === 'Villager') out.trainedPopulation += 1;
      else out.trainedUnits.push(trainee);
    }
    // Delve timers NEVER pause: the offline cap limits what the CITY
    // PRODUCES, never what a timer does. A party at a checkpoint proposes no
    // boundary at all — it waits, indefinitely, until the player answers.
    out.delveEvents.push(...advanceDelves(state, t));
    out.scheduleEvents.push(...advanceSchedule(state, t));
  });
}

/** The continuous sims, run only BETWEEN boundaries. */
function runContinuous(state: GameState, map: MapData, t: number, out: AdvanceResult): void {
  advanceRespawns(state, map, t);
  const crew = advanceWorkers(state, map, t);
  out.strikes.push(...crew.strikes);
  out.deposits.push(...crew.deposits);
  out.goldEarned += advanceCityLife(state, t).gold;
  // Mana regen is city idle PRODUCTION, so it belongs here with the workers
  // and the taxes — and the 8h offline cap applies to it, unlike a timer.
  out.manaEarned += accrueMana(state, t);
  out.knowledgeEarned += accrueKnowledge(state, t);
}

/** The earliest moment STRICTLY after `after` at which discrete work falls
 *  due. Adding a source is one `consider()` line. */
function nextBoundary(state: GameState, after: number, builders: number): number {
  let t = Infinity;
  const consider = (at: number | null): void => {
    if (at !== null && at > after && at < t) t = at;
  };
  for (const item of state.city.queue.slice(0, builders)) {
    if (item.startedAt !== null) consider(completesAt(item));
  }
  for (const a of state.research.active) consider(techCompletesAt(state, a.id));
  consider(nextModifierExpiry(state, after));
  consider(nextTrainingCompletion(state, after));
  consider(nextDelveBoundary(state, after));
  consider(nextScheduleBoundary(state, after));
  return t;
}

/** Seatbelt only — see property 1 in the header. A window with this many
 *  genuine boundaries is a content bug, and stopping early beats hanging. */
const MAX_BOUNDARY_STEPS = 10_000;

/**
 * Advance the whole sim from state.lastAdvance to `toTime`. Used verbatim by
 * the live once-per-second tick and by offline replay — see the header above
 * for why those two agree exactly rather than approximately.
 */
export function advance(state: GameState, map: MapData, toTime: number): AdvanceResult {
  const result = emptyResult();
  let cursor = Math.min(state.lastAdvance, toTime);
  const builders = builderCount(state);
  for (let steps = 0; steps < MAX_BOUNDARY_STEPS; steps++) {
    applyDueAt(state, map, cursor, builders, result);
    const next = nextBoundary(state, cursor, builders);
    if (next > toTime) break;
    runContinuous(state, map, next, result);
    cursor = next;
  }
  runContinuous(state, map, toTime, result);
  state.lastAdvance = toTime;
  return result;
}

export { canAfford, collectTap, tapCell, assignableWorkerLimit };
export type { CollectTapResult, TapCellResult };
