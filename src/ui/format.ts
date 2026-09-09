// Formatting helpers and the two DOM primitives everything is built on.
//
// formatCost() used to live here, joining emoji into "20 🪵 + 10 🪨". That
// string concatenation was the thing blocking pixel icons; every caller now
// uses costChips() from the kit, which returns nodes. Gone with the last one.

import { playSfx } from '../audio/sfx';

/** Durations now span "instant" to "a day and a half" — a Tier V ruin is a
 *  multi-day project — so this rolls up rather than reporting 2280m. Only the
 *  two largest units, because a third is noise at every scale. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'instant';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.round((seconds % 86_400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/**
 * A wallet number, short enough to live in the HUD.
 *
 * The resource plank has to hold four coins, the Mana gauge and Gems inside
 * 402px, and a late-game Gold of 248_610 is 42px of digits on its own — so
 * the row's width was a function of how well the player was doing, and the
 * coins at the end of it got clipped away as they did better. Rolling up at
 * ten thousand caps every coin at four characters forever.
 *
 * Only ever a DISPLAY form: nothing rounds, and tapping any coin opens the
 * purse, which prints the exact figure.
 */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return String(n);
  if (abs < 1_000_000) return `${Math.floor(n / 1000)}k`;
  // One decimal past a million, dropped when it is a zero: "1.2M", "14M".
  const millions = n / 1_000_000;
  return `${millions.toFixed(millions < 10 ? 1 : 0).replace(/\.0$/, '')}M`;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  // `btn` carries the base styling that used to come from a bare `button`
  // element selector — see src/style.css. Kept explicit so the new kit's
  // buttons can't inherit it by accident.
  const b = el('button', { class: className ? `btn ${className}` : 'btn' }, label);
  b.addEventListener('click', () => {
    playSfx('click'); // every UI button clicks audibly (disabled ones don't fire)
    onClick();
  });
  return b;
}
