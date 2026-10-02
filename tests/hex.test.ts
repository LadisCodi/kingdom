// The world board's lattice (Docs/features/19-world-map.md §1).
import { describe, expect, it } from 'vitest';
import {
  BOARD_HEXES, BOARD_SIZE, HEX_DIRS, PORTAL_INDEX, boardNeighbors, hexAt, hexDistance, hexIndex,
  hexLine, hexRing, hexesWithin, ringOf, rotate60, rotateBy,
} from '../src/sim/world/hex';
import {
  bitIndices, bitsFrom, clearBit, countBits, emptyBits, hasBit, readBits, setBit,
} from '../src/sim/world/fogBits';

describe('the hex lattice', () => {
  it('is 91 hexes in six rings round the Portal', () => {
    expect(BOARD_SIZE).toBe(91);
    const rings = [0, 1, 2, 3, 4, 5].map((k) => BOARD_HEXES.filter((h) => ringOf(h) === k).length);
    expect(rings).toEqual([1, 6, 12, 18, 24, 30]);
    expect(hexAt(PORTAL_INDEX)).toEqual({ q: 0, r: 0 });
    expect(PORTAL_INDEX).toBe(45);
  });

  it('round-trips every index', () => {
    BOARD_HEXES.forEach((h, i) => expect(hexIndex(h)).toBe(i));
    expect(hexIndex({ q: 6, r: 0 })).toBe(-1);
  });

  it('counts steps, symmetrically and never shorter than a detour', () => {
    for (const a of BOARD_HEXES) {
      for (const b of BOARD_HEXES) {
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
        expect(hexDistance(a, b)).toBeLessThanOrEqual(hexDistance(a, { q: 0, r: 0 }) + ringOf(b));
      }
    }
    for (const d of HEX_DIRS) expect(hexDistance({ q: 0, r: 0 }, d)).toBe(1);
  });

  it('turns a sixth at a time, and six turns are none', () => {
    HEX_DIRS.forEach((d, i) => expect(rotate60(d)).toEqual(HEX_DIRS[(i + 1) % 6]));
    for (const h of BOARD_HEXES) {
      expect(rotateBy(h, 6)).toEqual(h);
      expect(ringOf(rotate60(h))).toBe(ringOf(h));
    }
  });

  it('walks rings and discs of the right size', () => {
    for (let k = 0; k <= 5; k++) {
      const ring = hexRing({ q: 0, r: 0 }, k);
      expect(ring.length).toBe(k === 0 ? 1 : 6 * k);
      for (const h of ring) expect(ringOf(h)).toBe(k);
    }
    expect(hexesWithin({ q: 0, r: 0 }, 5).map(hexIndex).sort((a, b) => a - b))
      .toEqual(BOARD_HEXES.map((_, i) => i));
    expect(boardNeighbors(PORTAL_INDEX)).toHaveLength(6);
    expect(boardNeighbors(hexIndex({ q: 5, r: 0 }))).toHaveLength(3);
  });

  it('draws a march as adjacent steps, end to end, the same every time', () => {
    for (const a of BOARD_HEXES) {
      for (const b of BOARD_HEXES) {
        const line = hexLine(a, b);
        expect(line).toHaveLength(hexDistance(a, b) + 1);
        expect(line[0]).toEqual(a);
        expect(line[line.length - 1]).toEqual(b);
        for (let i = 1; i < line.length; i++) expect(hexDistance(line[i - 1], line[i])).toBe(1);
        for (const h of line) expect(hexIndex(h)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(hexLine({ q: 0, r: 4 }, { q: 0, r: 0 })).toEqual(hexLine({ q: 0, r: 4 }, { q: 0, r: 0 }));
  });
});

describe('the fog bitset', () => {
  it('sets, reads, clears and counts', () => {
    const bits = emptyBits();
    expect(bits).toEqual([0, 0, 0]);
    for (const i of [0, 31, 32, 63, 64, 90]) setBit(bits, i);
    expect(bitIndices(bits)).toEqual([0, 31, 32, 63, 64, 90]);
    expect(bits.every((w) => w >= 0)).toBe(true);
    clearBit(bits, 31);
    expect(hasBit(bits, 31)).toBe(false);
    expect(countBits(bits)).toBe(5);
    expect(bitsFrom([3, 4])).toEqual(readBits(bitsFrom([3, 4])));
  });

  it('reads a damaged save as empty rather than trusting it', () => {
    expect(readBits('nope')).toEqual([0, 0, 0]);
    expect(readBits([-1, 1.5, 2 ** 33])).toEqual([0, 0, 0]);
    expect(bitIndices(readBits([0, 0, 0xffff_ffff]))).toHaveLength(BOARD_SIZE - 64);
  });
});
