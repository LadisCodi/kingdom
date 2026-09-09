// The army: what it costs to keep, what raises the ceiling, and how long a
// unit takes to appear (Docs/features/11-expeditions.md §6, Docs/features/11-expeditions.md §6).
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

import { resolve } from './modifiers';
import { techValue } from './techEffects';
import { DISTRICTS, RUSH, TRAINING, UNITS, levelIndexed } from './data/definitions';
import { isTechComplete } from './research';
import {
  cityGoldPerMinute, maxPopulation, populationCost, repriceTaxAnchor,
} from './population';
import { adjacencyMultiplier } from './adjacency';
import {
  addToWallet, districtById, getWallet, newId,
  type District, type GameState, type TrainableId, type TrainingItem, type UnitId,
} from './state';
import { canAfford, pay } from './wallet';

/**
 * THE ARMY CAP IS A HEADCOUNT (Docs/features/combat.md §14).
 *
 * It counts TROOPS OWNED, not what they are worth: a Cavalry takes one place
 * in the barracks and a Warrior takes one, and `power` decides what each is
 * worth in the FIGHT and nowhere else. It used to be a power budget, which
 * read as the same thing and was not: at six points a level, a first Barracks
 * held two Warriors, and every number a player saw on this system was a
 * single digit in a game about fielding companies.
 */
export const armySize = (state: GameState): number => state.army.length;

/** Units already paid for but not yet delivered still count against the cap —
 *  otherwise the queue is a way to exceed it. */
export const queuedTroops = (state: GameState): number =>
  state.city.trainingQueue.filter((i) => i.trainee !== 'Villager').length;

export const committedTroops = (state: GameState): number =>
  armySize(state) + queuedTroops(state);

/**
 * WHO DOES NOT COME BACK.
 *
 * A garrison fights back, so a gate costs soldiers whether it falls or not
 * (Docs/features/18-garrisons-and-raids.md §5). The damage is spread across
 * the committed squads by their share of the party's own hit points — the
 * biggest squad takes the most, which is what makes a wide party a way of
 * absorbing a fight as well as winning it — and only whole troops are lost.
 *
 * Heroes are never in it: a hero can fall in a fight and is whole again when
 * it ends (Docs/features/10-heroes.md §2.3). What dies here is soldiers.
 */
export function casualtiesFor(
  slots: readonly { unitId: UnitId; count: number }[],
  damage: number,
): Array<{ unitId: UnitId; count: number }> {
  const totalHp = slots.reduce((sum, s) => sum + UNITS[s.unitId].hp * s.count, 0);
  if (totalHp <= 0 || damage <= 0) return [];
  const out: Array<{ unitId: UnitId; count: number }> = [];
  for (const slot of slots) {
    const hp = UNITS[slot.unitId].hp;
    const share = (hp * slot.count) / totalHp;
    const lost = Math.min(slot.count, Math.floor((damage * share) / hp));
    if (lost > 0) out.push({ unitId: slot.unitId, count: lost });
  }
  // A fight that killed nobody still killed somebody: the smallest loss the
  // game can express is one soldier, taken from the biggest squad.
  if (out.length === 0) {
    const biggest = [...slots].sort((a, b) => b.count - a.count)[0];
    if (biggest !== undefined && biggest.count > 0) out.push({ unitId: biggest.unitId, count: 1 });
  }
  return out;
}

/** Take them off the roster. The units removed are the plainest ones of their
 *  type — a soldier is a soldier, and nothing on an `ArmyUnit` tells them
 *  apart — so this is a count, not a choice. */
export function takeCasualties(
  state: GameState,
  slots: readonly { unitId: UnitId; count: number }[],
  damage: number,
): Array<{ unitId: UnitId; count: number }> {
  const losses = casualtiesFor(slots, damage);
  for (const loss of losses) {
    let left = loss.count;
    state.army = state.army.filter((u) => {
      if (left > 0 && u.definitionId === loss.unitId) { left -= 1; return false; }
      return true;
    });
  }
  return losses;
}

/** The military buildings, in city order. */
export const militaryBuildings = (state: GameState): District[] =>
  state.city.districts.filter((d) => DISTRICTS[d.definitionId].armyCapPerLevel.length > 0);

/** Σ over BUILT military buildings of their cap at their current level, in
 *  TROOPS. The contribution is a TOTAL per level, not an increment. */
