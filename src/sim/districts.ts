// Placement conditions and build/upgrade cost & time formulas. Cost/time
// formulas are unchanged from Docs/04; placement updated for the harvest loop.

import { DISTRICTS, levelIndexed, type DistrictDef } from './data/definitions';
import { cellExists, neighbors, townhallDistance, type MapData } from './grid';
import { isTechComplete } from './research';
import {
  cellsOfRect, coordKey, districtAt, townhall,
  type Coord, type DistrictId, type GameState, type Wallet,
} from './state';

// ------------------------------------------------------------------ counting

/** Count of a category, Built OR UnderConstruction (both count toward the cap). */
export const districtCount = (state: GameState, definitionId: DistrictId): number =>
  state.city.districts.filter((d) => d.definitionId === definitionId).length;

export function maxCountForTownhallLevel(def: DistrictDef, townhallLevel: number): number {
  if (def.maxCountPerTownhallLevel.length === 0) return Infinity;
  return levelIndexed(def.maxCountPerTownhallLevel, townhallLevel);
}

// ----------------------------------------------------------------- placement

export type PlacementBlock =
  | 'HasFeature' | 'NotRevealed' | 'Occupied' | 'OffMap' | 'CountLimit'
  | 'NeedsResearch' | 'NeedsHousingAdjacency' | 'NeedsGrassland' | 'NeedsWaterAdjacency';

/** All placement conditions ANDed over the full footprint (cell = anchor,
 *  top-left); null = buildable here. */
export function placementBlock(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
): PlacementBlock | null {
  const def = DISTRICTS[definitionId];
  const footprint = cellsOfRect(cell, def.size);
  // Universal rules — every footprint cell must pass.
  for (const c of footprint) {
    if (!cellExists(map, c)) return 'OffMap';
    if (state.features[coordKey(c)]) return 'HasFeature';
    if (!state.fog.revealed[coordKey(c)]) return 'NotRevealed';
    if (districtAt(state, c)) return 'Occupied';
  }
  if (districtCount(state, definitionId) >= maxCountForTownhallLevel(def, townhall(state).level)) {
    return 'CountLimit';
  }
  if (def.requiredTech && !isTechComplete(state, def.requiredTech)) return 'NeedsResearch';
  // Per-type rules: terrain must hold on every footprint cell; adjacency /
  // influence must hold for at least one.
  switch (definitionId) {
    case 'Housing': {
      // Adjacent to a Townhall or another Housing (under-construction Housing counts).
      const ok = footprint.some((fc) =>
        neighbors(map, fc).some((n) => {
          const d = districtAt(state, n);
          return d !== undefined && (d.definitionId === 'Townhall' || d.definitionId === 'Housing');
        }),
      );
      if (!ok) return 'NeedsHousingAdjacency';
      break;
    }
    case 'Farm':
      if (footprint.some((c) => map.terrain.get(coordKey(c)) !== 'Grassland')) return 'NeedsGrassland';
      break;
    case 'FarmLands':
      // Any revealed Grassland — the player taps it by hand until a Farm
      // is built nearby to send workers.
      if (footprint.some((c) => map.terrain.get(coordKey(c)) !== 'Grassland')) return 'NeedsGrassland';
      break;
    case 'FishingHut': {
      // On the shore: at least one footprint neighbor must be Water.
      const coastal = footprint.some((fc) =>
        neighbors(map, fc).some((n) => map.terrain.get(coordKey(n)) === 'Water'));
      if (!coastal) return 'NeedsWaterAdjacency';
      break;
    }
    case 'Sawmill': // no placement restriction — the influence range guides placement
    case 'Quarry':
    case 'Mine':
    case 'Market':
    case 'Townhall':
      break;
  }
  return null;
}

/** True if the type has placement rules beyond the universal ones — only then
 *  is highlighting valid cells informative (an unrestricted building like the
 *  Sawmill would just outline most of the map). */
export const hasPlacementRestriction = (definitionId: DistrictId): boolean =>
  definitionId === 'Housing' || definitionId === 'Farm' || definitionId === 'FarmLands' ||
  definitionId === 'FishingHut';

export const validPlacementCells = (
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
): Coord[] => map.cells.filter((c) => placementBlock(state, map, definitionId, c) === null);

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

/** Upgrade cost from currentLevel; uses the EXISTING count n, no distance term. */
export function upgradeCost(definitionId: DistrictId, n: number, currentLevel: number): Wallet {
  const def = DISTRICTS[definitionId];
  const expGrowth = n ** def.buildCostExponentialGrowth;
  const countMult = Math.max(def.buildCostMultiplier * (n - 1) * expGrowth, 1);
  const levelMult = def.upgradeCostLevelGrowth ** (currentLevel - 1);
  const out: Wallet = {};
  for (const [c, base] of Object.entries(def.upgradeCost)) {
    out[c as keyof Wallet] = Math.floor(base * countMult * levelMult);
  }
  return out;
}

/** Build time in seconds. Rounding: round. */
export const buildDuration = (definitionId: DistrictId, n: number, d: number): number => {
  const def = DISTRICTS[definitionId];
  return Math.round(
    def.buildDurationSeconds *
      def.buildDurationDistrictGrowth ** n *
      def.buildDurationDistanceGrowth ** d,
  );
};

/** Upgrade time in seconds. Rounding: round. */
export const upgradeDuration = (definitionId: DistrictId, currentLevel: number): number => {
  const def = DISTRICTS[definitionId];
  return Math.round(
    def.upgradeDurationSeconds * def.upgradeDurationLevelGrowth ** (currentLevel - 1),
  );
};

/** Cost of the NEXT instance of a type (distance no longer affects cost). */
export const nextBuildCost = (state: GameState, definitionId: DistrictId): Wallet =>
  buildCost(definitionId, districtCount(state, definitionId));

export const buildDurationForCell = (state: GameState, definitionId: DistrictId, cell: Coord, map: MapData): number =>
  buildDuration(definitionId, districtCount(state, definitionId), townhallDistance(map, cell));

// -------------------------------------------------------- upgrade requirement

/** Townhall level required to reach `targetLevel` (index 0 = requirement for level 2). */
export function requiredTownhallLevel(definitionId: DistrictId, targetLevel: number): number {
  const list = DISTRICTS[definitionId].requiredTownhallLevelPerLevel;
  if (targetLevel <= 1 || list.length === 0) return 0;
  return levelIndexed(list, targetLevel - 1); // list is indexed by target level − 2
}
