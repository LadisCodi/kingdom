// The second builder: the dial that was authored, mapped by the importer, and
// then never reachable.
//
// `kingdom.max_builders` is 4 in the workbook and `kingdom.start_builders` is
// 1. Nothing in `src/` ever raised the state field between them, and both
// gates in `commands.ts` tested the bare `CITY_DEF.buildQueueCapacity`
// constant rather than the builder count — so even a state edited to 4
// builders still refused the second job.
//
// THERE IS NO WAITING LINE. A build either starts because a builder is free
// or it does not start at all; nothing is ever parked. So the number of jobs
// in flight is exactly the builder count, and the refusal is a moment the
// game sells into rather than an administrative one — see
// Docs/features/06-construction.md.
//
// These are the assertions that keep the dial live, because "unreachable" is
// a property no other test can notice.
import { describe, expect, it } from 'vitest';
import {
  advance, buyBuilder, builderGemCost, enqueueBuild, grantBuilder, upgradeDistrict,
} from '../src/sim/commands';
import { DISTRICTS, KINGDOM_DEF } from '../src/sim/data/definitions';
import { placementBlock, requiredTechForLevel } from '../src/sim/districts';
import { advanceQueue } from '../src/sim/queue';
import {
  builderCount, buildQueueCapacity, townhall, type Coord, type GameState, type QueueItem,
} from '../src/sim/state';
import { addBuilt, canGather, completeTech, freshGame, map, T0 } from './helpers';

const fundCity = (state: GameState) =>
  Object.assign(state.city.wallet, { Wood: 100_000, Gold: 100_000, Food: 100_000, Stone: 100_000 });

/**
 * `n` cells the city may legally build Housing on, found rather than authored:
 * a hardcoded coordinate is a test that breaks when the map is re-authored,
 * and this suite is about the QUEUE, not about where a house goes.
 */
function legalCells(state: GameState, n: number): Coord[] {
  const found: Coord[] = [];
  for (let y = -6; y <= 6 && found.length < n; y++) {
    for (let x = -6; x <= 6 && found.length < n; x++) {
      const cell = { x, y };
      if (placementBlock(state, map, 'Housing', cell) === null) found.push(cell);
    }
  }
  if (found.length < n) throw new Error(`only ${found.length} legal cells, needed ${n}`);
  return found;
}

/** A city that may build anywhere near home: the whole test window revealed. */
function openGround(state: GameState): GameState {
  canGather(state);
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) state.fog.revealed[`${x},${y}`] = true;
  }
  return state;
}

describe('the builder count', () => {
  it('starts at the authored start value, below the authored ceiling', () => {
    const state = freshGame();
    expect(state.kingdom.builders).toBe(KINGDOM_DEF.startBuilders);
    expect(KINGDOM_DEF.startBuilders).toBeLessThan(KINGDOM_DEF.maxBuilders);
  });

  it('rises to the ceiling and then refuses', () => {
    const state = freshGame();
    for (let i = state.kingdom.builders; i < KINGDOM_DEF.maxBuilders; i++) {
      expect(grantBuilder(state)).toBe('Granted');
    }
    expect(state.kingdom.builders).toBe(KINGDOM_DEF.maxBuilders);
    expect(grantBuilder(state)).toBe('AtCeiling');
    expect(state.kingdom.builders).toBe(KINGDOM_DEF.maxBuilders);
  });

  // The floor is not decoration: a save written before the field existed
  // deserialises to whatever the DTO had, and a 0 there would wedge the queue
  // shut forever with no way for the player to notice why.
  it('never reports fewer than one builder, whatever the state says', () => {
    const state = freshGame();
    state.kingdom.builders = 0;
    expect(builderCount(state)).toBe(1);
    expect(buildQueueCapacity(state)).toBeGreaterThanOrEqual(1);
  });
});

describe('buying a builder', () => {
  const gems = (state: GameState) => state.player.wallet.Gems ?? 0;

  it('prices the Nth builder on the same curve as every other slot', () => {
    const state = freshGame();
    // round(30 x 2.5^purchased), purchased = builders - startBuilders.
    expect(builderGemCost(state)).toBe(30);
    grantBuilder(state);
    expect(builderGemCost(state)).toBe(75);
    grantBuilder(state);
    expect(builderGemCost(state)).toBe(188);
  });

  it('takes the Gems and hands over the builder', () => {
    const state = freshGame();
    state.player.wallet.Gems = 100;
    const price = builderGemCost(state);
    expect(buyBuilder(state)).toBe('Purchased');
    expect(state.kingdom.builders).toBe(2);
    expect(gems(state)).toBe(100 - price);
  });

  it('refuses without charging when the player is short', () => {
    const state = freshGame();
    state.player.wallet.Gems = builderGemCost(state) - 1;
    const before = gems(state);
    expect(buyBuilder(state)).toBe('NotEnoughGems');
    expect(state.kingdom.builders).toBe(1);
    expect(gems(state)).toBe(before);
  });

  it('refuses without charging at the ceiling', () => {
    const state = freshGame();
    state.kingdom.builders = KINGDOM_DEF.maxBuilders;
    state.player.wallet.Gems = 10_000;
    expect(buyBuilder(state)).toBe('AtMax');
    expect(gems(state)).toBe(10_000);
  });

  // The purchase is what the player buys; the grant is what a quest or an
  // event gives. Keeping them apart is what lets a gift exist without
  // teaching the price curve anything — but a gift DOES make the next
  // purchase dearer, which is the deliberate trade for deriving `purchased`
  // instead of storing it.
  it('lets a granted builder raise the price of the next bought one', () => {
    const state = freshGame();
    grantBuilder(state);
    expect(builderGemCost(state)).toBe(75);
  });
});

