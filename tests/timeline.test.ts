// The timeline, the Conjunction and the gacha
// (Docs/features/engine-seams.md §5/§7, heroes-and-gacha.md §4).
//
// The three things the design says are easy to get wrong are the three things
// asserted here: reconciliation reaches an existing save, a window that opened
// AND closed during an absence still fires, and `phase` stops an event paying
// twice.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { CONJUNCTION_BOONS, EVENTS, GACHA, HERO_ORDER } from '../src/sim/data/definitions';
import {
  heroChanceAt, pityCount, pull, pullCost, pullsToGuarantee, STANDARD_BANNER,
} from '../src/sim/heroes';
import { deserialize, serialize } from '../src/sim/save';
import {
  activeConjunction, conjunctionBoon, nextConjunction, reconcileSchedule,
} from '../src/sim/timeline';
import { getWallet, type GameState } from '../src/sim/state';
import { freshGame, map, T0 } from './helpers';

const CONJUNCTION = EVENTS.find((e) => e.id === 'conjunction')!;
const HOUR = 3_600_000;

/** The next Conjunction's opening instant, from the authored epoch. */
function nextWindowStart(after: number): number {
  const since = after - CONJUNCTION.startsAt;
  const n = Math.ceil(since / CONJUNCTION.periodMs);
  return CONJUNCTION.startsAt + n * CONJUNCTION.periodMs;
}

describe('reconciliation', () => {
  it('materialises windows around now, and only around now', () => {
    const state = freshGame();
    expect(state.schedule.length).toBeGreaterThan(0);
    for (const e of state.schedule) {
      expect(Math.abs(e.startsAt - T0)).toBeLessThan(40 * 86_400_000);
    }
  });

  it('is idempotent — loading twice does not duplicate a window', () => {
    const state = freshGame();
    const before = state.schedule.length;
    reconcileSchedule(state, T0);
    reconcileSchedule(state, T0);
    expect(state.schedule.length).toBe(before);
  });

  it('a window that closed before the timeline began never happened', () => {
    // Otherwise a brand-new game would immediately be paid for every
    // Conjunction since the epoch.
    const state = freshGame();
    const past = state.schedule.filter((e) => (e.endsAt ?? 0) <= T0);
    expect(past.length).toBeGreaterThan(0);
    for (const e of past) expect(e.phase).toBe('done');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(10); // the starting grant, no more
  });

  it('reaches a save written before the content existed', () => {
    const state = freshGame();
    // A save from a build that had no timeline at all.
    const save = serialize(state, T0);
    delete (save.Modules as Record<string, unknown>)['kingdom.schedule'];
    const restored = deserialize(save, map, T0)!;
    expect(restored.schedule.length).toBeGreaterThan(0);
  });
});

