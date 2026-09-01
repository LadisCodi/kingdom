// The banner: the game's one notification channel. Anything the player must
// notice — a first-time discovery, finished research, a building unlocked or
// completed — slides a card in at the top for 5 seconds with a chime.
// Banners QUEUE: while one is on screen, new events wait their turn instead
// of stacking; each gets its full 5 seconds.

import { playSfx } from '../audio/sfx';
import type { Game } from '../game';
import { el } from './format';

const SHOW_MS = 5000;
const LEAVE_MS = 300;

export function mountBanner(game: Game, root: HTMLElement): void {
  let showing = false;

  const showNext = () => {
    if (showing) return;
    const banner = game.takeBanner();
    if (banner === null) return;

    showing = true;
    playSfx('discovery');
    const card = el('div', { class: 'notice-card' },
      el('span', { class: 'big' }, banner.icon),
      el('div', {},
        el('div', { class: 'title' }, banner.title),
        el('div', { class: 'name' }, banner.name),
        el('div', { class: 'desc' }, banner.desc)));
    root.replaceChildren(card);
    let leaving = false;
    const leave = () => {
      if (leaving) return;
      leaving = true;
      clearTimeout(showTimer);
      card.classList.add('leaving');
      setTimeout(() => {
        if (card.parentElement === root) root.replaceChildren();
        showing = false;
        showNext(); // the queue advances — one card at a time
      }, LEAVE_MS);
    };
    const showTimer = setTimeout(leave, SHOW_MS);
    // Clicking anywhere on the banner disbands it right away.
    card.addEventListener('pointerdown', leave);
  };

  game.onChange(showNext);
  showNext();
}
