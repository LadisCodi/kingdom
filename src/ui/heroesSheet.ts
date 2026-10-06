// The Heroes screen — a roster of cards, and one card opened
// (Docs/features/10-heroes.md §8).
//
// THE ROSTER is the hero picker's window (ui/heroPicker.ts) with the party
// taken out: the same filter bar, the same cards three to a row, scrolling on
// their own, and under them one button into the banner. Owned heroes first,
// in the picker's order, then the ones not found yet, in roster order, as
// silhouettes with their fragments. A hero is the same card wherever it is
// shown (ui/heroCard.ts).
//
// THE CARD is a centred window (mockup hero-detail-A): the name on the
// plank, the hero on its rarity's stage, then a section each for the
// ascension, the stats, the passive and the level — the upgrade popup's
// section heads, parchment tiles, price line and button. A hero not found
// yet gets the same window with its fragments where the level was.
//
// Two views, one overlay — the nav tab stays put and `game.openHeroId`
// decides which of them draws. That lives on the presenter, not here, for
// the reason `expeditionLair` does: it survives the per-tick rebuild and it
// is node-testable.
//
// THE SCREEN DOES NOT REBUILD ON THE TICK. It draws thirty-two `<img>`
// portraits and nothing on it is time-dependent, so it opts out through
// `game.heroesSignature()` (src/ui/kit/host.ts). Recreating those images once
// a second made the grid blink, because a fresh `<img>` decodes before its
// first paint.

import { HERO_LADDER, HERO_ORDER, HEROES } from '../sim/data/definitions';
import type { HeroDef, HeroRarity } from '../sim/data/definitions';
import {
  ascensionStardustCost, canUnlockHero, heroStats, heroUnlockCost, nextSkillRankLevel, rosterView,
  skillRank, skillRankBlock, skillRankPrice,
} from '../sim/heroes';
import { SKILLS, maxSkillRank, skillSentence } from '../sim/skills';
import {
  ascensionFragmentCost, fullStars, heroLevelCap, maxAscension, xpLevelCost,
} from '../sim/heroLadder';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { HeroId } from '../sim/state';
import type { Game } from '../game';
import { el, formatExact, formatNumber } from './format';
import { heroFragmentIcon } from './heroFragment';
import {
  btn, iconEl, knob, pips, priceLine, progress, sectionHead, sheet, unitTypeIcon,
} from './kit';
import type { IconName } from './kit';
import { ascensionStars } from './ascensionStars';
import { heroCard, heroFilterBar } from './heroCard';

const RARITY_CLASS: Record<HeroRarity, string> = {
  Common: 'is-common', Rare: 'is-rare', Legendary: 'is-legendary',
};

type RosterEntry = ReturnType<typeof rosterView>[number];

/** Can this hero take a level or an ascension right now? The card's green
 *  orb — the roster's job is to point at the one card worth opening. */
function ready(game: Game, view: RosterEntry): boolean {
  // An unfound hero with ten fragments is the most urgent card on the screen:
  // it is a hero the player already owns and has not noticed.
  if (!view.owned) return canUnlockHero(game.state, view.id);
  const canLevel = view.entry.level < view.levelCap
    && game.walletValue('HeroXp') >= xpLevelCost(view.entry.level);
  const canAscend = view.entry.ascension < maxAscension()
    && view.entry.fragments >= ascensionFragmentCost(view.entry.ascension);
  const canRank = skillRankBlock(game.state, view.id) === null;
  return canLevel || canAscend || canRank;
}

// ------------------------------------------------------------------ the grid

function grid(game: Game): HTMLElement {
  const roster = rosterView(game.state);
  const byId = new Map(roster.map((v) => [v.id, v]));
  const found = roster.filter((h) => h.owned).length;
  const list = game.heroesList();

  const open = (id: HeroId) => { game.openHeroId = id; game.notify(); };
  const cards = el('div', { class: 'hp-grid' },
    ...list.map((id) => heroCard(game, id, { onClick: () => open(id), cta: ready(game, byId.get(id)!) })));

  return el('div', { class: 'hp hp--roster' },
    heroFilterBar({
      filter: game.heroesFilter,
      sort: game.heroesSort,
      onFilter: (f) => game.heroesSetFilter(f),
      onSort: () => game.heroesCycleSort(),
    }),
    el('div', { class: 'hp-found' }, `${formatExact(found)} of ${formatExact(roster.length)} found`),
    el('div', { class: 'hp-list', 'data-keep-scroll': 'heroes' },
      sectionHead('Heroes'),
      list.length > 0 ? cards : el('p', { class: 'hp-none' }, 'No heroes of that type')),
    // The way to another hero. The banner lives in the store
    // (Docs/features/14-monetization.md §2.1), so the roster POINTS at it
    // rather than holding a copy of it.
    el('div', { class: 'hp-go' },
      btn({ label: 'Call for aid', kind: 'gem', icon: 'star', onClick: () => game.openStore('heroes') })),
  );
}

