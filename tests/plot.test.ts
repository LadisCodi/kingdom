// The buildable plot: Chebyshev rings around the Townhall, by Townhall level
// (OQ-1, Docks/features/02-map-scopes.md §6).
//
// The rule the whole design hangs on is the one this file states first: the
// plot bounds where the city may BUILD and nothing else. A crew reaches out
// of it, a thumb reaches anywhere revealed, and a building already standing
// outside it keeps every villager it has — promise 1.
import { describe, expect, it } from 'vitest';
import { changeWorkers, moveDistrict, upgradeDistrict } from '../src/sim/commands';
import {
  isInsidePlot, placementBlock, plotRadius, validPlacementCells,
} from '../src/sim/districts';
import { collectTap, harvestSourceAt } from '../src/sim/harvest';
import { CITY_DEF, DISTRICTS } from '../src/sim/data/definitions';
import { getWallet, townhall } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

// Read off the map (`region-map.json`), by Chebyshev distance to the
// Townhall's 2×2 footprint: the nearest Trees are at 3, the nearest Mountain
// at 5, the coast at 6. The plot opens at ring 3.
const INSIDE = { x: 4, y: 2 }; // grassland at ring 3, the opening plot's edge
const OUTSIDE = { x: 5, y: 2 }; // grassland at ring 4, one Townhall level away
const FAR = { x: 11, y: 2 }; // ring 10, outside every early plot

describe('the plot is a ring around the Townhall, and the Townhall level is the ring', () => {
  it('opens at three and reaches ten, one schedule for every building', () => {
    const state = freshGame();
    expect(plotRadius(state)).toBe(3);
    townhall(state).level = 3;
    expect(plotRadius(state)).toBe(6); // the level that reaches the coast
    // The Townhall stops at 4 today, so the ring the live game can reach is
    // the fourth entry; the sheet authors all ten for step 7.
    townhall(state).level = DISTRICTS.Townhall.maxLevel;
    expect(plotRadius(state)).toBe(7);
    townhall(state).level = 10;
    expect(plotRadius(state)).toBe(CITY_DEF.buildDistancePerTownhallLevel.at(-1));
    expect(plotRadius(state)).toBe(10);
  });

  it('measures to the Townhall footprint, not to its anchor', () => {
    const state = freshGame();
    // (4,1) is three cells east of the footprint's east edge (x = 1), so it
    // is ring 3 — an anchor-based measure would call it 4 and refuse it.
    expect(isInsidePlot(state, { x: 4, y: 1 })).toBe(true);
    expect(isInsidePlot(state, { x: 5, y: 1 })).toBe(false);
  });

  it('refuses a build outside it, and lets the next Townhall level in', () => {
    const state = freshGame();
    fund(state, { Wood: 100_000, Stone: 100_000, Gold: 100_000 });
    completeTech(state, 'Saws');
    reveal(state, [INSIDE, OUTSIDE]);
    expect(placementBlock(state, map, 'Sawmill', INSIDE)).toBe(null);
    expect(placementBlock(state, map, 'Sawmill', OUTSIDE)).toBe('OutsidePlot');
    townhall(state).level = 2;
    expect(placementBlock(state, map, 'Sawmill', OUTSIDE)).toBe(null);
  });

  it('answers before the fog does: revealing a cell outside the plot buys nothing', () => {
    const state = freshGame();
    // Unrevealed AND outside. Both are true; the plot is the one worth saying,
    // because paying the fog would not make the cell buildable.
    expect(placementBlock(state, map, 'Sawmill', FAR)).toBe('OutsidePlot');
  });

  it('takes the whole footprint into account, not just the anchor', () => {
    const state = freshGame();
    fund(state, { Wood: 100_000, Stone: 100_000, Gold: 100_000 });
    completeTech(state, 'Fishing');
    // A 2×1 pier anchored on the last ring sticks its other half out of the
    // plot, so the anchor being inside is not enough.
    const edge = map.cells.find((c) =>
      isInsidePlot(state, c) && !isInsidePlot(state, { x: c.x + 1, y: c.y })
      && placementBlock(state, map, 'Housing', c) !== 'HasSite')!;
    for (const c of map.cells) reveal(state, [c]);
    expect(isInsidePlot(state, edge)).toBe(true);
    expect(placementBlock(state, map, 'Docks', edge)).toBe('OutsidePlot');
  });
});

