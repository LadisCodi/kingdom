// THE NOTICES COLUMN (Docs/features/26-notices.md §3–§4, mockup m102): round
// brass-rimmed bubbles stacked at the bottom right, above the world knob, in
// the province and on the board. A tap opens the bubble's card; nothing
// opens by itself.
//
// Rebuilt only when what it shows changes — which bubbles, their pictures,
// counts and glow. A countdown is written in place every notify, so a
// bubble's arrival animation never replays on a tick.

import { playSfx } from '../../audio/sfx';
import type { Game } from '../../game';
import { NOTICES } from '../../sim/data/definitions';
import { setHidden, setText } from '../domWrite';
import { el, formatCountdown } from '../format';
import { ctaBadge } from '../kit';
import { columnNotices, type Notice } from './model';

/** News whose event sounds where it happens (game.ts), so its bubble
 *  arriving adds no pop on top. */
const VOICED = new Set(['news:built', 'news:worldBuild', 'news:explorer', 'news:armyHome', 'news:raided']);

export function mountNoticeColumn(game: Game, root: HTMLElement): void {
  let drawn = '';
  /** The ids on screen, so a bubble that is new can pop in. */
  let seen: Set<string> | null = null;
  const clocks = new Map<string, HTMLElement>();
  let notices: Notice[] = [];

  const bubble = (n: Notice, fresh: boolean): HTMLElement => {
    const b = el('button', {
      class: `nt-bubble is-${n.kind} is-${n.tone}${n.glow ? ' is-glowing' : ''}${fresh ? ' is-new' : ''}`,
      type: 'button',
      'aria-label': n.title,
      'data-notice': n.id,
    },
    el('span', { class: 'nt-face' }, n.art.make()));
    if (n.count > 1) b.append(ctaBadge(n.count, `notice:${n.id}`));
    // A seal of the other view, when the subject is not where the player is.
    const here = game.scene === 'world' ? 'world' : 'province';
    if (n.view !== null && n.view !== here) b.append(el('span', { class: `nt-badge is-${n.view}`, 'aria-hidden': 'true' }));
    if (n.until !== null) {
      const clock = el('span', { class: 'nt-clock' }, '');
      clocks.set(n.id, clock);
      b.append(clock);
    }
    b.addEventListener('click', () => game.openNotice(n.id));
    return b;
  };

  const writeClocks = (): void => {
    const now = game.now();
    for (const n of notices) {
      const clock = clocks.get(n.id);
      if (clock !== undefined && n.until !== null) {
        setText(clock, formatCountdown(Math.max(0, Math.ceil((n.until - now) / 1000))));
      }
    }
  };

  const refresh = (): void => {
    const hidden = game.hasOpenSheet();
    setHidden(root, hidden);
    if (hidden) return;
    notices = columnNotices(game, NOTICES.shown);
    const here = game.scene;
    const signature = `${here}|${notices.map((n) => `${n.id}:${n.art.key}:${n.count}:${n.glow}:${n.until !== null}:${n.view}`).join('|')}`;
    if (signature !== drawn) {
      drawn = signature;
      clocks.clear();
      const ids = new Set(notices.map((n) => n.id));
      const arrived = seen === null ? [] : notices.filter((n) => !seen!.has(n.id) && n.kind !== 'more');
      root.replaceChildren(...notices.map((n) => bubble(n, arrived.includes(n))));
      if (arrived.some((n) => !VOICED.has(n.id))) playSfx('pop');
      seen = ids;
    }
    writeClocks();
  };

  game.onChange(refresh);
  refresh();
}
