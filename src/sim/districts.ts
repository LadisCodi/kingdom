// Placement conditions and build/upgrade cost & time formulas. Cost/time
// formulas are unchanged from Docs/04; placement updated for the harvest loop.

import { CITY_DEF, DISTRICTS, levelIndexed, type DistrictDef } from './data/definitions';
import { goodsCostForLevel } from './goods';
import { cellExists, townhallDistance, type MapData } from './grid';
import { effectiveBuildTimeMultiplier } from './upgrades';
import { isTechComplete } from './research';
import { cellHasSite } from './sites';
import { harmonyBlock } from './harmony';
import {
  cellsOfRect, coordKey, districtAt, townhall,
  type Coord, type District, type DistrictId, type GameState, type GoodsStock,
  type TechId, type Wallet,
} from './state';

// ------------------------------------------------------------------ counting

/** Count of a category, Built OR UnderConstruction (both count toward the cap). */
export const districtCount = (state: GameState, definitionId: DistrictId): number =>
  state.city.districts.filter((d) => d.definitionId === definitionId).length;

/**
 * The ordinal the next one of this kind will be stamped with — *Housing #3*.
 *
 * The count plus one, and that is enough to keep it unique: nothing is ever
 * demolished and a build cannot be cancelled, so the list only ever grows and
 * an ordinal is never freed (Docs/features/05-city-and-districts.md §3.1).
 */
export const nextOrdinal = (state: GameState, definitionId: DistrictId): number =>
  districtCount(state, definitionId) + 1;

export function maxCountForTownhallLevel(def: DistrictDef, townhallLevel: number): number {
  if (def.maxCountPerTownhallLevel.length === 0) return Infinity;
  return levelIndexed(def.maxCountPerTownhallLevel, townhallLevel);
}

/** How many of a district may stand right now: the Townhall's permission,
 *  plus one if the district's `extraCountTech` is researched (Guildhalls buys
 *  a second Market, Second Sanctum a second Sanctum). */
export function maxDistrictCount(state: GameState, def: DistrictDef): number {
  const base = maxCountForTownhallLevel(def, townhall(state).level);
  if (base === Infinity) return base;
  const extra = def.extraCountTech !== null && isTechComplete(state, def.extraCountTech) ? 1 : 0;
  return base + extra;
}

/** Does a number after this building's name mean anything? Only where more
 *  than one may stand — the Townhall and the single halls are just
 *  themselves. */
export const isNumbered = (state: GameState, def: DistrictDef): boolean =>
  def.buildable && maxDistrictCount(state, def) > 1;

/** What a card calls one building: *Housing #3* where several may stand,
 *  plain *Sanctum* where only one ever can. The number is the ordinal it was
 *  built with, which is also what prices it (§3.1). */
export const districtLabel = (state: GameState, district: District): string => {
  const def = DISTRICTS[district.definitionId];
  return isNumbered(state, def) ? `${def.name} #${district.ordinal}` : def.name;
};

// ----------------------------------------------------------------- placement

export type PlacementBlock =
  | 'HasFeature' | 'NotRevealed' | 'Occupied' | 'OffMap' | 'CountLimit'
  | 'NeedsResearch' | 'NeedsShoreline'
  | 'NeedsLand'
  | 'NeedsHarmony'
  | 'HasSite';

/**
 * All placement conditions ANDed over the full footprint (cell = anchor,
 * top-left); null = buildable here.
 *
 * **A building goes anywhere the player has revealed.** Every condition below
 * is about the GROUND — it exists, it is empty, it is dry, it is not somebody
 * else's — plus the three that are about the BUILDING: the count cap, the
 * unlock technology and the Harmony it demands. There is no rule about where
 * a building sits RELATIVE to another one, and the Docks' need for a
 * shoreline is the single exception, which is terrain rather than layout.
 *
 * Layout is guided instead of policed: adjacency pays or charges for a
 * neighbour ([`03-economy.md`](../../Docs/features/03-economy.md) §3.1), so a
 * placement can be better or worse and none is illegal.
 *
 * `movingId` is the district being RELOCATED, if any. It changes exactly two
 * rules and nothing else: the building may overlap the ground it is standing
 * on (or it could never move one cell sideways), and the count limit does not
 * apply (a move adds nothing to the count it would be measured against).
 * Every other rule — terrain, features, sites, fog, tech — is the same
 * question it is at build time, which is the point: a spot you may not build
 * on is a spot you may not move to.
 */
