// A set of board hexes as 32-bit words — four for the 127 hexes — the world
// fog's shape in the save (Docs/features/02-map-scopes.md §3: "a small
// bitset over the board").
//
// Plain numbers in an array rather than a typed array, so it serialises as
// itself; every write goes through `>>> 0` so a word never turns negative.

import { BOARD_SIZE } from './hex';

export type HexBits = number[];

const WORDS = Math.ceil(BOARD_SIZE / 32);

export const emptyBits = (): HexBits => new Array<number>(WORDS).fill(0);

export const hasBit = (bits: HexBits, index: number): boolean =>
  ((bits[index >>> 5] ?? 0) >>> (index & 31) & 1) === 1;

export function setBit(bits: HexBits, index: number): void {
  const w = index >>> 5;
  bits[w] = ((bits[w] ?? 0) | (1 << (index & 31))) >>> 0;
}

export function clearBit(bits: HexBits, index: number): void {
  const w = index >>> 5;
  bits[w] = ((bits[w] ?? 0) & ~(1 << (index & 31))) >>> 0;
}

export const copyBits = (bits: HexBits): HexBits => {
  const out = emptyBits();
  for (let w = 0; w < WORDS; w++) out[w] = (bits[w] ?? 0) >>> 0;
  return out;
};

export const bitsFrom = (indices: Iterable<number>): HexBits => {
  const out = emptyBits();
  for (const i of indices) setBit(out, i);
  return out;
};

/** The indices in the set, ascending. */
export function bitIndices(bits: HexBits): number[] {
  const out: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (hasBit(bits, i)) out.push(i);
  return out;
}

export const countBits = (bits: HexBits): number => bitIndices(bits).length;

/** A bitset read from a save: three words, each a uint32, anything else
 *  dropped to empty rather than trusted. */
export function readBits(value: unknown): HexBits {
  const out = emptyBits();
  if (!Array.isArray(value)) return out;
  for (let w = 0; w < WORDS; w++) {
    const v = value[w];
    if (Number.isInteger(v) && v >= 0 && v <= 0xffff_ffff) out[w] = v >>> 0;
  }
  // Bits past the board's last hex mean nothing; clear them so two equal
  // sets always compare equal.
  for (let i = BOARD_SIZE; i < WORDS * 32; i++) clearBit(out, i);
  return out;
}
