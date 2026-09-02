// Adjacency rules: a district gains (or LOSES) flat gold per adjacent
// neighbor of a given type — crowded houses pay less tax, spread-out ones
// don't. Rules live in the balance workbook's Adjacency sheet; "adjacent"
// means the two footprints share an edge — diagonal corner contact does
// NOT count.

import { ADJACENCY, DISTRICTS } from './data/definitions';
import {
  districtSize, type Coord, type District, type DistrictId, type GameState,
} from './state';

/** The rule for what `district` receives per adjacent `neighbor` (directional). */
const rule = (district: DistrictId, neighbor: DistrictId) =>
  ADJACENCY.find((r) => r.district === district && r.neighbor === neighbor);

/** Whether two footprint rects share an edge (orthogonally adjacent):
 *  a gap of exactly 1 on one axis while overlapping on the other. */
function footprintsShareEdge(
  aLoc: Coord, aSize: { x: number; y: number },
  bLoc: Coord, bSize: { x: number; y: number },
): boolean {
  const dx = Math.max(bLoc.x - (aLoc.x + aSize.x - 1), aLoc.x - (bLoc.x + bSize.x - 1), 0);
  const dy = Math.max(bLoc.y - (aLoc.y + aSize.y - 1), aLoc.y - (bLoc.y + bSize.y - 1), 0);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/** Built districts whose footprint shares an edge with the rect at loc/size. */
export const adjacentBuilt = (
  state: GameState,
  loc: Coord,
  size: { x: number; y: number },
  excludeId: string | null = null,
): District[] =>
  state.city.districts.filter((d) =>
    d.state === 'Built' && d.uniqueId !== excludeId &&
    footprintsShareEdge(loc, size, d.location, districtSize(d)));

/** Total effect a district of `definitionId` at `loc` receives from its
 *  built neighbors. */
export function adjacencyEffect(
  state: GameState,
  definitionId: DistrictId,
  loc: Coord,
  excludeId: string | null = null,
): number {
  let goldPerMinute = 0;
  for (const n of adjacentBuilt(state, loc, DISTRICTS[definitionId].size, excludeId)) {
    goldPerMinute += rule(definitionId, n.definitionId)?.goldPerMinute ?? 0;
  }
  return goldPerMinute;
}

/** The gold/min modifier this district's built neighbors currently apply. */
export const districtAdjacency = (state: GameState, district: District): number =>
  adjacencyEffect(state, district.definitionId, district.location, district.uniqueId);

/**
 * Placement preview: the gold/min each existing neighbor would GAIN from the
 * new building, and what the new building would RECEIVE from them.
 *
 * `excludeId` is the building being MOVED. Without it a relocation one cell
 * sideways would count the building as its own neighbour and preview a bonus
 * that vanishes the moment it is confirmed.
 */
export function placementAdjacency(
  state: GameState,
  definitionId: DistrictId,
  cell: Coord,
  excludeId: string | null = null,
): { given: Array<{ district: District; goldPerMinute: number }>; received: number } {
  const given: Array<{ district: District; goldPerMinute: number }> = [];
  for (const n of adjacentBuilt(state, cell, DISTRICTS[definitionId].size, excludeId)) {
    const r = rule(n.definitionId, definitionId);
    if (r && r.goldPerMinute !== 0) given.push({ district: n, goldPerMinute: r.goldPerMinute });
  }
  return { given, received: adjacencyEffect(state, definitionId, cell, excludeId) };
}
