// Research: the Farm gate (first research), free-standing FarmLands, and
// research surviving the save round-trip.
import { describe, expect, it } from 'vitest';
import { enqueueBuild } from '../src/sim/commands';
import { RESEARCH } from '../src/sim/data/definitions';
import { placementBlock } from '../src/sim/districts';
import { isResearched, startResearch } from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import { freshGame, fund, map, T0, tickAt } from './helpers';

const FARM_CELL = { x: 2, y: 0 }; // revealed grassland
const PLOT_CELL = { x: 2, y: 1 }; // revealed grassland

describe('the Agriculture research gates the Farm', () => {
  it('cannot start without the resources', () => {
    const state = freshGame(); // the start has 0 Gold
    expect(startResearch(state, 'Agriculture', T0)).toBe('NotEnoughResources');
  });

  it('locks the Farm until completed; only one research at a time', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    expect(placementBlock(state, map, 'Farm', FARM_CELL)).toBe('NeedsResearch');
    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('InvalidCell');

    expect(startResearch(state, 'Agriculture', T0)).toBe('Started');
    expect(startResearch(state, 'Agriculture', T0)).toBe('AlreadyResearching');
    expect(isResearched(state, 'Agriculture')).toBe(false);

    const durationMs = RESEARCH.Agriculture.durationSeconds * 1000;
    tickAt(state, T0 + durationMs - 1000);
    expect(isResearched(state, 'Agriculture')).toBe(false);
    tickAt(state, T0 + durationMs);
    expect(isResearched(state, 'Agriculture')).toBe(true);
    expect(startResearch(state, 'Agriculture', T0 + durationMs)).toBe('AlreadyDone');

    expect(enqueueBuild(state, map, 'Farm', FARM_CELL)).toBe('Started');
  });

  it('costs are paid up front', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    startResearch(state, 'Agriculture', T0);
    expect(state.city.wallet.Gold).toBe(500 - 100);
    expect(state.city.wallet.Wood).toBe(500 - 25);
  });
});

describe('free-standing FarmLands', () => {
  it('placeable on any revealed Grassland with no Farm anywhere', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    expect(placementBlock(state, map, 'FarmLands', PLOT_CELL)).toBe(null);
    expect(enqueueBuild(state, map, 'FarmLands', PLOT_CELL)).toBe('Started');
  });
});

describe('research in the save round-trip', () => {
  it('restores completed research and finishes an in-progress one in real time', () => {
    const state = freshGame();
    fund(state, { Gold: 500, Wood: 500 });
    startResearch(state, 'Agriculture', T0);
    tickAt(state, T0 + 10_000); // mid-research at save time

    // Reload 10 minutes later: research completes during the absence.
    const restored = deserialize(serialize(state, T0 + 10_000), map, T0 + 600_000)!;
    expect(isResearched(restored, 'Agriculture')).toBe(true);
    expect(restored.research.active).toBe(null);
    expect(enqueueBuild(restored, map, 'Farm', FARM_CELL)).toBe('Started');
  });
});
