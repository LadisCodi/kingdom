// Harmony: what a decoration supplies, what an advanced building demands, and
// the gate between them (Docs/plans/builder-30-days.md §6).
//
// Harmony is a city TOTAL — supply − demand, computed on read, a gate and
// never a drain. With the province plot unbounded (OQ-1) a decoration does not
// compete for ground, so what prices it is variety and the workshop queue:
// every piece has its own count cap and every piece past the Garden is priced
// in a refined good.
//
// This suite starts at the SCHEMA, because the shape of the two columns is
// what every rule above rests on.
import { describe, expect, it } from 'vitest';
import { DECORATIONS, DISTRICTS, HARMONY, levelIndexed } from '../src/sim/data/definitions';
import {
  harmonyDemand, harmonyFree, harmonySupply, harmonySurplusMultiplier, harmonySurplusTier,
} from '../src/sim/harmony';
import { cancelQueueItem, enqueueBuild, upgradeDistrict } from '../src/sim/commands';
import { placementBlock, validPlacementCells } from '../src/sim/districts';
import { effectiveTaxRate } from '../src/sim/upgrades';
import { townhall, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map } from './helpers';

const districts = Object.entries(DISTRICTS);

describe('the harmony columns', () => {
  it('reads demand as a total, so it never falls between levels', () => {
    // Entry 0 is the gate on BUILDING it and the rest are the gates on its
    // levels — one column for both, which only works while the number is a
    // running total. A column that fell would silently refund Harmony on the
    // way up.
    for (const [id, def] of districts) {
      const falls = def.harmonyCostPerLevel
        .some((n, i) => i > 0 && n < def.harmonyCostPerLevel[i - 1]!);
      expect(falls, `${id} demands less at a higher level`).toBe(false);
    }
  });

  it('never asks one building to both supply and demand', () => {
    // A row that did is a row whose author meant two different buildings.
    for (const [id, def] of districts) {
      if (def.harmonySupply === 0) continue;
      expect(def.harmonyCostPerLevel, `${id} supplies and demands`).toEqual([]);
    }
  });

  it('gives a decoration nothing but its supply', () => {
    // No ladder, no crew, no residents, no queue, no area of influence: a
    // decoration's whole contribution is the one number.
    for (const [id, def] of districts) {
      if (def.harmonySupply === 0) continue;
      expect(Number.isInteger(def.harmonySupply), `${id} supplies a fraction`).toBe(true);
      expect(def.maxLevel, `${id} has a ladder`).toBe(1);
      expect(def.maxWorkersPerLevel, `${id} has a crew`).toEqual([]);
      expect(def.populationCapacityPerLevel, `${id} houses somebody`).toEqual([]);
      expect(def.armyCapPerLevel, `${id} raises the army cap`).toEqual([]);
      expect(def.influenceRadiusPerLevel, `${id} has an area`).toEqual([]);
      expect(def.queueLengthPerLevel, `${id} has a queue`).toEqual([]);
      expect(def.produces, `${id} makes something`).toBe(null);
    }
  });

  it('prices a build in goods nowhere a good cannot be made yet', () => {
    // `build_cost_goods` is new with this step and only the decorations will
    // name any. Anything else naming one would be a build the player cannot
    // start before their first workshop.
    for (const [id, def] of districts) {
      if (def.harmonySupply > 0) continue;
      expect(def.buildCostGoods, `${id} costs goods to build`).toEqual({});
    }
  });
});

describe('the surplus tiers', () => {
  it('are ascending ratios of demand, each paying something', () => {
    // A reader takes the LAST tier reached, so a ladder that doubled back
    // would quietly pay the wrong one.
    let last = 0;
    for (const tier of HARMONY.surplusTiers) {
      expect(tier.at).toBeGreaterThanOrEqual(1);
      expect(tier.at).toBeGreaterThan(last);
      expect(tier.bonus).not.toBe(0);
      last = tier.at;
    }
    expect(HARMONY.surplusTiers.length).toBeGreaterThan(0);
  });

  it('is the workbook that says what a surplus pays', () => {
    expect(HARMONY.surplusTiers).toEqual([
      { at: 1.1, bonus: 0.05 },
      { at: 1.25, bonus: 0.1 },
      { at: 1.5, bonus: 0.15 },
    ]);
  });
});

