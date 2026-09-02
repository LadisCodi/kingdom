// Mana and landmarks (Docs/features/magic.md §1, §4).
//
// Mana is the only capped currency in the game, and the cap IS the mechanic:
// pressure that costs the player nothing they own. Two things therefore have
// to be exactly right — that the pool stops at the ceiling and the overflow is
// discarded rather than banked, and that the whole thing replays offline the
// same way it ticks live.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { MANA, OFFLINE_CAP_HOURS } from '../src/sim/data/definitions';
import {
  claimLandmark, landmarkClaimCost, visibleLandmarks,
} from '../src/sim/landmarks';
import {
  accrueMana, addMana, mana, manaCap, manaFillHours, manaNetRegen, manaProduction,
  manaRefillGemCost, manaUpkeep, refillManaWithGems,
} from '../src/sim/mana';
import { LANDMARKS } from '../src/sim/data/definitions';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, townhall, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, reveal, T0 } from './helpers';

const HOUR = 3_600_000;
const first = LANDMARKS[0];
/** Far enough out that the Townhall's own reveal radius does not cover it —
 *  the first landmark sits deliberately in sight, to teach the mechanic. */
const distant = LANDMARKS.find((l) => l.id === 'FallenStones')!;

/** A new kingdom starts with a FULL pool (the house tap is paid from it), so
 *  every test about FILLING one has to empty it first and say so. */
const drained = (state: GameState): GameState => {
  state.city.wallet.Mana = 0;
  return state;
};

const sanctum = (state: GameState, level: number): void => {
  addBuilt(state, 'Sanctum', { x: 3, y: 1 });
  state.city.districts.find((d) => d.definitionId === 'Sanctum')!.level = level;
};

describe('the two dials', () => {
  it('production comes from the Townhall and the landmarks it does not', () => {
    const state = freshGame();
    expect(manaProduction(state)).toBe(MANA.productionPerTownhallLevel[0]);
    townhall(state).level = 2;
    expect(manaProduction(state)).toBe(MANA.productionPerTownhallLevel[1]);
    state.landmarks.claimed[first.id] = true;
    expect(manaProduction(state))
      .toBe(MANA.productionPerTownhallLevel[1] + MANA.landmarkProduction);
  });

  it('capacity comes from the Townhall and the Sanctum, and not from landmarks', () => {
    const state = freshGame();
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0]);
    state.landmarks.claimed[first.id] = true;
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0]); // production, not capacity
    sanctum(state, 1);
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0] + MANA.sanctumCapPerLevel[0]);
    state.city.districts.find((d) => d.definitionId === 'Sanctum')!.level = 3;
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0] + MANA.sanctumCapPerLevel[2]);
  });

  it('an unfinished Sanctum holds nothing', () => {
    const state = freshGame();
    addBuilt(state, 'Sanctum', { x: 3, y: 1 });
    state.city.districts.find((d) => d.definitionId === 'Sanctum')!.state = 'UnderConstruction';
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0]);
  });

  // THE TUNING LAW IS DELIBERATELY SUSPENDED (2026-09-02).
  //
  // It was `cap ≈ 8 × net regen`, so an overnight absence filled the pool
  // exactly and the two caps reinforced each other. That law belonged to a
  // Mana pool whose only job was sustaining artifacts — an ABSENCE budget.
  //
  // Mana is now the energy every tap is paid from, so the pool is a SPEND
  // budget, and the two want opposite things: an absence budget should refill
  // exactly overnight, while a spend budget has to be able to run out or
  // there is nothing for a refill to sell. The cap went to 50 and regen did
  // not follow, so a full pool is 12.5h rather than 8h.
  //
  // This test now pins the new intent rather than the old law, so the day
  // someone re-tunes regen they have to come here and say which budget they
  // are tuning for. Restoring the old law at cap 50 means regen 7/h at TH1.
  it('is a SPEND budget now: the pool no longer refills inside an absence', () => {
    for (let level = 1; level <= 3; level++) {
      const state = freshGame();
      townhall(state).level = level;
      expect(manaFillHours(state)).toBeGreaterThan(OFFLINE_CAP_HOURS);
      expect(Number.isFinite(manaFillHours(state))).toBe(true);
    }
  });

  it('starts a new kingdom full, because every tap is paid from it', () => {
    const state = freshGame();
    expect(mana(state)).toBe(manaCap(state));
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0]);
  });
});

describe('upkeep', () => {
  it('is drawn by what is attuned, and never takes regen below zero', () => {
    const state = freshGame();
    expect(manaUpkeep(state)).toBe(0);
    state.artifacts.attuned = ['GildedLedger']; // 3/h
    expect(manaUpkeep(state)).toBe(3);
    expect(manaNetRegen(state)).toBe(manaProduction(state) - 3);

    // Stalled, never bankrupt: the design's first promise applied to the one
    // resource that could otherwise break it.
    state.artifacts.attuned = [
      'GildedLedger', 'ForemansSigil', 'VerdantSeal', 'WanderersCompass', 'DowsingRod',
    ];
    expect(manaUpkeep(state)).toBeGreaterThan(manaProduction(state));
    expect(manaNetRegen(state)).toBe(0);
  });

  it('a stalled kingdom banks no time against a future rate', () => {
    const state = drained(freshGame());
    state.artifacts.attuned = [
      'GildedLedger', 'ForemansSigil', 'VerdantSeal', 'WanderersCompass', 'DowsingRod',
    ];
    advance(state, map, T0 + 6 * HOUR);
    expect(mana(state)).toBe(0);
    // Un-attune everything and the pool starts from NOW, not from six hours ago.
    state.artifacts.attuned = [null];
    advance(state, map, T0 + 6 * HOUR + 1000);
    expect(mana(state)).toBe(0);
  });
});

