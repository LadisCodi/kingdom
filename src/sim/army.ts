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

import { ARMY, DISTRICTS, TAP, TRAINING, UNITS, levelIndexed } from './data/definitions';
import { payMana } from './mana';
import { isTechComplete } from './research';
import {
  cityGoldPerMinute, maxPopulation, populationCost, repriceTaxAnchor,
} from './population';
import {
  newId, type District, type GameState, type TrainableId, type TrainingItem, type UnitId,
} from './state';
import { canAfford, pay } from './wallet';

export const armyPower = (state: GameState): number =>
  state.army.reduce((sum, u) => sum + UNITS[u.definitionId].power, 0);

/** Units already paid for but not yet delivered still count against the cap —
 *  otherwise the queue is a way to exceed it. */
export const queuedArmyPower = (state: GameState): number =>
  state.city.trainingQueue.reduce(
    (sum, i) => sum + (i.trainee === 'Villager' ? 0 : UNITS[i.trainee].power), 0);

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

/** The built building that trains `trainee`, if the player has one. A building
 *  lists everything it can turn out, so one hall can offer several. */
export const trainerFor = (state: GameState, trainee: TrainableId): District | undefined =>
  state.city.districts.find(
    (d) => d.state === 'Built' && DISTRICTS[d.definitionId].trains.includes(trainee),
  );

/** Everything this building can turn out — the UNITS row on its card. */
export const trainableAt = (district: District): readonly TrainableId[] =>
  DISTRICTS[district.definitionId].trains;

/** Seconds on the clock for one trainee. Villagers are authored once in
 *  Settings; soldiers carry their own duration. */
export const trainSeconds = (trainee: TrainableId): number =>
  trainee === 'Villager' ? TRAINING.seconds : UNITS[trainee].trainDurationSeconds;

/** Seconds one tap hurries a trainee along. Authored separately for villagers
 *  and soldiers, and it stays that way: the two are tuned against different
 *  durations, and one shared number would silently reprice whichever was not
 *  being thought about. */
export const tapBoostSeconds = (trainee: TrainableId): number =>
  trainee === 'Villager' ? TRAINING.tapBoostSeconds : ARMY.trainTapBoostSeconds;

/** What it costs right now. A villager's price climbs with the population —
 *  including the ones already queued, so a queue is never a way to buy at
 *  yesterday's price. */
export function trainCost(state: GameState, trainee: TrainableId): Record<string, number> {
  if (trainee !== 'Villager') return UNITS[trainee].recruitCost;
  const pending = state.city.trainingQueue.filter((i) => i.trainee === 'Villager').length;
  return { Food: populationCost(state.city.population + pending) };
}

export type TrainResult =
  | 'Queued' | 'NotEnoughResources' | 'ArmyAtCapacity' | 'AtMax'
  | 'TechRequired' | 'NoBuilding';

/**
 * Queue one unit. Cost is paid UP FRONT, exactly as villager training is, so
 * a queue can never be a way to reserve capacity you cannot afford.
 */
export function trainUnit(
  state: GameState,
  trainee: TrainableId,
  now = 0,
  /** Which hall to queue at. Only matters once two buildings can turn out the
   *  same unit — the Barracks and a Spear Hall both make Lancers — and then it
   *  matters a lot: the player pressed TRAIN on a specific card, and putting
   *  the unit in some other building's line would be answering a different
   *  question. Omitted, the first hall that can is used. */
  at?: District,
): TrainResult {
  if (trainee !== 'Villager') {
    const def = UNITS[trainee];
    if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return 'TechRequired';
  }
  const building = at ?? trainerFor(state, trainee);
  if (!building || !DISTRICTS[building.definitionId].trains.includes(trainee)) return 'NoBuilding';
  if (building.state !== 'Built') return 'NoBuilding';
  // Two different ceilings, because they are two different scarcities: an army
  // is bounded by the halls that hold it, a population by the beds it sleeps
  // in. Queued trainees count against both — a queue must never be a way to
  // exceed a cap you have not built for.
  if (trainee === 'Villager') {
    const pending = state.city.trainingQueue.filter((i) => i.trainee === 'Villager').length;
    if (state.city.population + pending >= maxPopulation(state)) return 'AtMax';
  } else if (committedArmyPower(state) + UNITS[trainee].power > maxArmyPower(state)) {
    return 'ArmyAtCapacity';
  }
  const cost = trainCost(state, trainee);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  // A trainee that walks straight to the front starts its clock NOW, not at
  // the next boundary. The advance would stamp it a tick later and nothing
  // much would change — except that tapping to hurry an item which has not
  // started is refused, so the player would meet a Townhall that says
  // "nothing training" the instant after they queued something.
  const idle = lineFor(state, building.uniqueId).length === 0;
  state.city.trainingQueue.push({
    uniqueId: newId(state, `training_${trainee}`),
    trainee,
    buildingId: building.uniqueId,
    startedAt: idle ? now : null,
  });
  return 'Queued';
}

