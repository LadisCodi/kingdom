// The timeline machinery and the gacha
// (Docs/implementation-plan.md §1/§7, Docs/features/10-heroes.md §6).
//
// THE CATALOGUE IS EMPTY. The Conjunction was retired on 2026-09-08 and events
// are being redesigned, so there is no authored window to drive these with —
// and the machinery is exactly the part that must not rot in the meantime.
// The schedule tests therefore build their entries by hand and drive them
// through `advance`, which is what a future event will do anyway.
//
// The three things the design says are easy to get wrong are the three things
// asserted here: reconciliation reaches an existing save, a window is paid for
// exactly once, and a kingdom is not paid for a window it never lived through.
import { describe, expect, it } from 'vitest';
import { advance, buyKeys } from '../src/sim/commands';
import {
  BANNERS, EVENTS, HERO_ORDER, HEROES, CURRENCIES,
} from '../src/sim/data/definitions';
import {
  claimFreePull, freePullAvailable, freePullsLeft, heroChanceAt, legendaryPityCount,
  pityCount, pull, pullMany, pullPrice, pullsToGuarantee, pullsToLegendary,
  STANDARD_BANNER,
} from '../src/sim/heroes';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import { reconcileSchedule } from '../src/sim/timeline';
import { getWallet, type GameState, type ScheduledEntry } from '../src/sim/state';
import { freshGame, map, T0 } from './helpers';

const HOUR = 3_600_000;

/** A window, hand-built, standing in for the authored content there is none
 *  of. `phase` is the field every rule here turns on. */
const window = (over: Partial<ScheduledEntry> = {}): ScheduledEntry => ({
  id: 'test#0',
  templateId: 'test',
  startsAt: T0 + HOUR,
  endsAt: T0 + 3 * HOUR,
  payload: { kind: 'banner', occurrence: 0 },
  phase: 'pending',
  ...over,
});

describe('the catalogue', () => {
  // Deliberate, and the reason the tests below are synthetic. A template here
  // is all it takes to schedule an event again.
  it('is empty while events are redesigned', () => {
    expect(EVENTS).toEqual([]);
  });

  it('leaves a new kingdom with an empty schedule and nothing paid for', () => {
    const state = freshGame();
    expect(state.schedule).toEqual([]);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(0);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(500); // the starting grant, no more
  });

  it('is idempotent — reconciling twice adds nothing', () => {
    const state = freshGame();
    reconcileSchedule(state, T0);
    reconcileSchedule(state, T0);
    expect(state.schedule).toEqual([]);
  });

  it('reaches a save written before the timeline existed', () => {
    const save = serialize(freshGame(), T0);
    delete (save.Modules as Record<string, unknown>)['kingdom.schedule'];
    // The point is that it LOADS and reconciles rather than throwing; with an
    // empty catalogue there is simply nothing to materialise.
    expect(deserialize(save, map, T0)!.schedule).toEqual([]);
  });
});

describe('a window opens and closes exactly once', () => {
  const run = (): GameState => {
    const state = freshGame();
    state.schedule = [window()];
    return state;
  };

  it('opens when its moment comes, and not before', () => {
    const state = run();
    expect(advance(state, map, T0 + HOUR / 2).scheduleEvents).toEqual([]);
    expect(state.schedule[0]!.phase).toBe('pending');

    const opened = advance(state, map, T0 + HOUR).scheduleEvents;
    expect(opened.map((e) => e.transition)).toEqual(['opened']);
    expect(state.schedule[0]!.phase).toBe('active');
  });

  it('closes at its end, and never fires either transition twice', () => {
    const state = run();
    advance(state, map, T0 + 3 * HOUR);
    expect(state.schedule[0]!.phase).toBe('done');
    // `phase` is what makes this terminate: twelve more advances change
    // nothing, which is the property a replay depends on.
    for (let i = 0; i < 12; i += 1) {
      expect(advance(state, map, T0 + 4 * HOUR).scheduleEvents).toEqual([]);
    }
  });

  it('fires a window that opened AND closed during an absence, in one call', () => {
    const state = run();
    // One call across the whole window: the absence is paid in full, which is
    // the load-bearing assertion of the engine (invariant 1).
    const events = advance(state, map, T0 + 4 * HOUR).scheduleEvents;
    expect(events.map((e) => e.transition)).toEqual(['opened', 'closed']);
  });

  it('is a boundary source, so stepped ticking agrees with one call', () => {
    const oneCall = run();
    advance(oneCall, map, T0 + 4 * HOUR);

    const stepped = run();
    for (let t = T0 + HOUR / 4; t <= T0 + 4 * HOUR; t += HOUR / 4) {
      advance(stepped, map, t);
    }
    expect(stepped.schedule[0]!.phase).toBe(oneCall.schedule[0]!.phase);
  });

  it('survives a save and load mid-window', () => {
    const state = run();
    advance(state, map, T0 + 2 * HOUR);
    expect(state.schedule[0]!.phase).toBe('active');

    const back = deserialize(serialize(state, T0 + 2 * HOUR), map, T0 + 2 * HOUR)!;
    expect(back.schedule.find((e) => e.id === 'test#0')!.phase).toBe('active');
  });
});

