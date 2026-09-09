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
 * One priced term inside a button. Most are wallet currencies, but not all:
 * Fragments are per-collectible counters rather than a `Wallet` entry, and a
 * price the player pays is a price whatever bucket it lives in.
 */
export interface CostTerm {
  icon: CurrencyId | IconName;
  /** Pre-formatted, so a term can read "3 / 20" and not only a bare number. */
  amount: string;
  /** The player cannot pay it — this is the term that turns clay. */
  short?: boolean;
}

const CURRENCY_ICON_IDS = new Set<string>([
  'Gold', 'Food', 'Wood', 'Stone', 'Iron', 'Knowledge', 'Stardust', 'Gems', 'Mana',
  'Berries', 'Meat', 'Fish',
]);

/** Is any term of this cost beyond what the player has? */
export function isShort(cost: Wallet, have?: (c: CurrencyId) => number): boolean {
  if (have === undefined) return false;
  return (Object.entries(cost) as Array<[CurrencyId, number]>).some(([c, n]) => have(c) < n);
}

/**
 * A cost as it appears INSIDE a button (§6.4).
 *
 * No pills here, unlike `costChips`: the button is already the container, and
 * a pill inside a slab reads as a control inside a control. Just icon and
 * number, inheriting the button's ink — except a term the player cannot pay,
 * which turns clay. That red IS the reason the button is disabled, which is
 * why an unaffordable action needs no separate reason line.
 *
 * Returns null for a free action, so a button with nothing to charge stays a
 * single line rather than growing an empty second one.
 */
export function costTerms(
  cost: Wallet | undefined,
  have?: (c: CurrencyId) => number,
  extra?: readonly CostTerm[],
): HTMLElement | null {
  const terms: CostTerm[] = [
    ...(Object.entries(cost ?? {}) as Array<[CurrencyId, number]>)
      .filter(([, n]) => n > 0)
      .map(([c, n]) => ({
        icon: c, amount: String(n), short: have !== undefined && have(c) < n,
      })),
    ...(extra ?? []),
  ];
  if (terms.length === 0) return null;
  return el(
    'span',
    { class: 'k-btn-cost' },
    ...terms.map((t) => el(
      'span',
      { class: `k-cost${t.short ? ' is-short' : ''}` },
      typeof t.icon === 'string' && CURRENCY_ICON_IDS.has(t.icon)
        ? currencyIcon(t.icon as CurrencyId, { size: 'sm' })
        : iconEl(t.icon as IconName, { size: 'sm' }),
      t.amount,
    )),
  );
}

/**
 * A whole cost as chips, each flagged against what the player actually has.
 * The affordability check lives here so no screen has to remember to do it.
 *
 * For a cost attached to a BUTTON, use `costTerms` instead — §6.4 puts those
 * inside the button. These pills are for costs that stand on their own, like
 * the supply line on the expedition sheet.
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
