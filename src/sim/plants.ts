// Plantables: Build-menu entries that put a FEATURE on the ground instead of
// raising a building (Docs/features/27-plantables.md). What lands is an
// ordinary harvest cell; it only waits out its growth first.

import { DISTRICTS } from './data/definitions';
import { pickUpTreasure } from './treasures';
import type { MapData } from './grid';
import { coordKey, type Coord, type DistrictId, type GameState } from './state';

/** Is this Build-menu entry a plantable rather than a building? */
export const isPlantable = (definitionId: DistrictId): boolean =>
  DISTRICTS[definitionId].plants !== null;

/**
 * Put a plantable's feature on `cell`, growing. A growing cell is an
 * exhausted one whose wait is its growth: it cannot be tapped or worked, and
 * it comes back FULL when the wait ends — the lazy recovery every cell
 * already has, so a growth is no boundary of its own.
 *
 * The caller has already said the ground is legal and taken the price.
 */
export function plantAt(
  state: GameState, map: MapData, definitionId: DistrictId, cell: Coord, now: number,
): void {
  const def = DISTRICTS[definitionId];
  if (def.plants === null) return;
  const key = coordKey(cell);
  state.features[key] = def.plants;
  delete state.featureMeta[key];
  // A treasure under it is picked up, not buried — as under a building.
  pickUpTreasure(state, map, cell);
  const growMs = def.buildDurationSeconds * 1000;
  // No growth: no depot record, which reads as a full one.
  if (growMs <= 0) delete state.harvest[key];
  else state.harvest[key] = { units: 0, exhaustedUntil: now + growMs, recoveryMs: growMs, growing: true };
}
