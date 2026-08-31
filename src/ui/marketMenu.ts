// Market overlay: queue resources and they drip-sell for Gold, one unit per
// interval. Selling is ONE-WAY — queued units can't be taken back, only sold
// (or gem-rushed). An amount selector at the top decides what each row's
// Sell button queues. Below the rows: the live sale queue (next-unit timer,
// one card per queued resource) and the gem rush.

import { icon, type Game } from '../game';
import { CURRENCIES, MARKET } from '../sim/data/definitions';
import {
  nextSaleInSeconds, queuedGoldValue, queuedUnits, rushSaleCost, SELLABLE,
} from '../sim/market';
import { getWallet } from '../sim/state';
import { button, el } from './format';

// Module-level so the choice survives the per-tick re-render.
let sellAmount: number | 'All' = 1;
const AMOUNTS: Array<{ label: string; value: number | 'All' }> = [
  { label: 'x1', value: 1 },
  { label: 'x10', value: 10 },
  { label: 'x100', value: 100 },
  { label: 'x1.000', value: 1000 },
  { label: 'All', value: 'All' },
];

export function renderMarketMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  const queued = queuedUnits(game.state);
  const full = queued >= MARKET.capacity;
  menu.append(el('h2', {}, 'Market'));
  menu.append(el('p', { class: 'muted' },
    `Sells 1 unit every ${MARKET.sellIntervalSeconds}s, even while you are away. ` +
    'Once queued, goods cannot be taken back.'));

  // Order usage vs capacity.
  const capBar = el('div', { class: 'progress' },
    el('div', { class: 'fill' }),
    el('div', { class: 'label' }, `${queued}/${MARKET.capacity} capacity`));
  (capBar.querySelector('.fill') as HTMLElement).style.width =
    `${(queued / MARKET.capacity) * 100}%`;
  menu.append(capBar);

  // Amount selector: what each row's Sell button queues.
  const selector = el('div', { class: 'amount-row' }, el('span', { class: 'muted' }, 'Sell'));
  for (const a of AMOUNTS) {
    const b = button(a.label, () => {
      sellAmount = a.value;
      game.notify(); // re-render with the new selection
    }, sellAmount === a.value ? 'selected' : '');
    selector.append(b);
  }
  menu.append(selector);

  const list = el('div', { class: 'menu-list' });
  for (const c of SELLABLE) {
    const have = getWallet(game.state.city.wallet, c);
    const inQueue = getWallet(game.state.market.queue, c);
    const value = CURRENCIES[c].goldValue!;

    const amount = sellAmount === 'All' ? have : sellAmount;
    const sellBtn = button('Sell', () => game.doAddToSale(c, amount));
    sellBtn.disabled = have === 0 || amount === 0 || full;

    list.append(el('div', { class: 'menu-row' },
      el('span', { class: 'icon' }, icon(c)),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, `${c} — ${value} ${icon('Gold')} each`),
        el('div', { class: 'desc' }, `You have ${have} · selling ${inQueue}`)),
      el('div', { class: 'meta' }, sellBtn),
    ));
  }
  menu.append(list);

  // ------------------------------------------------ the live sale queue
  menu.append(el('h2', { style: 'margin-top:16px' }, 'Selling now'));
  if (queued === 0) {
    menu.append(el('p', { class: 'muted' }, 'Nothing queued — add resources above.'));
    return menu;
  }

  const now = game.now();
  const wait = nextSaleInSeconds(game.state, now)!;
  const progress = 1 - wait / MARKET.sellIntervalSeconds;
  const bar = el('div', { class: 'progress' },
    el('div', { class: 'fill' }),
    el('div', { class: 'label' }, `next unit in ${Math.ceil(wait)}s`));
  (bar.querySelector('.fill') as HTMLElement).style.width =
    `${Math.min(100, Math.max(0, progress * 100))}%`;
  menu.append(bar);

  // One card per queued resource, in sell order.
  const cards = el('div', { class: 'queue-cards' });
  for (const c of SELLABLE) {
    const n = getWallet(game.state.market.queue, c);
    if (n === 0) continue;
    cards.append(el('div', { class: 'queue-card' },
      el('span', { class: 'big' }, icon(c)),
      el('span', {}, `×${n}`),
      el('span', { class: 'muted' }, `${n * CURRENCIES[c].goldValue!} ${icon('Gold')}`)));
  }
  menu.append(cards);

  // Gem rush: sell the whole queue instantly.
  const rushBtn = button('Sell now', () => game.doRushSale());
  rushBtn.disabled = getWallet(game.state.player.wallet, 'Gems') < rushSaleCost(game.state, now);
  menu.append(el('div', { class: 'action-row' },
    el('span', { class: 'info' },
      `Sell everything now — ${rushSaleCost(game.state, now)} ${icon('Gems')} ` +
      `(+${queuedGoldValue(game.state)} ${icon('Gold')})`),
    rushBtn));
  return menu;
}
