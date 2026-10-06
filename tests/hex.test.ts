// The world board's lattice (Docs/features/19-world-map.md §1).
import { describe, expect, it } from 'vitest';
import {
  BOARD_CENTRES, BOARD_COUNT, BOARD_HEXES, BOARD_SIZE, HEX_DIRS, PORTAL_INDEX, PORTAL_INDICES, boardNeighbors, hexAt,
  hexDistance, hexIndex, hexLine, hexRing, hexesWithin, localHex, miniBoardOf, ringOf, rotate60, rotateBy,
} from '../src/sim/world/hex';
import {
  bitIndices, bitsFrom, clearBit, countBits, emptyBits, hasBit, readBits, setBit,
} from '../src/sim/world/fogBits';

describe('the hex lattice', () => {
  it('is seven boards of 127 hexes, each seven rings round its Portal, tiling without a gap', () => {
    expect(BOARD_COUNT).toBe(7);
    expect(BOARD_SIZE).toBe(7 * 127);
    for (let b = 0; b < BOARD_COUNT; b++) {
      const mine = BOARD_HEXES.filter((h) => miniBoardOf(h) === b);
      expect(mine).toHaveLength(127);
      const rings = [0, 1, 2, 3, 4, 5, 6].map((k) => mine.filter((h) => ringOf(h) === k).length);
      expect(rings).toEqual([1, 6, 12, 18, 24, 30, 36]);
      expect(hexAt(PORTAL_INDICES[b])).toEqual(BOARD_CENTRES[b]);
    }
    expect(hexAt(PORTAL_INDEX)).toEqual({ q: 0, r: 0 });
    // No hole: every hex all six of whose neighbours are in the world is in it.
    for (const h of BOARD_HEXES) {
      for (const n of hexesWithin(h, 1)) {
        if (hexIndex(n) < 0) expect(hexesWithin(n, 1).slice(1).some((m) => hexIndex(m) < 0)).toBe(true);
      }
    }
  });

  it('round-trips every index, and every hex to its board', () => {
    BOARD_HEXES.forEach((h, i) => expect(hexIndex(h)).toBe(i));
    expect(hexIndex({ q: 40, r: 0 })).toBe(-1);
    for (const h of BOARD_HEXES) {
      const b = miniBoardOf(h);
      const l = localHex(h);
      expect(hexDistance(l, { q: 0, r: 0 })).toBe(ringOf(h));
      expect({ q: l.q + BOARD_CENTRES[b].q, r: l.r + BOARD_CENTRES[b].r }).toEqual(h);
    }
  });

  it('counts steps, symmetrically and never shorter than a detour', () => {
    const some = BOARD_HEXES.filter((_, i) => i % 7 === 0);
    for (const a of some) {
      for (const b of some) {
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
        expect(hexDistance(a, b)).toBeLessThanOrEqual(hexDistance(a, { q: 0, r: 0 }) + hexDistance({ q: 0, r: 0 }, b));
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
    for (let k = 0; k <= 6; k++) {
      const ring = hexRing({ q: 0, r: 0 }, k);
      expect(ring.length).toBe(k === 0 ? 1 : 6 * k);
      for (const h of ring) expect(ringOf(h)).toBe(k);
    }
    expect(hexesWithin({ q: 0, r: 0 }, 6).map(hexIndex).every((i) => i >= 0 && miniBoardOf(hexAt(i)) === 0)).toBe(true);
    expect(boardNeighbors(PORTAL_INDEX)).toHaveLength(6);
    // A rim hex of the middle board has neighbours across the seam.
    expect(boardNeighbors(hexIndex({ q: 6, r: 0 }))).toHaveLength(6);
  });

  it('draws a march as adjacent steps, end to end, the same every time', () => {
    // Within one board: across the world a straight line can leave it at
    // the notches between the outer boards.
    const middle = BOARD_HEXES.filter((h) => miniBoardOf(h) === 0);
    for (const a of middle) {
      for (const b of middle) {
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
    expect(bits).toEqual(new Array(Math.ceil(BOARD_SIZE / 32)).fill(0));
    for (const i of [0, 31, 32, 63, 64, BOARD_SIZE - 1]) setBit(bits, i);
    expect(bitIndices(bits)).toEqual([0, 31, 32, 63, 64, BOARD_SIZE - 1]);
    expect(bits.every((w) => w >= 0)).toBe(true);
    clearBit(bits, 31);
    expect(hasBit(bits, 31)).toBe(false);
    expect(countBits(bits)).toBe(5);
    expect(bitsFrom([3, 4])).toEqual(readBits(bitsFrom([3, 4])));
  });

  it('reads a damaged save as empty rather than trusting it', () => {
    const words = Math.ceil(BOARD_SIZE / 32);
    expect(readBits('nope')).toEqual(new Array(words).fill(0));
    expect(readBits([-1, 1.5, 2 ** 33])).toEqual(new Array(words).fill(0));
    const last = new Array(words).fill(0);
    last[words - 1] = 0xffff_ffff;
    expect(bitIndices(readBits(last))).toHaveLength(BOARD_SIZE - (words - 1) * 32);
  });
});