// ---------------------------------------------------------------- the detail

const RARITY_LABEL: Record<HeroRarity, string> = {
  Common: 'Common', Rare: 'Rare', Legendary: 'Legendary',
};

/** Step to the hero before or after this one, wrapping. Comparing two of them
 *  is most of what this screen is for, and a trip back through the grid to do
 *  it is three taps where this is one. */
function step(id: HeroId, by: 1 | -1): HeroId {
  const i = HERO_ORDER.indexOf(id);
  return HERO_ORDER[(i + by + HERO_ORDER.length) % HERO_ORDER.length]!;
}

/** A hero's illustration. The art is always CONTAINED in its box and never
 *  cropped. */
function heroArt(def: HeroDef): HTMLElement {
  const url = spriteUrl(def.sprite);
  return url ? spriteImgAt(url, 'hd-art') : el('div', { class: 'hd-art is-glyph' }, def.glyph);
}

/** The hero on its rarity's stage: the rarity's ribbon top-left, the type's
 *  banner top-right, an arrow each side to step the roster. */
function stage(game: Game, def: HeroDef, id: HeroId, owned: boolean): HTMLElement {
  const arrow = (by: 1 | -1) => {
    const k = knob(by === 1 ? '›' : '‹', () => {
      game.openHeroId = step(id, by);
      game.notify();
    }, { label: by === 1 ? 'Next hero' : 'Previous hero' });
    k.classList.add(by === 1 ? 'hd-next' : 'hd-prev');
    return k;
  };
  return el('div', { class: `hd-stage ${RARITY_CLASS[def.rarity]}${owned ? '' : ' is-missing'}` },
    heroArt(def),
    el('span', { class: 'hd-frame', 'aria-hidden': 'true' }),
    el('span', { class: `hd-rarity ${RARITY_CLASS[def.rarity]}` }, RARITY_LABEL[def.rarity]),
    el('span', { class: `hd-type is-${def.unitType}` },
      iconEl(unitTypeIcon(def.unitType), { size: 'sm' }), def.unitType),
    arrow(-1),
    arrow(1),
  );
}

/** A section's two halves: what it reads on the left, its price and button
 *  on the right. */
const tray = (cls: string, read: Node, buy: Node | null): HTMLElement =>
  el('div', { class: `hd-tray k-section ${cls}` }, read, ...(buy ? [buy] : []));

const buy = (price: HTMLElement | null, button: HTMLElement): HTMLElement =>
  el('div', { class: 'hd-buy' }, ...(price ? [price] : []), button);

/** "Level 7 of 30" over its bar — the level and the fragments read alike. */
function reading(label: string, have: number, of: number): HTMLElement {
  const bar = progress('green');
  bar.set(of > 0 ? have / of : 0);
  return el('div', { class: 'hd-read' },
    el('div', { class: 'hd-read-line' },
      `${label} `, el('b', {}, formatExact(have)), ` of ${formatExact(of)}`),
    bar.root);
}

/** The stars, and under them what the next point does: every point lifts
 *  every stat, and the one that finishes a star lifts the level cap too. */
function ascensionRead(ascension: number): HTMLElement {
  const per = HERO_LADDER.ascensionStepsPerStar;
  const points = ascension - fullStars(ascension) * per;
  const stats = `Next: stats +${formatNumber(HERO_LADDER.statsPerAscension * 100, 1)}%`;
  const line = ascension >= maxAscension()
    ? 'Fully ascended'
    : points === per - 1
      ? `${stats} · level cap ${formatExact(heroLevelCap(ascension + 1))}`
      : stats;
  return el('div', { class: 'hd-asc' },
    ascensionStars(ascension, 'hd-stars'),
    el('div', { class: 'hd-asc-line' }, line));
}

