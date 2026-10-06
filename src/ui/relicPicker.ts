// THE RELIC PICKER — which city relic a Shrine holds (Game.openRelicPicker).
// The hero picker's flow and frame (ui/heroPicker.ts), with one slot:
//
//   the window's title and close (which leaves without an answer);
//   the restored city relics, as cards, scrolling on their own — each says
//     where it is now, and the one in the slot wears the check;
//   the Shrine's slot, in a green head panel, fixed under the list;
//   Select, which hosts what the slot holds — or takes the relic out when it
//     was emptied.
//
// A tap on a relic seats it in the slot, or takes it out if it is the one
// there; a tap on the filled slot empties it.

import type { Game, RelicView } from '../game';
import { el, formatExact } from './format';
import { btn, headPanel, sectionHead, sheet } from './kit';
import { relicArt } from './relicSheet';

/** A relic's card in the picker: its art, level, name and where it is. */
function pickCard(game: Game, view: RelicView, opts: { picked?: boolean; onClick: () => void; label?: string }): HTMLElement {
  const where = game.relicPickWhere(view.id);
  const card = el('button', {
    class: `rl-card is-city is-pick${opts.picked ? ' is-picked' : ''}`, type: 'button',
    'aria-label': opts.label ?? view.name,
  },
    el('span', { class: 'rl-card-art' }, relicArt(view, 'rl-art')),
    el('span', { class: 'rl-seal' }, `Lv ${formatExact(view.level)}`),
    el('span', { class: 'rl-card-name' }, view.name),
    el('span', { class: 'rl-card-where' }, where === null ? 'In the Bag' : `In ${where}`),
    ...(opts.picked ? [el('span', { class: 'hc-check', 'aria-hidden': 'true' })] : []));
  card.addEventListener('click', opts.onClick);
  return card;
}

/** An empty relic slot: the hero slot's dashed gold well, square. */
export const emptyRelicSlot = (opts: { onClick?: () => void; label?: string } = {}): HTMLElement => {
  const slot = el(opts.onClick ? 'button' : 'span', {
    class: 'rl-empty', ...(opts.onClick ? { type: 'button' } : {}), 'aria-label': opts.label ?? 'Empty relic slot',
  }, el('span', { class: 'hc-plus', 'aria-hidden': 'true' }, '+'));
  if (opts.onClick) slot.addEventListener('click', opts.onClick);
  return slot;
};

export function renderRelicPicker(game: Game): HTMLElement {
  const pick = game.relicPick;
  if (pick === null) return el('div', {});
  const list = game.relicPickList();
  const chosen = list.find((v) => v.id === pick.slot) ?? null;
  const body = el('div', { class: 'hp' },
    el('div', { class: 'hp-list', 'data-keep-scroll': 'relic-picker' },
      sectionHead('Relics'),
      list.length > 0
        ? el('div', { class: 'hp-grid' }, ...list.map((v) => pickCard(game, v, {
          picked: v.id === pick.slot,
          onClick: () => game.relicPickToggle(v.id),
        })))
        : el('p', { class: 'hp-none' }, 'No city relic is restored yet')),
    headPanel({ tone: 'green', title: 'Shrine', trailing: [`${chosen === null ? 0 : 1}/1`], cls: 'hp-party' },
      el('div', { class: 'hp-slots' }, chosen === null
        ? emptyRelicSlot()
        : pickCard(game, chosen, { onClick: () => game.relicPickClear(), label: `Take ${chosen.name} out of the Shrine` }))),
    el('div', { class: 'hp-go' },
      btn({ label: 'Select', kind: 'primary', onClick: () => game.relicPickConfirm() })),
  );
  const surface = sheet({ title: 'Choose a relic', onClose: () => game.relicPickCancel(), tall: true }, body);
  // The hero picker's frame: the whole height, the list paying for it.
  surface.classList.add('is-picker', 'is-board');
  return surface;
}
