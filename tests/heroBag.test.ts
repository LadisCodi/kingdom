// THE HERO BAG, THE FALLING CHANCE AND THE THREE SLOTS
// (Docs/features/10-heroes.md §6.4, §6.6).
//
// The bag is what puts Fragments where they recruit: a call reaches only the
// heroes the player owns and a few open ones, so a run of calls fills a few
// bars instead of fourteen a tenth of the way.
import { afterEach, describe, expect, it } from 'vitest';
import { BANNERS, HERO_LADDER, HEROES, heroesOfRarity, type HeroRarity } from '../src/sim/data/definitions';
import {
  bagHeroes, bagOrder, bannerHeroes, baseHeroChance, grantHero, lootSlot, openHeroes, ownsHeroId, pull,
} from '../src/sim/heroes';
import { groupPrizes, type GachaPrize } from '../src/game';
import type { GameState, HeroId } from '../src/sim/state';
import { freshGame } from './helpers';

const RARITIES: HeroRarity[] = ['Common', 'Rare', 'Legendary'];

const rich = (): GameState => {
  const state = freshGame();
  state.bag.held.SilverKey = 2000;
  state.bag.held.GoldKey = 2000;
  return state;
};

/** Undo a test's change to authored data, whatever it asserted. */
const restores: Array<() => void> = [];
afterEach(() => { while (restores.length > 0) restores.pop()!(); });

describe('the bag', () => {
  it('holds every hero owned plus the open count of each rarity', () => {
    const state = freshGame();
    for (const r of RARITIES) {
      expect(openHeroes(state, r)).toHaveLength(HERO_LADDER.bagOpen[r]);
      expect(openHeroes(state, r).every((id) => !ownsHeroId(state, id))).toBe(true);
    }
    const owned = heroesOfRarity('Common')[0]!;
    grantHero(state, owned);
    expect(bagHeroes(state, 'Common')).toContain(owned);
  });

  it('refills: recruiting an open hero opens the next, in the bag\'s order', () => {
    const state = freshGame();
    const order = bagOrder(state, 'Common').filter((id) => !ownsHeroId(state, id));
    const first = openHeroes(state, 'Common');
    expect(first).toEqual(order.slice(0, HERO_LADDER.bagOpen.Common));
    grantHero(state, first[0]!);
    expect(openHeroes(state, 'Common')).toEqual(order.slice(1, HERO_LADDER.bagOpen.Common + 1));
  });

  it('is shuffled per kingdom, and the same every time it is read', () => {
    const a = freshGame();
    const b = freshGame();
    b.seed = a.seed + 1;
    expect(bagOrder(a, 'Common')).toEqual(bagOrder(a, 'Common'));
    expect(bagOrder(a, 'Common')).not.toEqual(bagOrder(b, 'Common'));
  });

  it('opens the ranked heroes first, in rank order, then the shuffle', () => {
    const state = freshGame();
    for (const r of RARITIES) {
      const ranked = heroesOfRarity(r).filter((id) => HEROES[id].bagRank !== null)
        .sort((a, b) => HEROES[a].bagRank! - HEROES[b].bagRank!);
      expect(bagOrder(state, r).slice(0, ranked.length)).toEqual(ranked);
    }
    // A brand-new kingdom's open heroes are the first ranked ones.
    state.heroes.owned = [];
    state.heroes.fragments = {};
    for (const r of RARITIES) {
      expect(openHeroes(state, r)).toEqual(bagOrder(state, r).slice(0, HERO_LADDER.bagOpen[r]));
    }
  });

  it('keeps open, over the count, a hero holding Fragments — none is stranded', () => {
    const state = freshGame();
    const outside = bagOrder(state, 'Common').at(-1)!;
    expect(openHeroes(state, 'Common')).not.toContain(outside);
    state.heroes.fragments[outside] = 1;
    expect(openHeroes(state, 'Common')).toContain(outside);
    expect(openHeroes(state, 'Common')).toHaveLength(HERO_LADDER.bagOpen.Common + 1);
  });

  it('keeps the season hero open, over the count, until recruited', () => {
    const state = freshGame();
    const season = bagOrder(state, 'Legendary').at(-1)!;
    const b = BANNERS.advanced as { featuredHero: HeroId | '' };
    restores.push(() => { b.featuredHero = ''; });
    b.featuredHero = season;
    expect(openHeroes(state, 'Legendary')).toContain(season);
    expect(openHeroes(state, 'Legendary')).toHaveLength(HERO_LADDER.bagOpen.Legendary + 1);
    grantHero(state, season);
    expect(openHeroes(state, 'Legendary')).toHaveLength(HERO_LADDER.bagOpen.Legendary);
  });

  it('is all a call reaches: every hero and every Fragment comes from it', () => {
    const state = rich();
    for (let i = 0; i < 300; i++) {
      const banner = i % 5 === 4 ? 'advanced' : 'basic';
      const before = new Set(bannerHeroes(state, banner));
      const result = pull(state, banner);
      if (result.heroId !== null) expect(before.has(result.heroId)).toBe(true);
      for (const l of result.loot) {
        if (l.kind !== 'fragments') continue;
        // A hit may have recruited, which opens a hero: the bag after the
        // hero landed is the one the loot was drawn from.
        expect(before.has(l.heroId) || new Set(bannerHeroes(state, banner)).has(l.heroId)).toBe(true);
      }
    }
  });
});

