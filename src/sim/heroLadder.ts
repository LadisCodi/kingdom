// The hero ladder (Docs/features/10-heroes.md §1, §4).
//
// Collect → the ascension caps the level → Hero XP buys levels inside the cap
// → Fragments plus a Stardust toll raise the ascension. One shape, two
// numbers: the ascension is the ceiling and the XP is the climb.
//
// AN ASCENSION IS ONE POINT OF A STAR. A hero has `ascensionStars` stars of
// `ascensionStepsPerStar` points each, filled one point at a time; a FULL
// star is what raises the level cap. Every point of a star costs the same,
// and each star costs `growth` times the one before.
//
// IT USED TO BE SHARED WITH THE RELICS and is not any more. A relic is
// levelled by finishing its album and by nothing else — no ascension, no
// Fragments, no cap, no Stardust (Docs/features/09-relics.md §13).

import { roundPrice } from './roundPrice';
import { HERO_LADDER, type HeroDef } from './data/definitions';

/** What one hero looks like in the collection. `ascension` counts points
 *  filled, 0 to `maxAscension()`. */
export interface CollectionEntry {
  level: number;
  ascension: number;
  fragments: number;
}

export const emptyEntry = (): CollectionEntry => ({ level: 1, ascension: 0, fragments: 0 });

/** Every point of every star: the last ascension. */
export const maxAscension = (): number =>
  HERO_LADDER.ascensionStars * HERO_LADDER.ascensionStepsPerStar;

/** Stars completed at this ascension. */
export const fullStars = (ascension: number): number =>
  Math.floor(Math.min(ascension, maxAscension()) / HERO_LADDER.ascensionStepsPerStar);

/** Hero XP for a HERO's next level — `base × growth^level`, rounded to three
 *  figures like every calculated price (sim/roundPrice.ts). */
export const xpLevelCost = (level: number): number =>
  roundPrice(HERO_LADDER.xpLevelCostBase * HERO_LADDER.xpLevelCostGrowth ** level);

/** Fragments for the ascension that fills the point after `ascension`: the
 *  same for every point of a star, `growth` times dearer each star. */
export const ascensionFragmentCost = (ascension: number): number =>
  roundPrice(HERO_LADDER.fragmentsPerStepBase * HERO_LADDER.fragmentsPerStepGrowth ** fullStars(ascension));

/** The highest level an ascension allows: each FULL star adds
 *  `heroLevelsPerStar`, and every star full is `heroMaxLevel`. */
export const heroLevelCap = (ascension: number): number =>
  HERO_LADDER.heroMaxLevel
  - (HERO_LADDER.ascensionStars - fullStars(ascension)) * HERO_LADDER.heroLevelsPerStar;

/**
 * A hero's body — Attack, Defense and HP — at a level and an ascension. The
 * level adds its flat steps; EVERY ascension point then multiplies all three
 * by `statsPerAscension` more. The one formula: the card, the board, the
 * estimate and the HP bar all read it.
 */
export function heroBody(def: HeroDef, level: number, ascension = 0): { atk: number; dmg: number; def: number; hp: number } {
  const step = level - 1;
  const mult = 1 + HERO_LADDER.statsPerAscension * Math.min(ascension, maxAscension());
  return {
    atk: (def.atk + def.atkPerLevel * step) * mult,
    dmg: (def.dmg + def.dmgPerLevel * step) * mult,
    def: (def.def + def.defPerLevel * step) * mult,
    hp: (def.hp + def.hpPerLevel * step) * mult,
  };
}

export const isHeroMaxLevel = (e: CollectionEntry): boolean =>
  e.level >= HERO_LADDER.heroMaxLevel;
export const isMaxAscension = (e: CollectionEntry): boolean => e.ascension >= maxAscension();

export type AscensionBlock = 'AtMaxAscension' | 'NotEnoughFragments';

export function ascensionBlock(e: CollectionEntry): AscensionBlock | null {
  if (isMaxAscension(e)) return 'AtMaxAscension';
  if (e.fragments < ascensionFragmentCost(e.ascension)) return 'NotEnoughFragments';
  return null;
}
