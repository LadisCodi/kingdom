// What is scattered over a world hex so the board reads as land rather than
// tiles (Docs/plans/world-hex-art.md §3.1): small decorations — grass,
// flowers, bushes, rocks, lone trees — chosen by the hex's feature, and
// where its feature's own drawing sits. Pure: names and offsets only, from a
// hash of the hex's index, so the same hex always looks the same.

import type { WorldFeature } from '../../sim/world/types';

/** The kinds of decoration, each with its sprites (`wdeco_*.png`). */
export const DECO_SPRITES = {
  tuft: ['wdeco_tuft', 'wdeco_tuft_2', 'wdeco_tuft_3'],
  flowers: ['wdeco_clover', 'wdeco_flowers'],
  bush: ['wdeco_bush', 'wdeco_bush_berries', 'wdeco_bushes', 'wdeco_fern'],
  rock: ['wdeco_rock', 'wdeco_pebbles', 'wdeco_boulder', 'wdeco_stone'],
  tree: ['wdeco_tree', 'wdeco_conifer', 'wdeco_tree_small'],
} as const;
export type DecoKind = keyof typeof DECO_SPRITES;

/** How wide each kind is drawn, as a share of a hex's width. */
const DECO_SIZE: Record<DecoKind, number> = { tuft: 0.13, flowers: 0.12, bush: 0.16, rock: 0.13, tree: 0.25 };

/** What a hex scatters, by what it holds: how many, of which kinds (with
 *  weights), and how near the middle they may stand — a feature keeps its
 *  middle for its own drawing, bare ground has none to keep. */
interface Mix { count: number; kinds: ReadonlyArray<readonly [DecoKind, number]>; inner: number }
const MIX: Record<WorldFeature | 'None', Mix> = {
  None: { count: 11, kinds: [['tuft', 5], ['flowers', 3], ['bush', 3], ['rock', 2], ['tree', 2]], inner: 0 },
  Forest: { count: 8, kinds: [['tree', 5], ['bush', 3], ['tuft', 1]], inner: 0.55 },
  Mountain: { count: 7, kinds: [['rock', 4], ['tuft', 2], ['bush', 2]], inner: 0.55 },
  FertileLand: { count: 6, kinds: [['tuft', 3], ['flowers', 2], ['bush', 2]], inner: 0.6 },
  Game: { count: 7, kinds: [['bush', 3], ['tuft', 2], ['flowers', 2], ['tree', 1]], inner: 0.5 },
  Landmark: { count: 6, kinds: [['rock', 2], ['flowers', 2], ['tuft', 2]], inner: 0.6 },
  Sanctuary: { count: 6, kinds: [['flowers', 3], ['rock', 1], ['tuft', 2]], inner: 0.6 },
  Dungeon: { count: 6, kinds: [['rock', 3], ['tuft', 2], ['bush', 1]], inner: 0.6 },
};

/** The farthest a decoration stands from the middle, as a share of the
 *  hex's radius: a little past the edge, so neighbours blend. */
const OUTER = 1.02;

/** One decoration: its sprite, where it stands from the hex's centre on the
 *  untilted ground (shares of the hex's radius), and how wide it is drawn
 *  (a share of the hex's width). */
export interface Deco { sprite: string; dx: number; dy: number; size: number }

/** A number in [0, 1) for this hex and these parts: the same every time. */
export function hash01(index: number, ...parts: number[]): number {
  let h = Math.imul(index + 0x9e37, 0x85ebca6b) >>> 0;
  for (const p of parts) {
    h = Math.imul((h ^ (p + 0x7f4a)) >>> 0, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick(mix: Mix, x: number): DecoKind {
  const total = mix.kinds.reduce((s, [, w]) => s + w, 0);
  let left = x * total;
  for (const [kind, w] of mix.kinds) {
    left -= w;
    if (left < 0) return kind;
  }
  return mix.kinds[mix.kinds.length - 1][0];
}

/** The decorations of a hex holding `feature` (null for none), back to
 *  front. */
export function hexDecorations(index: number, feature: WorldFeature | null): Deco[] {
  const mix = MIX[feature ?? 'None'];
  const out: Deco[] = [];
  for (let k = 0; k < mix.count; k++) {
    const kind = pick(mix, hash01(index, k, 1));
    const sprites = DECO_SPRITES[kind];
    const angle = hash01(index, k, 2) * Math.PI * 2;
    // Spread evenly over the ring's area, not bunched at its middle.
    const r = Math.sqrt(mix.inner ** 2 + hash01(index, k, 3) * (OUTER ** 2 - mix.inner ** 2));
    out.push({
      sprite: sprites[Math.floor(hash01(index, k, 4) * sprites.length)],
      dx: Math.cos(angle) * r,
      dy: Math.sin(angle) * r,
      size: DECO_SIZE[kind] * (0.85 + 0.3 * hash01(index, k, 5)),
    });
  }
  return out.sort((a, b) => a.dy - b.dy);
}

/** Where a feature's own drawing sits on its hex: nudged off the middle and
 *  a little larger or smaller, so the rows of the board do not line up. In
 *  shares of the hex's width, and a scale. */
export function featureNudge(index: number): { dx: number; dy: number; scale: number } {
  return {
    dx: (hash01(index, 90) - 0.5) * 0.12,
    dy: (hash01(index, 91) - 0.5) * 0.08,
    scale: 1.08 + hash01(index, 92) * 0.1,
  };
}
