// Wallet math, and the finite sources (berry bushes, wild animals) that
// vanish when drained.
//
// The currency-equivalence suite that used to live here is gone with the
// mechanism: Berries, Meat and Fish are no longer wallet rows that pay Food
// costs at 1/3/1: the cells pay Food directly, at those same rates. What is
// left is worth pinning — a cell's IDENTITY and the currency it PAYS are
// two different things, and the rates survived the fold.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { HARVEST, TAP } from '../src/sim/data/definitions';
import { coordKey, getWallet } from '../src/sim/state';
import { effectiveStock, harvestSourceAt, tapCell } from '../src/sim/harvest';
import { populationCost } from '../src/sim/population';
import { canAfford, pay } from '../src/sim/wallet';
import {
  addBuilt, addTrainer, BERRIES, canGather, completeTech, drain, freshGame, fund, map, T0,
} from './helpers';

const BERRY_BUSH = BERRIES; // the one authored bush
const WILD_ANIMALS = { x: -2, y: -4 }; // also unrevealed

describe('wallet math', () => {
  it('affords what it holds, and nothing more', () => {
    const wallet = { Food: 9, Gold: 2 };
    expect(canAfford(wallet, { Food: 9 })).toBe(true);
    expect(canAfford(wallet, { Food: 10 })).toBe(false);
    expect(canAfford(wallet, { Food: 9, Gold: 3 })).toBe(false);
    expect(canAfford(wallet, { Wood: 1 })).toBe(false); // held at 0
  });

  it('pays by subtracting, with no cross-talk between currencies', () => {
    const wallet = { Food: 9, Gold: 2, Wood: 5 };
    pay(wallet, { Food: 7, Wood: 5 });
    expect(wallet).toEqual({ Food: 2, Gold: 2, Wood: 0 });
  });

  it('buys villagers and units out of the Food the cells paid', () => {
    const state = freshGame(); // rebalanced start: 0 population, empty wallet
    addBuilt(state, 'Housing', { x: 2, y: 0 }); // capacity to train into
    state.city.wallet = { Food: 11 };
    expect(populationCost(0)).toBe(5); // the authored price of the first
    expect(trainUnit(state, 'Villager', T0)).toBe('Queued'); // pays 5 up front
    expect(state.city.wallet).toEqual({ Food: 6 });

    fund(state, { Gold: 100, Wood: 10, Food: 22 });
    completeTech(state, 'Warrior'); // the Warrior sits behind it now
    addTrainer(state, 'Warrior', { x: 3, y: 2 }); // and behind its Barracks
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued'); // 50 Gold + 10 Wood + 20 Food
    expect(getWallet(state.city.wallet, 'Food')).toBe(2);
  });
});

describe('finite map features', () => {
  it('a berry bush pays Food and vanishes for good when drained', () => {
    const state = freshGame();
    canGather(state); // the bush sits behind Forestry now
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe('Berries'); // the CELL is a bush
    // Its depot is the ceiling: however many times the thumb asks, a bush is
    // worth exactly what is in it.
    // Its depot is the ceiling — and the depot is the authored stock times the
    // GROUND under it, so a bush on grassland is richer than one on sand.
    const held = effectiveStock(map, BERRY_BUSH, HARVEST.Berries);
    expect(drain(state, BERRY_BUSH)).toBe(held);
    expect(getWallet(state.city.wallet, 'Food')).toBe(held); // it PAYS Food
    expect(state.features[coordKey(BERRY_BUSH)]).toBeUndefined(); // gone from the map
    expect(harvestSourceAt(state, BERRY_BUSH)).toBe(null);
    expect(tapCell(state, map, BERRY_BUSH, T0)).toBe('NotHarvestable');
  });

  it('wild animals pay Food at 3 a tap, once revealed AND hunted', () => {
    const state = freshGame();
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('NotRevealed');
    state.fog.revealed[coordKey(WILD_ANIMALS)] = true;
    // Game is the one resource behind a technology of its own.
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('TechLocked');
    completeTech(state, 'Hunting');
    expect(tapCell(state, map, WILD_ANIMALS, T0)).toBe('Harvested');
    // A herd is the richest FINITE node — three Food a swing against a bush's
    // one — but a TAP is priced in seconds of that swing, not in the swing, so
    // what the thumb gets is `tap.workSeconds` of butchering.
    expect(getWallet(state.city.wallet, 'Food')).toBe(Math.max(1, Math.floor(
      TAP.workSeconds * HARVEST.Meat.unitsPerStrike / HARVEST.Meat.secondsPerStrike)));
    // Its richness is in the DEPOT and the CREW: a herd holds 30 against a
    // bush's 10, and a hunter takes three a swing against a picker's one.
    expect(HARVEST.Meat.stock).toBeGreaterThan(HARVEST.Berries.stock);
    expect(HARVEST.Meat.unitsPerStrike).toBeGreaterThan(HARVEST.Berries.unitsPerStrike);
  });
});
