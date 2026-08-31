// Technologies: slots (base + gem-bought), the requires tree, timed
// completion through the unified advance, and the save round-trip.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { enqueueBuild } from '../src/sim/commands';
import { RESEARCH_SETTINGS, TECHNOLOGIES } from '../src/sim/data/definitions';
import { placementBlock } from '../src/sim/districts';
import {
  buySlot, isTechComplete, slotGemCost, startTech, techSlots,
} from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { buyUpgrade } from '../src/sim/upgrades';
import { completeTech, freshGame, fund, map, T0, tickAt } from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

describe('technology basics', () => {
  it('the farming chain: Agriculture unlocks FarmLands, Irrigation unlocks the Farm', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe('NeedsResearch');
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(startTech(state, 'Irrigation', T0)).toBe('MissingRequirement'); // needs Agriculture

    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(startTech(state, 'Agriculture', T0)).toBe('AlreadyActive');
    const durationMs = TECHNOLOGIES.Agriculture.durationSeconds * 1000;
    tickAt(state, T0 + durationMs - 1000);
    expect(isTechComplete(state, 'Agriculture')).toBe(false);
    tickAt(state, T0 + durationMs);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(startTech(state, 'Agriculture', T0 + durationMs)).toBe('AlreadyDone');

    // Crop plots open up; the Farm still needs the follow-up tech.
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe(null);
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    completeTech(state, 'Irrigation');
    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('Started');
  });

  it('gates units: Archer needs Archery; Swordsman is never gated', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    expect(trainUnit(state, 'Swordsman')).toBe('Trained');
    expect(trainUnit(state, 'Archer')).toBe('TechRequired');
    completeTech(state, 'Archery');
    expect(trainUnit(state, 'Archer')).toBe('Trained');
  });

  it('the requires tree: CavalryTraining is blocked until Archery is done', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    expect(startTech(state, 'CavalryTraining', T0)).toBe('MissingRequirement');
    completeTech(state, 'Archery');
    expect(startTech(state, 'CavalryTraining', T0)).toBe('Started');
  });

  it('costs are paid up front', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500 });
    startTech(state, 'Archery', T0); // 150 Gold + 20 Wood
    expect(state.city.wallet.Gold).toBe(1000 - 150);
    expect(state.city.wallet.Wood).toBe(500 - 20);
  });
});

describe('research slots', () => {
  it('base slot limits concurrency; a gem-bought slot lifts it', () => {
    const state = freshGame(); // 10 Gems
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.techSlots); // 1
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(startTech(state, 'Archery', T0)).toBe('NoFreeSlot');

    expect(slotGemCost(state)).toBe(10);
    expect(buySlot(state)).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(techSlots(state)).toBe(2);
    expect(startTech(state, 'Archery', T0)).toBe('Started');

    // Escalating price for the next one — and 0 gems left.
    expect(slotGemCost(state)).toBe(30);
    expect(buySlot(state)).toBe('NotEnoughGems');
  });

  it('slots are capped at research.max_slots', () => {
    const state = freshGame();
    state.player.wallet.Gems = 999;
    expect(buySlot(state)).toBe('Purchased'); // → 2
    expect(buySlot(state)).toBe('Purchased'); // → 3 = max
    expect(buySlot(state)).toBe('AtMax');
    expect(techSlots(state)).toBe(RESEARCH_SETTINGS.maxSlots);
  });

  it('two active technologies complete independently, in time order', () => {
    const state = freshGame();
    state.player.wallet.Gems = 10;
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    buySlot(state);
    startTech(state, 'Archery', T0); // 60s
    startTech(state, 'Agriculture', T0 + 5_000); // 45s → done at 50s
    tickAt(state, T0 + 50_000);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(isTechComplete(state, 'Archery')).toBe(false);
    tickAt(state, T0 + 60_000);
    expect(isTechComplete(state, 'Archery')).toBe(true);
    expect(state.research.active).toHaveLength(0);
  });
});

describe('save round-trip', () => {
  it('restores completed techs, active researches, slots and upgrade levels', () => {
    const state = freshGame();
    state.player.wallet.Gems = 10;
    fund(state, { Gold: 10_000, Wood: 500, Food: 500 });
    completeTech(state, 'Agriculture');
    buySlot(state);
    startTech(state, 'Archery', T0);
    expect(buyUpgrade(state, 'TapPower')).toBe('Purchased');

    // Reload mid-research: it finishes in real time during the absence.
    const restored = deserialize(serialize(state, T0 + 10_000), map, T0 + 600_000)!;
    expect(isTechComplete(restored, 'Agriculture')).toBe(true);
    expect(isTechComplete(restored, 'Archery')).toBe(true);
    expect(restored.research.slotsPurchased).toBe(1);
    expect(restored.upgrades.TapPower).toBe(1);
  });
});
