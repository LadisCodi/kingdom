// SIGHTING (Docs/features/01-map-and-fog.md §4.1): a tall thing past the fog
// shows as a silhouette while a revealed cell lies close enough to it.
import { describe, expect, it } from 'vitest';
import { FOG, LANDMARKS, LAIRS } from '../src/sim/data/definitions';
import { advance } from '../src/sim/commands';
import { footprintAt } from '../src/sim/grid';
import { sightedAt, sightedThings } from '../src/sim/sight';
import { parseCoordKey, type Coord } from '../src/sim/state';
import { freshGame, map, reveal, T0 } from './helpers';

/** A cell `d` cells west of the block's left edge, on its top row. */
const westOf = (anchor: Coord, d: number): Coord => ({ x: anchor.x - d, y: anchor.y });

/** A mountain block of `size` with map cells to its west, out past its
 *  sight — so a test can stand on them. Null when the map has none. */
const bigMountain = (size: number): Coord | null => {
  const room = FOG.sight.mountainBySize[size - 1] + 1;
  for (const [key, id] of map.initialFeatures) {
    if (id !== 'Mountain') continue;
    const at = footprintAt(map, parseCoordKey(key));
    if (at.size !== size) continue;
    const west = Array.from({ length: room }, (_, i) => westOf(at.anchor, i + 1));
    if (west.every((c) => map.terrain.has(`${c.x},${c.y}`))) return at.anchor;
  }
  return null;
};

describe('sighting', () => {
  it('sees a big mountain from its range, and not one cell further', () => {
    const sizes = [2, 3].filter((size) => bigMountain(size) !== null);
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      const anchor = bigMountain(size)!;
      const range = FOG.sight.mountainBySize[size - 1];
      const far = freshGame();
      far.fog.revealed = {};
      reveal(far, [westOf(anchor, range + 1)]);
      expect(sightedAt(far, map, anchor)).toBeUndefined();
      const near = freshGame();
      near.fog.revealed = {};
      reveal(near, [westOf(anchor, range)]);
      expect(sightedAt(near, map, anchor)?.kind).toBe('mountain');
    }
  });

  it('never sights a lone peak', () => {
    expect(FOG.sight.mountainBySize[0]).toBe(0);
    const state = freshGame();
    expect(sightedThings(state, map).every((t) => t.kind !== 'mountain' || t.size > 1)).toBe(true);
  });

  it('sees the Watchtower from further than a shrine', () => {
    expect(FOG.sight.watchtower).toBeGreaterThan(FOG.sight.landmark);
    const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;
    const state = freshGame();
    state.fog.revealed = {};
    reveal(state, [westOf(tower.location, FOG.sight.watchtower)]);
    expect(sightedAt(state, map, tower.location)?.id).toBe(tower.id);
  });

  it('is not a discovery: a sighted lair is not found, and starts no raid clock', () => {
    const lair = LAIRS.Harpies;
    const state = freshGame();
    // Clear of its zone (radius 1), inside its sight.
    reveal(state, [westOf(lair.location, FOG.sight.lair)]);
    advance(state, map, T0 + 1000);
    expect(sightedAt(state, map, lair.location)?.kind).toBe('lair');
    expect(state.lairs.Harpies).toBeUndefined();
  });

  it('drops a thing once it is in plain view', () => {
    const anchor = bigMountain(2)!;
    const state = freshGame();
    state.fog.revealed = {};
    reveal(state, [westOf(anchor, 2)]);
    expect(sightedAt(state, map, anchor)).toBeDefined();
    reveal(state, [westOf(anchor, 1)]); // its neighbour: the block is Discovered
    expect(sightedAt(state, map, anchor)).toBeUndefined();
  });

  it('sees nothing from the Townhall alone that the fog already shows', () => {
    const state = freshGame();
    for (const t of sightedThings(state, map)) {
      for (let y = t.anchor.y; y < t.anchor.y + t.size; y++) {
        for (let x = t.anchor.x; x < t.anchor.x + t.size; x++) {
          expect(state.fog.revealed[`${x},${y}`]).not.toBe(true);
        }
      }
    }
  });
});
