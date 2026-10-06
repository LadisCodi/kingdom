// The two halves of a call the player actually sees: what a pile of fragments
// is worth, and what a batch looks like once it stops being ten roll records.
//
// Node, no DOM. `gachaPrizes` is a pure function on `PullResult[]` precisely
// so the shape the reveal screen draws is testable without one — the screen
// then only owns the timing.
import { grantItem } from '../src/sim/bag';
import { describe, expect, it } from 'vitest';
import { gachaPrizes, type GachaPrize } from '../src/game';
import {
  ascensionStardustCost, canUnlockHero, grantHero, heroUnlockCost, levelUpHero,
  ascendHero, ownsHeroId, pull, unlockHero,
} from '../src/sim/heroes';
import {
  ascensionFragmentCost, fullStars, heroLevelCap, maxAscension, xpLevelCost,
} from '../src/sim/heroLadder';
import type { PullResult } from '../src/sim/heroes';
import { HERO_LADDER } from '../src/sim/data/definitions';
import { addToWallet, getWallet } from '../src/sim/state';
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
    // Unlocking is NOT an ascension: every star is still empty.
    expect(state.heroes.ascension.Bard).toBe(0);
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

  it('prices the unlock at its own authored number', () => {
    expect(heroUnlockCost()).toBe(HERO_LADDER.recruitFragments);
  });

  // The property the whole design turns on: a hero the banner never offers is
  // still reachable, because a miss pays fragments toward someone.
  it('lets a run of misses alone reach a hero', () => {
    const state = freshGame();
    grantItem(state, 'SilverKey', 40);
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
    grantItem(state, 'SilverKey', 10);
    const game = freshPresenter(state);

    game.doPullMany('basic', 10);

    expect(game.gachaReveal!.calls).toBe(10);
    // Ten calls never draw ten Stardust tiles.
    const currencies = game.gachaReveal!.prizes.filter((p) => p.kind === 'currency');
    expect(currencies).toHaveLength(1);
  });

  it('opens nothing when the purse cannot pay', () => {
    const state = freshGame();
    state.bag.held.SilverKey = 0;
    const game = freshPresenter(state);
    game.doPull('basic'); // the free first call
    game.dismissGachaReveal();

    game.doPull('basic'); // …and now there is nothing to spend
    expect(game.gachaReveal).toBeNull();
  });
});

// An ascension asks TWO prices: the fragments are the chase, the Stardust is
// the toll that keeps it a tax on the relics' currency rather than a second
// hero currency (Docs/features/10-heroes.md §4).
describe('an ascension asks two prices', () => {
  const armed = () => {
    const state = freshGame();
    grantHero(state, 'Bard');
    state.heroes.fragments.Bard = 999;
    return state;
  };

  it('charges the fragments and the Stardust toll together', () => {
    const state = armed();
    addToWallet(state.kingdom.wallet, 'Stardust', 1000);

    expect(ascendHero(state, 'Bard')).toBe('Ascended');

    expect(state.heroes.ascension.Bard).toBe(1);
    expect(state.heroes.fragments.Bard).toBe(999 - ascensionFragmentCost(0));
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(1000 - ascensionStardustCost(0));
  });

  it('refuses without the Stardust, and takes nothing when it refuses', () => {
    const state = armed();
    addToWallet(state.kingdom.wallet, 'Stardust', ascensionStardustCost(0) - 1);

    expect(ascendHero(state, 'Bard')).toBe('NotEnoughStardust');

    // The fragments are still there: a half-paid ascension would eat them.
    expect(state.heroes.fragments.Bard).toBe(999);
    expect(state.heroes.ascension.Bard).toBe(0);
  });

  it('prices every point of a star alike, and each star twice the last', () => {
    const per = HERO_LADDER.ascensionStepsPerStar;
    for (let a = 0; a < per; a++) expect(ascensionStardustCost(a)).toBe(ascensionStardustCost(0));
    expect(ascensionStardustCost(per)).toBe(ascensionStardustCost(0) * 2);
    expect(ascensionFragmentCost(per)).toBe(ascensionFragmentCost(0) * 2);
  });

  it('carries one hero to the top for 744 Stardust and 186 fragments', () => {
    let dust = 0;
    let frags = 0;
    for (let a = 0; a < maxAscension(); a++) {
      dust += ascensionStardustCost(a);
      frags += ascensionFragmentCost(a);
    }
    expect(maxAscension()).toBe(30);
    expect(dust).toBe(744);
    expect(frags).toBe(186);
  });

  it('stops at the last point of the last star', () => {
    const state = armed();
    addToWallet(state.kingdom.wallet, 'Stardust', 10_000);
    state.heroes.ascension.Bard = maxAscension();
    expect(ascendHero(state, 'Bard')).toBe('AtMaxAscension');
  });
});

