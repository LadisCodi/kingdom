// Housing taxes: passive gold from housed villagers (the idle income), plus
// the house tap — tapping fast-forwards the tax clock (buildings never
// exhaust; that mechanic is for natural cells only).
import { describe, expect, it } from 'vitest';
import { TAXES } from '../src/sim/data/definitions';
import { tapCell } from '../src/sim/harvest';
import {
  houseCycleProgress, houseTap, houseTapReady, houseTapReadyIn, queueTraining,
} from '../src/sim/population';
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
    addBuilt(state, 'Housing', HOUSE2); // capacity is 2 per house
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

describe('collecting from a house', () => {
  it('collects early within its cycle, and cannot exceed it', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', HOUSE2);
    state.city.population = 2; // one resident each; 60/min city → 1s per gold

    // The boost is scaled by this house's SHARE of city income, so sweeping
    // every house exactly once pulls forward one tapBoostSeconds of the
    // WHOLE city — which is what bounds it as the city grows.
    const first = houseTap(state, house(state), T0);
    expect(first.result).toBe('Collected');
    expect(first.gold).toBe(TAXES.tapBoostSeconds / 2); // half the city's income

    // Tapping the same house again inside the cycle does nothing at all.
    expect(houseTap(state, house(state), T0).result).toBe('NotReady');
    expect(houseTap(state, house(state), T0 + 1000).result).toBe('NotReady');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(TAXES.tapBoostSeconds / 2);

    // The OTHER house is on its own cycle and still has one ready.
    const second = state.city.districts.filter((d) => d.definitionId === 'Housing')[1];
    expect(houseTap(state, second, T0).result).toBe('Collected');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(TAXES.tapBoostSeconds);
  });

  it('the cycle rolls over, and the progress bar says when', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 1;
    const h = house(state);
    expect(houseCycleProgress(h, T0)).toBe(1); // a fresh house is ready
    houseTap(state, h, T0);
    expect(houseCycleProgress(h, T0)).toBe(0);
    expect(houseTapReady(h, T0)).toBe(false);
    const cycle = TAXES.cycleSeconds * 1000;
    expect(houseCycleProgress(h, T0 + cycle / 2)).toBeCloseTo(0.5, 6);
    expect(houseTapReadyIn(h, T0 + cycle / 2)).toBe(TAXES.cycleSeconds / 2);
    expect(houseTapReady(h, T0 + cycle)).toBe(true);
    expect(houseTap(state, h, T0 + cycle).result).toBe('Collected');
  });

  it('a full sweep every cycle is a bounded percentage over idle, at any size', () => {
    // The old tap was unbounded: gold per tap scaled with the WHOLE city's
    // rate and nothing paced it. Sweeping now pulls forward exactly
    // tapBoostSeconds of city income per cycle, however many houses there are.
    const sweepBonus = (houses: number): number => {
      const state = freshGame();
      // Spaced out: adjacent Housing carries a −1 gold/min penalty, which
      // would put a thumb on the scale this test is reading.
      for (let i = 0; i < houses; i++) addBuilt(state, 'Housing', { x: 2 + 2 * i, y: 4 });
      state.city.population = houses;
      state.city.wallet.Gold = 0;
      state.city.lastTaxAt = T0;
      state.lastAdvance = T0;
      for (const d of state.city.districts) {
        if (d.definitionId === 'Housing') houseTap(state, d, T0);
      }
      return getWallet(state.city.wallet, 'Gold');
    };
    const rate = TAXES.goldPerPopulationPerMinute;
    for (const houses of [2, 4, 8]) {
      // tapBoostSeconds of the whole city's per-minute income.
      const expected = (houses * rate * TAXES.tapBoostSeconds) / 60;
      expect(Math.abs(sweepBonus(houses) - expected)).toBeLessThanOrEqual(1);
    }
  });

  it('an empty house cannot be boosted, and houses are not harvest cells', () => {
    const state = freshGame(); // population 0
    addBuilt(state, 'Housing', HOUSE);
    expect(houseTap(state, house(state), T0).result).toBe('NoResidents');
    state.city.population = 2;
    expect(tapCell(state, map, HOUSE, T0)).toBe('NotHarvestable'); // no extraction
  });
});
