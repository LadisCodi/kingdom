// Placement conditions and build/upgrade cost & time formulas. Cost/time
// formulas are unchanged from Docs/04; placement updated for the harvest loop.

import { CITY_DEF, DISTRICTS, levelIndexed, type DistrictDef } from './data/definitions';
import { cellExists, chebyshevToRect, neighbors, townhallDistance, type MapData } from './grid';
import { effectiveBuildTimeMultiplier } from './upgrades';
import { isTechComplete } from './research';
import { cellHasSite } from './sites';
import { goodsCostForLevel } from './goods';
import {
  cellsOfRect, coordKey, districtAt, districtSize, townhall,
  type Coord, type District, type DistrictId, type GameState, type GoodsStock,
  type TechId, type Wallet,
} from './state';

// ------------------------------------------------------------------ counting

/** Count of a category, Built OR UnderConstruction (both count toward the cap). */
export const districtCount = (state: GameState, definitionId: DistrictId): number =>
  state.city.districts.filter((d) => d.definitionId === definitionId).length;

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

// ----------------------------------------------------------------- placement

export type PlacementBlock =
  | 'HasFeature' | 'NotRevealed' | 'Occupied' | 'OffMap' | 'CountLimit'
  | 'NeedsResearch' | 'NeedsHousingAdjacency' | 'NeedsShoreline'
  | 'NeedsLand'
  | 'OutsidePlot'
  | 'HasSite';

/**
 * How far the buildable plot reaches, in Chebyshev rings around the
 * Townhall's footprint (OQ-1, [`02-map-scopes.md`](../../Docs/features/02-map-scopes.md) §6).
 *
 * **The plot bounds where the city may BUILD, never where it may harvest.** A
 * crew reaches out of the plot with its area of influence, and a tap reaches
 * anywhere revealed — so the far province is thumb country and the near
 * province is payroll country.
 *
 * The Townhall level is the schedule, because it already gates every count
 * cap: buildings and ground grow together, so the plot stays about as tight
 * at ten as it is at one. Bought expansions (OQ-71) will add to this.
 */
export const plotRadius = (state: GameState): number =>
  levelIndexed(CITY_DEF.buildDistancePerTownhallLevel, townhall(state).level);

/** Is this cell inside the plot the city may build on right now? */
export const isInsidePlot = (state: GameState, cell: Coord): boolean => {
  const th = townhall(state);
  return chebyshevToRect(cell, th.location, districtSize(th)) <= plotRadius(state);
};

/**
 * All placement conditions ANDed over the full footprint (cell = anchor,
 * top-left); null = buildable here.
 *
 * `movingId` is the district being RELOCATED, if any. It changes exactly two
 * rules and nothing else: the building may overlap the ground it is standing
 * on (or it could never move one cell sideways), and the count limit does not
 * apply (a move adds nothing to the count it would be measured against).
 * Every other rule — terrain, features, sites, fog, tech, adjacency — is the
 * same question it is at build time, which is the point: a spot you may not
 * build on is a spot you may not move to.
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
    // The plot answers before the fog does: paying to reveal a cell outside
    // it would buy nothing a builder can use.
    if (!isInsidePlot(state, c)) return 'OutsidePlot';
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
  // Per-type rules: terrain must hold on every footprint cell; adjacency /
  // influence must hold for at least one.
  switch (definitionId) {
    case 'Housing': {
      // Adjacent to a Townhall or another Housing (under-construction Housing counts).
      // A house cannot anchor its own move: standing next to where you
      // already are is not neighbourliness.
      const ok = footprint.some((fc) =>
        neighbors(map, fc).some((n) => {
          const d = districtAt(state, n);
          return d !== undefined && d.uniqueId !== movingId
            && (d.definitionId === 'Townhall' || d.definitionId === 'Housing');
        }),
      );
      if (!ok) return 'NeedsHousingAdjacency';
      break;
    }
    case 'Docks': {
      // A pier spanning the shoreline: its 2×1 footprint needs exactly ONE
      // cell on Water and one on land. Horizontal only — no rotation; the
      // coast decides which half is wet (the sprite flips to match).
      const waters = footprint.filter(
        (c) => map.terrain.get(coordKey(c)) === 'Water').length;
      if (waters !== 1) return 'NeedsShoreline';
      break;
    }
    case 'Sawmill': // no placement restriction — the influence range guides placement
    case 'Quarry':
    case 'Market':
    case 'Townhall':
      break;
  }
  return null;
}

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
 * Two gates. **Built only** — an unfinished building's duration is measured
 * from the Townhall, so relocating one mid-build would silently reprice the
 * wait; the card offers Cancel (full refund) for those instead. And
 * **`buildable` only**, which is the Townhall's exclusion: it is the origin
 * every fog ring, every build duration and every worker distance is measured
 * from, so moving it would reprice the whole world without saying so.
 */
