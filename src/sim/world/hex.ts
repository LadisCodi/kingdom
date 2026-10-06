// The world board's lattice: pointy-top hexagons in axial coordinates
// (Docs/features/19-world-map.md §1.1).
//
// Nothing here is shared with the province. `grid.ts` is square-grid maths
// with three metrics; a hex has one — the number of steps between two hexes —
// and that is the only distance the board ever counts.
//
// Axial `(q, r)`: `q` grows to the east, `r` to the south-east, and the third
// cube coordinate is `-q - r`.
//
// THE WORLD is mini-boards in a honeycomb (Docs/plans/precious-deposits.md
// §3): each every hex within BOARD_RADIUS of its centre, a Dark Portal; the
// middle one at the origin and `WORLD_RINGS` rings of them round it. To the
// player it is one board; rings, wedges and seats are counted on the
// mini-board a hex belongs to.

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

/** Rings from a mini-board's centre to its rim: 127 hexes each. */
export const BOARD_RADIUS = 6;

/** Rings of mini-boards round the middle one: 0 is one board, 1 is seven. */
export const WORLD_RINGS = 1;

export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const hexScale = (a: Hex, k: number): Hex => ({ q: a.q * k + 0, r: a.r * k + 0 });
export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

/** Steps between two hexes. */
export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/** Which ring of its mini-board a hex is on: 0 is its Portal. */
export const ringOf = (h: Hex): number => hexDistance(h, centreOf(h));

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

// ------------------------------------------------------------- the world

/** From one mini-board's centre to the next: hexagons of radius R tile the
 *  plane 2R + 1 apart, this way round. */
const BOARD_STEP: Hex = { q: 2 * BOARD_RADIUS + 1, r: -BOARD_RADIUS };

/** Every mini-board's centre — its Portal: the middle one first, then ring
 *  by ring, each ring from the east round the way HEX_DIRS turns. A
 *  mini-board's number is its place here. */
export const BOARD_CENTRES: readonly Hex[] = (() => {
  const out: Hex[] = [{ q: 0, r: 0 }];
  for (let k = 1; k <= WORLD_RINGS; k++) {
    // Ring k of the honeycomb, walked as hexRing walks hexes, on the board
    // lattice whose unit steps are BOARD_STEP turned.
    const step = (d: number) => rotateBy(BOARD_STEP, d);
    let c = hexScale(step(0), k);
    for (let side = 0; side < 6; side++) {
      for (let i = 0; i < k; i++) {
        out.push(c);
        c = hexAdd(c, step((side + 2) % 6));
      }
    }
  }
  return out;
})();

export const BOARD_COUNT = BOARD_CENTRES.length;

/** Lookups by coordinate, as flat tables rather than string-keyed maps: a
 *  world of seven boards asks them millions of times a long replay. */
const LOOK_OFF = 64;
const LOOK_SPAN = 2 * LOOK_OFF;
const lookAt = (h: Hex): number =>
  (h.q < -LOOK_OFF || h.q >= LOOK_OFF || h.r < -LOOK_OFF || h.r >= LOOK_OFF ? -1 : (h.q + LOOK_OFF) * LOOK_SPAN + h.r + LOOK_OFF);

const BOARD_OF = new Int16Array(LOOK_SPAN * LOOK_SPAN).fill(-1);
BOARD_CENTRES.forEach((c, b) => {
  for (const h of hexesWithin(c, BOARD_RADIUS)) BOARD_OF[lookAt(h)] = b;
});

/** Which mini-board a hex is on, or -1 off the world. */
export const miniBoardOf = (h: Hex): number => {
  const at = lookAt(h);
  return at < 0 ? -1 : BOARD_OF[at];
};

/** The centre of the mini-board a hex is on — or, off the world, of the
 *  nearest one. */
export function centreOf(h: Hex): Hex {
  const b = miniBoardOf(h);
  if (b >= 0) return BOARD_CENTRES[b];
  let best = BOARD_CENTRES[0];
  for (const c of BOARD_CENTRES) if (hexDistance(h, c) < hexDistance(h, best)) best = c;
  return best;
}

/** A hex as its mini-board sees it: from that board's centre. */
export const localHex = (h: Hex): Hex => {
  const c = centreOf(h);
  return { q: h.q - c.q, r: h.r - c.r };
};

/** A mini-board's local hex placed in the world. */
export const worldHex = (board: number, local: Hex): Hex => hexAdd(BOARD_CENTRES[board], local);

/** Every hex of the world in its canonical order — by row (`r`), then by
 *  `q` — which is what a hex's INDEX means everywhere: the fog bitset, a
 *  march's path, the save. On a world of one board, the Portal is 63. */
export const BOARD_HEXES: readonly Hex[] = BOARD_CENTRES
  .flatMap((c) => hexesWithin(c, BOARD_RADIUS))
  .sort((a, b) => a.r - b.r || a.q - b.q);

export const BOARD_SIZE = BOARD_HEXES.length;

/** How far the world reaches from its middle: the farthest hex's steps
 *  from the origin — 6 for one board, 19 for seven. */
export const WORLD_RADIUS = Math.max(...BOARD_HEXES.map((h) => hexDistance(h, { q: 0, r: 0 })));

const INDEX = new Int32Array(LOOK_SPAN * LOOK_SPAN).fill(-1);
BOARD_HEXES.forEach((h, i) => { INDEX[lookAt(h)] = i; });

/** A hex's index in the world, or -1 when it is off it. */
export const hexIndex = (h: Hex): number => {
  const at = lookAt(h);
  return at < 0 ? -1 : INDEX[at];
};

export const hexAt = (index: number): Hex => BOARD_HEXES[index];

export const onBoard = (h: Hex): boolean => hexIndex(h) >= 0;

export const isBoardIndex = (index: unknown): index is number =>
  Number.isInteger(index) && (index as number) >= 0 && (index as number) < BOARD_SIZE;

/** Every Portal's index, by mini-board. */
export const PORTAL_INDICES: readonly number[] = BOARD_CENTRES.map(hexIndex);

/** The middle mini-board's Portal. */
export const PORTAL_INDEX = PORTAL_INDICES[0];

/** The neighbours of a hex that are in the world, as indices, in HEX_DIRS
 *  order — across a seam as anywhere else. */
export const boardNeighbors = (index: number): number[] =>
  hexNeighbors(hexAt(index)).map(hexIndex).filter((i) => i >= 0);

/** The world's hexes within `radius` steps of a hex, as indices. */
export const boardWithin = (index: number, radius: number): number[] =>
  hexesWithin(hexAt(index), radius).map(hexIndex).filter((i) => i >= 0);
