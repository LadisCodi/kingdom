// Upgrades: instant gold purchases, the cost curve, tech-parent gating, and
// the effective-value helpers actually changing sim behavior.
import { describe, expect, it } from 'vitest';
import {
  FOG, HARVEST, TECH_ORDER, UPGRADE_ORDER, UPGRADES,
} from '../src/sim/data/definitions';
import { grantArtifact } from '../src/sim/artifacts';
import { castCost } from '../src/sim/casting';
import { revealCostForCell, revealPerTap } from '../src/sim/fog';
import { collectTap } from '../src/sim/harvest';
import { salePayout, sellGoods } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import {
  buyUpgrade, canBuyUpgrade, effectiveAutoTapCooldownMs, effectiveSalePriceMultiplier,
  effectiveTapYield, effectiveTaxRate, effectiveWorkerYield, upgradeCost, upgradeLevel,
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

// The minor upgrades added 2026-09-02, one per big technology that had none.
//
// The only thing worth asserting about an upgrade is that it REACHES the sim:
// a definition with no consumer is a price tag on nothing, and that is the
// failure mode this whole file exists to catch (see `withWardenBonus`, which
// shipped inert for weeks). So each of these buys a level and measures the
// number the player actually experiences, never the effect table.
describe('every upgrade reaches the number it claims to', () => {
  // The tech tree groups upgrades with `UPGRADE_ORDER.filter(by parent)`, so an
  // upgrade missing from that list is invisible IN THE GAME while still being
  // purchasable by id — which is exactly what happened to Surveying, with a
  // quest pointing the player at a node that was never drawn.
  it('shows every authored upgrade somewhere in the tree', () => {
    expect(UPGRADE_ORDER.slice().sort()).toEqual(Object.keys(UPGRADES).sort());
    for (const id of UPGRADE_ORDER) {
      const parent = UPGRADES[id].requiredTech;
      expect(parent, `${id} hangs off no technology, so nothing draws it`).not.toBeNull();
      expect(TECH_ORDER, `${id} hangs off an unknown technology`).toContain(parent);
    }
  });

  it('Butchery adds to what a tap on wild game yields, and to nothing else', () => {
    const state = freshGame();
    const meat = effectiveTapYield(state, HARVEST.Meat);
    const wood = effectiveTapYield(state, HARVEST.Forest);
    state.upgrades.Butchery = 2;
    expect(effectiveTapYield(state, HARVEST.Meat)).toBe(meat + 2);
    expect(effectiveTapYield(state, HARVEST.Forest)).toBe(wood); // scoped
  });

  it('Scythes adds to a tap on crops', () => {
    const state = freshGame();
    const before = effectiveTapYield(state, HARVEST.Crops);
    state.upgrades.Scythes = 3;
    expect(effectiveTapYield(state, HARVEST.Crops)).toBe(before + 3);
  });

  it('Sawpits and Irrigation add to worker deliveries, each to its own resource', () => {
    const state = freshGame();
    const wood = effectiveWorkerYield(state, HARVEST.Forest);
    const crops = effectiveWorkerYield(state, HARVEST.Crops);
    state.upgrades.Sawpits = 2;
    expect(effectiveWorkerYield(state, HARVEST.Forest)).toBe(wood + 2);
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops);
    state.upgrades.Irrigation = 1;
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops + 1);
  });

  // Pitons and Surveying buy down two DIFFERENT costs — the Gold a cell wants
  // and the taps it takes to pay it — so they have to stack without either
  // making the other pointless.
  it('Pitons discounts the Gold a cell costs, and stacks with Surveying', () => {
    const state = freshGame();
    const cell = { x: 3, y: 1 };
    const full = revealCostForCell(state, map, cell);

    state.upgrades.Pitons = 2; // −20%
    const discounted = revealCostForCell(state, map, cell);
    expect(discounted).toBe(Math.max(FOG.goldPerTap, Math.round(full * 0.8)));

    // Surveying does not touch the price, only the number of presses.
    const tapsBefore = revealPerTap(state);
    state.upgrades.Surveying = 1;
    expect(revealCostForCell(state, map, cell)).toBe(discounted);
    expect(revealPerTap(state)).toBe(tapsBefore + 1);
  });

  it('Pitons can never make a cell free', () => {
    const state = freshGame();
    state.upgrades.Pitons = 99; // far past max, as a modifier stack might
    expect(revealCostForCell(state, map, { x: 3, y: 1 }))
      .toBeGreaterThanOrEqual(FOG.goldPerTap);
  });

  it('Resonance buys down what a relic costs to cast', () => {
    const state = freshGame();
    grantArtifact(state, 'VerdantSeal');
    const full = castCost(state, 'VerdantSeal');
    expect(full).toBeGreaterThan(0);
    state.upgrades.Resonance = 2; // −40%
    expect(castCost(state, 'VerdantSeal')).toBe(Math.round(full * 0.6));
  });

  // Every one of them hangs off a technology, and none is buyable before it.
  it('is locked behind its own technology', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    for (const id of UPGRADE_ORDER) {
      const tech = UPGRADES[id].requiredTech;
      expect(tech, `${id} hangs off nothing`).not.toBeNull();
      expect(canBuyUpgrade(state, id), `${id} is buyable with no research`).toBe(false);
    }
  });
});
