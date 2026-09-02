// Mana and landmarks (Docs/features/magic.md §1, §4).
//
// Mana is the only capped currency in the game, and the cap IS the mechanic:
// pressure that costs the player nothing they own. Two things therefore have
// to be exactly right — that the pool stops at the ceiling and the overflow is
// discarded rather than banked, and that the whole thing replays offline the
// same way it ticks live.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { fogState } from '../src/sim/fog';
import { addModifier, type Modifier } from '../src/sim/modifiers';
import { MANA, OFFLINE_CAP_HOURS } from '../src/sim/data/definitions';
import {
  claimLandmark, landmarkClaimCost, visibleLandmarks,
} from '../src/sim/landmarks';
import {
  accrueMana, addMana, mana, manaCap, manaFillHours, manaNetRegen, manaProduction,
  manaRefillGemCost, refillManaWithGems,
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
    // Sanctuaries buy CAPACITY, not rate — production is the Townhall alone.
    state.landmarks.claimed[first.id] = true;
    expect(manaProduction(state)).toBe(MANA.productionPerTownhallLevel[1]);
  });

  it('capacity comes from the Townhall, the Sanctum AND every sanctuary', () => {
    const state = freshGame();
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0]);
    state.landmarks.claimed[first.id] = true;
    expect(manaCap(state)).toBe(MANA.baseCapPerTownhallLevel[0] + MANA.landmarkCap);
    delete state.landmarks.claimed[first.id];
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

describe('what draws against the pool', () => {
  // Nothing does. Relics used to charge an hourly upkeep while attuned, which
  // was removed once Mana became the energy every tap is paid from: at
  // Townhall 1 the full set drew exactly what the Townhall made, so wearing
  // everything stalled the pool dead and left nothing to play with. The pool
  // is a tap budget now, and only the player spends it.
  it('is nothing — wearing every relic does not slow the fill', () => {
    const state = freshGame();
    const bare = manaNetRegen(state);
    expect(bare).toBe(manaProduction(state));
    state.artifacts.attuned = [
      'GildedLedger', 'ForemansSigil', 'VerdantSeal', 'WanderersCompass', 'DowsingRod',
    ];
    expect(manaNetRegen(state)).toBe(bare);
  });

  // Relics can no longer stall the pool, but a modifier still can — a season
  // or a debug switch that zeroes `manaRegen`. The rule the branch protects is
  // unchanged and worth keeping covered: a stalled kingdom must not bank the
  // stalled hours and pay them out the moment the rate returns.
  it('a stalled kingdom banks no time against a future rate', () => {
    const state = drained(freshGame());
    const stall: Modifier = {
      id: 'test:stall', source: 'debug', stat: 'manaRegen', scope: null,
      op: 'mul', value: 0, expiresAt: null,
    };
    addModifier(state, stall);
    expect(manaNetRegen(state)).toBe(0);
    advance(state, map, T0 + 6 * HOUR);
    expect(mana(state)).toBe(0);

    // Lift it and the pool starts from NOW, not from six hours ago.
    state.modifiers = [];
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
    const state = drained(freshGame());
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

  // The variant that matters, and the one that did not exist: a window the
  // pool CROSSES the cap inside. A full pool early-outs from step zero, so
  // starting full (which freshGame now does) hides any divergence in how the
  // anchor advances once the ceiling is reached.
  it('one-call replay equals stepped ticking ACROSS the ceiling', () => {
    // NOT a whole multiple of msPerMana (15 min at TH1). The normal branch
    // keeps the sub-unit remainder while a naive over-cap early-out would
    // snap the anchor to `toTime`; on an exact multiple the two agree by
    // accident and the divergence hides.
    const horizon = 20 * HOUR + 7 * 60_000;
    const oneCall = drained(freshGame());
    advance(oneCall, map, T0 + horizon);

    const stepped = drained(freshGame());
    for (let t = 60_000; t <= horizon; t += 60_000) advance(stepped, map, T0 + t);

    expect(mana(stepped)).toBe(mana(oneCall));
    expect(mana(oneCall)).toBe(manaCap(oneCall)); // it really did cross
    expect(stepped.city.lastManaAt).toBe(oneCall.city.lastManaAt);
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

  it('cost Gold on the fog’s own distance curve, and pay capacity forever', () => {
    const state = freshGame();
    reveal(state, [first.location]);
    const cost = landmarkClaimCost(first);
    expect(cost).toBeGreaterThan(0);

    expect(claimLandmark(state, map, first.location)).toBe('NotEnoughGold');
    fund(state, { Gold: cost });
    const beforeCap = manaCap(state);
    const beforeRate = manaProduction(state);
    expect(claimLandmark(state, map, first.location)).toBe('Claimed');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(0);
    // The pool grows, the rate does not — which is what makes a claim worth
    // more the longer you play: an ad pays a whole pool.
    expect(manaCap(state)).toBe(beforeCap + MANA.landmarkCap);
    expect(manaProduction(state)).toBe(beforeRate);
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
    const costs = LANDMARKS.map((l) => landmarkClaimCost(l));
    expect(Math.max(...costs)).toBeGreaterThan(Math.min(...costs) * 4);
  });

  // The shape of the map's opening, and a design claim worth protecting: the
  // player can SEE exactly one sanctuary from the first minute and cannot
  // afford it for a long while. It is a destination, not a pickup — and the
  // rest are not even discovered, so the fog still has somewhere to go.
  //
  // The price is now tuned to the tutorial (Docs/onboarding.md step 19): it
  // is claimed once the Sawmill is running, so it has to be reachable THEN —
  // an order of magnitude above the opening's Gold, not two.
  it('shows exactly one sanctuary at the start, and prices it as a goal', () => {
    const state = freshGame();
    const visible = LANDMARKS.filter((l) => fogState(state, map, l.location) === 'Revealed');
    expect(visible).toHaveLength(1);

    const [inSight] = visible;
    // Many times what a new kingdom is handed, and still a genuine save.
    expect(landmarkClaimCost(inSight)).toBeGreaterThan(
      10 * getWallet(state.city.wallet, 'Gold'),
    );
    expect(getWallet(state.city.wallet, 'Gold')).toBeLessThan(landmarkClaimCost(inSight));

    // Everything else is still under the fog, and dearer again.
    for (const l of LANDMARKS) {
      if (l.id === inSight.id) continue;
      expect(fogState(state, map, l.location)).toBe('Undiscovered');
      expect(landmarkClaimCost(l)).toBeGreaterThan(landmarkClaimCost(inSight));
    }
  });

  it('reserves the dearest tier for the ones an army has to clear', () => {
    const dearest = Math.max(...LANDMARKS.map((l) => landmarkClaimCost(l)));
    for (const l of LANDMARKS) {
      if (landmarkClaimCost(l) === dearest) expect(l.defended).toBe(true);
    }
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
