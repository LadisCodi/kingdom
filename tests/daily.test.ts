// The daily chest, and the promise it is built to keep.
//
// A conventional login streak resets to zero on a missed day. This one does
// not — the ladder advances on days PLAYED, and missing a day costs that day's
// chest and nothing else — because promise 1 is *nothing you own is ever taken
// from you* (Docs/features/12-quests.md §4.1).
//
// That is a design commitment rather than a number, so it is the thing these
// tests defend. "The ladder survives a two-week absence at the step it
// reached" is not an edge case here; it is the feature.
import { describe, expect, it } from 'vitest';
import {
  chestAvailable, chestReward, claimDailyChest, dayIndex, ladderLength, nextStep,
} from '../src/sim/daily';
import { advance } from '../src/sim/commands';
import { manaCap } from '../src/sim/mana';
import { DAILY } from '../src/sim/data/definitions';
import { deserialize, serialize } from '../src/sim/save';
import { addBuilt, freshGame, map, T0 } from './helpers';
import type { GameState } from '../src/sim/state';

const DAY = 86_400_000;
/** Claim on a given day, from a clean "not yet claimed today" position. */
const claimOn = (state: GameState, t: number) => claimDailyChest(state, t);

describe('the ladder advances on days played, never on days elapsed', () => {
  it('gives step 1 on the first day the game is opened', () => {
    const state = freshGame();
    expect(nextStep(state)).toBe(1);
    expect(claimOn(state, T0)).toBe('Claimed');
    expect(state.kingdom.daily.ladderStep).toBe(1);
  });

  it('gives step 2 on the NEXT day played, whenever that is', () => {
    const state = freshGame();
    claimOn(state, T0);
    // Three weeks later. A calendar streak would be back at step 1.
    expect(claimOn(state, T0 + 21 * DAY)).toBe('Claimed');
    expect(nextStep(state)).toBe(3);
  });

  // The assertion the whole design exists for.
  it('survives a two-week absence at the step it reached', () => {
    const state = freshGame();
    for (let d = 0; d < 4; d++) claimOn(state, T0 + d * DAY);
    expect(state.kingdom.daily.ladderStep).toBe(4);
    advance(state, map, T0 + 18 * DAY); // gone a fortnight
    expect(state.kingdom.daily.ladderStep).toBe(4);
    expect(nextStep(state)).toBe(5);
  });

  it('pays once a day, however many times it is asked', () => {
    const state = freshGame();
    expect(claimOn(state, T0)).toBe('Claimed');
    expect(claimOn(state, T0 + 60_000)).toBe('AlreadyClaimed');
    // T0 is noon UTC, so +11 h is still the same day; +13 h would not be.
    expect(claimOn(state, T0 + 11 * 3_600_000)).toBe('AlreadyClaimed');
    expect(state.kingdom.daily.ladderStep).toBe(1);
  });

  // The rollover is UTC, so it lands at a different wall-clock hour for
  // different players. That is the deliberate trade for a sim that may not
  // read a timezone — and for a mechanic that never punishes a miss, an
  // inconvenient rollover hour costs nothing.
  it('rolls over at UTC midnight, not at whatever the device thinks', () => {
    const noon = Date.parse('2026-08-20T12:00:00Z');
    expect(dayIndex(noon)).toBe(dayIndex(Date.parse('2026-08-20T23:59:59Z')));
    expect(dayIndex(noon)).not.toBe(dayIndex(Date.parse('2026-08-21T00:00:01Z')));
  });

  // `lastClaimedDay` is STAMPED rather than incremented, so this holds even
  // if the device clock goes backwards — which is the failure mode a
  // decremented counter would silently pay out on.
  it('cannot be farmed by winding the clock back', () => {
    const state = freshGame();
    claimOn(state, T0 + 5 * DAY);
    expect(claimOn(state, T0)).toBe('Claimed'); // a genuinely different day
    expect(claimOn(state, T0)).toBe('AlreadyClaimed');
    expect(state.kingdom.daily.ladderStep).toBe(2);
  });

  it('cycles rather than ending', () => {
    const state = freshGame();
    const len = ladderLength();
    for (let d = 0; d < len; d++) claimOn(state, T0 + d * DAY);
    expect(nextStep(state)).toBe(1); // day 8 is step 1 again
    expect(state.kingdom.daily.ladderStep).toBe(len);
  });
});

