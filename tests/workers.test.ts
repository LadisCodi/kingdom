// Worker units: claims, the harvest cycle, exhaustion interplay, determinism,
// plus Townhall villager training that shares the unified advance.
import { describe, expect, it } from 'vitest';
import { changeWorkers, enqueueBuild, townhallTap } from '../src/sim/commands';
import { populationCost, queueTraining } from '../src/sim/population';
import { HARVEST, WORKER } from '../src/sim/data/definitions';
import { isExhausted, tapCell } from '../src/sim/harvest';
import { getWallet, type GameState, coordKey } from '../src/sim/state';
import { assignableWorkerLimit, workableCells } from '../src/sim/workers';
import { effectiveTapYield, effectiveWorkerYield } from '../src/sim/upgrades';
import { addBuilt, completeTech, freshGame, fund, map, reveal, T0, tickAt } from './helpers';

// Sawmill at (3,1), chosen so its own completion re-reveals exactly ONE tree
// — the adjacent one. Every other tree in range stays under fog unless this
// fixture reveals it, which is what lets each test below hand the sawmill a
// precise number of workable cells.
const SAWMILL_CELL = { x: 3, y: 1 };
const FOREST_A = { x: 3, y: 2 }; // orthogonally ADJACENT — CYCLE_MS assumes it
const FOREST_B = { x: 2, y: 3 }; // radius 2 — still in the L1 area
const FOREST_C = { x: 0, y: 3 }; // radius 3 — needs a level-2 sawmill

// One harvest cycle from an adjacent (orthogonal) cell:
// 2 × (1 / speed) move + workSeconds.
const CYCLE_MS = 2 * (1 / WORKER.moveSpeedTilesPerSecond) * 1000 + WORKER.workSeconds * 1000;

const builtSawmill = (state: GameState, forests = [FOREST_A, FOREST_B]) => {
  fund(state, { Gold: 500, Wood: 500 });
  // Forestry opens the forest to the TAP; Saws opens the Sawmill that works
  // it for you (Docs/onboarding.md steps 3 and 15).
  completeTech(state, 'Forestry');
  completeTech(state, 'Saws');
  // Fog-independent setup: the Townhall's fog radius would reveal every tree
  // near the origin, so start from black fog and reveal only the test cells.
  // (The sawmill's own completion re-reveals its radius-1 ring.)
  state.fog.revealed = {};
  state.fog.discovered = {};
  reveal(state, [SAWMILL_CELL, ...forests]);
  expect(enqueueBuild(state, map, 'Sawmill', SAWMILL_CELL)).toBe('Started');
  tickAt(state, T0);
  tickAt(state, T0 + 30_000); // build takes 23s
  const sawmill = state.city.districts.find((d) => d.definitionId === 'Sawmill')!;
  expect(sawmill.state).toBe('Built');
  return sawmill;
};

