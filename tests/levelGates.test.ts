// Tech-gated building levels (balancing v1): each upgrade can require a
// technology on top of the Townhall level, and Housing capacity is per-level
// (+1 everywhere once Communities is researched).
import { describe, expect, it } from 'vitest';
import { upgradeDistrict } from '../src/sim/commands';
import {
  LATE_FROM, requiredTechForLevel, requiredTownhallLevel, upgradeGoodsCost,
} from '../src/sim/districts';
import { addGood, getGood } from '../src/sim/goods';
import { effectiveWorkerStrike, tapDraw, workerStrikeMs } from '../src/sim/upgrades';
import { districtCapacity, maxPopulation } from '../src/sim/population';
import { DISTRICTS, HARVEST, MANA, levelIndexed } from '../src/sim/data/definitions';
import { districtById, townhall, type DistrictId, type GoodId } from '../src/sim/state';
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

  // The Townhall's levels are still gated by TECHNOLOGY, and by an ordinary
  // one: `Bureaucracy` is a card in Civics era 2 like any other, priced and
  // placed. It is not what opens the book — nothing opens a book any more —
  // and nothing about it is special to the code, which reads the gate off its
  // `unlocks` the way it reads every other.
  it('Townhall L3 needs Bureaucracy; L2 needs no tech', () => {
    expect(requiredTechForLevel('Townhall', 2)).toBe(null);
    expect(requiredTechForLevel('Townhall', 3)).toBe('Bureaucracy');
    expect(requiredTechForLevel('Townhall', 4)).toBe('Magistracy');
    const state = freshGame();
    fund(state, { Wood: 1000, Stone: 1000 });
    const th = townhall(state);
    expect(upgradeDistrict(state, th.uniqueId)).toBe('Started');
    tickAt(state, T0);
    tickAt(state, T0 + 31_000); // 30s upgrade
    expect(townhall(state).level).toBe(2);
    expect(upgradeDistrict(state, th.uniqueId)).toBe('RequirementsNotMet');
    completeTech(state, 'Bureaucracy');
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
  // One house holds TWO (Docs/features/12-quests.md §2 (quests 18-19)): the tutorial trains a
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
    // What a producer's LATE level buys, since crew and reach stop growing at
    // five (Docs/plans/builder-30-days.md §4).
    'extraUnitsPerDeliveryPerLevel', 'strikeSpeedPerLevel',
    'queueLengthPerLevel', 'salePricePerLevel',
  ] as const;

  // The Sanctum carries its per-level numbers in the Mana table rather than
  // its own row, because the pool is one number the whole city shares.
  //
  // The Townhall is exempt for a different reason and it is worth separating
  // them: it has no per-level number of its own AT ALL any more. It gates —
  // how many of each district may exist, and how high each may go — and every
  // one of those numbers lives on the building being gated
  // (Docs/features/08-magic.md §2).
  const VIA_MANA: readonly DistrictId[] = ['Sanctum'];
  const GATES_ONLY: readonly DistrictId[] = ['Townhall'];

  it('names at least one number that changes at the next level', () => {
    const silent = (Object.keys(DISTRICTS) as DistrictId[]).filter((id) => {
      const def = DISTRICTS[id];
      if (def.maxLevel <= 1) return false; // nothing to upgrade, no row drawn
      if (VIA_MANA.includes(id) || GATES_ONLY.includes(id)) return false;
      return !PER_LEVEL.some((k) => def[k].length > 0);
    });
    expect(silent).toEqual([]);
  });

  // And the Sanctum really does grow, so its exemption above is earned rather
  // than a way to opt out of the rule. It is BOTH Mana numbers now: the
  // Townhall stopped producing and stopped setting the ceiling, so it is not
  // in this test any more — its own rows are the district counts it gates.
  it('the Sanctum grows both Mana numbers with every level', () => {
    for (let level = 1; level < DISTRICTS.Sanctum.maxLevel; level++) {
      expect(levelIndexed(MANA.sanctumCapPerLevel, level + 1))
        .toBeGreaterThan(levelIndexed(MANA.sanctumCapPerLevel, level));
      expect(levelIndexed(MANA.sanctumPerHourPerLevel, level + 1))
        .toBeGreaterThan(levelIndexed(MANA.sanctumPerHourPerLevel, level));
    }
  });
});

// ---------------------------------------------------------- the late city

