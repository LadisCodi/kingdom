// The purse: the whole wallet, in one place.
//
// This was a hover tooltip hanging off the Food counter — invisible on touch,
// and the only place the game ever explained that berries, meat and fish ARE
// food. It no longer has to explain that: bushes, game and shoals pay Food
// directly now, so a purse row is a purse row. What the sheet is still for is
// letting the HUD show three coins without hiding anything, and giving
// Knowledge somewhere to be read outside the Reliquary.

import type { Game } from '../game';
import { CURRENCIES } from '../sim/data/definitions';
import { type CurrencyId } from '../sim/state';
import { el } from './format';
import { currencyIcon, sheet } from './kit';

/** Currencies worth a row: the city's goods, the kingdom's Knowledge, the
 *  player's Gems.
 *
 *  Mana is excluded deliberately. It is the one capped currency, so a bare
 *  number here would be a worse version of the header gauge — and everything
 *  worth knowing about it (the ceiling, the production) lives in the
 *  Reliquary, which is one tap from the same gauge. */
const PURSE_ORDER = (Object.keys(CURRENCIES) as CurrencyId[]).filter((c) => c !== 'Mana');

export function renderPurseSheet(game: Game): HTMLElement {
  const rows = el('div', { class: 'purse' });

  for (const c of PURSE_ORDER) {
    const held = game.walletValue(c);
    // A currency nobody has yet is noise. Knowledge in particular: it does
    // not exist until the first dungeon is cleared, and a zero row would
    // advertise a system the player has not met.
    if (held === 0) continue;

    rows.append(el(
      'div',
      { class: 'purse-row' },
      currencyIcon(c),
      el('span', { class: 'purse-name' }, c),
      el('span', { class: 'purse-value' }, String(held)),
    ));
  }

  return sheet({ title: 'Your purse', onClose: () => game.dismiss() }, rows);
}
