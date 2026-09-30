// What the map draws for a lair: the union of the held zones, its outside
// edge, and the bubble's countdown (src/render/lairMap.ts).
import { describe, expect, it } from 'vitest';
import { LAIRS } from '../src/sim/data/definitions';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey } from '../src/sim/state';
import { lairZoneCells } from '../src/sim/lairZone';
import { compactCountdown, heldZone, outerSides } from '../src/render/lairMap';

describe('the held zone', () => {
  const map = buildMapData();
  const hold = (state: ReturnType<typeof newGame>, id: keyof typeof LAIRS, cleared = false) => {
    state.lairs[id] = { armedAt: 0, nextRaidAt: 1, hoard: {}, defeated: cleared, cleared };
  };

  it('is empty until a lair is found, and again once it is cleared', () => {
    const state = newGame(map, 0);
    expect(heldZone(state, map).cells).toHaveLength(0);
    hold(state, 'Orcs', true);
    expect(heldZone(state, map).cells).toHaveLength(0);
  });

  it('is every on-map cell of the zone, footprint included', () => {
    const state = newGame(map, 0);
    hold(state, 'Orcs');
    const { keys } = heldZone(state, map);
    const onMap = lairZoneCells('Orcs').filter((c) => map.terrain.has(coordKey(c)));
    expect(keys.size).toBe(onMap.length);
    expect(keys.has(coordKey(LAIRS.Orcs.location))).toBe(true);
  });

  it('outlines only the outside of a union, never a shared edge', () => {
    // Two overlapping 3x3 squares: (0..2, 0..2) and (1..3, 1..3).
    const inside = new Set<string>();
    for (const [ox, oy] of [[0, 0], [1, 1]]) {
      for (let y = oy; y < oy + 3; y++) for (let x = ox; x < ox + 3; x++) inside.add(coordKey({ x, y }));
    }
    // The centre of the overlap has no outer side at all.
    expect(outerSides({ x: 1, y: 1 }, inside)).toEqual([]);
    expect(outerSides({ x: 2, y: 2 }, inside)).toEqual([]);
    // A corner of one square keeps its two outside sides.
    expect(outerSides({ x: 0, y: 0 }, inside).sort()).toEqual(['N', 'W']);
    let edges = 0;
    for (const k of inside) {
      const [x, y] = k.split(',').map(Number);
      edges += outerSides({ x, y }, inside).length;
    }
    // Perimeter of the union: 3+3 + 1+1 + 1+1 + 3+3 = 16 unit edges.
    expect(edges).toBe(16);
  });
});

describe('compactCountdown', () => {
  it.each([
    [0, '0s'], [450, '1s'], [45_000, '45s'], [59_000, '59s'],
    [60_000, '1m'], [27 * 60_000 - 1, '27m'], [3_599_000, '1h'],
    [3_600_000, '1h'], [80 * 60_000, '1h 20m'], [3 * 3_600_000, '3h'],
    [(2 * 24 + 4) * 3_600_000, '2d 4h'], [-5, '0s'],
  ])('%i ms reads %s', (ms, text) => {
    expect(compactCountdown(ms)).toBe(text);
  });
});
