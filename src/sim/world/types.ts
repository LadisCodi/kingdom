// What a world hex can be made of (Docs/features/19-world-map.md §2, §8).
//
// Unions in code, like the province's `FeatureId`: a new terrain or feature
// is code, because something has to draw it and something has to read it.
// The data editor names them through `STATIC_IDS` (dataRules.ts).

import type { PreciousId } from '../state';

export const WORLD_TERRAINS = ['Grassland', 'Plains', 'Desert'] as const;
export type WorldTerrain = typeof WORLD_TERRAINS[number];

/** What a held hex is (19 §7): the claim builds it, and the hex's feature
 *  decides which — `worldBuild.districts` says which feature each takes. */
export const WORLD_DISTRICTS = [
  'Rural', 'LoggingCamp', 'Quarry', 'FarmLands', 'HuntingGrounds', 'Observatory', 'Shrine',
  'GroveCamp', 'StarmetalDig', 'SpireQuarry',
] as const;
export type WorldDistrict = typeof WORLD_DISTRICTS[number];

/** What can be built into a district that stands (19 §7.2). */
export const WORLD_UPGRADES = ['Fortress', 'Chapel'] as const;
export type WorldUpgrade = typeof WORLD_UPGRADES[number];

/** In the order a hex rolls them: the first to roll and fit is the one it
 *  keeps (`maxFeaturesPerHex`, 19 §9). A Mountain is a feature, as in the
 *  province, standing on a terrain like any other. */
export const WORLD_FEATURES = [
  'Forest', 'Mountain', 'FertileLand', 'Game', 'Dungeon', 'Sanctuary', 'Landmark',
  'HeartwoodGrove', 'StarfallCrater', 'MoonglassSpires',
] as const;
export type WorldFeature = typeof WORLD_FEATURES[number];

/** THE DEPOSITS (Docs/plans/precious-deposits.md §1): the feature each
 *  precious material comes from. Dealt to the seats (`worldGen.deposits`),
 *  never rolled; the district a deposit takes yields only its material. */
export const DEPOSIT_OF: Readonly<Record<PreciousId, WorldFeature>> = {
  Heartwood: 'HeartwoodGrove',
  Starmetal: 'StarfallCrater',
  Moonglass: 'MoonglassSpires',
};

/** The material a hex's deposit yields, if it holds one. */
export function depositMaterial(features: readonly string[]): PreciousId | null {
  for (const [id, f] of Object.entries(DEPOSIT_OF) as Array<[PreciousId, WorldFeature]>) {
    if (features.includes(f)) return id;
  }
  return null;
}

/** How many outer-ring places of a wedge a placed site can take — the six
 *  of ring 6 less the three beside a city (`siteRoom` in board.ts; the test
 *  holds the two together). */
export const OUTER_SITE_ROOM = 3;

/** The sites placed on the outer ring rather than rolled (19 §9). */
export const PLACED_SITES: readonly WorldFeature[] = ['Dungeon', 'Sanctuary'];

/**
 * A hex's job, by its ring (19 §1): the Portal at the centre, the inner ring,
 * the corridors (rings 2–4), the home ring the cities stand on (5) and the
 * outer ring at the rim (6).
 */
export const HEX_ROLES = ['portal', 'inner', 'corridor', 'home', 'outer'] as const;
export type HexRole = typeof HEX_ROLES[number];

/** The roles a hex's contents are ROLLED for; the Portal is empty and the
 *  inner ring is authored. */
export const ROLLED_ROLES = ['corridor', 'home', 'outer'] as const;
export type RolledRole = typeof ROLLED_ROLES[number];
