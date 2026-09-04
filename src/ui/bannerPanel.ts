// The hero banner — the gacha, drawn on the store (Docs/features/14-monetization.md
// §2.1). It lived on the Reliquary's heroes tab until 2026-09-04; the roster
// stayed there and now points here, because a call for aid is a purchase and
// the store is where purchases are made and measured.
//
// The pity counter is ALWAYS visible. A hidden pity counter is the same as no
// pity counter — it is the single thing that makes a gacha read as fair rather
// than predatory, and it only works if the player can see it working.

import type { Game } from '../game';
import { heroChanceAt, pityCount, pullCost, pullsToGuarantee, STANDARD_BANNER } from '../sim/heroes';
import { el } from './format';
import { action, iconEl } from './kit';

export function bannerPanel(game: Game): HTMLElement {
  const cost = pullCost(game.state, STANDARD_BANNER);
  const pity = pityCount(game.state, STANDARD_BANNER);
  const toGuarantee = pullsToGuarantee(game.state, STANDARD_BANNER);
  const chance = heroChanceAt(pity);

  return el('div', { class: 'store-banner' },
    el('div', { class: 'store-banner-head' },
      iconEl('star', { size: 'lg' }),
      el('div', {},
        el('div', { class: 'store-banner-title' }, 'Call for aid'),
        el('div', { class: 'store-banner-hint' },
          'Every miss still pays fragments. There are no wasted calls.'))),
    el('div', { class: 'rel-breakdown' },
      el('div', { class: 'rel-line' },
        el('span', {}, 'Chance of a hero right now'),
        el('b', {}, `${Math.round(chance * 100)}%`)),
      el('div', { class: 'rel-line is-total' },
        el('span', {}, 'Guaranteed within'),
        el('b', {}, `${toGuarantee} call${toGuarantee === 1 ? '' : 's'}`))),
    callAction(game, cost),
    el('div', { class: 'rel-note' },
      'Heroes can also be found by delving: fragments come back from every ruin, '
      + 'and enough of them raise anyone you already have.'),
  );
}

/** The summon button, split out so the quest hint can light it — `action()`
 *  builds a whole row, so the class goes on afterwards rather than through a
 *  new option nothing else would use. */
function callAction(game: Game, cost: number): HTMLElement {
  const row = action({
    // A price of zero is not a price. The free first call says so on the
    // button rather than rendering "0 💎", which reads as a bug.
    label: cost === 0 ? 'Call — free' : 'Call',
    kind: 'gem',
    onClick: () => game.doPull(),
    cost: cost === 0 ? undefined : { Gems: cost },
    have: (c) => game.walletValue(c),
  });
  if (game.uiHint() === 'banner') row.classList.add('hinted');
  return row;
}
