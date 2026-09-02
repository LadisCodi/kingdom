// The Market (§5.8) — a stall, not a table.
//
// The old screen was legible and completely inert: a title, a sentence, five
// rows. The Market Stall bonus — a thing the player bought — was a
// parenthetical, and the payout, which is the whole reason to be here, was
// buried in a 12px grey line.

import type { Game } from '../game';
import { SELLABLE } from '../sim/market';
import { spriteUrl } from '../render/sprites';
import { effectiveSalePriceMultiplier } from '../sim/upgrades';
import { getWallet } from '../sim/state';
import { el } from './format';
import { btn, currencyIcon, iconEl, sheet, toggleGroup } from './kit';

// Module-level so the choice survives the per-tick re-render. This goes away
// when the screen sheds legacy() for a mounted widget.
let sellAmount: number | 'All' = 1;
const AMOUNTS: ReadonlyArray<{ label: string; value: number | 'All' }> = [
  { label: 'x1', value: 1 },
  { label: 'x10', value: 10 },
  { label: 'x100', value: 100 },
  { label: 'x1,000', value: 1000 },
  { label: 'All', value: 'All' },
];

export function renderMarketMenu(game: Game): HTMLElement {
  let hintUsed = false; // arrow only the FIRST sellable crate
  const bonus = Math.round((effectiveSalePriceMultiplier(game.state) - 1) * 100);

  const crates = SELLABLE.map((c) => {
    const have = getWallet(game.state.city.wallet, c);
    const amount = Math.min(sellAmount === 'All' ? have : sellAmount, have);
    const payout = game.marketPayout(c, amount);
    const unit = game.marketPayout(c, 1);
    const art = spriteUrl(`${c.toLowerCase()}`);

    const sell = btn({
      label: 'Sell',
      kind: 'primary',
      onClick: () => game.doSell(c, amount),
      disabledReason: have === 0 ? `No ${c} to sell` : undefined,
    });
    const hinted = game.uiHint() === 'market' && amount > 0 && !hintUsed;
    if (hinted) {
      hintUsed = true;
      sell.classList.add('hinted');
    }

    return el('div', { class: `mkt-crate${have === 0 ? ' is-empty' : ''}` },
      el('div', { class: 'mkt-goods' }, art
        ? el('img', { src: art, alt: '' })
        : currencyIcon(c, { size: 'lg' })),
      // The price tag hangs off the crate, as a stall's would.
      el('div', { class: 'mkt-tag' }, currencyIcon('Gold', { size: 'sm' }), `${unit} each`),
      el('div', { class: 'mkt-have' }, `you have ${have}`),
      // The payout is the loud part: it is why anyone is on this screen.
      el('div', { class: 'mkt-payout' },
        el('span', { class: 'mkt-arrow' }, '+'),
        el('b', {}, String(payout)),
        currencyIcon('Gold', { size: 'sm' })),
      sell);
  });

  const body = el('div', {},
    el('div', { class: 'mkt-awning' }),
    ...(bonus > 0
      ? [el('div', { class: 'mkt-bonus' },
          iconEl('Market', { size: 'sm' }), `Market Stall: +${bonus}% prices`)]
      : []),
    el('p', { class: 'mkt-blurb' }, 'Trade surplus goods for Gold — sales are instant.'),
    el('div', { class: 'mkt-amounts' },
      el('span', { class: 'mkt-amount-label' }, 'Sell'),
      toggleGroup(AMOUNTS, sellAmount, (v) => {
        sellAmount = v;
        game.notify(); // re-render with the new selection
      })),
    el('div', { class: 'mkt-grid' }, ...crates),
  );

  return sheet({ title: 'Market', onClose: () => game.dismiss() }, body);
}
