// THE UNLOCK SPLASH (Docs/features/23-tutorials.md §4.6) — a door of the UI
// or a book of research has just opened, and for a moment nothing else is
// happening: a dark veil over the whole game, the thing's icon on a slow
// golden burst, its name, one paragraph, and a quiet way out.
//
// Its own mount, `#unlock`, between the stage (95) and the gacha reveal
// (100), for the reason the reveal has one: `#overlay` is a stacking context
// and nothing in it rises over the header or the nav. The game decides WHEN
// (`Game.unlockOnScreen`, which waits for a fight, a reveal or a video to
// end); a scene about the same thing waits for this to be read.
//
// THE WAY OUT IS LATE ON PURPOSE. The prompt appears two seconds after the
// entrance has played, and until it does a tap does nothing — a splash the
// player's thumb dismisses before the name has landed was never seen.

import { UNLOCKS } from '../sim/data/definitions';
import { playSfx } from '../audio/sfx';
import { spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { tr } from '../i18n/tr';
import { el } from './format';

/** How long the entrance plays (unlock.css: the veil, the burst, the words). */
const ENTRANCE_MS = 800;
/** How long after it the prompt appears and a tap starts to count. */
const PROMPT_DELAY_MS = 2000;

export function mountUnlockSplash(game: Game, root: HTMLElement): void {
  /** The id on screen, so a notify — every tick — does not restart it. */
  let showing: string | null = null;
  let timer: number | null = null;

  const clear = (): void => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    root.replaceChildren();
    showing = null;
  };

  const build = (id: string): void => {
    const u = UNLOCKS[id];
    const url = spriteUrl(u.icon);
    const titleId = `unl-title-${id}`;
    const screen = el('div', {
      class: 'unl-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1',
    },
    el('div', { class: 'unl-burst', 'aria-hidden': 'true' },
      el('div', { class: 'unl-glow' }),
      el('div', { class: 'unl-rays is-long' }),
      el('div', { class: 'unl-rays is-short' }),
      ...(url === null ? [] : [el('img', { class: 'unl-icon', src: url, alt: '', draggable: 'false' })])),
    el('h2', { class: 'unl-title', id: titleId }, u.title),
    el('p', { class: 'unl-text' }, u.text),
    el('div', { class: 'unl-prompt' }, tr('Tap to continue')));

    let ready = false;
    const leave = (): void => {
      if (!ready) return;
      ready = false;
      game.dismissUnlock();
    };
    screen.addEventListener('click', leave);
    screen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        leave();
      }
    });
    timer = window.setTimeout(() => {
      timer = null;
      ready = true;
      screen.classList.add('is-ready');
    }, ENTRANCE_MS + PROMPT_DELAY_MS);

    root.replaceChildren(screen);
    screen.focus({ preventScroll: true });
    playSfx('unlock');
  };

  const refresh = (): void => {
    const id = game.unlockOnScreen();
    if (id === showing) return;
    clear();
    if (id === null || UNLOCKS[id] === undefined) return;
    showing = id;
    build(id);
  };

  game.onChange(refresh);
  refresh();
}