describe('area of influence & worker limit', () => {
  it('radius by level: L1 reaches the two near forests; L2 also the far one', () => {
    const state = freshGame();
    const sawmill = builtSawmill(state, [FOREST_A, FOREST_B, FOREST_C]);
    expect(workableCells(state, map, sawmill)).toHaveLength(2);
    expect(assignableWorkerLimit(sawmill)).toBe(3); // per-level cap — cells don't limit
    sawmill.level = 2;
    expect(workableCells(state, map, sawmill)).toHaveLength(3);
    expect(assignableWorkerLimit(sawmill)).toBe(5);
  });

  it('workers beyond the workable cells are assignable and wait Idle', () => {
    const state = freshGame();
    state.city.population = 5;
    const sawmill = builtSawmill(state, [FOREST_A]); // L1: cap 3, one workable cell
    const start = state.lastAdvance;
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, start)).toBe('Assigned');
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, start)).toBe('Assigned');
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, start)).toBe('Assigned');
    expect(changeWorkers(state, map, sawmill.uniqueId, 1, start)).toBe('AtCapacity');
    expect(state.workers.filter((w) => w.activity === 'Idle')).toHaveLength(2);
    expect(state.workers.filter((w) => w.claimedCell !== null)).toHaveLength(1);
  });

  it('unrevealed forest cells do not count', () => {
    const state = freshGame();
    const sawmill = builtSawmill(state);
    sawmill.level = 3; // radius 4 reaches many authored Trees, but only revealed ones count
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
    expect(state.harvest[coordKey(FOREST_A)].taps).toBe(1);
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
    const sawmill = builtSawmill(state, [FOREST_A]);
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
    const sawmill = builtSawmill(state, [FOREST_A]);
    const start = state.lastAdvance;
    const woodBefore = getWallet(state.city.wallet, 'Wood');
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    // Exhaust the cell while the worker is walking (move takes ~1.4s).
    for (let i = 0; i < 10; i++) tapCell(state, map, FOREST_A, start + 500);
    tickAt(state, start + CYCLE_MS + 100);
    // Player's taps only. A tap is worth boostSeconds of production now, and
    // this sawmill is staffed, so that is well above the authored floor of 1.
    const perTap = effectiveTapYield(state, HARVEST.Forest);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 10 * perTap);
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
    // 10 player taps + the one delivery the worker had already secured.
    const perTap = effectiveTapYield(state, HARVEST.Forest);
    const perWorker = effectiveWorkerYield(state, HARVEST.Forest);
    expect(getWallet(state.city.wallet, 'Wood')).toBe(woodBefore + 10 * perTap + perWorker);
  });

  it('two workers claim distinct cells', () => {
    const state = freshGame();
    state.city.population = 5;
    const sawmill = builtSawmill(state); // L1 reaches both forests
    const start = state.lastAdvance;
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    changeWorkers(state, map, sawmill.uniqueId, 1, start);
    const claims = state.workers.map((w) => w.claimedCell);
    expect(claims).toContainEqual(FOREST_A);
    expect(claims).toContainEqual(FOREST_B);
  });
});

describe('Townhall villager training', () => {
  it('queues villagers, each paid up front, delivered in sequence', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 }); // one L1 house holds TWO
    fund(state, { Food: 100 });
    expect(queueTraining(state, T0)).toBe('Queued'); // populationCost(0) = 3
    expect(getWallet(state.city.wallet, 'Food')).toBe(100 - 3);
    expect(queueTraining(state, T0)).toBe('Queued'); // second one queues behind
    expect(getWallet(state.city.wallet, 'Food')).toBe(100 - 3 - populationCost(1));
    expect(queueTraining(state, T0)).toBe('AtMax'); // 0 pop + 2 queued = cap
    tickAt(state, T0 + 19_000);
    expect(state.city.population).toBe(0);
    tickAt(state, T0 + 20_000);
    expect(state.city.population).toBe(1);
    tickAt(state, T0 + 39_000);
    expect(state.city.population).toBe(1);
    tickAt(state, T0 + 40_000);
    expect(state.city.population).toBe(2);
    expect(state.city.training).toBe(null);
  });

  it('taps boost the CURRENT villager; the next starts at its completion', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    addBuilt(state, 'Housing', { x: 0, y: -1 });
    fund(state, { Food: 100 });
    expect(townhallTap(state, T0)).toBe('NoTraining');
    queueTraining(state, T0);
    queueTraining(state, T0);
    tickAt(state, T0 + 10_000); // halfway through villager 1
    for (let i = 0; i < 4; i++) expect(townhallTap(state, T0 + 10_000)).toBe('Boosted');
    expect(townhallTap(state, T0 + 10_000)).toBe('TrainingComplete'); // 10s + 5 × 2s
    expect(state.city.population).toBe(1);
    // Villager 2 started at the boosted completion, not back at T0.
    tickAt(state, T0 + 29_000);
    expect(state.city.population).toBe(1);
    tickAt(state, T0 + 30_000);
    expect(state.city.population).toBe(2);
  });

  it('is blocked at the housing cap (queued villagers count)', () => {
    const state = freshGame();
    fund(state, { Food: 100 });
    expect(queueTraining(state, T0)).toBe('AtMax'); // no Housing yet
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 2; // the Housing (L1 capacity 2) is full
    expect(queueTraining(state, T0)).toBe('AtMax');
  });
});

