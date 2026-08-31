// Headless end-to-end smoke of the harvest loop: reveal → build → workers →
// tap → exhaust → rain → recover → population → army → upgrade → offline.
import { describe, expect, it } from 'vitest';
import { armyPower, maxArmyPower, trainUnit } from '../src/sim/army';
import {
  changeWorkers, enqueueBuild, finishWithGems, townhallTap, upgradeDistrict,
} from '../src/sim/commands';
import { isExhausted, tapCell } from '../src/sim/harvest';
import { buyPopulation, maxPopulation } from '../src/sim/population';
import { isResearched, startResearch } from '../src/sim/research';
import { revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall } from '../src/sim/state';
import { freshGame, fund, map, T0, tickAt } from './helpers';

describe('full harvest-loop playthrough (headless smoke)', () => {
  it('plays the whole loop', () => {
    const state = freshGame();
    state.city.population = 5; // test setup: enough workers on hand
    let now = T0;

    // --- Reveal 3 fog cells at distance 4 (10 Silver each, tap by tap).
    // (The Townhall's fog radius 3 already reveals everything closer.)
    for (const cell of [{ x: 5, y: 0 }, { x: 5, y: 2 }, { x: 5, y: 3 }]) {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, cell);
      expect(r).toBe('Revealed');
    }
    expect(getWallet(state.city.wallet, 'Silver')).toBe(50 - 30);

    // --- Tap the (seed-revealed) Forest for Wood, free.
    for (let i = 0; i < 5; i++) expect(tapCell(state, map, { x: 2, y: 2 }, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(5);

    // --- Tap the Townhall to rush its tax cycle (10s cycle, 2s per tap).
    const silverBefore = getWallet(state.city.wallet, 'Silver');
    let paid = 0;
    for (let i = 0; i < 5; i++) paid += townhallTap(state, now);
    expect(paid).toBe(25); // 5 taps × 2s = one full cycle at 5 × pop 5
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silverBefore + 25);

    // --- Build a Sawmill next to the forest; queue-full gate; gem rush.
    fund(state, { Silver: 500, Wood: 500 });
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

    // --- FarmLands stands alone now: build one, tap it by hand for Food.
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const foodBeforeTap = getWallet(state.city.wallet, 'Food');
    expect(tapCell(state, map, { x: -1, y: 1 }, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Food')).toBe(foodBeforeTap + 1);

    // --- The Farm is gated behind the first research (Agriculture).
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 })).toBe('InvalidCell'); // locked
    expect(startResearch(state, 'Agriculture', now)).toBe('Started');
    now += 60_000; // research takes 45s
    tickAt(state, now);
    expect(isResearched(state, 'Agriculture')).toBe(true);

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

    // --- Population to the TH1 cap of 7 via Housing.
    fund(state, { Food: 10_000, Silver: 10_000, Wood: 10_000 });
    expect(maxPopulation(state)).toBe(3);
    expect(buyPopulation(state)).toBe('AtMax'); // already 5 via test setup
    for (const cell of [{ x: 2, y: 0 }, { x: 0, y: -1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(7);
    while (buyPopulation(state) === 'Success') { /* to max */ }
    expect(state.city.population).toBe(7);

    // --- Army to the TH1 power cap.
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Archer')).toBe('ArmyAtCapacity');
    expect(armyPower(state)).toBe(10);

    // --- Instant Townhall upgrade raises the army cap.
    expect(upgradeDistrict(state, townhall(state).uniqueId)).toBe('Started');
    tickAt(state, now);
    expect(townhall(state).level).toBe(2);
    expect(maxArmyPower(state)).toBe(20);

    // --- Offline: 10 minutes away pays Townhall cycles and worker deliveries.
    const save = serialize(state, now);
    const silver = getWallet(state.city.wallet, 'Silver');
    const restored = deserialize(save, map, now + 600_000)!;
    expect(getWallet(restored.city.wallet, 'Silver')).toBe(silver + 60 * 5 * 7); // 60 cycles
    expect(getWallet(restored.city.wallet, 'Wood')).toBeGreaterThan(getWallet(state.city.wallet, 'Wood'));
  });
});
