// Plantables: a Build-menu entry that puts a feature on the ground instead of
// raising a building (Docs/features/27-plantables.md). The crop plot is one.

import { describe, expect, it } from 'vitest';
import { advance, enqueueBuild } from '../src/sim/commands';
import { DISTRICTS, HARVEST } from '../src/sim/data/definitions';
import { districtCount, maxDistrictCount, nextBuildCost, placementBlock } from '../src/sim/districts';
import { collectTap, depotStock, isExhausted, isGrowing, stockAt } from '../src/sim/harvest';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, type Coord, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, reveal, T0 } from './helpers';

const PLOT: Coord = { x: 2, y: 0 };
const GROW_MS = DISTRICTS.FarmLands.buildDurationSeconds * 1000;

const withAgriculture = (): GameState => {
  const state = freshGame();
  completeTech(state, 'Agriculture');
  reveal(state, [PLOT, { x: 2, y: 1 }]);
  fund(state, { Gold: 100_000, Wood: 100_000 });
  return state;
};

describe('planting a crop plot', () => {
  it('puts a Crops feature on the ground and raises no building', () => {
    const state = withAgriculture();
    const districts = state.city.districts.length;
    const queue = state.city.queue.length;
    expect(enqueueBuild(state, map, 'FarmLands', PLOT)).toBe('Started');
    expect(state.features[coordKey(PLOT)]).toBe('Crops');
    expect(state.city.districts.length).toBe(districts);
    expect(state.city.queue.length).toBe(queue); // no builder works it
    expect(districtCount(state, 'FarmLands')).toBe(1);
  });

  it('takes no builder, so a busy crew does not refuse it', () => {
    const state = withAgriculture();
    addBuilt(state, 'Housing', { x: 3, y: 2 });
    state.city.queue.push({
      uniqueId: 'busy', kind: 'build', districtUniqueId: state.city.districts.at(-1)!.uniqueId,
      durationSeconds: 999, startedAt: T0,
    });
    expect(enqueueBuild(state, map, 'FarmLands', PLOT)).toBe('Started');
  });

  it('grows first: no tap, no worker, until it comes back full', () => {
    const state = withAgriculture();
    const at = state.lastAdvance;
    enqueueBuild(state, map, 'FarmLands', PLOT);
    expect(isGrowing(state, map, PLOT, at)).toBe(true);
    expect(isExhausted(state, map, PLOT, at)).toBe(true);
    expect(collectTap(state, map, PLOT, at + GROW_MS - 1)).toBe('Exhausted');
    expect(isGrowing(state, map, PLOT, at + GROW_MS)).toBe(false);
    expect(stockAt(state, map, PLOT, at + GROW_MS)).toBe(depotStock(state, map, PLOT, HARVEST.Crops));
    expect(state.harvest[coordKey(PLOT)].growing).toBeUndefined();
  });

  it('is priced by how many stand, and capped like a building', () => {
    const state = withAgriculture();
    const first = nextBuildCost(state, 'FarmLands');
    enqueueBuild(state, map, 'FarmLands', PLOT);
    expect(nextBuildCost(state, 'FarmLands').Wood).toBeGreaterThan(first.Wood ?? 0);
    const max = maxDistrictCount(state, DISTRICTS.FarmLands);
    for (let i = 1; i < max; i++) state.features[`plot${i}`] = 'Crops';
    expect(placementBlock(state, map, 'FarmLands', { x: 2, y: 1 })).toBe('CountLimit');
  });

  it('grows the same read once or stepped', () => {
    const once = withAgriculture();
    const stepped = withAgriculture();
    for (const s of [once, stepped]) enqueueBuild(s, map, 'FarmLands', PLOT);
    const end = once.lastAdvance + GROW_MS + 1000;
    advance(once, map, end);
    for (let t = stepped.lastAdvance; t <= end; t += 700) advance(stepped, map, t);
    advance(stepped, map, end);
    expect(stockAt(once, map, PLOT, end)).toBe(stockAt(stepped, map, PLOT, end));
    expect(isGrowing(once, map, PLOT, end)).toBe(false);
  });

  it('survives a save while it grows', () => {
    const state = withAgriculture();
    enqueueBuild(state, map, 'FarmLands', PLOT);
    const back = deserialize(serialize(state, state.lastAdvance), map, state.lastAdvance)!;
    expect(back.features[coordKey(PLOT)]).toBe('Crops');
    expect(isGrowing(back, map, PLOT, state.lastAdvance)).toBe(true);
  });
});

describe('v111 turns a FarmLands district into a Crops cell', () => {
  it('drops the district and its build, and plants the feature grown', () => {
    const state = freshGame();
    reveal(state, [PLOT]);
    addBuilt(state, 'FarmLands', PLOT);
    const plot = state.city.districts.at(-1)!;
    state.city.queue.push({
      uniqueId: 'q', kind: 'build', districtUniqueId: plot.uniqueId, durationSeconds: 10, startedAt: T0,
    });
    const save = serialize(state, T0);
    save.SaveVersion = 110;
    const back = deserialize(save, map, T0)!;
    expect(back.city.districts.some((d) => d.definitionId === 'FarmLands')).toBe(false);
    expect(back.city.queue.some((q) => q.districtUniqueId === plot.uniqueId)).toBe(false);
    expect(back.features[coordKey(PLOT)]).toBe('Crops');
    expect(isGrowing(back, map, PLOT, T0)).toBe(false);
  });
});