describe('the Conjunction', () => {
  const openAt = nextWindowStart(T0 + HOUR);

  it('opens on its own schedule, applies a boon, and pays on opening', () => {
    const state = freshGame();
    const gems = getWallet(state.player.wallet, 'Gems');
    const knowledge = getWallet(state.kingdom.wallet, 'Knowledge');

    advance(state, map, openAt - 1000);
    expect(activeConjunction(state)).toBeUndefined();

    const report = advance(state, map, openAt);
    expect(activeConjunction(state)).toBeDefined();
    expect(report.scheduleEvents.some((e) => e.transition === 'opened')).toBe(true);
    expect(getWallet(state.player.wallet, 'Gems')).toBeGreaterThan(gems);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBeGreaterThan(knowledge);
    // The boon is a modifier with the window's own end as its expiry.
    const boon = state.modifiers.find((m) => m.source === 'season');
    expect(boon).toBeDefined();
    expect(boon!.expiresAt).toBe(activeConjunction(state)!.endsAt);
  });

  it('closes on schedule, and the boon goes with it', () => {
    const state = freshGame();
    advance(state, map, openAt);
    advance(state, map, openAt + CONJUNCTION.durationMs);
    expect(activeConjunction(state)).toBeUndefined();
    expect(state.modifiers.some((m) => m.source === 'season')).toBe(false);
  });

  it('a window that opened AND closed during an absence still fires', () => {
    // The payoff for absolute-time boundaries: one call across the whole gap.
    const state = freshGame();
    const gems = getWallet(state.player.wallet, 'Gems');
    const report = advance(state, map, openAt + CONJUNCTION.durationMs + HOUR);
    const opened = report.scheduleEvents.filter((e) => e.transition === 'opened');
    const closed = report.scheduleEvents.filter((e) => e.transition === 'closed');
    expect(opened.length).toBeGreaterThan(0);
    expect(closed.length).toBe(opened.length);
    expect(getWallet(state.player.wallet, 'Gems')).toBeGreaterThan(gems);
  });

  it('never pays twice — phase is the termination guarantee', () => {
    const state = freshGame();
    advance(state, map, openAt + CONJUNCTION.durationMs);
    const gems = getWallet(state.player.wallet, 'Gems');
    // Replay the same window a dozen times; nothing more comes out.
    for (let i = 0; i < 12; i++) advance(state, map, openAt + CONJUNCTION.durationMs);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems);
  });

  it('picks the same boon for the same week, however the window was replayed', () => {
    const a = freshGame();
    const b = freshGame();
    advance(a, map, openAt + HOUR);
    for (let t = HOUR; t <= openAt - T0 + HOUR; t += HOUR) advance(b, map, T0 + t);
    const boonA = a.modifiers.find((m) => m.source === 'season');
    const boonB = b.modifiers.find((m) => m.source === 'season');
    expect(boonA?.stat).toBe(boonB?.stat);
    expect(boonA?.value).toBe(boonB?.value);
  });

  it('draws from the authored list, and every boon is reachable', () => {
    const state = freshGame();
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) seen.add(conjunctionBoon(state, n).id);
    expect(seen.size).toBe(CONJUNCTION_BOONS.length);
  });

  it('counts down to the next one', () => {
    const state = freshGame();
    const next = nextConjunction(state, T0);
    expect(next).toBeDefined();
    expect(next!.startsAt).toBeGreaterThan(T0);
  });

  it('one-call replay equals stepped ticking across a whole window', () => {
    const build = (): GameState => freshGame();
    const oneCall = build();
    advance(oneCall, map, openAt + CONJUNCTION.durationMs + HOUR);
    const stepped = build();
    for (let t = HOUR; t <= openAt - T0 + CONJUNCTION.durationMs + HOUR; t += HOUR) {
      advance(stepped, map, T0 + t);
    }
    expect(getWallet(stepped.player.wallet, 'Gems'))
      .toBe(getWallet(oneCall.player.wallet, 'Gems'));
    expect(stepped.schedule.filter((e) => e.phase === 'done').length)
      .toBe(oneCall.schedule.filter((e) => e.phase === 'done').length);
  });

  it('survives a save round-trip without re-firing', () => {
    const state = freshGame();
    advance(state, map, openAt + HOUR);
    const gems = getWallet(state.player.wallet, 'Gems');
    const restored = deserialize(serialize(state, openAt + HOUR), map, openAt + HOUR)!;
    expect(getWallet(restored.player.wallet, 'Gems')).toBe(gems);
    expect(activeConjunction(restored)).toBeDefined();
  });
});

