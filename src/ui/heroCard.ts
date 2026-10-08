// A HERO AS A CARD, 2:3 — the one shape a hero takes wherever a screen offers
// it or seats it: the roster, the hero picker's list and slots, and the
// attack screen's hero slots.
//
// The card carries everything a choice turns on and nothing else:
//   the illustration, filling the card on its RARITY's colour;
//   what it fights as, as the unit's icon at the top left;
//   its level and its ascension stars at the foot;
//   its HP, on the small bar hung over the bottom edge — none when unhurt;
//   in a picker for a fight, its power in the level's place;
//   and, when it cannot be chosen, what it is doing — exhausted, the Zs
//   and how long the rest has left; away with an army, marching (a
//   stepping boot, the time to the end of the leg), camped in a dungeon, the
//   Portal or at a camp, ready (a flickering torch) or on guard in a
//   Fortress (a gleaming shield).
// No name: the face is the name.
//
// A hero NOT FOUND yet is the same card on warm stone: the figure a dark
// silhouette, and the fragments it has against the ten that recruit it in
// place of the level — a signpost, not a locked box.

import { HERO_ORDER, HEROES, type HeroRarity } from '../sim/data/definitions';
import { heroUnlockCost, skillRank } from '../sim/heroes';
import { tr } from '../i18n/tr';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { HeroId, UnitId } from '../sim/state';
import type { Game, HeroPickSort, HeroState } from '../game';
import { el, formatExact } from './format';
import { ascensionStars } from './ascensionStars';
import { heroFragmentIcon } from './heroFragment';
import { ctaBadge, delveMarks, guardMarks, hpBar, iconEl, marchMarks, progress, restLeft, restMarks, unitTypeIcon } from './kit';

/** A rarity as the player reads it. */
export const rarityLabel = (r: HeroRarity): string =>
  (r === 'Legendary' ? tr('Legendary') : r === 'Rare' ? tr('Rare') : tr('Common'));

/** A unit type as the player reads it. */
export const unitTypeLabel = (u: UnitId): string =>
  (u === 'Warrior' ? tr('Warrior') : u === 'Lancer' ? tr('Lancer') : u === 'Archer' ? tr('Archer') : tr('Cavalry'));

export interface HeroCardOpts {
  /** It is in a slot — the green check at the top right. */
  picked?: boolean;
  /** Smaller: a slot on a crowded board. */
  small?: boolean;
  /** Something can be done with this hero right now — the green orb. */
  cta?: boolean;
  /** Chosen for a fight: its power in the level's place. */
  power?: boolean;
  onClick?: () => void;
  label?: string;
}

