// The boundary loop (Docs/implementation-plan.md §1).
//
// `advance()` walks to the earliest next boundary and applies discrete work
// exactly at it. A boundary that landed at the END of the window during a
// single-call offline replay, but immediately when live-ticking, would be a
// real divergence between the two paths that share this function precisely
// so they cannot diverge. The boundary under test is a build finishing: a
// house going up mid-window puts a homeless villager under a roof, and the
// tax rate jumps at that instant.
//
// The load-bearing assertion, repeated at every future step: one-call replay
// equals stepped ticking.
import { describe, expect, it } from 'vitest';
import { advance, enqueueBuild } from '../src/sim/commands';
import { validPlacementCells } from '../src/sim/districts';
import { cityGoldPerMinute, maxPopulation } from '../src/sim/population';
import { completesAt, getWallet, townhall, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, stored, T0 } from './helpers';

/** One L1 Housing plus the Townhall's bed is three; four villagers, so one is
 *  homeless until a second house, queued at T0, finishes. */
/** One more villager than the city can house before the new house lands. */
const homelessOne = (state: GameState): number => maxPopulation(state) + 1;

function onTheEdgeOfAHouse(): { state: GameState; doneAt: number } {
  const state = freshGame();
  completeTech(state, 'UrbanPlanning');
  townhall(state).level = 4; // the count cap is not what is under test
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  fund(state, { Gold: 10_000, Wood: 10_000, Stone: 10_000, Food: 10_000 });
  const cell = validPlacementCells(state, map, 'Housing')[0]!;
  expect(enqueueBuild(state, map, 'Housing', cell)).toBe('Started');
  for (const d of state.city.districts) if (d.definitionId === 'Housing') d.rentAnchor = T0;
  state.lastAdvance = T0;
  advance(state, map, T0); // a builder picks it up at T0
  const item = state.city.queue[0]!;
  expect(item.startedAt).toBe(T0);
  return { state, doneAt: completesAt(item) };
}

describe('the boundary loop', () => {
  it('applies a build at its completion instant, not at the end of the window', () => {
    const { state, doneAt } = onTheEdgeOfAHouse();
    state.city.population = homelessOne(state);
    const before = cityGoldPerMinute(state);
    const gold0 = stored(state, 'Gold');

    // The whole build plus 30s, in ONE call, spanning the completion.
    const secs = (doneAt - T0) / 1000;
    advance(state, map, doneAt + 30_000);
    const after = cityGoldPerMinute(state);
    expect(after).toBeGreaterThan(before); // the homeless villager got a roof

    // The build at the old rate + 30s at the new one — NOT all at the old.
    const earned = stored(state, 'Gold') - gold0;
    const oldRateOnly = ((secs + 30) / 60) * before;
    const correct = (secs / 60) * before + (30 / 60) * after;
    expect(earned).toBeGreaterThan(oldRateOnly);
    expect(Math.abs(earned - correct)).toBeLessThanOrEqual(2); // whole-gold rounding
  });

  it('one-call replay equals stepped ticking across the same window', () => {
    const one = onTheEdgeOfAHouse();
    const oneCall = one.state;
    oneCall.city.population = homelessOne(oneCall);
    const WINDOW = one.doneAt - T0 + 30_000;
    advance(oneCall, map, T0 + WINDOW);

    const stepped = onTheEdgeOfAHouse().state;
    stepped.city.population = homelessOne(stepped);
    for (let t = 1000; t <= WINDOW; t += 1000) advance(stepped, map, T0 + t);

    expect(getWallet(stepped.city.wallet, 'Gold'))
      .toBe(getWallet(oneCall.city.wallet, 'Gold'));
    // A rent anchor is a float that one call and many steps reach by
    // different sums; they agree to well under a millisecond, and every
    // whole unit it pays agrees exactly (the stores below).
    const settled = (s: GameState) => s.city.districts.map((d) => ({
      ...d, rentAnchor: d.rentAnchor === undefined ? undefined : Math.round(d.rentAnchor),
    }));
    expect(settled(stepped)).toEqual(settled(oneCall));
    expect(stepped.city.queue).toEqual(oneCall.city.queue);
  });

  it('reports a build that completes exactly on the window edge', () => {
    const { state, doneAt } = onTheEdgeOfAHouse();
    expect(advance(state, map, doneAt - 1).completedItems).toHaveLength(0);
    const result = advance(state, map, doneAt);
    expect(result.completedItems.map((q) => q.kind)).toEqual(['build']);
    expect(state.city.queue).toHaveLength(0);
  });

  it('terminates on a window with no boundaries at all', () => {
    const state = freshGame();
    const result = advance(state, map, T0 + 8 * 3_600_000);
    expect(state.lastAdvance).toBe(T0 + 8 * 3_600_000);
    expect(result.completedItems).toHaveLength(0);
  });
});