describe('the gacha', () => {
  const rich = (): GameState => {
    const state = freshGame();
    state.player.wallet.Gems = 100_000;
    return state;
  };

  // Docs/onboarding.md step 25: the first call on the standard banner is a
  // gift, and every one after it is the authored price. No new save field —
  // the pull counter already persists for pity, and "have you pulled here
  // yet" is exactly what it records.
  it('gives the first call free, then charges the authored price', () => {
    const state = rich();
    const before = getWallet(state.player.wallet, 'Gems');
    expect(pullCost(state)).toBe(0);
    expect(pull(state).result).toBe('Pulled');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(before); // nothing taken

    expect(pullCost(state)).toBe(GACHA.pullGemCost);
    expect(pull(state).result).toBe('Pulled');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(before - GACHA.pullGemCost);
  });

  it('the free call is the STANDARD banner\'s, and only once', () => {
    const state = rich();
    pull(state);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(pullCost(restored)).toBe(GACHA.pullGemCost); // survives a reload
  });

  it('refuses politely, and charges nothing, when the purse is short', () => {
    const state = freshGame();
    state.player.wallet.Gems = 0;
    expect(pull(state).result).toBe('Pulled'); // the free one lands regardless
    state.player.wallet.Gems = 0;
    expect(pull(state).result).toBe('NotEnoughGems');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
  });

  // CLAIM: the gacha is one of the two places Knowledge comes from, and it
  // pays on EVERY pull — hero, duplicate or miss. Fragments only ever point
  // at one hero; Knowledge levels whoever the player already has, which is
  // what stops a pull from being dead even when the roster is full.
  it('every pull pays Knowledge into the kingdom purse', () => {
    const state = rich();
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(0);
    // Past hard pity, so the run covers a miss AND a hero rather than one
    // long unlucky streak.
    const seen = new Set<string>();
    for (let i = 1; i <= GACHA.hardPityAt + 10; i++) {
      const result = pull(state);
      expect(result.stardust).toBe(GACHA.pullStardust);
      expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(i * GACHA.pullStardust);
      seen.add(result.heroId === null ? 'miss' : result.duplicate ? 'dupe' : 'hero');
    }
    // …and it really did pay across more than one kind of outcome.
    expect(seen).toContain('miss');
    expect(seen.size).toBeGreaterThan(1);
  });

  it('a refused pull pays no Knowledge either', () => {
    const state = freshGame();
    state.player.wallet.Gems = 0;
    pull(state); // the free one
    const banked = getWallet(state.kingdom.wallet, 'Knowledge');
    expect(pull(state).result).toBe('NotEnoughGems');
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(banked);
  });

  it('has no dead pulls — a miss still pays Fragments toward someone', () => {
    const state = rich();
    for (let i = 0; i < 30; i++) {
      const result = pull(state);
      expect(result.result).toBe('Pulled');
      if (result.heroId === null) {
        expect(result.fragments).toBeGreaterThan(0);
        expect(result.fragmentsOf).not.toBeNull();
      }
    }
  });

  it('guarantees a hero within the pity window', () => {
    const state = rich();
    let heroes = 0;
    for (let i = 0; i < GACHA.hardPityAt; i++) {
      if (pull(state).heroId !== null) heroes += 1;
    }
    expect(heroes).toBeGreaterThan(0);
  });

  it('the pity counter is always readable, and resets on a hero', () => {
    const state = rich();
    expect(pityCount(state, STANDARD_BANNER)).toBe(0);
    expect(pullsToGuarantee(state, STANDARD_BANNER)).toBe(GACHA.hardPityAt);
    for (let i = 0; i < GACHA.hardPityAt + 5; i++) {
      const result = pull(state);
      if (result.heroId !== null) {
        expect(pityCount(state, STANDARD_BANNER)).toBe(0);
        break;
      }
      expect(pityCount(state, STANDARD_BANNER)).toBe(i + 1);
    }
  });

  it('soft pity ramps before the guarantee rather than staying flat', () => {
    expect(heroChanceAt(0)).toBe(GACHA.heroChance);
    expect(heroChanceAt(GACHA.softPityAt)).toBeGreaterThanOrEqual(GACHA.heroChance);
    expect(heroChanceAt(GACHA.softPityAt + 5))
      .toBeGreaterThan(heroChanceAt(GACHA.softPityAt));
    expect(heroChanceAt(GACHA.hardPityAt - 1)).toBe(1);
  });

  it('duplicates convert to that hero’s Fragments', () => {
    const state = rich();
    // Own everyone, so every hero result is necessarily a duplicate.
    state.heroes.owned = [...HERO_ORDER];
    for (let i = 0; i < 200; i++) {
      const result = pull(state);
      if (result.heroId !== null) {
        expect(result.duplicate).toBe(true);
        expect(result.fragments).toBe(GACHA.duplicateFragments);
        expect(state.heroes.fragments[result.heroId]).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error('no hero in 200 pulls — pity is broken');
  });

  it('prefers heroes the player does not have — that is the reason to pull', () => {
    const state = rich();
    for (let i = 0; i < 200; i++) {
      const result = pull(state);
      if (result.heroId !== null) {
        expect(result.duplicate).toBe(false);
        return;
      }
    }
  });

  it('the same seed and pull number always yields the same result', () => {
    const a = rich();
    const b = rich();
    b.seed = a.seed;
    const resultsA = Array.from({ length: 25 }, () => pull(a));
    const resultsB = Array.from({ length: 25 }, () => pull(b));
    expect(resultsB.map((r) => r.heroId)).toEqual(resultsA.map((r) => r.heroId));
  });

  it('the counters survive a save round-trip, so pity is not laundered', () => {
    const state = rich();
    for (let i = 0; i < 7; i++) pull(state);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.gacha.pullCounts).toEqual(state.gacha.pullCounts);
    expect(restored.gacha.pityCounters).toEqual(state.gacha.pityCounters);
  });
});
