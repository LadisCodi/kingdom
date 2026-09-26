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
  Farm: ['farmer'],
  Sawmill: ['woodcutter'],
  Quarry: ['quarryman'],
  // Workshop crews never leave the building — they are drawn at its door —
  // so they have no walk, and `animFor` falls back to idle for one.
  // Carpenter and RuneCarver are absent because nobody has a work loop for
  // either trade yet; tests/characters.test.ts names them.
  MasonsYard: ['stonemason'],
  Smelter: ['smith'],
};

/**
 * Unassigned population strolling around the Townhall and Housing.
 *
 * `villager_*` are the game's own people, rendered in the current style
 * (Docs/art/villagers). The bought pixel pack's `npc_*` and `man_01` are
 * gone from here: the two do not sit together, and four faces is enough for
 * a crowd that nobody counts.
 */
export const VILLAGERS: readonly string[] = [
  'villager_1', 'villager_2', 'villager_3', 'villager_4',
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