describe('what it pays', () => {
  it('prices Mana as a fraction of the pool, so it grows with the city', () => {
    const small = freshGame();
    const large = freshGame();
    // A Sanctum raises the cap, which must raise the chest with it — that is
    // the reason the table holds fractions and not amounts.
    addBuilt(large, 'Sanctum', { x: 4, y: 4 });
    expect(manaCap(large)).toBeGreaterThan(manaCap(small));
    expect(chestReward(large, 1).Mana!).toBeGreaterThan(chestReward(small, 1).Mana!);
  });

  it('pays the week marker in Gems, and no other step', () => {
    const state = freshGame();
    const len = ladderLength();
    for (let step = 1; step < len; step++) {
      expect(chestReward(state, step).Gems ?? 0).toBe(0);
    }
    expect(chestReward(state, len).Gems).toBe(DAILY.gems[len - 1]);
    expect(chestReward(state, len).Gems).toBeGreaterThan(0);
  });

  it('floors the Gold step so a city with no villagers still gets something', () => {
    const state = freshGame();
    expect(state.city.population).toBe(0);
    const goldStep = DAILY.goldSeconds.findIndex((s: number) => s > 0) + 1;
    expect(chestReward(state, goldStep).Gold).toBe(DAILY.goldFloor);
  });

  it('lands Mana on top of the cap rather than clamping it away', () => {
    const state = freshGame();
    state.city.wallet.Mana = manaCap(state); // already full
    const before = state.city.wallet.Mana;
    claimOn(state, T0);
    // A grant clamped to a ceiling the player is already at would pay nothing
    // and read as broken — the same rule the ad reward follows.
    expect(state.city.wallet.Mana!).toBeGreaterThan(before);
  });
});

describe('the chest is an offer, not economy', () => {
  // The argument adOffers.ts makes for itself: a daily timer registered in
  // advance() would propose a boundary per day across a long absence, for no
  // simulation benefit, against an uncapped tail advance.
  it('is never advanced by the sim — only a live claim moves it', () => {
    const state = freshGame();
    advance(state, map, T0 + 30 * DAY);
    expect(state.kingdom.daily.ladderStep).toBe(0);
    expect(chestAvailable(state, T0 + 30 * DAY)).toBe(true);
  });

  it('does not pay a backlog of missed days', () => {
    const state = freshGame();
    claimOn(state, T0);
    advance(state, map, T0 + 7 * DAY);
    // Seven days gone; one chest waiting, not seven.
    expect(claimOn(state, T0 + 7 * DAY)).toBe('Claimed');
    expect(claimOn(state, T0 + 7 * DAY)).toBe('AlreadyClaimed');
    expect(state.kingdom.daily.ladderStep).toBe(2);
  });
});

describe('persistence', () => {
  it('carries the ladder across a save round-trip', () => {
    const state = freshGame();
    claimOn(state, T0);
    claimOn(state, T0 + DAY);
    const back = deserialize(serialize(state, T0 + DAY), map, T0 + DAY)!;
    expect(back.kingdom.daily.ladderStep).toBe(2);
    expect(back.kingdom.daily.lastClaimedDay).toBe(dayIndex(T0 + DAY));
  });

  // Additive module key, so a save written before the chest existed needs no
  // migrator — it deserialises to a player meeting the ladder for the first
  // time, which is exactly right (Docs/implementation-plan.md §1).
  it('starts a pre-chest save at the bottom of the ladder', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    delete (file.Modules['kingdom.kingdoms'] as Record<string, unknown>).Daily;
    const back = deserialize(file, map, T0)!;
    expect(back.kingdom.daily.ladderStep).toBe(0);
    expect(back.kingdom.daily.lastClaimedDay).toBeNull();
    expect(chestAvailable(back, T0)).toBe(true);
  });
});
