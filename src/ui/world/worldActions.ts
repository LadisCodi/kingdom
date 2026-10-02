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
  /** An army: to attack a rival's ground, to take ground nobody holds, or to
   *  man the player's own Fortress (19 §4–§6). */
  | { kind: 'army'; purpose: 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' }
  /** Go down the Portal's next floor, with the army in it. */
  | { kind: 'descend'; army: string }
  | { kind: 'recall'; army: string }
  /** Fight the next room of a dungeon, with the army camped there. */
  | { kind: 'delve'; army: string }
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
  // The Dark Portal: any army may go down while it is open (19 §10.3).
  if (bh.role === 'portal') {
    const portal = source.portal();
    const mine = source.armies().find((a) => a.owner === seat && a.purpose === 'portal' && a.phase !== 'home');
    if (mine !== undefined) return mine.phase === 'camp' ? [{ kind: 'descend', army: mine.id }, { kind: 'recall', army: mine.id }] : [{ kind: 'recall', army: mine.id }];
    return portal?.open ? [{ kind: 'army', purpose: 'portal' }] : [];
  }
  // A dungeon: never held, open to any army (19 §8.1).
  if (bh.features.includes('Dungeon')) {
    const mine = source.armies().find((a) => a.owner === seat && a.target === bh.index && a.purpose === 'delve' && a.phase !== 'home');
    if (mine === undefined) return [{ kind: 'army', purpose: 'delve' }];
    if (mine.phase === 'camp') return [{ kind: 'delve', army: mine.id }, { kind: 'recall', army: mine.id }];
    return [{ kind: 'recall', army: mine.id }];
  }
  if (h !== null && h.held && h.owner !== seat) {
    return [{ kind: 'army', purpose: h.owner === null ? 'claim' : 'attack' }];
  }
  if (h === null) {
    const neverHeld = bh.features.includes('Dungeon') || bh.seat !== null;
    if (neverHeld || !touches(source, seat, bh.index)) return [];
    return [{ kind: 'claim', gold: outpostGold(hexesHeldBy(source, seat)), seconds: WORLD_BUILD.outpost.buildSeconds }];
  }
  if (h.owner !== seat || !h.held) return [];
  const out: HexAction[] = [];
  // The player's own Fortress: man it, or call its garrison home.
  if (h.improvement?.kind === 'Fortress') {
    if (h.garrison && h.garrison.owner === seat) out.push({ kind: 'recall', army: h.garrison.army });
    else out.push({ kind: 'army', purpose: 'garrison' });
  }
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