export const canMoveDistrict = (district: District): boolean =>
  district.state === 'Built' && DISTRICTS[district.definitionId].buildable;

// ------------------------------------------------------------- cost formulas

/** Build cost for the (n+1)th instance — count-scaled only, no distance term.
 *  Rounding: floor. */
export function buildCost(definitionId: DistrictId, n: number): Wallet {
  const def = DISTRICTS[definitionId];
  const i = n + 1;
  const expGrowth = i ** def.buildCostExponentialGrowth;
  const countMult = Math.max(def.buildCostMultiplier * (i - 1) * expGrowth, 1);
  const out: Wallet = {};
  for (const [c, base] of Object.entries(def.buildCost)) {
    out[c as keyof Wallet] = Math.floor(base * countMult);
  }
  return out;
}

/**
 * Where the late city starts. Below this target level a level is priced and
 * timed by the row's own curve, tuned for the opening; from it the late
 * columns take over.
 *
 * One pivot for every building, deliberately: a per-row pivot would let two
 * buildings disagree about where the late game is, and the Townhall ladder is
 * what says when it begins.
 */
export const LATE_FROM = CITY_DEF.lateUpgradeFromLevel;

/**
 * The level term of an upgrade price.
 *
 * Continuous at the pivot: reaching level `LATE_FROM` costs the early curve's
 * last step times the late growth, so the two halves meet rather than jump.
 */
const levelCostMultiplier = (def: DistrictDef, targetLevel: number): number => {
  const early = def.upgradeCostLevelGrowth ** (Math.min(targetLevel, LATE_FROM - 1) - 2);
  if (targetLevel < LATE_FROM || def.upgradeCostLateLevelGrowth <= 0) return early;
  return early * def.upgradeCostLateLevelGrowth ** (targetLevel - LATE_FROM + 1);
};

/** Upgrade cost from currentLevel; uses the EXISTING count n, no distance term. */
export function upgradeCost(definitionId: DistrictId, n: number, currentLevel: number): Wallet {
  const def = DISTRICTS[definitionId];
  const expGrowth = n ** def.buildCostExponentialGrowth;
  const countMult = Math.max(def.buildCostMultiplier * (n - 1) * expGrowth, 1);
  const levelMult = levelCostMultiplier(def, currentLevel + 1);
  const out: Wallet = {};
  for (const [c, base] of Object.entries(def.upgradeCost)) {
    out[c as keyof Wallet] = Math.floor(base * countMult * levelMult);
  }
  return out;
}

/**
 * What the next level costs in refined goods, on top of the currencies.
 *
 * A flat price, deliberately: goods are made one at a time by villagers, so
 * the count multiplier and level curve that keep raw resources honest would
 * price a second workshop's worth of days into one upgrade.
 */
export const upgradeGoodsCost = (definitionId: DistrictId, targetLevel: number): GoodsStock =>
  goodsCostForLevel(DISTRICTS[definitionId], targetLevel);

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
  buildCost(definitionId, districtCount(state, definitionId));

export const buildDurationForCell = (state: GameState, definitionId: DistrictId, cell: Coord, map: MapData): number =>
  buildDuration(state, definitionId, districtCount(state, definitionId), townhallDistance(map, cell));

// -------------------------------------------------------- upgrade requirement

/** Townhall level required to reach `targetLevel` (index 0 = requirement for level 2). */
export function requiredTownhallLevel(definitionId: DistrictId, targetLevel: number): number {
  const list = DISTRICTS[definitionId].requiredTownhallLevelPerLevel;
  if (targetLevel <= 1 || list.length === 0) return 0;
  return levelIndexed(list, targetLevel - 1); // list is indexed by target level − 2
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
