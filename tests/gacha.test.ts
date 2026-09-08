// The two halves of a call the player actually sees: what a pile of fragments
// is worth, and what a batch looks like once it stops being ten roll records.
//
// Node, no DOM. `gachaPrizes` is a pure function on `PullResult[]` precisely
// so the shape the reveal screen draws is testable without one — the screen
// then only owns the timing.
import { describe, expect, it } from 'vitest';
import { gachaPrizes, type GachaPrize } from '../src/game';
import {
  canUnlockHero, grantHero, heroUnlockCost, ownsHeroId, pull, unlockHero,
} from '../src/sim/heroes';
import type { PullResult } from '../src/sim/heroes';
import { COLLECTION } from '../src/sim/data/definitions';
import { addToWallet } from '../src/sim/state';
import { freshGame, freshPresenter } from './helpers';

/** A pull result with only the fields a test cares about set. */
const result = (over: Partial<PullResult> = {}): PullResult => ({
  result: 'Pulled',
  heroId: null,
  rarity: null,
  duplicate: false,
  fragments: 0,
  fragmentsOf: null,
  stardust: 0,
  guaranteed: false,
  guaranteedLegendary: false,
  ...over,
});

describe('fragments are the second door to a hero', () => {
  it('recruits an unowned hero for ten fragments and keeps the change', () => {
    const state = freshGame();
    expect(ownsHeroId(state, 'Bard')).toBe(false);

    state.heroes.fragments.Bard = heroUnlockCost() + 2;
    expect(canUnlockHero(state, 'Bard')).toBe(true);
    expect(unlockHero(state, 'Bard')).toBe('Unlocked');

    expect(ownsHeroId(state, 'Bard')).toBe(true);
    // The overflow survives, so a player sitting on twelve starts two along
    // the ascension ladder rather than back at zero.
    expect(state.heroes.fragments.Bard).toBe(2);
    // Unlocking is NOT an ascension: the whole tier ladder is still ahead.
    expect(state.heroes.tiers.Bard).toBe(1);
    expect(state.heroes.levels.Bard).toBe(1);
  });

  it('refuses below the price, and refuses a hero already owned', () => {
    const state = freshGame();
    state.heroes.fragments.Bard = heroUnlockCost() - 1;
    expect(canUnlockHero(state, 'Bard')).toBe(false);
    expect(unlockHero(state, 'Bard')).toBe('NotEnoughFragments');
    expect(ownsHeroId(state, 'Bard')).toBe(false);
    // …and the refusal took nothing.
    expect(state.heroes.fragments.Bard).toBe(heroUnlockCost() - 1);

    grantHero(state, 'Bard');
    state.heroes.fragments.Bard = 99;
    expect(unlockHero(state, 'Bard')).toBe('AlreadyOwned');
    expect(state.heroes.fragments.Bard).toBe(99);
  });

  it('prices the unlock at the ladder\'s own base rung', () => {
    // The number the card shows and the number the first ascension asks for
    // are deliberately the same one, so the player learns it once.
    expect(heroUnlockCost()).toBe(COLLECTION.fragmentsPerTierBase);
  });

  // The property the whole design turns on: a hero the banner never offers is
  // still reachable, because a miss pays fragments toward someone.
  it('lets a run of misses alone reach a hero', () => {
    const state = freshGame();
    addToWallet(state.player.wallet, 'SilverKey', 40);
    for (let i = 0; i < 40; i++) pull(state, 'basic');
    const reachable = Object.entries(state.heroes.fragments)
      .filter(([id]) => !ownsHeroId(state, id as never))
      .some(([, n]) => (n ?? 0) >= heroUnlockCost());
    expect(reachable || state.heroes.owned.length > 1).toBe(true);
  });
});

describe('a batch condenses into prizes', () => {
  it('sums one currency into one widget', () => {
    const prizes = gachaPrizes([
      result({ stardust: 50 }), result({ stardust: 50 }), result({ stardust: 50 }),
    ]);
    expect(prizes).toEqual([{ kind: 'currency', currency: 'Stardust', amount: 150 }]);
  });

  it('stacks fragments per hero rather than per call', () => {
    const prizes = gachaPrizes([
      result({ fragments: 3, fragmentsOf: 'Bard' }),
      result({ fragments: 3, fragmentsOf: 'Bard' }),
      result({ fragments: 6, fragmentsOf: 'Wizard' }),
    ]);
    const frags = prizes.filter((p): p is Extract<GachaPrize, { kind: 'fragments' }> =>
      p.kind === 'fragments');
    expect(frags).toEqual([
      { kind: 'fragments', heroId: 'Bard', amount: 6 },
      { kind: 'fragments', heroId: 'Wizard', amount: 6 },
    ]);
  });

  it('puts heroes last, so the sequence arrives at them', () => {
    const prizes = gachaPrizes([
      result({ stardust: 50 }),
      result({ heroId: 'Wizard', rarity: 'Rare', stardust: 50 }),
      result({ fragments: 3, fragmentsOf: 'Bard', stardust: 50 }),
    ]);
    expect(prizes[prizes.length - 1]).toEqual({ kind: 'hero', heroId: 'Wizard' });
  });

  // A duplicate already paid its fragments. Drawing it as a hero would promise
  // a roster entry that is already there.
  it('does not draw a duplicate as a hero', () => {
    const prizes = gachaPrizes([
      result({ heroId: 'Wizard', rarity: 'Rare', duplicate: true, fragments: 20, fragmentsOf: 'Wizard' }),
    ]);
    expect(prizes.some((p) => p.kind === 'hero')).toBe(false);
    expect(prizes).toContainEqual({ kind: 'fragments', heroId: 'Wizard', amount: 20 });
  });

  it('has nothing to show for a call that paid nothing', () => {
    expect(gachaPrizes([])).toEqual([]);
  });
});

describe('the presenter hands a call to the reveal screen', () => {
  it('opens on a call and closes when the player is done reading', () => {
    const game = freshPresenter();
    expect(game.gachaReveal).toBeNull();

    // The first call on the basic banner is free, so this needs no purse.
    game.doPull('basic');

    expect(game.gachaReveal).not.toBeNull();
    expect(game.gachaReveal!.calls).toBe(1);
    expect(game.gachaReveal!.prizes.length).toBeGreaterThan(0);

    game.dismissGachaReveal();
    expect(game.gachaReveal).toBeNull();
  });

  it('reports the ten as ten calls, however few widgets they condense to', () => {
    const state = freshGame();
    addToWallet(state.player.wallet, 'SilverKey', 10);
    const game = freshPresenter(state);

    game.doPullMany('basic', 10);

    expect(game.gachaReveal!.calls).toBe(10);
    // Ten calls never draw ten Stardust tiles.
    const currencies = game.gachaReveal!.prizes.filter((p) => p.kind === 'currency');
    expect(currencies).toHaveLength(1);
  });

  it('opens nothing when the purse cannot pay', () => {
    const state = freshGame();
    state.player.wallet.SilverKey = 0;
    const game = freshPresenter(state);
    game.doPull('basic'); // the free first call
    game.dismissGachaReveal();

    game.doPull('basic'); // …and now there is nothing to spend
    expect(game.gachaReveal).toBeNull();
  });
});
