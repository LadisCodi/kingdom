// Adjacency rules: a district gains (or LOSES) flat gold per adjacent
// neighbor of a given type — crowded houses pay less tax, spread-out ones
// don't. Rules live in the balance workbook's Adjacency sheet; "adjacent"
// means the two footprints touch, diagonals included.

import { ADJACENCY, DISTRICTS } from './data/definitions';
import {
  districtSize, type Coord, type District, type DistrictId, type GameState,
} from './state';

export interface AdjacencyEffect {
  goldPerMinute: number;
  goldPerTap: number;
}

const NONE: AdjacencyEffect = { goldPerMinute: 0, goldPerTap: 0 };

/** The rule for what `district` receives per adjacent `neighbor` (directional). */
const rule = (district: DistrictId, neighbor: DistrictId) =>
  ADJACENCY.find((r) => r.district === district && r.neighbor === neighbor);

/** Chebyshev gap between two footprint rects: 0 = overlap, 1 = touching. */
function footprintGap(
  aLoc: Coord, aSize: { x: number; y: number },
  bLoc: Coord, bSize: { x: number; y: number },
): number {
  const dx = Math.max(bLoc.x - (aLoc.x + aSize.x - 1), aLoc.x - (bLoc.x + bSize.x - 1), 0);
  const dy = Math.max(bLoc.y - (aLoc.y + aSize.y - 1), aLoc.y - (bLoc.y + bSize.y - 1), 0);
  return Math.max(dx, dy);
}

/** Built districts whose footprint touches the rect at loc/size. */
export const adjacentBuilt = (
  state: GameState,
  loc: Coord,
  size: { x: number; y: number },
  excludeId: string | null = null,
): District[] =>
  state.city.districts.filter((d) =>
    d.state === 'Built' && d.uniqueId !== excludeId &&
    footprintGap(loc, size, d.location, districtSize(d)) === 1);

/** Total effect a district of `definitionId` at `loc` receives from its
 *  built neighbors. */
export function adjacencyEffect(
  state: GameState,
  definitionId: DistrictId,
  loc: Coord,
  excludeId: string | null = null,
): AdjacencyEffect {
  const out = { ...NONE };
  for (const n of adjacentBuilt(state, loc, DISTRICTS[definitionId].size, excludeId)) {
    const r = rule(definitionId, n.definitionId);
    if (r) {
      out.goldPerMinute += r.goldPerMinute;
      out.goldPerTap += r.goldPerTap;
    }
  }
  return out;
}

export const districtAdjacency = (state: GameState, district: District): AdjacencyEffect =>
  adjacencyEffect(state, district.definitionId, district.location, district.uniqueId);

/** Placement preview: what each existing neighbor would GAIN from the new
 *  building, and what the new building would RECEIVE from them. */
export function placementAdjacency(
  state: GameState,
  definitionId: DistrictId,
  cell: Coord,
): { given: Array<{ district: District } & AdjacencyEffect>; received: AdjacencyEffect } {
  const given: Array<{ district: District } & AdjacencyEffect> = [];
  for (const n of adjacentBuilt(state, cell, DISTRICTS[definitionId].size)) {
    const r = rule(n.definitionId, definitionId);
    if (r && (r.goldPerMinute !== 0 || r.goldPerTap !== 0)) {
      given.push({ district: n, goldPerMinute: r.goldPerMinute, goldPerTap: r.goldPerTap });
    }
  }
  return { given, received: adjacencyEffect(state, definitionId, cell) };
}
