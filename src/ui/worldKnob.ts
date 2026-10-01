// The door to the world (Docs/features/22-progression.md §3, §5): a round
// wooden knob with the compass carved into it, bottom right, just above the
// nav. It appears, padlocked, the moment the Watchtower is sighted — the
// promise arrives with the place that keeps it — and claiming the Watchtower
// breaks the lock.
//
// Built once and mutated, like the ad tab beside it (`adOfferPill.ts`).

import type { Game } from '../game';
import { watchtowerSighted } from '../sim/landmarks';
import { el } from './format';
import { iconEl } from './kit';

export function mountWorldKnob(game: Game, root: HTMLElement): void {
  const lock = el('span', { class: 'world-knob-lock', 'aria-hidden': 'true' }, iconEl('padlock', { size: 'sm' }));
  const knob = el('button', {
    class: 'k-knob world-knob', type: 'button', 'aria-label': 'The world', 'data-coach': 'world',
  }, iconEl('compass', { size: 'md' }), lock);
  knob.addEventListener('click', () => {
    if (!game.doorOpen('world')) {
      knob.classList.remove('is-shaking');
      void knob.offsetWidth;
      knob.classList.add('is-shaking');
    }
    game.setOverlay('world');
  });
  root.replaceChildren(knob);

  let wasLocked: boolean | null = null;
  const refresh = (): void => {
    const locked = !game.doorOpen('world');
    root.hidden = game.hasOpenSheet() || (locked && !watchtowerSighted(game.state));
    if (wasLocked === true && !locked) {
      knob.classList.add('is-unlocking');
      window.setTimeout(() => knob.classList.remove('is-unlocking'), 900);
    }
    wasLocked = locked;
    knob.classList.toggle('is-locked', locked);
  };
  game.onChange(refresh);
  refresh();
}
