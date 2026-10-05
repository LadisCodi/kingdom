// What a world hex is drawn with (Docs/plans/world-hex-art.md §2–§4): a
// terrain plate, at most one sprite for its feature, and the district that
// works it. Pure: names only, no drawing, so the rules are
// testable and the art drops in by filename.

import type { WorldDistrict, WorldFeature, WorldTerrain } from '../../sim/world/types';

/** Every feature's drawing (world-hex-art.md §2): a hex holds one at most. */
export const HEX_COMBOS = [
  'Forest', 'FertileLand', 'Game', 'Mountain', 'MountainDungeon', 'Sanctuary', 'Landmark',
] as const;
export type HexCombo = typeof HEX_COMBOS[number];

/** The sprite each combination is drawn with. */
export const COMBO_SPRITE: Record<HexCombo, string> = {
  Forest: 'whex_forest',
  FertileLand: 'whex_fertile',
  Game: 'whex_game',
  Mountain: 'whex_mountain',
  MountainDungeon: 'whex_mountain_dungeon',
  Sanctuary: 'whex_sanctuary',
  Landmark: 'whex_landmark',
};

/** The ground under everything: the province's own textures — one terrain
 *  set (art-direction §2). A mountain's sprite carries its own rock. */
export const PLATE_SPRITE: Record<WorldTerrain, string> = {
  Grassland: 'terrain_grassland',
  Plains: 'terrain_plains',
  Desert: 'terrain_desert',
};

/**
 * Which of a sprite's variants a hex draws: `name`, `name_2`, `name_3`…, of
 * which `count` exist, picked by a hash of the hex so the same hex always
 * draws the same one and neighbours seldom match.
 */
export function pickVariant(name: string, count: number, key: number): string {
  if (count <= 1) return name;
  let h = Math.imul(key + 0x9e37, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const k = ((h ^ (h >>> 16)) >>> 0) % count;
  return k === 0 ? name : `${name}_${k + 1}`;
}

/** The drawing a hex's feature is drawn as; null for bare ground. */
export function comboOf(_terrain: WorldTerrain, features: readonly WorldFeature[]): HexCombo | null {
  const has = (f: WorldFeature) => features.includes(f);
  // A dungeon's art carries its own rock, whatever ground it came back on.
  if (has('Dungeon')) return 'MountainDungeon';
  if (has('Mountain')) return 'Mountain';
  if (has('Sanctuary')) return 'Sanctuary';
  if (has('Landmark')) return 'Landmark';
  if (has('Forest')) return 'Forest';
  if (has('FertileLand')) return 'FertileLand';
  if (has('Game')) return 'Game';
  return null;
}

/** Each district's art: the shipped improvement's for the three it
 *  replaces, its own for the rest (Docs/plans/world-districts.md §2). A
 *  district's art includes the feature it works. */
export const DISTRICT_SPRITE: Record<WorldDistrict, string> = {
  Rural: 'whex_rural',
  LoggingCamp: 'whex_logging_camp_l1',
  Quarry: 'whex_stone_pit_l1',
  FarmLands: 'whex_homestead_l1',
  HuntingGrounds: 'whex_hunting_grounds',
  Observatory: 'whex_observatory',
  Shrine: 'whex_shrine',
};

/** The Fortress's mark at the hex's rear corner, by level: the shipped
 *  keep's three tiers. */
export const fortressSprite = (level: number): string =>
  (level >= 3 ? 'whex_fortress_l5' : level === 2 ? 'whex_fortress_l3' : 'whex_fortress_l1');

/** What a hex is drawn with, back to front. */
export interface HexArt {
  plate: string;
  /** Its feature's drawing; a district that has its own art replaces it. */
  combo: HexCombo | null;
  /** The district standing, or going up, and its art. */
  district: { kind: WorldDistrict; sprite: string } | null;
}

/**
 * The art for a hex: its plate, its feature, and its district. At the
 * strategic zoom Game is not drawn (world-hex-art.md §4).
 */
export function hexArt(
  terrain: WorldTerrain, features: readonly WorldFeature[], district: WorldDistrict | null, strategic: boolean,
): HexArt {
  const shown = strategic ? features.filter((f) => f !== 'Game') : features;
  return {
    plate: PLATE_SPRITE[terrain],
    combo: comboOf(terrain, shown),
    district: district === null ? null : { kind: district, sprite: DISTRICT_SPRITE[district] },
  };
}
