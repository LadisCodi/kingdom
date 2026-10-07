// What a hex's ground does to a fight on it (Docs/features/19-world-map.md
// §4.2): each rule names a terrain or a feature, a troop type, and the share
// of attack it adds or takes. It is the ground's, so it is the same for both
// sides — an army that brings archers into a forest pays it, and so does a
// camp that keeps them there.

import { WORLD_TERRAIN_COMBAT } from '../data/definitions';
import type { Board } from '../battle';
import type { UnitId } from '../state';
import type { BoardHex } from './board';

/** The rules this hex's ground carries: its terrain's and each feature's. */
export function groundEdges(bh: BoardHex): Array<{ unit: UnitId; attack: number }> {
  const ground = new Set<string>([bh.terrain ?? '', ...bh.features]);
  return WORLD_TERRAIN_COMBAT.filter((r) => ground.has(r.ground)).map((r) => ({ unit: r.unit, attack: r.attack }));
}

/** A board as it fights on this hex: each troop squad's damage moved by the
 *  rules for its type. A copy — the army keeps its own board. */
export function onGround(board: Board, bh: BoardHex): Board {
  const edges = groundEdges(bh);
  if (edges.length === 0) return board;
  return {
    slots: board.slots.map((s) => {
      if (s.kind !== 'troop') return s;
      const add = edges.filter((e) => e.unit === s.type).reduce((n, e) => n + e.attack, 0);
      return add === 0 ? s : { ...s, dmg: s.dmg * Math.max(0, 1 + add) };
    }),
  };
}