export function placementBlock(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
  movingId?: string,
): PlacementBlock | null {
  const def = DISTRICTS[definitionId];
  const footprint = cellsOfRect(cell, def.size);
  // Universal rules — every footprint cell must pass.
  for (const c of footprint) {
    if (!cellExists(map, c)) return 'OffMap';
    if (state.features[coordKey(c)]) return 'HasFeature';
    // Landmarks and ruins are content, not building ground: paving over a
    // ruin would silently delete a whole dungeon.
    if (cellHasSite(c)) return 'HasSite';
    if (!state.fog.revealed[coordKey(c)]) return 'NotRevealed';
    const sitting = districtAt(state, c);
    if (sitting && sitting.uniqueId !== movingId) return 'Occupied';
    // Only the Docks (which checks its own land+water mix) may touch Water.
    if (definitionId !== 'Docks' && map.terrain.get(coordKey(c)) === 'Water') return 'NeedsLand';
    // Mountains needed a rule of their own while they were a TERRAIN. They
    // are a feature now, so the HasFeature check above already refuses
    // them — one rule instead of two saying the same thing.
  }
  if (
    movingId === undefined &&
    districtCount(state, definitionId) >= maxDistrictCount(state, def)
  ) {
    return 'CountLimit';
  }
  if (def.requiredTech && !isTechComplete(state, def.requiredTech)) return 'NeedsResearch';
  // Harmony, like the count cap above it, is about the BUILDING rather than
  // the cell — every cell on the map answers the same way, which is why the
  // build menu refuses the card before the player ever enters placement
  // (Docs/plans/builder-30-days.md §6.7).
  if (movingId === undefined && harmonyBlock(state, def, 1) !== null) return 'NeedsHarmony';
  // The one per-type rule left, and it is about terrain rather than layout:
  // a pier spanning the shoreline needs exactly ONE of its 2×1 cells on
  // Water. Horizontal only — no rotation; the coast decides which half is wet
  // and the sprite flips to match.
  if (definitionId === 'Docks') {
    const waters = footprint.filter((c) => map.terrain.get(coordKey(c)) === 'Water').length;
    if (waters !== 1) return 'NeedsShoreline';
  }
  return null;
}

/** True if the type has a placement rule beyond the universal ones — only then
 *  is highlighting valid cells informative, since anything else may go
 *  anywhere revealed and would just outline the map. The **Docks** is the only
 *  one left: its pier needs a shoreline. */
export const hasPlacementRestriction = (definitionId: DistrictId): boolean =>
  definitionId === 'Docks';

export const validPlacementCells = (
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  movingId?: string,
): Coord[] => map.cells.filter(
  (c) => placementBlock(state, map, definitionId, c, movingId) === null);

/**
 * Can this building be picked up and put down somewhere else?
 *
 * One gate: **`buildable` only**, which is the Townhall's exclusion — it is
 * the origin every fog ring, every build duration and every worker distance
 * is measured from, so moving it would reprice the whole world without saying
 * so.
 *
 * An unfinished building moves too, and it has to: a build cannot be
 * cancelled, so moving is the ONLY remedy for a misplacement
 * (Docs/features/06-construction.md §1). Its wait is not repriced, because a
 * wait is priced when the builder starts it and stamped on the queue item.
 */
export const canMoveDistrict = (district: District): boolean =>
  DISTRICTS[district.definitionId].buildable;

// ----------------------------------------------------------------- the price

/**
 * How much dearer the Nth instance of a building is than the first.
 *
 * `M(N) = linear × (N − 1) + growth^(N − 1)`. Both terms start from zero
 * copies, so `M(1)` is exactly 1 and the first one pays the authored table.
 * The two take turns: the linear term prices the early copies, where
 * `growth^(N−1)` is still near 1, and the exponential prices the tail.
 */
export const instanceMultiplier = (definitionId: DistrictId, ordinal: number): number => {
  const def = DISTRICTS[definitionId];
  return def.instanceLinearGrowth * (ordinal - 1)
    + def.instanceExponentialGrowth ** (ordinal - 1);
};

/**
 * Three significant figures, so a multiplied price is a number a player can
 * read back — 15,847 Wood is 15,800.
 *
 * An AUTHORED number is never touched: the multiplier is exactly 1 for the
 * first instance, and rounding a designer's own 12,345 down to 12,300 would
 * make the sheet lie about itself.
 */
const priced = (base: number, mult: number): number => {
  if (mult === 1) return base;
  const v = base * mult;
  if (v === 0) return 0;
  const scale = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2);
  return Math.round(v / scale) * scale;
};

/** What the `level`th level of the `ordinal`th instance costs in currencies.
 *  Level 1 is the build. */
export function levelCost(
  definitionId: DistrictId, ordinal: number, level: number,
): Wallet {
  const row = DISTRICTS[definitionId].costPerLevel[level - 1];
  if (!row) return {};
  const mult = instanceMultiplier(definitionId, ordinal);
  const out: Wallet = {};
  for (const [c, base] of Object.entries(row.cost)) {
    out[c as keyof Wallet] = priced(base, mult);
  }
  return out;
}

/** What BUILDING the `ordinal`th instance costs — its level 1 row. */
export const buildCost = (definitionId: DistrictId, ordinal: number): Wallet =>
  levelCost(definitionId, ordinal, 1);

