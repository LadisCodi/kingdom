// Housing taxes: passive gold from housed villagers (the idle income), plus
// the house tap — a lived-in house is a gold resource cell like a tree.
import { describe, expect, it } from 'vitest';
import { TAXES } from '../src/sim/data/definitions';
import { collectTap, isExhausted, tapCell } from '../src/sim/harvest';
import { queueTraining } from '../src/sim/population';
import { getWallet } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0, tickAt } from './helpers';

const HOUSE = { x: 2, y: 0 }; // revealed grassland

describe('passive tax gold', () => {
  it('accrues whole units: rate × housed population per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 2; // 2 housed × 2/min → 1 Gold every 15s
    expect(TAXES.goldPerPopulationPerMinute).toBe(2);
    tickAt(state, T0 + 14_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    tickAt(state, T0 + 15_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1);
    tickAt(state, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(4);
  });

  it('only HOUSED villagers pay: no housing, no gold — and no banked time', () => {
    const state = freshGame();
    state.city.population = 3; // roofless (Townhall houses nobody)
    tickAt(state, T0 + 600_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    // Housing arrives late: taxes start from then, not retroactively.
    addBuilt(state, 'Housing', HOUSE);
    tickAt(state, T0 + 600_000 + 30_000); // 2 housed → 1 gold per 15s
    expect(getWallet(state.city.wallet, 'Gold')).toBe(2);
  });

  it('one-call replay (with a training completion mid-window) matches stepped ticking', () => {
    const mk = () => {
      const s = freshGame();
      addBuilt(s, 'Housing', HOUSE);
      s.city.population = 1;
      fund(s, { Food: 100 });
      expect(queueTraining(s, T0)).toBe('Queued'); // housed 1 → 2 at T0+20s
      return s;
    };
    const oneCall = mk();
    tickAt(oneCall, T0 + 120_000);
    const stepped = mk();
    for (let t = 1000; t <= 120_000; t += 1000) tickAt(stepped, T0 + t);
    expect(oneCall.city.population).toBe(stepped.city.population);
    expect(getWallet(oneCall.city.wallet, 'Gold')).toBe(getWallet(stepped.city.wallet, 'Gold'));
    expect(oneCall.city.lastTaxAt).toBe(stepped.city.lastTaxAt);
  });
});

describe('tapping a house', () => {
  it('a lived-in house pays a gold bonus per tap, then exhausts and recovers', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 1;
    expect(collectTap(state, map, HOUSE, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(2); // yield_per_tap
    for (let i = 1; i < 5; i++) expect(tapCell(state, map, HOUSE, T0)).toBe('Harvested');
    expect(isExhausted(state, HOUSE, T0)).toBe(true); // 5 taps spent
    expect(tapCell(state, map, HOUSE, T0 + 59_000)).toBe('Exhausted');
    expect(tapCell(state, map, HOUSE, T0 + 60_000)).toBe('Harvested'); // recovered
  });

  it('an EMPTY house is not tappable', () => {
    const state = freshGame(); // population 0
    addBuilt(state, 'Housing', HOUSE);
    expect(tapCell(state, map, HOUSE, T0)).toBe('NotHarvestable');
  });
});
