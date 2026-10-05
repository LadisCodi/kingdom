// Housing rent (Docs/features/03-economy.md §3): every housed villager pays,
// continuously — into the HOUSE's store, not the wallet. A tap on a house
// with something in it collects the lot, free; a full house stops accruing.
//
// The claims these tests protect: rent is exact whole units per house, a
// full house refuses rather than owes, collecting costs no Mana, and one-call
// replay agrees with stepped ticking across a house filling up.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, TAXES } from '../src/sim/data/definitions';
import { advance, collectBuilding } from '../src/sim/commands';
import { tapCell } from '../src/sim/harvest';
import { cityGoldPerMinute, houseGoldPerMinute, houseTaxBonus } from '../src/sim/population';
import { lineFor, trainUnit } from '../src/sim/army';
import { mana } from '../src/sim/mana';
import { isStoreFull, storageCapacity, storedOf } from '../src/sim/storage';
import { getWallet, townhall, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, rentPerMinute, rentStored, T0, tickAt } from './helpers';

const house = (state: GameState) =>
  state.city.districts.find((d) => d.definitionId === 'Housing')!;

const HOUSE = { x: 2, y: 0 }; // revealed grassland
const HOUSE2 = { x: 0, y: -1 }; // second house, NOT adjacent to the first

describe('rent', () => {
  it('accrues whole units into the house: rate × housed population per minute', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    addBuilt(state, 'Housing', HOUSE2); // capacity is 2 per house
    state.city.population = 2; // 2 housed × 30/min → 1 Gold every second
    const wallet = getWallet(state.city.wallet, 'Gold');
    expect(TAXES.goldPerPopulationPerMinute).toBe(30);
    tickAt(state, T0 + 900);
    expect(rentStored(state)).toBe(0);
    tickAt(state, T0 + 1000);
    expect(rentStored(state)).toBe(1);
    tickAt(state, T0 + 60_000);
    expect(rentStored(state)).toBe(60);
    // Made, not the player's: the wallet has not moved.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(wallet);
  });

  it("a house's level raises the rent its own residents pay", () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    const h = house(state);
    state.city.population = 2; // both in the L1 house, which pays the base
    expect(DISTRICTS.Housing.taxBonusPerLevel[0]).toBe(0);
    expect(rentPerMinute(state)).toBe(2 * TAXES.goldPerPopulationPerMinute);

    // Level 2 buys room for four AND a better rent from each of them.
    h.level = 2;
    state.city.population = 4;
    expect(DISTRICTS.Housing.taxBonusPerLevel[1]).toBe(0.25);
    expect(houseTaxBonus(h)).toBe(0.25);
    expect(rentPerMinute(state)).toBe(4 * TAXES.goldPerPopulationPerMinute * 1.25);

    // And the accrual is that rate: 4 × 30 × 1.25 = 150 a minute.
    h.rentAnchor = T0;
    tickAt(state, T0 + 60_000);
    expect(storedOf(h, 'Gold')).toBe(150);
  });

  it('only HOUSED villagers pay: no housing, no gold — and no banked time', () => {
    const state = freshGame();
    state.city.population = 3; // roofless — the Townhall houses nobody
    tickAt(state, T0 + 600_000);
    expect(rentStored(state)).toBe(0);
    // Housing arrives late: rent starts from THEN, not retroactively —
    // 2 housed (an L1 house holds two) × 30/min = 60/min over 30 s.
    addBuilt(state, 'Housing', HOUSE);
    tickAt(state, T0 + 600_000 + 30_000);
    expect(rentStored(state)).toBe(30);
  });

  it('a full house stops, and owes nothing for the time it was full', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    const h = house(state);
    state.city.population = 2; // 60 Gold a minute
    const cap = storageCapacity(state, h);
    const fillMs = (cap / houseGoldPerMinute(state, h)) * 60_000;
    tickAt(state, T0 + fillMs * 3); // an absence three times as long as the store
    expect(storedOf(h, 'Gold')).toBe(cap);
    expect(isStoreFull(state, h)).toBe(true);
    // Collected, it starts again from the tap — not from when it filled.
    const now = T0 + fillMs * 3 + 500;
    expect(collectBuilding(state, h.uniqueId, now).Gold).toBe(cap);
    tickAt(state, now + 60_000);
    expect(storedOf(h, 'Gold')).toBe(60);
  });

  it('one-call replay (with a training completion and a house filling mid-window) matches stepped ticking', () => {
    const mk = () => {
      const s = freshGame();
      addBuilt(s, 'Housing', HOUSE);
      addBuilt(s, 'Housing', HOUSE2);
      s.city.population = 1;
      fund(s, { Food: 100 });
      expect(trainUnit(s, 'Villager', T0)).toBe('Queued'); // housed 1 → 2 at T0+20s
      return s;
    };
    // Long enough for the first house to fill (its level-1 store, at 60/min).
    const end = Math.ceil(DISTRICTS.Housing.storageCapacityPerLevel[0] / 60 + 30) * 60_000;
    const oneCall = mk();
    tickAt(oneCall, T0 + end);
    const stepped = mk();
    for (let t = 60_000; t <= end; t += 60_000) tickAt(stepped, T0 + t);
    expect(oneCall.city.population).toBe(stepped.city.population);
    expect(isStoreFull(oneCall, house(oneCall))).toBe(true);
    for (let i = 0; i < oneCall.city.districts.length; i++) {
      const a = oneCall.city.districts[i];
      const b = stepped.city.districts[i];
      expect(a.stored).toEqual(b.stored);
      expect(a.rentAnchor).toBe(b.rentAnchor);
    }
  });
});

