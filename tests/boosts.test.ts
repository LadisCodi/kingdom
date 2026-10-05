// Boosts, flasks, tomes, the choice chest and the shortfall sheet
// (Docs/plans/relics-and-bag.md, step 3).

import { describe, expect, it } from 'vitest';
import { lineFor, trainCost } from '../src/sim/army';
import { chestValue, grantItem, itemCount, runningBoost, useItem } from '../src/sim/bag';
import { advance } from '../src/sim/commands';
import { ITEMS } from '../src/sim/data/definitions';
import { manaCap } from '../src/sim/mana';
import { getWallet, townhall, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, freshPresenter, map, rentPerMinute, T0 } from './helpers';

const HOUR = 3_600_000;

function city(): GameState {
  const state = freshGame();
  advance(state, map, T0);
  addBuilt(state, 'Housing', { x: 2, y: 0 });
  state.city.population = 4;
  return state;
}

describe('a boost', () => {
  // THE GATE: a second of the same kind extends the first, never stacks.
  it('extends the running one rather than stacking on it', () => {
    const state = city();
    const base = rentPerMinute(state);
    grantItem(state, 'RentBoost8h', 2);
    useItem(state, 'RentBoost8h', 1, T0);
    const boosted = rentPerMinute(state);
    expect(boosted).toBeGreaterThan(base);
    useItem(state, 'RentBoost8h', 1, T0 + HOUR);
    expect(rentPerMinute(state)).toBe(boosted);
    expect(state.modifiers.filter((m) => m.id === 'boost:Rent')).toHaveLength(1);
    expect(runningBoost(state, 'Rent')!.expiresAt).toBe(T0 + 16 * HOUR);
  });

  it('ends at its expiry, and the replay around it agrees with stepped ticking', () => {
    const run = (stepped: boolean) => {
      const state = city();
      grantItem(state, 'RentBoost8h', 1);
      useItem(state, 'RentBoost8h', 1, T0);
      const end = T0 + 10 * HOUR;
      if (stepped) for (let t = T0 + 60_000; t <= end; t += 60_000) advance(state, map, t);
      else advance(state, map, end);
      return { gold: state.city.districts.map((d) => d.stored?.Gold ?? 0), boost: runningBoost(state, 'Rent') };
    };
    const live = run(true);
    expect(run(false)).toEqual(live);
    expect(live.boost).toBeUndefined();
  });

  it('makes Mana fill faster from the moment it starts', () => {
    const plain = city();
    const boosted = city();
    plain.city.wallet.Mana = 0;
    boosted.city.wallet.Mana = 0;
    plain.city.lastManaAt = T0;
    boosted.city.lastManaAt = T0;
    grantItem(boosted, 'ManaBoost8h', 1);
    useItem(boosted, 'ManaBoost8h', 1, T0);
    advance(plain, map, T0 + HOUR);
    advance(boosted, map, T0 + HOUR);
    expect(getWallet(boosted.city.wallet, 'Mana')).toBeGreaterThan(getWallet(plain.city.wallet, 'Mana'));
  });
});

describe('a flask and a tome', () => {
  it('a flask fills its share of the pool, and what goes over the cap is lost', () => {
    const state = city();
    state.city.wallet.Mana = 0;
    grantItem(state, 'ManaFlaskSmall', 1);
    useItem(state, 'ManaFlaskSmall', 1, T0);
    const cap = manaCap(state);
    expect(getWallet(state.city.wallet, 'Mana')).toBe(Math.floor(cap * ITEMS.ManaFlaskSmall.value / 100));
    grantItem(state, 'ManaFlask', 2);
    useItem(state, 'ManaFlask', 2, T0);
    expect(getWallet(state.city.wallet, 'Mana')).toBe(cap);
  });

  it('a tome lands its Knowledge over the bar\'s cap', () => {
    const state = city();
    state.kingdom.wallet.Knowledge = 10;
    grantItem(state, 'KnowledgeTome', 1);
    useItem(state, 'KnowledgeTome', 1, T0);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(10 + ITEMS.KnowledgeTome.value);
  });
});

describe('the choice chest', () => {
  it('pays the coin picked, at that coin\'s chest of the same size', () => {
    const state = city();
    grantItem(state, 'ChoiceChest1h', 2);
    expect(useItem(state, 'ChoiceChest1h', 1, T0)).toBe('NeedsACoin');
    const wood = getWallet(state.city.wallet, 'Wood');
    expect(useItem(state, 'ChoiceChest1h', 1, T0, 'Wood')).toBe('Used');
    expect(getWallet(state.city.wallet, 'Wood') - wood).toBe(chestValue(state, 'WoodChest1h').Wood);
    expect(itemCount(state, 'ChoiceChest1h')).toBe(1);
  });
});

describe('the shortfall sheet', () => {
  // THE GATE: its Use starts what was refused, the moment the shortfall is met.
  it('opens for a coin the Bag holds chests of, and its Use starts the training once it is met', () => {
    const state = city();
    townhall(state).level = 2;
    for (let x = 3; x <= 5; x++) addBuilt(state, 'Housing', { x, y: 0 });
    const game = freshPresenter(state);
    game.now = () => T0;
    const food = trainCost(state, 'Villager').Food ?? 0;
    expect(food).toBeGreaterThan(0);
    state.city.wallet.Food = 0;
    grantItem(state, 'FoodChest8h', 1);
    game.doQueueTraining();
    expect(game.openOverlay).toBe('shortfall');
    const view = game.shortfallScreen()!;
    expect(view.coin).toBe('Food');
    expect(view.chests.map((c) => c.id)).toEqual(['FoodChest8h']);
    expect(chestValue(state, 'FoodChest8h').Food).toBeGreaterThanOrEqual(food);
    game.doShortfallChest('FoodChest8h');
    expect(game.openOverlay).toBeNull();
    expect(lineFor(state, townhall(state).uniqueId)).toHaveLength(1);
  });

  it('only shakes the purse when the Bag has nothing for it', () => {
    const state = city();
    const game = freshPresenter(state);
    state.city.wallet.Food = 0;
    game.doQueueTraining();
    expect(game.openOverlay).toBeNull();
  });
});
