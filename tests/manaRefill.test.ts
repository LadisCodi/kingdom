// The refill and its day (Docs/features/08-magic.md §6).
//
// Three claims are load-bearing. The two allowances are SEPARATE — spending
// the videos must not close the Gem ladder, and buying pools must not cost a
// video. The Gem price is a LADDER indexed by purchases made today, never by
// how empty the pool is. And both roll at UTC midnight, LAZILY: nothing
// happens at midnight, every reader rolls the ledger, so a save left open
// across the boundary reads the new day the moment it is asked.
import { describe, expect, it } from 'vitest';
import { claimAdOffer, refreshAdOffer } from '../src/sim/adOffers';
import { AD, MANA } from '../src/sim/data/definitions';
import { mana, manaCap } from '../src/sim/mana';
import {
  boughtRefillsLeft, manaRefillGemCost, nextRefillRung, refillManaWithGems,
  watchedRefillsLeft,
} from '../src/sim/manaRefill';
import { deserialize, serialize } from '../src/sim/save';
import { dayIndex } from '../src/sim/daily';
import { getWallet, type GameState } from '../src/sim/state';
import { freshGame, freshPresenter, map, T0 } from './helpers';

const DAY = 86_400_000;

/** A new kingdom starts with a FULL pool, so anything about refilling one has
 *  to empty it first. */
const drained = (state = freshGame()): GameState => {
  state.city.wallet.Mana = 0;
  return state;
};

/** Ready to be offered a video: the cooldown elapsed and the pool empty. */
const offered = (state = drained()): GameState => {
  state.ads.readyAt = T0;
  refreshAdOffer(state, T0);
  return state;
};

describe('the Gem ladder', () => {
  it('prices the next refill by what has been BOUGHT today, not by the pool', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    // Half a pool and an empty one cost the same: a refill is a whole pool
    // either way, so what rises is the rung.
    expect(manaRefillGemCost(state, T0)).toBe(MANA.gemRefillCosts[0]);
    state.city.wallet.Mana = Math.floor(manaCap(state) / 2);
    expect(manaRefillGemCost(state, T0)).toBe(MANA.gemRefillCosts[0]);

    expect(refillManaWithGems(state, T0)).toBe('Refilled');
    expect(manaRefillGemCost(state, T0)).toBe(MANA.gemRefillCosts[1]);
    expect(nextRefillRung(state, T0)).toBe(2);
  });

  it('pays a whole pool ON TOP, exactly as the video does', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    const cap = manaCap(state);
    state.city.wallet.Mana = 10;
    expect(refillManaWithGems(state, T0)).toBe('Refilled');
    expect(mana(state)).toBe(10 + cap);
    expect(getWallet(state.player.wallet, 'Gems')).toBe(100_000 - MANA.gemRefillCosts[0]);
  });

  it('runs out of rungs, and that IS the daily cap', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    for (const price of MANA.gemRefillCosts) {
      state.city.wallet.Mana = 0;
      expect(manaRefillGemCost(state, T0)).toBe(price);
      expect(refillManaWithGems(state, T0)).toBe('Refilled');
    }
    state.city.wallet.Mana = 0;
    expect(boughtRefillsLeft(state, T0)).toBe(0);
    expect(manaRefillGemCost(state, T0)).toBe(null);
    expect(refillManaWithGems(state, T0)).toBe('NoneLeft');
  });

  it('refuses a full pool, and an empty purse, without spending the rung', () => {
    const full = freshGame();
    full.player.wallet.Gems = 100_000;
    expect(refillManaWithGems(full, T0)).toBe('AlreadyFull');
    expect(boughtRefillsLeft(full, T0)).toBe(MANA.gemRefillCosts.length);

    const poor = drained();
    poor.player.wallet.Gems = MANA.gemRefillCosts[0] - 1;
    expect(refillManaWithGems(poor, T0)).toBe('NotEnoughGems');
    expect(boughtRefillsLeft(poor, T0)).toBe(MANA.gemRefillCosts.length);
  });
});

describe("the video's allowance", () => {
  it('stops offering once the day is spent', () => {
    const state = drained();
    for (let i = 0; i < AD.manaRefillsPerDay; i++) {
      state.city.wallet.Mana = 0;
      state.ads.readyAt = T0;
      refreshAdOffer(state, T0);
      expect(state.ads.pending).toBe(true);
      expect(claimAdOffer(state, T0)).toBe('Claimed');
    }
    expect(watchedRefillsLeft(state, T0)).toBe(0);
    state.city.wallet.Mana = 0;
    state.ads.readyAt = T0;
    refreshAdOffer(state, T0);
    expect(state.ads.pending).toBe(false); // the tab does not come back
  });

  it('refuses a claim past the allowance even with an offer standing', () => {
    const state = offered();
    state.ads.refills = { day: state.ads.refills.day, watched: AD.manaRefillsPerDay, bought: 0 };
    const before = mana(state);
    expect(claimAdOffer(state, T0)).toBe('NoneLeftToday');
    expect(mana(state)).toBe(before);
  });
});

