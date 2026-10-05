// The season pass's pill (Docs/features/20-season-pass.md §6).
//
// It sits in the left column of pills, under the quest scroll: the pass's
// level on its ladder, and the time the season has left. It glows while a
// cell of the pass waits to be taken.
//
// Built once and mutated, never rebuilt: a `replaceChildren` every tick makes
// the element new, and a new element restarts its own animation.

import type { Game } from '../game';
import { el, formatDuration, formatExact } from './format';
import { iconEl, setCta } from './kit';
import { setAttr, setHidden, setStyle, setText } from './domWrite';

export function mountSeasonPill(game: Game, root: HTMLElement): void {
  const name = el('span', { class: 'sea-pill-name' }, 'Season pass');
  const fill = el('span', { class: 'sea-pill-fill' });
  const count = el('span', { class: 'sea-pill-count' }, '');
  const left = el('span', { class: 'sea-pill-left' }, '');
  const pill = el('button', {
    class: 'sea-pill', type: 'button', 'aria-label': 'The season pass',
  },
    iconEl('crest', { size: 'lg' }),
    el('span', { class: 'sea-pill-body' },
      name,
      el('span', { class: 'sea-pill-trough' }, fill, count),
      el('span', { class: 'sea-pill-clock' }, iconEl('hourglass', { size: 'sm' }), left)),
  );
  pill.addEventListener('click', () => game.setOverlay('pass'));
  root.replaceChildren(pill);

  const refresh = (): void => {
    const state = game.passPillState();
    setHidden(root, state === null || !state.showing);
    if (root.hidden || state === null) return;
    setText(count, `Lv ${formatExact(state.level)}`);
    setStyle(fill, 'width', `${Math.round((state.level / Math.max(1, state.length)) * 100)}%`);
    setText(left, state.leftMs <= 0 ? 'closing' : `${formatDuration(state.leftMs / 1000)} left`);
    pill.classList.toggle('is-quiet', !state.glowing);
    // The orb is the ask (kit/cta.ts), the same one every waiting thing wears.
    setCta(pill, state.glowing ? 1 : 0);
    setAttr(pill, 'aria-label', state.glowing
      ? 'A reward is waiting on the season pass'
      : 'The season pass');
  };

  game.onChange(refresh);
  refresh();
}
