// Upgrades: instant gold purchases, the cost curve, gating, and the
// effective-value helpers actually changing sim behavior.
import { describe, expect, it } from 'vitest';
import { MARKET, TAP, UPGRADES } from '../src/sim/data/definitions';
import { collectTap } from '../src/sim/harvest';
import { addToSale, advanceMarket, queuedUnits } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import {
  buyUpgrade, effectiveCollectCooldownMs, effectiveMarketCapacity,
  effectiveSellIntervalMs, upgradeCost, upgradeLevel,
} from '../src/sim/upgrades';
import { freshGame, fund, map, T0 } from './helpers';

const FOREST = { x: 2, y: 2 }; // seed-revealed Trees cell

describe('buying upgrades', () => {
  it('is instant, gold-only, with an escalating cost curve', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    expect(upgradeCost('TapPower', 0)).toBe(50);
    expect(upgradeCost('TapPower', 1)).toBe(110); // 50 × 2.2
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    expect(upgradeLevel(state, 'TapPower')).toBe(1);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(950);
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(840);
  });

  it('rejects when poor and stops at max level', () => {
    const state = freshGame(); // 0 Gold
    expect(buyUpgrade(state, 'TapPower')).toBe('NotEnoughResources');
    fund(state, { Gold: 1_000_000 });
    for (let i = 0; i < UPGRADES.TapPower.maxLevel; i++) {
      expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    }
    expect(buyUpgrade(state, 'TapPower')).toBe('AtMax');
  });
});

describe('effects reach the sim', () => {
  it('TapPower increases what a collect tap yields', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    buyUpgrade(state, 'TapPower'); // +1
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2); // 1 base + 1
  });

  it('QuickHands shortens the collect cooldown', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    const baseMs = TAP.collectCooldownSeconds * 1000; // 500
    expect(effectiveCollectCooldownMs(state)).toBe(baseMs);
    buyUpgrade(state, 'QuickHands'); // −0.05s
    expect(effectiveCollectCooldownMs(state)).toBe(baseMs - 50);
    collectTap(state, map, FOREST, T0);
    expect(collectTap(state, map, FOREST, T0 + baseMs - 50)).toBe('Harvested'); // base would still be cooling
  });

  it('MarketStall raises the queue capacity', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500 });
    buyUpgrade(state, 'MarketStall'); // +25
    expect(effectiveMarketCapacity(state)).toBe(MARKET.capacity + 25);
    addToSale(state, 'Wood', 500, T0);
    expect(queuedUnits(state)).toBe(MARKET.capacity + 25);
  });

  it('TradeRoutes speeds up the drip', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 10 });
    buyUpgrade(state, 'TradeRoutes'); // 5s → 4.5s
    expect(effectiveSellIntervalMs(state)).toBe(4500);
    addToSale(state, 'Wood', 10, T0);
    advanceMarket(state, T0 + 9_000); // two sales at 4.5s
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1000 - 150 + 4);
  });
});