function ascension(game: Game, id: HeroId, view: RosterEntry): HTMLElement {
  const a = view.entry.ascension;
  if (a >= maxAscension()) return tray('hd-ascend is-max', ascensionRead(a), null);
  const toll = ascensionStardustCost(a);
  const need = ascensionFragmentCost(a);
  const shortDust = game.walletValue('Stardust') < toll;
  const shortFrags = view.entry.fragments < need;
  return tray('hd-ascend', ascensionRead(a), buy(
    // Both prices over the button that spends them: the Stardust toll is a
    // wallet row, the fragments are a counter beside the hero, and one shown
    // without the other is a button whose refusal has no reason.
    priceLine([
      { icon: 'Stardust', amount: formatExact(toll), short: shortDust },
      { icon: 'fragment', art: heroFragmentIcon(id), amount: `${formatExact(view.entry.fragments)} / ${formatExact(need)}`, short: shortFrags },
    ]),
    btn({
      label: 'Ascend',
      kind: 'primary',
      onClick: () => game.doAscendHero(id),
      disabledReason: shortFrags ? 'Not enough fragments' : shortDust ? 'Not enough Stardust' : undefined,
    }),
  ));
}

function level(game: Game, id: HeroId, view: RosterEntry): HTMLElement {
  const lv = view.entry.level;
  const read = reading('Level', lv, view.levelCap);
  if (lv >= HERO_LADDER.heroMaxLevel) {
    return tray('hd-level', read, el('div', { class: 'hd-note' }, 'At the ceiling'));
  }
  // At the ascension's ceiling the button goes away and the tray says what to
  // do instead: a disabled button still offers a press, and the press is not
  // the answer — the Ascend above is.
  if (lv >= view.levelCap) {
    return tray('hd-level', read,
      el('div', { class: 'hd-note' }, iconEl('ascension', { size: 'sm' }), 'Ascend them to go further'));
  }
  const cost = xpLevelCost(lv);
  const short = game.walletValue('HeroXp') < cost;
  return tray('hd-level', read, buy(
    priceLine([{ icon: 'HeroXp', amount: formatExact(cost), short }]),
    btn({
      label: 'Level Up',
      kind: 'primary',
      onClick: () => game.doLevelHero(id),
      disabledReason: short ? 'Not enough Hero XP' : undefined,
    }),
  ));
}

/** A hero not found yet: the fragments where the level was, and whichever of
 *  the two doors to them is open — Recruit once ten have piled up, the banner
 *  until then (Docs/features/10-heroes.md §4.1). */
function fragments(game: Game, id: HeroId, view: RosterEntry): HTMLElement {
  const need = heroUnlockCost();
  const enough = view.entry.fragments >= need;
  return tray('hd-level', reading('Fragments', view.entry.fragments, need), buy(
    enough ? priceLine([{ icon: 'fragment', art: heroFragmentIcon(id), amount: formatExact(need) }]) : null,
    enough
      ? btn({ label: 'Recruit', kind: 'primary', onClick: () => game.doUnlockHero(id) })
      : btn({ label: 'Call for aid', kind: 'gem', icon: 'star', onClick: () => game.openStore('heroes') }),
  ));
}

/** The skill's mark, by what it does. */
const SKILL_ICON: Record<string, IconName> = {
  strike: 'atk', heal: 'hp', shield: 'def', daze: 'sparkle', rally: 'crest', spoils: 'sparkle',
};

/**
 * THE SKILL (Docs/features/10-heroes.md §2.5): what it does at its rank, and
 * under it the next rank — its price and Upgrade, or what is missing. A level
 * only UNLOCKS a rank; the rank is bought.
 */
