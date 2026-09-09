// Headless end-to-end smoke: reveal → harvest → build → workers → exhaust →
// recover → research → housing taxes → training queue → market → army →
// upgrade → offline.
import { describe, expect, it } from 'vitest';
import { armySize, armyCap, trainUnit, lineFor } from '../src/sim/army';
import {
  changeWorkers, enqueueBuild, finishWithGems, upgradeDistrict,
} from '../src/sim/commands';
import { TAXES } from '../src/sim/data/definitions';
import { isExhausted, tapCell, tapYieldAt } from '../src/sim/harvest';
import { sellGoods } from '../src/sim/market';
import { cityGoldPerMinute, maxPopulation } from '../src/sim/population';
import { techMultiplier } from '../src/sim/techEffects';
import { isTechComplete, startTech } from '../src/sim/research';
import { revealTap } from '../src/sim/fog';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall } from '../src/sim/state';
import {
  addAllTrainers, completeTech, FOREST, freshGame, fund, map, reveal, T0, tickAt,
} from './helpers';

describe('full harvest-loop playthrough (headless smoke)', () => {
  it('plays the whole loop', () => {
    const state = freshGame();
    state.city.population = 2; // test setup: enough workers on hand
    let now = T0;

    // --- Reveal 3 fog cells: two at distance 2 (5 Gold) and one at
    // distance 3 (10 Gold — 4-neighbor BFS, diagonals don't shortcut).
    // Five taps each, whatever the ring, and the five split the price.
    // A new kingdom is handed a small purse for exactly this; top it to a
    // round 50 so the arithmetic below stays readable.
    state.city.wallet.Gold = 0;
    fund(state, { Gold: 50 });
    // All three must be ungated terrain — (3,0) is Mountain and now needs
    // Scaling Tools before it can be revealed at all.
    for (const cell of [{ x: 1, y: -2 }, { x: 3, y: 1 }, { x: 3, y: 2 }]) {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, cell);
      expect(r).toBe('Revealed');
    }
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 20);

    // --- The Forest is seed-revealed and REFUSES until Forestry is in: the
    // opening beat of the whole game (Docs/features/12-quests.md §2 (quests 2-3)).
    reveal(state, [FOREST]);
    expect(tapCell(state, map, FOREST, now)).toBe('TechLocked');
    completeTech(state, 'Forestry');
    // --- Crop plots are gated behind Agriculture, one row down. Asserted HERE
    // because the Sawmill's own technology, a few beats on, asks for the row
    // above it all the way back to Agriculture — so past that point the plot
    // is already open.
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 })).toBe('InvalidCell'); // locked
    // Five taps of `tap.work_seconds` each, out of the tree's depot.
    const perTap = tapYieldAt(state, map, FOREST, now);
    for (let i = 0; i < 5; i++) expect(tapCell(state, map, FOREST, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(5 * perTap);

    // --- No taxes yet: villagers without a roof pay nothing.
    now += 60_000;
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(50 - 20);

    // --- Build a Sawmill next to the forest; queue-full gate; gem rush.
    fund(state, { Gold: 500, Wood: 500, Knowledge: 500 });
    expect(enqueueBuild(state, map, 'Sawmill', { x: 1, y: 2 })).toBe('InvalidCell'); // behind Saws
    completeTech(state, 'Saws');
    expect(enqueueBuild(state, map, 'Sawmill', { x: 1, y: 2 })).toBe('Started');
    expect(enqueueBuild(state, map, 'Housing', { x: 2, y: 0 })).toBe('NoBuilderFree');
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
    while (tapCell(state, map, FOREST, now) === 'Harvested') { /* drain */ }
    expect(isExhausted(state, map, FOREST, now)).toBe(true);

    // --- The cell recovers on its own after 90s; the worker resumes after.
    now += 91_000;
    tickAt(state, now);
    expect(isExhausted(state, map, FOREST, now)).toBe(false);

    // --- Agriculture came in with the Sawmill's chain (a requirement is the
    // row above, and Saws sits two rows under it), so the plot is open.
    expect(isTechComplete(state, 'Agriculture')).toBe(true);
    expect(startTech(state, 'Agriculture', now)).toBe('AlreadyDone');
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const foodBeforeTap = getWallet(state.city.wallet, 'Food');
    expect(tapCell(state, map, { x: -1, y: 1 }, now)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Food')).toBe(foodBeforeTap + 1);

    // --- The Farm is one research further down: Farming, the row under
    // Agriculture (Docs/features/12-quests.md §2 steps 9-15).
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 })).toBe('InvalidCell'); // locked
    expect(startTech(state, 'Farming', now)).toBe('Started');
    now += 60_000;
    tickAt(state, now);
    expect(isTechComplete(state, 'Farming')).toBe(true);
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

    // --- Housing: villagers live there (2 per house) and pay taxes.
    fund(state, { Food: 10_000, Gold: 10_000, Wood: 10_000, Stone: 500, Iron: 500 });
    expect(maxPopulation(state)).toBe(0);
    expect(trainUnit(state, 'Villager', now)).toBe('AtMax'); // nowhere to live yet
    for (const cell of [{ x: 2, y: 0 }, { x: 0, y: -1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    // TH1 allows 2 houses; at L1 each holds TWO villagers, so the two the test
    // seeded leave room for two more without any upgrade.
    expect(maxPopulation(state)).toBe(4);
    expect(trainUnit(state, 'Villager', now)).toBe('Queued');
    expect(trainUnit(state, 'Villager', now)).toBe('Queued');
    expect(trainUnit(state, 'Villager', now)).toBe('AtMax'); // 2 living + 2 queued = cap
    now += 41_000; // 2 x 20s of training
    tickAt(state, now);
    expect(state.city.population).toBe(4);
    expect(lineFor(state, townhall(state).uniqueId)).toHaveLength(0);

    // Level them up and there is room again.
    for (const house of state.city.districts.filter((d) => d.definitionId === 'Housing')) {
      house.level = 2;
    }
    expect(maxPopulation(state)).toBe(8); // two L2 houses (4 each)

    // --- Taxes: 4 housed villagers x 30 Gold/min, fully idle.
    const goldBeforeTaxes = getWallet(state.city.wallet, 'Gold');
    now += 60_000;
    tickAt(state, now);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThanOrEqual(goldBeforeTaxes + 7);

    // --- The Market building (Market tech): instant selling.
    expect(enqueueBuild(state, map, 'Market', { x: 3, y: 1 })).toBe('InvalidCell'); // locked
    completeTech(state, 'Market');
    reveal(state, [{ x: 6, y: 0 }]); // open water east of the isle
    expect(enqueueBuild(state, map, 'Market', { x: 6, y: 0 })).toBe('InvalidCell'); // water
    expect(enqueueBuild(state, map, 'Market', { x: 3, y: 1 })).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const goldBeforeSale = getWallet(state.city.wallet, 'Gold');
    expect(sellGoods(state, 'Wood', 10)).toMatchObject({ result: 'Sold', gold: 30 });
    expect(getWallet(state.city.wallet, 'Gold')).toBe(goldBeforeSale + 30);

    // --- Army: a unit sits behind a technology AND behind its own building,
    // and the cap comes from the buildings rather than from the Townhall.
    expect(trainUnit(state, 'Warrior', now)).toBe('TechRequired');
    completeTech(state, 'Warrior');
    expect(trainUnit(state, 'Warrior', now)).toBe('NoBuilding');
    expect(armyCap(state)).toBe(0);
    addAllTrainers(state);
    // Four halls at level 1, in TROOPS: the cap counts soldiers, not what
    // they are worth (Docs/features/combat.md §14).
    expect(armyCap(state)).toBe(600);
    expect(trainUnit(state, 'Cavalry', now)).toBe('TechRequired');
    completeTech(state, 'Archery');
    completeTech(state, 'Cavalry');
    expect(trainUnit(state, 'Cavalry', now)).toBe('Queued');
    expect(trainUnit(state, 'Cavalry', now)).toBe('Queued');
    // Training takes real time now, and a building runs ONE line: two Cavalry
    // is 2 x 30s at the Stables, not 30s in parallel.
    now += 31_000;
    tickAt(state, now);
    expect(armySize(state)).toBe(1); // the first one only
    now += 30_000;
    tickAt(state, now);
    expect(armySize(state)).toBe(2);

    // --- The Townhall upgrade (30 s) raises the Housing count, not the army.
    // Relative, not a frozen 24: the unit technologies above pulled `Colours
    // I` (+2 cap) in with them, since a requirement is the row above and that
    // card sits on the way — what the army cap IS here is the tree's business,
    // what this asserts is that the Townhall does not move it.
    const armyBefore = armyCap(state);
    expect(upgradeDistrict(state, townhall(state).uniqueId)).toBe('Started');
    tickAt(state, now);
    now += 31_000;
    tickAt(state, now);
    expect(townhall(state).level).toBe(2);
    expect(armyCap(state)).toBe(armyBefore); // unchanged — it is a city decision

    // --- Two more houses at TH2, then queue BOTH new villagers up front.
    for (const cell of [{ x: -1, y: -1 }, { x: 2, y: 1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(12); // two L2 houses (4 each) + two L1 (2 each)
    expect(trainUnit(state, 'Villager', now)).toBe('Queued');
    expect(trainUnit(state, 'Villager', now)).toBe('Queued');
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(5);
    now += 20_000;
    tickAt(state, now);
    expect(state.city.population).toBe(6);
    expect(lineFor(state, townhall(state).uniqueId)).toHaveLength(0);

    // --- Offline: 10 minutes away keep taxes and deliveries flowing.
    const save = serialize(state, now);
    const gold = getWallet(state.city.wallet, 'Gold');
    const restored = deserialize(save, map, now + 600_000)!;
    const earned = getWallet(restored.city.wallet, 'Gold') - gold;
    // Six villagers across four houses, filled in BUILD ORDER: the two L2
    // houses (capacity 4) take 4 and 2, the two L1 houses stand empty and pay
    // nothing. Each occupied house has exactly one crowding neighbour, and the
    // rate per villager is the sheet's 30 lifted by whatever tax rank the
    // Market's chain pulled in on the way (`Taxes I`, +5% at Housing — a
    // requirement is the row above, and that card sits on it):
    // (4 × 31.5 − 1) + (2 × 31.5 − 1) = 187/min.
    const perVillager = TAXES.goldPerPopulationPerMinute
      * techMultiplier(state, 'taxRate', { district: 'Housing' });
    const perMinute = (4 * perVillager - 1) + (2 * perVillager - 1);
    expect(perMinute).toBe(cityGoldPerMinute(state));
    expect(earned).toBeGreaterThanOrEqual(perMinute * 10 - 1);
    expect(earned).toBeLessThanOrEqual(perMinute * 10 + 1);
    expect(getWallet(restored.city.wallet, 'Wood'))
      .toBeGreaterThan(getWallet(state.city.wallet, 'Wood'));
  });
});
