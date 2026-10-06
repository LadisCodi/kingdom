// THE RELIC PICKER — which city relic a Shrine holds (Game.openRelicPicker).
// The hero picker's flow and frame (ui/heroPicker.ts), with one slot:
//
//   the window's title and close (which leaves without an answer);
//   the restored city relics, as cards, scrolling on their own — each with
//     what it does, the Shrine mark on those already in a Shrine, and the
//     check on the one in the slot;
//   the Shrine's slot, in a green head panel, fixed under the list;
//   Select, which hosts what the slot holds — or takes the relic out when it
//     was emptied.
//
// A tap on a relic seats it in the slot, or takes it out if it is the one
// there; a tap on the filled slot empties it. Selecting a relic that is in
// ANOTHER Shrine asks first (`renderRelicMoveConfirm`).

import type { Game, RelicView } from '../game';
import { el, formatExact } from './format';
import { btn, headPanel, iconEl, sectionHead, sheet } from './kit';
import { relicArt } from './relicSheet';

/** A relic's card in the picker: its art, level, name and what it does —
 *  the thing the choice is about — and the Shrine mark when it already
 *  stands in one. */
function pickCard(
  game: Game, view: RelicView, opts: { picked?: boolean; onClick: () => void; label?: string; inList?: boolean },
): HTMLElement {
  const hosted = game.relicPickHosted(view.id);
  const card = el('button', {
    class: `rl-card is-city is-pick${opts.picked ? ' is-picked' : ''}`, type: 'button',
    'aria-label': opts.label ?? view.name,
    // The list's cards are what a tutorial line points at; the slot's is not.
    ...(opts.inList ? { 'data-coach': `relic-pick:${view.id}` } : {}),
  },
    el('span', { class: 'rl-card-art' }, relicArt(view, 'rl-art')),
    el('span', { class: 'rl-seal' }, `Lv ${formatExact(view.level)}`),
    el('span', { class: 'rl-card-name' }, view.name),
    el('span', { class: 'rl-card-effect' }, view.effect),
    ...(hosted ? [el('span', { class: 'rl-pick-host', role: 'img', 'aria-label': 'In a Shrine' }, iconEl('Shrine'))] : []),
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
          inList: true,
        })))
        : el('p', { class: 'hp-none' }, 'No city relic is restored yet')),
    headPanel({ tone: 'green', title: 'Shrine', trailing: [`${chosen === null ? 0 : 1}/1`], cls: 'hp-party' },
      el('div', { class: 'hp-slots' }, chosen === null
        ? emptyRelicSlot()
        : pickCard(game, chosen, { onClick: () => game.relicPickClear(), label: `Take ${chosen.name} out of the Shrine` }))),
    el('div', { class: 'hp-go', 'data-coach': 'relic-pick-select' },
      btn({ label: 'Select', kind: 'primary', onClick: () => game.relicPickConfirm() })),
  );
  const surface = sheet({ title: 'Choose a relic', onClose: () => game.relicPickCancel(), tall: true }, body);
  // The hero picker's frame: the whole height, the list paying for it.
  surface.classList.add('is-picker', 'is-board');
  return surface;
}

/** "It is in another Shrine — move it here?" (§6.6, a centred sheet for one
 *  decision), over the picker. Move ends its window in the old Shrine. */
export function renderRelicMoveConfirm(game: Game): HTMLElement {
  const id = game.relicMoveSubject();
  const back = () => game.relicMoveCancel();
  const view = id === null ? null : game.relicPickList().find((v) => v.id === id) ?? null;
  if (view === null) return sheet({ title: 'Move relic', onClose: back, centred: true });
  return sheet({ title: 'Move relic', onClose: back, centred: true },
    el('div', { class: 'rl-move' },
      el('span', { class: 'rl-move-art' }, relicArt(view, 'rl-art')),
      el('p', {}, `${view.name} is already in another Shrine. Move it to this one?`),
      ...(view.status === 'awake' ? [el('p', { class: 'rl-note' }, 'It is awake there: moving it ends its window.')] : []),
      el('div', { class: 'iap-actions' },
        btn({ label: 'Cancel', kind: 'secondary', onClick: back }),
        btn({ label: 'Move', kind: 'primary', onClick: () => game.relicMoveAccept() }))));
}
