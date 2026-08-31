// Housing taxes: passive gold from housed villagers (the idle income), plus
// the house tap — tapping fast-forwards the tax clock (buildings never
// exhaust; that mechanic is for natural cells only).
import { describe, expect, it } from 'vitest';
import { TAXES } from '../src/sim/data/definitions';
import { tapCell } from '../src/sim/harvest';
import { houseTap, queueTraining } from '../src/sim/population';
import { getWallet, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, T0, tickAt } from './helpers';

const house = (state: GameState) =>
  state.city.districts.find((d) => d.definitionId === 'Housing')!;

const HOUSE = { x: 2, y: 0 }; // revealed grassland
const HOUSE2 = { x: 0, y: -1 }; // second house, NOT adjacent to the first

describe('passive tax gold', () => {
  it('accrues whole units: rate × housed population per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', HOUSE2); // capacity is 1 per house
    state.city.population = 2; // 2 housed × 30/min → 1 Gold every second
    expect(TAXES.goldPerPopulationPerMinute).toBe(30);
    tickAt(state, T0 + 900);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    tickAt(state, T0 + 1000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1);
    tickAt(state, T0 + 60_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(60);
  });

  it('only HOUSED villagers pay: no housing, no gold — and no banked time', () => {
    const state = freshGame();
    state.city.population = 3; // roofless (Townhall houses nobody)
    tickAt(state, T0 + 600_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    // Housing arrives late: taxes start from then, not retroactively.
    addBuilt(state, 'Housing', HOUSE);
    tickAt(state, T0 + 600_000 + 30_000); // 1 housed (capacity 1) → 30/min
    expect(getWallet(state.city.wallet, 'Gold')).toBe(15);
  });

  it('one-call replay (with a training completion mid-window) matches stepped ticking', () => {
    const mk = () => {
      const s = freshGame();
      addBuilt(s, 'Housing', HOUSE);
      addBuilt(s, 'Housing', HOUSE2);
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
  it('fast-forwards the tax clock — no extraction, no exhaustion', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', HOUSE2);
    state.city.population = 2; // 60/min → 1s per gold; boost = 5s per tap
    expect(TAXES.tapBoostSeconds).toBe(5);
    expect(houseTap(state, house(state), T0)).toEqual({ result: 'Boosted', gold: 5 });
    // Paced by the shared collect cooldown (0.5s).
    expect(houseTap(state, house(state), T0).result).toBe('OnCooldown');
    expect(houseTap(state, house(state), T0 + 500)).toEqual({ result: 'Boosted', gold: 5 });
    // 5s boost + the 1s of real time since T0 → 6 whole gold this time.
    expect(houseTap(state, house(state), T0 + 1000)).toEqual({ result: 'Boosted', gold: 6 });
    expect(getWallet(state.city.wallet, 'Gold')).toBe(16);
  });

  it('an empty house cannot be boosted, and houses are not harvest cells', () => {
    const state = freshGame(); // population 0
    addBuilt(state, 'Housing', HOUSE);
    expect(houseTap(state, house(state), T0).result).toBe('NoResidents');
    state.city.population = 2;
    expect(tapCell(state, map, HOUSE, T0)).toBe('NotHarvestable'); // no extraction
  });
});
