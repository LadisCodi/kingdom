// Tech-gated building levels (balancing v1): each upgrade can require a
// technology on top of the Townhall level, and Housing capacity is per-level
// (+1 everywhere once Communities is researched).
import { describe, expect, it } from 'vitest';
import { upgradeDistrict } from '../src/sim/commands';
import { requiredTechForLevel } from '../src/sim/districts';
import { districtCapacity, maxPopulation } from '../src/sim/population';
import { DISTRICTS, MANA, levelIndexed } from '../src/sim/data/definitions';
import { districtById, townhall, type DistrictId } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, tickAt, T0 } from './helpers';

const HOUSE = { x: 2, y: 0 }; // touches the Townhall

describe('tech-gated upgrades', () => {
  it('Housing L2 sits behind Urban Planning', () => {
    expect(requiredTechForLevel('Housing', 2)).toBe('UrbanPlanning');
    const state = freshGame();
    fund(state, { Wood: 1000, Stone: 1000 });
    addBuilt(state, 'Housing', HOUSE);
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    expect(upgradeDistrict(state, house.uniqueId)).toBe('RequirementsNotMet');
    completeTech(state, 'UrbanPlanning');
    expect(upgradeDistrict(state, house.uniqueId)).toBe('Started');
  });

  it('Townhall L3 needs Architecture; L2 needs no tech', () => {
    expect(requiredTechForLevel('Townhall', 2)).toBe(null);
    expect(requiredTechForLevel('Townhall', 3)).toBe('Architecture');
    const state = freshGame();
    fund(state, { Wood: 1000, Stone: 1000 });
    const th = townhall(state);
    expect(upgradeDistrict(state, th.uniqueId)).toBe('Started');
    tickAt(state, T0);
    tickAt(state, T0 + 31_000); // 30s upgrade
    expect(townhall(state).level).toBe(2);
    expect(upgradeDistrict(state, th.uniqueId)).toBe('RequirementsNotMet');
    completeTech(state, 'Architecture');
    expect(upgradeDistrict(state, th.uniqueId)).toBe('Started');
    tickAt(state, T0 + 31_000);
    tickAt(state, T0 + 152_000); // 120s upgrade
    expect(townhall(state).level).toBe(3);
  });

  it('the Sawmill: L2 is tech-free, L3 sits behind Engineering', () => {
    expect(requiredTechForLevel('Sawmill', 2)).toBe(null);
    expect(requiredTechForLevel('Sawmill', 3)).toBe('Engineering');
  });
});

describe('per-level housing capacity', () => {
  // One house holds TWO (Docs/onboarding.md step 13): the tutorial trains a
  // second villager before it asks for a second house, so the first house has
  // to have somewhere to put them. The Townhall houses nobody — a roof is
  // what permits a villager, which is onboarding steps 4-6 in order.
  it('a level-2 house holds twice what a level-1 one does', () => {
    const state = freshGame();
    const th = districtById(state, townhall(state).uniqueId)!;
    expect(districtCapacity(state, th)).toBe(0);
    expect(maxPopulation(state)).toBe(0); // nowhere to live until you build

    addBuilt(state, 'Housing', HOUSE);
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    expect(districtCapacity(state, house)).toBe(2);
    expect(maxPopulation(state)).toBe(2);
    house.level = 2;
    expect(districtCapacity(state, house)).toBe(4);
    expect(maxPopulation(state)).toBe(4);
  });

  // "+1 to every district that houses anyone" — the Townhall houses nobody,
  // so it gets nothing.
  it('Communities adds +1 to every district that houses anyone', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', { x: 0, y: -1 });
    expect(maxPopulation(state)).toBe(4);
    completeTech(state, 'Communities');
    expect(maxPopulation(state)).toBe(6); // +1 per house, and only per house
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    expect(districtCapacity(state, house)).toBe(3);
    expect(districtCapacity(state, districtById(state, townhall(state).uniqueId)!)).toBe(0);
  });
});

// Every upgrade has to be able to SAY what it buys (2026-09-02).
//
// The district card's upgrade row is now a summary of what changes at the
// next level, and that summary is derived — it reads the per-level arrays
// and prints what moved. Which means a building whose numbers are all flat
// renders a level, a price, a wait, and a blank line where the reason to
// spend should be.
//
// That is not a UI bug to patch in the UI: it is a building the balance data
// gives no reason to upgrade, and it is invisible until someone opens that
// one card. Adding a district with `max_level: 2` and no per-level numbers
// fails here instead.
describe('every upgradable building has something to show for the level', () => {
  const PER_LEVEL = [
    'influenceRadiusPerLevel', 'maxWorkersPerLevel',
    'armyCapPerLevel', 'populationCapacityPerLevel',
  ] as const;

  // The two that carry their per-level numbers in the Mana table rather than
  // their own row, because the pool is one number the whole city shares.
  const VIA_MANA: readonly DistrictId[] = ['Townhall', 'Sanctum'];

  it('names at least one number that changes at the next level', () => {
    const silent = (Object.keys(DISTRICTS) as DistrictId[]).filter((id) => {
      const def = DISTRICTS[id];
      if (def.maxLevel <= 1) return false; // nothing to upgrade, no row drawn
      if (VIA_MANA.includes(id)) return false;
      return !PER_LEVEL.some((k) => def[k].length > 0);
    });
    expect(silent).toEqual([]);
  });

  // And the Mana pair really does grow, so their exemption above is earned
  // rather than a way to opt out of the rule.
  it('the Townhall and the Sanctum grow the Mana pool with every level', () => {
    for (let level = 1; level < DISTRICTS.Townhall.maxLevel; level++) {
      expect(levelIndexed(MANA.baseCapPerTownhallLevel, level + 1))
        .toBeGreaterThan(levelIndexed(MANA.baseCapPerTownhallLevel, level));
    }
    for (let level = 1; level < DISTRICTS.Sanctum.maxLevel; level++) {
      expect(levelIndexed(MANA.sanctumCapPerLevel, level + 1))
        .toBeGreaterThan(levelIndexed(MANA.sanctumCapPerLevel, level));
    }
  });
});
