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
  gridLine: 'rgba(0, 0, 0, 0.18)',
  fogUndiscovered: '#0c1017',
  fogDiscovered: 'rgba(10, 13, 18, 0.55)',
  selected: '#ffe27a',
  validTarget: 'rgba(126, 217, 87, 0.85)',
  workedTile: 'rgba(255, 226, 122, 0.75)',
  influenceSquare: 'rgba(255, 255, 255, 0.85)',
  yieldPositive: '#7fd07f',
  yieldNegative: '#ff8a7a',
  labelPill: 'rgba(0, 0, 0, 0.5)',
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
