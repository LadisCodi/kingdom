import { icon } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';

import { playSfx } from '../audio/sfx';

export const formatCost = (cost: Wallet): string =>
  Object.entries(cost)
    .map(([c, n]) => `${n} ${icon(c as CurrencyId)}`)
    .join(' + ') || 'free';

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'instant';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
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
