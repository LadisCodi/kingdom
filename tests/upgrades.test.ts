// Upgrades: instant gold purchases, the cost curve, tech-parent gating, and
// the effective-value helpers actually changing sim behavior.
import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../src/sim/data/definitions';
import { collectTap } from '../src/sim/harvest';
import { salePayout, sellGoods } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import {
  buyUpgrade, effectiveAutoTapCooldownMs, effectiveSalePriceMultiplier,
  effectiveTaxRate, upgradeCost, upgradeLevel,
} from '../src/sim/upgrades';
import {
  addBuilt, canGather, completeTech, FOREST, freshGame, fund, map, T0, tickAt,
} from './helpers';


describe('buying upgrades', () => {
  it('is instant, gold-only, with an escalating cost curve', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    completeTech(state, 'Forestry');
    expect(upgradeCost('TapPower', 0)).toBe(50);
    expect(upgradeCost('TapPower', 1)).toBe(110); // 50 × 2.2
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    expect(upgradeLevel(state, 'TapPower')).toBe(1);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(950);
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(840);
  });

  it('hangs off its parent technology in the tree', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    expect(buyUpgrade(state, 'TapPower')).toBe('TechRequired'); // Forestry
    expect(buyUpgrade(state, 'MarketStall')).toBe('TechRequired'); // Market
    completeTech(state, 'Forestry');
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');
    expect(buyUpgrade(state, 'MarketStall')).toBe('TechRequired'); // still
    completeTech(state, 'Market');
    expect(buyUpgrade(state, 'MarketStall')).toBe('Purchased');
  });

  it('rejects when poor and stops at max level', () => {
    const state = freshGame();
    state.city.wallet.Gold = 0; // the opening grant would cover the first level
    completeTech(state, 'Forestry');
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
    canGather(state);
    buyUpgrade(state, 'TapPower'); // +1
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2); // 1 base + 1
  });

  // QuickHands shortens the gap between AUTO-taps only. A deliberate tap has
  // no cooldown to shave, so the upgrade is a convenience — it narrows the gap
  // toward manual tapping without ever closing it.
  it('QuickHands shortens the auto-tap cooldown, and nothing else', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    completeTech(state, 'Forestry');
    expect(effectiveAutoTapCooldownMs(state)).toBe(500);

    buyUpgrade(state, 'QuickHands'); // -0.05s
    expect(effectiveAutoTapCooldownMs(state)).toBe(450);

    while (buyUpgrade(state, 'QuickHands') === 'Purchased') { /* to max */ }
    expect(upgradeLevel(state, 'QuickHands')).toBe(UPGRADES.QuickHands.maxLevel);
    // 0.5 - 5x0.05 = 0.25s: still slower than a determined tapper.
    expect(effectiveAutoTapCooldownMs(state)).toBe(250);
  });

  it('QuickHands never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    while (buyUpgrade(state, 'QuickHands') === 'Purchased') { /* to max */ }

    // Manual taps ignore the cooldown entirely, maxed upgrade or not.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    // A held repeat still waits, just less than it used to.
    expect(collectTap(state, map, FOREST, T0 + 2, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + 1 + 250, true)).toBe('Harvested');
  });

  it('MarketStall raises the Market sale prices', () => {
    const state = freshGame();
    addBuilt(state, 'Market', { x: 2, y: 0 });
    fund(state, { Gold: 1000, Wood: 100 });
    completeTech(state, 'Market');
    expect(salePayout(state, 'Wood', 100)).toBe(300);
    buyUpgrade(state, 'MarketStall'); // +5%
    expect(effectiveSalePriceMultiplier(state)).toBeCloseTo(1.05);
    expect(sellGoods(state, 'Wood', 100).gold).toBe(315);
  });

  it('TradeRoutes boosts the passive tax rate', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1;
    fund(state, { Gold: 1000 });
    completeTech(state, 'Market');
    expect(effectiveTaxRate(state)).toBe(30);
    buyUpgrade(state, 'TradeRoutes'); // +10% → 33/min
    expect(effectiveTaxRate(state)).toBeCloseTo(33);
    tickAt(state, T0 + 301_000); // ~5 min × 33/min → 165 gold (150 unboosted)
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1000 - 150 + 165);
  });
});
