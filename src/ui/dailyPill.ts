// The daily-chest pill.
//
// Glows and waits. It does NOT auto-open the sheet on the first session of a
// day — Docs/features/12-quests.md §4.3, and the reasoning is the whole design: a game
// built around never making demands should not open with one. The cost is that
// a player can miss the chest entirely on a day they play; that is the
// sanctioned pressure, and it costs them one chest and no ladder progress.
//
// Built once and mutated, never rebuilt, for the reason questPill.ts and
// adOfferPill.ts both give: a `replaceChildren` every tick makes the element
// new, and a new element restarts its own animation.

import type { Game } from '../game';
import { el } from './format';
import { iconEl } from './kit';

export function mountDailyPill(game: Game, root: HTMLElement): void {
  const day = el('span', { class: 'dly-pill-day' }, '');
  const pill = el('button', {
    class: 'dly-pill', type: 'button', 'aria-label': 'Your daily chest is ready',
  },
    iconEl('quest', { size: 'lg' }),
    el('span', { class: 'dly-pill-body' },
      el('span', { class: 'dly-pill-title' }, 'Daily chest'),
      day),
  );
  pill.addEventListener('click', () => game.setOverlay('daily'));
  root.replaceChildren(pill);

  const refresh = (): void => {
    const chest = game.dailyChest();
    // Hidden behind any sheet, like every other pill: the map chrome must not
    // compete with whatever the player just opened.
    const showing = chest !== null && !game.hasOpenSheet();
    root.hidden = !showing;
    if (!showing) return;
    day.textContent = `Day ${chest!.step} of ${chest!.length}`;
  };

  game.onChange(refresh);
  refresh();
}