/** Cancel the LAST unit queued of a type, refunding it in full. */
export type CancelTrainingResult = 'Cancelled' | 'NotFound';

export function cancelTraining(state: GameState, itemId: string): CancelTrainingResult {
  const index = state.city.trainingQueue.findIndex((i) => i.uniqueId === itemId);
  if (index === -1) return 'NotFound';
  const [item] = state.city.trainingQueue.splice(index, 1);
  // Refunded at what it COST, which for a villager is the price at its place
  // in the line — recomputed after the splice, so it matches what was paid.
  for (const [c, n] of Object.entries(trainCost(state, item.trainee))) {
    state.city.wallet[c as keyof typeof state.city.wallet] =
      (state.city.wallet[c as keyof typeof state.city.wallet] ?? 0) + n;
  }
  return 'Cancelled';
}

// ------------------------------------------------------------ the training line

/** Each BUILDING trains one at a time, so every hall is its own line running
 *  in parallel — which is another reason to want all of them. */
export const lineFor = (state: GameState, buildingId: string): TrainingItem[] =>
  state.city.trainingQueue.filter((i) => i.buildingId === buildingId);

export const trainingCompletesAt = (item: TrainingItem): number =>
  item.startedAt === null ? Infinity : item.startedAt + trainSeconds(item.trainee) * 1000;

/** What is on the bench at this building, if anything. */
export const unitInTraining = (state: GameState, buildingId: string): TrainingItem | undefined =>
  lineFor(state, buildingId)[0];

export function trainingProgress(state: GameState, buildingId: string, now: number): number {
  const item = unitInTraining(state, buildingId);
  if (!item || item.startedAt === null) return 0;
  const total = trainSeconds(item.trainee) * 1000;
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
  item.startedAt -= tapBoostSeconds(item.trainee) * 1000;
  return advanceTraining(state, now).length > 0 ? 'Complete' : 'Boosted';
}

/**
 * Complete every unit whose time is up, in completion order, and stamp the
 * next one in each line at the moment its slot actually freed — the same rule
 * `advanceQueue` uses, and what makes a long absence resolve a whole line in
 * one call in true chronological order.
 */
export function advanceTraining(state: GameState, toTime: number): TrainableId[] {
  const delivered: TrainableId[] = [];
  for (;;) {
    // Stamp the head of every line that has not started. Every BUILT building
    // that trains anything runs a line, which is what put the Townhall's
    // villagers on the same clock as the halls' soldiers.
    for (const d of state.city.districts) {
      if (d.state !== 'Built' || trainableAt(d).length === 0) continue;
      const head = lineFor(state, d.uniqueId)[0];
      if (head && head.startedAt === null) head.startedAt = toTime;
    }
    let earliest: TrainingItem | null = null;
    for (const item of state.city.trainingQueue) {
      const at = trainingCompletesAt(item);
      if (at <= toTime && (earliest === null || at < trainingCompletesAt(earliest))) {
        earliest = item;
      }
    }
    if (earliest === null) return delivered;
    const at = trainingCompletesAt(earliest);
    state.city.trainingQueue.splice(state.city.trainingQueue.indexOf(earliest), 1);

    if (earliest.trainee === 'Villager') {
      // A new villager changes the tax RATE from this instant, so the anchor
      // has to be repriced at `at` and not at the end of the window — the
      // property one-call replay parity rests on.
      const rateBefore = cityGoldPerMinute(state);
      state.city.population += 1;
      repriceTaxAnchor(state, at, rateBefore);
    } else {
      state.army.push({
        uniqueId: newId(state, `unit_${earliest.trainee}`),
        definitionId: earliest.trainee,
      });
    }
    delivered.push(earliest.trainee);
    // The next in THAT line starts when the slot freed, not at `toTime`.
    const next = lineFor(state, earliest.buildingId)[0];
    if (next && next.startedAt === null) next.startedAt = at;
  }
}

/** A boundary source: the next unit to appear. */
export function nextTrainingCompletion(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const item of state.city.trainingQueue) {
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
