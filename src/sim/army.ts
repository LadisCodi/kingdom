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
//   - The deepest lairs become reachable BY BUILDING rather than by waiting.
//   - Composition costs MAP SPACE: wanting Cavalry means finding room for
//     Stables, so the type chart reaches back into the city-builder instead of
//     living only in a party screen.
//   - Four more districts to place, level and fit under the count caps.
//
// And `train_duration_seconds` — authored per unit since the beginning and
// never once read — becomes live. Instant training stops making sense the
// moment units are expedition capital rather than a quest gate, because it
// removes the only pacing on party size.

import { roundPrice } from './roundPrice';
import { resolve, resolveAt } from './modifiers';
import { techMultiplier } from './techEffects';
import {
  ARMY, DISTRICTS, HEROES, TRAINING, UNITS, levelIndexed,
} from './data/definitions';
import { isTechComplete } from './research';
import {
  maxPopulation, populationCost, repriceTaxAnchorAround, villagerTrainSeconds,
} from './population';
import { adjacencyMultiplier } from './adjacency';
import {
  addToWallet, districtById, getWallet, newId,
  type District, type GameState, type HeroId, type TrainableId, type TrainingItem,
  type UnitId,
} from './state';
import { canAfford, pay } from './wallet';
import { recordEvent } from './events';
import { gemsToFinish } from './rush';
import { skillRank } from './heroes';
import { rankValue } from './skills';

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
/** Soldiers the kingdom owns: at home, and out on the world board — an army
 *  away still holds its places in the halls. */
export const armySize = (state: GameState): number =>
  state.army.length + state.world.armies.reduce((sum, a) => sum + a.troops.reduce((s, t) => s + t.count, 0), 0);

/** Units already paid for but not yet delivered still count against the cap —
 *  otherwise the queue is a way to exceed it. A heal is a whole batch in one
 *  item, so what counts is what it will hand over. */
export const queuedTroops = (state: GameState): number => state.city.trainingQueue
  .filter((i) => i.trainee !== 'Villager')
  .reduce((sum, i) => sum + itemCount(i), 0);

export const committedTroops = (state: GameState): number =>
  armySize(state) + queuedTroops(state);

/**
 * WHO DOES NOT COME BACK.
 *
 * The resolver decides this now, not a formula: a squad that ended the fight
 * with 340 hit points out of 2,000 lost 83 of its hundred, and those 83 are
 * what the roster is charged (Docs/features/combat.md §4, §7). Which is why
 * "a rout costs less than a repulse" needs no rule of its own any more — a
 * party that wins in twenty ticks is simply swung at fewer times.
 *
 * Heroes are never in it: a hero can fall in a fight and is whole again when
 * it ends (Docs/features/10-heroes.md §2.3). What dies here is soldiers.
 */

/**
 * THE INFIRMARY — a building, and the only reason a casualty is ever
 * anything but a death (Docs/features/combat.md §4).
 *
 * Beds are the whole of it: with none, nobody is carried home. So an
 * unbuilt infirmary is not a smaller ward, it is no ward — which is what
 * makes the technology that opens it a real decision rather than a discount.
 */
export const infirmaries = (state: GameState): District[] => state.city.districts
  .filter((d) => d.state === 'Built' && DISTRICTS[d.definitionId].bedsPerLevel.length > 0);

export const woundedCap = (state: GameState): number => Math.floor(infirmaries(state)
  .reduce((beds, d) => beds + levelIndexed(DISTRICTS[d.definitionId].bedsPerLevel, d.level), 0)
  * techMultiplier(state, 'infirmaryBeds'));

/** Soldiers waiting to be put back together, of every type. */
export const woundedCount = (state: GameState): number =>
  Object.values(state.city.wounded).reduce((sum, n) => sum + (n ?? 0), 0);

export const woundedOf = (state: GameState, unitId: UnitId): number =>
  state.city.wounded[unitId] ?? 0;