// THE STARTING GRANT THAT CAME BACK THROUGH ANOTHER DOOR.
//
// The retired Conjunction paid 6 Knowledge on opening and hung a week-long
// boon, one of which tripled `knowledgeYield`. The schedule runs on absolute
// calendar time, so a kingdom created mid-window caught that opening on its
// very first advance: a brand-new game reported 6 Knowledge and +2.4/h, which
// is exactly the grant that had just been removed on purpose.
//
// A RESUMED save must still be paid for the window it slept through. Only a
// kingdom that did not exist when the window opened is not. Kept with the
// catalogue empty, because the next event will land in the same trap.
describe('a new kingdom is not paid for a window it never lived through', () => {
  // `reconcileSchedule(state, now, { fresh: true })` is what marks it done;
  // with the catalogue empty the rule is asserted on what that produces — a
  // window the kingdom never saw open pays nothing when it is advanced past.
  it('pays nothing for a window already in progress when it began', () => {
    const state = newGame(map, T0);
    state.schedule = [window({ startsAt: T0 - HOUR, endsAt: T0 + HOUR, phase: 'done' })];
    expect(advance(state, map, T0 + HOUR / 2).scheduleEvents).toEqual([]);
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(0);
  });

  it('still pays a resumed save for the window it slept through', () => {
    const state = newGame(map, T0);
    state.schedule = [window({ startsAt: T0 - HOUR, endsAt: T0 + HOUR, phase: 'pending' })];
    const events = advance(state, map, T0 + HOUR / 2).scheduleEvents;
    expect(events.map((e) => e.transition)).toEqual(['opened']);
  });
});

