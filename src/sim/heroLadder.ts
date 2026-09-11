// The hero ladder (Docs/features/10-heroes.md §1, §4).
//
// Collect → a tier caps the level → Hero XP buys levels inside the cap →
// Fragments plus a Stardust toll raise the cap. One shape, two numbers: the
// tier is the ceiling and the XP is the climb.
//
// IT USED TO BE SHARED WITH THE RELICS and is not any more. A relic is
// levelled by finishing its album and by nothing else — no tier, no
// Fragments, no cap, no Stardust (Docs/features/09-relics.md §13) — so the
// half of this file that priced a relic's levels went with it, and what is
// left is a hero's ladder under a name that says so.

import { COLLECTION } from './data/definitions';

/** What one collectible looks like, whatever KIND of thing it is. */
export interface CollectionEntry {
  level: number;
  tier: number;
  fragments: number;
}

export const emptyEntry = (): CollectionEntry => ({ level: 1, tier: 1, fragments: 0 });

/** Hero XP for a HERO's next level — `round(base × growth^level)`, the same
 *  shape the gold upgrades already use, reused rather than reinvented. */
export const xpLevelCost = (level: number): number =>
  Math.round(COLLECTION.xpLevelCostBase * COLLECTION.xpLevelCostGrowth ** level);

/** Fragments to raise the tier cap from `tier` to `tier + 1`. */
export const tierCost = (tier: number): number =>
  Math.round(COLLECTION.fragmentsPerTierBase * COLLECTION.fragmentsPerTierGrowth ** (tier - 1));

/** The highest level a hero's ascension allows. An ascension is worth TEN
 *  levels, which is what makes it the thing the collection arc is spent on. */
export const heroLevelCapForTier = (tier: number): number =>
  Math.min(COLLECTION.heroMaxLevel, tier * COLLECTION.heroLevelsPerTier);

export const isHeroMaxLevel = (e: CollectionEntry): boolean =>
  e.level >= COLLECTION.heroMaxLevel;
export const isMaxTier = (e: CollectionEntry): boolean => e.tier >= COLLECTION.maxTier;

export type TierBlock = 'AtMaxTier' | 'NotEnoughFragments';

export function tierBlock(e: CollectionEntry): TierBlock | null {
  if (isMaxTier(e)) return 'AtMaxTier';
  if (e.fragments < tierCost(e.tier)) return 'NotEnoughFragments';
  return null;
}
