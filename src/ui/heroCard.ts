// A HERO AS A CARD, 2:3 — the one shape a hero takes wherever a screen offers
// it or seats it: the hero picker's list and slots, and the attack screen's
// hero slots.
//
// The card carries everything a choice turns on and nothing else:
//   the illustration, filling the card on its RARITY's colour;
//   what it fights as, as the unit's icon at the top left;
//   its level and its ascension stars at the foot;
//   its HP, on the small bar hung over the bottom edge;
//   and, exhausted, the Zs and how long the rest has left.
// No name: the face is the name.

import { COLLECTION, HEROES } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { HeroId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { hpBar, iconEl, restLeft, restMarks, unitTypeIcon } from './kit';

export interface HeroCardOpts {
  /** It is in a slot — the green check at the top right. */
  picked?: boolean;
  /** Smaller: a slot on a crowded board. */
  small?: boolean;
  onClick?: () => void;
  label?: string;
}

export function heroCard(game: Game, heroId: HeroId, opts: HeroCardOpts = {}): HTMLElement {
  const def = HEROES[heroId];
  const health = game.heroHealthOf(heroId);
  const tier = game.state.heroes.tiers[heroId] ?? 1;
  const url = spriteUrl(def.sprite);
  const stars = el('span', { class: 'hc-stars' });
  for (let i = 0; i < COLLECTION.maxTier; i++) {
    stars.append(iconEl('ascension', { size: 'sm', locked: i >= tier, label: 'ascension' }));
  }
  const card = el(opts.onClick ? 'button' : 'span', {
    class: `hc is-${def.rarity.toLowerCase()}${opts.small ? ' is-small' : ''}`
      + `${opts.picked ? ' is-picked' : ''}${health.exhausted ? ' is-resting' : ''}`,
    ...(opts.onClick ? { type: 'button' } : {}),
    'aria-label': opts.label ?? `${def.name}, level ${game.heroLevelOf(heroId)}`,
  },
  url ? spriteImgAt(url, 'hc-art') : el('span', { class: 'hc-art is-glyph' }, def.glyph),
  el('span', { class: 'hc-frame', 'aria-hidden': 'true' }),
  el('span', { class: `hc-type is-${def.unitType}` },
    iconEl(unitTypeIcon(def.unitType), { size: 'sm', label: def.unitType })),
  ...(health.exhausted
    ? [restMarks(), el('span', { class: 'hc-foot' }, restLeft(health.restMs))]
    : [el('span', { class: 'hc-foot' },
      stars, el('span', { class: 'hc-level' }, `Lv ${game.heroLevelOf(heroId)}`))]),
  hpBar(health.hp, health.max),
  ...(opts.picked ? [el('span', { class: 'hc-check', 'aria-hidden': 'true' })] : []));
  if (opts.onClick) card.addEventListener('click', opts.onClick);
  return card;
}

/** An EMPTY card slot, sunk into the paper with a faint +. */
export function emptyHeroSlot(opts: { small?: boolean; onClick?: () => void; label?: string } = {}): HTMLElement {
  const slot = el(opts.onClick ? 'button' : 'span', {
    class: `hc is-empty${opts.small ? ' is-small' : ''}`,
    ...(opts.onClick ? { type: 'button' } : {}),
    'aria-label': opts.label ?? 'Empty hero slot',
  }, el('span', { class: 'hc-plus', 'aria-hidden': 'true' }, '+'));
  if (opts.onClick) slot.addEventListener('click', opts.onClick);
  return slot;
}
