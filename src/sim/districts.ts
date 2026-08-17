// Placement conditions and build/upgrade cost & time formulas (Docs/04).

import { DISTRICTS, levelIndexed, type DistrictDef } from './data/definitions';
import { neighbors, townhallDistance, type MapData } from './grid';
import {
  coordKey, districtAt, townhall,
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
  | 'HasFeature' | 'NotRevealed' | 'Occupied' | 'CountLimit'
  | 'NeedsHousingAdjacency' | 'NeedsGrassland' | 'NeedsFarmAdjacency' | 'NeedsTreesAdjacency';

/** All placement conditions ANDed; null = buildable on this cell. */
export function placementBlock(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
): PlacementBlock | null {
  const def = DISTRICTS[definitionId];
  // Universal rules.
  if (state.features[coordKey(cell)]) return 'HasFeature';
  if (!state.fog.revealed[coordKey(cell)]) return 'NotRevealed';
  if (districtAt(state, cell)) return 'Occupied';
  if (districtCount(state, definitionId) >= maxCountForTownhallLevel(def, townhall(state).level)) {
    return 'CountLimit';
  }
  // Per-type rules.
  switch (definitionId) {
    case 'Housing': {
      // Adjacent to a Townhall or another Housing (under-construction Housing counts).
      const ok = neighbors(map, cell).some((n) => {
        const d = districtAt(state, n);
        return d !== undefined && (d.definitionId === 'Townhall' || d.definitionId === 'Housing');
      });
      if (!ok) return 'NeedsHousingAdjacency';
      break;
    }
    case 'Farm':
      if (map.terrain.get(coordKey(cell)) !== 'Grassland') return 'NeedsGrassland';
      break;
    case 'FarmLands': {
      // Adjacent to an ACTIVE (built) Farm.
      const ok = neighbors(map, cell).some((n) => {
        const d = districtAt(state, n);
        return d !== undefined && d.definitionId === 'Farm' && d.state === 'Built';
      });
      if (!ok) return 'NeedsFarmAdjacency';
      break;
    }
    case 'Lumber': {
      // At least one neighbor is a REVEALED cell carrying Trees.
      const ok = neighbors(map, cell).some(
        (n) =>
          state.features[coordKey(n)]?.featureId === 'Trees' &&
          state.fog.revealed[coordKey(n)] === true,
      );
      if (!ok) return 'NeedsTreesAdjacency';
      break;
    }
    case 'Townhall':
      break;
  }
  return null;
}

export const validPlacementCells = (
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
): Coord[] => map.cells.filter((c) => placementBlock(state, map, definitionId, c) === null);

// ------------------------------------------------------------- cost formulas

/** Build cost for the (n+1)th instance at BFS distance d. Rounding: floor. */
export function buildCost(definitionId: DistrictId, n: number, d: number): Wallet {
  const def = DISTRICTS[definitionId];
  const i = n + 1;
  const expGrowth = i ** def.buildCostExponentialGrowth;
  const countMult = Math.max(def.buildCostMultiplier * (i - 1) * expGrowth, 1);
  const distMult = def.buildCostDistanceGrowth ** d;
  const out: Wallet = {};
  for (const [c, base] of Object.entries(def.buildCost)) {
    out[c as keyof Wallet] = Math.floor(base * countMult * distMult);
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

export const buildCostForCell = (state: GameState, definitionId: DistrictId, cell: Coord, map: MapData): Wallet =>
  buildCost(definitionId, districtCount(state, definitionId), townhallDistance(map, cell));

export const buildDurationForCell = (state: GameState, definitionId: DistrictId, cell: Coord, map: MapData): number =>
  buildDuration(definitionId, districtCount(state, definitionId), townhallDistance(map, cell));

// -------------------------------------------------------- upgrade requirement

/** Townhall level required to reach `targetLevel` (index 0 = requirement for level 2). */
export function requiredTownhallLevel(definitionId: DistrictId, targetLevel: number): number {
  const list = DISTRICTS[definitionId].requiredTownhallLevelPerLevel;
  if (targetLevel <= 1 || list.length === 0) return 0;
  return levelIndexed(list, targetLevel - 1); // list is indexed by target level − 2
}
