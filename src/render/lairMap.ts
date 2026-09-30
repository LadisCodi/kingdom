// What the map draws for a lair, as data: the ground its zones hold and the
// countdown its warning bubble reads (Docs/proposals/lairs.md §3, §6).
// DOM-free, so the tests can hold it.

import { LAIR_ORDER } from '../sim/data/definitions';
import { lairHoldsGround, lairZoneCells } from '../sim/lairZone';
import type { MapData } from '../sim/grid';
import { coordKey, type Coord, type GameState, type LairId, type UnitId } from '../sim/state';

/**
 * Every map cell some standing lair holds. Zones that overlap are ONE zone
 * (§3), so this is the union — the border is drawn round it, never round each
 * square. Cells off the map are left out.
 */
export function heldZone(state: GameState, map: MapData): { cells: Coord[]; keys: Set<string> } {
  const keys = new Set<string>();
  const cells: Coord[] = [];
  for (const id of LAIR_ORDER) {
    if (!lairHoldsGround(state, id)) continue;
    for (const c of lairZoneCells(id)) {
      const k = coordKey(c);
      if (keys.has(k) || !map.terrain.has(k)) continue;
      keys.add(k);
      cells.push(c);
    }
  }
  return { cells, keys };
}

/**
 * The sides of `cell` that face out of the area — N/S/E/W on the square grid,
 * the same sides `edgePath` rotates onto the diamond.
 */
export function outerSides(cell: Coord, inside: Set<string>): Array<'N' | 'E' | 'S' | 'W'> {
  const out: Array<'N' | 'E' | 'S' | 'W'> = [];
  if (!inside.has(coordKey({ x: cell.x, y: cell.y - 1 }))) out.push('N');
  if (!inside.has(coordKey({ x: cell.x + 1, y: cell.y }))) out.push('E');
  if (!inside.has(coordKey({ x: cell.x, y: cell.y + 1 }))) out.push('S');
  if (!inside.has(coordKey({ x: cell.x - 1, y: cell.y }))) out.push('W');
  return out;
}

/**
 * Time left, short enough for a bubble: "45s", "27m", "1h 20m", "3h", "2d 4h".
 * Rounded UP, so it never reads 0 while a raid is still to come.
 */
export function compactCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.ceil(s / 60);
    return m >= 60 ? '1h' : `${m}m`;
  }
  const totalM = Math.floor(s / 60);
  if (totalM < 24 * 60) {
    const h = Math.floor(totalM / 60);
    const rm = totalM % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  const totalH = Math.floor(totalM / 60);
  const d = Math.floor(totalH / 24);
  const rh = totalH % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

/** The medallion over each lair's bubble: the creature that lives there. */
export const LAIR_AVATAR: Record<LairId, string> = {
  Orcs: 'creature_orc_avatar',
  Harpies: 'creature_harpy_avatar',
  Goblins: 'creature_goblin_avatar',
  WolfRiders: 'creature_wolfrider_avatar',
  Drake: 'creature_drake_avatar',
};

/** The creature a lair's squad of each troop type IS, wherever it is drawn —
 *  the attack screen's enemy board and the fight's playback
 *  (Docs/art/originals/lairs/LOG.md). The same four in every lair; the drake
 *  is the Drake lair's face, never a squad's. */
export const UNIT_CREATURE_AVATAR: Record<UnitId, string> = {
  Warrior: 'creature_orc_avatar',
  Lancer: 'creature_goblin_avatar',
  Archer: 'creature_harpy_avatar',
  Cavalry: 'creature_wolfrider_avatar',
};

/**
 * WHERE EACH WARNING BUBBLE LANDED on the last frame, in canvas CSS pixels.
 * The bubble floats over the lair and may sit over other cells, so a tap on
 * it is resolved here — to the lair — before the tap becomes a cell.
 */
const bubbleRects = new Map<LairId, { x: number; y: number; w: number; h: number }>();

export function clearLairBubbles(): void { bubbleRects.clear(); }

export function markLairBubble(id: LairId, r: { x: number; y: number; w: number; h: number }): void {
  bubbleRects.set(id, r);
}

/** The lair whose bubble covers the screen point, or null. */
export function lairBubbleAt(sx: number, sy: number): LairId | null {
  for (const [id, r] of bubbleRects) {
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return id;
  }
  return null;
}
