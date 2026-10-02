// What can be done on a world hex, read off the server's last snapshot
// (Docs/features/19-world-map.md §5.1, §7). The dispatch sheet draws its
// buttons from this; the server's answer to the command is what counts, so
// nothing here has to be the final word — only the right offer.

import { WORLD_BUILD } from '../../sim/data/definitions';
import { SEAT_INDICES, type BoardHex } from '../../sim/world/board';
import { boardNeighbors } from '../../sim/world/hex';
import type { HexControl, WorldSource } from '../../sim/world/source';
import type { WorldImprovement } from '../../sim/world/types';
import { fittingImprovements, outpostGold } from '../../worldServer/core';

export type HexAction =
  | { kind: 'claim'; gold: number; seconds: number }
  | { kind: 'build'; improvement: WorldImprovement; level: number; gold: number; seconds: number }
  | { kind: 'collect'; material: number; knowledge: number; ready: boolean };

/** Hexes `seat` holds or is claiming beyond its city. */
export const hexesHeldBy = (source: WorldSource, seat: number): number =>
  source.board().hexes.filter((h) => source.hexOf(h.index)?.owner === seat).length;

/** Whether `seat` reaches `index` from held, active ground or its city. */
function touches(source: WorldSource, seat: number, index: number): boolean {
  return boardNeighbors(index).some((n) => {
    if (n === SEAT_INDICES[seat]) return true;
    const h = source.hexOf(n);
    return h !== null && h.owner === seat && h.held && h.active;
  });
}

/** A store is worth a tap once it holds a whole unit of something. */
const collectable = (h: HexControl): { material: number; knowledge: number } => ({
  material: Math.floor(h.stores?.material ?? 0),
  knowledge: Math.floor(h.stores?.knowledge ?? 0),
});

/** What `seat` can do on this hex now, in the order the sheet shows it. */
export function hexActions(source: WorldSource, seat: number, bh: BoardHex): HexAction[] {
  const h = source.hexOf(bh.index);
  if (h === null) {
    const neverHeld = bh.role === 'portal' || bh.features.includes('Dungeon') || bh.seat !== null;
    if (neverHeld || !touches(source, seat, bh.index)) return [];
    return [{ kind: 'claim', gold: outpostGold(hexesHeldBy(source, seat)), seconds: WORLD_BUILD.outpost.buildSeconds }];
  }
  if (h.owner !== seat || !h.held) return [];
  const out: HexAction[] = [];
  const { material, knowledge } = collectable(h);
  if (h.stores !== null && (h.stores.materialCap > 0 || h.stores.knowledgeCap > 0)) {
    out.push({ kind: 'collect', material, knowledge, ready: material > 0 || knowledge > 0 });
  }
  if (h.work !== null || !h.active) return out;
  const kinds = h.improvement !== null ? [h.improvement.kind] : fittingImprovements(bh);
  for (const kind of kinds) {
    const levels = WORLD_BUILD.improvements[kind].levels;
    const level = (h.improvement?.level ?? 0) + 1;
    if (level > levels.length) continue;
    out.push({ kind: 'build', improvement: kind, level, gold: levels[level - 1].gold, seconds: levels[level - 1].buildSeconds });
  }
  return out;
}
