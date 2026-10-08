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
import { el, formatExact } from '../format';
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
  | 'build' | 'army' | 'research' | 'settings' | 'friends'
  | 'quest' | 'showme' | 'padlock' | 'hourglass' | 'clock' | 'tick'
  | 'close' | 'plus' | 'minus' | 'sparkle' | 'unknown' | 'star' | 'video'
  // The collection's own marks. `ascension` is the star on a hero's card and
  // is NOT `star`: that one is a generic highlight the district pips already
  // use, and a rung of a ladder should not change shape when a decoration
  // does. `fragment` is a hero SHARD — the relics keep `sparkle`, because the
  // art is a person and a relic is not one. (Hero XP needs no name here: it
  // is a `CurrencyId`, so it is already an `IconName`.)
  | 'ascension' | 'fragment'
  // The four a fighter is read by: Attack, Damage, Defence and Health
  // (combat.md §7). `atk` is the sword — the rating; `dmg` is the blow
  // landing — what one of it takes off.
  | 'atk' | 'dmg' | 'def' | 'hp'
  // A side's total strength — the crossed swords on an army's header.
  | 'power'
  // What a hero fights as, as a symbol — the hero card's corner and the hero
  // picker's filter: a sword, a lance, a bow, a horse's head. Not the units'
  // own portraits, which are faces and read as people at that size.
  | 'typeWarrior' | 'typeLancer' | 'typeArcher' | 'typeCavalry'
  // The upgrade popup's three (M25). `cross` is the REFUSAL beside a tick in
  // the requirements list — `close` is a knob that dismisses a sheet, and the
  // two must not share a picture. `arrowUp` is what a level does, drawn once
  // and turned on its side by CSS for the `before → after` pairs, so the two
  // directions cannot drift apart. `compass` is exploration range, which was
  // borrowing the pointing finger.
  | 'cross' | 'arrowUp' | 'compass'
  // A house's capacity, the villagers who can sleep in it — it was borrowing
  // the house itself, which is the building, not the number.
  | 'bed'
  // Four destinations that were borrowing a picture of something else. `relics`
  // is the tab, which wore the Mana orb until the pool got a sheet of its own;
  // `dungeon` is a lair mouth, which the delve pill drew as a quest scroll.
  // `chest` and `daily` are two halves of one screen and stay two cells: the
  // chest is the PRIZE and the calendar page is the DAY.
  | 'relics' | 'dungeon' | 'chest' | 'daily'
  // The mark the battle screen paints over a squad that is gone. It is the
  // one icon that is drawn ON something rather than beside it.
  | 'skull'
  // THE CARD COLLECTION (Docs/features/09-relics.md §11). `pack` is the thing
  // a lair pays and the reveal opens; `cards` is the nav tab, which replaced
  // the Reliquary's `relics` chest; `vault` is the safe in the corner of the
  // Collection, where duplicates go; `crest` is the season's wax seal, which
  // the pill wears and the header plank repeats.
  | 'pack' | 'cards' | 'vault' | 'crest'
  // One undiscovered map cell, its borders running past its corners so it
  // reads as a cell of the grid: the mark of a quest that reveals the map.
  | 'tile'
  // One hex of the world board, grass on earth: what the world ranking
  // counts a kingdom in.
  | 'hex'
  // The nav bar's two that were borrowing a picture: the Store's market stall
  // (it wore the Gems) and the Heroes' knight's helmet (it wore the shield).
  | 'shop' | 'helmet'
  // THE BAG (Docs/plans/relics-and-bag.md, sheet UI-I1): the nav's satchel,
  // a chest per coin and the one whose coin is chosen, the speed-up and the
  // badges its types wear (the anvil for workshops, the boot for marches),
  // the boosts, the flask, the tome, the Dowser's map and a relic's shard.
  | 'bag' | 'SilverKey' | 'GoldKey' | 'chestGold' | 'chestFood' | 'chestWood' | 'chestStone' | 'choiceChest'
  | 'speedup' | 'anvil' | 'boot' | 'boostRent' | 'boostHarvest' | 'boostMana'
  | 'flask' | 'tome' | 'dowserMap' | 'shard'
  // THE TECHNOLOGIES (sheet UI-T1, Docs/art/ui/tech/prompt.md): what a
  // regrowth, an irrigation, a sail and a farsight look like — the four a
  // tech card needed that nothing else in the atlas could stand for.
  | 'sapling' | 'wateringCan' | 'boat' | 'spyglass'
  // THE QUEST GOALS (sheet UI-Q1, Docs/art/ui/quests/prompt.md): the two a
  // quest's mark needed — one tree for "find forests", and the standing
  // stones for "claim landmarks", which wore the Mana orb.
  | 'tree' | 'landmark';

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
  // The world's precious materials (19 §7.4).
  Starmetal: '🌠', Heartwood: '🪵', Moonglass: '🔮',
  // districts
  Townhall: '🏛️', Housing: '🏠', Farm: '🌾', FarmLands: '🟩', Sawmill: '🪚',
  Quarry: '⛏️', Docks: '⚓', Sanctum: '🔯', Tavern: '🍺',
  Barracks: '🛖', SpearHall: '🏚️', ShootingGrounds: '🎯', Stables: '🐴',
  Infirmary: '⛑️', WarCamp: '⛺',
  Carpenter: '🔨', MasonsYard: '🧱', Smelter: '🔥', RuneCarver: '🔯',
  Flowerbed: '🌼', Bench: '🪑', Lantern: '🏮', Topiary: '🌳', Banner: '🚩', Birdbath: '🐦',
  Garden: '🌷', Well: '🪣', Orchard: '🌳', Statue: '🗿', Plaza: '⛲', Shrine: '⛩️', Watchtower: '🗼',
  // units
  Warrior: '⚔️', Lancer: '🔱', Archer: '🏹', Cavalry: '🐎',
  // destinations
  build: '🔨', army: '🛡️', research: '🔬', settings: '⚙️', friends: '👥',
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
  atk: '🗡️', dmg: '💥', def: '🛡️', hp: '❤️', power: '⚔️',
  typeWarrior: '🗡️', typeLancer: '🔱', typeArcher: '🏹', typeCavalry: '🐴',
  // the upgrade popup
  cross: '✗', arrowUp: '⬆', compass: '🧭', bed: '🛏️',
  // the fog
  tile: '⬛', hex: '⬢',
  // the nav bar
  shop: '🏪', helmet: '⛑️',
  // the Bag
  bag: '🎒', chestGold: '🪙', chestFood: '🍎', chestWood: '🪵', chestStone: '🪨', choiceChest: '🎁',
  speedup: '⏳', anvil: '⚒️', boot: '🥾', boostRent: '💰', boostHarvest: '🌾', boostMana: '🔮',
  flask: '🧪', tome: '📘', dowserMap: '🗺️', shard: '💠',
  // the technologies
  sapling: '🌱', wateringCan: '🚿', boat: '⛵', spyglass: '🔭',
  // the quest goals
  tree: '🌳', landmark: '🗿',
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
  frag.append(formatExact(amount), currencyIcon(c, { size: 'sm', ...opts }));
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

/** The symbol for what a unit or a hero fights as (`typeWarrior` …). */
export const unitTypeIcon = (unitId: UnitId): IconName => `type${unitId}` as IconName;
