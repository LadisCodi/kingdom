// Army overlay: unit list, owned counts, recruit (instant), power cap header.

import { armyPower, maxArmyPower } from '../sim/army';
import { TECHNOLOGIES } from '../sim/data/definitions';
import { isTechComplete } from '../sim/research';
import { UNITS, UNIT_ORDER } from '../sim/data/definitions';
import type { Game } from '../game';
import { button, el, formatCost } from './format';

export function renderArmyMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  const power = armyPower(game.state);
  const max = maxArmyPower(game.state);
  menu.append(el('h2', {}, `Army — Power ${power}/${max}`));
  const list = el('div', { class: 'menu-list' });
  for (const id of UNIT_ORDER) {
    const def = UNITS[id];
    const owned = game.state.army.filter((u) => u.definitionId === id).length;
    const capBlocked = power + def.power > max;
    const techLocked =
      def.requiredTech !== null && !isTechComplete(game.state, def.requiredTech);
    const trainBtn = button('Train', () => game.doTrain(id));
    trainBtn.disabled = capBlocked || techLocked;
    const statusLine = techLocked
      ? el('div', { class: 'blocked' }, `🔒 ${TECHNOLOGIES[def.requiredTech!].name} research`)
      : el('div', { class: capBlocked ? 'blocked' : 'desc' },
          capBlocked ? 'At power cap' : formatCost(def.recruitCost));
    list.append(
      el('div', { class: `menu-row${techLocked ? ' disabled' : ''}` },
        el('span', { class: 'icon' }, def.glyph),
        el('div', { class: 'body' },
          el('div', { class: 'name' }, `${def.name} ×${owned}`),
          el('div', { class: 'desc' }, `Power ${def.power} · ${def.tags.join(', ')} — ${def.description}`),
          statusLine),
        el('div', { class: 'meta' }, trainBtn),
      ),
    );
  }
  menu.append(list);
  return menu;
}
