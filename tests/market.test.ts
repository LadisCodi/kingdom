// The Market: an instant-sell trade building (Market tech). Optional gold
// on top of housing taxes — no queue, no timers.
import { describe, expect, it } from 'vitest';
import { hasMarket, salePayout, sellGoods, SELLABLE } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import { marketSaleLevelMultiplier } from '../src/sim/upgrades';
import { addBuilt, freshGame, fund, completeRanks } from './helpers';

const MARKET_CELL = { x: 2, y: 0 }; // revealed grassland

describe('instant selling', () => {
  it('requires a built Market district', () => {
    const state = freshGame();
    fund(state, { Wood: 10 });
    expect(hasMarket(state)).toBe(false);
    expect(sellGoods(state, 'Wood', 10).result).toBe('NoMarket');
    addBuilt(state, 'Market', MARKET_CELL);
    expect(hasMarket(state)).toBe(true);
    expect(sellGoods(state, 'Wood', 10).result).toBe('Sold');
  });

  it('pays gold_value per unit, instantly, clamped to what is on hand', () => {
    const state = freshGame();
    addBuilt(state, 'Market', MARKET_CELL);
    fund(state, { Wood: 10, Stone: 2, Gold: 0 }); // measuring the SALE, not the grant
    expect(sellGoods(state, 'Wood', 4)).toEqual({ result: 'Sold', units: 4, gold: 12 }); // 3 each
    expect(getWallet(state.city.wallet, 'Wood')).toBe(6);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(12);
    expect(sellGoods(state, 'Wood', 999)).toEqual({ result: 'Sold', units: 6, gold: 18 });
    expect(sellGoods(state, 'Wood', 1).result).toBe('NothingToSell');
    expect(sellGoods(state, 'Stone', 2)).toEqual({ result: 'Sold', units: 2, gold: 4 });
  });

  it('rejects non-sellable currencies and Gold itself', () => {
    const state = freshGame();
    addBuilt(state, 'Market', MARKET_CELL);
    fund(state, { Gold: 100 });
    state.kingdom.wallet.Knowledge = 5;
    expect(SELLABLE).not.toContain('Gold');
    expect(SELLABLE).not.toContain('Knowledge');
    // Four coins in, three crates out: everything the city produces but Gold.
    expect(SELLABLE).toEqual(['Food', 'Wood', 'Stone']);
    expect(sellGoods(state, 'Gold', 10).result).toBe('NotSellable');
    expect(sellGoods(state, 'Knowledge', 5).result).toBe('NotSellable');
  });

  it('salePayout floors the boosted total, not each unit', () => {
    const state = freshGame();
    completeRanks(state, 'MarketStall', 1); // +5% prices
    expect(salePayout(state, 'Wood', 1)).toBe(3); // floor(3.15)
    expect(salePayout(state, 'Wood', 10)).toBe(31); // floor(31.5)
  });
});

// The Market's own ladder (Docs/features/buildings.md §4.7): ten levels, and
// the only thing a level buys is the price it pays for a unit.
describe('the Market level is the price', () => {
  const marketAt = (level: number) => {
    const state = freshGame();
    addBuilt(state, 'Market', MARKET_CELL);
    state.city.districts.find((d) => d.definitionId === 'Market')!.level = level;
    return state;
  };

  it('pays 3% more a level, and 27% more at ten', () => {
    expect(marketSaleLevelMultiplier(marketAt(1))).toBeCloseTo(1);
    expect(marketSaleLevelMultiplier(marketAt(2))).toBeCloseTo(1.03);
    expect(marketSaleLevelMultiplier(marketAt(10))).toBeCloseTo(1.27);
  });

  it('pays nothing extra with no Market standing', () => {
    expect(marketSaleLevelMultiplier(freshGame())).toBe(1);
  });

  it('reaches the wallet: the same crate sells for more at ten than at one', () => {
    const low = marketAt(1);
    const high = marketAt(10);
    fund(low, { Wood: 100 });
    fund(high, { Wood: 100 });
    expect(sellGoods(high, 'Wood', 100).gold)
      .toBeGreaterThan(sellGoods(low, 'Wood', 100).gold);
  });

  it('stacks with MarketStall rather than replacing it', () => {
    const state = marketAt(10);
    const before = salePayout(state, 'Wood', 100);
    completeRanks(state, 'MarketStall', 1);
    expect(salePayout(state, 'Wood', 100)).toBeGreaterThan(before);
  });

  it('takes the best Market in the city, not the sum of them', () => {
    const state = marketAt(10);
    addBuilt(state, 'Market', { x: 4, y: 0 });
    const second = state.city.districts.filter((d) => d.definitionId === 'Market')[1];
    second.level = 3;
    expect(marketSaleLevelMultiplier(state)).toBeCloseTo(1.27);
  });
});
