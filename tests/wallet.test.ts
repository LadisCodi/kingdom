// Currency equivalence: Berries (1 Food) and Meat (3 Food) pay Food costs;
// finite sources (berry bushes, wild animals) vanish when drained.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { coordKey, getWallet } from '../src/sim/state';
import { harvestSourceAt, tapCell } from '../src/sim/harvest';
import { populationCost } from '../src/sim/population';
import { canAfford, effectiveAmount, pay } from '../src/sim/wallet';
import {
  addBuilt, addTrainer, BERRIES, canGather, completeTech, freshGame, fund, map, T0,
} from './helpers';

const BERRY_BUSH = BERRIES; // the one authored bush
const WILD_ANIMALS = { x: -2, y: -4 }; // also unrevealed

describe('food-valued currencies', () => {
  it('effectiveAmount and canAfford count Berries (×1) and Meat (×3) as Food', () => {
    const wallet = { Food: 2, Berries: 4, Meat: 1 };
    expect(effectiveAmount(wallet, 'Food')).toBe(2 + 4 + 3);
    expect(canAfford(wallet, { Food: 9 })).toBe(true);
    expect(canAfford(wallet, { Food: 10 })).toBe(false);
    expect(effectiveAmount(wallet, 'Gold')).toBe(0); // no cross-talk
  });

  it('pays base first, then Berries, then Meat — with change for a broken Meat', () => {
    const wallet = { Food: 2, Berries: 3, Meat: 2 };
    pay(wallet, { Food: 9 }); // 2 Food + 3 Berries + 2 Meat (6) = 11 → 2 change
    expect(wallet).toEqual({ Food: 2, Berries: 0, Meat: 0 });
    expect(effectiveAmount(wallet, 'Food')).toBe(2);
  });

  it('does not break a Meat when smaller units cover the cost', () => {
    const wallet = { Food: 0, Berries: 5, Meat: 2 };
    pay(wallet, { Food: 4 });
    expect(wallet).toEqual({ Food: 0, Berries: 1, Meat: 2 });
  });

  it('population and units can be bought with food-valued currencies', () => {
    const state = freshGame(); // rebalanced start: 0 population, empty wallet
    addBuilt(state, 'Housing', { x: 2, y: 0 }); // capacity to train into
    state.city.wallet = { Berries: 5, Meat: 2 }; // 11 effective Food
    expect(populationCost(0)).toBe(5); // the authored price of the first
    expect(trainUnit(state, 'Villager', T0)).toBe('Queued'); // pays 5 Berries up front
    expect(state.city.wallet).toEqual({ Berries: 0, Meat: 2 });

    fund(state, { Gold: 100, Wood: 10, Berries: 1, Meat: 7 }); // fund SETS both
    completeTech(state, 'Warrior'); // the Warrior sits behind it now
    addTrainer(state, 'Warrior', { x: 3, y: 2 }); // and behind its Barracks
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued'); // 50 Gold + 10 Wood + 20 Food
    // 1 Berry + all 7 Meat (21) cover the 20 → 2 Food back as change.
    expect(getWallet(state.city.wallet, 'Berries')).toBe(0);
    expect(getWallet(state.city.wallet, 'Meat')).toBe(0);
    expect(getWallet(state.city.wallet, 'Food')).toBe(2);
  });
});

describe('finite map features', () => {
  it('a berry bush yields Berries and vanishes for good when drained', () => {
    const state = freshGame();
    canGather(state); // the bush sits behind Forestry now
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe('Berries');
    for (let i = 0; i < 10; i++) expect(tapCell(state, map, BERRY_BUSH, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Berries')).toBe(10);
    expect(state.features[coordKey(BERRY_BUSH)]).toBeUndefined(); // gone from the map
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe(null);
    expect(tapCell(state, map, BERRY_BUSH, T0)).toBe('NotHarvestable');
  });

  it('wild animals yield Meat once revealed AND hunted', () => {
    const state = freshGame();
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('NotRevealed');
    state.fog.revealed[coordKey(WILD_ANIMALS)] = true;
    // Game is the one resource behind a technology of its own.
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('TechLocked');
    completeTech(state, 'Hunting');
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Meat')).toBe(1);
  });
});
