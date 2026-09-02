// The army: what it costs to keep, what raises the ceiling, and how long a
// unit takes to appear (Docs/features/expeditions.md §6, balancing-v2 Part 2).
//
// Two things changed here, and they are the same change from two directions.
//
// `army.power_cap_per_townhall_level = [10, 20, 30]` is RETIRED. Army size was
// a passive consequence of a gate the player was going to pass anyway; it is
// now a city-building decision. Each unit type is trained by its own building,
// and building and upgrading them is what raises the cap. Three things fall
// out of that, which is why it was worth doing:
//
//   - The deepest ruins become reachable BY BUILDING rather than by waiting.
//   - Composition costs MAP SPACE: wanting Cavalry means finding room for
//     Stables, so the type chart reaches back into the city-builder instead of
//     living only in a party screen.
//   - Four more districts to place, level and fit under the count caps.
//
// And `train_duration_seconds` — authored per unit since the beginning and
// never once read — becomes live. Instant training stops making sense the
// moment units are expedition capital rather than a quest gate, because it
// removes the only pacing on party size.

import { ARMY, DISTRICTS, TAP, UNITS, levelIndexed } from './data/definitions';
import { payMana } from './mana';
import { isTechComplete } from './research';
import {
  newId, type District, type GameState, type UnitId,
} from './state';
import { canAfford, pay } from './wallet';

export const armyPower = (state: GameState): number =>
  state.army.reduce((sum, u) => sum + UNITS[u.definitionId].power, 0);

/** Units already paid for but not yet delivered still count against the cap —
 *  otherwise the queue is a way to exceed it. */
export const queuedArmyPower = (state: GameState): number =>
  state.city.armyQueue.reduce((sum, i) => sum + UNITS[i.unitId].power, 0);

export const committedArmyPower = (state: GameState): number =>
  armyPower(state) + queuedArmyPower(state);

/** The military buildings, in city order. */
export const militaryBuildings = (state: GameState): District[] =>
  state.city.districts.filter((d) => DISTRICTS[d.definitionId].armyCapPerLevel.length > 0);

/** Σ over BUILT military buildings of their cap at their current level. The
 *  contribution is a TOTAL per level, not an increment. */
export function maxArmyPower(state: GameState): number {
  let cap = 0;
  for (const d of militaryBuildings(state)) {
    if (d.state !== 'Built') continue;
    cap += levelIndexed(DISTRICTS[d.definitionId].armyCapPerLevel, d.level);
  }
  return cap;
}

/** The built building that trains `unitId`, if the player has one. */
export const trainerFor = (state: GameState, unitId: UnitId): District | undefined =>
  state.city.districts.find(
    (d) => d.state === 'Built' && DISTRICTS[d.definitionId].trains === unitId,
  );

export type TrainResult =
  | 'Queued' | 'NotEnoughResources' | 'ArmyAtCapacity' | 'TechRequired' | 'NoBuilding';

/**
 * Queue one unit. Cost is paid UP FRONT, exactly as villager training is, so
 * a queue can never be a way to reserve capacity you cannot afford.
 */
export function trainUnit(state: GameState, unitId: UnitId): TrainResult {
  const def = UNITS[unitId];
  if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return 'TechRequired';
  const building = trainerFor(state, unitId);
  if (!building) return 'NoBuilding';
  if (committedArmyPower(state) + def.power > maxArmyPower(state)) return 'ArmyAtCapacity';
  if (!canAfford(state.city.wallet, def.recruitCost)) return 'NotEnoughResources';
  pay(state.city.wallet, def.recruitCost);
  state.city.armyQueue.push({
    uniqueId: newId(state, `training_${unitId}`),
    unitId,
    buildingId: building.uniqueId,
    startedAt: null,
  });
  return 'Queued';
}

/** Cancel the LAST unit queued of a type, refunding it in full. */
export type CancelTrainingResult = 'Cancelled' | 'NotFound';

export function cancelTraining(state: GameState, itemId: string): CancelTrainingResult {
  const index = state.city.armyQueue.findIndex((i) => i.uniqueId === itemId);
  if (index === -1) return 'NotFound';
  const [item] = state.city.armyQueue.splice(index, 1);
  for (const [c, n] of Object.entries(UNITS[item.unitId].recruitCost)) {
    state.city.wallet[c as keyof typeof state.city.wallet] =
      (state.city.wallet[c as keyof typeof state.city.wallet] ?? 0) + n;
  }
  return 'Cancelled';
}

