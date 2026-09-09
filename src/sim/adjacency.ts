// Adjacency rules: what a district gains (or LOSES) per adjacent neighbour of
// a given kind. Crowded houses pay less tax; a Carpenter beside the Sawmill
// works faster; a hall beside another hall trains faster.
//
// **Adjacency is the only thing that guides a layout** (OQ-48, 2026-09-07).
// Placement itself is free — anywhere revealed, no plot bound, no building
// required beside another — so these rules pay and charge, and never refuse.
// It follows that no rule may be worth avoiding a spot entirely, which is what
// `ADJACENCY_CLAMP` is for: a stat moves at most 25% either way, so a layout
// is better or worse and never wrong.
//
// Rules live in the workbook's Adjacency sheet as
// `(district, neighbour, stat, magnitude)`. Either side may be a GROUP token
// (`AnyHall`, `AnyWorkshop`, `AnyProducer`), whose membership is derived from
// what a district already is — so "a hall beside another hall" is one row
// rather than twelve.
//
// "Adjacent" means the two footprints share an EDGE; diagonal corner contact
// does not count.
//
// Nothing here is a modifier: an adjacency is positional and computed on read,
// so it belongs at the base stage of whatever number it moves. The one
// exception is a TIMER — a workshop item's work, a trainee's seconds — which
// is priced when the timer starts and stored on it, the way research time is,
// because a neighbour that moves must not reprice a wait already running.

import {
  ADJACENCY, ADJACENCY_CLAMP, ADJACENCY_GROUPS, DISTRICTS, isAdjacencyGroup,
  type AdjacencyStat, type AdjacencyTarget,
} from './data/definitions';
import {
  districtSize, type Coord, type District, type DistrictId, type GameState,
} from './state';

/** Does `id` answer to this side of a rule — as itself, or as a group? */
const matches = (target: AdjacencyTarget, id: DistrictId): boolean =>
  isAdjacencyGroup(target)
    ? ADJACENCY_GROUPS[target](DISTRICTS[id])
    : target === id;

/** Every rule that pays `district` for having `neighbor` beside it. */
const rulesFor = (district: DistrictId, neighbor: DistrictId, stat: AdjacencyStat) =>
  ADJACENCY.filter((r) =>
    r.stat === stat && matches(r.district, district) && matches(r.neighbor, neighbor));

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

/**
 * What one stat gains from every built neighbour of a district of
 * `definitionId` standing at `loc`.
 *
 * Fractional stats are clamped to ±`ADJACENCY_CLAMP`; `goldPerMinute` is not,
 * because it is a flat sum whose floor is the call site's business (a house
 * clamps at 0 rent rather than paying the city).
 */
export function adjacencyEffect(
  state: GameState,
  definitionId: DistrictId,
  loc: Coord,
  stat: AdjacencyStat = 'goldPerMinute',
  excludeId: string | null = null,
): number {
  let total = 0;
  for (const n of adjacentBuilt(state, loc, DISTRICTS[definitionId].size, excludeId)) {
    for (const r of rulesFor(definitionId, n.definitionId, stat)) total += r.magnitude;
  }
  if (stat === 'goldPerMinute') return total;
  return Math.max(-ADJACENCY_CLAMP, Math.min(ADJACENCY_CLAMP, total));
}

/** The gold/min modifier this district's built neighbors currently apply. */
export const districtAdjacency = (state: GameState, district: District): number =>
  adjacencyEffect(
    state, district.definitionId, district.location, 'goldPerMinute', district.uniqueId);

/**
 * The multiplier a built district's neighbours put on one of its stats: 0.9
 * for a tenth faster, 1.05 for a twentieth more.
 *
 * Read at the call site that owns the number, at its BASE stage — never as a
 * modifier, because an adjacency is a fact about where the building stands.
 */
export const adjacencyMultiplier = (
  state: GameState, district: District, stat: AdjacencyStat,
): number => 1 + adjacencyEffect(
  state, district.definitionId, district.location, stat, district.uniqueId);

/** Every stat a built district's neighbours are moving right now, for a card
 *  that has to list them. */
export function adjacencyInEffect(
  state: GameState, district: District,
): Array<{ stat: AdjacencyStat; total: number }> {
  const stats = [...new Set(ADJACENCY.map((r) => r.stat))];
  return stats
    .map((stat) => ({
      stat,
      total: adjacencyEffect(
        state, district.definitionId, district.location, stat, district.uniqueId),
    }))
    .filter((e) => e.total !== 0);
}

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
): {
  given: Array<{ district: District; stat: AdjacencyStat; magnitude: number }>;
  received: Array<{ stat: AdjacencyStat; total: number }>;
} {
  const given: Array<{ district: District; stat: AdjacencyStat; magnitude: number }> = [];
  for (const n of adjacentBuilt(state, cell, DISTRICTS[definitionId].size, excludeId)) {
    for (const r of ADJACENCY) {
      if (!matches(r.district, n.definitionId) || !matches(r.neighbor, definitionId)) continue;
      given.push({ district: n, stat: r.stat, magnitude: r.magnitude });
    }
  }
  const stats = [...new Set(ADJACENCY.map((r) => r.stat))];
  const received = stats
    .map((stat) => ({ stat, total: adjacencyEffect(state, definitionId, cell, stat, excludeId) }))
    .filter((e) => e.total !== 0);
  return { given, received };
}