describe('the jobs in flight follow the builders', () => {
  it('refuses a second job with one builder', () => {
    const state = openGround(freshGame());
    fundCity(state);
    const [a, b] = legalCells(state, 2);
    expect(enqueueBuild(state, map, 'Housing', a)).toBe('Started');
    expect(enqueueBuild(state, map, 'Housing', b)).toBe('NoBuilderFree');
  });

  it('accepts a second job with two builders — the bug this pass fixes', () => {
    const state = openGround(freshGame());
    fundCity(state);
    grantBuilder(state);
    const [a, b, c] = legalCells(state, 3);
    expect(enqueueBuild(state, map, 'Housing', a)).toBe('Started');
    expect(enqueueBuild(state, map, 'Housing', b)).toBe('Started');
    expect(enqueueBuild(state, map, 'Housing', c)).toBe('NoBuilderFree');
  });

  // Upgrades share the queue with builds, and shared a gate that read the
  // same dead constant.
  it('lets an upgrade share the queue with a build once there are two', () => {
    const state = openGround(freshGame());
    fundCity(state);
    // Clear the upgrade's OWN gates so the only thing under test is the queue.
    townhall(state).level = DISTRICTS.Townhall.maxLevel;
    const gate = requiredTechForLevel('Housing', 2);
    if (gate !== null) completeTech(state, gate);
    const [a, home] = legalCells(state, 2);
    addBuilt(state, 'Housing', home);
    const housing = state.city.districts.find((d) => d.definitionId === 'Housing')!;

    grantBuilder(state);
    expect(enqueueBuild(state, map, 'Housing', a)).toBe('Started');
    expect(upgradeDistrict(state, housing.uniqueId)).toBe('Started');
    expect(state.city.queue).toHaveLength(2);
  });

  it('builds both jobs at once rather than one after the other', () => {
    const state = openGround(freshGame());
    fundCity(state);
    grantBuilder(state);
    const [a, b] = legalCells(state, 2);
    enqueueBuild(state, map, 'Housing', a);
    enqueueBuild(state, map, 'Housing', b);
    const total = state.city.queue.reduce((n, q) => n + q.durationSeconds, 0);
    const longest = Math.max(...state.city.queue.map((q) => q.durationSeconds));
    expect(longest).toBeLessThan(total); // otherwise the assertion proves nothing

    // Both start immediately, so the whole queue drains in the time the
    // SLOWER one takes — not in the sum, which is what one builder would give.
    advance(state, map, T0 + (longest + 1) * 1000);
    expect(state.city.queue).toHaveLength(0);
    expect(state.city.districts.filter((d) => d.definitionId === 'Housing')).toHaveLength(2);
  });
});

// UNREACHABLE THROUGH PLAY, AND DELIBERATELY SO. With no waiting line the
// queue is never longer than its slots, so `advanceQueue`'s promotion branch
// never fires in a real game. It is kept because it is the correct behaviour
// for a queue that IS longer than its slots, and "no waiting line" is a design
// choice rather than a law of the engine — so it is tested here directly,
// against its own contract, instead of being asserted through a game state
// that cannot produce it.
describe('advanceQueue promotion (engine contract, not a reachable state)', () => {
  const item = (uniqueId: string, durationSeconds: number, startedAt: number | null): QueueItem => ({
    uniqueId, kind: 'build', districtUniqueId: uniqueId, targetLevel: 1,
    durationSeconds, startedAt,
  });

  // The first `slots` items are already running — an unstarted item is
  // stamped with `now`, so a queue built entirely of nulls can never have
  // completed anything by `now` and would assert nothing.
  const queued = (slots: number) => [
    item('a', 10, slots >= 1 ? 0 : null),
    item('b', 40, slots >= 2 ? 0 : null),
    item('c', 10, null),
  ];

  it('stamps a promoted item with the moment its slot freed, not with now', () => {
    // Two slots, three jobs: 10 s, 40 s, 10 s, over a 60 s absence. `c` may
    // only start when `a` frees a slot at t+10 — so it must finish at t+20,
    // BEFORE the 40 s job it was queued behind.
    const queue = queued(2);
    const done = advanceQueue(queue, 60_000, 2);
    expect(done.map((q) => q.uniqueId)).toEqual(['a', 'c', 'b']);
    expect(queue).toHaveLength(0);
    expect(done.find((q) => q.uniqueId === 'c')!.startedAt).toBe(10_000);
  });

  it('with one slot, the same three jobs run strictly in series', () => {
    const queue = queued(1);
    const done = advanceQueue(queue, 60_000, 1);
    expect(done.map((q) => q.uniqueId)).toEqual(['a', 'b', 'c']);
    expect(done.find((q) => q.uniqueId === 'c')!.startedAt).toBe(50_000);
  });
});
