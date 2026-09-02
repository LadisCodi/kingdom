// Icons as DOM, not as characters in a string.
//
// The obstacle this removes: `icon()` in src/game.ts returns an emoji and
// `formatCost` joins those into "20 🪵 + 10 🪨". A pixel icon is a NODE, not
// a character, so every call site that interpolates one into a template
// literal blocks the atlas. The lever is that `el()` already accepts
// `Node | string` children and DocumentFragment is a Node — so these drop
// into existing el(...) calls with no signature changes.
//
// Until the atlas exists, an icon renders its emoji as text inside a
// fixed-size box. Same contract as drawSprite() returning false: call sites
// are written against the real API now and upgrade in place when the art
// lands, with no further churn.
//
// `icon()` in game.ts stays — the canvas floaters draw text and genuinely
// need a string.

import { CURRENCIES } from '../../sim/data/definitions';
import type { CurrencyId, DistrictId, UnitId, Wallet } from '../../sim/state';
import { el } from '../format';
import { ATLAS_CELLS } from './atlas.generated';

/** Names that are not currencies or districts. */
export type UiIconName =
  | 'population' | 'builders' | 'workers'
  | 'build' | 'army' | 'research' | 'settings'
  | 'quest' | 'showme' | 'padlock' | 'hourglass' | 'clock' | 'tick'
  | 'close' | 'plus' | 'minus' | 'sparkle' | 'unknown' | 'star';

export type IconName = CurrencyId | DistrictId | UnitId | UiIconName;

/** The fallback glyph for every icon, and — once the atlas lands — the
 *  checklist of cells it must contain. Exhaustive by construction: adding a
 *  currency or district without a glyph fails `tsc`. */
export const ICON_EMOJI: Record<IconName, string> = {
  // currencies
  Gold: '🪙', Food: '🍎', Wood: '🪵', Stone: '🪨', Iron: '⚙️', Mana: '🔮',
  Berries: '🫐', Meat: '🍖', Fish: '🐟', Knowledge: '📜', Gems: '💎',
  // districts
  Townhall: '🏛️', Housing: '🏠', Farm: '🌾', FarmLands: '🟩', Sawmill: '🪚',
  Market: '🏪', Quarry: '⛏️', Docks: '⚓', Mine: '⚒️', Sanctum: '🔯',
  // units
  Warrior: '⚔️', Lancer: '🔱', Archer: '🏹', Cavalry: '🐎',
  // destinations
  build: '🔨', army: '🛡️', research: '🔬', settings: '⚙️',
  // city status + affordances
  population: '👥', builders: '👷', workers: '🧑‍🌾',
  quest: '📜', showme: '👉', padlock: '🔒', hourglass: '⏳', clock: '🕐',
  tick: '✓', close: '✕', plus: '+', minus: '−', sparkle: '✨', unknown: '?',
  star: '★', // district card level pips (Phase 3)
};

export interface IconOpts {
  size?: 'sm' | 'md' | 'lg';
  locked?: boolean;
  /** Screen-reader label; defaults to the icon's own name. */
  label?: string;
}

/**
 * Pick the best cell the atlas has for this request.
 *
 * `-locked` is a DERIVED desaturation rather than a CSS filter, so the
 * silhouette is pixel-identical and a row can't shift when an item locks.
 * `-sm` is authored at 16 logical pixels for the icons that would otherwise
 * turn to mush inline. Both fall back to the plain cell, and the plain cell
 * falls back to the emoji — so art can land one sheet, or one variant, at a
 * time.
 */
function atlasCell(name: IconName, opts: IconOpts): string | null {
  const suffixes: string[] = [];
  if (opts.locked && opts.size === 'sm') suffixes.push(`${name}-sm-locked`);
  if (opts.locked) suffixes.push(`${name}-locked`);
  if (opts.size === 'sm') suffixes.push(`${name}-sm`);
  suffixes.push(name);
  return suffixes.find((cell) => ATLAS_CELLS.has(cell)) ?? null;
}

export function iconEl(name: IconName, opts: IconOpts = {}): HTMLElement {
  const cell = atlasCell(name, opts);
  const classes = ['icon', `icon-${cell ?? name}`];
  if (opts.size === 'sm') classes.push('icon--sm');
  if (opts.size === 'lg') classes.push('icon--lg');
  // Only tint when the atlas has no dedicated locked cell to use instead.
  if (opts.locked && cell !== `${name}-locked` && cell !== `${name}-sm-locked`) {
    classes.push('is-locked');
  }
  if (cell === null) classes.push('icon--emoji');
  const node = el('i', {
    class: classes.join(' '),
    role: 'img',
    'aria-label': opts.label ?? name,
  });
  // No cell → the emoji stands in, and the class is already right, so the
  // atlas takes over by CSS alone once the art lands.
  if (cell === null) node.textContent = ICON_EMOJI[name];
  return node;
}

export const currencyIcon = (c: CurrencyId, opts: IconOpts = {}): HTMLElement =>
  iconEl(c, { label: c, ...opts });

/** "20 <wood>" as nodes — the amount, then its icon. */
export function amountEls(amount: number, c: CurrencyId, opts: IconOpts = {}): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(String(amount), currencyIcon(c, { size: 'sm', ...opts }));
  return frag;
}

/** The formatCost() replacement: "20 <wood> + 10 <stone>", as nodes. */
export function costEls(cost: Wallet): DocumentFragment {
  const frag = document.createDocumentFragment();
  const entries = Object.entries(cost) as Array<[CurrencyId, number]>;
  if (entries.length === 0) {
    frag.append('free');
    return frag;
  }
  entries.forEach(([c, n], i) => {
    if (i > 0) frag.append(' + ');
    frag.append(amountEls(n, c));
  });
  return frag;
}

/** Every currency the game defines, for the gallery and the purse sheet. */
export const ALL_CURRENCIES = Object.keys(CURRENCIES) as CurrencyId[];
