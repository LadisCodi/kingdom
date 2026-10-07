// A CALL THAT FILLS THE RECRUITING BAR RECRUITS (Docs/features/10-heroes.md
// §4.1, §8.3): the reveal is where the player watches a stranger's fragments
// reach ten, so it is where the hero joins — and each fragments card says
// where it left them.
import { describe, expect, it } from 'vitest';
import { BANNERS, HERO_ORDER } from '../src/sim/data/definitions';
import { grantItem } from '../src/sim/bag';
import { heroUnlockCost, ownsHeroId } from '../src/sim/heroes';
import { freshPresenter } from './helpers';

describe('a call brings fragments to the recruiting price', () => {
  it('recruits the hero on the spot and says so on the card', () => {
    const game = freshPresenter();
    const state = game.state;
    // Past the starter calls, so the rolls may miss and pay fragments.
    state.gacha.pullCounts.basic = 50;
    const strangers = HERO_ORDER.filter((id) => !ownsHeroId(state, id));
    for (const id of strangers) state.heroes.fragments[id] = heroUnlockCost() - 1;
    grantItem(state, BANNERS.basic.key, 10);
    game.doPullMany('basic', 10);

    const reveal = game.gachaReveal!;
    const recruits = reveal.prizes.filter((p) => p.kind === 'fragments' && p.progress?.toward === 'recruit');
    expect(recruits.length).toBeGreaterThan(0);
    for (const p of recruits) {
      if (p.kind !== 'fragments') continue;
      expect(p.progress!.from).toBe(heroUnlockCost() - 1);
      expect(p.progress!.recruited).toBe(true);
      expect(ownsHeroId(state, p.heroId)).toBe(true);
      // The price was paid; the change stays toward the first ascension.
      expect(state.heroes.fragments[p.heroId]).toBe(p.progress!.to - heroUnlockCost());
    }
    // A recruit comes after every other fragments card, just before the heroes.
    const kinds = reveal.prizes.map((p) => (p.kind === 'hero' ? 2 : p.kind === 'fragments' && p.progress?.recruited ? 1 : 0));
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });
});
