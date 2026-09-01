// The Stone / Fish / Iron expansion: new features and buildings, the
// Masonry→Mining chain, coastal placement, water respawns, iron-gated army,
// and Fish as a food-valued currency.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { changeWorkers, enqueueBuild, finishWithGems } from '../src/sim/commands';
import { placementBlock } from '../src/sim/districts';
import { tapCell } from '../src/sim/harvest';
import { startTech } from '../src/sim/research';
import { coordKey, getWallet } from '../src/sim/state';
import { effectiveAmount, pay } from '../src/sim/wallet';
import { completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

const NEAR_ROCKS = { x: 4, y: -1 }; // mainland Rocks (authored)
const QUARRY_CELL = { x: 4, y: 0 }; // grassland beside them
const COVE_WATER = { x: -3, y: -1 }; // open water west of the isle
const SHOAL = { x: -5, y: 2 }; // authored FishShoal on Water
// Docks anchor: 2×1 pier — (-6,3) is Water, (-5,3) is Grassland (mirrored case).
const PIER = { x: -6, y: 3 };
const PIER_LAND = { x: -5, y: 3 };
const INLAND = { x: -1, y: 3 }; // (-1,3)+(0,3): two land cells, no shoreline

describe('stone line (Masonry → Quarry)', () => {
  it('the Quarry is tech-gated and its workers deliver Stone', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500 });
    state.city.population = 1;
    reveal(state, [NEAR_ROCKS, QUARRY_CELL, COVE_WATER]);
    expect(placementBlock(state, map, 'Quarry', QUARRY_CELL)).toBe('NeedsResearch');
    completeTech(state, 'Masonry');
    expect(placementBlock(state, map, 'Quarry', COVE_WATER)).toBe('NeedsLand'); // no sea quarries
    expect(tapCell(state, map, NEAR_ROCKS, T0)).toBe('Harvested'); // rocks tap like trees
    expect(getWallet(state.city.wallet, 'Stone')).toBe(1);
    expect(enqueueBuild(state, map, 'Quarry', QUARRY_CELL)).toBe('Started');
    tickAt(state, T0);
    expect(finishWithGems(state, map, state.city.queue[0].uniqueId, T0)).toBe('Success');
    const quarry = state.city.districts.find((d) => d.definitionId === 'Quarry')!;
    expect(changeWorkers(state, map, quarry.uniqueId, 1, T0)).toBe('Assigned');
    tickAt(state, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Stone')).toBeGreaterThan(1); // deliveries landed
  });
});

describe('fish line (Sailing → Fishing → coastal Docks)', () => {
  it('the exploration branch: Fishing sits behind Sailing, not Agriculture', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 100, Food: 100 });
    expect(startTech(state, 'Fishing', T0)).toBe('MissingRequirement');
    completeTech(state, 'Forestry');
    expect(startTech(state, 'Fishing', T0)).toBe('MissingRequirement'); // needs Sailing
    completeTech(state, 'Sailing');
    expect(startTech(state, 'Fishing', T0)).toBe('Started'); // no Agriculture needed
  });

  it('the Docks must touch Water; its boats net Fish from shoals', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500 });
    state.city.population = 1;
    reveal(state, [SHOAL, PIER, PIER_LAND, INLAND, { x: 0, y: 3 }]);
    completeTech(state, 'Fishing');
    expect(placementBlock(state, map, 'Docks', INLAND)).toBe('NeedsShoreline'); // all land
    expect(placementBlock(state, map, 'Docks', SHOAL)).not.toBe(null); // shoal blocks its cell
    expect(placementBlock(state, map, 'Docks', PIER)).toBe(null); // land+water pair
    expect(enqueueBuild(state, map, 'Docks', PIER)).toBe('Started');
    tickAt(state, T0);
    expect(finishWithGems(state, map, state.city.queue[0].uniqueId, T0)).toBe('Success');
    const docks = state.city.districts.find((d) => d.definitionId === 'Docks')!;
    expect(changeWorkers(state, map, docks.uniqueId, 1, T0)).toBe('Assigned');
    tickAt(state, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Fish')).toBeGreaterThan(0);
  });

  it('a drained shoal respawns on WATER next to its origin', () => {
    const state = freshGame();
    reveal(state, [SHOAL]);
    for (let i = 0; i < 5; i++) expect(tapCell(state, map, SHOAL, T0)).toBe('Harvested');
    expect(state.features[coordKey(SHOAL)]).toBeUndefined(); // consumed
    tickAt(state, T0 + 90_000); // respawn_seconds — shorter than berries (120s)
    const shoals = Object.entries(state.features).filter(([, f]) => f === 'FishShoal');
    const back = shoals.find(([k]) => {
      const [x, y] = k.split(',').map(Number);
      return Math.max(Math.abs(x - SHOAL.x), Math.abs(y - SHOAL.y)) === 1;
    });
    expect(back).toBeDefined();
    expect(map.terrain.get(back![0])).toBe('Water'); // never on land
  });

  it('Fish pays Food costs at 1 Food each', () => {
    const wallet = { Food: 0, Fish: 3 };
    expect(effectiveAmount(wallet, 'Food')).toBe(3);
    pay(wallet, { Food: 2 });
    expect(wallet).toEqual({ Food: 0, Fish: 1 });
  });
});

describe('iron line (Mining ← Masonry) and the iron-gated army', () => {
  it('Mining needs Masonry first and costs Stone', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Stone: 50 });
    expect(startTech(state, 'Mining', T0)).toBe('MissingRequirement');
    completeTech(state, 'Masonry');
    expect(startTech(state, 'Mining', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Stone')).toBe(50 - 30);
  });

  it('the Cavalry costs Iron (foot units no longer do)', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500 });
    completeTech(state, 'Warrior');
    expect(trainUnit(state, 'Warrior')).toBe('Trained'); // wood-armed now
    completeTech(state, 'Cavalry');
    expect(trainUnit(state, 'Cavalry')).toBe('NotEnoughResources'); // no Iron
    fund(state, { Gold: 1000, Wood: 500, Food: 500, Iron: 20 });
    expect(trainUnit(state, 'Cavalry')).toBe('Trained');
    expect(getWallet(state.city.wallet, 'Iron')).toBe(0); // 20 spent
  });
});
