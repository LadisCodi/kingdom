// The boundary loop (Docs/features/engine-seams.md §1).
//
// `advance()` used to pivot only on build-queue completions and apply research
// ONCE at the end of the window. A technology completing mid-absence therefore
// landed at the very end during a single-call offline replay, but immediately
// when live-ticking — a real divergence between the two paths that share this
// function precisely so they cannot diverge.
//
// The load-bearing assertion, repeated at every future step: one-call replay
// equals stepped ticking.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { TECHNOLOGIES } from '../src/sim/data/definitions';
import { cityGoldPerMinute } from '../src/sim/population';
import { startTech } from '../src/sim/research';
import { getWallet, type GameState } from '../src/sim/state';
import { addBuilt, completeTech, freshGame, fund, map, T0 } from './helpers';

/** Two L1 Housing and five villagers: one is homeless until Communities
 *  lands, at which point capacity goes 4 → 5 and the tax rate jumps. */
function onTheEdgeOfCommunities(): GameState {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addBuilt(state, 'Housing', { x: 2, y: 3 });
  state.city.population = 5;
  completeTech(state, 'Forestry');
  completeTech(state, 'UrbanPlanning');
  fund(state, { Gold: 10_000, Wood: 1000, Knowledge: 1000 });
  // Research is paid in Knowledge out of the KINGDOM purse, so the tech cost
  // and the tax income no longer share a wallet — nothing to isolate.
  startTech(state, 'Communities', T0); // 90s
  state.city.lastTaxAt = T0;
  state.lastAdvance = T0;
  return state;
}

const COMMUNITIES_MS = TECHNOLOGIES.Communities.durationSeconds * 1000;

describe('the boundary loop', () => {
  it('applies a technology at its completion instant, not at the end of the window', () => {
    const state = onTheEdgeOfCommunities();
    const before = cityGoldPerMinute(state);
    const gold0 = getWallet(state.city.wallet, 'Gold');

    // 120s in ONE call, spanning the 90s completion.
    advance(state, map, T0 + 120_000);
    const after = cityGoldPerMinute(state);
    expect(after).toBeGreaterThan(before); // the fifth villager got a roof

    // 90s at the old rate + 30s at the new one — NOT 120s at the old rate.
    const earned = getWallet(state.city.wallet, 'Gold') - gold0;
    const oldRateOnly = (120 / 60) * before;
    const correct = (90 / 60) * before + (30 / 60) * after;
    expect(earned).toBeGreaterThan(oldRateOnly);
    expect(Math.abs(earned - correct)).toBeLessThanOrEqual(2); // whole-gold rounding
  });

  it('one-call replay equals stepped ticking across the same window', () => {
    const oneCall = onTheEdgeOfCommunities();
    advance(oneCall, map, T0 + 120_000);

    const stepped = onTheEdgeOfCommunities();
    for (let t = 1000; t <= 120_000; t += 1000) advance(stepped, map, T0 + t);

    expect(getWallet(stepped.city.wallet, 'Gold'))
      .toBe(getWallet(oneCall.city.wallet, 'Gold'));
    expect(stepped.research.completed).toEqual(oneCall.research.completed);
  });

  it('reports a technology that completes exactly on the window edge', () => {
    const state = onTheEdgeOfCommunities();
    const result = advance(state, map, T0 + COMMUNITIES_MS);
    expect(result.completedResearch).toContain('Communities');
  });

  it('terminates on a window with no boundaries at all', () => {
    const state = freshGame();
    const result = advance(state, map, T0 + 8 * 3_600_000);
    expect(state.lastAdvance).toBe(T0 + 8 * 3_600_000);
    expect(result.completedItems).toHaveLength(0);
  });
});