// ------------------------------------------------------------ the training line

/** Each BUILDING trains one unit at a time, so the four military buildings are
 *  four parallel lines — which is another reason to want all of them. */
const lineFor = (state: GameState, buildingId: string) =>
  state.city.armyQueue.filter((i) => i.buildingId === buildingId);

export const trainingCompletesAt = (item: { startedAt: number | null; unitId: UnitId }): number =>
  item.startedAt === null
    ? Infinity
    : item.startedAt + UNITS[item.unitId].trainDurationSeconds * 1000;

/** The unit currently in training at this building, if any. */
export const unitInTraining = (state: GameState, buildingId: string) =>
  lineFor(state, buildingId)[0];

export function trainingProgress(state: GameState, buildingId: string, now: number): number {
  const item = unitInTraining(state, buildingId);
  if (!item || item.startedAt === null) return 0;
  const total = UNITS[item.unitId].trainDurationSeconds * 1000;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - item.startedAt) / total));
}

export type TrainingTapResult = 'Boosted' | 'Complete' | 'NoTraining' | 'NoMana';

/** Tap a military building to hurry the unit in training — the same beat the
 *  Townhall already has for villagers, so buildings behave consistently.
 *
 *  Costs energy for the same reason every other hurrying tap does, and only
 *  once there is something to hurry. */
export function trainingTap(
  state: GameState,
  building: District,
  now: number,
): TrainingTapResult {
  const item = unitInTraining(state, building.uniqueId);
  if (!item || item.startedAt === null) return 'NoTraining';
  if (!payMana(state, TAP.manaCost)) return 'NoMana';
  item.startedAt -= ARMY.trainTapBoostSeconds * 1000;
  return advanceArmyTraining(state, now).length > 0 ? 'Complete' : 'Boosted';
}

/**
 * Complete every unit whose time is up, in completion order, and stamp the
 * next one in each line at the moment its slot actually freed — the same rule
 * `advanceQueue` uses, and what makes a long absence resolve a whole line in
 * one call in true chronological order.
 */
export function advanceArmyTraining(state: GameState, toTime: number): UnitId[] {
  const delivered: UnitId[] = [];
  for (;;) {
    // Stamp the head of every line that has not started.
    for (const d of militaryBuildings(state)) {
      const head = lineFor(state, d.uniqueId)[0];
      if (head && head.startedAt === null && d.state === 'Built') head.startedAt = toTime;
    }
    let earliest: (typeof state.city.armyQueue)[number] | null = null;
    for (const item of state.city.armyQueue) {
      const at = trainingCompletesAt(item);
      if (at <= toTime && (earliest === null || at < trainingCompletesAt(earliest))) {
        earliest = item;
      }
    }
    if (earliest === null) return delivered;
    const at = trainingCompletesAt(earliest);
    state.city.armyQueue.splice(state.city.armyQueue.indexOf(earliest), 1);
    state.army.push({ uniqueId: newId(state, `unit_${earliest.unitId}`), definitionId: earliest.unitId });
    delivered.push(earliest.unitId);
    // The next unit in THAT line starts when the slot freed, not at `toTime`.
    const next = lineFor(state, earliest.buildingId)[0];
    if (next && next.startedAt === null) next.startedAt = at;
  }
}

/** A boundary source: the next unit to appear. */
export function nextTrainingCompletion(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const item of state.city.armyQueue) {
    const at = trainingCompletesAt(item);
    if (!Number.isFinite(at) || at <= after) continue;
    if (best === null || at < best) best = at;
  }
  return best;
}

// ------------------------------------------------------------ what you own

/** How many of each type are standing in the city right now. */
export function armyRoster(state: GameState): Record<UnitId, number> {
  const roster = { Warrior: 0, Lancer: 0, Archer: 0, Cavalry: 0 };
  for (const u of state.army) roster[u.definitionId] += 1;
  return roster;
}

/** Units committed to a delve are not at home; this is what is available to
 *  send somewhere else. */
export function availableRoster(state: GameState): Record<UnitId, number> {
  const roster = armyRoster(state);
  for (const delve of state.delves) {
    for (const slot of delve.party) roster[slot.unitId] -= slot.count;
  }
  return roster;
}
