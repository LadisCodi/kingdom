// Read-outs: cost chips, stat lines, pips, progress troughs, meters.
//
// Stateless pieces return an element. The one STATEFUL piece — progress —
// returns a handle instead, because that is what removes the untyped
// `querySelector('.fill') as HTMLElement` contract the old screens repeat in
// four places. You cannot hold a progress bar wrong if the only way to move
// it is the function it hands you.

import type { CurrencyId, Wallet } from '../../sim/state';
import { el } from '../format';
import { currencyIcon, iconEl, type IconName } from './icon';

/** icon + amount, e.g. one term of a cost. `short` turns it clay. */
export function chip(c: CurrencyId, amount: number, short = false): HTMLElement {
  return el(
    'span',
    { class: `k-chip${short ? ' is-short' : ''}` },
    currencyIcon(c, { size: 'sm' }),
    String(amount),
  );
}

/**
 * A whole cost as chips, each flagged against what the player actually has.
 * The affordability check lives here so no screen has to remember to do it.
 */
export function costChips(cost: Wallet, have?: (c: CurrencyId) => number): HTMLElement {
  const entries = Object.entries(cost) as Array<[CurrencyId, number]>;
  if (entries.length === 0) return el('span', { class: 'k-chips' }, el('span', {}, 'free'));
  return el(
    'span',
    { class: 'k-chips' },
    ...entries.map(([c, n]) => chip(c, n, have !== undefined && have(c) < n)),
  );
}

/** icon + value + unit — "1.5 per minute", "radius 3". */
export function stat(icon: IconName, value: string, unit?: string): HTMLElement {
  const parts: Array<Node | string> = [
    iconEl(icon, { size: 'sm' }),
    el('span', { class: 'k-stat-value' }, value),
  ];
  if (unit !== undefined) parts.push(el('span', { class: 'k-stat-unit' }, unit));
  return el('span', { class: 'k-stat' }, ...parts);
}

/** Countable progress, for totals small enough to read at a glance. */
export function pips(filled: number, total: number): HTMLElement {
  const row = el('span', { class: 'k-pips' });
  for (let i = 0; i < total; i++) {
    row.append(el('span', { class: `k-pip${i < filled ? ' is-on' : ''}` }));
  }
  return row;
}

/** A longer tally — army strength and the like. */
export function meter(filled: number, total: number): HTMLElement {
  const row = el('span', { class: 'k-meter' });
  for (let i = 0; i < total; i++) {
    row.append(el('span', { class: `k-tick${i < filled ? ' is-on' : ''}` }));
  }
  return row;
}

export interface Progress {
  root: HTMLElement;
  /** `fraction` is clamped to 0..1. */
  set(fraction: number, label?: string): void;
}

/** A carved trough with a fill you move through the returned handle. */
export function progress(tone: 'leaf' | 'sky' | 'gold' = 'leaf'): Progress {
  const fill = el('div', { class: 'k-fill' });
  const label = el('div', { class: 'k-trough-label' });
  const root = el(
    'div',
    { class: `k-trough${tone === 'leaf' ? '' : ` k-trough--${tone}`}` },
    fill,
    label,
  );
  return {
    root,
    set(fraction, text) {
      fill.style.width = `${Math.min(1, Math.max(0, fraction)) * 100}%`;
      label.textContent = text ?? '';
    },
  };
}
