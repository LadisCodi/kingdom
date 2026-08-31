// Worker units: claims, the harvest cycle, exhaustion interplay, determinism,
// plus the Townhall cycle that shares the unified advance.
import { describe, expect, it } from 'vitest';
import { changeWorkers, enqueueBuild, townhallCycle, townhallTap } from '../src/sim/commands';
import { HARVEST, WORKER } from '../src/sim/data/definitions';
import { isExhausted, tapCell } from '../src/sim/harvest';
import { getWallet, type GameState } from '../src/sim/state';
import { assignableWorkerLimit, workableCells } from '../src/sim/workers';
import { freshGame, fund, map, reveal, T0, tickAt } from './helpers';

// (2,1)'s only adjacent tree is (2,2); (2,3) sits at radius 2.
const SAWMILL_CELL = { x: 2, y: 1 };
const FOREST_A = { x: 2, y: 2 }; // the sawmill's ONLY radius-1 tree
const FOREST_B = { x: 2, y: 3 }; // radius-2 — needs a level-2 sawmill

// One harvest cycle from an adjacent (orthogonal) cell:
// 2 × (1 / speed) move + workSeconds.
const CYCLE_MS = 2 * (1 / WORKER.moveSpeedTilesPerSecond) * 1000 + WORKER.workSeconds * 1000;

const builtSawmill = (state: GameState) => {
  fund(state, { Silver: 500, Wood: 500 });
  // Fog-independent setup: the Townhall's fog radius would reveal every tree
  // near the origin, so start from black fog and reveal only the test cells.
  // (The sawmill's own completion re-reveals its radius-1 ring.)
  state.fog.revealed = {};
  state.fog.discovered = {};
  reveal(state, [SAWMILL_CELL, FOREST_A, FOREST_B]);
  expect(enqueueBuild(state, map, 'Sawmill', SAWMILL_CELL)).toBe('Started');
  tickAt(state, T0);
  tickAt(state, T0 + 30_000); // build takes 23s
  const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
  expect(sawmill.state).toBe('Built');
  return sawmill;
};

describe('area of influence & worker limit', () => {
  it('radius by level: L1 sees only the adjacent forest; L2 also the far one', () => {
    const state = freshGame();
    const sawmill = builtSawmill(state);
    expect(workableCells(state, map, sawmill)).toHaveLength(1);
    expect(assignableWorkerLimit(state, map, sawmill)).toBe(1); // min(3, 1)
    sawmill.level = 2;
    expect(workableCells(state, map, sawmill)).toHaveLength(2);
    expect(assignableWorkerLimit(state, map, sawmill)).toBe(2); // min(5, 2)
  });

  it('unrevealed forest cells do not count', () => {
    const state = freshGame();
    const sawmill = builtSawmill(state);
    sawmill.level = 3; // radius 3 reaches many authored Trees, but only revealed ones count
    expect(workableCells(state, map, sawmill)).toHaveLength(2);
  });
});

