// THE TOOLTIP — a line more about something, on a tap. Any element can carry
// one (`withTooltip`): a tap opens a small parchment bubble under it, with a
// soft pop; a second tap, or a tap anywhere else, closes it. One is open at a
// time across the whole UI.
//
// The bubble lives INSIDE its anchor, so it moves and is rebuilt with it, and
// opens below it: a bubble above the first line of a scrolling body would be
// cut off at the body's top edge. The fade and scale in and out are kit.css
// `.k-tip` — a transition, so closing plays too.

import { playSfx } from '../../audio/sfx';
import { el } from '../format';

let open: HTMLElement | null = null;

const close = (anchor: HTMLElement | null): void => {
  if (anchor === null) return;
  anchor.classList.remove('has-tip-open');
  anchor.setAttribute('aria-expanded', 'false');
  if (open === anchor) open = null;
};

// One listener for the page: a tap that is not on the open anchor closes it.
let armed = false;
const arm = (): void => {
  if (armed) return;
  armed = true;
  document.addEventListener('click', (e) => {
    if (open !== null && !open.contains(e.target as Node)) close(open);
  }, { capture: true });
};

/**
 * Give `anchor` a tooltip. `title` is set in bold ahead of `text` when given
 * ("Melee — Strong vs Lancers…"). Returns the anchor, so it drops into an
 * el(...) call.
 */
export function withTooltip<T extends HTMLElement>(anchor: T, text: string, title?: string): T {
  arm();
  anchor.classList.add('k-tip-anchor');
  anchor.setAttribute('aria-expanded', 'false');
  anchor.append(el('span', { class: 'k-tip', role: 'tooltip' },
    ...(title === undefined ? [] : [el('b', {}, title), ' — ']), text));
  anchor.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open === anchor) { close(anchor); return; }
    close(open);
    open = anchor;
    anchor.classList.add('has-tip-open');
    anchor.setAttribute('aria-expanded', 'true');
    playSfx('tooltip');
  });
  return anchor;
}