/** What one fight did to the ranks: everyone who left them, and how many of
 *  those can still be saved. */
export interface Casualties {
  /** Everyone taken off the roster — dead and wounded together. This is what
   *  the party lost, which is what a screen showing squads has to say. */
  losses: Array<{ unitId: UnitId; count: number }>;
  /** The share of them that reached the infirmary. */
  wounded: Array<{ unitId: UnitId; count: number }>;
}

/**
 * WHAT SHARE OF THE FALLEN IS CARRIED HOME (Docs/features/combat.md §4).
 *
 * Ten per cent of its own accord: a battlefield keeps most of what it takes,
 * and the rest is EARNED — the heroes who walk the field afterwards. (The
 * tree raises the BEDS instead, `infirmaryBeds`: a share is bounded, and a
 * bonus has to be able to climb for ever.) Which makes a medic hero worth
 * bringing exactly when a fight is going to be expensive, rather than being
 * a flat bonus nobody chooses against.
 *
 * Capped below one: someone always stays out there.
 */
export const WOUNDED_SHARE_CAP = 0.9;

export function woundedShareFor(state: GameState, heroIds: readonly HeroId[] = []): number {
  // A Field medic in the party carries its points home with it
  // (Docs/features/10-heroes.md §2.5), at its rank; the cap below keeps two
  // from adding up to a fight nobody dies in.
  const fromHeroes = heroIds.reduce((sum, id) => (HEROES[id].skill.id === 'FieldMedic'
    ? sum + rankValue(HEROES[id].skill, skillRank(state, id)) / 100 : sum), 0);
  const share = ARMY.woundedShare + fromHeroes;
  return Math.min(WOUNDED_SHARE_CAP, Math.max(0, share));
}

/**
 * Take them off the roster, and split them.
 *
 * **A casualty is not always a death.** `share` of them come back as wounded
 * and wait in the infirmary until it heals them (`healWounded`); the rest are
 * gone for good. Anything the infirmary has no room for dies with them —
 * which is what makes its capacity a decision rather than a display.
 *
 * The units removed are the plainest ones of their type — a soldier is a
 * soldier, and nothing on an `ArmyUnit` tells them apart — so this is a
 * count, not a choice.
 */
export function applyLosses(
  state: GameState,
  losses: readonly { unitId: UnitId; count: number }[],
  share: number = woundedShareFor(state),
): Casualties {
  const wounded: Array<{ unitId: UnitId; count: number }> = [];
  let room = Math.max(0, woundedCap(state) - woundedCount(state));
  for (const loss of losses) {
    let left = loss.count;
    state.army = state.army.filter((u) => {
      if (left > 0 && u.definitionId === loss.unitId) { left -= 1; return false; }
      return true;
    });
    const saved = Math.min(room, Math.round(loss.count * share));
    if (saved <= 0) continue;
    room -= saved;
    state.city.wounded[loss.unitId] = woundedOf(state, loss.unitId) + saved;
    wounded.push({ unitId: loss.unitId, count: saved });
  }
  return { losses: [...losses], wounded };
}

// ------------------------------------------------------------ putting them back

/** What one item hands over when its clock runs out: a recruit is one soldier,
 *  a heal is however many were put on the table. */
export const itemCount = (item: TrainingItem): number =>
  (item.kind === 'heal' ? Math.max(1, item.count ?? 1) : 1);

/** What it costs to put `count` of a type back on their feet: a fraction of
 *  recruiting them, in the same coins. Cheaper than the funeral. */
export function healCost(
  state: GameState, unitId: UnitId, count: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [c, n] of Object.entries(trainCost(state, unitId))) {
    out[c] = Math.max(1, roundPrice(n * count * ARMY.healCostShare));
  }
  return out;
}

/** And what it costs in time. One wait for the whole batch — an infirmary
 *  works on a ward, not on a queue of beds. */
