// The Market: drip-selling queued resources for Gold — add/withdraw,
// capacity, timing, sell order, offline replay, determinism.
import { describe, expect, it } from 'vitest';
import { MARKET } from '../src/sim/data/definitions';
import {
  addToSale, nextSaleInSeconds, queuedGoldValue, queuedUnits, removeFromSale,
  rushSale, rushSaleCost,
} from '../src/sim/market';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { freshGame, fund, T0, map, tickAt } from './helpers';

const INTERVAL = MARKET.sellIntervalSeconds * 1000; // 5s

describe('the sell queue', () => {
  it('escrows added units, returns withdrawn ones, rejects non-sellables', () => {
    const state = freshGame();
    fund(state, { Wood: 10, Gold: 5 });
    expect(addToSale(state, 'Gold', 5, T0)).toBe('NotSellable');
    expect(addToSale(state, 'Wood', 4, T0)).toBe('Added');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(6);
    expect(queuedUnits(state)).toBe(4);
    expect(queuedGoldValue(state)).toBe(4 * 2); // Wood sells for 2
    expect(removeFromSale(state, 'Wood', 2)).toBe('Removed');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(8);
    expect(queuedUnits(state)).toBe(2);
  });

  it('is capped at MARKET.capacity units (adds clamp to the free space)', () => {
    const state = freshGame();
    fund(state, { Wood: 200 });
    expect(addToSale(state, 'Wood', 200, T0)).toBe('Added'); // clamped
    expect(queuedUnits(state)).toBe(MARKET.capacity);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(200 - MARKET.capacity);
    expect(addToSale(state, 'Wood', 1, T0)).toBe('MarketFull');
  });
});

describe('drip selling', () => {
  it('sells exactly 1 unit per interval, whole units only', () => {
    const state = freshGame();
    fund(state, { Wood: 10 });
    addToSale(state, 'Wood', 10, T0);
    tickAt(state, T0 + INTERVAL - 1);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    tickAt(state, T0 + INTERVAL);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(2); // 1 Wood = 2 Gold
    tickAt(state, T0 + 3 * INTERVAL + 500); // partial interval carries over
    expect(getWallet(state.city.wallet, 'Gold')).toBe(6);
    tickAt(state, T0 + 3 * INTERVAL + INTERVAL); // ...and completes on schedule
    expect(getWallet(state.city.wallet, 'Gold')).toBe(8);
  });

  it('sells in currency order and stops when the queue empties (no banked time)', () => {
    const state = freshGame();
    fund(state, { Food: 1, Wood: 1 });
    addToSale(state, 'Wood', 1, T0);
    addToSale(state, 'Food', 1, T0);
    tickAt(state, T0 + INTERVAL);
    // Food precedes Wood in the sell order → the first sale pays 1 Gold.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1);
    tickAt(state, T0 + 2 * INTERVAL);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(3);
    expect(queuedUnits(state)).toBe(0);
    // A long empty stretch banks nothing: the next add re-anchors the clock.
    tickAt(state, T0 + 100 * INTERVAL);
    fund(state, { Wood: 1 });
    addToSale(state, 'Wood', 1, T0 + 100 * INTERVAL);
    tickAt(state, T0 + 100 * INTERVAL + INTERVAL - 1);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(3); // not yet
    tickAt(state, T0 + 101 * INTERVAL);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(5);
  });

  it('one-call offline replay equals second-by-second ticking', () => {
    const mk = () => {
      const s = freshGame();
      fund(s, { Wood: 12, Meat: 3 });
      addToSale(s, 'Wood', 12, T0);
      addToSale(s, 'Meat', 3, T0);
      return s;
    };
    const horizon = 90_000; // sells 15 of the 15 queued units? no — 18 slots, 15 units
    const oneCall = mk();
    tickAt(oneCall, T0 + horizon);
    const stepped = mk();
    for (let t = 1000; t <= horizon; t += 1000) tickAt(stepped, T0 + t);
    expect(getWallet(oneCall.city.wallet, 'Gold')).toBe(getWallet(stepped.city.wallet, 'Gold'));
    expect(oneCall.market.queue).toEqual(stepped.market.queue);
  });

  it('reports the time to the next sale', () => {
    const state = freshGame();
    expect(nextSaleInSeconds(state, T0)).toBe(null); // empty queue
    fund(state, { Wood: 2 });
    addToSale(state, 'Wood', 2, T0);
    expect(nextSaleInSeconds(state, T0)).toBe(5);
    tickAt(state, T0 + 3_000);
    expect(nextSaleInSeconds(state, T0 + 3_000)).toBe(2);
    tickAt(state, T0 + INTERVAL); // one sold, clock rolls over
    expect(nextSaleInSeconds(state, T0 + INTERVAL)).toBe(5);
  });

  it('gems rush sells the whole queue instantly (10s per gem, min 1)', () => {
    const state = freshGame(); // 10 Gems
    fund(state, { Wood: 12, Meat: 2 });
    expect(rushSale(state, T0)).toBe('NothingQueued');
    addToSale(state, 'Wood', 12, T0);
    addToSale(state, 'Meat', 2, T0);
    // 14 units × 5s = 70s remaining → 7 gems; payout 12×2 + 2×3 = 30.
    expect(rushSaleCost(state, T0)).toBe(7);
    expect(rushSale(state, T0)).toBe('Success');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(30);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(3);
    expect(queuedUnits(state)).toBe(0);

    fund(state, { Wood: 12 });
    addToSale(state, 'Wood', 12, T0); // 60s → 6 gems > the 3 left
    expect(rushSale(state, T0)).toBe('NotEnoughGems');
    expect(queuedUnits(state)).toBe(12); // untouched
  });

  it('survives the save round-trip and sells during the absence', () => {
    const state = freshGame();
    fund(state, { Berries: 8 });
    addToSale(state, 'Berries', 8, T0);
    tickAt(state, T0 + 2 * INTERVAL); // 2 sold before saving
    expect(getWallet(state.city.wallet, 'Gold')).toBe(2);
    const restored = deserialize(serialize(state, T0 + 2 * INTERVAL), map, T0 + 60_000)!;
    expect(getWallet(restored.city.wallet, 'Gold')).toBe(8); // all 8 sold by 40s
    expect(queuedUnits(restored)).toBe(0);
  });
});
