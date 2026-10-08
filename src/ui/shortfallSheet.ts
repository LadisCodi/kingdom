// Short of something (Docs/art/ui-inventory.md §3.9): a build, an upgrade or
// a training refused for a coin the Bag holds chests of. Its chests of that
// coin, smallest first, each with what it is worth now and a Use; the
// shortfall line moves after each, and the moment it is met the sheet closes
// and what was asked for starts.

import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { btn, currencyIcon, sheet } from './kit';
import { tileArt } from './itemArt';
import { tr } from '../i18n/tr';
import type { CurrencyId } from '../sim/state';

/** A coin's name, as the sheet says it. */
const coinWord = (c: CurrencyId): string => ({
  Gold: tr('Gold'), Food: tr('Food'), Wood: tr('Wood'), Stone: tr('Stone'),
  Mana: tr('Mana'), Gems: tr('Gems'), Knowledge: tr('Knowledge'),
} as Partial<Record<CurrencyId, string>>)[c] ?? c;

export function renderShortfallSheet(game: Game): HTMLElement {
  const view = game.shortfallScreen();
  const close = () => game.closeShortfall();
  if (view === null) return sheet({ title: tr('Not enough'), onClose: close, centred: true });
  const rows = view.chests.map((c) => el('div', { class: 'spd-row' },
    el('div', { class: `bag-tile spd-tile is-tier-${c.def.tier}` },
      ...tileArt(c.id, formatDuration(c.def.seconds)),
      el('span', { class: 'bag-tile-count' }, formatExact(c.count))),
    el('div', { class: 'spd-row-name' },
      `${formatExact(c.worth[view.coin] ?? 0)} `, currencyIcon(view.coin, { size: 'sm' })),
    btn({ label: tr('Use'), kind: 'primary', onClick: () => game.doShortfallChest(c.id) })));
  return sheet({ title: tr('Not enough {coin}', { coin: coinWord(view.coin) }), onClose: close, centred: true },
    el('p', { class: 'sf-line' }, tr('{what}: needs {need} · you have {have}', {
      what: view.title, need: formatExact(view.need), have: formatExact(view.have),
    })),
    ...(rows.length > 0 ? [el('div', { class: 'spd-rows' }, ...rows)] : [
      // No chest of it in the Bag: one line, and the existing way to get one
      // — the store's bundles. Never a Gem price for a coin.
      el('p', { class: 'spd-none' }, tr('No chests of {coin} in the Bag', { coin: coinWord(view.coin) })),
      el('div', { class: 'spd-finish' }, btn({ label: tr('Store'), icon: 'shop', onClick: () => game.openStore('supplies') })),
    ]));
}