/**
 * Where the late city starts — for the WAIT. Below this target level a level
 * is timed by the row's own curve, tuned for the opening; from it the late
 * columns take over. A level's PRICE has no pivot: it is authored.
 *
 * One pivot for every building, deliberately: a per-row pivot would let two
 * buildings disagree about where the late game is, and the Townhall ladder is
 * what says when it begins.
 */
export const LATE_FROM = CITY_DEF.lateUpgradeFromLevel;

/** Upgrade cost from currentLevel, for the instance whose ordinal is given. */
export const upgradeCost = (
  definitionId: DistrictId, ordinal: number, currentLevel: number,
): Wallet => levelCost(definitionId, ordinal, currentLevel + 1);

/**
 * What a level costs in refined goods, on top of the currencies.
 *
 * The ordinal never enters: goods are made one at a time by villagers, so the
 * multiplier that keeps raw resources honest would price a second workshop's
 * worth of days into one upgrade.
 */
export const upgradeGoodsCost = (definitionId: DistrictId, targetLevel: number): GoodsStock =>
  goodsCostForLevel(DISTRICTS[definitionId], targetLevel);

/** What a BUILD costs in refined goods — its level 1 row. */
export const buildGoodsCost = (definitionId: DistrictId): GoodsStock =>
  goodsCostForLevel(DISTRICTS[definitionId], 1);

/** Build time in seconds (Carpentry: −5%/rank). Rounding: round. */
export const buildDuration = (
  state: GameState, definitionId: DistrictId, n: number, d: number,
): number => {
  const def = DISTRICTS[definitionId];
  return Math.round(
    def.buildDurationSeconds *
      def.buildDurationDistrictGrowth ** n *
      def.buildDurationDistanceGrowth ** d *
      effectiveBuildTimeMultiplier(state),
  );
};

/**
 * Seconds the wait for `targetLevel` is authored at, before Carpentry.
 *
 * The late half is NOT the early curve continued: minutes-long steps cannot
 * be compounded into the multi-hour ladder the late city needs without making
 * the opening's steps wrong, so the pivot level carries its own base
 * (`upgradeDurationLateSeconds`) and the late growth compounds from there.
 */
const authoredUpgradeSeconds = (def: DistrictDef, targetLevel: number): number => {
  if (targetLevel < LATE_FROM || def.upgradeDurationLateSeconds <= 0) {
    return def.upgradeDurationSeconds * def.upgradeDurationLevelGrowth ** (targetLevel - 2);
  }
  return def.upgradeDurationLateSeconds
    * def.upgradeDurationLateLevelGrowth ** (targetLevel - LATE_FROM);
};

/** Upgrade time in seconds (Carpentry: −5%/rank). Rounding: round. */
export const upgradeDuration = (
  state: GameState, definitionId: DistrictId, currentLevel: number,
): number => {
  const def = DISTRICTS[definitionId];
  return Math.round(
    effectiveBuildTimeMultiplier(state) * authoredUpgradeSeconds(def, currentLevel + 1),
  );
};

/** Cost of the NEXT instance of a type (distance no longer affects cost). */
export const nextBuildCost = (state: GameState, definitionId: DistrictId): Wallet =>
  buildCost(definitionId, nextOrdinal(state, definitionId));

export const buildDurationForCell = (state: GameState, definitionId: DistrictId, cell: Coord, map: MapData): number =>
  buildDuration(state, definitionId, districtCount(state, definitionId), townhallDistance(map, cell));

// -------------------------------------------------------- upgrade requirement

/** Townhall level required to reach `targetLevel` (index 0 = requirement for level 2). */
export function requiredTownhallLevel(definitionId: DistrictId, targetLevel: number): number {
  const list = DISTRICTS[definitionId].requiredTownhallLevelPerLevel;
  if (targetLevel <= 1 || list.length === 0) return 0;
  return levelIndexed(list, targetLevel - 1); // list is indexed by target level − 2
}

/** Villagers the city must have to reach `targetLevel` (same indexing); 0 = no
 *  gate. Total population, housed or not: it is the number the player sees,
 *  and the houses fill themselves. */
export function requiredPopulation(definitionId: DistrictId, targetLevel: number): number {
  const list = DISTRICTS[definitionId].requiredPopulationPerLevel;
  if (targetLevel <= 1 || list.length === 0) return 0;
  return levelIndexed(list, targetLevel - 1);
}

/** Technology required to reach `targetLevel`; null = none (same indexing). */
export function requiredTechForLevel(
  definitionId: DistrictId,
  targetLevel: number,
): TechId | null {
  const list = DISTRICTS[definitionId].requiredTechPerLevel;
  if (targetLevel <= 1 || list.length === 0) return null;
  return levelIndexed(list, targetLevel - 1);
}