// A LEVEL COSTS HERO XP, an ascension costs fragments and a Stardust toll,
// and a relic's level costs Stardust. Three prices, three jobs — the split is
// the whole reason Hero XP is a currency (Docs/features/10-heroes.md §4).
describe('a level costs Hero XP', () => {
  it('spends XP and leaves Stardust alone', () => {
    const state = freshGame();
    grantHero(state, 'Bard');
    addToWallet(state.kingdom.wallet, 'HeroXp', 1000);
    addToWallet(state.kingdom.wallet, 'Stardust', 1000);

    expect(levelUpHero(state, 'Bard')).toBe('Levelled');

    expect(state.heroes.levels.Bard).toBe(2);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(1000 - xpLevelCost(1));
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(1000);
  });

  it('refuses on an empty XP purse, however much Stardust is banked', () => {
    const state = freshGame();
    grantHero(state, 'Bard');
    addToWallet(state.kingdom.wallet, 'Stardust', 99_999);

    expect(levelUpHero(state, 'Bard')).toBe('NotEnoughXp');
    expect(state.heroes.levels.Bard).toBe(1);
  });

  it('still refuses at the ascension cap, before it looks at the purse', () => {
    const state = freshGame();
    grantHero(state, 'Bard');
    // Derived, not typed in: the cap is data and has already moved twice.
    state.heroes.levels.Bard = heroLevelCap(0);
    addToWallet(state.kingdom.wallet, 'HeroXp', 999_999);

    expect(levelUpHero(state, 'Bard')).toBe('AscensionCapped');
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(999_999);
  });
});

// A full star is worth eight levels and a point of one is worth none: the
// cap climbs 10, 18, 26, 34, 42, 50 (Docs/features/10-heroes.md §4).
describe('a full star raises the level cap', () => {
  it('caps at ten with no star, eight more a star, and fifty at the top', () => {
    const per = HERO_LADDER.ascensionStepsPerStar;
    expect(heroLevelCap(0)).toBe(10);
    expect(heroLevelCap(per - 1)).toBe(10);
    expect(heroLevelCap(per)).toBe(18);
    expect(fullStars(per * 2 + 3)).toBe(2);
    expect(heroLevelCap(maxAscension())).toBe(50);
  });

  it('holds the level at the cap until the star is finished', () => {
    const state = freshGame();
    grantHero(state, 'Bard');
    addToWallet(state.kingdom.wallet, 'HeroXp', 1_000_000);
    state.heroes.levels.Bard = 10;
    state.heroes.ascension.Bard = HERO_LADDER.ascensionStepsPerStar - 1;
    expect(levelUpHero(state, 'Bard')).toBe('AscensionCapped');
    state.heroes.ascension.Bard = HERO_LADDER.ascensionStepsPerStar;
    expect(levelUpHero(state, 'Bard')).toBe('Levelled');
  });

  it('keeps the XP curve payable over fifty levels', () => {
    // 1.6 a level is fine over ten and absurd over fifty: level 50 alone
    // would cost 4e11. The curve flattens as the ladder stretches.
    let total = 0;
    for (let l = 1; l < 50; l += 1) total += xpLevelCost(l);
    expect(xpLevelCost(1)).toBeLessThan(200);
    expect(xpLevelCost(49)).toBeLessThan(10_000);
    expect(total).toBeLessThan(200_000);
  });
});