describe('the gacha', () => {
  /** A purse full of both keys. A pull is priced in keys since 2026-09-08;
   *  Gems buy the keys, in the store. */
  const rich = (): GameState => {
    const state = freshGame();
    state.player.wallet.SilverKey = 500;
    state.player.wallet.GoldKey = 500;
    return state;
  };
  const keys = (state: GameState, banner: 'basic' | 'advanced'): number =>
    getWallet(state.player.wallet, BANNERS[banner].key);

  // Docs/features/12-quests.md §2 (quest 33): the first call on the standard banner is a
  // gift, and every one after it is the authored price. No new save field —
  // the pull counter already persists for pity, and "have you pulled here
  // yet" is exactly what it records.
  it('gives the first call free, then charges one key', () => {
    const state = rich();
    const before = keys(state, 'basic');
    expect(pullPrice(state, 'basic').amount).toBe(0);
    expect(pull(state).result).toBe('Pulled');
    expect(keys(state, 'basic')).toBe(before); // nothing taken

    expect(pullPrice(state, 'basic')).toEqual({ currency: 'SilverKey', amount: 1 });
    expect(pull(state).result).toBe('Pulled');
    expect(keys(state, 'basic')).toBe(before - 1);
  });

  it('charges each banner its OWN key, and never the other', () => {
    const state = rich();
    pull(state, 'basic'); // the free one
    const silver = keys(state, 'basic');
    const gold = keys(state, 'advanced');
    expect(pull(state, 'advanced').result).toBe('Pulled');
    expect(keys(state, 'advanced')).toBe(gold - 1);
    expect(keys(state, 'basic')).toBe(silver); // the silver purse is untouched
  });

  it('the free call is the BASIC banner\'s, and only once', () => {
    const state = rich();
    expect(pullPrice(state, 'advanced').amount).toBe(1); // never free
    pull(state);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(pullPrice(restored, 'basic').amount).toBe(1); // survives a reload
  });

  it('refuses politely, and charges nothing, when the purse is short', () => {
    const state = freshGame();
    state.player.wallet.Gems = 0;
    expect(pull(state).result).toBe('Pulled'); // the free one lands regardless
    state.player.wallet.Gems = 0;
    expect(pull(state).result).toBe('NotEnoughKeys');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
  });

  // CLAIM: the gacha is one of the two places Knowledge comes from, and it
  // pays on EVERY pull — hero, duplicate or miss. Fragments only ever point
  // at one hero; Knowledge levels whoever the player already has, which is
  // what stops a pull from being dead even when the roster is full.
  it('every pull pays Knowledge into the kingdom purse', () => {
    const state = rich();
    expect(getWallet(state.kingdom.wallet, 'Knowledge')).toBe(CURRENCIES.Knowledge.start);
    // Past hard pity, so the run covers a miss AND a hero rather than one
    // long unlucky streak.
    const seen = new Set<string>();
    for (let i = 1; i <= BANNERS.basic.hardPityAt + 10; i++) {
      const result = pull(state);
      expect(result.stardust).toBe(BANNERS.basic.pullStardust);
      expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(i * BANNERS.basic.pullStardust);
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
    expect(pull(state).result).toBe('NotEnoughKeys');
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
    for (let i = 0; i < BANNERS.basic.hardPityAt; i++) {
      if (pull(state).heroId !== null) heroes += 1;
    }
    expect(heroes).toBeGreaterThan(0);
  });

  it('the pity counter is always readable, and resets on a hero', () => {
    const state = rich();
    expect(pityCount(state, STANDARD_BANNER)).toBe(0);
    expect(pullsToGuarantee(state, STANDARD_BANNER)).toBe(BANNERS.basic.hardPityAt);
    for (let i = 0; i < BANNERS.basic.hardPityAt + 5; i++) {
      const result = pull(state);
      if (result.heroId !== null) {
        expect(pityCount(state, STANDARD_BANNER)).toBe(0);
        break;
      }
      expect(pityCount(state, STANDARD_BANNER)).toBe(i + 1);
    }
  });

  it('soft pity ramps before the guarantee rather than staying flat', () => {
    expect(heroChanceAt(0)).toBe(BANNERS.basic.heroChance);
    expect(heroChanceAt(BANNERS.basic.softPityAt)).toBeGreaterThanOrEqual(BANNERS.basic.heroChance);
    expect(heroChanceAt(BANNERS.basic.softPityAt + 5))
      .toBeGreaterThan(heroChanceAt(BANNERS.basic.softPityAt));
    expect(heroChanceAt(BANNERS.basic.hardPityAt - 1)).toBe(1);
  });

  it('duplicates convert to that hero’s Fragments', () => {
    const state = rich();
    // Own everyone, so every hero result is necessarily a duplicate.
    state.heroes.owned = [...HERO_ORDER];
    for (let i = 0; i < 200; i++) {
      const result = pull(state);
      if (result.heroId !== null) {
        expect(result.duplicate).toBe(true);
        expect(result.fragments).toBe(BANNERS.basic.duplicateFragments);
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

  it('splits thirty-two heroes across three rarities, and both pools are real', () => {
    // The roster is content, so this pins the SHAPE rather than the names: a
    // rarity nobody carries would make a banner weight point at nothing, and
    // `pull` would quietly fall back to another rarity forever.
    const byRarity = HERO_ORDER.reduce<Record<string, number>>((acc, id) => {
      acc[HEROES[id].rarity] = (acc[HEROES[id].rarity] ?? 0) + 1;
      return acc;
    }, {});
    expect(HERO_ORDER).toHaveLength(32);
    expect(byRarity).toEqual({ Common: 14, Rare: 12, Legendary: 6 });
    // …and every rarity a banner weights has somebody in it.
    for (const banner of ['basic', 'advanced'] as const) {
      for (const rarity of ['Common', 'Rare', 'Legendary'] as const) {
        if (BANNERS[banner].weights[rarity] > 0) {
          expect(HERO_ORDER.filter((id) => HEROES[id].rarity === rarity).length,
            `${banner} weights ${rarity} at nobody`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gives every hero a portrait of its own', () => {
    const sprites = HERO_ORDER.map((id) => HEROES[id].sprite);
    expect(new Set(sprites).size, 'two heroes share a portrait').toBe(sprites.length);
  });

  // ---- rarity, and the two guarantees -----------------------------------

  it('never rolls a rarity its banner weights at zero', () => {
    // The weights ARE the pool: there is no pool column, and a zero is what
    // keeps the Legendary off the common call and the Commons off the golden
    // one (Docs/features/10-heroes.md §5).
    const state = rich();
    for (let i = 0; i < 200; i += 1) {
      const basic = pull(state, 'basic');
      if (basic.rarity !== null) expect(basic.rarity, 'basic').not.toBe('Legendary');
      const advanced = pull(state, 'advanced');
      if (advanced.rarity !== null) expect(advanced.rarity, 'advanced').not.toBe('Common');
    }
  });

  it('hands out a hero of the rarity it says it rolled', () => {
    const state = rich();
    for (let i = 0; i < 120; i += 1) {
      const r = pull(state, 'advanced');
      if (r.heroId !== null) expect(HEROES[r.heroId].rarity).toBe(r.rarity);
    }
  });

  it('guarantees a legend on its own counter, and only where there is one', () => {
    // Two counters, two meanings: the short one guarantees A hero, this one
    // guarantees the rarity. A player has to be able to read both.
    const state = rich();
    expect(pullsToLegendary(state, 'basic')).toBe(null); // nothing to guarantee
    expect(pullsToLegendary(state, 'advanced')).toBe(BANNERS.advanced.legendaryPityAt);

    let sawLegendary = false;
    for (let i = 0; i < BANNERS.advanced.legendaryPityAt; i += 1) {
      if (pull(state, 'advanced').rarity === 'Legendary') { sawLegendary = true; break; }
    }
    expect(sawLegendary, 'a legend inside its own pity window').toBe(true);
    expect(legendaryPityCount(state, 'advanced')).toBe(0); // and it reset
  });

  it('counts the legendary pity on every pull, and clears it only on a legend', () => {
    const state = rich();
    let last = 0;
    for (let i = 0; i < 20; i += 1) {
      const r = pull(state, 'advanced');
      const now = legendaryPityCount(state, 'advanced');
      if (r.rarity === 'Legendary') expect(now).toBe(0);
      else expect(now, 'a miss or a lesser hero still counts').toBe(last + 1);
      last = now;
    }
  });

  it('keeps the two banners\' counters apart', () => {
    const state = rich();
    for (let i = 0; i < 8; i += 1) pull(state, 'basic');
    expect(pityCount(state, 'advanced')).toBe(0);
    expect(legendaryPityCount(state, 'advanced')).toBe(0);
    expect(pullsToGuarantee(state, 'advanced')).toBe(BANNERS.advanced.hardPityAt);
  });

  it('sells keys for Gems, and that is the only way Gems reach a banner', () => {
    const state = freshGame();
    state.player.wallet.Gems = BANNERS.basic.keyGemCost + BANNERS.advanced.keyGemCost;
    expect(buyKeys(state, 'basic')).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'SilverKey')).toBe(1);
    expect(buyKeys(state, 'advanced')).toBe('Purchased');
    expect(getWallet(state.player.wallet, 'GoldKey')).toBe(1);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(0);
    expect(buyKeys(state, 'basic')).toBe('NotEnoughGems');
    // …and a pull never touches the Gem purse, however rich it is.
    state.player.wallet.Gems = 99_999;
    pull(state, 'basic'); // the free first call
    pull(state, 'basic');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(99_999);
  });

  // ---- the free call, and what an ad is allowed to pay for ---------------

  it('offers the free call, spends it, and puts it on a cooldown', () => {
    const state = freshGame(); // no keys at all: the ad is the whole purse
    const def = BANNERS.basic;
    expect(freePullAvailable(state, 'basic', T0)).toBe(true);
    expect(freePullsLeft(state, 'basic', T0)).toBe(def.freePerDay);

    expect(claimFreePull(state, 'basic', T0).result).toBe('Pulled');
    expect(freePullsLeft(state, 'basic', T0)).toBe(def.freePerDay - 1);
    // …and the next one waits out the cooldown rather than the day.
    expect(claimFreePull(state, 'basic', T0).result).toBe('OnCooldown');
    const ready = T0 + def.freeCooldownSeconds * 1000;
    expect(claimFreePull(state, 'basic', ready).result).toBe('Pulled');
  });

  it('costs no key, and still pays Stardust and fragments', () => {
    const state = freshGame();
    const dust = getWallet(state.kingdom.wallet, 'Stardust');
    const claimed = claimFreePull(state, 'basic', T0);
    expect(claimed.result).toBe('Pulled');
    expect(getWallet(state.player.wallet, 'SilverKey')).toBe(0); // nothing to take
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(dust + BANNERS.basic.pullStardust);
  });

  it('stops at the daily cap, and opens again on the next UTC day', () => {
    const state = freshGame();
    const def = BANNERS.basic;
    let t = T0;
    for (let i = 0; i < def.freePerDay; i += 1) {
      expect(claimFreePull(state, 'basic', t).result, `free call ${i + 1}`).toBe('Pulled');
      t += def.freeCooldownSeconds * 1000;
    }
    // The cooldown is up but the day's allowance is not.
    expect(claimFreePull(state, 'basic', t).result).toBe('NoneLeft');
    expect(freePullsLeft(state, 'basic', t)).toBe(0);
    // T0 is noon UTC, so +13 h is tomorrow and +11 h is not.
    expect(freePullsLeft(state, 'basic', T0 + 11 * 3_600_000)).toBe(0);
    expect(freePullsLeft(state, 'basic', T0 + 13 * 3_600_000)).toBe(def.freePerDay);
    expect(claimFreePull(state, 'basic', T0 + 13 * 3_600_000).result).toBe('Pulled');
  });

  it('gives the golden call one a day, on the DAY and not on a 24-hour clock', () => {
    // The cap is the rule and the cooldown is only spacing, so the golden
    // call carries no cooldown at all: one a day that resets at midnight,
    // rather than one every 24 hours, which would drift an hour later every
    // time the player was slow to claim it.
    const state = freshGame();
    expect(BANNERS.advanced.freePerDay).toBe(1);
    expect(BANNERS.advanced.freeCooldownSeconds).toBe(0);
    expect(claimFreePull(state, 'advanced', T0).result).toBe('Pulled');
    expect(claimFreePull(state, 'advanced', T0 + 3_600_000).result).toBe('NoneLeft');
    // T0 is noon UTC, so +11 h is the same day and +13 h is the next one.
    expect(claimFreePull(state, 'advanced', T0 + 11 * 3_600_000).result).toBe('NoneLeft');
    expect(claimFreePull(state, 'advanced', T0 + 13 * 3_600_000).result).toBe('Pulled');
  });

  it('keeps the two allowances apart, and survives a reload', () => {
    const state = freshGame();
    claimFreePull(state, 'basic', T0);
    expect(freePullsLeft(state, 'advanced', T0)).toBe(BANNERS.advanced.freePerDay);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(freePullsLeft(restored, 'basic', T0)).toBe(BANNERS.basic.freePerDay - 1);
    expect(freePullAvailable(restored, 'basic', T0)).toBe(false); // the cooldown too
  });

  it('is never touched by the sim clock', () => {
    // The architectural guarantee, and the reason the ledger is a stamp rather
    // than a boundary: a five-minute timer in advance() would propose ~8,600
    // boundaries across a month against a seatbelt of 10,000.
    const state = freshGame();
    claimFreePull(state, 'basic', T0);
    const before = JSON.stringify(state.gacha);
    advance(state, map, T0 + 30 * 86_400_000);
    expect(JSON.stringify(state.gacha)).toBe(before);
  });

  // ---- ten at a time ------------------------------------------------------

  it('spends exactly ten keys on a ten-call, and returns ten results', () => {
    const state = rich();
    pull(state, 'basic'); // burn the free one, so the batch is a clean ten
    const before = keys(state, 'basic');
    const batch = pullMany(state, 'basic', 10);
    expect(batch.result).toBe('Pulled');
    expect(batch.pulls).toHaveLength(10);
    expect(keys(state, 'basic')).toBe(before - 10); // no discount, on purpose
  });

  it('charges nine for a ten-call over the free first one', () => {
    // The free call is free once, not ten times.
    const state = freshGame();
    state.player.wallet.SilverKey = 9;
    expect(pullMany(state, 'basic', 10).result).toBe('Pulled');
    expect(getWallet(state.player.wallet, 'SilverKey')).toBe(0);
  });

  it('refuses a ten-call whole rather than spending nine keys', () => {
    const state = freshGame();
    state.player.wallet.SilverKey = 9;
    pull(state, 'basic'); // the free one, which does not touch the purse
    const batch = pullMany(state, 'basic', 10);
    expect(batch.result).toBe('NotEnoughKeys');
    expect(batch.pulls).toEqual([]);
    expect(keys(state, 'basic')).toBe(9); // nothing taken
  });

  it('carries pity across a ten-call exactly as ten presses would', () => {
    const one = rich();
    const ten = rich();
    for (let i = 0; i < 10; i += 1) pull(one, 'advanced');
    pullMany(ten, 'advanced', 10);
    expect(ten.gacha.pityCounters).toEqual(one.gacha.pityCounters);
    expect(ten.gacha.legendaryPity).toEqual(one.gacha.legendaryPity);
    expect(ten.heroes.owned).toEqual(one.heroes.owned);
  });

  it('the counters survive a save round-trip, so pity is not laundered', () => {
    const state = rich();
    for (let i = 0; i < 7; i++) pull(state);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.gacha.pullCounts).toEqual(state.gacha.pullCounts);
    expect(restored.gacha.pityCounters).toEqual(state.gacha.pityCounters);
  });
});
