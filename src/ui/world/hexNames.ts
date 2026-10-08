// What a world hex is called: its title on its card, the kingdom it
// belongs to, its ground's and its feature's names. Text only — no art — so
// the sim's tests can read it under node.

import type { Game } from '../../game';
import type { BoardHex } from '../../sim/world/board';
import type { FogState } from '../../sim/world/explorers';
import type { CampDifficulty } from '../../sim/world/camps';
import { GOODS, WORLD_BUILD, type PackTier } from '../../sim/data/definitions';
import type { WorldFeature, WorldTerrain } from '../../sim/world/types';
import type { CurrencyId, GoodId, LairId } from '../../sim/state';
import { tr } from '../../i18n/tr';
import { el } from '../format';

/** What a camp is called, on its card's plank and over its fight. */
export const CAMP_TITLE: Record<LairId, string> = {
  Orcs: tr('Orc camp'), Harpies: tr('Harpy camp'), Goblins: tr('Goblin camp'), WolfRiders: tr('Wolf-rider camp'), Drake: tr('Drake’s camp'),
};

/** A camp's creatures, as a line names them ("held by Orcs"). The sim's
 *  `CAMP_CREATURE` is the world server's, and stays English. */
export const CREATURE_NAME: Record<LairId, string> = {
  Orcs: tr('Orcs'), Harpies: tr('Harpies'), Goblins: tr('Goblins'), WolfRiders: tr('Wolf-riders'), Drake: tr('a Drake'),
};

/** How hard a camp is, as its seal says it. */
export const DIFFICULTY_NAME: Record<CampDifficulty, string> = {
  'Very easy': tr('Very easy'), Easy: tr('Easy'), Fair: tr('Fair'), Hard: tr('Hard'), Deadly: tr('Deadly'),
};

export const TERRAIN_NAME: Record<WorldTerrain, string> = {
  Grassland: tr('Grassland'), Plains: tr('Plains'), Desert: tr('Desert'),
};

export const FEATURE_NAME: Record<WorldFeature, string> = {
  Forest: tr('Forest'), Mountain: tr('Mountains'), FertileLand: tr('Fertile land'), Game: tr('Wild game'),
  Dungeon: tr('Dungeon'), Sanctuary: tr('Sanctuary'), Landmark: tr('Landmark'),
  HeartwoodGrove: tr('Heartwood Grove'), StarfallCrater: tr('Starfall Crater'), MoonglassSpires: tr('Moonglass Spires'),
};

export const ROLE_NAME: Record<BoardHex['role'], string> = {
  portal: tr('The centre'), inner: tr('The inner ring'), corridor: tr('A corridor'),
  home: tr('The home ring'), outer: tr('The outer ring'),
};

export const FOG_NAME: Record<FogState, string> = { Revealed: tr('Revealed'), Sensed: tr('Sensed'), Unknown: tr('Unknown') };

/** A coin's or a good's name, as a line reads it. */
export function coinName(c: CurrencyId | GoodId): string {
  switch (c) {
    case 'Gold': return tr('Gold');
    case 'Food': return tr('Food');
    case 'Wood': return tr('Wood');
    case 'Stone': return tr('Stone');
    case 'Mana': return tr('Mana');
    case 'Knowledge': return tr('Knowledge');
    case 'Stardust': return tr('Stardust');
    case 'HeroXp': return tr('Hero XP');
    case 'Gems': return tr('Gems');
    default: return GOODS[c]?.name ?? c;
  }
}

/** A pack's name on a chip: "Green pack". */
export const PACK_NAME: Record<PackTier, string> = {
  Green: tr('Green pack'), Yellow: tr('Yellow pack'), Rose: tr('Rose pack'),
  Blue: tr('Blue pack'), Purple: tr('Purple pack'), Golden: tr('Golden pack'),
};

/** A pack in a sentence: "a Green pack". */
export const A_PACK: Record<PackTier, string> = {
  Green: tr('a Green pack'), Yellow: tr('a Yellow pack'), Rose: tr('a Rose pack'),
  Blue: tr('a Blue pack'), Purple: tr('a Purple pack'), Golden: tr('a Golden pack'),
};

/** A translated line with elements in it — "An army of {power} stands
 *  here", with `{ power: powerTag(n) }`: each `{name}` the element named,
 *  wherever the language puts it. */
export function withTag(text: string, nodes: Record<string, Node>): HTMLElement {
  const parts = text.split(/\{(\w+)\}/);
  return el('span', {}, ...parts.map((p, i) => (i % 2 === 1 ? nodes[p] ?? `{${p}}` : p)).filter((p) => p !== ''));
}

/** What the sheet is called: whose city, what stands there, what it is,
 *  or that nobody knows. */
export function hexTitle(game: Game, bh: BoardHex, fog: FogState): string {
  if (bh.role === 'portal') return tr('The Dark Portal');
  const control = game.worldSource().controlOf(bh.index);
  if (bh.seat !== null && control?.owner.you) return tr('Your city');
  if (fog === 'Unknown') return tr('Unknown ground');
  if (bh.seat !== null && control !== null && !control.owner.you) return tr("{name}'s city", { name: control.owner.name });
  if (fog === 'Sensed') return tr('Misty ground');
  // A district, standing or going up, is what the hex is called.
  const held = game.worldSource().hexOf(bh.index);
  if (held !== null) return WORLD_BUILD.districts[held.district].name;
  const main = bh.features[0];
  return main !== undefined ? FEATURE_NAME[main] : TERRAIN_NAME[bh.terrain ?? 'Grassland'];
}

/** "Your" or "Lady Maren's" — in English: the dev bar's. */
export function seatName(game: Game, seat: number | null): string {
  if (seat === null) return 'Nobody’s';
  const s = game.worldSource().seats()[seat];
  return s === undefined || s.owner.you ? 'Your' : `${s.owner.name}'s`;
}

/** "Your ground", "Lady Maren's ground" or "Nobody's ground". */
export function seatGround(game: Game, seat: number | null): string {
  if (seat === null) return tr('Nobody’s ground');
  const s = game.worldSource().seats()[seat];
  return s === undefined || s.owner.you ? tr('Your ground') : tr("{name}'s ground", { name: s.owner.name });
}

/** "You", "Lady Maren" or "Nobody". */
export function seatWho(game: Game, seat: number | null): string {
  if (seat === null) return tr('Nobody');
  const s = game.worldSource().seats()[seat];
  return s === undefined || s.owner.you ? tr('You') : s.owner.name;
}