describe('the plot bounds building, and nothing else', () => {
  it('lets a crew inside the plot work cells outside it', () => {
    const state = freshGame();
    // The Sawmill sits on the plot's edge with reach 4, so its trees may be
    // well outside it.
    const shed = { x: 4, y: 3 };
    addBuilt(state, 'Sawmill', shed);
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    sawmill.level = 3; // radius 4, well past the ring-4 plot
    state.city.population = 1;
    const trees = DISTRICTS.Sawmill.harvestSources;
    expect(trees.length).toBeGreaterThan(0);
    for (const c of map.cells) reveal(state, [c]);
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, T0)).toBe('Assigned');
    tickAt(state, T0);
    tickAt(state, T0 + 120_000);
    // Something was cut, and the only forests in reach are outside the plot.
    expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThan(0);
    expect(isInsidePlot(state, shed)).toBe(true);
  });

  it('lets the thumb tap anywhere revealed, plot or no plot', () => {
    const state = freshGame();
    const far = map.cells.find((c) =>
      !isInsidePlot(state, c) && harvestSourceAt(state, c) !== null)!;
    reveal(state, [far]);
    expect(isInsidePlot(state, far)).toBe(false);
    expect(collectTap(state, map, far, T0)).toBe('Harvested');
  });

  it('never takes a building the plot no longer covers', () => {
    const state = freshGame();
    fund(state, { Wood: 100_000, Stone: 100_000, Gold: 100_000 });
    // A building standing outside the plot — a save from before the bound, or
    // one the ring will reach later. It keeps its crew and its levels.
    addBuilt(state, 'Sawmill', FAR);
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    expect(isInsidePlot(state, FAR)).toBe(false);
    state.city.population = 1;
    for (const c of map.cells) reveal(state, [c]);
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, T0)).toBe('Assigned');
    expect(upgradeDistrict(state, sawmill.uniqueId)).toBe('Started');
  });

  it('will not let a move carry a building out of the plot', () => {
    const state = freshGame();
    completeTech(state, 'Saws'); // a move is the same legality check as a build
    addBuilt(state, 'Sawmill', INSIDE);
    const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
    for (const c of map.cells) reveal(state, [c]);
    expect(moveDistrict(state, map, sawmill.uniqueId, OUTSIDE, T0)).not.toBe('Moved');
    const inside = validPlacementCells(state, map, 'Sawmill', sawmill.uniqueId)
      .find((c) => c.x !== INSIDE.x || c.y !== INSIDE.y)!;
    expect(isInsidePlot(state, inside)).toBe(true);
    expect(moveDistrict(state, map, sawmill.uniqueId, inside, T0)).toBe('Moved');
  });
});

describe('the plot against the province it sits in', () => {
  it('is a small fraction of the ground, so the far map stays worth revealing', () => {
    const state = freshGame();
    const inside = map.cells.filter((c) => isInsidePlot(state, c)).length;
    expect(inside).toBeLessThan(map.cells.length / 20);
    townhall(state).level = 10;
    const atTen = map.cells.filter((c) => isInsidePlot(state, c)).length;
    expect(atTen).toBeGreaterThan(inside * 4);
    expect(atTen).toBeLessThan(map.cells.length / 2);
  });

  it('reaches the coast exactly when the Townhall that unlocks the Docks does', () => {
    const state = freshGame();
    const water = map.cells.filter((c) => map.terrain.get(`${c.x},${c.y}`) === 'Water');
    const reachable = (level: number) => {
      townhall(state).level = level;
      return water.some((c) => isInsidePlot(state, c));
    };
    expect(reachable(2)).toBe(false);
    expect(reachable(3)).toBe(true);
  });
});
