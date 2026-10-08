// Plantables: a Build-menu entry that puts a feature on the ground instead of
// raising a building (Docs/features/27-plantables.md). The crop plot is one.

import { describe, expect, it } from 'vitest';
import { advance, enqueueBuild } from '../src/sim/commands';
import { DISTRICTS, HARVEST } from '../src/sim/data/definitions';
import { districtCount, maxDistrictCount, nextBuildCost, placementBlock } from '../src/sim/districts';
import { collectTap, depotStock, isExhausted, isGrowing, stockAt } from '../src/sim/harvest';
import { pickUpBlock, transplant } from '../src/sim/plants';
import { deserialize, serialize } from '../src/sim/save';
import { coordKey, type Coord, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, freshPresenter, fund, map, reveal, screenAt, T0 } from './helpers';

const PLOT: Coord = { x: 2, y: 0 };
const GROW_MS = HARVEST.Crops.growSeconds * 1000;

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

describe('moving a tree', () => {
  const FROM: Coord = { x: 2, y: 0 };
  const TO: Coord = { x: 2, y: 1 };
  const DAY = HARVEST.Forest.growSeconds * 1000;

  const withTree = (research = true): GameState => {
    const state = freshGame();
    reveal(state, [FROM, TO]);
    state.features[coordKey(FROM)] = 'Trees';
    if (research) completeTech(state, 'Transplanting');
    return state;
  };

  it('waits for Transplanting', () => {
    const state = withTree(false);
    expect(pickUpBlock(state, FROM)).toBe('NeedsResearch');
    expect(transplant(state, map, FROM, TO, T0)).toBe('NeedsResearch');
    expect(state.features[coordKey(FROM)]).toBe('Trees');
  });

  it('leaves bare ground and lands growing for a day', () => {
    const state = withTree();
    expect(transplant(state, map, FROM, TO, T0)).toBe('Moved');
    expect(state.features[coordKey(FROM)]).toBeUndefined();
    expect(placementBlock(state, map, 'Housing', FROM)).toBeNull(); // buildable now
    expect(state.features[coordKey(TO)]).toBe('Trees');
    expect(isGrowing(state, map, TO, T0 + DAY - 1)).toBe(true);
    expect(isGrowing(state, map, TO, T0 + DAY)).toBe(false);
    expect(stockAt(state, map, TO, T0 + DAY)).toBe(depotStock(state, map, TO, HARVEST.Forest));
  });

  it('restarts the growth of a tree moved again while it grows', () => {
    const state = withTree();
    transplant(state, map, FROM, TO, T0);
    expect(transplant(state, map, TO, FROM, T0 + DAY / 2)).toBe('Moved');
    expect(isGrowing(state, map, FROM, T0 + DAY)).toBe(true);
    expect(isGrowing(state, map, FROM, T0 + DAY / 2 + DAY)).toBe(false);
  });

  it('refuses ground a building or a feature already holds, and its own cell is no move', () => {
    const state = withTree();
    addBuilt(state, 'Housing', TO);
    expect(transplant(state, map, FROM, TO, T0)).toBe('Occupied');
    expect(transplant(state, map, FROM, FROM, T0)).toBe('SameCell');
  });

  it('moves a crop plot with no research, and nothing else at all', () => {
    const state = freshGame();
    reveal(state, [FROM, TO]);
    state.features[coordKey(FROM)] = 'Crops';
    expect(transplant(state, map, FROM, TO, T0)).toBe('Moved');
    expect(isGrowing(state, map, TO, T0)).toBe(true);
    state.features[coordKey(FROM)] = 'BerryBush';
    expect(pickUpBlock(state, FROM)).toBe('NotMovable');
  });
});

describe('a long press on a tree', () => {
  const FROM: Coord = { x: 2, y: 0 };
  const TO: Coord = { x: 2, y: 1 };

  const withTree = (research = true) => {
    const state = freshGame();
    reveal(state, [FROM, TO]);
    state.features[coordKey(FROM)] = 'Trees';
    if (research) completeTech(state, 'Transplanting');
    const game = freshPresenter(state);
    game.camera.centerOnCell(FROM);
    return { state, game };
  };

  it('picks it up, carries it and puts it down growing', () => {
    const { state, game } = withTree();
    expect(game.canHoldAt(...screenAt(game, FROM))).toBe(true);
    expect(game.holdAt(...screenAt(game, FROM))).toBe(true);
    expect(game.mode.kind).toBe('transplanting');
    expect(game.transplantInfo()!.unmoved).toBe(true);
    game.dragGhostTo(...screenAt(game, TO));
    game.holdGhost(false);
    expect(game.transplantInfo()!.growSeconds).toBe(HARVEST.Forest.growSeconds);
    game.confirmTransplant();
    expect(game.mode.kind).toBe('normal');
    expect(state.features[coordKey(FROM)]).toBeUndefined();
    expect(isGrowing(state, map, TO, game.now())).toBe(true);
  });

  it('put back where it stood is a cancel that keeps its Wood', () => {
    const { state, game } = withTree();
    game.holdAt(...screenAt(game, FROM));
    game.confirmTransplant();
    expect(game.mode.kind).toBe('normal');
    expect(state.features[coordKey(FROM)]).toBe('Trees');
    expect(isGrowing(state, map, FROM, game.now())).toBe(false);
  });

  it('turns red over a building and will not land there', () => {
    const { state, game } = withTree();
    addBuilt(state, 'Housing', TO);
    game.holdAt(...screenAt(game, FROM));
    game.dragGhostTo(...screenAt(game, TO));
    expect(game.ghostBlock()).toBe('Occupied');
    game.confirmTransplant();
    expect(game.mode.kind).toBe('transplanting');
    expect(state.features[coordKey(FROM)]).toBe('Trees');
  });

  it('before Transplanting, says what to research and picks nothing up', () => {
    const { game } = withTree(false);
    expect(game.holdAt(...screenAt(game, FROM))).toBe(false);
    expect(game.mode.kind).toBe('normal');
  });
});
