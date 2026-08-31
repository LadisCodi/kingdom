// Full-screen build menu: one row per buildable district (Docs/09).

import { canAfford } from '../sim/commands';
import { CITY_DEF, DISTRICTS, TECHNOLOGIES } from '../sim/data/definitions';
import { buildCost, buildDuration, districtCount, maxCountForTownhallLevel } from '../sim/districts';
import { isTechComplete } from '../sim/research';
import { townhall } from '../sim/state';
import type { Game } from '../game';
import { button, el, formatCost, formatDuration } from './format';

export function renderBuildMenu(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Build'));
  const list = el('div', { class: 'menu-list' });
  const thLevel = townhall(game.state).level;

  for (const id of CITY_DEF.buildMenuOrder) {
    const def = DISTRICTS[id];
    const count = districtCount(game.state, id);
    const maxCount = maxCountForTownhallLevel(def, thLevel);
    const capped = count >= maxCount;
    // Exact cost (no distance term); time shown indicatively at distance 0.
    const cost = buildCost(id, count);
    const affordable = canAfford(game.state.city.wallet, cost);

    const lockedByResearch =
      def.requiredTech !== null && !isTechComplete(game.state, def.requiredTech);

    // When locked/capped, say what unlocks it.
    let blockedMsg = '';
    if (lockedByResearch) {
      blockedMsg = `🔒 ${TECHNOLOGIES[def.requiredTech!].name} research`;
    } else if (capped) {
      const list = def.maxCountPerTownhallLevel;
      const nextLevel = list.findIndex((n) => n > count) + 1;
      blockedMsg = nextLevel > 0 ? `Townhall lvl ${nextLevel} required` : 'Maxed out';
    }

    const selectBtn = button('Select', () => game.startPlacement(id));
    selectBtn.disabled = capped || lockedByResearch;
    const row = el(
      'div',
      { class: `menu-row${capped || lockedByResearch || !affordable ? ' disabled' : ''}` },
      el('span', { class: 'icon' }, def.glyph),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, def.name),
        el('div', { class: 'desc' }, def.description),
        el('div', { class: affordable ? 'desc' : 'blocked' },
          `${formatCost(cost)} · ⏱ ${formatDuration(buildDuration(id, count, 0))}`),
      ),
      el('div', { class: 'meta' },
        selectBtn,
        el('div', { class: capped || lockedByResearch ? 'blocked' : 'muted' },
          blockedMsg || `${count}/${maxCount === Infinity ? '∞' : maxCount}`),
      ),
    );
    list.append(row);
  }
  menu.append(list);
  return menu;
}
