// Who plays whom on the map: which characters from the atlas a building's
// crew is drawn from, and which the unassigned villagers are drawn from.
//
// DOM-free on purpose — tests/characters.test.ts checks every name here
// against the generated atlas index under node, so a typo in a cast list or
// a renamed frame file fails a test rather than silently falling back to the
// old worker sprite.
//
// Cosmetic, deliberately NOT in the balance workbook: nothing here changes a
// number the player can feel.

import { CHARACTERS } from './characters/atlas.generated';
import type { DistrictId } from '../sim/state';

/** What the renderer asks a character to do. */
export type UnitPose = 'idle' | 'walk' | 'work';

/**
 * The crew of each working building — a worker is cast by a stable hash of
 * its id, so it keeps its face across frames and reloads. Every member must
 * have an `idle`; `walk` and `work` resolve through `animFor` below.
 *
 * The Docks are absent on purpose: its workers are fishing boats, drawn from
 * `src/render/assets` as before.
 */
export const CREW: Partial<Record<DistrictId, readonly string[]>> = {
  Farm: ['farm_1', 'farm_2', 'farm_3'],
  Sawmill: ['sawmill_man_1', 'sawmill_woman_1'],
  Quarry: ['quarry_man_1', 'quarry_man_2', 'quarry_woman_1', 'quarry_woman_2'],
  // Workshop crews never leave the building — they are drawn at its door —
  // but they are villagers like any other, so they are cast the same way.
  // Carpenter and RuneCarver are absent because the pack has nobody with a
  // work loop for either trade; tests/characters.test.ts names them.
  MasonsYard: ['stonemason_man_1', 'stonemason_woman_1'],
  Smelter: ['forge_man_1', 'forge_woman_1'],
};

/** Unassigned population strolling around the Townhall and Housing. */
export const VILLAGERS: readonly string[] = [
  'npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6', 'man_01',
];

/** A crew member for a building of this kind, or null when the building has
 *  no cast (Docks) — the caller then draws the legacy sprite chain. */
export function castFor(district: DistrictId, seed: number): string | null {
  const crew = CREW[district];
  if (!crew || crew.length === 0) return null;
  return crew[seed % crew.length];
}

export const villagerFor = (seed: number): string => VILLAGERS[seed % VILLAGERS.length];

/**
 * Resolve a pose to a (character, animation) pair that exists in the atlas.
 *
 * The pack is uneven: the quarry crew have no plain walk, only a `_transport`
 * twin hauling a block, and the pack's `action` is what the game calls work.
 * Anything missing falls back to `idle`, which every cast member has — so the
 * renderer never asks for a frame that is not there.
 */
export function animFor(character: string, pose: UnitPose): readonly [string, string] {
  const anims = CHARACTERS[character];
  if (!anims) return [character, 'idle'];
  if (pose === 'work' && anims.action) return [character, 'action'];
  if (pose === 'walk') {
    if (anims.walk) return [character, 'walk'];
    const hauling = `${character}_transport`;
    if (CHARACTERS[hauling]?.walk) return [hauling, 'walk'];
  }
  return [character, 'idle'];
}

/** Frame cadence per animation, in ms. The pack's cycles are short — two
 *  frames of walk, three of work — so these run slower than the four-frame
 *  legacy worker's 140 ms. */
export const FRAME_MS: Readonly<Record<string, number>> = {
  idle: 550,
  walk: 220,
  action: 260,
  attack: 120,
};
