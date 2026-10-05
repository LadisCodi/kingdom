// Short of something (Docs/art/ui-inventory.md §3.9): a build, an upgrade or
// a training refused for a coin the Bag holds chests of. Its chests of that
// coin, smallest first, each with what it is worth now and a Use; the
// shortfall line moves after each, and the moment it is met the sheet closes
// and what was asked for starts.

import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { btn, currencyIcon, sheet } from './kit';
import { tileArt } from './bagSheet';

export function renderShortfallSheet(game: Game): HTMLElement {
  const view = game.shortfallScreen();
  const close = () => game.closeShortfall();
  if (view === null) return sheet({ title: 'Not enough', onClose: close, centred: true });
  const rows = view.chests.map((c) => el('div', { class: 'spd-row' },
    el('div', { class: `bag-tile spd-tile is-tier-${c.def.tier}` },
      el('span', { class: 'bag-tile-size' }, formatDuration(c.def.seconds)),
      ...tileArt(c.id),
      el('span', { class: 'bag-tile-count' }, formatExact(c.count))),
    el('div', { class: 'spd-row-name' },
      `${formatExact(c.worth[view.coin] ?? 0)} `, currencyIcon(view.coin, { size: 'sm' })),
    btn({ label: 'Use', kind: 'primary', onClick: () => game.doShortfallChest(c.id) })));
  return sheet({ title: `Not enough ${view.coin}`, onClose: close, centred: true },
    el('p', { class: 'sf-line' }, `${view.title}: needs ${formatExact(view.need)} · you have ${formatExact(view.have)}`),
    ...(rows.length > 0 ? [el('div', { class: 'spd-rows' }, ...rows)] : [
      // No chest of it in the Bag: one line, and the existing way to get one
      // — the store's bundles. Never a Gem price for a coin.
      el('p', { class: 'spd-none' }, `No chests of ${view.coin} in the Bag`),
      el('div', { class: 'spd-finish' }, btn({ label: 'Store', icon: 'shop', onClick: () => game.setOverlay('store') })),
    ]));
}
