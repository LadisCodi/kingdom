// What a world hex can be made of (Docs/features/19-world-map.md §2, §8).
//
// Unions in code, like the province's `FeatureId`: a new terrain or feature
// is code, because something has to draw it and something has to read it.
// The data editor names them through `STATIC_IDS` (dataRules.ts).

export const WORLD_TERRAINS = ['Grassland', 'Plains', 'Desert'] as const;
export type WorldTerrain = typeof WORLD_TERRAINS[number];

/** What a player builds on a held hex, after its Outpost (19 §7). */
export const WORLD_IMPROVEMENTS = ['LoggingCamp', 'Homestead', 'StonePit', 'Fortress'] as const;
export type WorldImprovement = typeof WORLD_IMPROVEMENTS[number];

/** In the order a hex rolls them: the first to roll and fit is the one it
 *  keeps (`maxFeaturesPerHex`, 19 §9). A Mountain is a feature, as in the
 *  province, standing on a terrain like any other. */
export const WORLD_FEATURES = ['Forest', 'Mountain', 'FertileLand', 'Game', 'Dungeon', 'Sanctuary', 'Landmark'] as const;
export type WorldFeature = typeof WORLD_FEATURES[number];

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
