// The fake rewarded video (Docs/features/08-magic.md §7).
//
// NOT an overlay, deliberately. `#overlay` sits at z-index 5 and that makes it
// a stacking context, so nothing inside it can rise above the nav bar (10) or
// the settings knob (20) — and a rewarded video the player can tap around is
// not a rewarded video. This is its own mount point at the end of `#ui`, which
// is also what makes "no escape" structural rather than a rule: `dismiss()`
// and the tap-beside-a-sheet handler cannot reach a surface they do not own.
//
// The countdown is derived from a TIMESTAMP (`adWatchStartedAt`), never a
// decremented integer, so a tab throttled in the background resolves to the
// right number the moment it returns rather than freezing mid-count. The
// once-per-second tick would land the Claim button up to a second late, so
// the screen arms one timeout for exactly the remaining time and clears it on
// the way out.

import type { Game } from '../game';
import { el } from './format';
import { btn } from './kit';

export function mountAdScreen(game: Game, root: HTMLElement): void {
  let armed: number | null = null;
  let showing = false;

  const clearArmed = (): void => {
    if (armed !== null) {
      clearTimeout(armed);
      armed = null;
    }
  };

  const countdown = el('div', { class: 'ad-countdown' }, '');
  const claim = btn({
    label: 'Claim your reward',
    kind: 'primary',
    onClick: () => game.doClaimAdReward(),
  });
  const screen = el('div', { class: 'ad-screen' },
    el('div', { class: 'ad-screen-tag' }, 'Advertisement'),
    // Unmistakably a placeholder: nobody should ever ship this thinking an
    // SDK is wired up behind it.
    el('div', { class: 'ad-screen-fake' },
      el('div', { class: 'ad-screen-fake-mark' }, '▶'),
      el('div', { class: 'ad-screen-fake-title' }, 'Your ad here'),
      el('div', { class: 'ad-screen-fake-sub' }, 'A real rewarded video goes in this slot')),
    countdown,
    claim,
  );

  const refresh = (): void => {
    const watch = game.adWatch();
    if (watch === null) {
      if (showing) {
        clearArmed();
        root.replaceChildren();
        showing = false;
      }
      return;
    }
    if (!showing) {
      root.replaceChildren(screen);
      showing = true;
    }
    countdown.textContent = watch.ready ? '' : `${watch.secondsLeft}`;
    countdown.hidden = watch.ready;
    claim.hidden = !watch.ready;
    if (!watch.ready && armed === null) {
      // One shot, for exactly what is left — the tick alone would be late.
      armed = window.setTimeout(() => {
        armed = null;
        game.notify();
      }, Math.max(0, watch.secondsLeft * 1000));
    }
  };

  game.onChange(refresh);
  refresh();
}
