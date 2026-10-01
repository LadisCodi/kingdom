// How a world hex reaches the screen: a FLAT, top-down board of pointy-top
// hexagons (Docs/art/art-direction.md §2, §7). Nothing here is isometric —
// the board is a map you read and count, not a diorama.
//
// The plane is in CSS pixels at zoom 1, where a hex is HEX_W wide: the
// tactical register (Docs/features/19-world-map.md §1.2).

import { BOARD_RADIUS, HEX_DIRS, type Hex } from '../../sim/world/hex';

/** A hex's width at zoom 1 — the tactical register, ~3 across a phone. */
export const HEX_W = 130;
/** A hex's width in the strategic register, ~8–9 across a phone. */
export const STRATEGIC_W = 45;
/** The circumradius: a pointy-top hex is √3·R wide and 2R tall. */
export const HEX_R = HEX_W / Math.sqrt(3);

/** A hex's centre on the plane. */
export const hexToPlane = (h: Hex): { x: number; y: number } => ({
  x: HEX_W * (h.q + h.r / 2),
  y: HEX_R * 1.5 * h.r,
});

/** The hex a point of the plane falls in. */
export function planeToHex(x: number, y: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX_R;
  const r = ((2 / 3) * y) / HEX_R;
  return axialRound(q, r);
}

function axialRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

/** The six corners of a hex of circumradius `r` round (cx, cy), clockwise
 *  from the upper-right one. Corner k is at (60k − 30)°, screen y down. */
export function hexCorners(cx: number, cy: number, r: number): Array<{ x: number; y: number }> {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** The neighbour across edge k (corner k to corner k + 1), as a HEX_DIRS
 *  index: the right edge is east, and on round clockwise. */
export const edgeDir = (k: number): number => (6 - k) % 6;

/** The neighbour across edge k. */
export const acrossEdge = (h: Hex, k: number): Hex => {
  const d = HEX_DIRS[edgeDir(k)];
  return { q: h.q + d.q, r: h.r + d.r };
};

/**
 * The edges of a region a border is drawn along: every edge of a hex in the
 * region whose neighbour across it is not, as [hex, edge] pairs. A border is a
 * colour on the hex EDGE, never a tint over the ground (art-direction §7).
 */
export function regionEdges(region: readonly Hex[]): Array<{ hex: Hex; edge: number }> {
  const inside = new Set(region.map((h) => `${h.q},${h.r}`));
  const out: Array<{ hex: Hex; edge: number }> = [];
  for (const hex of region) {
    for (let edge = 0; edge < 6; edge++) {
      const n = acrossEdge(hex, edge);
      if (!inside.has(`${n.q},${n.r}`)) out.push({ hex, edge });
    }
  }
  return out;
}

/** Half the board's extent on the plane, for clamping a pan. */
export const BOARD_HALF_W = HEX_W * (BOARD_RADIUS + 0.5);
export const BOARD_HALF_H = HEX_R * (1.5 * BOARD_RADIUS + 1);
