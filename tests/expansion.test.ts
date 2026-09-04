// The Stone / Fish / Iron expansion: new features and buildings, the
// Masonry→Mining chain, coastal placement, water respawns, the stone-gated
// army, and the rates at which shoals and veins pay.
//
// Shoals and veins are still CELLS with their own art, tech gates and timers.
// What they stopped being is currencies: a shoal pays Food and a vein pays
// Stone, at the rates the old wallet rows were worth.
import { describe, expect, it } from 'vitest';
import { TECHNOLOGIES } from '../src/sim/data/definitions';
import { trainUnit } from '../src/sim/army';
import { changeWorkers, enqueueBuild, finishWithGems } from '../src/sim/commands';
import { placementBlock } from '../src/sim/districts';
import { harvestSourceAt, tapCell, tapYieldAt } from '../src/sim/harvest';
import { startTech, techCost } from '../src/sim/research';
import { HARVEST } from '../src/sim/data/definitions';
import { coordKey, getWallet } from '../src/sim/state';
import { addAllTrainers, completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

// Every coordinate below is READ OFF THE MAP, and every one of them moved
// when the province was redrawn — the western cove became grassland, the
// mainland rocks and the northern iron went elsewhere. They are named and
// commented rather than inlined so the next redraw is a diff of this block
// instead of a hunt through the file.
const NEAR_ROCKS = { x: 6, y: 0 }; // the nearest Mountain, at fog distance 5
const QUARRY_CELL = { x: 5, y: 0 }; // clear Grassland beside it, inside radius 2
const COVE_WATER = { x: -6, y: 1 }; // the nearest open water, west
const SHOAL = { x: -8, y: 2 }; // authored FishShoal, 2 cells off the pier
// Docks anchor: a 2x1 pier wants exactly one wet cell, and the ANCHOR is the
// Water one — (-6,0) is Water, (-5,0) is the land half.
const PIER = { x: -6, y: 0 };
const PIER_LAND = { x: -5, y: 0 };
const INLAND = { x: -1, y: 2 }; // (-1,2)+(0,2): two clear land cells, no shoreline
const IRON_MOUNTAIN = { x: -7, y: -13 }; // MountainIron, deep in the northern fog

describe('stone line (Masonry → Quarry)', () => {
  it('the Quarry is tech-gated and its workers deliver Stone', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Wood: 500 });
    state.city.population = 1;
    reveal(state, [NEAR_ROCKS, QUARRY_CELL, COVE_WATER]);
    expect(placementBlock(state, map, 'Quarry', QUARRY_CELL)).toBe('NeedsResearch');
    completeTech(state, 'Masonry');
    expect(placementBlock(state, map, 'Quarry', COVE_WATER)).toBe('NeedsLand'); // no sea quarries
    // Masonry opens the SHED; the bare peak answered a pick already — the
    // tome tree parks Scaling Tools in Magic era 2, far too late to gate
    // era-1 Stone — and the METAL is what the later rungs open.
    // Read the yield BEFORE the tap: it is capped by what the cell still
    // holds, so asking afterwards asks about a smaller depot.
    const perTap = tapYieldAt(state, map, NEAR_ROCKS, T0);
    expect(tapCell(state, map, NEAR_ROCKS, T0)).toBe('Harvested'); // rocks tap like trees
    expect(getWallet(state.city.wallet, 'Stone')).toBe(perTap);
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
  // Exploration lives in the MAGIC tome now (07-research.md §2): the fog is the
  // surface Kingdom's magic presents to the player, so Sailing and Fishing
  // sit beside Mana and the ruins rather than beside the farms.
  it('the exploration branch is in the Magic tome, behind its own eras', () => {
    const state = freshGame();
    fund(state, { Gold: 20_000, Knowledge: 5_000 });
    expect(TECHNOLOGIES.Fishing.tome).toBe('Magic');
    expect(TECHNOLOGIES.Sailing.tome).toBe('Magic');
    // Nothing in the tome is reachable until the tome is open.
    expect(startTech(state, 'Fishing', T0)).toBe('MissingRequirement');
    completeTech(state, 'Forestry'); // a Civics era-1 tech opens nothing here
    expect(startTech(state, 'Fishing', T0)).toBe('MissingRequirement');
    // Fishing is Magic era 3, so it waits on the keystone above it.
    completeTech(state, 'AttunementIII');
    expect(startTech(state, 'Fishing', T0)).toBe('Started');
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
    // Drained by its DEPOT, not by a tap count: a shoal holds `stock` Food and
    // a tap takes `tap.work_seconds` of netting, so how many presses that is
    // follows from the dials rather than from a number written here.
    let presses = 0;
    while (tapCell(state, map, SHOAL, T0) === 'Harvested') {
      if (++presses > 100) throw new Error('shoal never drained');
    }
    expect(presses).toBeGreaterThan(0);
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
  it('a shoal pays Food, and a boat nets more of it than a hand does', () => {
    const state = freshGame();
    reveal(state, [SHOAL]);
    expect(harvestSourceAt(state, SHOAL)).toBe('Fish'); // still a shoal
    expect(tapCell(state, map, SHOAL, T0)).toBe('Harvested');
    // A tap is `tap.work_seconds` of netting; a boat's strike is a whole net.
    // The hand is the impatient way in, and the Docks is why you build it.
    expect(getWallet(state.city.wallet, 'Food'))
      .toBe(tapYieldAt(state, map, SHOAL, T0));
    expect(HARVEST.Fish.unitsPerStrike).toBeGreaterThan(1);
  });
});

describe('the vein line (Mining ← Masonry) and the stone-gated army', () => {
  it('Mining needs Masonry first, and is paid for in Gold', () => {
    const state = freshGame();
    // Deliberately rich in Stone and broke in Gold: research does not touch
    // the city's materials, so a full quarry buys nothing.
    fund(state, { Gold: 0, Stone: 50, Knowledge: 99_999 });
    // Mining is Civics era 2: the keystone above it is the gate, and Masonry
    // is one of the era-1 majors that keystone requires.
    completeTech(state, 'CharterII');
    expect(startTech(state, 'Mining', T0)).toBe('NotEnoughResources');
    fund(state, { Gold: techCost('Mining') });
    expect(startTech(state, 'Mining', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    expect(getWallet(state.city.wallet, 'Stone')).toBe(50); // untouched
  });

  // Its richness moved from the TAP to the DEPOT and the CREW when a cell
  // became a depot. A tap is priced in seconds of that cell's own work, and a
  // sixty-second swing is slow ground — so twenty seconds of it is a fraction
  // and the floor pays 1, the same as a bare rock. What makes a vein worth the
  // walk is that there is five times as much in it and a miner takes five
  // units a swing (Docs/features/04-harvest.md §2.1).
  it('an iron mountain is a RICH stone node — in the ground, not in the tap', () => {
    const state = freshGame();
    reveal(state, [IRON_MOUNTAIN]);
    completeTech(state, 'Mining'); // the iron out of the peak
    expect(harvestSourceAt(state, IRON_MOUNTAIN)).toBe('MountainIron');
    expect(tapCell(state, map, IRON_MOUNTAIN, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Stone'))
      .toBe(tapYieldAt(state, map, IRON_MOUNTAIN, T0));

    expect(HARVEST.MountainIron.stock).toBeGreaterThan(HARVEST.Stone.stock);
    expect(HARVEST.MountainIron.unitsPerStrike)
      .toBe(HARVEST.Stone.unitsPerStrike * 5);
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
