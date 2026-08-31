// Market trade screen (opened by tapping the built Market district):
// pick an amount, sell instantly for Gold. MarketStall upgrades raise the
// prices; taxes remain the city's idle income — this is the surplus outlet.

import { icon, type Game } from '../game';
import { SELLABLE } from '../sim/market';
import { effectiveSalePriceMultiplier } from '../sim/upgrades';
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
  menu.append(el('h2', {}, 'Market'));
  const bonus = Math.round((effectiveSalePriceMultiplier(game.state) - 1) * 100);
  menu.append(el('p', { class: 'muted' },
    'Trade surplus goods for Gold — sales are instant.' +
    (bonus > 0 ? ` Market Stall bonus: +${bonus}% prices.` : '')));

  // Amount selector: what each row's Sell button trades.
  const selector = el('div', { class: 'amount-row' }, el('span', { class: 'muted' }, 'Sell'));
  for (const a of AMOUNTS) {
    selector.append(button(a.label, () => {
      sellAmount = a.value;
      game.notify(); // re-render with the new selection
    }, sellAmount === a.value ? 'selected' : ''));
  }
  menu.append(selector);

  const list = el('div', { class: 'menu-list' });
  for (const c of SELLABLE) {
    const have = getWallet(game.state.city.wallet, c);
    const amount = Math.min(sellAmount === 'All' ? have : sellAmount, have);
    const payout = game.marketPayout(c, amount);

    const sellBtn = button('Sell', () => game.doSell(c, amount));
    sellBtn.disabled = amount === 0;

    list.append(el('div', { class: `menu-row${have === 0 ? ' disabled' : ''}` },
      el('span', { class: 'icon' }, icon(c)),
      el('div', { class: 'body' },
        el('div', { class: 'name' },
          `${c} — ${game.marketPayout(c, 1)} ${icon('Gold')} each`),
        el('div', { class: 'desc' },
          `You have ${have}` +
          (amount > 0 ? ` · selling ${amount} pays ${payout} ${icon('Gold')}` : ''))),
      el('div', { class: 'meta' }, sellBtn),
    ));
  }
  menu.append(list);
  return menu;
}
