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
//     stands NOW, plus an offset of its own — so no two orbs stir in step.
//     The offset comes from the badge's KEY, a name for what it marks (a
//     tech id, a hero, a cell), so a rebuilt badge lands on the same offset
//     and carries on exactly where the last one was. A badge on a lasting
//     host (setCta) needs no key: its node lives on, so a random offset,
//     drawn once, is stable by construction.
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

/** Write the count only when it changes: a lasting host refreshes every
 *  tick, and re-setting the attribute would dirty the orb's style for nothing. */
function setCount(badge: HTMLElement, count: number): void {
  const text = label(count);
  if ((badge.dataset.count ?? null) === text) return;
  if (text === null) delete badge.dataset.count;
  else badge.dataset.count = text;
}

/** A stable fraction in [0, 1) for a key — FNV-1a, so the same key always
 *  lands on the same offset. */
function fraction(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0x100000000;
}

/**
 * A badge for a screen that rebuilds itself: in phase with its last self, no
 * pop. `key` names what it marks, and sets its own offset on the shared
 * clock; without one the offset is random, which only a lasting host can
 * afford.
 */
export function ctaBadge(count = 1, key?: string): HTMLElement {
  const badge = el('span', { class: 'k-cta', 'aria-hidden': 'true' });
  const now = performance.now();
  const f = key === undefined ? Math.random() : fraction(key);
  // The halo gets its own share of the offset, so the orb and its glow do not
  // move as one either.
  const g = key === undefined ? Math.random() : fraction(`${key}:halo`);
  badge.style.setProperty('--cta-wake-delay', `${-((now + f * WAKE_MS) % WAKE_MS)}ms`);
  badge.style.setProperty('--cta-halo-delay', `${-((now + g * HALO_MS) % HALO_MS)}ms`);
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