describe('the six decorations', () => {
  it('opens one Townhall level at a time, and caps each kind', () => {
    // Variety is what prices Harmony now the plot is unbounded (OQ-1): a
    // Townhall's demand cannot be met by spamming the cheapest piece.
    const caps = DECORATIONS.map((id) => DISTRICTS[id].maxCountPerTownhallLevel);
    // Each opens strictly later than the last, and none before Townhall 5.
    const opensAt = caps.map((c) => c.findIndex((n) => n > 0) + 1);
    expect(opensAt).toEqual([5, 6, 6, 7, 8, 9]);
    // And every cap only ever grows with the Townhall.
    for (const [i, c] of caps.entries()) {
      const falls = c.some((n, j) => j > 0 && n < c[j - 1]!);
      expect(falls, `${DECORATIONS[i]}'s cap falls`).toBe(false);
    }
  });

  it('prices every piece past the Garden in a refined good', () => {
    // Which is what makes a decoration a queue at a workshop rather than a
    // walk to the map — the whole reason Harmony is not just a second wallet.
    for (const id of DECORATIONS) {
      const def = DISTRICTS[id];
      expect(Object.keys(def.buildCost).length, `${id} has no raw cost`).toBeGreaterThan(0);
      if (id === 'Garden') continue;
      expect(Object.keys(def.buildCostGoods).length, `${id} costs no goods`).toBeGreaterThan(0);
    }
  });

  it('reveals no fog — a Garden is not a cheaper frontier than paying for one', () => {
    for (const id of DECORATIONS) {
      expect(DISTRICTS[id].fogRevealRadius, id).toBe(0);
      expect(DISTRICTS[id].fogDiscoverRadius, id).toBe(0);
    }
  });

  it('supplies enough, at each Townhall level, to be worth authoring', () => {
    // The ceiling the demand in §6.4 is authored against. A regression here
    // is a regression in the whole late ladder, so it is a number and not a
    // feeling.
    const ceiling = (townhallLevel: number): number => DECORATIONS.reduce((sum, id) => {
      const def = DISTRICTS[id];
      return sum + def.harmonySupply * levelIndexed(def.maxCountPerTownhallLevel, townhallLevel);
    }, 0);
    expect([5, 6, 7, 8, 9, 10].map(ceiling)).toEqual([16, 48, 90, 162, 274, 386]);
  });
});

describe('supply and demand', () => {
  it('counts a decoration once it is standing, and not before', () => {
    const state = freshGame();
    expect(harmonySupply(state)).toBe(0);
    // Under construction: the ground is taken, the beauty is not delivered.
    state.city.districts.push({
      uniqueId: 'pending', definitionId: 'Garden', level: 1, assignedWorkers: 0,
      location: { x: 4, y: 0 }, state: 'UnderConstruction', visualVariant: 1,
    });
    expect(harmonySupply(state)).toBe(0);
    addBuilt(state, 'Garden', { x: 5, y: 0 });
    expect(harmonySupply(state)).toBe(4);
  });

  it('demands nothing below level 8, and the total at each level above it', () => {
    const state = freshGame();
    const house = () => state.city.districts.find((d) => d.definitionId === 'Housing')!;
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    for (const [level, want] of [[1, 0], [7, 0], [8, 2], [9, 4], [10, 6]] as const) {
      house().level = level;
      expect(harmonyDemand(state), `level ${level}`).toBe(want);
    }
  });

  it('measures a district being upgraded at the level it is upgrading TO', () => {
    // Otherwise the same surplus buys two levels: demand would stay at the
    // old level for as long as the wait ran.
    const state = freshGame();
    fund(state, { Gold: 9e9, Wood: 9e9, Stone: 9e9, Food: 9e9 });
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    house.level = 8;
    expect(harmonyDemand(state)).toBe(2);
    state.city.queue.push({
      uniqueId: 'up', kind: 'upgrade', districtUniqueId: house.uniqueId,
      targetLevel: 9, durationSeconds: 60, startedAt: null,
    });
    expect(harmonyDemand(state)).toBe(4);
  });
});

describe('the gate', () => {
  /** A city with a Townhall high enough for a late level, and a purse. */
  const lateCity = (): GameState => {
    const state = freshGame();
    townhall(state).level = 10;
    fund(state, { Gold: 9e9, Wood: 9e9, Stone: 9e9, Food: 9e9 });
    for (const id of ['Planks', 'CutStone', 'Iron', 'Runestone'] as const) {
      state.city.goods[id] = 999;
    }
    return state;
  };

  it('refuses the upgrade that would take the city past its supply', () => {
    const state = lateCity();
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    house.level = 7;
    // Level 8 wants 2 Harmony and the city supplies none.
    expect(upgradeDistrict(state, house.uniqueId)).toBe('NeedsHarmony');
    addBuilt(state, 'Garden', { x: 6, y: 0 }); // +4
    expect(upgradeDistrict(state, house.uniqueId)).toBe('Started');
  });

  it('replaces the demand a building already makes rather than stacking on it', () => {
    // 8 → 9 asks for 4 in total, not 2 + 4: a level takes the place of the
    // level below it.
    const state = lateCity();
    addBuilt(state, 'Garden', { x: 6, y: 0 }); // supply 4
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    house.level = 8;
    expect(harmonyDemand(state)).toBe(2);
    expect(upgradeDistrict(state, house.uniqueId)).toBe('Started');
    expect(harmonyDemand(state)).toBe(4); // and now it is spent to the last point
  });

  it('never takes back what is already standing', () => {
    // Promise 1: a deficit blocks the next thing and cannot punish the last.
    const state = lateCity();
    addBuilt(state, 'Garden', { x: 6, y: 0 });
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    const houses = state.city.districts.filter((d) => d.definitionId === 'Housing');
    houses[0]!.level = 9; // 4 of the 4 supplied
    addBuilt(state, 'Housing', { x: 4, y: 2 });
    const second = state.city.districts.filter((d) => d.definitionId === 'Housing')[1]!;
    second.level = 7;
    expect(harmonyFree(state)).toBe(0);
    expect(upgradeDistrict(state, second.uniqueId)).toBe('NeedsHarmony');
    // The level 9 house is untouched, and still level 9.
    expect(houses[0]!.level).toBe(9);
    expect(harmonySupply(state)).toBe(4);
  });

  it('asks the three errands in order: the Townhall, then goods, then Harmony', () => {
    // Each refusal is a different trip, so the one the player is told about
    // has to be the one they can act on soonest.
    const state = freshGame();
    fund(state, { Gold: 9e9, Wood: 9e9, Stone: 9e9, Food: 9e9 });
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    house.level = 7;
    expect(upgradeDistrict(state, house.uniqueId)).toBe('RequirementsNotMet');
    townhall(state).level = 10;
    expect(upgradeDistrict(state, house.uniqueId)).toBe('NotEnoughGoods');
    state.city.goods.Planks = 999;
    expect(upgradeDistrict(state, house.uniqueId)).toBe('NeedsHarmony');
    addBuilt(state, 'Garden', { x: 6, y: 0 });
    expect(upgradeDistrict(state, house.uniqueId)).toBe('Started');
  });
});

