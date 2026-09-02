// The offer popup (Docs/features/ad-economy.md): "watch a short ad and
// collect".
//
// Two ways out and both are the same way out — the X on the plank and "No
// thanks" both just close it. The offer is only ever consumed by CLAIMING, so
// a mis-tap costs nothing and the tab is still on the map afterwards. That is
// what keeps the widget a standing invitation rather than a one-shot the
// player can lose by fumbling.

import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl, sheet } from './kit';

export function renderAdOfferSheet(game: Game): HTMLElement {
  const offer = game.adOffer();
  // The overlay outlives the offer for one frame after a claim; render an
  // empty shell rather than throwing.
  const reward = offer?.reward ?? 0;

  const body = el('div', { class: 'ad-offer' },
    el('div', { class: 'ad-offer-line' },
      el('span', { class: 'ad-offer-film' }, '▶'),
      el('div', { class: 'ad-offer-copy' },
        el('div', {}, 'Watch a short ad and collect:'),
        el('div', { class: 'ad-offer-prize' },
          iconEl('Mana', { size: 'lg' }),
          el('b', {}, String(reward)),
          el('span', { class: 'ad-offer-unit' }, 'Mana')))),

    // Say what it is FOR. A pool of Mana means nothing to a player who has not
    // yet joined it up with tapping.
    el('div', { class: 'ad-offer-note' },
      'Enough to fill your pool again — every tap is paid from it.'),

    el('div', { class: 'ad-offer-actions' },
      btn({
        label: 'No thanks',
        kind: 'destructive',
        onClick: () => game.declineAdOffer(),
      }),
      btn({
        label: 'Watch',
        kind: 'gem',
        onClick: () => game.startAdWatch(),
      })),
  );

  return sheet({ title: 'Free Reward!', onClose: () => game.declineAdOffer() }, body);
}
