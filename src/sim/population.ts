// Population: housing, auto-assigned residents, and the rent each house
// stores for the player to collect.

import { roundPrice } from './roundPrice';
import { relicAuraOver } from './hosts';
import { CITY_DEF, DISTRICTS, TRAINING, levelIndexed } from './data/definitions';
import { districtAdjacency } from './adjacency';
import { recordResourceDiscovery } from './discovery';
import { recordEvent } from './events';
import { techMultiplier, techValue } from './techEffects';
import { effectiveTaxRate, tapWorkSeconds } from './upgrades';
import { storageSpace, storeInto } from './storage';
import { addToWallet, type District, type GameState } from './state';

/**
 * Capacity of ONE district at its CURRENT level (0 = houses nobody).
 *
 * The guard is what makes a bed the tree grants mean what `Communities`
 * always said — *every district that houses anyone*. A district with no
 * capacity table is not a house, and no bonus turns it into one.
 */
export function districtCapacity(state: GameState, district: District): number {
  const list = DISTRICTS[district.definitionId].populationCapacityPerLevel;
  if (list.length === 0) return 0;
  return techValue(state, 'populationCapacity', levelIndexed(list, district.level),
    { district: district.definitionId });
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

/**
 * What this house's LEVEL adds to its residents' rent, as a fraction of the
 * base rate: `Districts.tax_bonus_per_level`, a total at each level.
 *
 * A level fact, so it is read off the building at the base stage and never
 * re-expressed as a modifier — the same rule `armyCapPerLevel` and
 * `strikeSpeedPerLevel` follow. Every building that houses nobody returns 0.
 */
export const houseTaxBonus = (district: District): number => {
  const list = DISTRICTS[district.definitionId].taxBonusPerLevel;
  return list.length === 0 ? 0 : levelIndexed(list, district.level);
};

/**
 * Gold per minute ONE house pays: residents × the rate the tree has left it
 * × what the house's own level adds, plus flat adjacency bonuses and
 * penalties from its built neighbours. Empty (or fully crowded-out) houses
 * pay nothing — clamped at 0.
 *
 * The house is passed to the RATE as well as to the adjacency, which is what
 * makes "+5% gold income at Housing" a thing a technology can say: an aimed
 * effect reaches only the kind of building it names, and an unaimed one every
 * roof. This is the one reader that knows which house is paying.
 *
 * A level's bonus scales the RENT and not the neighbourhood: adjacency is
 * flat Gold a minute, and a crowded row of houses is worth the same −1 each
 * whatever the levels standing in it.
 */
export function houseGoldPerMinute(state: GameState, district: District): number {
  const own = ownGoldPerMinute(state, district);
  const residents = residentsOf(state, district);
  if (residents === 0) return own;
  // A Tribute Crown's aura reaches the house as a whole (sim/hosts.ts).
  const aura = relicAuraOver(state, 'taxRate', district);
  return own + Math.max(0, residents * (effectiveTaxRate(state, district.definitionId) + aura.add) * aura.mul
    * (1 + houseTaxBonus(district))
    + districtAdjacency(state, district));
}

/**
 * The Gold a building makes BY ITSELF a minute at its level, with nobody in
 * it — the Townhall's own income (`buildings.goldPerMinutePerLevel`), so the
 * city always has a source of Gold. 0 for every building that makes none,
 * which is what the checks for "does it pay at all" read.
 */
export const ownGoldBase = (district: District): number => {
  const list = DISTRICTS[district.definitionId].goldPerMinutePerLevel;
  return list.length === 0 ? 0 : levelIndexed(list, district.level);
};

/** …and what it actually makes, after the tree (`ownGold`). A percent of 0
 *  is 0, so a building that makes none still makes none. */
export const ownGoldPerMinute = (state: GameState, district: District): number =>
  techMultiplier(state, 'ownGold') * ownGoldBase(district);

/** City-wide Gold income a minute: every house's rent and the Townhall's own. */
export function cityGoldPerMinute(state: GameState): number {
  let total = 0;
  for (const d of rentPayers(state)) total += houseGoldPerMinute(state, d);
  return total;
}

/** Residents are AUTO-assigned: houses fill in build order, no player input
 *  (which house someone lives in decides only where their rent is stored). */
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

/**
 * Food for the NEXT villager, given how many you already have.
 *
 * Authored for the opening, exponential after it. The first handful of
 * villagers ARE the early game — each one is a decision the player makes
 * minutes apart, and the difference between 5 Food and 20 is the difference
 * between a beat and a formality. No `base × growth^n` can be made to say
 * 5, 20, 100, 300 without deforming everything past it, so it does not try:
 * `city.population_cost_first` lists the authored prices in order, and the
 * curve takes over from the LAST of them, so the two halves meet without a
 * step.
 */
export const populationCost = (currentPopulation: number): number => {
  const authored = CITY_DEF.populationCostFirst;
  if (currentPopulation < authored.length) return authored[currentPopulation];
  const last = authored[authored.length - 1];
  const beyond = currentPopulation - (authored.length - 1);
  return roundPrice(last * CITY_DEF.populationCostGrowth ** beyond);
};

/**
 * Seconds to train the villager who will be number `place` (0-based) — the
 * population plus everyone queued ahead of them. A bigger town takes longer
 * to grow: `training.seconds` for the first, `training.villagerSecondsGrowth`
 * times dearer for each after.
 */
export const villagerTrainSeconds = (place: number): number =>
  Math.max(1, Math.round(TRAINING.seconds * TRAINING.villagerSecondsGrowth ** Math.max(0, place)));

// Villagers used to have their own queue here — `city.training`, a bare count
// with one timestamp. They now share the city's one training line
// (`army.ts`), because they were always the same mechanic wearing different
// clothes: pay up front, wait a duration, one at a time per building. Keeping
// two of them meant two ways to be wrong about capacity, refunds and replay.
//
// `queueTraining` and `trainingCompletesAt` live in `army.ts` now.

// ------------------------------------------------------------------- rent

/**
 * RENT LANDS IN THE HOUSE (Docs/features/03-economy.md §3.2).
 *
 * Each house accrues its own rent, in whole units against its own
 * `rentAnchor`, into its own store — not into the wallet. A tap on the house
 * moves the store to the wallet, free (sim/storage.ts). A full house stops:
 * its anchor follows time instead of banking it, so nothing is owed when the
 * player finally collects. That capacity is the only ceiling on what the
 * neighbourhood makes while the player is away.
 *
 * The Townhall pays the same way, into its own store, from Gold it makes by
 * itself (`ownGoldPerMinute`).
 */

/** What pays Gold into a store right now: built, and with room for anyone or
 *  an income of its own. */
const rentPayers = (state: GameState): District[] =>
  state.city.districts.filter((d) => d.state === 'Built'
    && (districtCapacity(state, d) > 0 || ownGoldBase(d) > 0));

/**
 * A house's rate just changed at `t`: rescale its partial progress since the
 * anchor so the elapsed stretch is not repriced at the new rate. A house that
 * paid nothing before starts paying at `t` — a fresh build, a first resident.
 *
 * `applyDueAt` brackets its whole batch with `repriceTaxAnchorAround`, which
 * means ONE call site covers every boundary kind there will ever be.
 */
function repriceHouse(d: District, t: number, rateBefore: number, rateAfter: number): void {
  if (rateBefore <= 0 || d.rentAnchor === undefined) {
    d.rentAnchor = t;
    return;
  }
  if (rateAfter !== rateBefore && rateAfter > 0) {
    d.rentAnchor = t - ((t - d.rentAnchor) * rateBefore) / rateAfter;
  }
}

/** Run `work` (anything that might move a house's rent) with every house's
 *  anchor repriced across it. */
export function repriceTaxAnchorAround(state: GameState, t: number, work: () => void): void {
  const before = new Map<string, number>();
  for (const d of rentPayers(state)) before.set(d.uniqueId, houseGoldPerMinute(state, d));
  work();
  for (const d of rentPayers(state)) {
    repriceHouse(d, t, before.get(d.uniqueId) ?? 0, houseGoldPerMinute(state, d));
  }
}

/**
 * Advance every house's rent to `toTime`, into its store. Returns the Gold
 * that landed in the stores — made, not yet the player's.
 *
 * A completion is a BOUNDARY, so `advance()` splits the window at it and the
 * repricing runs at the exact instant a rate changed; between boundaries each
 * house's rate is constant, which is what lets one call and many steps agree.
 */
export function advanceCityLife(state: GameState, toTime: number): { gold: number } {
  const result = { gold: 0 };
  for (const d of rentPayers(state)) result.gold += accrueRent(state, d, toTime);
  return result;
}

function accrueRent(state: GameState, d: District, toTime: number): number {
  // A house placed outside `advance()` (a test, a dev grant) starts paying
  // from the last advance; one built inside it was stamped by the repricing.
  const anchor = d.rentAnchor ?? state.lastAdvance;
  const rate = houseGoldPerMinute(state, d);
  const space = storageSpace(state, d);
  if (rate <= 0 || space <= 0) {
    // Nobody pays, or the house is full: no banking.
    d.rentAnchor = Math.max(anchor, toTime);
    return 0;
  }
  const msPerGold = 60_000 / rate;
  const units = Math.floor((toTime - anchor) / msPerGold);
  if (units <= 0) {
    d.rentAnchor = anchor;
    return 0;
  }
  if (units >= space) {
    // Filled inside this stretch: the rest of it is refused, not owed.
    storeInto(d, 'Gold', space);
    d.rentAnchor = toTime;
    return space;
  }
  storeInto(d, 'Gold', units);
  d.rentAnchor = anchor + units * msPerGold;
  return units;
}

/**
 * THE TITHE's pull (Docs/features/09-relics.md §2.1): one tap's worth of this
 * house's rent — `tap.workSeconds` of it — paid straight into the wallet.
 *
 * A house needs no tap to be collected any more, so this is the one place
 * rent is still paid forward, and it mints: an advance against a
 * continuous accrual. It bypasses the store, so a full house is no reason
 * for the spell to fizzle.
 */
export function pullHouseForward(state: GameState, district: District): number {
  const rate = houseGoldPerMinute(state, district);
  if (rate <= 0) return 0;
  const gold = Math.max(1, roundPrice((tapWorkSeconds(state) * rate) / 60));
  addToWallet(state.city.wallet, 'Gold', gold);
  recordResourceDiscovery(state, 'Gold');
  recordEvent(state, { kind: 'collect', currency: 'Gold', amount: gold });
  return gold;
}