describe('a decoration is bought like anything else', () => {
  const gardenCity = (): GameState => {
    const state = freshGame();
    townhall(state).level = 6;
    fund(state, { Gold: 9e9, Wood: 9e9, Stone: 9e9, Food: 9e9 });
    return state;
  };

  it('pays its goods when the build is QUEUED and refunds them on cancel', () => {
    // The rule a workshop item already follows: the stockpile is charged at
    // the moment of the promise, not at delivery.
    const state = gardenCity();
    state.city.goods.CutStone = 3;
    const cell = validPlacementCells(state, map, 'Well')[0]!;
    expect(enqueueBuild(state, map, 'Well', cell)).toBe('Started');
    expect(state.city.goods.CutStone).toBe(2);
    const item = state.city.queue.find((q) => q.kind === 'build')!;
    expect(cancelQueueItem(state, item.uniqueId)).toBe('Cancelled');
    expect(state.city.goods.CutStone).toBe(3);
  });

  it('refuses a build the stockpile cannot pay for, and says which purse', () => {
    const state = gardenCity();
    const cell = validPlacementCells(state, map, 'Well')[0]!;
    expect(enqueueBuild(state, map, 'Well', cell)).toBe('NotEnoughGoods');
    expect(state.city.districts.some((d) => d.definitionId === 'Well')).toBe(false);
  });

  it('goes anywhere revealed — a decoration demands no Harmony of its own', () => {
    const state = gardenCity();
    const cell = validPlacementCells(state, map, 'Garden')[0]!;
    expect(placementBlock(state, map, 'Garden', cell)).toBe(null);
    // And the gate is the count cap, which IS the Townhall gate: the Shrine
    // opens at 9 and this city is at 6, so no cell on the map takes one.
    expect(validPlacementCells(state, map, 'Shrine')).toEqual([]);
  });
});

describe('the surplus bonus', () => {
  const surplusCity = (): GameState => {
    const state = freshGame();
    townhall(state).level = 10;
    addBuilt(state, 'Housing', { x: 4, y: 0 });
    state.city.districts.find((d) => d.definitionId === 'Housing')!.level = 10; // demands 6
    return state;
  };

  it('pays nothing to a city that demands nothing', () => {
    // Otherwise one Garden at Townhall 5 pays the top tier for the whole
    // midgame, for free.
    const state = freshGame();
    addBuilt(state, 'Garden', { x: 4, y: 0 });
    expect(harmonyDemand(state)).toBe(0);
    expect(harmonySurplusTier(state)).toBe(null);
    expect(harmonySurplusMultiplier(state)).toBe(1);
  });

  it('takes the last tier the ratio reaches', () => {
    const state = surplusCity();
    const supply = (n: number): void => {
      state.city.districts = state.city.districts.filter((d) => d.definitionId !== 'Garden');
      for (let i = 0; i < n; i += 1) addBuilt(state, 'Garden', { x: 4 + i, y: 4 });
    };
    supply(1); // 4 / 6 — under demand, no tier
    expect(harmonySurplusMultiplier(state)).toBe(1);
    supply(2); // 8 / 6 = 1.33 → the middle tier
    expect(harmonySurplusTier(state)?.bonus).toBe(0.1);
    supply(3); // 12 / 6 = 2.0 → the top tier
    expect(harmonySurplusTier(state)?.bonus).toBe(0.15);
  });

  it('moves the tax rate, at the base stage', () => {
    const state = surplusCity();
    const base = effectiveTaxRate(state);
    for (let i = 0; i < 3; i += 1) addBuilt(state, 'Garden', { x: 4 + i, y: 4 });
    expect(harmonySurplusMultiplier(state)).toBe(1.15);
    expect(effectiveTaxRate(state)).toBeCloseTo(base * 1.15, 10);
  });
});
