// Discovery banner: when something NEW enters the game for the first time
// (a resource collected for the first time), a card slides in at the top for
// 5 seconds — title, icon, name, one-line description — with the discovery
// chime. Banners queue and show one at a time.

import { playSfx } from '../audio/sfx';
import { icon, type Game } from '../game';
import { CURRENCIES } from '../sim/data/definitions';
import type { CurrencyId } from '../sim/state';
import { el } from './format';

const SHOW_MS = 5000;
const LEAVE_MS = 300;

/** One-liner for a freshly discovered resource ("1 Food", "Sells for 3 🪙"). */
function resourceBlurb(currency: CurrencyId): string {
  const def = CURRENCIES[currency];
  if (def.countsAs) {
    return `${def.countsAs.value} ${def.countsAs.currency}`;
  }
  if (currency === 'Gold') return 'Pays for everything';
  if (def.goldValue !== null) return `Sells for ${def.goldValue} ${icon('Gold')}`;
  return '';
}

export function mountDiscoveryBanner(game: Game, root: HTMLElement): void {
  let showing = false;

  const showNext = () => {
    if (showing) return;
    const key = game.takeDiscovery();
    if (key === null) return;
    const [kind, id] = key.split(':');
    if (kind !== 'resource') return showNext(); // future kinds slot in here
    const currency = id as CurrencyId;

    showing = true;
    playSfx('discovery');
    const card = el('div', { class: 'notice-card' },
      el('span', { class: 'big' }, icon(currency)),
      el('div', {},
        el('div', { class: 'title' }, 'New resource discovered!'),
        el('div', { class: 'name' }, currency),
        el('div', { class: 'desc' }, resourceBlurb(currency))));
    root.replaceChildren(card);
    setTimeout(() => {
      card.classList.add('leaving');
      setTimeout(() => {
        if (card.parentElement === root) root.replaceChildren();
        showing = false;
        showNext(); // anything queued behind gets its 5 seconds
      }, LEAVE_MS);
    }, SHOW_MS);
  };

  game.onChange(showNext);
  showNext();
}
