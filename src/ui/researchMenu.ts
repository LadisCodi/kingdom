// Research overlay: one row per research — done ✓ / in progress (bar) /
// available ([description + cost | Research]), following the action-row split.

import { canAfford } from '../sim/commands';
import { RESEARCH, RESEARCH_ORDER } from '../sim/data/definitions';
import { isResearched, researchCompletesAt } from '../sim/research';
import type { Game } from '../game';
import { button, el, formatCost, formatDuration } from './format';

export function renderResearchMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Research'));
  const list = el('div', { class: 'menu-list' });
  const now = game.now();

  for (const id of RESEARCH_ORDER) {
    const def = RESEARCH[id];
    const done = isResearched(game.state, id);
    const active = game.state.research.active?.id === id;
    const affordable = canAfford(game.state.city.wallet, def.cost);

    const body = el('div', { class: 'body' },
      el('div', { class: 'name' }, def.name, done ? ' ✓' : ''),
      el('div', { class: 'desc' }, def.description));
    const meta = el('div', { class: 'meta' });

    if (done) {
      meta.append(el('div', { class: 'muted' }, 'Researched'));
    } else if (active) {
      const completesAt = researchCompletesAt(game.state)!;
      const total = def.durationSeconds * 1000;
      const progress = Math.min(1, Math.max(0, 1 - (completesAt - now) / total));
      const bar = el('div', { class: 'progress', style: 'width:120px' },
        el('div', { class: 'fill' }),
        el('div', { class: 'label' }, `${formatDuration((completesAt - now) / 1000)} left`));
      (bar.querySelector('.fill') as HTMLElement).style.width = `${progress * 100}%`;
      meta.append(bar);
    } else {
      body.append(el('div', { class: affordable ? 'desc' : 'blocked' },
        `${formatCost(def.cost)} · ⏱ ${formatDuration(def.durationSeconds)}`));
      const researchBtn = button('Research', () => game.doResearch(id));
      researchBtn.disabled = !affordable || game.state.research.active !== null;
      meta.append(researchBtn);
    }

    list.append(el('div', { class: `menu-row${done ? ' disabled' : ''}` },
      el('span', { class: 'icon' }, def.glyph), body, meta));
  }
  menu.append(list);
  return menu;
}