describe('the hero chance falls as the collection grows', () => {
  it('reads the ladder at the heroes owned, and holds its last rung', () => {
    const state = freshGame();
    const ladder = BANNERS.basic.heroChanceByOwned;
    state.heroes.owned = [];
    expect(baseHeroChance(state, 'basic')).toBe(ladder[0]);
    for (const id of heroesOfRarity('Common').slice(0, 3)) grantHero(state, id);
    expect(baseHeroChance(state, 'basic')).toBe(ladder[3]);
    for (const id of [...heroesOfRarity('Common'), ...heroesOfRarity('Rare')]) grantHero(state, id);
    expect(baseHeroChance(state, 'basic')).toBe(ladder[ladder.length - 1]);
  });

  it('falls, rung by rung', () => {
    for (const b of [BANNERS.basic, BANNERS.advanced]) {
      const l = b.heroChanceByOwned;
      for (let i = 1; i < l.length; i++) expect(l[i]!).toBeLessThanOrEqual(l[i - 1]!);
    }
  });
});

describe('every call pays three slots', () => {
  it('a miss pays a Fragment, then hero goods or a second Fragment, then a supply', () => {
    const state = rich();
    state.gacha.pullCounts.basic = 50; // past the starter calls
    let misses = 0;
    let extras = 0;
    for (let i = 0; i < 400; i++) {
      const result = pull(state, 'basic');
      if (result.heroId !== null) continue;
      misses += 1;
      expect(result.loot).toHaveLength(3);
      const [hero, second, supply] = result.loot;
      expect(hero!.kind).toBe('fragments');
      expect(supply!.kind).toBe('item');
      if (second!.kind === 'fragments') extras += 1;
      else expect(second!.kind).toBe('currency');
    }
    // About one call in five turns its hero goods into a Fragment.
    expect(extras / misses).toBeGreaterThan(BANNERS.basic.extraHeroSlotChance * 0.6);
    expect(extras / misses).toBeLessThan(BANNERS.basic.extraHeroSlotChance * 1.4);
  });

  it('names each loot row\'s slot by its reward', () => {
    const slots = new Set(BANNERS.basic.loot.map(lootSlot));
    expect(slots).toEqual(new Set(['hero', 'heroGoods', 'supplies']));
  });
});

describe('a ten-call groups into a handful of cards', () => {
  it('a card per currency, per supply family, one bag card, a card per new hero', () => {
    const prizes: GachaPrize[] = [
      { kind: 'currency', currency: 'Stardust', amount: 75 },
      { kind: 'currency', currency: 'HeroXp', amount: 450 },
      { kind: 'item', item: 'ConstructionSpeedup5m', amount: 2 },
      { kind: 'item', item: 'TrainingSpeedup5m', amount: 1 },
      { kind: 'item', item: 'FoodChest10m', amount: 3 },
      { kind: 'fragments', heroId: 'Bard', amount: 4, progress: { toward: 'recruit', from: 12, to: 16, goal: 15, recruited: true } },
      { kind: 'fragments', heroId: 'Cook', amount: 2, progress: { toward: 'recruit', from: 0, to: 2, goal: 15, recruited: false } },
      { kind: 'hero', heroId: 'Wizard' },
    ];
    const grouped = groupPrizes(prizes);
    expect(grouped.map((p) => p.kind)).toEqual(['currency', 'currency', 'supplies', 'supplies', 'bag', 'hero', 'hero']);
    const speedups = grouped[2]!;
    expect(speedups.kind === 'supplies' && speedups.family).toBe('speedup');
    expect(speedups.kind === 'supplies' && speedups.amount).toBe(3);
    const bag = grouped[4]!;
    // The recruit's line comes last on the bag, and it is dealt as a hero too.
    expect(bag.kind === 'bag' && bag.rows.map((r) => r.heroId)).toEqual(['Cook', 'Bard']);
    expect(grouped.slice(5).map((p) => p.kind === 'hero' && p.heroId)).toEqual(['Bard', 'Wizard']);
  });
});
