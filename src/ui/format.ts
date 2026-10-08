// Formatting helpers and the two DOM primitives everything is built on.
//
// formatCost() used to live here, joining emoji into "20 🪵 + 10 🪨". That
// string concatenation was the thing blocking pixel icons; every caller now
// uses costChips() from the kit, which returns nodes. Gone with the last one.

import { tr } from '../i18n/tr';
import { playSfx } from '../audio/sfx';
import { currentLang, NUMBER_LOCALE } from '../i18n/lang';
import { TROOPS } from '../sim/data/definitions';
import type { CurrencyId, TroopId, UnitId } from '../sim/state';

/** Durations now span "instant" to "a day and a half" — a Tier V lair is a
 *  multi-day project — so this rolls up rather than reporting 2280m. Only the
 *  two largest units, because a third is noise at every scale. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return tr('instant');
  if (seconds < 60) return `${Math.round(seconds)}s`;
  // THE REMAINDER IS ROUNDED, SO IT CAN ROUND UP INTO A FULL UNIT: 59m 45s is
  // "60s" left of the minute, and a fortnight's countdown spends its first
  // half hour at 13d 24h. Carrying it into the bigger unit is the only place
  // that can be fixed — every caller reads the string.
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (s >= 60) return `${m + 1}m`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (m >= 60) return `${h + 1}h`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.round((seconds % 86_400) / 3600);
  if (h >= 24) return `${d + 1}d`;
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/**
 * A countdown read at a glance, on a widget that must not change width every
 * second: seconds only in the last minute, whole minutes (rounded up) below an
 * hour, and `formatDuration`'s two units above.
 */
export function formatCountdown(seconds: number): string {
  if (seconds < 60) return formatDuration(seconds);
  return formatDuration(Math.ceil(seconds / 60) * 60);
}

/**
 * THE PLAYER'S LANGUAGE decides how a number is written: *25,000* and *4.99*
 * in English, *25.000* and *4,99* in Spanish (src/i18n/lang.ts). Every number
 * the UI prints goes through the helpers below, which are the only place that
 * asks — a bare `n.toLocaleString()` anywhere else is refused by
 * tests/numberFormat.test.ts.
 *
 * Tests pin it with `setNumberLocale`.
 */
let numberLocale: string | undefined = NUMBER_LOCALE[currentLang()];
const formatters = new Map<string, Intl.NumberFormat>();

export function setNumberLocale(locale: string | undefined): void {
  numberLocale = locale;
  formatters.clear();
}

/** `n` grouped in the viewer's locale, with up to `maxDecimals` decimals
 *  (exactly `minDecimals` at least). */
export function formatNumber(n: number, maxDecimals = 0, minDecimals = 0): string {
  const key = `${maxDecimals}:${minDecimals}`;
  let f = formatters.get(key);
  if (f === undefined) {
    f = new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: maxDecimals, minimumFractionDigits: minDecimals,
    });
    formatters.set(key, f);
  }
  return f.format(n);
}

/**
 * A wallet number, short enough to live in the HUD.
 *
 * The resource plank has to hold four coins, the Mana gauge and Gems inside
 * 402px, and a late-game Gold of 248_610 is 42px of digits on its own — so
 * the row's width was a function of how well the player was doing, and the
 * coins at the end of it got clipped away as they did better. Rolling up at
 * ten thousand caps every coin at four digits forever: *9,999*, then *12k*.
 *
 * Only ever a DISPLAY form: nothing rounds, and tapping any coin opens the
 * purse, which prints the exact figure.
 */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return formatNumber(n, 1);
  if (abs < 1_000_000) return `${formatNumber(Math.trunc(n / 1000))}k`;
  // One decimal past a million, dropped when it is a zero: "1.2M", "14M".
  const millions = n / 1_000_000;
  return `${formatNumber(millions, Math.abs(millions) < 10 ? 1 : 0)}M`;
}

/**
 * The exact figure, grouped: "25,000".
 *
 * `formatCount` above abbreviates, which is right for a coin on the plank and
 * wrong for a PRIZE — "complete all eight to win 25k Gems" reads as an
 * estimate of a number the game knows exactly.
 */
export const formatExact = (n: number): string => formatNumber(n, 1);

/** A count cut short for a tight slot (a stat tile): *950*, *1.2k*, *29k*.
 *  Floored, so a store one short of full never reads as full. */
export function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000 && abs < 10_000) return `${formatNumber(Math.floor(n / 100) / 10, 1)}k`;
  return formatCount(Math.floor(n));
}

/** A price: *$4.99*, *$2,000.00* — or *$4,99* where the comma is the decimal.
 *  The game prices in dollars, and this is the one place that says so. */
export const formatUsd = (cents: number): string => `$${formatNumber(cents / 100, 2, 2)}`;

/** A currency as the player reads it, in their language: *Gold*, *Oro*. */
export function currencyName(c: CurrencyId): string {
  switch (c) {
    case 'Gold': return tr('Gold');
    case 'Food': return tr('Food');
    case 'Wood': return tr('Wood');
    case 'Stone': return tr('Stone');
    case 'Mana': return tr('Mana');
    case 'Knowledge': return tr('Knowledge');
    case 'Stardust': return tr('Stardust');
    case 'HeroXp': return tr('Hero XP');
    case 'Gems': return tr('Gems');
    default: return c;
  }
}

/** A kind of soldier, many of them, as the player reads it: *Warriors*,
 *  *Guerreros*. Spanish plurals are not an English `s`. */
export function unitsName(u: UnitId): string {
  switch (u) {
    case 'Warrior': return tr('Warriors');
    case 'Lancer': return tr('Lancers');
    case 'Archer': return tr('Archers');
    case 'Cavalry': return tr('Cavalry');
    default: return u;
  }
}

/** A troop, many of them, with its rank: *Lancers III*. */
export function troopsName(id: TroopId): string {
  const t = TROOPS[id];
  return t.rank > 1 ? `${unitsName(t.unit)} ${['', 'I', 'II', 'III', 'IV', 'V'][t.rank]}` : unitsName(t.unit);
}

/** A name that heads its row or window starts with a capital, even one the
 *  data keeps in lower case to read well mid-sentence ("crop plots"). */
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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

/** Name a control for the tutorial's pointer (Docs/features/24-dialogue.md
 *  §4): the stage finds it by `data-coach`. Returns the node, so it drops
 *  into an el(...) call. */
export function coach<T extends HTMLElement>(node: T, key: string): T {
  node.dataset.coach = key;
  return node;
}
