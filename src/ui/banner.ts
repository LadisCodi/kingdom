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
//
// Each UNFURLS from the rod it hangs on and furls back up when it goes
// (below); the cloth is the painted M1 banner, in the tone of what happened.

import { playSfx } from '../audio/sfx';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Banner, Game } from '../game';
import { el } from './format';

const SHOW_MS = 5000;
/** The unfurl: the cloth grows from rod-and-point to its full height, and the
 *  words fade in once it is 80% of the way there. */
const OPEN_MS = 520;
const WORDS_AT = 0.8;
const WORDS_MS = 220;
/** The furl: the words go, then the cloth shrinks back and fades. */
const CLOSE_WORDS_MS = 160;
const CLOSE_MS = 420;

const calm = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The subject's own art when it has some, else its glyph. */
function subject(banner: Banner): HTMLElement {
  const url = banner.sprite ? spriteUrl(banner.sprite) : null;
  if (url === null) return el('span', { class: 'b-glyph' }, banner.icon);
  return spriteImgAt(url, 'b-art');
}

/** The cloth at its least: the rod and the point with no middle between them,
 *  which is the shortest it can be drawn without squashing either. */
function rolledHeight(base: HTMLElement): number {
  const cs = getComputedStyle(base);
  return parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
}

export function mountBanner(game: Game, root: HTMLElement): void {
  let showing = false;

  const showNext = () => {
    if (showing) return;
    const banner = game.takeBanner();
    if (banner === null) return;

    showing = true;
    playSfx(banner.sfx ?? 'discovery');
    // The painted cloth is its own layer (nine-sliced vertically, banner.css),
    // so it can unfurl under words that never reflow. Top to bottom, as M1:
    // the subject, what happened, its name, a line about it.
    const base = el('div', { class: 'b-base', 'aria-hidden': 'true' });
    const content = el('div', { class: 'b-content' },
      el('div', { class: 'b-slot' }, subject(banner)),
      el('div', { class: 'b-title' }, banner.title),
      el('div', { class: 'b-name' }, banner.name),
      el('div', { class: 'b-desc' }, banner.desc));
    const card = el('div', { class: `b-pennant b-${banner.tone ?? 'gold'}`, role: 'status' },
      base, content);
    root.replaceChildren(card);

    // THE UNFURL. The card's height is the words'; the cloth grows from its
    // rolled height to that, fading in, and the words follow near the end.
    const fast = calm();
    const full = card.offsetHeight;
    const rolled = rolledHeight(base);
    base.animate([
      { height: `${rolled}px`, opacity: 0 },
      { height: `${full}px`, opacity: 1 },
    ], { duration: fast ? 0 : OPEN_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'backwards' });
    content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: fast ? 0 : WORDS_MS, delay: fast ? 0 : OPEN_MS * WORDS_AT, fill: 'backwards',
    });

    let leaving = false;
    const leave = async () => {
      if (leaving) return;
      leaving = true;
      clearTimeout(showTimer);
      // THE FURL, backwards: the words go, then the cloth rolls up to its
      // rod and point, and only then fades.
      const now = calm();
      await content.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: now ? 0 : CLOSE_WORDS_MS, fill: 'forwards',
      }).finished.catch(() => undefined);
      await base.animate([
        { height: `${card.offsetHeight}px`, opacity: 1 },
        { height: `${rolled}px`, opacity: 1, offset: 0.75 },
        { height: `${rolled}px`, opacity: 0 },
      ], { duration: now ? 0 : CLOSE_MS, easing: 'cubic-bezier(0.5, 0, 0.8, 0.5)', fill: 'forwards' })
        .finished.catch(() => undefined);
      if (card.parentElement === root) root.replaceChildren();
      showing = false;
      showNext(); // the queue advances — one card at a time
    };
    const showTimer = setTimeout(() => { void leave(); }, SHOW_MS);
    card.addEventListener('pointerdown', () => { void leave(); }); // tap anywhere to disband
  };

  game.onChange(showNext);
  showNext();
}
