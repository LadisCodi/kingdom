// The season pill (Docs/features/09-relics.md §11.1).
//
// It sits DIRECTLY UNDER THE DAILY CHEST'S pill, which is the whole of its
// placement argument: the game has two seasons — the chest's, which counts
// from the player's own first day, and the collection's, which is everyone's —
// and putting them in one column says so without a word of copy.
//
// IT GLOWS WHILE A PACK IS UNOPENED and goes quiet when none is. Never a badge
// with a count of things owed: the collection asks for one tap, and a number
// hanging off the pill would turn a cozy screen into a chore list.
//
// Built once and mutated, never rebuilt, for the reason dailyPill.ts gives: a
// `replaceChildren` every tick makes the element new, and a new element
// restarts its own animation.

import type { Game } from '../game';
import { el, formatDuration } from './format';
import { iconEl } from './kit';

export function mountSeasonPill(game: Game, root: HTMLElement): void {
  const name = el('span', { class: 'sea-pill-name' }, '');
  const fill = el('span', { class: 'sea-pill-fill' });
  const count = el('span', { class: 'sea-pill-count' }, '');
  const left = el('span', { class: 'sea-pill-left' }, '');
  const pill = el('button', {
    class: 'sea-pill', type: 'button', 'aria-label': 'The card collection',
  },
    iconEl('crest', { size: 'lg' }),
    el('span', { class: 'sea-pill-body' },
      name,
      el('span', { class: 'sea-pill-trough' }, fill, count),
      el('span', { class: 'sea-pill-clock' }, iconEl('hourglass', { size: 'sm' }), left)),
  );
  pill.addEventListener('click', () => game.setOverlay('collection'));
  root.replaceChildren(pill);

  const refresh = (): void => {
    const state = game.seasonPillState();
    // Absent entirely before the first card: the collection is hidden until
    // the player holds one, so its door must be too.
    root.hidden = state === null || !state.showing;
    if (root.hidden) return;
    const info = game.seasonInfo();
    name.textContent = info.name;
    count.textContent = `${info.held}/${info.total}`;
    // A width, not a transform: the trough is a fact about the season and the
    // countdown beside it already moves every tick.
    fill.style.width = `${Math.round((info.held / info.total) * 100)}%`;
    left.textContent = info.leftMs <= 0 ? 'closing' : `${formatDuration(info.leftMs / 1000)} left`;
    pill.classList.toggle('is-quiet', !state!.glowing);
    pill.setAttribute('aria-label', state!.glowing
      ? 'A card pack is waiting to be opened'
      : `${info.name} — the card collection`);
  };

  game.onChange(refresh);
  refresh();
}
