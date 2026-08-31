// Spellbook overlay + the cast-mode banner.

import { icon, type Game } from '../game';
import { SPELLS, levelIndexed } from '../sim/data/definitions';
import type { SpellId } from '../sim/state';
import { button, el } from './format';

export function renderSpellbook(game: Game): HTMLElement {
  const menu = el('div', { class: 'menu' });
  menu.append(el('h2', {}, 'Spellbook'));
  const list = el('div', { class: 'menu-list' });
  for (const def of Object.values(SPELLS)) {
    const spell = game.state.spellbook[def.id];
    const levelDef = levelIndexed(def.levels, spell?.level ?? 1);
    const desc = def.description
      .replace('{value}', String(levelDef.effectMagnitude))
      .replace('{duration}', `${levelDef.durationSeconds}s`);
    const row = el(
      'button',
      { class: `menu-row${spell?.unlocked ? '' : ' disabled'}` },
      el('span', { class: 'icon' }, def.glyph),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, def.name, spell?.unlocked ? '' : ' 🔒'),
        el('div', { class: 'desc' }, desc)),
      el('div', { class: 'meta' }, `${levelDef.manaCost} ${icon('Mana')}`),
    );
    if (spell?.unlocked) {
      row.addEventListener('click', () => game.startTargeting(def.id as SpellId));
    }
    list.append(row);
  }
  menu.append(list);
  return menu;
}

export function renderCastBanner(game: Game): HTMLElement {
  if (game.mode.kind !== 'targeting') return el('span');
  const def = SPELLS[game.mode.spellId];
  return el('div', { class: 'cast-banner' },
    `${def.glyph} Tap a highlighted cell to cast ${def.name}`,
  );
}
