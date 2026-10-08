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

import { HEROES } from '../sim/data/definitions';
import type { Game } from '../game';
import { el } from './format';
import { tr } from '../i18n/tr';
import { btn, headPanel, sectionHead, sheet } from './kit';
import { emptyHeroSlot, heroCard, heroFilterBar } from './heroCard';

export function renderHeroPicker(game: Game): HTMLElement {
  const pick = game.heroPick;
  if (pick === null) return el('div', {});

  const list = game.heroPickList();
  const grid = el('div', { class: 'hp-grid' },
    ...list.map((h) => heroCard(game, h, {
      picked: pick.slots.includes(h),
      power: pick.fight,
      onClick: () => game.heroPickToggle(h),
    })));

  const filled = pick.slots.filter((h) => h !== null).length;
  // The slots are the list's own cards, at the list's own size.
  const slots = pick.slots.map((h, i) => (h === null
    ? emptyHeroSlot()
    : heroCard(game, h, {
      power: pick.fight,
      onClick: () => game.heroPickClearSlot(i),
      label: tr('Take {name} out of the party', { name: HEROES[h].name }),
    })));

  const body = el('div', { class: 'hp' },
    heroFilterBar({
      filter: pick.filter,
      sort: pick.sort,
      onFilter: (f) => game.heroPickFilter(f),
      onSort: () => game.heroPickCycleSort(),
    }),
    el('div', { class: 'hp-list', 'data-keep-scroll': 'hero-picker' },
      sectionHead(tr('Heroes')),
      list.length > 0 ? grid : el('p', { class: 'hp-none' }, tr('No heroes of that type yet'))),
    headPanel({ tone: 'green', title: tr('Party'), trailing: [`${filled}/${pick.slots.length}`], cls: 'hp-party' },
      el('div', { class: 'hp-slots' }, ...slots)),
    el('div', { class: 'hp-go' },
      btn({ label: tr('Select'), kind: 'primary', onClick: () => game.heroPickConfirm() })),
  );
  const surface = sheet({ title: pick.title, onClose: () => game.heroPickCancel(), tall: true }, body);
  // The attack screen's frame (battle.css `is-board`): the whole height and,
  // on the narrowest phone, the whole width — the list is what pays for it.
  surface.classList.add('is-picker', 'is-board');
  return surface;
}