export function armyCap(state: GameState): number {
  let cap = 0;
  for (const d of militaryBuildings(state)) {
    if (d.state !== 'Built') continue;
    cap += levelIndexed(DISTRICTS[d.definitionId].armyCapPerLevel, d.level);
  }
  // Colours adds to the cap the HALLS provide, so a kingdom with no hall still
  // fields nothing: the line is a bigger banner, not a barracks of its own.
  if (cap === 0) return 0;
  return Math.max(0, Math.round(resolve(state, 'armyCap', techValue(state, 'armyCap', cap))));
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

/** Seconds on the clock for one trainee, as authored. Villagers are authored
 *  once in Settings; soldiers carry their own duration. */
export const trainSeconds = (trainee: TrainableId): number =>
  trainee === 'Villager' ? TRAINING.seconds : UNITS[trainee].trainDurationSeconds;

/**
 * Seconds this trainee will take at THIS building — the authored duration,
 * times what the building's neighbours do to `trainTime` (a military quarter
 * trains faster, `03-economy.md` §3.1).
 *
 * Read once, when the clock starts, and stored on the item. A neighbour that
 * arrives or moves later must not reprice a wait already running, which is the
 * same rule research follows for its own time multiplier.
 */
export function trainSecondsAt(state: GameState, buildingId: string, trainee: TrainableId): number {
  const building = districtById(state, buildingId);
  const mult = building === undefined ? 1 : adjacencyMultiplier(state, building, 'trainTime');
  return Math.max(1, Math.round(trainSeconds(trainee) * mult));
}

/** Start one trainee's clock: the moment, and the duration that goes with it. */
function startTrainee(state: GameState, item: TrainingItem, at: number): void {
  item.startedAt = at;
  item.seconds = trainSecondsAt(state, item.buildingId, item.trainee);
}

/** What is on this item's clock: what it was stamped with, or the authored
 *  duration for a pre-30 save that has none. */
export const itemTrainSeconds = (item: TrainingItem): number =>
  item.seconds ?? trainSeconds(item.trainee);

// There is no tap that hurries a trainee along. A queue is a FIXED duration
// and a tap is a scaling one (`tap.workSeconds` x TapPower), so a maxed thumb
// would finish a 20-second villager in a single press. Timers are hurried with
// Gems; Mana buys work, and a queue is not work.

/** What it costs right now. A villager's price climbs with the population —
 *  including the ones already queued, so a queue is never a way to buy at
 *  yesterday's price. */
export function trainCost(state: GameState, trainee: TrainableId): Record<string, number> {
  if (trainee !== 'Villager') {
    // Muster Drill: −10%/rank on every coin of the recruit price, floor 1.
    const mult = Math.max(0, resolve(state, 'recruitCost',
      techValue(state, 'recruitCost', 1)));
    const out: Record<string, number> = {};
    for (const [c, n] of Object.entries(UNITS[trainee].recruitCost)) {
      out[c] = Math.max(1, Math.round((n as number) * mult));
    }
    return out;
  }
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
  } else if (committedTroops(state) + 1 > armyCap(state)) {
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
  const item: TrainingItem = {
    uniqueId: newId(state, `training_${trainee}`),
    trainee,
    buildingId: building.uniqueId,
    startedAt: null,
    seconds: null,
  };
  state.city.trainingQueue.push(item);
  if (idle) startTrainee(state, item, now);
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
  item.startedAt === null ? Infinity : item.startedAt + itemTrainSeconds(item) * 1000;

/** What is on the bench at this building, if anything. */
export const unitInTraining = (state: GameState, buildingId: string): TrainingItem | undefined =>
  lineFor(state, buildingId)[0];

export function trainingProgress(state: GameState, buildingId: string, now: number): number {
  const item = unitInTraining(state, buildingId);
  if (!item || item.startedAt === null) return 0;
  const total = itemTrainSeconds(item) * 1000;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - item.startedAt) / total));
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
      if (head && head.startedAt === null) startTrainee(state, head, toTime);
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

    deliver(state, earliest.trainee, at);
    delivered.push(earliest.trainee);
    // The next in THAT line starts when the slot freed, not at `toTime`.
    const next = lineFor(state, earliest.buildingId)[0];
    if (next && next.startedAt === null) startTrainee(state, next, at);
  }
}

/**
 * Hand over one finished trainee.
 *
 * A new villager changes the tax RATE from this instant, so the anchor is
 * repriced at `at` rather than at the end of whatever window we are in — the
 * property one-call replay parity rests on. Shared with the gem rush, so a
 * bought unit lands by exactly the same path as a waited-for one.
 */
function deliver(state: GameState, trainee: TrainableId, at: number): void {
  if (trainee === 'Villager') {
    const rateBefore = cityGoldPerMinute(state);
    state.city.population += 1;
    repriceTaxAnchor(state, at, rateBefore);
    return;
  }
  state.army.push({ uniqueId: newId(state, `unit_${trainee}`), definitionId: trainee });
}

// ------------------------------------------------------------- buying the wait

/** Seconds until this building's line is empty: what is left on the bench plus
 *  the full duration of everyone behind it. */
export function lineRemainingSeconds(
  state: GameState, buildingId: string, now: number,
): number {
  let total = 0;
  lineFor(state, buildingId).forEach((item, i) => {
    if (i === 0 && item.startedAt !== null) {
      total += Math.max(0, (trainingCompletesAt(item) - now) / 1000);
    } else {
      // Not started, so not stamped: it will be priced by the neighbours
      // standing there when its turn comes.
      total += trainSecondsAt(state, buildingId, item.trainee);
    }
  });
  return total;
}

/** Gems to finish the WHOLE line, at the build queue's rate
 *  (`rush.secondsPerGem`). One rule for buying time, wherever the player
 *  meets it. */
export const lineRushCost = (state: GameState, buildingId: string, now: number): number =>
  Math.max(1, Math.ceil(lineRemainingSeconds(state, buildingId, now) / RUSH.secondsPerGem));

export type RushTrainingResult = 'Success' | 'NothingTraining' | 'NotEnoughGems';

export function finishLineWithGems(
  state: GameState, buildingId: string, now: number,
): RushTrainingResult {
  const line = lineFor(state, buildingId);
  if (line.length === 0) return 'NothingTraining';
  const cost = lineRushCost(state, buildingId, now);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  // Out of the queue FIRST, so a concurrent advance cannot deliver them twice.
  state.city.trainingQueue = state.city.trainingQueue.filter(
    (i) => i.buildingId !== buildingId);
  for (const item of line) deliver(state, item.trainee, now);
  return 'Success';
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
