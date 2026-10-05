// How long a march takes, hex by hex (Docs/features/19-world-map.md §4).
import { describe, expect, it } from 'vitest';
import { WORLD, WORLD_TRAVEL } from '../src/sim/data/definitions';
import type { BoardHex } from '../src/sim/world/board';
import { BOARD_SIZE, boardNeighbors, hexAt, hexDistance, hexIndex } from '../src/sim/world/hex';
import {
  fastestRoute, hexTravelFactor, hexTravelMs, homeboundMs, legPosition, outboundMs, reachMs,
} from '../src/sim/world/travel';

const MIN = 60_000;
const EXPLORER = WORLD.explorerSecondsPerHex * 1000;
const ARMY = WORLD.armySecondsPerHex * 1000;

/** A board of open grassland, with whatever ground a test lays on it. */
function ground(lay: Record<number, Pick<BoardHex, 'terrain' | 'features'>> = {}): BoardHex[] {
  return Array.from({ length: BOARD_SIZE }, (_, index): BoardHex => ({
    index, hex: hexAt(index), role: 'outer', seat: null, ...(lay[index] ?? { terrain: 'Grassland', features: [] }),
  }));
}

const everywhere = () => true;
const centre = hexIndex({ q: 0, r: 0 });

describe('what a hex costs to leave', () => {
  it('is the marcher\'s pace on open ground, times its terrain and its feature', () => {
    const [plain, forest, mountain] = ground({
      1: { terrain: 'Grassland', features: ['Forest'] },
      2: { terrain: 'Grassland', features: ['Mountain'] },
    });
    expect(hexTravelFactor(plain)).toBe(1);
    expect(hexTravelFactor(forest)).toBe(WORLD_TRAVEL.feature.Forest!);
    expect(hexTravelFactor(mountain)).toBe(WORLD_TRAVEL.feature.Mountain!);
    expect(hexTravelFactor({ terrain: 'Desert', features: ['Mountain'] } as BoardHex))
      .toBe(WORLD_TRAVEL.terrain.Desert! * WORLD_TRAVEL.feature.Mountain!);
    expect(hexTravelMs(plain, 'explorer')).toBe(EXPLORER);
    expect(hexTravelMs(forest, 'explorer')).toBe(EXPLORER * WORLD_TRAVEL.feature.Forest!);
    expect(hexTravelMs(plain, 'army')).toBe(ARMY);
  });

  it('marches an army slower than an explorer', () => {
    expect(ARMY).toBeGreaterThan(EXPLORER);
  });

  it('counts each hex as it is left: plain, forest, mountain', () => {
    // The city on the plain, a forest, then the mountain it marches to.
    const from = centre;
    const forest = boardNeighbors(from)[0];
    const mountain = boardNeighbors(forest).find((n) => hexDistance(hexAt(n), hexAt(from)) === 2)!;
    const hexes = ground({
      [forest]: { terrain: 'Grassland', features: ['Forest'] },
      [mountain]: { terrain: 'Grassland', features: ['Mountain'] },
    });
    const route = fastestRoute(hexes, from, mountain, 'explorer', everywhere)!;
    expect(route.path).toHaveLength(3);
    const [, via] = route.path;
    const viaMs = hexTravelMs(hexes[via], 'explorer');
    expect(route.stepMs).toEqual([EXPLORER, viaMs, 3 * EXPLORER]);
    // Out: leave the city, leave the hex between. Back: leave the mountain,
    // leave the hex between.
    expect(outboundMs(route.stepMs)).toBe(EXPLORER + viaMs);
    expect(homeboundMs(route.stepMs)).toBe(3 * EXPLORER + viaMs);
    expect(reachMs(route.stepMs, 1)).toBe(EXPLORER);
  });
});