export const healSeconds = (unitId: UnitId, count: number): number =>
  Math.max(1, Math.round(trainSeconds(unitId) * count * ARMY.healTimeShare));

export type HealResult =
  | 'Queued' | 'NoneWounded' | 'NoBuilding' | 'NotEnoughResources' | 'ArmyAtCapacity';

/**
 * Put wounded soldiers back in the ranks.
 *
 * They go into the hall's own line, behind whatever it is already turning
 * out, because a hall does one thing at a time — and that is the pacing:
 * healing competes with recruiting for the same bench.
 */
export function healWounded(
  state: GameState,
  unitId: UnitId,
  count: number,
  now = 0,
  at?: District,
): HealResult {
  const want = Math.min(Math.max(0, Math.floor(count)), woundedOf(state, unitId));
  if (want <= 0) return 'NoneWounded';
  // Mending happens where the beds are, never at the hall that recruited
  // them: the Infirmary is the building the player built for this.
  const building = at ?? infirmaries(state)[0];
  if (!building || DISTRICTS[building.definitionId].bedsPerLevel.length === 0) return 'NoBuilding';
  if (building.state !== 'Built') return 'NoBuilding';
  // They left the roster when they fell, so they have to fit back into it.
  if (committedTroops(state) + want > armyCap(state)) return 'ArmyAtCapacity';
  const cost = healCost(state, unitId, want);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.city.wounded[unitId] = woundedOf(state, unitId) - want;
  const idle = lineFor(state, building.uniqueId).length === 0;
  const item: TrainingItem = {
    uniqueId: newId(state, `healing_${unitId}`),
    trainee: unitId,
    kind: 'heal',
    count: want,
    buildingId: building.uniqueId,
    startedAt: null,
    seconds: null,
  };
  state.city.trainingQueue.push(item);
  if (idle) startTrainee(state, item, now);
  return 'Queued';
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
  // Colours is a share of what the HALLS provide, so a kingdom with no hall
  // still fields nothing: the line is a bigger banner, not a barracks.
  if (cap === 0) return 0;
  return Math.max(0, Math.round(resolve(state, 'armyCap', cap * techMultiplier(state, 'armyCap'))));
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

/** Whether this building has a bench at all: one that trains, or one that
 *  mends. Both use the same line, one item at a time. */
export const runsALine = (district: District): boolean =>
  trainableAt(district).length > 0
  || DISTRICTS[district.definitionId].bedsPerLevel.length > 0;

/** Seconds on the clock for one trainee, as authored. A villager's is the
 *  FIRST villager's (`villagerTrainSeconds` climbs from it); soldiers carry
 *  their own duration. */
export const trainSeconds = (trainee: TrainableId): number =>
  trainee === 'Villager' ? TRAINING.seconds : UNITS[trainee].trainDurationSeconds;

/**
 * Which villager this one will be (0-based): the population plus every
 * villager queued ahead of `item` — or, with no item, ahead of the next one
 * the player would queue.
 */
export function villagerPlace(state: GameState, item?: TrainingItem): number {
  let ahead = 0;
  for (const i of state.city.trainingQueue) {
    if (i === item) break;
    if (i.trainee === 'Villager') ahead++;
  }
  return state.city.population + ahead;
}

/**
 * Seconds this trainee will take at THIS building — the authored duration,
 * times what the building's neighbours do to `trainTime` (a military quarter
 * trains faster, `03-economy.md` §3.1). A villager's duration also climbs
 * with their place in the town (`villagerPlace`): `item` names which one,
 * and without it the answer is for the next villager queued.
 *
 * Read once, when the clock starts, and stored on the item. A neighbour that
 * arrives or moves later must not reprice a wait already running, which is the
 * same rule research follows for its own time multiplier.
 */
export function trainSecondsAt(
  state: GameState, buildingId: string, trainee: TrainableId, item?: TrainingItem,
): number {
  const building = districtById(state, buildingId);
  const mult = building === undefined ? 1 : adjacencyMultiplier(state, building, 'trainTime');
  // The tree's half is a SPEED the time is divided by, so a rank never meets
  // a floor: Civics trains villagers, Warfare trains soldiers.
  const speed = (trainee === 'Villager'
    ? techMultiplier(state, 'villagerTrainingSpeed')
    : techMultiplier(state, 'recruitSpeed', { unit: trainee }))
    // An awake Winged Hammer round the building (09-relics.md §2): read
    // here, when the clock starts, so a window closing later never reprices
    // a wait already running.
    * (building === undefined ? 1 : Math.max(1, resolveAt(state, 'trainingSpeed', 1, building.location)));
  const base = trainee === 'Villager'
    ? villagerTrainSeconds(villagerPlace(state, item))
    : trainSeconds(trainee);
  return Math.max(1, Math.round((base * mult) / Math.max(1, speed)));
}

/** Start one trainee's clock: the moment, and the duration that goes with it.
 *  A ward full of wounded is one wait, priced by the same neighbours. */
function startTrainee(state: GameState, item: TrainingItem, at: number): void {
  item.startedAt = at;
  item.seconds = item.kind === 'heal'
    ? healSecondsAt(state, item.buildingId, item.trainee as UnitId, itemCount(item))
    : trainSecondsAt(state, item.buildingId, item.trainee, item);
}

/**
 * Seconds a ward of `count` takes to mend at THIS building: the authored
 * share, times what its neighbours do to `trainTime`, divided by the tree's
 * `healSpeed`. Read once, when the mending starts, and stored on the item —
 * a technology finished mid-heal does not reprice the wait already running.
 */
export function healSecondsAt(
  state: GameState, buildingId: string | undefined, unitId: UnitId, count: number,
): number {
  const building = buildingId === undefined ? undefined : districtById(state, buildingId);
  const mult = building === undefined ? 1 : adjacencyMultiplier(state, building, 'trainTime');
  return Math.max(1, Math.round((healSeconds(unitId, count) * mult)
    / Math.max(1, techMultiplier(state, 'healSpeed'))));
}

/** What is on this item's clock: what it was stamped with, or the authored
 *  duration for a pre-30 save that has none. */
export const itemTrainSeconds = (item: TrainingItem): number =>
  item.seconds ?? (item.kind === 'heal'
    ? healSeconds(item.trainee as UnitId, itemCount(item))
    : trainSeconds(item.trainee));

// There is no tap that hurries a trainee along. A queue is a FIXED duration
// and a tap is a scaling one (`tap.workSeconds` x TapPower), so a maxed thumb
// would finish a 20-second villager in a single press. Timers are hurried with
// Gems; Mana buys work, and a queue is not work.

/** What it costs right now. A villager's price climbs with the population —
 *  including the ones already queued, so a queue is never a way to buy at
 *  yesterday's price. */
export function trainCost(state: GameState, trainee: TrainableId): Record<string, number> {
  if (trainee !== 'Villager') {
    // The tree never discounts; the modifier stack still may.
    const mult = Math.max(0, resolve(state, 'recruitCost', 1));
    const out: Record<string, number> = {};
    for (const [c, n] of Object.entries(UNITS[trainee].recruitCost)) {
      out[c] = Math.max(1, roundPrice((n as number) * mult));
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

/** How many one press of Train orders: the card's amount selector. */
export type TrainAmount = 1 | 10 | 100 | 'all';
export const TRAIN_AMOUNTS: readonly TrainAmount[] = [1, 10, 100, 'all'];

/** How many more of a trainee the city has room for: beds for villagers, the
 *  halls' capacity for soldiers. Queued trainees count against both. */
export function trainRoom(state: GameState, trainee: TrainableId): number {
  if (trainee === 'Villager') {
    const pending = state.city.trainingQueue.filter((i) => i.trainee === 'Villager').length;
    return Math.max(0, maxPopulation(state) - state.city.population - pending);
  }
  return Math.max(0, armyCap(state) - committedTroops(state));
}

/** What `count` of a trainee cost, bought one after the other — a villager's
 *  price climbs with every one already on its way. */
export function batchCost(state: GameState, trainee: TrainableId, count: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (trainee === 'Villager') {
    const pending = state.city.trainingQueue.filter((i) => i.trainee === 'Villager').length;
    let food = 0;
    for (let i = 0; i < count; i++) food += populationCost(state.city.population + pending + i);
    out.Food = food;
    return out;
  }
  for (const [c, n] of Object.entries(trainCost(state, trainee))) out[c] = n * count;
  return out;
}

/**
 * What one press of Train orders at `amount`: a fixed amount is the order,
 * whatever the purse says (its price is what the button shows, red where it
 * is short); `all` is as many as both the room and the purse allow — at
 * least one, so a purse that affords none still shows the price of one.
 */
export function trainPlan(
  state: GameState, trainee: TrainableId, amount: TrainAmount,
): { count: number; cost: Record<string, number> } {
  if (amount !== 'all') return { count: amount, cost: batchCost(state, trainee, amount) };
  const room = trainRoom(state, trainee);
  let count = 1;
  while (count < room && canAfford(state.city.wallet, batchCost(state, trainee, count + 1))) count += 1;
  return { count, cost: batchCost(state, trainee, count) };
}

/**
 * Queue `count` of a trainee as ONE order: all of them, or none — the room
 * and the whole price are checked before anything is paid, so a refused
 * order leaves the city as it was.
 */
export function trainBatch(
  state: GameState, trainee: TrainableId, count: number, now = 0, at?: District,
): TrainResult {
  if (count > 1) {
    if (trainRoom(state, trainee) < count) return trainee === 'Villager' ? 'AtMax' : 'ArmyAtCapacity';
    if (!canAfford(state.city.wallet, batchCost(state, trainee, count))) return 'NotEnoughResources';
  }
  const first = trainUnit(state, trainee, now, at);
  if (first !== 'Queued') return first;
  for (let i = 1; i < count; i++) trainUnit(state, trainee, now, at);
  return 'Queued';
}

/** Cancel the LAST unit queued of a type, refunding it in full. */
export type CancelTrainingResult = 'Cancelled' | 'NotFound';

export function cancelTraining(state: GameState, itemId: string): CancelTrainingResult {
  const index = state.city.trainingQueue.findIndex((i) => i.uniqueId === itemId);
  if (index === -1) return 'NotFound';
  const [item] = state.city.trainingQueue.splice(index, 1);
  // A cancelled heal is not a cancelled purchase: the soldiers go back to
  // their beds, and the ward is where they were before the order.
  if (item.kind === 'heal') {
    const unitId = item.trainee as UnitId;
    state.city.wounded[unitId] = woundedOf(state, unitId) + itemCount(item);
    for (const [c, n] of Object.entries(healCost(state, unitId, itemCount(item)))) {
      state.city.wallet[c as keyof typeof state.city.wallet] =
        (state.city.wallet[c as keyof typeof state.city.wallet] ?? 0) + n;
    }
    return 'Cancelled';
  }
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
  item.startedAt === null ? Infinity : item.startedAt + itemTrainSeconds(item) * 1000 - (item.cutMs ?? 0);

/** What is on the bench at this building, if anything. */
export const unitInTraining = (state: GameState, buildingId: string): TrainingItem | undefined =>
  lineFor(state, buildingId)[0];

export function trainingProgress(state: GameState, buildingId: string, now: number): number {
  const item = unitInTraining(state, buildingId);
  if (!item || item.startedAt === null) return 0;
  const total = itemTrainSeconds(item) * 1000;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - item.startedAt + (item.cutMs ?? 0)) / total));
}

/**
 * Complete every unit whose time is up, in completion order, and stamp the
 * next one in each line at the moment its slot actually freed — the same rule
 * `advanceQueue` uses, and what makes a long absence resolve a whole line in
 * one call in true chronological order.
 */
/** One finished trainee, where it came from and when. A heal hands out its
 *  whole batch as that many of these. */
export interface Delivered { trainee: TrainableId; buildingId: string; at: number }

export function advanceTraining(state: GameState, toTime: number): Delivered[] {
  const delivered: Delivered[] = [];
  for (;;) {
    // Stamp the head of every line that has not started. Every BUILT building
    // that trains anything runs a line, which is what put the Townhall's
    // villagers on the same clock as the halls' soldiers.
    for (const d of state.city.districts) {
      if (d.state !== 'Built' || !runsALine(d)) continue;
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

    deliver(state, earliest.trainee, at, itemCount(earliest));
    for (let i = 0; i < itemCount(earliest); i++) {
      delivered.push({ trainee: earliest.trainee, buildingId: earliest.buildingId, at });
    }
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
function deliver(state: GameState, trainee: TrainableId, at: number, count = 1): void {
  if (trainee === 'Villager') {
    // THE ONE RUNTIME WRITER OF `city.population`, which is what makes the
    // `villagers` odometer honest: arrivals are counted here and nowhere
    // else. A second writer would have to announce the same event, or the
    // count would quietly fall short.
    repriceTaxAnchorAround(state, at, () => { state.city.population += count; });
    for (let i = 0; i < count; i++) recordEvent(state, { kind: 'villager' });
    return;
  }
  for (let i = 0; i < count; i++) {
    state.army.push({ uniqueId: newId(state, `unit_${trainee}`), definitionId: trainee });
    recordEvent(state, { kind: 'unitTrained', unit: trainee });
  }
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
      total += item.kind === 'heal'
        ? healSecondsAt(state, buildingId, item.trainee as UnitId, itemCount(item))
        : trainSecondsAt(state, buildingId, item.trainee, item);
    }
  });
  return total;
}

/** Gems to finish the WHOLE line, at the build queue's rate
 *  (`rush.secondsPerGem`). One rule for buying time, wherever the player
 *  meets it. */
export const lineRushCost = (state: GameState, buildingId: string, now: number): number =>
  gemsToFinish(lineRemainingSeconds(state, buildingId, now));

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

/**
 * TAKE `ms` OFF THIS BUILDING'S LINE, at `now` — a speed-up
 * (sim/speedups.ts). The line is one wait: what is left of the head first,
 * and whatever is over goes on to the next, which starts now. A trainee the
 * cut finishes is delivered NOW, never earlier. Returns the milliseconds
 * used; the rest of a speed-up bigger than the line is lost.
 */
export function cutLine(state: GameState, buildingId: string, ms: number, now: number): number {
  let budget = ms;
  let used = 0;
  while (budget > 0) {
    const head = lineFor(state, buildingId)[0];
    if (head === undefined) break;
    if (head.startedAt === null) startTrainee(state, head, now);
    const left = Math.max(0, trainingCompletesAt(head) - now);
    if (budget < left) {
      head.cutMs = (head.cutMs ?? 0) + budget;
      used += budget;
      break;
    }
    state.city.trainingQueue.splice(state.city.trainingQueue.indexOf(head), 1);
    deliver(state, head.trainee, now, itemCount(head));
    budget -= left;
    used += left;
  }
  return used;
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

/**
 * What is available to send.
 *
 * The whole roster: a room resolves the instant it is entered, so no soldier
 * is ever away from home between two fights
 * (Docs/features/11-expeditions.md §5). What leaves the roster leaves it for
 * good — a garrison's casualties
 * (Docs/features/18-garrisons-and-raids.md §5).
 */
export const availableRoster = (state: GameState): Record<UnitId, number> =>
  armyRoster(state);
