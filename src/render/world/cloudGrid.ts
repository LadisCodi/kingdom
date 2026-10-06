// The cloud bank on the world's hexes (Docs/art/art-direction.md §8.1): the
// province's bank (fog/fogLayer.ts) over the board's Unknown hexes and
// everything past its edge, a thin veil over its Sensed ones, and the
// shadows of passing clouds over the rest. It is a WebGL canvas between the board's ground
// (plates and sides) and what stands on it (boardRenderer.ts), so the clouds
// can lap over the near edge of a tile and nothing upright is hidden.

import { WORLD_RADIUS, type Hex } from '../../sim/world/hex';
import { CLOUD_PX, type BankGrid } from '../fog/fogLayer';
import { HEX_R, HEX_W, TILT } from './hexLayout';

/** The mask spans the world and a rim of one hex, which is always cloud:
 *  past it the texture's edge repeats the rim. */
export const MASK_SPAN = 2 * WORLD_RADIUS + 3;
export const MASK_ORIGIN = -(WORLD_RADIUS + 1);

/** The mask's byte for a hex. */
export const maskIndex = (h: Hex): number => (h.r - MASK_ORIGIN) * MASK_SPAN + (h.q - MASK_ORIGIN);

/** A hex's density in the mask, 0 to 1: the bank, the veil over a Sensed
 *  hex, clear ground. A reveal eases a hex from one to the next, so the bank
 *  thins to a veil and the veil lifts (boardRenderer.ts). */
export const DENSITY = { Unknown: 1, Sensed: 0.4, Revealed: 0 } as const;

/** How far the bank laps over a seen hex from an Unknown one, in hex
 *  widths: the tallest puffs reach this far onto the plate. Further over the
 *  edges nearer the viewer — the tile's side is under the clouds there. */
const RISE_NEAR = 0.2;
const RISE_FAR = 0.1;
/** The veil over a Sensed hex: how opaque at its thickest, its pale tone,
 *  and how far it spills onto clear ground beside it, in hex widths. */
const VEIL_ALPHA = 0.6;
const VEIL_TONE = [0xdf / 255, 0xd8 / 255, 0xeb / 255];
const VEIL_FEATHER = 0.07;
/** Cloud shadows drifting over seen ground: how dark at their darkest, how
 *  much bigger than a puff, and their tone. */
const SHADOW_ALPHA = 0.16;
const SHADOW_SCALE = 2.6;
const SHADOW_TONE = [0.16, 0.2, 0.34];

const vec3 = (c: readonly number[]): string => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;

/** Pointy-top hexes, cell (q, r) axial, on the plane squashed by TILT.
 *  A distance is in hex widths: centre to centre is one. Larger r is nearer
 *  the viewer, so the two neighbours at r + 1 are in front of a hex and the
 *  two at r − 1 behind it.
 *
 *  The board stands IN the clouds, not on them: an Unknown hex is the bank
 *  at full thickness right up to every seen hex, and laps over its edges.
 *  A Sensed hex is under a thin veil, see-through, that spills a little onto
 *  clear ground. Over seen ground, the shadows of clouds out of sight drift. */
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

/** How much of the bank a density carries, and how much veil. */
float bankOf(float v) { return clamp((v - ${DENSITY.Sensed.toFixed(2)}) / ${(1 - DENSITY.Sensed).toFixed(2)}, 0.0, 1.0); }
float veilOf(float v) { return clamp(v / ${DENSITY.Sensed.toFixed(2)}, 0.0, 1.0); }

vec4 shade(vec2 proj) {
  vec2 f = vec2(proj.x, proj.y / ${TILT.toFixed(4)});
  vec2 h = hexRound(vec2(0.57735027 * f.x - f.y / 3.0, f.y * 2.0 / 3.0) / ${HEX_R.toFixed(4)});
  vec2 c = hexCentre(h);
  float v = fogAt(h);
  // How tall a puff has to stand to show: the hex's own bank — thinning,
  // tallest puffs last, as a reveal lifts it — and its neighbours' lapping
  // over its edges. And the veil: its own, and its neighbours' spilling.
  float th = (1.0 - bankOf(v)) * 1.1;
  float veil = veilOf(v);
  for (int k = 0; k < 6; k++) {
    vec2 dir = k == 0 ? vec2(0.0, 1.0) : k == 1 ? vec2(-1.0, 1.0) : k == 2 ? vec2(1.0, 0.0)
      : k == 3 ? vec2(-1.0, 0.0) : k == 4 ? vec2(0.0, -1.0) : vec2(1.0, -1.0);
    float rise = k < 2 ? ${RISE_NEAR.toFixed(2)} : k < 4 ? ${((RISE_NEAR + RISE_FAR) / 2).toFixed(2)} : ${RISE_FAR.toFixed(2)};
    float n = fogAt(h + dir);
    float e = edgeDist(f, c, h, dir);
    th = min(th, e / rise + (1.0 - bankOf(n)) * 1.1);
    veil = max(veil, veilOf(n) * (1.0 - smoothstep(0.0, ${VEIL_FEATHER.toFixed(2)}, e)));
  }

  vec3 col = cloudAt(proj);
  vec4 bank = th < 1.05 ? bankCut(col, th) : vec4(0.0);
  float va = veil * ${VEIL_ALPHA.toFixed(2)} * mix(0.55, 1.0, cloudHeight(col));
  vec4 under = vec4(mix(${vec3(VEIL_TONE)}, col, 0.5) * va, va);

  // The shadows of clouds passing over: the texture far bigger, drifting
  // the other way, on ground the bank does not cover.
  float d = drift();
  vec3 high = texture2D(uCloud, proj / ${(SHADOW_SCALE * CLOUD_PX).toFixed(1)} + vec2(-d, d * 0.5)).rgb;
  float sa = smoothstep(0.62, 0.8, dot(high, vec3(0.299, 0.587, 0.114))) * ${SHADOW_ALPHA.toFixed(2)} * (1.0 - bankOf(v));
  under = under + vec4(${vec3(SHADOW_TONE)} * sa, sa) * (1.0 - under.a);

  return bank + under * (1.0 - bank.a);
}
`,
};
