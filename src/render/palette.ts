// Flat-colour fallbacks under the art, and the one measurement the whole
// world is drawn from.

import type { TerrainId } from '../sim/state';

// ------------------------------------------------------------- the tile
//
// THE PROJECTION IS A 2:1 ISOMETRIC one. A cell's ground diamond is
// `TILE_W` across and `TILE_H` tall — half as tall as it is wide is
// not a style, it IS the projection: the horizontal axes run at 26.57° and
// every square on the ground draws as a diamond twice as wide as it is high.
// Change the pair and every piece of art in Docs/art/ is the wrong size
// (Docs/art/art-direction.md §3).
//
// The grid underneath is still SQUARE. Isometric is a projection, not a
// grid: `src/sim/grid.ts` and its three distance metrics never hear about
// this file.
export const TILE_W = 128;
export const TILE_H = 64;

// The MAP EDITOR paints data by coordinate, not a world, so it keeps a flat
// square grid (`Camera`'s 'flat' projection). A diamond is the right way to
// look at a kingdom and the wrong way to fill in a spreadsheet of terrain.
export const FLAT_TILE = 72;

export const TERRAIN_COLORS: Record<TerrainId, string> = {
  Grassland: '#4a7c3f',
  Plains: '#8f9a4b',
  Desert: '#c9b26a',
  Snow: '#dfe7ec',
  Tundra: '#8b9a94',
  Water: '#2e5d8a',
};

export const PALETTE = {
  // The placement ghost's move arrows: leaf green, lit from above, rimmed.
  moveArrow: '#4f9f33',
  moveArrowLight: '#8fd466',
  moveArrowRim: '#2f6b1f',
  // Cast targets read blue, so they can never be confused with a build spot.
  castTarget: '#8fb4ff',
  // Site badges: the tag on an unclaimed landmark or an undelved ruin.
  siteBadge: '#f4e2b8',
  siteBadgeEdge: '#5a3d24',
  siteBadgeInk: '#3a2716',
  // The same badge while a garrison is counting down on a ruin: the minutes
  // left, in the colour of the thing that is about to happen.
  siteBadgeRaid: '#d8613f',
  siteBadgeRaidInk: '#2a120c',
  gridLine: 'rgba(0, 0, 0, 0.18)',
  fogUndiscovered: '#0c1017',
  fogDiscovered: 'rgba(10, 13, 18, 0.55)',
  selected: '#ffe27a',
  validTarget: 'rgba(126, 217, 87, 0.85)',
  workedTile: 'rgba(255, 226, 122, 0.75)',
  influenceFill: 'rgba(255, 255, 255, 0.16)',
  influenceBorder: 'rgba(255, 255, 255, 0.85)',
  /* A SPELL STANDING ON THE GROUND. Violet is the magic colour and nothing
     else on the map uses it — the ground is warm greens and browns, so a
     player never has to ask whether the glow is terrain. */
  spellFill: 'rgba(124, 84, 214, 0.15)',
  spellBorder: 'rgba(198, 164, 255, 0.95)',
  spellGlow: 'rgba(214, 190, 255, 0.85)',
  spellDial: 'rgba(28, 16, 48, 0.55)',
  // The Townhall's reach, dashed along the last ring the player may pay for.
  // Warm and half-transparent: a border the fog is drawn under, not a wall.
  reachBorder: 'rgba(255, 226, 122, 0.6)',
  // Brighter than the old #7fd07f / #ff8a7a: these sit on the label pill,
  // which is drawn over the influence wash, and pale ink on a washed pill is
  // what made the placement labels unreadable.
  yieldPositive: '#9dff9d',
  yieldNegative: '#ff9a86',
  /** Near-opaque on purpose. A translucent pill borrows whatever it is over,
   *  and these are drawn on top of the influence highlight — the brightest
   *  thing on the map. The thin light edge keeps it from melting into a dark
   *  background too. */
  labelPill: 'rgba(18, 16, 14, 0.88)',
  labelPillEdge: 'rgba(255, 255, 255, 0.35)',
  recoveryFill: '#8ab4d8',
  progressBg: 'rgba(0, 0, 0, 0.55)',
  progressFill: '#d9a536',
  vaultFill: '#7fd07f',
  vaultFull: '#ff9d5a',
  constructionHatch: 'rgba(0, 0, 0, 0.35)',
  floaterText: '#ffe9a8',
  label: '#ffffff',
};

