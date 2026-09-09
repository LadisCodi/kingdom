// The daily-chest pill.
//
// Glows and waits. It does NOT auto-open the sheet on the first session of a
// day — Docs/features/12-quests.md §3.4, and the reasoning is the whole design: a game
// built around never making demands should not open with one. The cost is that
// a player can miss the chest entirely on a day they play; that is the
// sanctioned pressure, and it costs them one rung.
//
// TWO STATES. A rung waiting: it glows and says which day. Every rung taken
// and the Royal chest still unbought: it stays, UNLIT, showing what is left of
// the season — because the purchase has to stay reachable until the window
// closes and this is the only door to it (§3.4). Bought and finished, it
// sleeps until the next season.
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
    iconEl('chest', { size: 'lg' }),
    el('span', { class: 'dly-pill-body' },
      el('span', { class: 'dly-pill-title' }, 'Daily chest'),
      day),
  );
  pill.addEventListener('click', () => game.setOverlay('daily'));
  root.replaceChildren(pill);

  const refresh = (): void => {
    const state = game.dailyPillState();
    // Hidden behind any sheet, like every other pill: the map chrome must not
    // compete with whatever the player just opened.
    const showing = state !== null && !game.hasOpenSheet();
    root.hidden = !showing;
    if (!showing) return;
    day.textContent = state!.label;
    // The glow is the ask. Without a rung waiting there is nothing to ask for,
    // so the pill goes quiet and merely stays available.
    pill.classList.toggle('is-quiet', !state!.glowing);
    pill.setAttribute('aria-label', state!.glowing
      ? 'Your daily chest is ready'
      : 'The daily chest season');
  };

  game.onChange(refresh);
  refresh();
}
