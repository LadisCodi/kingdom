// Placeholder art: one flat-color table. Real pixel art slots in later.

import type { TerrainId } from '../sim/state';

export const TERRAIN_COLORS: Record<TerrainId, string> = {
  Grassland: '#4a7c3f',
  Plains: '#8f9a4b',
  Desert: '#c9b26a',
  Snow: '#dfe7ec',
  Tundra: '#8b9a94',
  Water: '#2e5d8a',
};

export const PALETTE = {
  // Cast targets read blue, so they can never be confused with a build spot.
  castTarget: '#8fb4ff',
  // Site badges: the tag on an unclaimed landmark or an undelved ruin.
  siteBadge: '#f4e2b8',
  siteBadgeEdge: '#5a3d24',
  siteBadgeInk: '#3a2716',
  gridLine: 'rgba(0, 0, 0, 0.18)',
  fogUndiscovered: '#0c1017',
  fogDiscovered: 'rgba(10, 13, 18, 0.55)',
  selected: '#ffe27a',
  validTarget: 'rgba(126, 217, 87, 0.85)',
  workedTile: 'rgba(255, 226, 122, 0.75)',
  influenceFill: 'rgba(255, 255, 255, 0.16)',
  influenceBorder: 'rgba(255, 255, 255, 0.85)',
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
  exhaustedOverlay: 'rgba(40, 30, 20, 0.45)',
  recoveryFill: '#8ab4d8',
  progressBg: 'rgba(0, 0, 0, 0.55)',
  progressFill: '#d9a536',
  vaultFill: '#7fd07f',
  vaultFull: '#ff9d5a',
  constructionHatch: 'rgba(0, 0, 0, 0.35)',
  floaterText: '#ffe9a8',
  label: '#ffffff',
};

export const TILE_SIZE = 72; // world pixels per cell at zoom 1
