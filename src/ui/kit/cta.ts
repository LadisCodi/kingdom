// THE CALL TO ACTION: one badge for every "there is something for you here"
// in the game — a small scrying orb on its host's corner, a red halo
// breathing behind it, a glint stirring inside, and the count on it when
// there is more than one thing waiting ("2" … "9", then "9+").
//
// The look is kit.css's `.k-cta`. This file only decides two things CSS
// cannot:
//
//   * THE PHASE. Many sheets rebuild their DOM every tick, and a badge built
//     fresh each second would restart its animation each second and never get
//     past its first frames. So a badge takes its phase from the page clock:
//     its animation delay is set, at creation, to where one shared timeline
//     stands NOW. A rebuilt badge carries on exactly where the last one was,
//     and every orb on screen stirs in unison.
//   * THE POP. A badge pops in when it APPEARS — which only a host that
//     persists can tell. `setCta` is for those (the nav bar, the map pills):
//     it adds the badge once, pops it, and only updates the count after.
//     `ctaBadge` builds one for a screen that is rebuilt anyway, without the
//     pop, which would otherwise replay every tick.

import { el } from '../format';

/** The two loops, in ms — kept equal to kit.css's `k-cta-wake` / `k-cta-halo`. */
const WAKE_MS = 6400;
const HALO_MS = 11000; // 5.5 s each way, alternating

/** "2" … "9", then "9+"; nothing for one. */
const label = (count: number): string | null =>
  count > 9 ? '9+' : count > 1 ? String(count) : null;

function setCount(badge: HTMLElement, count: number): void {
  const text = label(count);
  if (text === null) delete badge.dataset.count;
  else badge.dataset.count = text;
}

/** A badge for a screen that rebuilds itself: in phase, no pop. */
export function ctaBadge(count = 1): HTMLElement {
  const badge = el('span', { class: 'k-cta', 'aria-hidden': 'true' });
  const now = performance.now();
  badge.style.setProperty('--cta-wake-delay', `${-(now % WAKE_MS)}ms`);
  badge.style.setProperty('--cta-halo-delay', `${-(now % HALO_MS)}ms`);
  setCount(badge, count);
  return badge;
}

/**
 * Show, update or remove the badge on a host that persists across refreshes.
 * `count` 0 removes it; a new badge pops in; an existing one keeps its node,
 * so its animation is never restarted by a refresh. The host needs
 * `position: relative` (or any positioning) for the badge to sit on its corner.
 */
export function setCta(host: HTMLElement, count: number): void {
  let badge = host.querySelector<HTMLElement>(':scope > .k-cta');
  if (count <= 0) {
    badge?.remove();
    return;
  }
  if (badge === null) {
    badge = ctaBadge(count);
    badge.classList.add('is-new');
    host.append(badge);
    return;
  }
  setCount(badge, count);
}