describe('collecting from a house', () => {
  it('moves the whole store to the wallet, and costs no Mana', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 2;
    tickAt(state, T0 + 60_000);
    const before = { gold: getWallet(state.city.wallet, 'Gold'), mana: mana(state) };
    const moved = collectBuilding(state, house(state).uniqueId, T0 + 60_000);
    expect(moved.Gold).toBe(60);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(before.gold + 60);
    expect(mana(state)).toBe(before.mana);
    expect(house(state).stored).toBeUndefined();
  });

  it('an empty store collects nothing — the tap is the card\'s then', () => {
    const state = freshGame(); // population 0 — nobody lives there
    addBuilt(state, 'Housing', HOUSE);
    expect(collectBuilding(state, house(state).uniqueId, T0)).toEqual({});
    state.city.population = 2;
    expect(tapCell(state, map, HOUSE, T0)).toBe('NotHarvestable'); // no extraction
  });

  it('the Townhall collects only its own Gold: the rent stays in each house', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 2;
    tickAt(state, T0 + 60_000);
    expect(collectBuilding(state, townhall(state).uniqueId, T0 + 60_000))
      .toEqual({ Gold: DISTRICTS.Townhall.goldPerMinutePerLevel[0] });
    expect(storedOf(house(state), 'Gold')).toBe(60);
    expect(storageCapacity(state, townhall(state))).toBeGreaterThan(0);
  });
});

// A tap buys WORK. A training queue is not work — it is a fixed duration —
// and a tap is a scaling one, so a maxed thumb would finish a 20-second
// villager in a single press. Timers take Gems (04-harvest.md §3.2).
describe('a training queue cannot be hurried by hand', () => {
  it('runs on its own clock whatever the player does', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE); // somewhere for a villager to live
    fund(state, { Food: 500 });
    trainUnit(state, 'Villager', T0);
    const startedAt = lineFor(state, townhall(state).uniqueId)[0].startedAt;
    const before = mana(state);

    // The Townhall is not a harvest cell and has no tap of its own: the only
    // thing that can move this line is time.
    expect(tapCell(state, map, { x: 0, y: 0 }, T0)).toBe('NotHarvestable');
    expect(mana(state)).toBe(before);
    expect(lineFor(state, townhall(state).uniqueId)[0].startedAt).toBe(startedAt);
  });
});

// Docs/features/03-economy.md §3 — the Townhall makes Gold of its own, into
// its own store, with nobody living in it: the city always has a source.
describe('the Townhall makes Gold of its own', () => {
  it('is a climbing ladder, one entry per Townhall level, with a store', () => {
    const ladder = DISTRICTS.Townhall.goldPerMinutePerLevel;
    expect(ladder.length).toBe(DISTRICTS.Townhall.maxLevel);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    expect(DISTRICTS.Townhall.storageCapacityPerLevel.length).toBe(DISTRICTS.Townhall.maxLevel);
  });

  it('fills its store with nobody housed, and one call equals stepped ticking', () => {
    const once = freshGame();
    const stepped = freshGame();
    const perMinute = DISTRICTS.Townhall.goldPerMinutePerLevel[0];
    // Four minutes: inside what a level-1 store holds.
    advance(once, map, T0 + 4 * 60_000);
    for (let m = 1; m <= 4; m++) advance(stepped, map, T0 + m * 60_000 - 7_000);
    advance(stepped, map, T0 + 4 * 60_000);
    expect(storedOf(townhall(once), 'Gold')).toBe(4 * perMinute);
    expect(storedOf(townhall(stepped), 'Gold')).toBe(4 * perMinute);
  });

  it('leaves the houses\' rent alone: a bigger Townhall is its own income', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', HOUSE);
    state.city.population = 2;
    const at1 = cityGoldPerMinute(state);
    townhall(state).level = 2;
    const [l1, l2] = DISTRICTS.Townhall.goldPerMinutePerLevel;
    expect(cityGoldPerMinute(state)).toBe(at1 - l1 + l2);
  });
});