export function heroCard(game: Game, heroId: HeroId, opts: HeroCardOpts = {}): HTMLElement {
  if (!game.state.heroes.owned.includes(heroId)) return missingCard(game, heroId, opts);
  const def = HEROES[heroId];
  const health = game.heroHealthOf(heroId);
  const doing = game.heroStateOf(heroId);
  const url = spriteUrl(def.sprite);
  const stars = ascensionStars(game.state.heroes.ascension[heroId] ?? 0, 'hc-stars');
  const rank = skillRank(game.state, heroId);
  const card = el(opts.onClick ? 'button' : 'span', {
    class: `hc is-${def.rarity.toLowerCase()}${opts.small ? ' is-small' : ''}`
      + `${opts.picked ? ' is-picked' : ''}${doing.kind === 'resting' ? ' is-resting' : ''}`,
    ...(opts.onClick ? { type: 'button' } : {}),
    'aria-label': opts.label ?? tr('{name}, level {level}', { name: def.name, level: game.heroLevelOf(heroId) }),
  },
  url ? spriteImgAt(url, 'hc-art') : el('span', { class: 'hc-art is-glyph' }, def.glyph),
  el('span', { class: 'hc-frame', 'aria-hidden': 'true' }),
  el('span', { class: `hc-type is-${def.unitType}` },
    iconEl(unitTypeIcon(def.unitType), { size: 'sm', label: unitTypeLabel(def.unitType) })),
  ...(doing.kind !== 'ready'
    ? awayMarks(game, doing)
    : [el('span', { class: 'hc-foot' },
      stars, opts.power
        ? el('span', { class: 'hc-level hc-power', 'aria-label': tr('Power {power}', { power: formatExact(game.heroPowerOf(heroId)) }) },
          iconEl('power', { size: 'sm' }), formatExact(game.heroPowerOf(heroId)))
        : el('span', { class: 'hc-level' }, tr('Lv {level}', { level: game.heroLevelOf(heroId) })))]),
  // Unhurt, no bar: it would only say "full".
  ...(health.hp >= health.max ? [] : [hpOf(health.hp, health.max, opts.small === true)]),
  // The skill's rank, once it has one past the first (10-heroes.md §2.5).
  ...(rank > 1 ? [el('span', { class: 'hc-rank', 'aria-label': tr('Skill rank {rank}', { rank }) }, ROMAN[rank] ?? String(rank))] : []),
  ...(opts.picked ? [el('span', { class: 'hc-check', 'aria-hidden': 'true' })] : []),
  ...(opts.cta ? [ctaBadge(1, `hero:${heroId}`)] : []));
  if (opts.onClick) card.addEventListener('click', opts.onClick);
  return card;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** What a hero who cannot be chosen is doing: its animated mark at the top
 *  right, and in the level's place how long it lasts or where it is. */
function awayMarks(game: Game, doing: Exclude<HeroState, { kind: 'ready' }>): HTMLElement[] {
  const pill = (text: string): HTMLElement => el('span', { class: 'hc-foot' }, el('span', { class: 'k-rest-left' }, text));
  switch (doing.kind) {
    case 'resting': return [restMarks(), el('span', { class: 'hc-foot' }, restLeft(doing.restMs))];
    case 'marching': return [marchMarks(), doing.at === null
      ? pill(tr('Marching'))
      : el('span', { class: 'hc-foot' }, restLeft(Math.max(0, doing.at - game.now())))];
    case 'camped': return [delveMarks(), pill(doing.where === 'camp' ? tr('Ready') : doing.where === 'portal' ? tr('Portal') : tr('Dungeon'))];
    case 'guarding': return [guardMarks(), pill(tr('On guard'))];
  }
}

/** A hero not found yet: stone, a silhouette, its fragments. */
function missingCard(game: Game, heroId: HeroId, opts: HeroCardOpts): HTMLElement {
  const def = HEROES[heroId];
  const url = spriteUrl(def.sprite);
  const have = game.state.heroes.fragments[heroId] ?? 0;
  const need = heroUnlockCost(heroId);
  const card = el(opts.onClick ? 'button' : 'span', {
    class: `hc is-missing${opts.small ? ' is-small' : ''}`,
    ...(opts.onClick ? { type: 'button' } : {}),
    'aria-label': opts.label ?? tr('{name}, not found, {have} of {need} fragments', { name: def.name, have, need }),
  },
  url ? spriteImgAt(url, 'hc-art') : el('span', { class: 'hc-art is-glyph' }, def.glyph),
  el('span', { class: 'hc-frame', 'aria-hidden': 'true' }),
  el('span', { class: `hc-type is-${def.unitType}` },
    iconEl(unitTypeIcon(def.unitType), { size: 'sm', label: unitTypeLabel(def.unitType) })),
  el('span', { class: 'hc-foot' },
    el('span', { class: `hc-level hc-frag${have >= need ? ' is-ready' : ''}` },
      heroFragmentIcon(heroId, { size: 'sm' }), `${formatExact(have)} / ${formatExact(need)}`)),
  ...(opts.cta ? [ctaBadge(1, `hero:${heroId}`)] : []));
  if (opts.onClick) card.addEventListener('click', opts.onClick);
  return card;
}

/** The unit types heroes fight as, in roster order — the filter's tabs. */
const heroTypes = (): UnitId[] => [...new Set(HERO_ORDER.map((h) => HEROES[h].unitType))];

/**
 * THE FILTER BAR over a list of heroes — All, one tab per unit type, and the
 * sort — shared by the roster and the picker. The game's wooden buttons; the
 * filter that is on stays pushed in (material.css `is-pressed`).
 */
export function heroFilterBar(opts: {
  filter: UnitId | 'All';
  sort: HeroPickSort;
  onFilter: (filter: UnitId | 'All') => void;
  onSort: () => void;
}): HTMLElement {
  const tab = (filter: UnitId | 'All'): HTMLElement => {
    const on = opts.filter === filter;
    const b = el('button', {
      class: `k-btn k-btn--secondary is-paint hp-tab${on ? ' is-pressed' : ''}`, type: 'button',
      'aria-pressed': on ? 'true' : 'false',
      'aria-label': filter === 'All' ? tr('All heroes') : tr('{type} heroes', { type: unitTypeLabel(filter) }),
    }, el('span', { class: 'k-btn-label' },
      filter === 'All' ? tr('All') : iconEl(unitTypeIcon(filter), { size: 'sm' })));
    b.addEventListener('click', () => opts.onFilter(filter));
    return b;
  };
  const sort = el('button', {
    class: 'k-btn k-btn--secondary is-paint hp-sort', type: 'button', 'aria-label': tr('Sort heroes'),
  }, el('span', { class: 'k-btn-label' },
    opts.sort === 'level' ? tr('Lv') : tr('Rarity'), el('span', { class: 'hp-sort-caret', 'aria-hidden': 'true' }, '▾')));
  sort.addEventListener('click', opts.onSort);
  return el('div', { class: 'hp-bar' },
    el('div', { class: 'hp-tabs', role: 'group', 'aria-label': tr('Filter by type') },
      tab('All'), ...heroTypes().map(tab)),
    sort);
}

/**
 * THE CARD'S HP, inside the frame over the foot, as in the mockup. On a full
 * card it is the game's own progress bar — at ~15 px tall it is the size that
 * bar was painted for; on a small one the bar is 7 px and the small bar drawn
 * for that size (kit `hpBar`) takes over, hung over the card's edge. Green;
 * gold under half; red under a tenth.
 */
function hpOf(hp: number, max: number, small: boolean): HTMLElement {
  if (small) return hpBar(hp, max);
  const share = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const bar = progress(share < 0.1 ? 'red' : share < 0.5 ? 'gold' : 'green');
  bar.set(share);
  bar.root.classList.add('hc-hp');
  bar.root.setAttribute('role', 'meter');
  bar.root.setAttribute('aria-label', tr('HP {hp} of {max}', { hp, max }));
  return bar.root;
}

/** An EMPTY card slot, sunk into the paper with a faint +. */
export function emptyHeroSlot(opts: { small?: boolean; onClick?: () => void; label?: string } = {}): HTMLElement {
  const slot = el(opts.onClick ? 'button' : 'span', {
    class: `hc is-empty${opts.small ? ' is-small' : ''}`,
    ...(opts.onClick ? { type: 'button' } : {}),
    'aria-label': opts.label ?? tr('Empty hero slot'),
  }, el('span', { class: 'hc-plus', 'aria-hidden': 'true' }, '+'));
  if (opts.onClick) slot.addEventListener('click', opts.onClick);
  return slot;
}
