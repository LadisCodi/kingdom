// Army overlay: unit list, owned counts, recruit (instant), power cap header.

import { armyPower, maxArmyPower } from '../sim/army';
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
    const trainBtn = button(`Train — ${formatCost(def.recruitCost)}`, () => game.doTrain(id));
    trainBtn.disabled = capBlocked;
    list.append(
      el('div', { class: 'menu-row' },
        el('span', { class: 'icon' }, def.glyph),
        el('div', { class: 'body' },
          el('div', { class: 'name' }, `${def.name} ×${owned}`),
          el('div', { class: 'desc' }, `Power ${def.power} · ${def.tags.join(', ')} — ${def.description}`)),
        el('div', { class: 'meta' }, trainBtn,
          capBlocked ? el('div', { class: 'blocked' }, 'At power cap') : ''),
      ),
    );
  }
  menu.append(list);
  return menu;
}
