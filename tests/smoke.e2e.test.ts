// Headless end-to-end smoke: plays the full core loop through the sim command
// API, mirroring the manual checklist in the plan.

import { describe, expect, it } from 'vitest';
import { armyPower } from '../src/sim/army';
import {
  collectFromDistrict, enqueueBuild, changeWorkers, finishWithGems, upgradeDistrict,
} from '../src/sim/commands';
import { generationPerMinute } from '../src/sim/economy';
import { revealTap } from '../src/sim/fog';
import { buyPopulation } from '../src/sim/population';
import { maxPopulation, recalculateCityProduction } from '../src/sim/recalc';
import { deserialize, serialize } from '../src/sim/save';
import { castSpell, canTarget } from '../src/sim/spells';
import { coordKey, getWallet, townhall } from '../src/sim/state';
import { trainUnit } from '../src/sim/army';
import { freshGame, fund, map, rng, T0, tickAt } from './helpers';

describe('full core loop (headless smoke)', () => {
  it('plays reveal → build → staff → collect → magic → population → army → upgrade → offline', () => {
    const state = freshGame();
    state.city.population = 5; // test setup: enough workers to staff Lumber + Farm
    let now = T0;

    // --- Reveal 3 fog cells at distance 2 (3 Silver each: taps of 1).
    const targets = [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
    for (const cell of targets) {
      let result: string = 'Paid';
      while (result === 'Paid') result = revealTap(state, map, cell);
      expect(result).toBe('Revealed');
      recalculateCityProduction(state, map, now, rng);
    }
    expect(getWallet(state.city.wallet, 'Silver')).toBe(50 - 9);

    // --- Build a Lumber next to the revealed Trees at (2,2); 50 Silver blocked → collect tax first.
    fund(state, { Silver: 50 }); // stand-in for tap-collecting the Townhall vault
    expect(enqueueBuild(state, map, 'Lumber', { x: 1, y: 1 }, now, rng)).toBe('Started');

    // --- Queue-full gate: a second enqueue is rejected (capacity 1).
    fund(state, { Silver: 500, Wood: 500 });
    expect(enqueueBuild(state, map, 'Housing', { x: 0, y: 1 }, now, rng)).toBe('QueueFull');

    // --- Gem rush the Lumber build: identical outcome to the timer.
    tickAt(state, now); // stamp start
    const item = state.city.queue[0];
    expect(finishWithGems(state, map, item.uniqueId, now, rng)).toBe('Success');
    const lumber = state.city.districts.find((d) => d.definitionId === 'Lumber')!;
    expect(lumber.state).toBe('Built');
    expect(getWallet(state.player.wallet, 'Gems')).toBeLessThan(10);

    // --- Staff it; wood flows into its vault; tap-collect one unit.
    expect(changeWorkers(state, map, lumber.uniqueId, 1, now, rng)).toBe('Assigned');
    now += 5 * 60_000;
    tickAt(state, now); // 5.5 min at 5/min (30s creation stagger with rng=0.5) = 27 wood
    const woodGen = lumber.generators.find((g) => g.currencyId === 'Wood')!;
    expect(woodGen.vaultStored).toBe(27);
    const woodBefore = getWallet(state.city.wallet, 'Wood');
    collectFromDistrict(state, lumber.uniqueId);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 1);
    expect(woodGen.vaultStored).toBe(26);

    // --- Build a Farm on grassland, then a FarmLands next to it.
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 }, now, rng)).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(farm.state).toBe('Built');
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 }, now, rng)).toBe('Started');
    tickAt(state, now);
    now += 60_000;
    tickAt(state, now);
    changeWorkers(state, map, farm.uniqueId, 1, now, rng);
    changeWorkers(state, map, farm.uniqueId, 1, now, rng);
    const foodGen = farm.generators.find((g) => g.currencyId === 'Food')!;
    expect(generationPerMinute(foodGen)).toBe(8); // 5 base + 3 × 1 worked FarmLands

    // --- Rain the Farm: ×5 Food while active, gone after expiry.
    expect(castSpell(state, map, 'Rain', farm.location, now, rng)).toBe('Cast');
    expect(generationPerMinute(foodGen)).toBe(40);
    // A recalc mid-rain must NOT cancel the boost.
    recalculateCityProduction(state, map, now, rng);
    expect(generationPerMinute(foodGen)).toBe(40);
    now += 31_000;
    tickAt(state, now);
    expect(generationPerMinute(foodGen)).toBe(8);

    // --- Tap a Trees cell to destruction; the Lumber loses its worked tile.
    const treesCell = { x: 2, y: 2 };
    changeWorkers(state, map, lumber.uniqueId, 1, now, rng); // 2 workers: base + 1 tile
    expect(generationPerMinute(woodGen)).toBe(8);
    fund(state, {});
    state.kingdom.wallet.Mana = 100;
    let taps = 0;
    while (state.features[coordKey(treesCell)]?.featureId === 'Trees') {
      expect(castSpell(state, map, 'Tap', treesCell, now, rng)).toBe('Cast');
      taps += 1;
      expect(taps).toBeLessThanOrEqual(12);
    }
    expect(taps).toBeGreaterThanOrEqual(5); // durability 5–12
    expect(state.features[coordKey(treesCell)].featureId).toBe('TreesCut');
    expect(generationPerMinute(woodGen)).toBe(5); // worked tile lost

    // --- Rain the stump: regrows to Trees when the rain ends.
    expect(canTarget(state, 'Rain', treesCell)).toBe(true);
    expect(castSpell(state, map, 'Rain', treesCell, now, rng)).toBe('Cast');
    now += 31_000;
    tickAt(state, now);
    expect(state.features[coordKey(treesCell)].featureId).toBe('Trees');
    expect(generationPerMinute(woodGen)).toBe(8); // worked tile back

    // --- Buy population to the TH1 cap of 7 (needs Housing beyond the Townhall's 3).
    fund(state, { Food: 10_000, Silver: 10_000, Wood: 10_000 });
    expect(maxPopulation(state)).toBe(3); // Townhall only — already over via test setup
    expect(buyPopulation(state)).toBe('AtMax');
    for (const cell of [{ x: 0, y: 1 }, { x: 0, y: -1 }]) {
      expect(enqueueBuild(state, map, 'Housing', cell, now, rng)).toBe('Started');
      tickAt(state, now);
      now += 120_000;
      tickAt(state, now);
    }
    expect(maxPopulation(state)).toBe(7); // 3 + 2×2
    while (buyPopulation(state) === 'Success') { /* buy to max */ }
    expect(state.city.population).toBe(7);
    recalculateCityProduction(state, map, now, rng);

    // --- Recruit to the TH1 power cap of 10.
    expect(trainUnit(state, 'Cavalry')).toBe('Trained'); // 5
    expect(trainUnit(state, 'Cavalry')).toBe('Trained'); // 10
    expect(trainUnit(state, 'Archer')).toBe('ArmyAtCapacity');
    expect(armyPower(state)).toBe(10);

    // --- Upgrade the Townhall: 200 Silver + 25 Wood, instant (completes next tick).
    expect(upgradeDistrict(state, townhall(state).uniqueId)).toBe('Started');
    tickAt(state, now);
    expect(townhall(state).level).toBe(2);
    expect(maxPopulation(state)).toBe(7); // still 2 Housing
    expect(trainUnitCap(state)).toBe(20); // TH2 army cap

    // --- Offline: save, come back 10 minutes later; Townhall vault capped at 50.
    const save = serialize(state, now);
    now += 600_000;
    const restored = deserialize(save, map, now, rng);
    tickAt(restored, now);
    const thGen = townhall(restored).generators.find((g) => g.currencyId === 'Silver')!;
    expect(thGen.vaultStored).toBe(50); // 35/min × 10 min ≫ 50 — overflow lost
  });
});

import { maxArmyPower } from '../src/sim/army';
const trainUnitCap = maxArmyPower;