describe('the two counters', () => {
  it('are independent — videos do not close the ladder, and back', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    for (let i = 0; i < AD.manaRefillsPerDay; i++) {
      state.city.wallet.Mana = 0;
      state.ads.readyAt = T0;
      refreshAdOffer(state, T0);
      claimAdOffer(state, T0);
    }
    expect(watchedRefillsLeft(state, T0)).toBe(0);
    expect(boughtRefillsLeft(state, T0)).toBe(MANA.gemRefillCosts.length);

    state.city.wallet.Mana = 0;
    expect(refillManaWithGems(state, T0)).toBe('Refilled');
    expect(watchedRefillsLeft(state, T0)).toBe(0); // still spent
  });

  it('both roll at midnight, and roll lazily on the next read', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    state.ads.refills = { day: state.ads.refills.day, watched: AD.manaRefillsPerDay, bought: 3 };
    const tomorrow = T0 + DAY;
    expect(watchedRefillsLeft(state, tomorrow)).toBe(AD.manaRefillsPerDay);
    expect(boughtRefillsLeft(state, tomorrow)).toBe(MANA.gemRefillCosts.length);
    // …and the ladder starts again at its first rung.
    expect(manaRefillGemCost(state, tomorrow)).toBe(MANA.gemRefillCosts[0]);

    state.city.wallet.Mana = 0;
    state.ads.readyAt = tomorrow;
    refreshAdOffer(state, tomorrow);
    expect(state.ads.pending).toBe(true);
  });

  it('a read alone never writes the roll — only a spend does', () => {
    const state = drained();
    state.ads.refills = { day: state.ads.refills.day, watched: 2, bought: 2 };
    const tomorrow = T0 + DAY;
    watchedRefillsLeft(state, tomorrow);
    expect(state.ads.refills.watched).toBe(2); // untouched by the read
    state.player.wallet.Gems = 100_000;
    expect(refillManaWithGems(state, tomorrow)).toBe('Refilled');
    expect(state.ads.refills).toEqual({ day: state.ads.refills.day, watched: 0, bought: 1 });
  });

  it('survive a save round-trip, so a reload is not a fresh allowance', () => {
    const state = drained();
    state.player.wallet.Gems = 100_000;
    refillManaWithGems(state, T0);
    // Drained again: a full pool refuses a refill, so a second one has to
    // have somewhere to go.
    state.city.wallet.Mana = 0;
    refillManaWithGems(state, T0);
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.ads.refills.bought).toBe(2);
    expect(manaRefillGemCost(restored, T0)).toBe(MANA.gemRefillCosts[2]);
  });

  it('read as a fresh day in a save written before they existed', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    delete (save.Modules as Record<string, unknown>)['kingdom.adOffers'];
    const restored = deserialize(save, map, T0)!;
    expect(watchedRefillsLeft(restored, T0)).toBe(AD.manaRefillsPerDay);
    expect(boughtRefillsLeft(restored, T0)).toBe(MANA.gemRefillCosts.length);
  });
});

// The presenter route: what the sheet actually draws.
describe('the Mana sheet', () => {
  it('opens from anywhere — the Gem ladder is not an ad', () => {
    const game = freshPresenter(freshGame()); // full pool, no offer
    game.openMana();
    expect(game.openOverlay).toBe('mana');
  });

  it('tells the four ways a video can be unavailable apart', () => {
    const full = freshPresenter(freshGame());
    expect(full.manaRefills().video).toBe('PoolFull');

    const half = freshPresenter(freshGame());
    half.state.city.wallet.Mana = manaCap(half.state) - 1;
    expect(half.manaRefills().video).toBe('AboveHalf');

    const cooling = freshPresenter(drained());
    cooling.state.ads.readyAt = cooling.now() + 60_000;
    expect(cooling.manaRefills().video).toBe('Cooling');

    const ready = freshPresenter(drained());
    ready.state.ads.readyAt = ready.now();
    ready.notify(); // the latch runs here
    expect(ready.manaRefills().video).toBe('Ready');

    const spent = freshPresenter(drained());
    // The presenter reads the real clock, so the ledger has to be stamped with
    // ITS day — a ledger dated T0 would simply roll and read as untouched.
    spent.state.ads.refills = {
      day: dayIndex(spent.now()), watched: AD.manaRefillsPerDay, bought: 0,
    };
    expect(spent.manaRefills().video).toBe('NoneLeftToday');
  });

  it('spends the ladder through the presenter, and says when it is done', () => {
    const game = freshPresenter(drained());
    game.state.player.wallet.Gems = 100_000;
    expect(game.manaRefills().gemCost).toBe(MANA.gemRefillCosts[0]);
    game.doRefillMana();
    expect(mana(game.state)).toBeGreaterThan(0);
    expect(game.manaRefills().rung).toBe(2);
    expect(game.manaRefills().gems).toBe('PoolFull'); // it is full now

    game.state.city.wallet.Mana = 0;
    game.state.ads.refills = {
      day: dayIndex(game.now()), watched: 0, bought: MANA.gemRefillCosts.length,
    };
    expect(game.manaRefills().gems).toBe('NoneLeftToday');
    expect(game.manaRefills().gemCost).toBe(null);
  });
});
