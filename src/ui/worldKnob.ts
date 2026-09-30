// The door to the world (Docs/features/22-progression.md §3, §5): a round
// wooden knob with the compass carved into it, on the right-edge column. It
// is there from the first minute, padlocked, so the player knows the province
// is not the whole game; claiming the Watchtower breaks the lock.
//
// Built once and mutated, like the ad tab beside it (`adOfferPill.ts`).

import type { Game } from '../game';
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
    root.hidden = game.hasOpenSheet();
    const locked = !game.doorOpen('world');
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
