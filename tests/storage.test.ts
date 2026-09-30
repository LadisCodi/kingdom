// Building stores (Docs/features/03-economy.md §3.2): what a building makes
// waits inside it until the player taps it. The claims protected here:
//
//  1. A FULL store stops its building — a crew waits by the door — and an
//     empty one sets it going again, from the tap, never retroactively.
//  2. A haul already on its way lands WHOLE, even over the capacity: matter
//     that left the ground is never destroyed.
//  3. Collecting is where made things become the player's: the wallet, the
//     discovery and the `collect` a quest counts all move there and only there.
//  4. What is in the wallet is safe: a raid takes from the stores.
import { describe, expect, it } from 'vitest';
import { advance, changeWorkers, collectBuilding, enqueueBuild } from '../src/sim/commands';
import { DISTRICTS, HARVEST, LAIRS, STORAGE, WORKER } from '../src/sim/data/definitions';
import { tally } from '../src/sim/events';
import {
  collectThreshold, isStoreFull, productionPerSecond, readyToCollect, storageCapacity, storedOf, storedTotal,
} from '../src/sim/storage';
import { getWallet, type GameState } from '../src/sim/state';
import { completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

const SAWMILL_CELL = { x: 3, y: 1 };
const FOREST = { x: 3, y: 2 }; // next door
const MOVE_MS = (1 / WORKER.moveSpeedTilesPerSecond) * 1000;
const STRIKE_MS = HARVEST.Forest.secondsPerStrike * 1000;
const CYCLE_MS = 2 * MOVE_MS + STRIKE_MS;

/** A level-1 Sawmill next to one tree, crewed by one worker at T0 + 30 s. */
function crewedSawmill(): { state: GameState; mill: GameState['city']['districts'][number]; start: number } {
  const state = freshGame();
  fund(state, { Gold: 500, Wood: 500 });
  completeTech(state, 'Forestry');
  completeTech(state, 'Saws');
  state.fog.revealed = {};
  state.fog.discovered = {};
  reveal(state, [SAWMILL_CELL, FOREST]);
  expect(enqueueBuild(state, map, 'Sawmill', SAWMILL_CELL)).toBe('Started');
  tickAt(state, T0);
  tickAt(state, T0 + 30_000);
  const mill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
  state.city.population = 1;
  const start = state.lastAdvance;
  expect(changeWorkers(state, map, mill.uniqueId, 1, start)).toBe('Assigned');
  return { state, mill, start };
}

describe('a store', () => {
  it('has a capacity by level on everything that makes Gold or harvests, and nothing else', () => {
    for (const def of Object.values(DISTRICTS)) {
      const makes = def.populationCapacityPerLevel.length > 0 || def.harvestSources.length > 0;
      expect(def.storageCapacityPerLevel.length > 0, def.id).toBe(makes);
    }
  });

  it('is ready to collect at 30 seconds of what it makes, so the next tap after a collect opens the building', () => {
    const { state, mill } = crewedSawmill();
    const need = collectThreshold(state, mill);
    expect(need).toBe(Math.ceil(productionPerSecond(state, mill) * STORAGE.collectSeconds));
    expect(STORAGE.collectSeconds).toBe(30);
    mill.stored = { Wood: need - 1 };
    expect(readyToCollect(state, mill)).toBe(false); // a tap opens it
    mill.stored = { Wood: need };
    expect(readyToCollect(state, mill)).toBe(true); // a tap collects
    // A second worker makes twice as much, so it asks for twice as much.
    mill.assignedWorkers = 2;
    expect(collectThreshold(state, mill)).toBe(Math.ceil(2 * productionPerSecond(state, { ...mill, assignedWorkers: 1 }) * 30));
  });

  it('with nothing being made, anything in it is ready', () => {
    const { state, mill } = crewedSawmill();
    mill.assignedWorkers = 0;
    mill.stored = { Wood: 1 };
    expect(readyToCollect(state, mill)).toBe(true);
  });

  it('a full store keeps the crew at the door, and a haul on its way still lands whole', () => {
    const { state, mill, start } = crewedSawmill();
    const cap = storageCapacity(state, mill);
    // One short of full: the load being struck now tips it over.
    mill.stored = { Wood: cap - 1 };
    tickAt(state, start + MOVE_MS + STRIKE_MS + 100);
    const w = state.workers[0];
    expect(w.activity).toBe('MovingHome');
    const load = w.carrying;
    expect(load).toBeGreaterThan(0);
    tickAt(state, start + CYCLE_MS + 100);
    expect(storedOf(mill, 'Wood')).toBe(cap - 1 + load); // nothing destroyed
    expect(isStoreFull(state, mill)).toBe(true);
    // …and nobody sets out again while it is full.
    expect(w.activity).toBe('Idle');
    expect(w.claimedCell).toBeNull();
    const units = state.harvest['3,2']?.units;
    tickAt(state, start + CYCLE_MS + 10 * 60_000);
    expect(w.activity).toBe('Idle');
    expect(state.harvest['3,2']?.units).toBe(units);
  });

  it('collecting empties it into the wallet and sets the crew going from the tap', () => {
    const { state, mill, start } = crewedSawmill();
    mill.stored = { Wood: storageCapacity(state, mill) };
    tickAt(state, start + 60_000);
    expect(state.workers[0].activity).toBe('Idle');
    const wood = getWallet(state.city.wallet, 'Wood');
    const tap = start + 60_000 + 400;
    const moved = collectBuilding(state, mill.uniqueId, tap);
    // At least the capacity: the load already out when it filled landed too.
    expect(moved.Wood).toBeGreaterThanOrEqual(storageCapacity(state, mill));
    expect(getWallet(state.city.wallet, 'Wood')).toBe(wood + moved.Wood!);
    expect(storedTotal(mill)).toBe(0);
    // The crew goes out from the tap, not from when the store filled.
    tickAt(state, tap + 1);
    expect(state.workers[0].activity).toBe('MovingToCell');
    expect(state.workers[0].stateStartedAt).toBeGreaterThanOrEqual(tap);
  });

  it('a quest counts what the player COLLECTS, not what a crew delivers', () => {
    const { state, mill, start } = crewedSawmill();
    const before = tally(state, 'collect:Wood');
    tickAt(state, start + 3 * CYCLE_MS + 100);
    expect(storedOf(mill, 'Wood')).toBeGreaterThan(0);
    expect(tally(state, 'collect:Wood')).toBe(before);
    const got = collectBuilding(state, mill.uniqueId, start + 3 * CYCLE_MS + 100).Wood!;
    expect(tally(state, 'collect:Wood')).toBe(before + got);
  });

  it('a raid takes from the stores, and a crew waiting by a full one goes out again', () => {
    const { state, mill, start } = crewedSawmill();
    mill.stored = { Wood: storageCapacity(state, mill) };
    tickAt(state, start + 60_000);
    expect(state.workers[0].activity).toBe('Idle');
    const wallet = getWallet(state.city.wallet, 'Wood');
    reveal(state, [LAIRS.Orcs.location]);
    advance(state, map, start + 60_000); // the sweep arms the lair
    const raidAt = state.lairs.Orcs!.nextRaidAt!;
    const result = advance(state, map, raidAt + 1000);
    const took = result.raids[0]?.took.Wood ?? 0;
    expect(took).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(wallet);
    expect(isStoreFull(state, mill)).toBe(false);
    expect(state.workers[0].activity).not.toBe('Idle');
  });
});
