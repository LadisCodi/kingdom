// Plantables and moving trees (Docs/features/27-plantables.md). A plantable
// is a Build-menu entry that puts a FEATURE on the ground instead of raising
// a building; a tree or a crop plot already standing can be picked up and
// moved. Either way what lands is an ordinary harvest cell that waits out its
// growth first.

import { DISTRICTS, FEATURES, HARVEST } from './data/definitions';
import { groundBlock, type PlacementBlock } from './districts';
import { isTechComplete } from './research';
import { pickUpTreasure } from './treasures';
import { wakeIdleWorkersAt } from './workers';
import type { MapData } from './grid';
import { coordKey, type Coord, type DistrictId, type FeatureId, type GameState, type TechId } from './state';

/** Is this Build-menu entry a plantable rather than a building? */
export const isPlantable = (definitionId: DistrictId): boolean =>
  DISTRICTS[definitionId].plants !== null;

/**
 * Put a feature on `cell`, growing for its source's `growSeconds`. A growing
 * cell is an exhausted one whose wait is its growth: it cannot be tapped or
 * worked, and it comes back FULL when the wait ends — the lazy recovery every
 * cell already has, so a growth is no boundary of its own.
 *
 * The caller has already said the ground is legal and taken any price.
 */
export function plantFeature(
  state: GameState, map: MapData, feature: FeatureId, cell: Coord, now: number,
): void {
  const key = coordKey(cell);
  state.features[key] = feature;
  delete state.featureMeta[key];
  // A treasure under it is picked up, not buried — as under a building.
  pickUpTreasure(state, map, cell);
  const growMs = HARVEST[FEATURES[feature].source].growSeconds * 1000;
  // No growth: no depot record, which reads as a full one.
  if (growMs <= 0) delete state.harvest[key];
  else state.harvest[key] = { units: 0, exhaustedUntil: now + growMs, recoveryMs: growMs, growing: true };
}

/** A plantable from the Build menu: its feature, growing. */
export function plantAt(
  state: GameState, map: MapData, definitionId: DistrictId, cell: Coord, now: number,
): void {
  const feature = DISTRICTS[definitionId].plants;
  if (feature !== null) plantFeature(state, map, feature, cell, now);
}

// ------------------------------------------------------------------ moving

/** What may be picked up and moved: a tree, and a crop plot. */
export const MOVABLE_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>(['Trees', 'Crops']);

/** The technology that lets a tree be moved. A crop plot, bought from the
 *  Build menu, moves from the start, as a building does. */
export const TRANSPLANTING: TechId = 'Transplanting';

export type PickUpBlock = 'NotMovable' | 'NotRevealed' | 'NeedsResearch';

/** Why the feature on `cell` cannot be picked up, or null when it can. */
export function pickUpBlock(state: GameState, cell: Coord): PickUpBlock | null {
  const key = coordKey(cell);
  const feature = state.features[key];
  if (feature === undefined || !MOVABLE_FEATURES.has(feature)) return 'NotMovable';
  if (!state.fog.revealed[key]) return 'NotRevealed';
  if (feature === 'Trees' && !isTechComplete(state, TRANSPLANTING)) return 'NeedsResearch';
  return null;
}

/** Why a feature lifted from `from` may not be put down on `to`, or null. */
export function transplantBlock(
  state: GameState, map: MapData, from: Coord, to: Coord,
): PlacementBlock | null {
  const ground = groundBlock(state, map, to, { leaving: coordKey(from) });
  if (ground !== null) return ground;
  if (map.terrain.get(coordKey(to)) === 'Water') return 'NeedsLand';
  return null;
}

export type TransplantResult = 'Moved' | 'SameCell' | PickUpBlock | PlacementBlock;

/**
 * Move the tree or crop plot on `from` to `to`. It lands GROWING for its
 * whole `growSeconds` — whatever it held, and however far through a growth
 * or a recovery it was — and `from` is bare ground. That wait is the whole
 * price of a move. A worker on its way to it, or swinging at it, finds it
 * gone at its next step and walks home.
 */
export function transplant(
  state: GameState, map: MapData, from: Coord, to: Coord, now: number,
): TransplantResult {
  const lifted = pickUpBlock(state, from);
  if (lifted !== null) return lifted;
  if (from.x === to.x && from.y === to.y) return 'SameCell';
  const block = transplantBlock(state, map, from, to);
  if (block !== null) return block;
  const key = coordKey(from);
  const feature = state.features[key]!;
  delete state.features[key];
  delete state.featureMeta[key];
  delete state.harvest[key];
  plantFeature(state, map, feature, to, now);
  wakeIdleWorkersAt(state, now);
  return 'Moved';
}
