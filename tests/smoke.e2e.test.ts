// Headless end-to-end smoke: reveal → harvest → build → workers → exhaust →
// recover → research → housing taxes → training queue → market → army →
// upgrade → offline.
import { describe, expect, it } from 'vitest';
import { armyPower, maxArmyPower, trainUnit } from '../src/sim/army';
import {
  changeWorkers, enqueueBuild, finishWithGems, townhallTap, upgradeDistrict,
} from '../src/sim/commands';
import { isExhausted, tapCell } from '../src/sim/harvest';
import { sellGoods } from '../src/sim/market';
import { maxPopulation, queueTraining } from '../src/sim/population';
import { isTechComplete, startTech } from '../src/sim/research';
import { revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall } from '../src/sim/state';
import { completeTech, freshGame, fund, map, T0, tickAt } from './helpers';

describe('full harvest-loop playthrough (headless smoke)', () => {
  it('plays the whole loop', () => {
    const state = freshGame();
    state.city.population = 2; // test setup: enough workers on hand
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

    // --- No taxes yet: villagers without a roof pay nothing.
    now += 60_000;
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 9);

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

    // --- Housing: villagers live there (1 per house) and pay taxes.
    fund(state, { Food: 10_000, Gold: 10_000, Wood: 10_000, Stone: 500, Iron: 500 });
    expect(maxPopulation(state)).toBe(0);
    expect(queueTraining(state, now)).toBe('AtMax'); // nowhere to live yet
    for (const cell of [{ x: 2, y: 0 }, { x: 0, y: -1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(2); // TH1 allows 2 houses × 1 resident
    expect(queueTraining(state, now)).toBe('AtMax'); // both already housed

    // --- Taxes: 2 housed villagers × 30 Gold/min, fully idle.
    const goldBeforeTaxes = getWallet(state.city.wallet, 'Gold');
    now += 60_000;
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThanOrEqual(goldBeforeTaxes + 7);

    // --- The Market building (Commerce tech): instant selling.
    // ((3,0) is cove water — the NeedsLand rule keeps land buildings dry.)
    expect(enqueueBuild(state, map, 'Market', { x: 3, y: 1 })).toBe('InvalidCell'); // locked
    completeTech(state, 'Commerce');
    expect(enqueueBuild(state, map, 'Market', { x: 3, y: 0 })).toBe('InvalidCell'); // water
    expect(enqueueBuild(state, map, 'Market', { x: 3, y: 1 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const goldBeforeSale = getWallet(state.city.wallet, 'Gold');
    expect(sellGoods(state, 'Wood', 10)).toMatchObject({ result: 'Sold', gold: 30 });
    expect(getWallet(state.city.wallet, 'Gold')).toBe(goldBeforeSale + 30);

    // --- Army: every unit sits behind a technology.
    expect(trainUnit(state, 'Swordsman')).toBe('TechRequired');
    completeTech(state, 'Militia');
    expect(trainUnit(state, 'Cavalry')).toBe('TechRequired');
    completeTech(state, 'Archery');
    completeTech(state, 'CavalryTraining');
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(trainUnit(state, 'Archer')).toBe('ArmyAtCapacity');
    expect(armyPower(state)).toBe(10);

    // --- Instant Townhall upgrade raises the army cap AND the Housing count.
    expect(upgradeDistrict(state, townhall(state).uniqueId)).toBe('Started');
    tickAt(state, now);
    expect(townhall(state).level).toBe(2);
    expect(maxArmyPower(state)).toBe(20);

    // --- Two more houses at TH2, then queue BOTH new villagers up front.
    for (const cell of [{ x: -1, y: -1 }, { x: 2, y: 1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(4);
    expect(queueTraining(state, now)).toBe('Queued');
    expect(queueTraining(state, now)).toBe('Queued');
    expect(queueTraining(state, now)).toBe('AtMax'); // 2 + 2 queued = cap
    expect(townhallTap(state, now)).toBe('Boosted'); // taps speed the current one
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(3);
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(4);
    expect(state.city.training).toBe(null);

    // --- Offline: 10 minutes away keep taxes and deliveries flowing.
    const save = serialize(state, now);
    const gold = getWallet(state.city.wallet, 'Gold');
    const restored = deserialize(save, map, now + 600_000)!;
    const earned = getWallet(restored.city.wallet, 'Gold') - gold;
    // 4 housed × 30/min, minus two crowding pairs (−1 × 4) → 116/min.
    expect(earned).toBeGreaterThanOrEqual(1159);
    expect(earned).toBeLessThanOrEqual(1161);
    expect(getWallet(restored.city.wallet, 'Wood'))
      .toBeGreaterThan(getWallet(state.city.wallet, 'Wood'));
  });
});
