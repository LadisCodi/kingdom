// A CALL THAT FILLS THE RECRUITING BAR RECRUITS (Docs/features/10-heroes.md
// §4.1, §8.3): the reveal is where the player watches a stranger's fragments
// reach their price, so it is where the hero joins — and the bag card says
// where the batch left each hero.
import { describe, expect, it } from 'vitest';
import { BANNERS, HERO_ORDER } from '../src/sim/data/definitions';
import { grantItem } from '../src/sim/bag';
import { heroUnlockCost, ownsHeroId } from '../src/sim/heroes';
import { freshPresenter } from './helpers';

describe('a call brings fragments to the recruiting price', () => {
  it('recruits the hero on the spot, seals its line and deals it as a hero', () => {
    const game = freshPresenter();
    const state = game.state;
    // Past the starter calls, so the rolls may miss and pay fragments.
    state.gacha.pullCounts.basic = 50;
    const strangers = HERO_ORDER.filter((id) => !ownsHeroId(state, id));
    for (const id of strangers) state.heroes.fragments[id] = heroUnlockCost(id) - 1;
    grantItem(state, BANNERS.basic.key, 10);
    game.doPullMany('basic', 10);

    const reveal = game.gachaReveal!;
    const bag = reveal.prizes.find((p) => p.kind === 'bag');
    if (bag?.kind !== 'bag') throw new Error('a ten-call deals its fragments on one bag card');
    const recruits = bag.rows.filter((r) => r.progress?.toward === 'recruit');
    expect(recruits.length).toBeGreaterThan(0);
    for (const r of recruits) {
      expect(r.progress!.from).toBe(heroUnlockCost(r.heroId) - 1);
      expect(r.progress!.recruited).toBe(true);
      expect(ownsHeroId(state, r.heroId)).toBe(true);
      // The price was paid; the change stays toward the first ascension.
      expect(state.heroes.fragments[r.heroId]).toBe(r.progress!.to - heroUnlockCost(r.heroId));
      // …and the recruit is celebrated as a hero, after the bag.
      const at = reveal.prizes.findIndex((p) => p.kind === 'hero' && p.heroId === r.heroId);
      expect(at).toBeGreaterThan(reveal.prizes.indexOf(bag));
    }
  });
});
