// The door to the world (Docs/features/22-progression.md §3, §5): a round
// brass-rimmed knob with the compass gilded into its wood, bottom right, just
// above the nav (Docs/art/ui/knob/). It appears, padlocked, the moment the Watchtower is sighted — the
// promise arrives with the place that keeps it — and claiming the Watchtower
// breaks the lock. Out on the world board it wears the castle and takes the
// player home.
//
// Built once and mutated, like the ad tab beside it (`adOfferPill.ts`).

import type { Game } from '../game';
import { watchtowerSighted } from '../sim/landmarks';
import { el } from './format';
import { iconEl } from './kit';
import { setAttr, setHidden } from './domWrite';
import { tr } from '../i18n/tr';

export function mountWorldKnob(game: Game, root: HTMLElement): void {
  const lock = el('span', { class: 'world-knob-lock', 'aria-hidden': 'true' }, iconEl('padlock', { size: 'sm' }));
  const knob = el('button', {
    class: 'k-knob world-knob', type: 'button', 'aria-label': tr('The world'), 'data-coach': 'world',
  }, el('span', { class: 'world-knob-face world-knob-out', 'aria-hidden': 'true' }),
  el('span', { class: 'world-knob-face world-knob-home', 'aria-hidden': 'true' }), lock);
  knob.addEventListener('click', () => {
    if (game.scene === 'world') {
      game.leaveWorld();
      return;
    }
    if (!game.doorOpen('world')) {
      knob.classList.remove('is-shaking');
      void knob.offsetWidth;
      knob.classList.add('is-shaking');
    }
    game.enterWorld();
  });
  root.replaceChildren(knob);

  let wasLocked: boolean | null = null;
  const refresh = (): void => {
    const locked = !game.doorOpen('world');
    setHidden(root, game.hasOpenSheet() || (locked && !watchtowerSighted(game.state)));
    if (wasLocked === true && !locked) {
      knob.classList.add('is-unlocking');
      window.setTimeout(() => knob.classList.remove('is-unlocking'), 900);
    }
    wasLocked = locked;
    knob.classList.toggle('is-locked', locked);
    const away = game.scene === 'world';
    knob.classList.toggle('is-away', away);
    setAttr(knob, 'aria-label', away ? tr('Back to the city') : tr('The world'));
  };
  game.onChange(refresh);
  refresh();
}
