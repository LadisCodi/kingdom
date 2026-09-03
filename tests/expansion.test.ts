// The Stone / Fish / Iron expansion: new features and buildings, the
// Masonry→Mining chain, coastal placement, water respawns, the stone-gated
// army, and the rates at which shoals and veins pay.
//
// Shoals and veins are still CELLS with their own art, tech gates and timers.
// What they stopped being is currencies: a shoal pays Food and a vein pays
// Stone, at the rates the old wallet rows were worth.
import { describe, expect, it } from 'vitest';
import { trainUnit } from '../src/sim/army';
import { changeWorkers, enqueueBuild, finishWithGems } from '../src/sim/commands';
import { placementBlock } from '../src/sim/districts';
import { harvestSourceAt, tapCell } from '../src/sim/harvest';
import { startTech, techCost } from '../src/sim/research';
import { coordKey, getWallet } from '../src/sim/state';
import { addAllTrainers, completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

const NEAR_ROCKS = { x: 4, y: -1 }; // mainland Rocks (authored)
// The rocks sit in a mountain pocket: (5,0) and (5,-2) are their only land
// neighbours, so the quarry goes diagonally beside them.
const QUARRY_CELL = { x: 5, y: 0 };
const COVE_WATER = { x: -3, y: -1 }; // open water west of the isle
const SHOAL = { x: -5, y: 2 }; // authored FishShoal on Water
// Docks anchor: 2×1 pier — (-6,3) is Water, (-5,3) is Grassland (mirrored case).
const PIER = { x: -6, y: 3 };
const PIER_LAND = { x: -5, y: 3 };
const INLAND = { x: -1, y: 2 }; // (-1,2)+(0,2): two clear land cells, no shoreline
const IRON_MOUNTAIN = { x: -2, y: -8 }; // authored MountainIron, deep in the northern fog

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
    fund(state, { Gold: 2000 });
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
    reveal(state, [SHOAL, PIER, PIER_LAND, INLAND, { x: 0, y: 2 }]);
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
    // A shoal is a Food cell — the boats land Food, 2 a delivery.
    expect(getWallet(state.city.wallet, 'Food')).toBeGreaterThan(0);
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

  // The shoal used to be its own wallet row worth 1 Food as a cost and 2 Gold
  // at the Market. Folding it had to pick one; it picked the higher, so the
  // Docks line still earns the tech that opens it.
  it('a shoal pays Food at 2 a tap', () => {
    const state = freshGame();
    reveal(state, [SHOAL]);
    expect(harvestSourceAt(state, SHOAL)).toBe('Fish'); // still a shoal
    expect(tapCell(state, map, SHOAL, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Food')).toBe(2);
  });
});

describe('the vein line (Mining ← Masonry) and the stone-gated army', () => {
  it('Mining needs Masonry first, and is paid for in Gold', () => {
    const state = freshGame();
    // Deliberately rich in Stone and broke in Gold: research does not touch
    // the city's materials, so a full quarry buys nothing.
    fund(state, { Gold: 0, Stone: 50, Knowledge: 99_999 });
    completeTech(state, 'Masonry');
    expect(startTech(state, 'Mining', T0)).toBe('NotEnoughResources');
    fund(state, { Gold: techCost('Mining') });
    expect(startTech(state, 'Mining', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    expect(getWallet(state.city.wallet, 'Stone')).toBe(50); // untouched
  });

  it('an iron mountain is a RICH stone node — 5 a tap against a bare peak\'s 1', () => {
    const state = freshGame();
    reveal(state, [IRON_MOUNTAIN]);
    completeTech(state, 'ScalingTools'); // every mountain is behind it
    expect(harvestSourceAt(state, IRON_MOUNTAIN)).toBe('MountainIron');
    expect(tapCell(state, map, IRON_MOUNTAIN, T0)).toBe('Harvested');
    // Five times a bare mountain: the same material, worth the walk out.
    expect(getWallet(state.city.wallet, 'Stone')).toBe(5);
  });

  it('the Cavalry costs Stone at the vein rate (foot units cost none)', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500, Food: 500, Stone: 0 });
    completeTech(state, 'Warrior');
    addAllTrainers(state); // the cap now comes from buildings, not the Townhall
    expect(trainUnit(state, 'Warrior', T0)).toBe('Queued'); // wood-armed now
    completeTech(state, 'Cavalry');
    expect(trainUnit(state, 'Cavalry', T0)).toBe('NotEnoughResources'); // no Stone
    fund(state, { Gold: 1000, Wood: 500, Food: 500, Stone: 60 });
    expect(trainUnit(state, 'Cavalry', T0)).toBe('Queued');
    expect(getWallet(state.city.wallet, 'Stone')).toBe(0); // 60 spent — 20 Iron × 3
  });
});
