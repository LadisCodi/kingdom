// Headless end-to-end smoke: reveal → harvest → market → build → workers →
// exhaust → recover → research → training → army → upgrade → offline.
import { describe, expect, it } from 'vitest';
import { armyPower, maxArmyPower, trainUnit } from '../src/sim/army';
import {
  changeWorkers, enqueueBuild, finishWithGems, townhallTap, upgradeDistrict,
} from '../src/sim/commands';
import { isExhausted, tapCell } from '../src/sim/harvest';
import { addToSale } from '../src/sim/market';
import { maxPopulation, startTraining } from '../src/sim/population';
import { isTechComplete, startTech } from '../src/sim/research';
import { revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall } from '../src/sim/state';
import { completeTech, freshGame, fund, map, T0, tickAt } from './helpers';

describe('full harvest-loop playthrough (headless smoke)', () => {
  it('plays the whole loop', () => {
    const state = freshGame();
    state.city.population = 5; // test setup: enough workers on hand
    let now = T0;

    // --- Reveal 3 fog cells at distance 2 (3 Gold each, tap by tap).
    // (The start has 0 Gold — fund the reveal budget.)
    fund(state, { Gold: 50 });
    for (const cell of [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }]) {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, cell);
      expect(r).toBe('Revealed');
    }
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 9);

    // --- Tap the (seed-revealed) Forest for Wood, free.
    for (let i = 0; i < 5; i++) expect(tapCell(state, map, { x: 2, y: 2 }, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(5);

    // --- Sell the wood at the Market: 1 unit / 5s, 2 Gold each.
    const goldBefore = getWallet(state.city.wallet, 'Gold');
    expect(addToSale(state, 'Wood', 5, now)).toBe('Added');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(0); // escrowed in the queue
    now += 26_000; // 5 sells at 5s each
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(goldBefore + 5 * 2);

    // --- Build a Sawmill next to the forest; queue-full gate; gem rush.
    fund(state, { Gold: 500, Wood: 500 });
    expect(enqueueBuild(state, map, 'Sawmill', { x: 1, y: 2 })).toBe('InvalidCell'); // behind Forestry
    completeTech(state, 'Forestry');
    expect(enqueueBuild(state, map, 'Sawmill', { x: 1, y: 2 })).toBe('Started');
    expect(enqueueBuild(state, map, 'Housing', { x: 2, y: 0 })).toBe('QueueFull');
    tickAt(state, now);
    expect(finishWithGems(state, map, state.city.queue[0].uniqueId, now)).toBe('Success');
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    expect(sawmill.state).toBe('Built');

    // --- Staff it; the worker harvests; the shared tap pool exhausts the cell.
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, now)).toBe('Assigned');
    now += 60_000;
    tickAt(state, now);
    const woodAfterCycles = getWallet(state.city.wallet, 'Wood');
    expect(woodAfterCycles).toBeGreaterThan(5); // deliveries landed
    // Player finishes off the cell's remaining taps.
    while (tapCell(state, map, { x: 2, y: 2 }, now) === 'Harvested') { /* drain */ }
    expect(isExhausted(state, { x: 2, y: 2 }, now)).toBe(true);

    // --- The cell recovers on its own after 90s; the worker resumes after.
    now += 91_000;
    tickAt(state, now);
    expect(isExhausted(state, { x: 2, y: 2 }, now)).toBe(false);

    // --- Crop plots are gated behind Agriculture.
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 })).toBe('InvalidCell'); // locked
    expect(startTech(state, 'Agriculture', now)).toBe('Started');
    now += 60_000; // research takes 45s
    tickAt(state, now);
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const foodBeforeTap = getWallet(state.city.wallet, 'Food');
    expect(tapCell(state, map, { x: -1, y: 1 }, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Food')).toBe(foodBeforeTap + 1);

    // --- The Farm needs the follow-up tech, Irrigation.
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 })).toBe('InvalidCell'); // locked
    expect(startTech(state, 'Irrigation', now)).toBe('Started');
    now += 70_000; // research takes 60s
    tickAt(state, now);
    expect(isTechComplete(state, 'Irrigation')).toBe(true);

    // --- Build the Farm next to the plot; its worker harvests it automatically.
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(farm.state).toBe('Built');
    expect(enqueueBuild(state, map, 'FarmLands', { x: -2, y: 5 })).toBe('InvalidCell'); // not revealed
    expect(changeWorkers(state, map, farm.uniqueId, 1, now)).toBe('Assigned');
    const food = getWallet(state.city.wallet, 'Food');
    now += 60_000;
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Food')).toBeGreaterThan(food);

    // --- Population to the TH1 cap of 7 via Housing + timed training.
    fund(state, { Food: 10_000, Gold: 10_000, Wood: 10_000 });
    expect(maxPopulation(state)).toBe(3);
    expect(startTraining(state, now)).toBe('AtMax'); // already 5 via test setup
    for (const cell of [{ x: 2, y: 0 }, { x: 0, y: -1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(7);
    // Train villager 6 (taps boost it) and villager 7 (waits it out).
    expect(startTraining(state, now)).toBe('Started');
    expect(townhallTap(state, now)).toBe('Boosted');
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(6);
    expect(startTraining(state, now)).toBe('Started');
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(7);
    expect(startTraining(state, now)).toBe('AtMax');

    // --- Army to the TH1 power cap (Cavalry sits behind two techs).
    expect(trainUnit(state, 'Cavalry')).toBe('TechRequired');
    completeTech(state, 'Archery');
    completeTech(state, 'CavalryTraining');
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Archer')).toBe('ArmyAtCapacity');
    expect(armyPower(state)).toBe(10);

    // --- Instant Townhall upgrade raises the army cap.
    expect(upgradeDistrict(state, townhall(state).uniqueId)).toBe('Started');
    tickAt(state, now);
    expect(townhall(state).level).toBe(2);
    expect(maxArmyPower(state)).toBe(20);

    // --- Offline: 10 minutes away drip-sells the queued goods + worker deliveries.
    expect(addToSale(state, 'Wood', 30, now)).toBe('Added');
    const save = serialize(state, now);
    const gold = getWallet(state.city.wallet, 'Gold');
    const restored = deserialize(save, map, now + 600_000)!;
    expect(getWallet(restored.city.wallet, 'Gold')).toBe(gold + 30 * 2); // queue sold out
    expect(getWallet(restored.city.wallet, 'Wood')).toBeGreaterThan(getWallet(state.city.wallet, 'Wood'));
  });
});
