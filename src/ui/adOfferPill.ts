// The ad-offer tab (Docs/features/08-magic.md §7): a small slab that slides in
// from the right edge when there is a rewarded video worth watching.
//
// Built once and mutated, never rebuilt — the same reason the quest pill is
// (`questPill.ts`): a `replaceChildren` every tick makes the element new, and
// a new element restarts its own animation, so the tab would slide in once a
// second forever.
//
// The slide is a class toggle rather than `data-entering`, which only exists
// on ScreenSlot containers and only fires on a key change. A permanently
// mounted widget never gets one, so it drives its own — with the forced
// reflow the header's shake already uses, because a class added in the same
// frame the element stops being `hidden` does not transition.

import type { Game } from '../game';
import { el } from './format';
import { iconEl } from './kit';

export function mountAdOfferPill(game: Game, root: HTMLElement): void {
  const amount = el('b', { class: 'ad-tab-amount' }, '');
  const tab = el('button', {
    class: 'ad-tab', type: 'button', 'aria-label': 'A free reward is waiting',
  },
    iconEl('Mana', { size: 'lg' }),
    amount,
    el('span', { class: 'ad-tab-play' }, '▶'),
  );
  tab.addEventListener('click', () => game.openAdOffer());
  root.replaceChildren(tab);

  let wasShowing = false;

  const refresh = (): void => {
    const offer = game.adOffer();
    // Hidden behind any sheet, exactly like the quest and delve pills — the
    // map chrome must not compete with whatever the player just opened.
    const showing = offer !== null && !game.hasOpenSheet() && game.adWatch() === null;
    root.hidden = !showing;
    if (!showing) {
      wasShowing = false;
      return;
    }
    amount.textContent = `+${offer!.reward}`;
    if (!wasShowing) {
      // Restart the slide only when it genuinely arrives.
      tab.classList.remove('is-in');
      void tab.offsetWidth;
      tab.classList.add('is-in');
      wasShowing = true;
    }
  };

  game.onChange(refresh);
  refresh();
}
