// How a world hex reaches the screen: a board of pointy-top hexagons seen
// from a little south of overhead — the plane squashed by TILT, so the board
// reads as ground with depth, as the province does. What stands on a hex is
// drawn upright; only the ground is tilted.
//
// The plane is in CSS pixels at zoom 1, where a hex is HEX_W wide: the
// tactical register (Docs/features/19-world-map.md §1.2).

import { HEX_DIRS, WORLD_RADIUS, type Hex } from '../../sim/world/hex';

/** A hex's width at zoom 1 — the tactical register, ~3 across a phone. */
export const HEX_W = 130;
/** A hex's width in the strategic register, ~8–9 across a phone. */
export const STRATEGIC_W = 45;
/** The circumradius: a pointy-top hex is √3·R wide and 2R tall — before
 *  the tilt. */
export const HEX_R = HEX_W / Math.sqrt(3);
/** How much the ground is squashed top to bottom: 1 is straight down. */
export const TILT = 0.72;

/** A hex's centre on the plane. */
export const hexToPlane = (h: Hex): { x: number; y: number } => ({
  x: HEX_W * (h.q + h.r / 2),
  y: HEX_R * 1.5 * h.r * TILT,
});

/** The hex a point of the plane falls in. */
export function planeToHex(x: number, y: number): Hex {
  const flat = y / TILT;
  const q = ((Math.sqrt(3) / 3) * x - flat / 3) / HEX_R;
  const r = ((2 / 3) * flat) / HEX_R;
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

/** The six corners of a hex of circumradius `r` round (cx, cy), tilted,
 *  clockwise from the upper-right one. Corner k is at (60k − 30)°, screen y
 *  down. */
export function hexCorners(cx: number, cy: number, r: number): Array<{ x: number; y: number }> {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) * TILT };
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

/** Half the world's extent on the plane, for clamping a pan. */
export const BOARD_HALF_W = HEX_W * (WORLD_RADIUS + 0.5);
export const BOARD_HALF_H = HEX_R * (1.5 * WORLD_RADIUS + 1) * TILT;

/** The labels the board prints, by how far out each still shows (19 §1.2):
 *  the narrower a hex on screen, the fewer, the least important going first.
 *  The player's own name, the Portals, a raid on the player — its arc, its
 *  time and the camp's power — and the armies always show. */
export type WorldLabel = 'camp' | 'rival' | 'dungeon' | 'deposit' | 'promise';
export const LABEL_MIN_HEX_W: Record<WorldLabel, number> = {
  camp: 60, rival: 60, dungeon: 80, deposit: 80, promise: 80,
};
export function labelShown(label: WorldLabel, hexWidth: number): boolean {
  return hexWidth >= LABEL_MIN_HEX_W[label];
}
