// HOW THE PROVINCE OPENS (Docs/features/01-map-and-fog.md §6.1): what the
// first Townhalls can see and reach, pinned against the authored map so a
// map edit cannot quietly undo the order the opening is built on.
import { describe, expect, it } from 'vitest';
import { FOG, LAIRS, LANDMARKS, levelIndexed } from '../src/sim/data/definitions';
import { advance } from '../src/sim/commands';
import { footprintAt, townhallDistance } from '../src/sim/grid';
import { lairZoneCells, zoneLairsAt } from '../src/sim/lairZone';
import { sightedAt, sightedThings } from '../src/sim/sight';
import { coordKey, parseCoordKey, type Coord, type LairId } from '../src/sim/state';
import { freshGame, map, reveal, T0 } from './helpers';

const reachAt = (level: number): number => levelIndexed(FOG.reachPerTownhallLevel, level);

/** A kingdom that has revealed every cell out to `ring`, and swept for lairs. */
const revealedTo = (ring: number) => {
  const state = freshGame();
  reveal(state, map.cells.filter((c) => townhallDistance(map, c) <= ring));
  advance(state, map, T0 + 1000);
  return state;
};

const footprint = (o: Coord, size: number): Coord[] => {
  const out: Coord[] = [];
  for (let y = o.y; y < o.y + size; y++) for (let x = o.x; x < o.x + size; x++) out.push({ x, y });
  return out;
};
const lairDistance = (id: LairId): number =>
  Math.min(...footprint(LAIRS[id].location, LAIRS[id].size).map((c) => townhallDistance(map, c)));

const nearestLandmark = [...LANDMARKS]
  .sort((a, b) => townhallDistance(map, a.location) - townhallDistance(map, b.location))[0];

/** Every mountain cell on the map, with the block it belongs to. */
const mountains = [...map.initialFeatures]
  .filter(([, id]) => id.startsWith('Mountain'))
  .map(([key]) => { const cell = parseCoordKey(key); return { cell, size: footprintAt(map, cell).size }; });

describe('the province opens to the south', () => {
  it('shows the first landmark from the first ring', () => {
    expect(sightedAt(freshGame(), map, nearestLandmark.location)?.id).toBe(nearestLandmark.id);
  });

  it('shows one landmark while the Townhall is at level 1 — the first, south — and the two camps', () => {
    const state = revealedTo(reachAt(1));
    const seen = sightedThings(state, map);
    const landmarks = seen.filter((t) => t.kind === 'landmark');
    expect(landmarks.map((t) => t.id)).toEqual([nearestLandmark.id]);
    // South on screen is +x +y.
    expect(landmarks[0].anchor.x + landmarks[0].anchor.y).toBeGreaterThan(0);
    expect(seen.filter((t) => t.kind === 'lair').map((t) => t.id).sort()).toEqual(['Harpies', 'Orcs']);
  });

  it('shows the Orcs from the last ring the first Townhall reaches, not before', () => {
    expect(sightedAt(revealedTo(reachAt(1) - 1), map, LAIRS.Orcs.location)).toBeUndefined();
    expect(sightedAt(revealedTo(reachAt(1)), map, LAIRS.Orcs.location)?.id).toBe('Orcs');
  });

  it('holds the first landmark on the Orcs’ ground', () => {
    expect(lairZoneCells('Orcs').some((c) => coordKey(c) === coordKey(nearestLandmark.location))).toBe(true);
  });
});

describe('the near mountains are the Harpies’', () => {
  it('puts the Harpies past the second Townhall’s reach and inside the third’s', () => {
    expect(lairDistance('Harpies')).toBeGreaterThan(reachAt(2));
    expect(lairDistance('Harpies')).toBeLessThanOrEqual(reachAt(3));
  });

  it('shows the Harpies from the last ring the first Townhall reaches, not before', () => {
    expect(sightedAt(revealedTo(reachAt(1) - 1), map, LAIRS.Harpies.location)).toBeUndefined();
    expect(sightedAt(revealedTo(reachAt(1)), map, LAIRS.Harpies.location)?.id).toBe('Harpies');
  });

  it('holds every big mountain the second Townhall reaches', () => {
    const big = mountains.filter((m) => m.size > 1 && townhallDistance(map, m.cell) <= reachAt(2));
    expect(big.length).toBeGreaterThan(0);
    for (const m of big) expect(zoneLairsAt(m.cell), coordKey(m.cell)).toContain('Harpies');
  });

  it('leaves one loose stone node free inside that reach', () => {
    const free = mountains.filter((m) => townhallDistance(map, m.cell) <= reachAt(2)
      && zoneLairsAt(m.cell).length === 0);
    expect(free).toHaveLength(1);
    expect(free[0].size).toBe(1);
  });
});
