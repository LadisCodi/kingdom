// Building stores: what a building has made and the player has not collected
// (Docs/features/03-economy.md §3.2).
//
// A house's rent and a producer's hauls land INSIDE the building, not in the
// wallet. A tap on the building moves the whole store to the wallet, free.
// A store has a capacity by level, and a full store stops its building: a
// house stops accruing rent, a crew stops going out. That capacity is the
// only thing that bounds what the city makes while the player is away —
// there is no offline cap.
//
// What sits in a store is not the player's yet, which is why a raid takes
// from here and never from the wallet (sim/lairs.ts).

import { DISTRICTS, HARVEST, STORAGE, levelIndexed } from './data/definitions';
import { houseGoldPerMinute } from './population';
import { effectiveWorkerStrike, workerStrikeMs } from './upgrades';
import { recordResourceDiscovery } from './discovery';
import { recordEvent } from './events';
import {
  addToWallet, getWallet,
  type CurrencyId, type District, type GameState, type Wallet,
} from './state';

/** Units this building holds at its current level; 0 = it has no store. */
export function storageCapacity(district: District): number {
  const list = DISTRICTS[district.definitionId].storageCapacityPerLevel;
  return list.length === 0 ? 0 : levelIndexed(list, district.level);
}

/** Everything in the store, all currencies together — what the capacity is
 *  measured against. A Quarry keeps Stone and Gold in one store. */
export function storedTotal(district: District): number {
  let total = 0;
  for (const n of Object.values(district.stored ?? {})) total += n ?? 0;
  return total;
}

export const storedOf = (district: District, c: CurrencyId): number =>
  getWallet(district.stored ?? {}, c);

/** Room left before the building stops. Never negative: a haul already on
 *  its way when the store filled lands whole, so a store can sit a load over. */
export const storageSpace = (district: District): number =>
  Math.max(0, storageCapacity(district) - storedTotal(district));

export const isStoreFull = (district: District): boolean =>
  storageCapacity(district) > 0 && storageSpace(district) === 0;

/** Something waits in the store, however little. */
export const hasStored = (district: District): boolean => storedTotal(district) > 0;

/**
 * What the building makes a second right now, in units of its store: a
 * house's rent, or its crew at its main source (the first it works — the
 * coin its bubble and its Storage tile show). The card's *+720/h* over 3600.
 * 0 for a building that is not making anything: no residents, no crew.
 */
export function productionPerSecond(state: GameState, district: District): number {
  const def = DISTRICTS[district.definitionId];
  if (def.populationCapacityPerLevel.length > 0) return houseGoldPerMinute(state, district) / 60;
  if (def.harvestSources.length === 0 || district.assignedWorkers === 0) return 0;
  const spec = HARVEST[def.harvestSources[0]];
  return district.assignedWorkers * effectiveWorkerStrike(state, spec, district)
    * (1000 / workerStrikeMs(state, spec, district));
}

/** Units the store must hold to be ready: `storage.collectSeconds` of what
 *  the building makes now, one at least, never more than the whole store. */
export function collectThreshold(state: GameState, district: District): number {
  const need = Math.max(1, Math.ceil(productionPerSecond(state, district) * STORAGE.collectSeconds));
  const cap = storageCapacity(district);
  return cap === 0 ? need : Math.min(cap, need);
}

/**
 * READY TO COLLECT: its bubble shows, and a tap on it collects instead of
 * opening it. A house makes a coin a second, so "anything in it" would put
 * the bubble back the instant it was collected and the building's own menu
 * would be out of reach for good. It is ready once it holds
 * `storage.collectSeconds` (30) of its current production, or is full — so
 * for half a minute after a collect a tap opens the building. A building that
 * makes nothing now is ready with anything in it.
 */
export function readyToCollect(state: GameState, district: District): boolean {
  const total = storedTotal(district);
  if (total <= 0) return false;
  return isStoreFull(district) || total >= collectThreshold(state, district);
}

/** Put units in the store, uncapped — the caller decides what fits. */
export function storeInto(district: District, c: CurrencyId, amount: number): void {
  if (amount <= 0) return;
  district.stored ??= {};
  addToWallet(district.stored, c, amount);
}

/** Take up to `amount` of one currency out of the store; returns what came out. */
export function takeFromStore(district: District, c: CurrencyId, amount: number): number {
  const took = Math.min(Math.max(0, Math.floor(amount)), storedOf(district, c));
  if (took <= 0) return 0;
  addToWallet(district.stored!, c, -took);
  if (getWallet(district.stored!, c) === 0) delete district.stored![c];
  if (Object.keys(district.stored!).length === 0) delete district.stored;
  return took;
}

/** What every store in the city holds of one currency. */
export function cityStored(state: GameState, c: CurrencyId): number {
  let total = 0;
  for (const d of state.city.districts) total += storedOf(d, c);
  return total;
}

/**
 * Empty the building's store into the wallet. Returns what moved.
 *
 * This is where made things become the player's, so it is where a `collect`
 * is recorded and a currency is first discovered — never at the moment a
 * crew delivers or a house accrues.
 *
 * A house that was FULL restarts its rent at `now`: the anchor stood still
 * while the house was full, and resuming from it would pay rent for the
 * stretch it was refusing it.
 */
export function collectStore(state: GameState, district: District, now: number): Wallet {
  const moved: Wallet = { ...(district.stored ?? {}) };
  if (Object.keys(moved).length === 0) return moved;
  const wasFull = isStoreFull(district);
  delete district.stored;
  for (const [c, n] of Object.entries(moved) as Array<[CurrencyId, number]>) {
    if (n <= 0) continue;
    addToWallet(state.city.wallet, c, n);
    recordResourceDiscovery(state, c);
    recordEvent(state, { kind: 'collect', currency: c, amount: n });
  }
  if (wasFull && district.rentAnchor !== undefined) {
    district.rentAnchor = Math.max(district.rentAnchor, now);
  }
  return moved;
}
