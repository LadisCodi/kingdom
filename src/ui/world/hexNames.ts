// What a world hex is called: its title on its card, the kingdom it
// belongs to, its ground's and its feature's names. Text only — no art — so
// the sim's tests can read it under node.

import type { Game } from '../../game';
import type { BoardHex } from '../../sim/world/board';
import type { FogState } from '../../sim/world/explorers';
import { WORLD_BUILD } from '../../sim/data/definitions';
import type { WorldFeature, WorldTerrain } from '../../sim/world/types';
import type { LairId } from '../../sim/state';

/** What a camp is called, on its card's plank and over its fight. */
export const CAMP_TITLE: Record<LairId, string> = {
  Orcs: 'Orc camp', Harpies: 'Harpy camp', Goblins: 'Goblin camp', WolfRiders: 'Wolf-rider camp', Drake: 'Drake’s camp',
};

export const TERRAIN_NAME: Record<WorldTerrain, string> = {
  Grassland: 'Grassland', Plains: 'Plains', Desert: 'Desert',
};

export const FEATURE_NAME: Record<WorldFeature, string> = {
  Forest: 'Forest', Mountain: 'Mountains', FertileLand: 'Fertile land', Game: 'Wild game',
  Dungeon: 'Dungeon', Sanctuary: 'Sanctuary', Landmark: 'Landmark',
  HeartwoodGrove: 'Heartwood Grove', StarfallCrater: 'Starfall Crater', MoonglassSpires: 'Moonglass Spires',
};

export const ROLE_NAME: Record<BoardHex['role'], string> = {
  portal: 'The centre', inner: 'The inner ring', corridor: 'A corridor',
  home: 'The home ring', outer: 'The outer ring',
};

export const FOG_NAME: Record<FogState, string> = { Revealed: 'Revealed', Sensed: 'Sensed', Unknown: 'Unknown' };

/** What the sheet is called: whose city, what stands there, what it is,
 *  or that nobody knows. */
export function hexTitle(game: Game, bh: BoardHex, fog: FogState): string {
  if (bh.role === 'portal') return 'The Dark Portal';
  const control = game.worldSource().controlOf(bh.index);
  if (bh.seat !== null && control?.owner.you) return 'Your city';
  if (fog === 'Unknown') return 'Unknown ground';
  if (bh.seat !== null && control !== null && !control.owner.you) return `${control.owner.name}'s city`;
  if (fog === 'Sensed') return 'Misty ground';
  // A district, standing or going up, is what the hex is called.
  const held = game.worldSource().hexOf(bh.index);
  if (held !== null) return WORLD_BUILD.districts[held.district].name;
  const main = bh.features[0];
  return main !== undefined ? FEATURE_NAME[main] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
}

/** "Your" or "Lady Maren's". */
export function seatName(game: Game, seat: number | null): string {
  if (seat === null) return 'Nobody’s';
  const s = game.worldSource().seats()[seat];
  return s === undefined || s.owner.you ? 'Your' : `${s.owner.name}'s`;
}