describe('the quickest way', () => {
  const from = hexIndex({ q: -3, r: 0 });
  const to = hexIndex({ q: 3, r: 0 });

  it('is a straight line over open ground', () => {
    const route = fastestRoute(ground(), from, to, 'army', everywhere)!;
    expect(route.path).toHaveLength(7);
    expect(outboundMs(route.stepMs)).toBe(6 * ARMY);
  });

  it('goes round mountains when that is quicker, and over them when it is not', () => {
    // A mountain on the straight line: a hex round it is quicker than over.
    const wall: Record<number, Pick<BoardHex, 'terrain' | 'features'>> = {};
    wall[centre] = { terrain: 'Grassland', features: ['Mountain'] };
    const round = fastestRoute(ground(wall), from, to, 'army', everywhere)!;
    expect(round.path).not.toContain(centre);
    expect(outboundMs(round.stepMs)).toBe(7 * ARMY);

    // A wall across the whole board: the cheapest crossing is one mountain.
    const full: Record<number, Pick<BoardHex, 'terrain' | 'features'>> = {};
    for (let r = -6; r <= 6; r++) {
      const i = hexIndex({ q: 0, r });
      if (i >= 0) full[i] = { terrain: 'Grassland', features: ['Mountain'] };
    }
    const over = fastestRoute(ground(full), from, to, 'army', everywhere)!;
    expect(over.path.filter((i) => full[i] !== undefined)).toHaveLength(1);
    expect(outboundMs(over.stepMs)).toBe(5 * ARMY + 3 * ARMY);
  });

  it('never enters a hex it may not, but may always end on its destination', () => {
    const allowed = new Set([from, hexIndex({ q: -2, r: 0 })]);
    const near = hexIndex({ q: -1, r: 0 });
    const route = fastestRoute(ground(), from, near, 'explorer', (i) => allowed.has(i))!;
    expect(route.path).toEqual([from, hexIndex({ q: -2, r: 0 }), near]);
    expect(fastestRoute(ground(), from, to, 'explorer', (i) => allowed.has(i))).toBeNull();
    expect(fastestRoute(ground(), from, from, 'explorer', everywhere)).toBeNull();
  });

  it('is the same way every time', () => {
    const a = fastestRoute(ground(), from, hexIndex({ q: 2, r: 2 }), 'army', everywhere);
    const b = fastestRoute(ground(), from, hexIndex({ q: 2, r: 2 }), 'army', everywhere);
    expect(a).toEqual(b);
  });

  it('is shortened, never lengthened, by a speed', () => {
    const forest: Pick<BoardHex, 'terrain' | 'features'> = { terrain: 'Grassland', features: ['Forest'] };
    const hexes = ground({ [hexIndex({ q: -2, r: 0 })]: forest });
    const plain = fastestRoute(hexes, from, to, 'army', everywhere)!;
    const woodsman = fastestRoute(hexes, from, to, 'army', everywhere, (bh) => (bh.features.includes('Forest') ? 1.5 : 1))!;
    const clumsy = fastestRoute(hexes, from, to, 'army', everywhere, () => 0.5)!;
    expect(outboundMs(woodsman.stepMs)).toBeLessThanOrEqual(outboundMs(plain.stepMs));
    expect(clumsy).toEqual(plain);
  });
});

describe('where a marcher is', () => {
  const steps = [MIN, 2 * MIN, 3 * MIN];

  it('walks up the path out, each stretch as long as the hex it leaves', () => {
    expect(legPosition(steps, 0, true)).toEqual({ k: 0, next: 1, f: 0 });
    expect(legPosition(steps, MIN / 2, true)).toEqual({ k: 0, next: 1, f: 0.5 });
    expect(legPosition(steps, 2 * MIN, true)).toEqual({ k: 1, next: 2, f: 0.5 });
    expect(legPosition(steps, 10 * MIN, true)).toEqual({ k: 1, next: 2, f: 1 });
  });

  it('walks down it home', () => {
    expect(legPosition(steps, 0, false)).toEqual({ k: 2, next: 1, f: 0 });
    expect(legPosition(steps, 3 * MIN + MIN, false)).toEqual({ k: 1, next: 0, f: 0.5 });
  });
});