function skill(game: Game, id: HeroId, owned: boolean): HTMLElement {
  const def = HEROES[id];
  const info = SKILLS[def.skill.id];
  const rank = owned ? skillRank(game.state, id) : 1;
  const top = maxSkillRank();
  const head = el('div', { class: 'hd-skill k-section' },
    iconEl(SKILL_ICON[info.kind] ?? 'sparkle'),
    el('div', { class: 'hd-skill-text' },
      el('div', { class: 'hd-skill-name' }, el('b', {}, info.name), pips(rank, top)),
      el('div', { class: 'hd-skill-says' }, skillSentence(def.skill, rank))));
  if (!owned || rank >= top) return head;
  const unlock = nextSkillRankLevel(rank)!;
  const next = el('div', { class: 'hd-read' },
    el('div', { class: 'hd-read-line' }, el('b', {}, `Rank ${formatExact(rank + 1)}: `), skillSentence(def.skill, rank + 1)));
  const level = game.heroLevelOf(id);
  if (level < unlock) {
    const cap = heroLevelCap(game.state.heroes.ascension[id] ?? 0);
    return el('div', { class: 'hd-skill-wrap' }, head, tray('hd-rank', next,
      el('div', { class: 'hd-note' }, iconEl('padlock', { size: 'sm' }),
        cap < unlock ? `Ascend, then reach level ${formatExact(unlock)}` : `Reach level ${formatExact(unlock)}`)));
  }
  const price = skillRankPrice(game.state, id)!;
  const block = skillRankBlock(game.state, id);
  const terms = [{ icon: 'Stardust' as IconName, amount: formatExact(price.stardust), short: game.walletValue('Stardust') < price.stardust }];
  for (const [good, n] of Object.entries(price.goods)) {
    terms.push({ icon: good as IconName, amount: formatExact(n ?? 0), short: block === 'NotEnoughMaterial' });
  }
  return el('div', { class: 'hd-skill-wrap' }, head, tray('hd-rank', next, buy(
    priceLine(terms),
    btn({
      label: 'Upgrade',
      kind: 'primary',
      onClick: () => game.doBuySkillRank(id),
      disabledReason: block === 'NotEnoughStardust' ? 'Not enough Stardust'
        : block === 'NotEnoughMaterial' ? `Not enough ${info.material}` : undefined,
    }),
  )));
}

function detail(game: Game, id: HeroId): HTMLElement {
  const def = HEROES[id];
  const view = rosterView(game.state).find((h) => h.id === id)!;
  const s = heroStats(game.state, id);
  const owned = view.owned;

  const statTile = (icon: 'atk' | 'dmg' | 'def' | 'hp', label: string, value: number) =>
    el('div', { class: 'hd-stat k-section' },
      iconEl(icon),
      el('div', { class: 'hd-stat-text' },
        el('span', { class: 'hd-stat-label' }, label),
        el('b', { class: 'hd-stat-value' }, formatExact(value))));

  // THE BOON, on the six that have one (Docs/proposals/legendary-boons.md):
  // the thing no Common or Rare has, on while the hero is owned.
  const boon = game.heroBoonText(id);

  return el('div', { class: 'hd' },
    el('div', { class: 'hd-subtitle' }, def.title),
    stage(game, def, id, owned),
    // AN UNOWNED HERO GETS THE SAME CARD. What the player is deciding is
    // whether to chase this one, and that is a question about its type, its
    // numbers and what it does.
    ...(owned ? [sectionHead('Ascension'), ascension(game, id, view)] : []),
    sectionHead('Stats'),
    el('div', { class: 'hd-stats' },
      statTile('atk', 'Attack', s.atk),
      statTile('dmg', 'Damage', s.dmg),
      statTile('def', 'Defence', s.def),
      statTile('hp', 'Health', s.hp)),
    sectionHead('Skill'),
    skill(game, id, owned),
    ...(boon !== null ? [sectionHead('Kingdom boon'),
      el('div', { class: 'hd-passive k-section is-boon' }, iconEl('crest'), boon)] : []),
    sectionHead(owned ? 'Level' : 'Fragments'),
    owned ? level(game, id, view) : fragments(game, id, view),
  );
}

export function renderHeroesSheet(game: Game): HTMLElement {
  // A hero the save no longer has cannot be open — the roster is fixed, but
  // a reset save is not, and a stale id would draw a card for nobody.
  if (game.openHeroId !== null && !(game.openHeroId in HEROES)) game.openHeroId = null;
  const open = game.openHeroId;
  if (open === null) {
    // The picker's frame (heroPicker.css `is-picker`, battle.css `is-board`):
    // the whole height, so the grid scrolls on its own and the button stays.
    const surface = sheet({ title: 'Heroes', onClose: () => game.dismiss(), tall: true }, grid(game));
    surface.classList.add('is-picker', 'is-board');
    return surface;
  }
  // The card's close goes back to the roster: it is a window opened over it.
  return sheet(
    {
      title: HEROES[open].name,
      onClose: () => { game.openHeroId = null; game.notify(); },
      centred: true,
    },
    detail(game, open),
  );
}
