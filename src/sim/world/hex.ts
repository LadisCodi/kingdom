// The world board's lattice: pointy-top hexagons in axial coordinates
// (Docs/features/19-world-map.md §1.1).
//
// Nothing here is shared with the province. `grid.ts` is square-grid maths
// with three metrics; a hex has one — the number of steps between two hexes —
// and that is the only distance the board ever counts.
//
// Axial `(q, r)`: `q` grows to the east, `r` to the south-east, and the third
// cube coordinate is `-q - r`. The board is every hex within BOARD_RADIUS of
// the centre, which is the Dark Portal.

export interface Hex { q: number; r: number }

/**
 * The six neighbours' offsets, in a FIXED order: east, then on round the
 * compass a sixth of a turn at a time (north-east, north-west, west,
 * south-west, south-east). Everything that walks a hex's neighbours walks
 * them in this order, so a fix-up or a fold never depends on how a set was
 * iterated. `rotate60` turns direction i into direction i + 1.
 */
export const HEX_DIRS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** Rings from the centre to the rim: 91 hexes. */
export const BOARD_RADIUS = 5;

export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const hexScale = (a: Hex, k: number): Hex => ({ q: a.q * k + 0, r: a.r * k + 0 });
export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

/** Steps between two hexes. */
export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/** Which ring of the board a hex is on: 0 is the Portal. */
export const ringOf = (h: Hex): number => hexDistance(h, { q: 0, r: 0 });

/** A sixth of a turn about the centre: HEX_DIRS[i] becomes HEX_DIRS[i + 1]. */
export const rotate60 = (h: Hex): Hex => ({ q: h.q + h.r, r: 0 - h.q });

/** `turns` sixths of a turn. */
export function rotateBy(h: Hex, turns: number): Hex {
  let out = h;
  for (let i = 0; i < ((turns % 6) + 6) % 6; i++) out = rotate60(out);
  return out;
}

/** The six neighbours, in HEX_DIRS order. */
export const hexNeighbors = (h: Hex): Hex[] => HEX_DIRS.map((d) => hexAdd(h, d));

/** The hexes exactly `radius` steps from `center`, walked from the eastmost
 *  corner round the way HEX_DIRS turns. Radius 0 is the centre alone. */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let h = hexAdd(center, hexScale(HEX_DIRS[0], radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(h);
      h = hexAdd(h, HEX_DIRS[(side + 2) % 6]);
    }
  }
  return out;
}

/** Every hex within `radius` steps of `center`, ring by ring outward. */
export function hexesWithin(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let k = 0; k <= radius; k++) out.push(...hexRing(center, k));
  return out;
}

/**
 * The hexes a straight march from `a` to `b` passes through, both ends
 * included: `hexDistance(a, b) + 1` of them, each a neighbour of the last.
 *
 * Linear interpolation in cube space, rounded. The endpoints are nudged by a
 * fixed epsilon so a line running exactly along an edge always breaks the
 * same way — the same hexes for the same two ends, on every engine.
 */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const ax = a.q + 1e-6, az = a.r + 2e-6, ay = -a.q - a.r - 3e-6;
  const bx = b.q + 1e-6, bz = b.r + 2e-6, by = -b.q - b.r - 3e-6;
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(cubeRound(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t));
  }
  return out;
}

function cubeRound(x: number, y: number, z: number): Hex {
  let rx = Math.round(x);
  const ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  // `+ 0` turns a -0 into 0, so a rounded hex compares equal to its literal.
  return { q: rx + 0, r: rz + 0 };
}

// ------------------------------------------------------------- the board

/** Every hex of the board in its canonical order — by row (`r`), then by `q`
 *  — which is what a hex's INDEX means everywhere: the fog bitset, a march's
 *  path, the save. The Portal at the centre is index 45. */
export const BOARD_HEXES: readonly Hex[] = (() => {
  const out: Hex[] = [];
  for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
      if (ringOf({ q, r }) <= BOARD_RADIUS) out.push({ q, r });
    }
  }
  return out;
})();

export const BOARD_SIZE = BOARD_HEXES.length;

const INDEX = new Map<string, number>(BOARD_HEXES.map((h, i) => [`${h.q},${h.r}`, i]));

/** A hex's index on the board, or -1 when it is off it. */
export const hexIndex = (h: Hex): number => INDEX.get(`${h.q},${h.r}`) ?? -1;

export const hexAt = (index: number): Hex => BOARD_HEXES[index];

export const onBoard = (h: Hex): boolean => ringOf(h) <= BOARD_RADIUS;

export const isBoardIndex = (index: unknown): index is number =>
  Number.isInteger(index) && (index as number) >= 0 && (index as number) < BOARD_SIZE;

/** The Portal's index. */
export const PORTAL_INDEX = hexIndex({ q: 0, r: 0 });

/** The neighbours of a hex that are on the board, as indices, in HEX_DIRS
 *  order. */
export const boardNeighbors = (index: number): number[] =>
  hexNeighbors(hexAt(index)).map(hexIndex).filter((i) => i >= 0);

/** The board hexes within `radius` steps of a hex, as indices. */
export const boardWithin = (index: number, radius: number): number[] =>
  hexesWithin(hexAt(index), radius).map(hexIndex).filter((i) => i >= 0);