describe('the harvest cycle', () => {
  it('walk → work → walk home → deposit: +1 Wood and +1 tap on the cell', () => {
    const state = freshGame();
    state.city.population = 3;
    const sawmill = builtSawmill(state);
    const start = state.lastAdvance;
    const woodBefore = getWallet(state.city.wallet, 'Wood');
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, start)).toBe('Assigned');
    const w = state.workers[0];
    expect(w.activity).toBe('MovingToCell');
    expect(w.claimedCell).toEqual(FOREST_A);
    tickAt(state, start + CYCLE_MS - 100);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore); // still walking home
    tickAt(state, start + CYCLE_MS + 100);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 1);
    expect(state.harvest['2,2'].taps).toBe(1);
    expect(w.activity).toBe('MovingToCell'); // straight back out
  });

  it('one-call replay equals second-by-second ticking (determinism)', () => {
    const mkState = () => {
      const s = freshGame();
      s.city.population = 3;
      const sm = builtSawmill(s);
      changeWorkers(s, map, sm.uniqueId, 1, s.lastAdvance);
      return s;
    };
    const horizon = 10 * 60_000; // 10 min spans several exhaust/recover windows
    const oneCall = mkState();
    tickAt(oneCall, oneCall.lastAdvance + horizon);
    const stepped = mkState();
    const start = stepped.lastAdvance;
    for (let t = 1000; t <= horizon; t += 1000) tickAt(stepped, start + t);
    expect(getWallet(oneCall.city.wallet, 'Wood')).toBe(getWallet(stepped.city.wallet, 'Wood'));
    expect(getWallet(oneCall.city.wallet, 'Wood')).toBeGreaterThan(10); // crossed a recovery
  });

  it('delivery that exhausts the only cell sends the worker Idle until recovery', () => {
    const state = freshGame();
    state.city.population = 3;
    const sawmill = builtSawmill(state);
    const start = state.lastAdvance;
    // Player taps the forest 9 times; the worker's delivery is the 10th.
    for (let i = 0; i < 9; i++) expect(tapCell(state, map, FOREST_A, start)).toBe('Harvested');
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    tickAt(state, start + CYCLE_MS + 100);
    expect(isExhausted(state, FOREST_A, start + CYCLE_MS + 100)).toBe(true);
    const w = state.workers[0];
    expect(w.activity).toBe('Idle');
    // It resumes automatically after the 90s recovery.
    const resumeBy = start + CYCLE_MS + HARVEST.Forest.recoverySeconds * 1000 + CYCLE_MS + 1000;
    tickAt(state, resumeBy);
    expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThanOrEqual(11); // 9 taps + 2 deliveries
  });

  it('cell exhausted en route: worker returns empty-handed', () => {
    const state = freshGame();
    state.city.population = 3;
    const sawmill = builtSawmill(state);
    const start = state.lastAdvance;
    const woodBefore = getWallet(state.city.wallet, 'Wood');
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    // Exhaust the cell while the worker is walking (move takes ~1.4s).
    for (let i = 0; i < 10; i++) tapCell(state, map, FOREST_A, start + 500);
    tickAt(state, start + CYCLE_MS + 100);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 10); // player's taps only
    expect(state.workers[0].activity).toBe('Idle');
  });

  it('race rule: exhaustion mid-work still yields the worker its unit', () => {
    const state = freshGame();
    state.city.population = 3;
    const sawmill = builtSawmill(state);
    const start = state.lastAdvance;
    const woodBefore = getWallet(state.city.wallet, 'Wood');
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    tickAt(state, start + 3000); // arrived, working (move ≈ 1.4s)
    expect(state.workers[0].activity).toBe('Working');
    for (let i = 0; i < 10; i++) tapCell(state, map, FOREST_A, start + 3000);
    expect(isExhausted(state, FOREST_A, start + 3000)).toBe(true);
    tickAt(state, start + CYCLE_MS + 2000);
    // 10 player taps + the secured delivery.
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 11);
  });

  it('two workers claim distinct cells', () => {
    const state = freshGame();
    state.city.population = 5;
    const sawmill = builtSawmill(state);
    sawmill.level = 2; // reach both forests
    const start = state.lastAdvance;
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    const claims = state.workers.map((w) => w.claimedCell);
    expect(claims).toContainEqual(FOREST_A);
    expect(claims).toContainEqual(FOREST_B);
  });
});

describe('Townhall cycle', () => {
  it('pays 5 × population Silver per 10s cycle, straight to the wallet', () => {
    const state = freshGame();
    state.city.population = 2; // the rebalanced start has 0 population
    const silver = getWallet(state.city.wallet, 'Silver');
    tickAt(state, T0 + 9_000);
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silver);
    tickAt(state, T0 + 10_000);
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silver + 10);
    tickAt(state, T0 + 100_000); // 9 more cycles
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silver + 100);
  });

  it('taps add 2s of progress and can complete a cycle early; never exhausts', () => {
    const state = freshGame();
    state.city.population = 2;
    const silver = getWallet(state.city.wallet, 'Silver');
    tickAt(state, T0 + 4_000); // 4s into the 10s cycle
    let paid = 0;
    for (let i = 0; i < 3; i++) paid += townhallTap(state, T0 + 4_000);
    expect(paid).toBe(10); // 4s elapsed + 3 taps × 2s = full cycle
    expect(getWallet(state.city.wallet, 'Silver')).toBe(silver + 10);
    expect(townhallCycle(state, T0 + 4_000).progress).toBeLessThan(0.02);
  });
});

