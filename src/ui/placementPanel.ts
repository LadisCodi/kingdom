// Bottom panel while placing a district: exact cost & duration for the
// selected cell, ghost preview on the map, Build (the navbar Close cancels).

import { DISTRICTS } from '../sim/data/definitions';
import type { Game } from '../game';
import { button, el, formatCost, formatDuration } from './format';

export function renderPlacementPanel(game: Game): HTMLElement {
  const info = game.placementInfo()!;
  const def = DISTRICTS[info.definitionId];
  const panel = el('div', {});
  panel.append(el('h3', {}, `${def.glyph} Place ${def.name}`));
  panel.append(el('div', { class: 'muted' }, def.description));

  if (info.cell === null) {
    panel.append(el('div', { class: 'blocked' }, 'No valid cell available.'));
  } else {
    const rows = el('div', { class: 'rows' });
    rows.append(
      el('div', { class: 'row' }, el('span', {}, 'Cost'),
        el('span', { class: info.affordable ? '' : 'blocked' }, formatCost(info.cost))),
      el('div', { class: 'row' }, el('span', {}, 'Time'),
        el('span', {}, formatDuration(info.duration))),
      el('div', { class: 'row' }, el('span', {}, 'Cell'),
        el('span', { class: 'muted' }, `(${info.cell.x}, ${info.cell.y}) — tap the map to move`)),
    );
    if (def.harvestSource) {
      rows.append(el('div', { class: 'row' },
        el('span', {}, `${def.harvestSource} cells captured`),
        el('span', { class: info.captured === 0 ? 'blocked' : '' }, `${info.captured}`)));
    }
    panel.append(rows);
  }

  const buildBtn = button('Build', () => game.confirmBuild(), 'cta');
  buildBtn.disabled = info.cell === null || !info.affordable;
  panel.append(el('div', { class: 'action-row' }, el('span', { class: 'info' }), buildBtn));
  return panel;
}
