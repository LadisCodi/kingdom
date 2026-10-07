// THE NOTICES (Docs/features/26-notices.md §3–§4, mockup m102): round
// brass-rimmed bubbles in two columns, in the province and on the board —
// the NEWS stacked at the bottom right, above the world knob, and the
// STANDING notices, larger, hung under the settings knob at the top right.
// A tap opens the bubble's card, or what the notice says to open instead;
// nothing opens by itself.
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
import { columnNotices, standingNotices, type Notice } from './model';

/** News whose event sounds where it happens (game.ts), so its bubble
 *  arriving adds no pop on top. */
const VOICED = new Set(['news:built', 'news:worldBuild', 'news:explorer', 'news:armyHome', 'news:raided']);

/** How long a news bubble stays on screen unread, and how much of the end
 *  of that it spends blinking to say it is going (26 §3). */
const NEWS_LIFE_MS = 10_000;
const NEWS_WARN_MS = 3_000;

export const mountNoticeColumn = (game: Game, root: HTMLElement): void =>
  mountColumn(game, root, () => columnNotices(game, NOTICES.shown), true);

export const mountStandingColumn = (game: Game, root: HTMLElement): void =>
  mountColumn(game, root, () => standingNotices(game), false);

function mountColumn(game: Game, root: HTMLElement, list: () => Notice[], expires: boolean): void {
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
    b.addEventListener('click', () => (n.tap !== undefined ? (playSfx('click'), n.tap()) : game.openNotice(n.id)));
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
    notices = list();
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

  // A NEWS LEFT UNREAD GOES. Only the time it is on screen counts — not
  // while a sheet hides the column, nor while it waits under the +N — and a
  // news that gains an item starts again. Wall-clock time is the UI's own:
  // the sim never sees it, it only reads the group as the card would. It
  // ages on the game's own beat (every notify), not on a timer of its own.
  if (!expires) return;
  const life = new Map<string, { count: number; shownMs: number }>();
  let last = performance.now();
  game.onChange(() => {
    const now = performance.now();
    // One beat at most: a tab back from the background must not age every
    // bubble by the whole time it was away.
    const dt = Math.min(now - last, 2_000);
    last = now;
    const visible = !root.hidden;
    const live = new Set<string>();
    for (const n of notices) {
      if (n.kind !== 'news') continue;
      live.add(n.id);
      let l = life.get(n.id);
      if (l === undefined || l.count !== n.count) {
        // Counted from now: the beat that brought it in is not its time.
        l = { count: n.count, shownMs: 0 };
        life.set(n.id, l);
      } else if (visible) l.shownMs += dt;
      root.querySelector(`[data-notice="${n.id}"]`)?.classList.toggle('is-leaving', l.shownMs >= NEWS_LIFE_MS - NEWS_WARN_MS);
      if (l.shownMs >= NEWS_LIFE_MS) {
        life.delete(n.id);
        game.dismissNews(n.id);
      }
    }
    for (const id of [...life.keys()]) if (!live.has(id)) life.delete(id);
  });
}
