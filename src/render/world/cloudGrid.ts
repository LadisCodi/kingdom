// The cloud bank on the world's hexes (Docs/art/art-direction.md §8.1): the
// province's bank (fog/fogLayer.ts), cut to the board's Unknown hexes and to
// everything past its edge. It is a WebGL canvas under the board's, so every
// hex the player can see — its plate, its side, what stands on it — is drawn
// over the clouds.

import { BOARD_RADIUS, type Hex } from '../../sim/world/hex';
import type { BankGrid } from '../fog/fogLayer';
import { HEX_R, HEX_W, TILT } from './hexLayout';

/** The mask spans the board and a rim of one hex, which is always cloud:
 *  past it the texture's edge repeats the rim. */
export const MASK_SPAN = 2 * BOARD_RADIUS + 3;
export const MASK_ORIGIN = -(BOARD_RADIUS + 1);

/** The mask's byte for a hex. */
export const maskIndex = (h: Hex): number => (h.r - MASK_ORIGIN) * MASK_SPAN + (h.q - MASK_ORIGIN);

/** Pointy-top hexes, cell (q, r) axial, on the plane squashed by TILT.
 *  A distance is in hex widths: centre to centre is one. */
export const HEX_GRID: BankGrid = {
  edge: 0.35,
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

float clearance(vec2 proj) {
  vec2 f = vec2(proj.x, proj.y / ${TILT.toFixed(4)});
  vec2 h = hexRound(vec2(0.57735027 * f.x - f.y / 3.0, f.y * 2.0 / 3.0) / ${HEX_R.toFixed(4)});
  if (fogAt(h) < 0.5) return -1.0;
  vec2 c = hexCentre(h);
  float d = 2.0;
  for (int k = 0; k < 6; k++) {
    vec2 dir = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(1.0, -1.0) : k == 2 ? vec2(0.0, -1.0)
      : k == 3 ? vec2(-1.0, 0.0) : k == 4 ? vec2(-1.0, 1.0) : vec2(0.0, 1.0);
    if (fogAt(h + dir) < 0.5) {
      // How far the point is from the edge shared with that neighbour.
      vec2 toward = (hexCentre(h + dir) - c) / ${HEX_W.toFixed(4)};
      d = min(d, max(0.5 - dot(f - c, toward) / ${HEX_W.toFixed(4)}, 0.0));
    }
  }
  return d;
}
`,
};
