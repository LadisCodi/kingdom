// The cloud bank on the world's hexes (Docs/art/art-direction.md §8.1): the
// province's bank (fog/fogLayer.ts), cut to the board's Unknown hexes and to
// everything past its edge. It is a WebGL canvas between the board's ground
// (plates and sides) and what stands on it (boardRenderer.ts), so the clouds
// can lap over the near edge of a tile and nothing upright is hidden.

import { BOARD_RADIUS, type Hex } from '../../sim/world/hex';
import type { BankGrid } from '../fog/fogLayer';
import { HEX_R, HEX_W, TILT } from './hexLayout';

/** The mask spans the board and a rim of one hex, which is always cloud:
 *  past it the texture's edge repeats the rim. */
export const MASK_SPAN = 2 * BOARD_RADIUS + 3;
export const MASK_ORIGIN = -(BOARD_RADIUS + 1);

/** The mask's byte for a hex. */
export const maskIndex = (h: Hex): number => (h.r - MASK_ORIGIN) * MASK_SPAN + (h.q - MASK_ORIGIN);

/** How far the bank laps over a seen hex from an Unknown one, in hex
 *  widths: the tallest puffs reach this far onto the plate. Further over the
 *  edges nearer the viewer — the tile's side is under the clouds there. */
const RISE_NEAR = 0.2;
const RISE_FAR = 0.1;

/** Pointy-top hexes, cell (q, r) axial, on the plane squashed by TILT.
 *  A distance is in hex widths: centre to centre is one. Larger r is nearer
 *  the viewer, so the two neighbours at r + 1 are in front of a hex and the
 *  two at r − 1 behind it.
 *
 *  The board stands IN the clouds, not on them: an Unknown hex is the bank
 *  at full thickness right up to every seen hex, and laps over its edges. */
export const HEX_GRID: BankGrid = {
  glsl: `
vec2 hexCentre(vec2 h) {
  return vec2(${HEX_W.toFixed(4)} * (h.x + h.y * 0.5), ${(HEX_R * 1.5).toFixed(4)} * h.y);
}

vec2 hexRound(vec2 qr) {
  vec3 cube = vec3(qr, -qr.x - qr.y);
  vec3 r = floor(cube + 0.5);
  vec3 e = abs(r - cube);
  if (e.x > e.y && e.x > e.z) r.x = -r.y - r.z;
  else if (e.y > e.z) r.y = -r.x - r.z;
  return r.xy;
}

/** How far f is, in hex widths, inside hex h (centre c) from its edge
 *  toward the neighbour at h + dir. */
float edgeDist(vec2 f, vec2 c, vec2 h, vec2 dir) {
  vec2 toward = (hexCentre(h + dir) - c) / ${HEX_W.toFixed(4)};
  return max(0.5 - dot(f - c, toward) / ${HEX_W.toFixed(4)}, 0.0);
}

float threshold(vec2 proj) {
  vec2 f = vec2(proj.x, proj.y / ${TILT.toFixed(4)});
  vec2 h = hexRound(vec2(0.57735027 * f.x - f.y / 3.0, f.y * 2.0 / 3.0) / ${HEX_R.toFixed(4)});
  if (fogAt(h) > 0.5) return 0.0;
  // Seen ground: the bank around it laps over its edges.
  vec2 c = hexCentre(h);
  float th = 2.0;
  for (int k = 0; k < 6; k++) {
    vec2 dir = k == 0 ? vec2(0.0, 1.0) : k == 1 ? vec2(-1.0, 1.0) : k == 2 ? vec2(1.0, 0.0)
      : k == 3 ? vec2(-1.0, 0.0) : k == 4 ? vec2(0.0, -1.0) : vec2(1.0, -1.0);
    float rise = k < 2 ? ${RISE_NEAR.toFixed(2)} : k < 4 ? ${((RISE_NEAR + RISE_FAR) / 2).toFixed(2)} : ${RISE_FAR.toFixed(2)};
    if (fogAt(h + dir) > 0.5) th = min(th, edgeDist(f, c, h, dir) / rise);
  }
  return th;
}
`,
};
