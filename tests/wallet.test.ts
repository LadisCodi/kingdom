// Currency equivalence: Berries (1 Food) and Meat (3 Food) pay Food costs;
// finite sources (berry bushes, wild animals) vanish when drained.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { coordKey, getWallet } from '../src/sim/state';
import { harvestSourceAt, tapCell } from '../src/sim/harvest';
import { buyPopulation, populationCost } from '../src/sim/population';
import { canAfford, effectiveAmount, pay } from '../src/sim/wallet';
import { freshGame, fund, map, T0 } from './helpers';

const BERRY_BUSH = { x: 3, y: 1 }; // seed-revealed
const WILD_ANIMALS = { x: -2, y: -4 }; // beyond the fog reveal radius

describe('food-valued currencies', () => {
  it('effectiveAmount and canAfford count Berries (×1) and Meat (×3) as Food', () => {
    const wallet = { Food: 2, Berries: 4, Meat: 1 };
    expect(effectiveAmount(wallet, 'Food')).toBe(2 + 4 + 3);
    expect(canAfford(wallet, { Food: 9 })).toBe(true);
    expect(canAfford(wallet, { Food: 10 })).toBe(false);
    expect(effectiveAmount(wallet, 'Silver')).toBe(0); // no cross-talk
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
    const state = freshGame(); // population 2, Food 5
    state.city.wallet = { Berries: 4, Meat: 2 }; // 10 effective Food
    expect(populationCost(2)).toBe(7);
    expect(buyPopulation(state)).toBe('Success'); // 4 berries + 1 meat (3) = 7 exact
    expect(state.city.wallet).toEqual({ Berries: 0, Meat: 1 });

    fund(state, { Silver: 100, Meat: 7 }); // Swordsman: 50 Silver + 20 Food
    expect(trainUnit(state, 'Swordsman')).toBe('Trained');
    // 1 leftover meat + 7 = 8 meat = 24; 20 paid → 1 Food change, 0 meat left.
    expect(getWallet(state.city.wallet, 'Meat')).toBe(0);
    expect(getWallet(state.city.wallet, 'Food')).toBe(1);
  });
});

describe('finite map features', () => {
  it('a berry bush yields Berries and vanishes for good when drained', () => {
    const state = freshGame();
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe('Berries');
    for (let i = 0; i < 10; i++) expect(tapCell(state, map, BERRY_BUSH, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Berries')).toBe(10);
    expect(state.features[coordKey(BERRY_BUSH)]).toBeUndefined(); // gone from the map
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe(null);
    expect(tapCell(state, map, BERRY_BUSH, T0)).toBe('NotHarvestable');
  });

  it('wild animals yield Meat once revealed', () => {
    const state = freshGame();
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('NotRevealed');
    state.fog.revealed[coordKey(WILD_ANIMALS)] = true;
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Meat')).toBe(1);
  });
});
