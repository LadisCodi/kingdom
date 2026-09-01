// The banner: the game's one channel for news worth enjoying (§5.3).
//
// Good news and bad news used to look identical — the same slate rectangle
// announced "Sawmill complete!" and "Build queue is full". They are now two
// channels: this cloth pennant drops from the top for anything the player
// should be pleased about, and failures get a small parchment slip down by
// the nav (see #toast in main.ts).
//
// Banners still QUEUE: one at a time, each with its full five seconds, so a
// burst of offline completions is readable instead of stacking.

import { playSfx } from '../audio/sfx';
import { spriteUrl } from '../render/sprites';
import type { Banner, Game } from '../game';
import { el } from './format';

const SHOW_MS = 5000;
const LEAVE_MS = 300;

/** The subject's own art when it has some, else its glyph. */
function subject(banner: Banner): HTMLElement {
  const url = banner.sprite ? spriteUrl(banner.sprite) : null;
  if (url === null) return el('span', { class: 'b-glyph' }, banner.icon);
  const img = el('img', { class: 'b-art', src: url, alt: '' });
  return img;
}

export function mountBanner(game: Game, root: HTMLElement): void {
  let showing = false;

  const showNext = () => {
    if (showing) return;
    const banner = game.takeBanner();
    if (banner === null) return;

    showing = true;
    playSfx(banner.sfx ?? 'discovery');
    const card = el('div', { class: `b-pennant b-${banner.tone ?? 'gold'}` },
      el('div', { class: 'b-rope' }),
      el('div', { class: 'b-body' },
        el('div', { class: 'b-slot' }, subject(banner)),
        el('div', { class: 'b-text' },
          el('div', { class: 'b-title' }, banner.title),
          el('div', { class: 'b-name' }, banner.name),
          el('div', { class: 'b-desc' }, banner.desc))),
      // The swallowtail notch, drawn rather than drawn-on.
      el('div', { class: 'b-tail' }));
    root.replaceChildren(card);

    let leaving = false;
    const leave = () => {
      if (leaving) return;
      leaving = true;
      clearTimeout(showTimer);
      card.classList.add('is-leaving');
      setTimeout(() => {
        if (card.parentElement === root) root.replaceChildren();
        showing = false;
        showNext(); // the queue advances — one card at a time
      }, LEAVE_MS);
    };
    const showTimer = setTimeout(leave, SHOW_MS);
    card.addEventListener('pointerdown', leave); // tap anywhere to disband
  };

  game.onChange(showNext);
  showNext();
}
