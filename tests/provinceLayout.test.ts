// HOW THE PROVINCE OPENS (Docs/features/01-map-and-fog.md §6.1): what the
// first Townhalls can see and reach, pinned against the authored map so a
// map edit cannot quietly undo the order the opening is built on.
import { describe, expect, it } from 'vitest';
import { ABANDONED, FOG, LAIRS, LANDMARKS, levelIndexed } from '../src/sim/data/definitions';
import { advance } from '../src/sim/commands';
import { footprintAt, townhallDistance } from '../src/sim/grid';
import { lairZoneCells, zoneLairsAt } from '../src/sim/lairZone';
import { sightedAt, sightedThings } from '../src/sim/sight';
import { coordKey, parseCoordKey, type LairId } from '../src/sim/state';
import { freshGame, map, reveal, T0 } from './helpers';

const reachAt = (level: number): number => levelIndexed(FOG.reachPerTownhallLevel, level);

/** A kingdom that has revealed every cell out to `ring`, and swept for lairs. */
const revealedTo = (ring: number) => {
  const state = freshGame();
  reveal(state, map.cells.filter((c) => townhallDistance(map, c) <= ring));
  advance(state, map, T0 + 1000);
  return state;
};

const tower = LANDMARKS.find((l) => l.kind === 'Watchtower')!;

/** The first thing to the south: the Thorned Shrine's ruin, on the Orcs'
 *  ground — once a landmark, now the province's one Shrine site. */
const shrine = ABANDONED.find((a) => a.id === 'ThornedShrine')!;

/** Every mountain cell on the map, with the block it belongs to. */
const mountains = [...map.initialFeatures]
  .filter(([, id]) => id.startsWith('Mountain'))
  .map(([key]) => { const cell = parseCoordKey(key); return { cell, size: footprintAt(map, cell).size }; });

describe('the province opens to the south', () => {
  it('shows the Shrine\'s ruin from the first ring', () => {
    expect(sightedAt(freshGame(), map, shrine.location)?.id).toBe(shrine.id);
  });

  it('shows the Shrine\'s ruin, south, and the Watchtower, north, while the Townhall is at level 1 — and the Orcs\' camp', () => {
    const state = revealedTo(reachAt(1));
    const seen = sightedThings(state, map);
    expect(seen.filter((t) => t.kind === 'landmark').map((t) => t.id)).toEqual([tower.id]);
    expect(seen.some((t) => t.kind === 'abandoned' && t.id === shrine.id)).toBe(true);
    // South on screen is +x +y; north is −x −y.
    expect(shrine.location.x + shrine.location.y).toBeGreaterThan(0);
    expect(tower.location.x + tower.location.y).toBeLessThan(0);
    expect(seen.filter((t) => t.kind === 'lair').map((t) => t.id)).toEqual(['Orcs']);
  });

  it('shows the Orcs from the last ring the first Townhall reaches, not before', () => {
    expect(sightedAt(revealedTo(reachAt(1) - 1), map, LAIRS.Orcs.location)).toBeUndefined();
    expect(sightedAt(revealedTo(reachAt(1)), map, LAIRS.Orcs.location)?.id).toBe('Orcs');
  });

  it('holds the Shrine\'s ruin on the Orcs’ ground', () => {
    expect(lairZoneCells('Orcs').some((c) => coordKey(c) === coordKey(shrine.location))).toBe(true);
  });
});

/** The nearest ring of a lair's ground on the map: where revealing a cell
 *  finds it. */
const groundDistance = (id: LairId): number =>
  Math.min(...lairZoneCells(id).filter((c) => map.terrain.has(coordKey(c)))
    .map((c) => townhallDistance(map, c)));

// The Orcs come first: the second Townhall can find no other lair, so the
// first fight, the Warden and the victory are theirs.
describe('the Orcs are the second Townhall’s only lair', () => {
  it('puts the Orcs’ ground inside the second Townhall’s reach', () => {
    expect(groundDistance('Orcs')).toBeLessThanOrEqual(reachAt(2));
  });

  it('puts every other lair’s ground past it', () => {
    for (const id of Object.keys(LAIRS) as LairId[]) {
      if (id !== 'Orcs') expect(groundDistance(id), id).toBeGreaterThan(reachAt(2));
    }
  });
});

describe('the near mountains are the Harpies’', () => {
  it('puts the Harpies’ ground past the second Townhall’s reach and inside the third’s', () => {
    expect(groundDistance('Harpies')).toBeGreaterThan(reachAt(2));
    expect(groundDistance('Harpies')).toBeLessThanOrEqual(reachAt(3));
  });

  it('shows the Harpies from the last ring the second Townhall reaches, not before', () => {
    expect(sightedAt(revealedTo(reachAt(2) - 1), map, LAIRS.Harpies.location)).toBeUndefined();
    expect(sightedAt(revealedTo(reachAt(2)), map, LAIRS.Harpies.location)?.id).toBe('Harpies');
  });

  it('holds every big mountain the second Townhall reaches', () => {
    const big = mountains.filter((m) => m.size > 1 && townhallDistance(map, m.cell) <= reachAt(2));
    for (const m of big) expect(zoneLairsAt(m.cell), coordKey(m.cell)).toContain('Harpies');
  });

  // Gold beyond the houses is a Mana sink worth fighting for: the second
  // Townhall reaches none, and the one vein the third reaches is on the
  // Harpies' ground.
  it('guards the gold vein the third Townhall reaches', () => {
    const goldTo = (ring: number) => [...map.initialFeatures]
      .filter(([key, id]) => id === 'MountainGold' && townhallDistance(map, parseCoordKey(key)) <= ring)
      .map(([key]) => parseCoordKey(key));
    expect(goldTo(reachAt(2))).toHaveLength(0);
    expect(goldTo(reachAt(3))).toHaveLength(1);
    expect(zoneLairsAt(goldTo(reachAt(3))[0])).toContain('Harpies');
  });
});

// The world door is the Watchtower: the second Townhall reaches it, so the
// world map opens in chapter 2, not chapter 4.
describe('the Watchtower is the second Townhall’s', () => {
  it('stands past the first Townhall’s reach and inside the second’s', () => {
    expect(townhallDistance(map, tower.location)).toBeGreaterThan(reachAt(1));
    expect(townhallDistance(map, tower.location)).toBeLessThanOrEqual(reachAt(2));
  });

  it('stands on no lair’s ground', () => {
    expect(zoneLairsAt(tower.location)).toEqual([]);
  });

  it('leaves one loose stone node free inside that reach', () => {
    const free = mountains.filter((m) => townhallDistance(map, m.cell) <= reachAt(2)
      && zoneLairsAt(m.cell).length === 0);
    expect(free).toHaveLength(1);
    expect(free[0].size).toBe(1);
  });
});
