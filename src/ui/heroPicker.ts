// THE HERO PICKER — one popup for every place the game asks the player to
// choose heroes (Game.openHeroPicker). Whoever opens it says how many slots
// it wants and what to do with the answer; this file only draws the choice.
//
// Top to bottom:
//   the window's title and close (which leaves without an answer);
//   the filter bar — All, then one tab per unit type heroes fight as — and
//     the sort, by level or by rarity;
//   the heroes on offer, three cards to a row, scrolling on their own;
//   the slots asked for, in a green head panel, fixed under the list;
//   Select, which hands the slots back in order.
//
// A tap on a hero in the list seats it in the first free slot, or takes it
// out of the slot it holds. A tap on a filled slot empties it. No free slot,
// or an exhausted hero: an error sound, and nothing moves.

import { HERO_ORDER, HEROES } from '../sim/data/definitions';
import type { UnitId } from '../sim/state';
import type { Game } from '../game';
import { el } from './format';
import { btn, headPanel, iconEl, sectionHead, sheet } from './kit';
import { emptyHeroSlot, heroCard } from './heroCard';

/** The unit types heroes fight as, in roster order — the filter's tabs. */
const heroTypes = (): UnitId[] => [...new Set(HERO_ORDER.map((h) => HEROES[h].unitType))];

export function renderHeroPicker(game: Game): HTMLElement {
  const pick = game.heroPick;
  if (pick === null) return el('div', {});

  const tab = (filter: UnitId | 'All'): HTMLElement => {
    const on = pick.filter === filter;
    const b = el('button', {
      class: `hp-tab${on ? ' is-on' : ''}`, type: 'button',
      'aria-pressed': on ? 'true' : 'false',
      'aria-label': filter === 'All' ? 'All heroes' : `${filter} heroes`,
    }, filter === 'All' ? 'All' : iconEl(filter, { size: 'sm' }));
    b.addEventListener('click', () => game.heroPickFilter(filter));
    return b;
  };
  const sort = el('button', { class: 'hp-sort', type: 'button', 'aria-label': 'Sort heroes' },
    pick.sort === 'level' ? 'Lv' : 'Rarity', el('span', { class: 'hp-sort-caret', 'aria-hidden': 'true' }, '▾'));
  sort.addEventListener('click', () => game.heroPickCycleSort());

  const list = game.heroPickList();
  const grid = el('div', { class: 'hp-grid' },
    ...list.map((h) => heroCard(game, h, {
      picked: pick.slots.includes(h),
      onClick: () => game.heroPickToggle(h),
    })));

  const filled = pick.slots.filter((h) => h !== null).length;
  const slots = pick.slots.map((h, i) => (h === null
    ? emptyHeroSlot({ small: true })
    : heroCard(game, h, {
      small: true, onClick: () => game.heroPickClearSlot(i),
      label: `Take ${HEROES[h].name} out of the party`,
    })));

  const body = el('div', { class: 'hp' },
    el('div', { class: 'hp-bar' },
      el('div', { class: 'hp-tabs', role: 'group', 'aria-label': 'Filter by type' },
        tab('All'), ...heroTypes().map(tab)),
      sort),
    el('div', { class: 'hp-list', 'data-keep-scroll': 'hero-picker' },
      sectionHead('Heroes'),
      list.length > 0 ? grid : el('p', { class: 'hp-none' }, 'No heroes of that type yet')),
    headPanel({ tone: 'green', title: 'Party', trailing: [`${filled}/${pick.slots.length}`], cls: 'hp-party' },
      el('div', { class: 'hp-slots' }, ...slots)),
    el('div', { class: 'hp-go' },
      btn({ label: 'Select', kind: 'primary', onClick: () => game.heroPickConfirm() })),
  );
  const surface = sheet({ title: pick.title, onClose: () => game.heroPickCancel(), tall: true }, body);
  // The attack screen's frame (battle.css `is-board`): the whole height and,
  // on the narrowest phone, the whole width — the list is what pays for it.
  surface.classList.add('is-picker', 'is-board');
  return surface;
}
