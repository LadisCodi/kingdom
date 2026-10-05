// What a world hex is drawn with (Docs/plans/world-hex-art.md §2–§4): a
// terrain plate, at most one sprite for its feature, and an improvement that
// includes the feature it works. Pure: names only, no drawing, so the rules are
// testable and the art drops in by filename.

import type { WorldFeature, WorldImprovement, WorldTerrain } from '../../sim/world/types';

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

/** An improvement's art, before its tier. */
export const IMPROVEMENT_SPRITE: Record<WorldImprovement, string> = {
  LoggingCamp: 'whex_logging_camp',
  Homestead: 'whex_homestead',
  StonePit: 'whex_stone_pit',
  Fortress: 'whex_fortress',
};

/** The Outpost's watch-tower at the hex's corner — `whex_outpost[_n]` — and
 *  the same tower while its builder is still at it. */
export const OUTPOST_SPRITE = 'whex_outpost';
export const OUTPOST_BUILDING_SPRITE = 'whex_outpost_building';

/** Three art tiers across an improvement's five levels. */
export const improvementTier = (level: number): string => (level >= 5 ? 'l5' : level >= 3 ? 'l3' : 'l1');

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

/** What a hex is drawn with, back to front. */
export interface HexArt {
  plate: string;
  /** What an improvement does not work, drawn behind it at 60 %. */
  behind: HexCombo | null;
  /** The combination, or the improvement standing in its place. */
  main: { combo: HexCombo } | { improvement: WorldImprovement; sprite: string } | null;
  /** Game left in front of an improvement. */
  front: HexCombo | null;
}

/** What each improvement works, and so takes out of the hex's drawing. */
const WORKS: Record<WorldImprovement, (terrain: WorldTerrain, f: readonly WorldFeature[]) => [WorldTerrain, WorldFeature[]]> = {
  LoggingCamp: (t, f) => [t, f.filter((x) => x !== 'Forest')],
  StonePit: (t, f) => [t, f.filter((x) => x !== 'Mountain')],
  Homestead: (t, f) => [t, f.filter((x) => x !== 'FertileLand')],
  Fortress: (t, f) => [t, [...f]],
};

/**
 * The art for a hex: its plate, its combination, or its improvement with
 * what is left of the combination behind it — Game, the one small thing,
 * goes in front instead (world-hex-art.md §3). At the strategic zoom Game is
 * not drawn (§4).
 */
export function hexArt(
  terrain: WorldTerrain, features: readonly WorldFeature[],
  improvement: { kind: WorldImprovement; level: number } | null, strategic: boolean,
): HexArt {
  const shown = strategic ? features.filter((f) => f !== 'Game') : features;
  const plate = PLATE_SPRITE[terrain];
  if (improvement === null) {
    const combo = comboOf(terrain, shown);
    return { plate, behind: null, main: combo === null ? null : { combo }, front: null };
  }
  const [t, rest] = WORKS[improvement.kind](terrain, shown);
  const left = comboOf(t, rest);
  const main = {
    improvement: improvement.kind,
    sprite: `${IMPROVEMENT_SPRITE[improvement.kind]}_${improvementTier(improvement.level)}`,
  };
  if (left === 'Game') return { plate, behind: null, main, front: 'Game' };
  return { plate, behind: left, main, front: null };
}
