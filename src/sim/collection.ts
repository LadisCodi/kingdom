// The collection substrate (Docs/features/heroes-and-gacha.md §"The
// load-bearing constraint").
//
// Heroes-with-a-gacha and artifacts are structurally the same thing: collect →
// fragment → level → equip into limited slots. Built as two systems they would
// teach the player the same lesson twice and neither would feel special. So
// there is ONE set of rules here, and heroes and artifacts are two kinds of
// thing rather than two systems with two vocabularies:
//
//   FRAGMENTS raise a tier cap.   KNOWLEDGE buys levels within it.
//
// Fragments come from repeat delves AND from gacha duplicates, which is what
// makes "every gacha drop has a play-based route" true: the wallet buys speed
// and breadth, never access.

import { COLLECTION } from './data/definitions';

/** What one collectible looks like, whatever KIND of thing it is. */
export interface CollectionEntry {
  level: number;
  tier: number;
  fragments: number;
}

export const emptyEntry = (): CollectionEntry => ({ level: 1, tier: 1, fragments: 0 });

/** Stardust for the NEXT level. `round(base × growth^level)` — the same
 *  formula the gold upgrades already use, reused rather than reinvented. */
export const levelCost = (level: number): number =>
  Math.round(COLLECTION.levelCostBase * COLLECTION.levelCostGrowth ** level);

/** Fragments to raise the tier cap from `tier` to `tier + 1`. */
export const tierCost = (tier: number): number =>
  Math.round(COLLECTION.fragmentsPerTierBase * COLLECTION.fragmentsPerTierGrowth ** (tier - 1));

/** The highest level this tier allows. A tier is worth exactly two levels, so
 *  a chase for Fragments always converts into somewhere for Stardust to go. */
export const levelCapForTier = (tier: number): number =>
  Math.min(COLLECTION.maxLevel, tier * COLLECTION.levelsPerTier);

export const isMaxLevel = (e: CollectionEntry): boolean => e.level >= COLLECTION.maxLevel;
export const isMaxTier = (e: CollectionEntry): boolean => e.tier >= COLLECTION.maxTier;

/** Everything the UI needs to explain why a level-up button is grey. */
export type LevelBlock = 'AtMaxLevel' | 'TierCapped' | 'NotEnoughStardust';

export function levelBlock(e: CollectionEntry, stardust: number): LevelBlock | null {
  if (isMaxLevel(e)) return 'AtMaxLevel';
  if (e.level >= levelCapForTier(e.tier)) return 'TierCapped';
  if (stardust < levelCost(e.level)) return 'NotEnoughStardust';
  return null;
}

export type TierBlock = 'AtMaxTier' | 'NotEnoughFragments';

export function tierBlock(e: CollectionEntry): TierBlock | null {
  if (isMaxTier(e)) return 'AtMaxTier';
  if (e.fragments < tierCost(e.tier)) return 'NotEnoughFragments';
  return null;
}

/** Total Stardust from level 1 to the cap — the runway, in one number. */
export const totalLevelCost = (): number => {
  let sum = 0;
  for (let l = 1; l < COLLECTION.maxLevel; l++) sum += levelCost(l);
  return sum;
};
