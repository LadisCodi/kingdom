// The Train button's amount (x1 · x10 · x100 · All): one press is one order
// of that many, priced whole, and it is all of them or none.
import { describe, expect, it } from 'vitest';
import {
  armyCap, batchCost, committedTroops, trainBatch, trainCost, trainPlan, trainRoom,
} from '../src/sim/army';
import { UNITS } from '../src/sim/data/definitions';
import { getWallet, type GameState } from '../src/sim/state';
import { addAllTrainers, addBuilt, completeTech, freshGame, fund, T0 } from './helpers';

function city(): GameState {
  const state = freshGame();
  addAllTrainers(state);
  completeTech(state, UNITS.Warrior.requiredTech!);
  for (let i = 0; i < 4; i++) addBuilt(state, 'Housing', { x: 2 + i * 2, y: 0 });
  fund(state, { Gold: 1_000_000, Food: 1_000_000, Wood: 1_000_000, Stone: 1_000_000 });
  return state;
}

describe('training a batch', () => {
  it('queues the whole order and charges the whole price', () => {
    const state = city();
    const gold = getWallet(state.city.wallet, 'Gold');
    const each = trainCost(state, 'Warrior').Gold ?? 0;
    expect(trainBatch(state, 'Warrior', 10, T0)).toBe('Queued');
    expect(committedTroops(state)).toBe(10);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - each * 10);
  });

  it('refuses an order there is no room for, and takes nothing', () => {
    const state = city();
    const room = trainRoom(state, 'Warrior');
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(trainBatch(state, 'Warrior', room + 1, T0)).toBe('ArmyAtCapacity');
    expect(committedTroops(state)).toBe(0);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold);
  });

  it('refuses an order the purse cannot pay in full, and takes nothing', () => {
    const state = city();
    state.city.wallet.Gold = (trainCost(state, 'Warrior').Gold ?? 0) * 3;
    expect(trainBatch(state, 'Warrior', 10, T0)).toBe('NotEnoughResources');
    expect(committedTroops(state)).toBe(0);
  });

  it('prices villagers one after the other, each dearer than the last', () => {
    const state = city();
    const one = trainCost(state, 'Villager').Food ?? 0;
    const three = batchCost(state, 'Villager', 3).Food ?? 0;
    expect(three).toBeGreaterThan(one * 3 - 1);
    expect(trainBatch(state, 'Villager', 3, T0)).toBe('Queued');
  });
});

describe('All', () => {
  it('is as many as the room allows when the purse is deep', () => {
    const state = city();
    expect(trainPlan(state, 'Warrior', 'all').count).toBe(armyCap(state) - committedTroops(state));
  });

  it('is as many as the purse allows when it is not', () => {
    const state = city();
    state.city.wallet.Gold = (trainCost(state, 'Warrior').Gold ?? 0) * 4;
    expect(trainPlan(state, 'Warrior', 'all').count).toBe(4);
  });

  it('is still one when nothing is affordable, so the button shows a price', () => {
    const state = city();
    state.city.wallet.Gold = 0;
    expect(trainPlan(state, 'Warrior', 'all').count).toBe(1);
  });
});
