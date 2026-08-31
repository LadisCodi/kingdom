// Top resource bar: currencies, population, builders, free workers.
// Shakes a currency when the player can't afford something. Currencies with
// equivalents (Food ← Berries/Meat) show the EFFECTIVE total — the number
// costs actually check — with a hover/tap tooltip breaking it down.

import { icon, type Game } from '../game';
import { CURRENCIES } from '../sim/data/definitions';
import { getWallet, type CurrencyId } from '../sim/state';
import { equivalentsOf } from '../sim/wallet';
import { maxPopulation } from '../sim/population';
import { el } from './format';

// Only PRIMARY currencies get a widget (flagged in the balance workbook's
// Currencies sheet); the rest surface through effective totals + tooltips.
const SHOWN = (Object.keys(CURRENCIES) as CurrencyId[]).filter((c) => CURRENCIES[c].primary);

export function mountHeader(game: Game, root: HTMLElement): void {
  const widgets = new Map<CurrencyId, HTMLElement>();
  const tooltips = new Map<CurrencyId, HTMLElement>();
  for (const c of SHOWN) {
    const value = el('b', {}, '0');
    const w = el('span', { class: 'res', 'data-currency': c }, icon(c), value);
    if (equivalentsOf(c).length > 0) {
      const tip = el('div', { class: 'tip' });
      w.append(tip);
      tooltips.set(c, tip);
      w.addEventListener('click', () => w.classList.toggle('open')); // touch has no hover
    }
    widgets.set(c, w);
    root.append(w);
  }
  const popW = el('b', {}, '');
  const buildersW = el('b', {}, '');
  const workersW = el('b', {}, '');
  root.append(
    el('span', { class: 'res', title: 'Population' }, '👥', popW),
    el('span', { class: 'res', title: 'Builders available' }, '👷', buildersW),
    el('span', { class: 'res', title: 'Free workers' }, '🧑‍🌾', workersW),
  );
  const cloudBadge = el('span', { id: 'cloud-badge' }, '');
  root.append(cloudBadge);

  game.onShake((currencies) => {
    for (const c of currencies) {
      const w = widgets.get(c);
      if (!w) continue;
      w.classList.remove('shake');
      void w.offsetWidth; // restart the animation
      w.classList.add('shake');
    }
  });

  const refresh = () => {
    for (const [c, w] of widgets) {
      w.querySelector('b')!.textContent = String(game.effectiveWalletValue(c));
    }
    // Breakdown tooltip, e.g. Food: base + each equivalent's contribution.
    for (const [c, tip] of tooltips) {
      const wallet = game.state.city.wallet;
      const rows = [
        el('div', { class: 'row' },
          el('span', {}, `${icon(c)} ${c}`), el('span', {}, String(getWallet(wallet, c)))),
        ...equivalentsOf(c).map((m) =>
          el('div', { class: 'row' },
            el('span', {}, `${icon(m.id)} ${getWallet(wallet, m.id)} × ${m.value}`),
            el('span', {}, String(getWallet(wallet, m.id) * m.value)))),
        el('div', { class: 'row total' },
          el('span', {}, 'Total'), el('span', {}, String(game.effectiveWalletValue(c)))),
      ];
      tip.replaceChildren(...rows);
    }
    popW.textContent = `${game.state.city.population}/${maxPopulation(game.state)}`;
    const max = game.state.kingdom.maxBuilders;
    const available = max - Math.min(game.state.city.queue.length, max);
    buildersW.textContent = `${available}/${max}`;
    workersW.textContent = String(game.freeWorkers());
  };
  game.onChange(refresh);
  refresh();
}

export const setCloudBadge = (text: string): void => {
  const badge = document.getElementById('cloud-badge');
  if (badge) badge.textContent = text;
};
