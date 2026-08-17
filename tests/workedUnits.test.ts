import { describe, expect, it } from 'vitest';
import { enqueueBuild, changeWorkers } from '../src/sim/commands';
import { generationPerMinute } from '../src/sim/economy';
import { assignableWorkerLimit, workedUnitCells } from '../src/sim/workedUnits';
import { freshGame, fund, map, reveal, rng, T0, tickAt } from './helpers';
import type { GameState } from '../src/sim/state';

// Trees cells near the origin (from region-map.json): (2,2), (2,3), (3,3), …
const LUMBER_CELL = { x: 1, y: 1 }; // revealed at seed; diagonal neighbor of Trees (2,2)

const builtLumber = (state: GameState) => {
  fund(state, { Silver: 500, Wood: 500 });
  reveal(state, [{ x: 2, y: 2 }]);
  expect(enqueueBuild(state, map, 'Lumber', LUMBER_CELL, T0, rng)).toBe('Started');
  tickAt(state, T0); // start the timer
  tickAt(state, T0 + 60_000); // complete it
  const lumber = state.city.districts.find((d) => d.definitionId === 'Lumber')!;
  expect(lumber.state).toBe('Built');
  return lumber;
};

describe('Lumber → Trees (feature source, BFS through revealed connected cells)', () => {
  it('counts only revealed Trees; revealing more forest grows the patch', () => {
    const state = freshGame();
    const lumber = builtLumber(state);
    expect(workedUnitCells(state, map, lumber)).toHaveLength(1); // only (2,2) revealed
    // Unrevealed cells neither count nor conduct — reveal (2,3): connected via (2,2).
    reveal(state, [{ x: 2, y: 3 }]);
    expect(workedUnitCells(state, map, lumber)).toHaveLength(2);
    reveal(state, [{ x: 3, y: 3 }]);
    expect(workedUnitCells(state, map, lumber)).toHaveLength(3);
  });

  it('worker slots: min(maxWorkersForLevel, 1 + workableUnits)', () => {
    const state = freshGame();
    const lumber = builtLumber(state);
    expect(assignableWorkerLimit(state, map, lumber)).toBe(2); // min(3, 1+1)
    reveal(state, [{ x: 2, y: 3 }, { x: 3, y: 3 }]);
    expect(assignableWorkerLimit(state, map, lumber)).toBe(3); // min(3, 1+3) clamps at 3
  });

  it('worker #1 staffs the base; extras work one tile each (5 + 3×tileWorkers Wood/min)', () => {
    const state = freshGame();
    state.city.population = 5;
    const lumber = builtLumber(state);
    reveal(state, [{ x: 2, y: 3 }]);
    const woodRate = () =>
      generationPerMinute(lumber.generators.find((g) => g.currencyId === 'Wood')!);
    expect(woodRate()).toBe(0); // unstaffed
    expect(changeWorkers(state, map, lumber.uniqueId, 1, T0, rng)).toBe('Assigned');
    expect(woodRate()).toBe(5); // base only
    expect(changeWorkers(state, map, lumber.uniqueId, 1, T0, rng)).toBe('Assigned');
    expect(woodRate()).toBe(8); // base + 1 worked tile
    expect(changeWorkers(state, map, lumber.uniqueId, 1, T0, rng)).toBe('Assigned');
    expect(woodRate()).toBe(11); // base + 2 worked tiles
    expect(changeWorkers(state, map, lumber.uniqueId, 1, T0, rng)).toBe('NoMoreTiles');
  });
});

describe('Farm → FarmLands (adjacent-district source)', () => {
  it('works only BUILT adjacent FarmLands', () => {
    const state = freshGame();
    fund(state, { Silver: 5000, Wood: 5000, Food: 100 });
    expect(enqueueBuild(state, map, 'Farm', { x: -1, y: 0 }, T0, rng)).toBe('Started');
    tickAt(state, T0);
    tickAt(state, T0 + 60_000);
    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(farm.state).toBe('Built');
    // FarmLands requires adjacency to an ACTIVE farm; queue capacity is 1 so build serially.
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: 1 }, T0 + 60_000, rng)).toBe('Started');
    expect(workedUnitCells(state, map, farm)).toHaveLength(0); // under construction ≠ worked
    tickAt(state, T0 + 60_000); // stamps the item's start time
    tickAt(state, T0 + 120_000);
    expect(workedUnitCells(state, map, farm)).toHaveLength(1);
    expect(enqueueBuild(state, map, 'FarmLands', { x: -1, y: -1 }, T0 + 120_000, rng)).toBe('Started');
    tickAt(state, T0 + 120_000);
    tickAt(state, T0 + 240_000);
    expect(workedUnitCells(state, map, farm)).toHaveLength(2);
  });
});
