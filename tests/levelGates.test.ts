// Tech-gated building levels (balancing v1): each upgrade can require a
// technology on top of the Townhall level, and Housing capacity is per-level
// (+1 everywhere once Communities is researched).
import { describe, expect, it } from 'vitest';
import { upgradeDistrict } from '../src/sim/commands';
import { requiredTechForLevel } from '../src/sim/districts';
import { districtCapacity, maxPopulation } from '../src/sim/population';
import { districtById, townhall } from '../src/sim/state';
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
  it('a level-2 house holds twice what a level-1 one does', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    expect(districtCapacity(state, house)).toBe(1);
    expect(maxPopulation(state)).toBe(1);
    house.level = 2;
    expect(districtCapacity(state, house)).toBe(2);
    expect(maxPopulation(state)).toBe(2);
    expect(districtCapacity(state, districtById(state, townhall(state).uniqueId)!)).toBe(0);
  });

  it('Communities adds +1 to every house (and only to houses)', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', { x: 0, y: -1 });
    expect(maxPopulation(state)).toBe(2);
    completeTech(state, 'Communities');
    expect(maxPopulation(state)).toBe(4); // +1 per house
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    expect(districtCapacity(state, house)).toBe(2);
    expect(districtCapacity(state, districtById(state, townhall(state).uniqueId)!)).toBe(0);
  });
});
