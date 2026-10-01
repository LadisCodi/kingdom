// SIGHTING (Docs/features/01-map-and-fog.md §4.1): a tall thing past the fog
// — a big mountain, a landmark, a lair — shows as a silhouette while a
// revealed cell lies close enough to it. A fact read off the revealed cells,
// which only ever grow, so nothing is stored and nothing is scheduled.
//
// A sighting is not a discovery: it announces nothing, finds no lair, moves
// no quest. The renderer draws it; the stage may talk about it.

import { FOG, LAIRS, LAIR_ORDER, LANDMARKS } from './data/definitions';
import { fogState } from './fog';
import { footprintAt, type MapData } from './grid';
import { coordKey, parseCoordKey, type Coord, type FeatureId, type GameState } from './state';

export type SightedKind = 'mountain' | 'landmark' | 'lair';

export interface Sighted {
  kind: SightedKind;
  /** The landmark's or lair's id; a mountain's feature id. */
  id: string;
  anchor: Coord;
  size: number;
}

const MOUNTAINS: ReadonlySet<FeatureId> = new Set<FeatureId>(['Mountain', 'MountainIron', 'MountainGold']);

/** Every tall thing on the map and how far it is seen from. Map data, so
 *  worked out once per map. */
const candidatesFor = (() => {
  const memo = new WeakMap<MapData, Array<Sighted & { range: number }>>();
  return (map: MapData): Array<Sighted & { range: number }> => {
    const known = memo.get(map);
    if (known) return known;
    const out: Array<Sighted & { range: number }> = [];
    for (const [key, id] of map.initialFeatures) {
      if (!MOUNTAINS.has(id)) continue;
      const cell = parseCoordKey(key);
      const { anchor, size } = footprintAt(map, cell);
      if (anchor.x !== cell.x || anchor.y !== cell.y) continue;
      const range = FOG.sight.mountainBySize[size - 1] ?? 0;
      if (range > 0) out.push({ kind: 'mountain', id, anchor, size, range });
    }
    for (const l of LANDMARKS) {
      const range = l.kind === 'Watchtower' ? FOG.sight.watchtower : FOG.sight.landmark;
      if (range > 0) out.push({ kind: 'landmark', id: l.id, anchor: l.location, size: l.size, range });
    }
    for (const id of LAIR_ORDER) {
      const lair = LAIRS[id];
      if (FOG.sight.lair > 0) {
        out.push({ kind: 'lair', id, anchor: lair.location, size: lair.size, range: FOG.sight.lair });
      }
    }
    memo.set(map, out);
    return out;
  };
})();

/** Is any cell within `range` (Chebyshev) of the block revealed? */
function seenFrom(state: GameState, t: Sighted & { range: number }): boolean {
  for (let y = t.anchor.y - t.range; y < t.anchor.y + t.size + t.range; y++) {
    for (let x = t.anchor.x - t.range; x < t.anchor.x + t.size + t.range; x++) {
      if (state.fog.revealed[coordKey({ x, y })] === true) return true;
    }
  }
  return false;
}

/** Is the thing already in plain view — and so drawn as itself? */
function inView(state: GameState, map: MapData, t: Sighted): boolean {
  // A lair is drawn once FOUND (a cell of its zone revealed), whatever the
  // fog on its own plot; a cleared one is gone.
  if (t.kind === 'lair') return state.lairs[t.id as keyof typeof LAIRS] !== undefined;
  for (let y = t.anchor.y; y < t.anchor.y + t.size; y++) {
    for (let x = t.anchor.x; x < t.anchor.x + t.size; x++) {
      if (fogState(state, map, { x, y }) !== 'Undiscovered') return true;
    }
  }
  return false;
}

const cache = new WeakMap<GameState, { stamp: string; list: Sighted[] }>();

/** Everything sighted right now and not yet in plain view. */
export function sightedThings(state: GameState, map: MapData): Sighted[] {
  // What decides it only grows — revealed cells, lairs found, cells
  // discovered — so their counts are enough to know nothing has changed.
  const stamp = `${Object.keys(state.fog.revealed).length}:${Object.keys(state.lairs).length}`
    + `:${Object.keys(state.fog.discovered).length}`;
  const known = cache.get(state);
  if (known && known.stamp === stamp) return known.list;
  const list: Sighted[] = candidatesFor(map)
    .filter((t) => !inView(state, map, t) && seenFrom(state, t))
    .map(({ kind, id, anchor, size }) => ({ kind, id, anchor, size }));
  cache.set(state, { stamp, list });
  return list;
}

/** The sighted thing standing on `cell`, if any. */
export function sightedAt(state: GameState, map: MapData, cell: Coord): Sighted | undefined {
  return sightedThings(state, map).find((t) =>
    cell.x >= t.anchor.x && cell.x < t.anchor.x + t.size
    && cell.y >= t.anchor.y && cell.y < t.anchor.y + t.size);
}