describe('the late levels are gated by goods and the Townhall, not by research', () => {
  it('asks no technology anywhere above the ladder the tomes already own', () => {
    for (const id of Object.keys(DISTRICTS) as DistrictId[]) {
      const def = DISTRICTS[id];
      for (let level = LATE_FROM; level <= def.maxLevel; level++) {
        expect(requiredTechForLevel(id, level), `${id} level ${level}`).toBe(null);
      }
    }
  });

  it('asks a Townhall level for every late level, one per level', () => {
    for (const id of Object.keys(DISTRICTS) as DistrictId[]) {
      const def = DISTRICTS[id];
      if (def.maxLevel < LATE_FROM || id === 'Townhall') continue;
      for (let level = LATE_FROM; level <= def.maxLevel; level++) {
        expect(requiredTownhallLevel(id, level), `${id} level ${level}`).toBe(level);
      }
    }
  });

  it('refuses level 6 for want of a Townhall, then for want of goods', () => {
    const state = freshGame();
    fund(state, { Wood: 10_000_000, Stone: 10_000_000, Gold: 10_000_000 });
    addBuilt(state, 'Sawmill', { x: 4, y: 2 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    sawmill.level = 5;
    completeTech(state, 'Engineering');
    completeTech(state, 'Architecture');

    // The Townhall answers first: a trip to the workshop is pointless while
    // the city itself is too small for the level.
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('RequirementsNotMet');
    townhall(state).level = 6;
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('NotEnoughGoods');

    // And the goods are the only thing left between the player and the level.
    for (const [good, n] of Object.entries(upgradeGoodsCost('Sawmill', 6))) {
      addGood(state.city.goods, good as GoodId, n);
    }
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('Started');
  });

  it('spends the goods it asked for, and nothing else', () => {
    const state = freshGame();
    fund(state, { Wood: 10_000_000, Stone: 10_000_000, Gold: 10_000_000 });
    addBuilt(state, 'Sawmill', { x: 4, y: 2 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    sawmill.level = 5;
    townhall(state).level = 6;
    completeTech(state, 'Engineering');
    completeTech(state, 'Architecture');
    addGood(state.city.goods, 'Planks', 10);
    addGood(state.city.goods, 'CutStone', 4);
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('Started');
    expect(getGood(state.city.goods, 'Planks')).toBe(10 - upgradeGoodsCost('Sawmill', 6).Planks!);
    expect(getGood(state.city.goods, 'CutStone')).toBe(4);
  });
});

describe('a late producer hauls more and swings faster', () => {
  const sawmillAt = (level: number) => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 4, y: 2 });
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    sawmill.level = level;
    return { state, sawmill };
  };

  it('carries a bigger load per delivery at 6 than at 5', () => {
    const low = sawmillAt(5);
    const high = sawmillAt(6);
    expect(effectiveWorkerStrike(high.state, HARVEST.Forest, high.sawmill))
      .toBeGreaterThan(effectiveWorkerStrike(low.state, HARVEST.Forest, low.sawmill));
  });

  it('waits less between strikes at 6 than at 5', () => {
    const low = sawmillAt(5);
    const high = sawmillAt(6);
    expect(workerStrikeMs(high.state, HARVEST.Forest, high.sawmill))
      .toBeLessThan(workerStrikeMs(low.state, HARVEST.Forest, low.sawmill));
  });

  it('grows both, level by level, all the way to ten', () => {
    for (let level = LATE_FROM; level < DISTRICTS.Sawmill.maxLevel; level++) {
      const here = sawmillAt(level);
      const next = sawmillAt(level + 1);
      expect(effectiveWorkerStrike(next.state, HARVEST.Forest, next.sawmill), `level ${level}`)
        .toBeGreaterThan(effectiveWorkerStrike(here.state, HARVEST.Forest, here.sawmill));
      expect(workerStrikeMs(next.state, HARVEST.Forest, next.sawmill), `level ${level}`)
        .toBeLessThan(workerStrikeMs(here.state, HARVEST.Forest, here.sawmill));
    }
  });

  it('leaves the TAP alone — the thumb is not a crew', () => {
    const low = sawmillAt(5);
    const high = sawmillAt(10);
    expect(tapDraw(high.state, HARVEST.Forest, 0)).toBe(tapDraw(low.state, HARVEST.Forest, 0));
  });

  it('does not touch a building with no late columns', () => {
    const state = freshGame();
    addBuilt(state, 'Farm', { x: 6, y: 6 });
    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    const one = effectiveWorkerStrike(state, HARVEST.Crops, farm);
    farm.level = 5;
    // Levels 1-5 buy crew and reach; the haul is the ground's until level 6.
    expect(effectiveWorkerStrike(state, HARVEST.Crops, farm)).toBe(one);
  });
});
