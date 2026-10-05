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

/** A mountain block of `size` with map cells on one side of it, out past
 *  its sight — so a test can stand on them — and the cell `d` rings out on
 *  that side. Null when the map has none. */
const bigMountain = (size: number): { anchor: Coord; out: (d: number) => Coord } | null => {
  const room = FOG.sight.mountainBySize[size - 1] + 1;
  for (const [key, id] of map.initialFeatures) {
    if (id !== 'Mountain') continue;
    const at = footprintAt(map, parseCoordKey(key));
    if (at.size !== size) continue;
    const { x, y } = at.anchor;
    const sides: Array<(d: number) => Coord> = [
      (d) => ({ x: x - d, y }), (d) => ({ x: x + size - 1 + d, y }),
      (d) => ({ x, y: y - d }), (d) => ({ x, y: y + size - 1 + d }),
    ];
    for (const out of sides) {
      const cells = Array.from({ length: room }, (_, i) => out(i + 1));
      if (cells.every((c) => map.terrain.has(`${c.x},${c.y}`))) return { anchor: at.anchor, out };
    }
  }
  return null;
};

describe('sighting', () => {
  it('sees a big mountain from its range, and not one cell further', () => {
    const sizes = [2, 3].filter((size) => bigMountain(size) !== null);
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      const { anchor, out } = bigMountain(size)!;
      const range = FOG.sight.mountainBySize[size - 1];
      const far = freshGame();
      far.fog.revealed = {};
      reveal(far, [out(range + 1)]);
      expect(sightedAt(far, map, anchor)).toBeUndefined();
      const near = freshGame();
      near.fog.revealed = {};
      reveal(near, [out(range)]);
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
    const lair = LAIRS.Orcs;
    const state = freshGame();
    // Clear of its zone, inside its sight.
    reveal(state, [westOf(lair.location, lair.sight)]);
    advance(state, map, T0 + 1000);
    expect(sightedAt(state, map, lair.location)?.kind).toBe('lair');
    expect(state.lairs.Orcs).toBeUndefined();
  });

  it('sees every lair past its own ground, so its silhouette can show', () => {
    for (const lair of Object.values(LAIRS)) {
      if (lair.sight > 0) expect(lair.sight, lair.id).toBeGreaterThan(lair.radius);
    }
  });

  it('drops a thing once it is in plain view', () => {
    const { anchor, out } = bigMountain(2)!;
    const state = freshGame();
    state.fog.revealed = {};
    reveal(state, [out(2)]);
    expect(sightedAt(state, map, anchor)).toBeDefined();
    reveal(state, [out(1)]); // its neighbour: the block is Discovered
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
