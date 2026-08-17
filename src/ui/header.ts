// Top resource bar: currencies, Mana bar with regen countdown, population,
// builders, free workers. Shakes a currency when the player can't afford something.

import { icon, type Game } from '../game';
import { CURRENCIES, KINGDOM_DEF } from '../sim/data/definitions';
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
  const manaFill = el('div', { class: 'fill' });
  const manaLabel = el('div', { class: 'label' }, '');
  root.append(
    el('span', { class: 'res' }, icon('Mana'), el('div', { class: 'manabar' }, manaFill, manaLabel)),
  );
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
    const mana = game.walletValue('Mana');
    const manaCap = CURRENCIES.Mana.cap ?? 100;
    manaFill.style.width = `${(mana / manaCap) * 100}%`;
    // Regen countdown: Mana ticks 5/min → +1 every 12 s, from the trickle timestamp.
    let regen = '';
    if (mana < manaCap) {
      const rate = KINGDOM_DEF.manaPerHour / 60; // per minute
      const elapsed = (game.now() - game.state.kingdom.manaLastProduction) / 1000;
      const secsPerUnit = 60 / rate;
      const wait = Math.max(1, Math.ceil(secsPerUnit - (elapsed % secsPerUnit)));
      regen = ` (+1 in ${wait}s)`;
    }
    manaLabel.textContent = `${mana}/${manaCap}${regen}`;
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