describe('the pool', () => {
  it('fills to the ceiling and discards the overflow', () => {
    const state = drained(freshGame());
    const cap = manaCap(state);
    expect(addMana(state, cap + 50)).toBe(cap); // only the cap was banked
    expect(mana(state)).toBe(cap);
    expect(addMana(state, 10)).toBe(0); // and it stays there
    expect(mana(state)).toBe(cap);
  });

  it('never goes negative', () => {
    const state = freshGame();
    addMana(state, 5);
    addMana(state, -50);
    expect(mana(state)).toBe(0);
  });

  it('a full pool keeps consuming the clock, which IS the pressure', () => {
    // Banking the overflow would remove the reason to come back before it fills.
    const state = freshGame();
    advance(state, map, T0 + 24 * HOUR);
    expect(mana(state)).toBe(manaCap(state));
    state.city.wallet.Mana = 0;
    advance(state, map, T0 + 24 * HOUR + 1000);
    expect(mana(state)).toBe(0); // no 18 hours of banked overflow arrives
  });

  it('accrues in whole units against its own anchor', () => {
    const state = drained(freshGame());
    const rate = manaNetRegen(state); // per hour
    const msPerMana = HOUR / rate;
    accrueMana(state, T0 + msPerMana - 1);
    expect(mana(state)).toBe(0);
    accrueMana(state, T0 + msPerMana);
    expect(mana(state)).toBe(1);
    accrueMana(state, T0 + 3 * msPerMana);
    expect(mana(state)).toBe(3);
  });

  it('one-call replay equals stepped ticking', () => {
    const oneCall = freshGame();
    advance(oneCall, map, T0 + 3 * HOUR);

    const stepped = freshGame();
    for (let t = 60_000; t <= 3 * HOUR; t += 60_000) advance(stepped, map, T0 + t);

    expect(mana(stepped)).toBe(mana(oneCall));
    expect(stepped.city.lastManaAt).toBe(oneCall.city.lastManaAt);
  });

  it('is city production, so the 8h offline cap applies to it', () => {
    // Unlike a timer. The rule: the cap limits what the CITY PRODUCES while
    // you are away; it never limits what a timer does.
    const state = freshGame();
    sanctum(state, 3); // a pool big enough that 8h does not fill it
    townhall(state).level = 3;
    const restored = deserialize(serialize(state, T0), map, T0 + 40 * HOUR)!;
    expect(mana(restored)).toBeLessThan(manaCap(restored));
  });
});

describe('gem refills', () => {
  it('are priced on what is missing, so a full pool costs nothing', () => {
    const state = drained(freshGame());
    const cap = manaCap(state);
    expect(manaRefillGemCost(state)).toBe(Math.ceil(cap / MANA.gemRefillPerGem));
    addMana(state, cap);
    expect(manaRefillGemCost(state)).toBe(0);
    expect(refillManaWithGems(state)).toBe('AlreadyFull');
  });

  it('fill the pool and charge the gems', () => {
    const state = drained(freshGame());
    state.player.wallet.Gems = 100;
    const cost = manaRefillGemCost(state);
    expect(refillManaWithGems(state)).toBe('Refilled');
    expect(mana(state)).toBe(manaCap(state));
    expect(getWallet(state.player.wallet, 'Gems')).toBe(100 - cost);
  });

  it('refuse politely when the purse is empty', () => {
    const state = drained(freshGame());
    state.player.wallet.Gems = 0;
    expect(refillManaWithGems(state)).toBe('NotEnoughGems');
  });
});

describe('landmarks', () => {
  it('are invisible until the fog is off them', () => {
    const state = freshGame();
    expect(visibleLandmarks(state, map).map((l) => l.id)).not.toContain(distant.id);
    reveal(state, [distant.location]);
    expect(visibleLandmarks(state, map).map((l) => l.id)).toContain(distant.id);
  });

  it('cost Gold on the fog’s own distance curve, and pay production forever', () => {
    const state = freshGame();
    reveal(state, [first.location]);
    const cost = landmarkClaimCost(map, first);
    expect(cost).toBeGreaterThan(0);

    expect(claimLandmark(state, map, first.location)).toBe('NotEnoughGold');
    fund(state, { Gold: cost });
    const before = manaProduction(state);
    expect(claimLandmark(state, map, first.location)).toBe('Claimed');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    expect(manaProduction(state)).toBe(before + MANA.landmarkProduction);
    expect(claimLandmark(state, map, first.location)).toBe('AlreadyClaimed');
  });

  it('cannot be claimed through the fog', () => {
    const state = freshGame();
    fund(state, { Gold: 100_000 });
    expect(claimLandmark(state, map, distant.location)).toBe('NotRevealed');
  });

  it('a defended one waits for the party that clears it', () => {
    const state = freshGame();
    const defended = LANDMARKS.find((l) => l.defended)!;
    fund(state, { Gold: 100_000 });
    reveal(state, [defended.location]);
    expect(claimLandmark(state, map, defended.location)).toBe('Defended');
    state.landmarks.cleared[defended.id] = true;
    expect(claimLandmark(state, map, defended.location)).toBe('Claimed');
  });

  it('get farther and dearer, so exploration compounds instead of paying flat', () => {
    const costs = LANDMARKS.map((l) => landmarkClaimCost(map, l));
    expect(Math.max(...costs)).toBeGreaterThan(Math.min(...costs) * 4);
  });

  it('survive a save round-trip', () => {
    const state = freshGame();
    state.landmarks.claimed[first.id] = true;
    state.landmarks.cleared['CircleOfNine'] = true;
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.landmarks.claimed[first.id]).toBe(true);
    expect(restored.landmarks.cleared.CircleOfNine).toBe(true);
    expect(manaProduction(restored)).toBe(manaProduction(state));
  });
});
