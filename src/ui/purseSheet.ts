// The purse: the whole wallet, and how the food-valued goods add up.
//
// This was a hover tooltip hanging off the Food counter — invisible on
// touch, and the only place the game ever explained that berries, meat and
// fish ARE food. Promoted to a sheet it can be reached deliberately, which
// is also what lets the HUD drop to three coins without hiding anything.

import type { Game } from '../game';
import { CURRENCIES } from '../sim/data/definitions';
import { getWallet, type CurrencyId } from '../sim/state';
import { equivalentsOf } from '../sim/wallet';
import { el } from './format';
import { currencyIcon, sheet } from './kit';

/** Currencies worth a row: the city's goods, plus the player's gems. */
const PURSE_ORDER = (Object.keys(CURRENCIES) as CurrencyId[]);

export function renderPurseSheet(game: Game): HTMLElement {
  const rows = el('div', { class: 'purse' });

  for (const c of PURSE_ORDER) {
    const held = c === 'Gems' || c === 'Knowledge'
      ? game.effectiveWalletValue(c)
      : getWallet(game.state.city.wallet, c);
    const equivalents = equivalentsOf(c);
    // A currency nobody has and nothing feeds into is noise.
    if (held === 0 && equivalents.length === 0) continue;

    const row = el(
      'div',
      { class: 'purse-row' },
      currencyIcon(c),
      el('span', { class: 'purse-name' }, c),
      el('span', { class: 'purse-value' }, String(held)),
    );
    rows.append(row);

    // Food's breakdown: what each equivalent contributes, and the total the
    // costs actually check against.
    if (equivalents.length > 0) {
      for (const m of equivalents) {
        const n = getWallet(game.state.city.wallet, m.id);
        if (n === 0) continue;
        rows.append(el(
          'div',
          { class: 'purse-row is-sub' },
          currencyIcon(m.id, { size: 'sm' }),
          el('span', { class: 'purse-name' }, `${n} × ${m.value}`),
          el('span', { class: 'purse-value' }, String(n * m.value)),
        ));
      }
      rows.append(el(
        'div',
        { class: 'purse-row is-total' },
        el('span', { class: 'purse-name' }, `Counts as ${c}`),
        el('span', { class: 'purse-value' }, String(game.effectiveWalletValue(c))),
      ));
    }
  }

  return sheet({ title: 'Your purse', onClose: () => game.dismiss() }, rows);
}
