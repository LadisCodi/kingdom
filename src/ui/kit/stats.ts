// Read-outs: cost chips, stat lines, pips, progress troughs, meters.
//
// Stateless pieces return an element. The one STATEFUL piece — progress —
// returns a handle instead, because that is what removes the untyped
// `querySelector('.fill') as HTMLElement` contract the old screens repeat in
// four places. You cannot hold a progress bar wrong if the only way to move
// it is the function it hands you.

import type { CurrencyId, Wallet } from '../../sim/state';
import { el, formatCount, formatExact } from '../format';
import { currencyIcon, iconEl, type IconName } from './icon';

/** icon + amount, e.g. one term of a cost. `short` turns it clay. */
export function chip(c: CurrencyId, amount: number, short = false): HTMLElement {
  return el(
    'span',
    { class: `k-chip${short ? ' is-short' : ''}` },
    currencyIcon(c, { size: 'sm' }),
    formatExact(amount),
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
 * why an unaffordable action needs no separate reason line. A number rolls
 * up at ten thousand as the plank's coins do (*9,999*, then *10k*), so a
 * price never outgrows its button.
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
        icon: c, amount: formatCount(n), short: have !== undefined && have(c) < n,
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

/** A POWER, wherever one is written: the crossed swords and the figure, as
 *  the army boards show it — never the word "Power". */
export function powerTag(n: number): HTMLElement {
  return el('span', { class: 'k-power', 'aria-label': `Power ${formatExact(Math.round(n))}` },
    iconEl('power', { size: 'sm' }), el('b', {}, formatExact(Math.round(n))));
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

/** One term of a PRICE LINE: what it costs in one thing, red when short. */
export interface PriceTerm {
  icon: IconName;
  amount: string;
  short?: boolean;
  /** A picture of its own in place of the atlas icon — a hero's fragment. */
  art?: HTMLElement;
}

/**
 * THE PRICE LINE over a window's button (mockup M35): each term as a large
 * icon and its amount, in a centred row, any term the player is short of in
 * clay. `trailing` is for what is not a price but reads beside it — the
 * upgrade's build time.
 */
export function priceLine(terms: readonly PriceTerm[], ...trailing: Node[]): HTMLElement {
  return el('div', { class: 'k-price' },
    ...terms.map((t) => el('span', { class: `k-price-term${t.short ? ' is-short' : ''}` },
      t.art ?? iconEl(t.icon), el('b', {}, t.amount))),
    ...trailing);
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
  /** A TIMER: at `fraction` now, and full in `msLeft`. The fill runs there on
   *  its own, linearly, frame by frame (a Web Animation, so the compositor
   *  moves it and no script runs per frame) — a bar rebuilt every second
   *  starts where the last one was, so the motion is smooth, not a step a
   *  second. */
  run(fraction: number, msLeft: number, label?: string): void;
}

/** A bar's colour, one per meaning: gold for a goal (quests, collections),
 *  green for something being made (training, construction), blue for a
 *  resource filling up or a timer (Mana, research), red for a danger or a
 *  countdown to one. */
export type ProgressTone = 'gold' | 'green' | 'blue' | 'red';

/** THE PROGRESS BAR, the same one everywhere: a painted recess and a painted
 *  fill of one of four colours (kit.css `.k-trough`), moved through the
 *  returned handle. */
export function progress(tone: ProgressTone = 'green'): Progress {
  // Three layers, bottom to top (kit.css): the tube's dark inside (the
  // root's own background), the coloured fill — clipped to the tube's inner
  // pill, so it rises under the glass with a straight level — and the glass
  // tube itself, with its shine, over both. The reading sits on top of all.
  const fill = el('div', { class: 'k-fill' });
  const label = el('div', { class: 'k-trough-label' });
  const root = el(
    'div',
    { class: `k-trough k-trough--${tone}` },
    el('div', { class: 'k-trough-tube' }, fill),
    label,
  );
  return {
    root,
    run(fraction, msLeft, text) {
      this.set(fraction, text);
      const f = Math.min(1, Math.max(0, fraction));
      if (msLeft <= 0 || f >= 1 || typeof fill.animate !== 'function') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      fill.style.transition = 'none';
      fill.animate(
        [{ clipPath: `inset(0 ${(1 - f) * 100}% 0 0)` }, { clipPath: 'inset(0 0% 0 0)' }],
        { duration: msLeft, easing: 'linear', fill: 'forwards' },
      );
    },
    set(fraction, text) {
      // The fill is the whole tube's length and is uncovered from the left,
      // so its right edge is the liquid's level, not a rounded pill end.
      const f = Math.min(1, Math.max(0, fraction));
      fill.style.clipPath = `inset(0 ${(1 - f) * 100}% 0 0)`;
      label.textContent = text ?? '';
    },
  };
}

/**
 * A HERO'S HP, as the small bar that rides on its card (kit.css `.k-hp`):
 * the fill is the tube's whole length uncovered from the left, green, yellow
 * under half, red under a tenth. Where it sits is the caller's.
 */
export function hpBar(hp: number, max: number): HTMLElement {
  const share = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const fill = el('span', { class: 'k-hp-fill' });
  fill.style.clipPath = `inset(0 ${100 - Math.round(share * 100)}% 0 0)`;
  const tone = share < 0.1 ? ' is-red' : share < 0.5 ? ' is-yellow' : '';
  return el('span', {
    class: `k-hp${tone}`,
    role: 'meter', 'aria-label': `HP ${hp} of ${max}`,
    'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(hp),
  }, fill);
}

/** RESTING: three Zs rising off the figure's top-right (kit.css `.k-zzz`). */
export const restMarks = (): HTMLElement =>
  el('span', { class: 'k-zzz', 'aria-hidden': 'true' },
    el('span', {}, 'Z'), el('span', {}, 'Z'), el('span', {}, 'Z'));

/** How long a rest has left, as `3h 20m` / `12m` / `<1m`, in its pill. */
export function restLeft(ms: number): HTMLElement {
  const min = Math.ceil(ms / 60_000);
  const text = min < 1 ? '<1m' : min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
  return el('span', { class: 'k-rest-left' }, text);
}
