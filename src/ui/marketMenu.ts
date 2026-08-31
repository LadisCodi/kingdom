// Market overlay: queue resources and they drip-sell for Gold, one unit per
// interval. No confirm step — queueing IS selling; unsold units can be
// withdrawn with −. Rows follow the worker-± stepper pattern.

import { icon, type Game } from '../game';
import { CURRENCIES, MARKET } from '../sim/data/definitions';
import { queuedGoldValue, queuedUnits, SELLABLE } from '../sim/market';
import { getWallet } from '../sim/state';
import { button, el } from './format';

export function renderMarketMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  const queued = queuedUnits(game.state);
  menu.append(el('h2', {}, `Market — ${queued}/${MARKET.capacity}`));
  menu.append(el('p', { class: 'muted' },
    `Sells 1 unit every ${MARKET.sellIntervalSeconds}s, even while you are away. ` +
    `Queued goods are worth ${queuedGoldValue(game.state)} ${icon('Gold')}.`));

  const list = el('div', { class: 'menu-list' });
  for (const c of SELLABLE) {
    const have = getWallet(game.state.city.wallet, c);
    const inQueue = getWallet(game.state.market.queue, c);
    const value = CURRENCIES[c].goldValue!;

    const minus = button('−', () => game.doRemoveFromSale(c, 1));
    minus.disabled = inQueue === 0;
    const plus = button('+', () => game.doAddToSale(c, 1));
    plus.disabled = have === 0 || queued >= MARKET.capacity;
    const plusTen = button('+10', () => game.doAddToSale(c, 10));
    plusTen.disabled = have === 0 || queued >= MARKET.capacity;

    list.append(el('div', { class: 'menu-row' },
      el('span', { class: 'icon' }, icon(c)),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, `${c} — ${value} ${icon('Gold')} each`),
        el('div', { class: 'desc' }, `You have ${have} · selling ${inQueue}`)),
      el('div', { class: 'meta' }, minus, ` ${inQueue} `, plus, plusTen),
    ));
  }
  menu.append(list);
  return menu;
}
