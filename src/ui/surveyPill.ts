// The Survey's pill (Docs/features/25-the-survey.md §4–§5): in the left
// column of pills, under the season's. It reads the province's count against
// the next level's, and glows while a cell is waiting. Absent until its door
// opens, with the Store.
//
// Built once and mutated, never rebuilt, for the season pill's reason: a new
// element restarts its own animation.

import type { Game } from '../game';
import { el, formatCount } from './format';
import { iconEl, setCta } from './kit';

export function mountSurveyPill(game: Game, root: HTMLElement): void {
  const name = el('span', { class: 'sea-pill-name' }, 'Royal Survey');
  const fill = el('span', { class: 'sea-pill-fill' });
  const count = el('span', { class: 'sea-pill-count' }, '');
  const level = el('span', { class: 'sea-pill-left' }, '');
  const pill = el('button', {
    class: 'sea-pill', type: 'button', 'aria-label': 'The Royal Survey', 'data-coach': 'survey',
  },
    iconEl('showme', { size: 'lg' }),
    el('span', { class: 'sea-pill-body' },
      name,
      el('span', { class: 'sea-pill-trough' }, fill, count),
      el('span', { class: 'sea-pill-clock' }, level)),
  );
  pill.addEventListener('click', () => game.setOverlay('survey'));
  root.replaceChildren(pill);

  const refresh = (): void => {
    const s = game.surveyPillState();
    root.hidden = s === null;
    if (s === null) return;
    const from = s.level === 0 ? 0 : game.surveyScreen().ladder[s.level - 1].cells;
    const to = s.nextAt;
    count.textContent = to === null ? formatCount(s.revealed) : `${formatCount(s.revealed)}/${formatCount(to)}`;
    fill.style.width = to === null ? '100%'
      : `${Math.round(Math.max(0, Math.min(1, (s.revealed - from) / Math.max(1, to - from))) * 100)}%`;
    level.textContent = `Level ${formatCount(s.level)} of ${formatCount(s.length)}`;
    pill.classList.toggle('is-quiet', !s.glowing);
    setCta(pill, s.glowing ? 1 : 0);
    pill.setAttribute('aria-label', s.glowing ? 'A reward is waiting on the Royal Survey' : 'The Royal Survey');
  };
  game.onChange(refresh);
  refresh();
}
