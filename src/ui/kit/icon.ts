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
import type { CurrencyId, DistrictId, GoodId, UnitId, Wallet } from '../../sim/state';
import { el } from '../format';
import { ATLAS_CELLS } from './atlas.generated';

/** Names that are not currencies or districts.
 *
 *  Berries, Meat, Fish and Iron live here rather than under `CurrencyId`.
 *  They stopped being currencies when the harvest table started paying Food
 *  and Stone directly, but they are still CELLS the player taps and the
 *  atlas still holds their art — so the names survive as icons. */
export type UiIconName =
  | 'Berries' | 'Meat' | 'Fish' | 'Iron'
  | 'population' | 'builders' | 'workers' | 'harmony'
  | 'build' | 'army' | 'research' | 'settings'
  | 'quest' | 'showme' | 'padlock' | 'hourglass' | 'clock' | 'tick'
  | 'close' | 'plus' | 'minus' | 'sparkle' | 'unknown' | 'star' | 'video'
  // The collection's own marks. `ascension` is the star on a hero's card and
  // is NOT `star`: that one is a generic highlight the district pips already
  // use, and a rung of a ladder should not change shape when a decoration
  // does. `fragment` is a hero SHARD — the relics keep `sparkle`, because the
  // art is a person and a relic is not one. (Hero XP needs no name here: it
  // is a `CurrencyId`, so it is already an `IconName`.)
  | 'ascension' | 'fragment'
  // The three a hero fights with. They were borrowing `army`, `padlock` and
  // `population` — a shield for attack, a padlock for defence and a crowd for
  // health — which is three wrong pictures in one row.
  | 'atk' | 'def' | 'hp'
  // Four destinations that were borrowing a picture of something else. `relics`
  // is the tab, which wore the Mana orb until the pool got a sheet of its own;
  // `dungeon` is a ruin mouth, which the delve pill drew as a quest scroll.
  // `chest` and `daily` are two halves of one screen and stay two cells: the
  // chest is the PRIZE and the calendar page is the DAY.
  | 'relics' | 'dungeon' | 'chest' | 'daily'
  // The mark the battle screen paints over a squad that is gone. It is the
  // one icon that is drawn ON something rather than beside it.
  | 'skull'
  // THE CARD COLLECTION (Docs/features/09-relics.md §11). `pack` is the thing
  // a ruin pays and the reveal opens; `cards` is the nav tab, which replaced
  // the Reliquary's `relics` chest; `vault` is the safe in the corner of the
  // Collection, where duplicates go; `crest` is the season's wax seal, which
  // the pill wears and the header plank repeats.
  | 'pack' | 'cards' | 'vault' | 'crest';

export type IconName = CurrencyId | DistrictId | UnitId | GoodId | UiIconName;

/** The fallback glyph for every icon, and — once the atlas lands — the
 *  checklist of cells it must contain. Exhaustive by construction: adding a
 *  currency or district without a glyph fails `tsc`. */
export const ICON_EMOJI: Record<IconName, string> = {
  // currencies
  Gold: '🪙', Food: '🍎', Wood: '🪵', Stone: '🪨', Mana: '🔮',
  Knowledge: '📜', Stardust: '🌟', HeroXp: '📘', Gems: '💎',
  SilverKey: '🗝️', GoldKey: '🔑',
  // harvest cells that pay one of the above
  Berries: '🫐', Meat: '🍖', Fish: '🐟', Iron: '⚙️',
  // Refined goods. `Iron` is both a good and one of the retired cell icons
  // above, and shares the one cell: the ore and the ingot are the same
  // picture at 16 px.
  Planks: '🪵', CutStone: '🧱', Runestone: '🔯',
  // districts
  Townhall: '🏛️', Housing: '🏠', Farm: '🌾', FarmLands: '🟩', Sawmill: '🪚',
  Quarry: '⛏️', Docks: '⚓', Sanctum: '🔯',
  Barracks: '🛖', SpearHall: '🏚️', ShootingGrounds: '🎯', Stables: '🐴',
  Infirmary: '⛑️',
  Carpenter: '🔨', MasonsYard: '🧱', Smelter: '🔥', RuneCarver: '🔯',
  Garden: '🌷', Well: '🪣', Orchard: '🌳', Statue: '🗿', Plaza: '⛲', Shrine: '⛩️',
  // units
  Warrior: '⚔️', Lancer: '🔱', Archer: '🏹', Cavalry: '🐎',
  // destinations
  build: '🔨', army: '🛡️', research: '🔬', settings: '⚙️',
  // city status + affordances
  population: '👥', builders: '👷', workers: '🧑‍🌾', harmony: '🌸',
  quest: '📜', showme: '👉', padlock: '🔒', hourglass: '⏳', clock: '🕐',
  tick: '✓', close: '✕', plus: '+', minus: '−', sparkle: '✨', unknown: '?',
  star: '★', // district card level pips (Phase 3)
  video: '▶', // a rewarded video — the mark on any button an ad pays for
  // the collection
  ascension: '★', fragment: '🧩',
  // destinations that are not nav tabs
  relics: '🔮', dungeon: '🏚️', chest: '🎁', daily: '📅', skull: '💀',
  pack: '🎴', cards: '🃏', vault: '🔐', crest: '🌾',
  // a hero's three numbers
  atk: '🗡️', def: '🛡️', hp: '❤️',
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
