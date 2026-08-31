// Top resource bar: currencies, population, builders, free workers.
// Shakes a currency when the player can't afford something.

import { icon, type Game } from '../game';
import { maxPopulation } from '../sim/population';
import type { CurrencyId } from '../sim/state';
import { el } from './format';

const SHOWN: CurrencyId[] = ['Silver', 'Wood', 'Food', 'Gems'];

export function mountHeader(game: Game, root: HTMLElement): void {
  const widgets = new Map<CurrencyId, HTMLElement>();
  for (const c of SHOWN) {
    const value = el('b', {}, '0');
    const w = el('span', { class: 'res', 'data-currency': c }, icon(c), value);
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
      w.querySelector('b')!.textContent = String(game.walletValue(c));
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
