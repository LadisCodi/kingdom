// Housing taxes: passive gold from housed villagers (the idle income), plus
// the house tap — tapping fast-forwards the tax clock (buildings never
// exhaust; that mechanic is for natural cells only).
//
// The tap is bounded by MANA, one per tap, and by nothing else: a house taps
// like a tree, as often and as fast as the player likes. It used to run a 60s
// per-house collection cycle, which bounded it with a WAIT — and a wait is
// not a decision. The claim these tests protect is that the pool is the only
// gate, that a refused tap costs nothing and moves nothing, and that the
// share-scaling still stops a large city minting more per press than a small
// one.
import { describe, expect, it } from 'vitest';
import { TAP, TAXES } from '../src/sim/data/definitions';
import { tapCell } from '../src/sim/harvest';
import { cityGoldPerMinute, houseTap, queueTraining } from '../src/sim/population';
import { townhallTap } from '../src/sim/commands';
import { mana } from '../src/sim/mana';
import { effectiveAutoTapCooldownMs } from '../src/sim/upgrades';
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
    state.city.wallet.Gold = 0; // measuring INCOME, not the opening grant
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
    state.city.wallet.Gold = 0; // measuring INCOME, not the opening grant
    tickAt(state, T0 + 600_000);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    // Housing arrives late: taxes start from then, not retroactively.
    addBuilt(state, 'Housing', HOUSE);
    tickAt(state, T0 + 600_000 + 30_000); // 2 housed (capacity 2) → 60/min
    expect(getWallet(state.city.wallet, 'Gold')).toBe(30);
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
  it('taps as often as you like, and Mana is what runs out', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', HOUSE2);
    state.city.population = 4; // two residents each — one L1 house holds two

    // The boost is scaled by this house's SHARE of city income, so sweeping
    // every house exactly once pulls forward one tapBoostSeconds of the
    // WHOLE city — which is what stops a big city minting more per tap.
    // Half the city's income for boost_seconds, in whole gold — stated as a
    // RATE so it survives the next change to housing capacity or the tax dial.
    const halfTheCity = Math.floor((cityGoldPerMinute(state) / 60) * TAP.boostSeconds / 2);
    const first = houseTap(state, house(state), T0);
    expect(first.result).toBe('Collected');
    expect(first.gold).toBe(halfTheCity);

    // The SAME house, immediately, as many times as the pool allows. This is
    // the whole change: a house taps like a tree, and no timer is consulted.
    expect(houseTap(state, house(state), T0).result).toBe('Collected');
    expect(houseTap(state, house(state), T0).result).toBe('Collected');
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThan(halfTheCity);
  });

  it('charges one Mana a tap, and stops dead when the pool is dry', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 1;

    const before = mana(state);
    expect(before).toBeGreaterThan(0); // a new kingdom starts full
    expect(houseTap(state, house(state), T0).result).toBe('Collected');
    expect(mana(state)).toBe(before - TAP.manaCost);

    // Drain it and the tap refuses — the pool IS the gate now.
    state.city.wallet.Mana = 0;
    const dry = houseTap(state, house(state), T0);
    expect(dry.result).toBe('NoMana');
    expect(dry.gold).toBe(0);

    // A refused tap must not move the tax clock, or a dry pool would still
    // be printing gold one failed press at a time.
    const anchor = state.city.lastTaxAt;
    houseTap(state, house(state), T0);
    expect(state.city.lastTaxAt).toBe(anchor);
  });

  it('never charges Mana for a tap that could not have paid out', () => {
    const state = freshGame(); // population 0 — nobody lives there
    addBuilt(state, 'Housing', HOUSE);
    const before = mana(state);
    expect(houseTap(state, house(state), T0).result).toBe('NoResidents');
    expect(mana(state)).toBe(before);
  });

  it('paces a HELD pointer like a held tree, and a deliberate tap not at all', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 1;

    expect(houseTap(state, house(state), T0, true).result).toBe('Collected');
    // Inside the auto-tap cooldown a held pointer waits; a real tap does not.
    expect(houseTap(state, house(state), T0 + 1, true).result).toBe('TooSoon');
    expect(houseTap(state, house(state), T0 + 1).result).toBe('Collected');
    const cooldown = effectiveAutoTapCooldownMs(state);
    expect(houseTap(state, house(state), T0 + cooldown + 1, true).result).toBe('Collected');
  });

  it('a full sweep is a bounded percentage over idle, at any size', () => {
    // Per-tap gold scales with the whole city's rate, so without the SHARE
    // scaling a big city would mint more per press than a small one. One
    // sweep pulls forward exactly tapBoostSeconds of city income and costs
    // one Mana per house, however many houses there are.
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
      const expected = (houses * rate * TAP.boostSeconds) / 60;
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

// Every tap that hurries a generator pays the same energy, so the rule is one
// thing to learn rather than four. A tap with nothing to hurry is free.
describe('hurrying a building costs the same energy', () => {
  it('the Townhall villager tap charges, and an idle Townhall is free', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE); // somewhere for a villager to live
    fund(state, { Food: 500 });
    const before = mana(state);
    expect(townhallTap(state, T0)).toBe('NoTraining'); // nothing training yet
    expect(mana(state)).toBe(before);

    queueTraining(state, T0);
    expect(townhallTap(state, T0)).toBe('Boosted');
    expect(mana(state)).toBe(before - TAP.manaCost);

    state.city.wallet.Mana = 0;
    const startedAt = state.city.training!.startedAt;
    expect(townhallTap(state, T0)).toBe('NoMana');
    expect(state.city.training!.startedAt).toBe(startedAt); // nothing hurried
  });
});
