// The Survey's widget on the map (Docs/features/25-the-survey.md §4–§5),
// drawn from Docs/art/ui/mockups/m63-survey-widget.png: a small piece of the
// menu's ledger — a parchment card in its nailed frame, the brass compass from
// the menu's title with the count of levels waiting on its rim, "Survey", a
// gold trough to the next level and the level's blue seal. It glows while a
// level waits. Absent until its door opens, with the Store; it sits under the
// Knowledge tab, never beside it (survey.css).
//
// Built once and mutated, never rebuilt: a new element restarts its own
// animation.

import type { Game } from '../game';
import { el, formatCount } from './format';
import { progress, setCta } from './kit';
import { setAttr, setHidden, setText } from './domWrite';

export function mountSurveyPill(game: Game, root: HTMLElement): void {
  const compass = el('span', { class: 'svw-compass', 'aria-hidden': 'true' });
  const bar = progress('gold');
  const seal = el('b', {}, '');
  const widget = el('button', {
    class: 'svw', type: 'button', 'aria-label': 'The Royal Survey', 'data-coach': 'survey',
  },
    compass,
    el('span', { class: 'svw-body' },
      el('span', { class: 'svw-name' }, 'Survey'),
      el('span', { class: 'svw-line' }, bar.root, el('span', { class: 'rs-seal is-active' }, seal))),
  );
  widget.addEventListener('click', () => game.setOverlay('survey'));
  root.replaceChildren(widget);

  const refresh = (): void => {
    const s = game.surveyPillState();
    setHidden(root, s === null);
    if (s === null) return;
    const screen = game.surveyScreen();
    const from = s.level === 0 ? 0 : screen.ladder[s.level - 1].cells;
    const to = s.nextAt;
    if (to === null) bar.set(1, formatCount(s.revealed));
    else bar.set((s.revealed - from) / Math.max(1, to - from), `${formatCount(s.revealed)} / ${formatCount(to)}`);
    setText(seal, formatCount(s.level));
    // The badge counts the LEVELS waiting, either column.
    const waiting = screen.ladder.filter((r) => r.free.claimable || r.paid.claimable).length;
    widget.classList.toggle('is-ready', waiting > 0);
    setCta(compass, waiting);
    setAttr(widget, 'aria-label', waiting > 0
      ? `${formatCount(waiting)} levels waiting on the Royal Survey`
      : 'The Royal Survey');
  };
  game.onChange(refresh);
  refresh();
}
