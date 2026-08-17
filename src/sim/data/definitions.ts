// All balancing data. Costs/times/caps transcribed from Docs/04–05; the
// harvest-loop values from Docs/features/harvest-loop.md §7.
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.

import type { CurrencyId, DistrictId, FeatureId, HarvestSourceId, SpellId, UnitId, Wallet } from '../state';

/** 1-based per-level list lookup that clamps to the last entry (the docs' convention). */
export const levelIndexed = <T>(list: readonly T[], level: number): T =>
  list[Math.min(Math.max(level, 1), list.length) - 1];

// ---------------------------------------------------------------- currencies

export interface CurrencyDef {
  scope: 'city' | 'kingdom' | 'player';
  cap: number | null;
  start: number;
}

export const CURRENCIES: Record<CurrencyId, CurrencyDef> = {
  Food: { scope: 'city', cap: null, start: 5 },
  Silver: { scope: 'city', cap: null, start: 50 },
  Wood: { scope: 'city', cap: null, start: 0 },
  Gold: { scope: 'kingdom', cap: null, start: 100 },
  Mana: { scope: 'kingdom', cap: 100, start: 50 },
  Knowledge: { scope: 'kingdom', cap: null, start: 0 },
  Gems: { scope: 'player', cap: null, start: 10 },
};

// -------------------------------------------------------------- harvest loop

export interface HarvestSpec {
  currencyId: CurrencyId;
  yieldPerTap: number;
  tapsToExhaust: number;
  recoverySeconds: number;
}

export const HARVEST: Record<HarvestSourceId, HarvestSpec> = {
  Forest: { currencyId: 'Wood', yieldPerTap: 1, tapsToExhaust: 10, recoverySeconds: 90 },
  Crops: { currencyId: 'Food', yieldPerTap: 1, tapsToExhaust: 10, recoverySeconds: 60 },
};

export const WORKER = {
  moveSpeedTilesPerSecond: 1,
  workSeconds: 8,
  carry: 1, // units per cycle; each delivered unit = 1 tap on the source cell
};

export const TOWNHALL_CYCLE = {
  cycleSeconds: 10,
  tapBoostSeconds: 2, // progress added per tap on the Townhall cell
  silverPerPopulation: 5, // payout per cycle = this × population
};

export const OFFLINE_CAP_HOURS = 8;

// ----------------------------------------------------------------- districts

export interface DistrictDef {
  id: DistrictId;
  name: string;
  description: string;
  buildable: boolean;
  glyph: string; // placeholder art
  populationCapacity: number;
  maxWorkersPerLevel: readonly number[]; // empty = no workers
  maxCountPerTownhallLevel: readonly number[]; // empty = unlimited
  /** Chebyshev radius of the area of influence, by level. Empty = no area. */
  influenceRadiusPerLevel: readonly number[];
  /** What resource cells this building's workers harvest. */
  harvestSource: HarvestSourceId | null;
  /** This district's own cell IS a resource cell of this type (FarmLands → Crops). */
  providesHarvestSource: HarvestSourceId | null;
  maxLevel: number;
  buildCost: Wallet;
  buildCostMultiplier: number;
  buildCostExponentialGrowth: number;
  buildCostDistanceGrowth: number;
  buildDurationSeconds: number;
  buildDurationDistrictGrowth: number;
  buildDurationDistanceGrowth: number;
  upgradeCost: Wallet;
  upgradeCostLevelGrowth: number;
  upgradeDurationSeconds: number;
  upgradeDurationLevelGrowth: number;
  requiredTownhallLevelPerLevel: readonly number[]; // index 0 = requirement to REACH level 2
}

const base: Omit<DistrictDef, 'id' | 'name' | 'description' | 'glyph'> = {
  buildable: true,
  populationCapacity: 0,
  maxWorkersPerLevel: [],
  maxCountPerTownhallLevel: [],
  influenceRadiusPerLevel: [],
  harvestSource: null,
  providesHarvestSource: null,
  maxLevel: 1,
  buildCost: {},
  buildCostMultiplier: 1,
  buildCostExponentialGrowth: 1,
  buildCostDistanceGrowth: 1,
  buildDurationSeconds: 0,
  buildDurationDistrictGrowth: 1.2,
  buildDurationDistanceGrowth: 1.15,
  upgradeCost: {},
  upgradeCostLevelGrowth: 1.5,
  upgradeDurationSeconds: 0,
  upgradeDurationLevelGrowth: 1.5,
  requiredTownhallLevelPerLevel: [],
};

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  Townhall: {
    ...base,
    id: 'Townhall',
    name: 'Townhall',
    description:
      'Heart of the city. Houses 3 and taxes population each cycle — tap it to speed the cycle up.',
    glyph: '🏛️',
    buildable: false,
    populationCapacity: 3,
    maxLevel: 2,
    buildCostMultiplier: 2,
    buildCostExponentialGrowth: 1.2,
    buildCostDistanceGrowth: 1.15,
    upgradeCost: { Silver: 200, Wood: 25 },
    upgradeDurationSeconds: 0, // instant — completes on the next tick
  },
  Housing: {
    ...base,
    id: 'Housing',
    name: 'Housing',
    description: 'Provides homes — raises max population.',
    glyph: '🏠',
    populationCapacity: 2,
    maxCountPerTownhallLevel: [2, 4],
    buildCost: { Silver: 75, Wood: 20 },
    buildCostMultiplier: 0.75,
    buildCostExponentialGrowth: 1.25,
    buildDurationSeconds: 20,
  },
  Farm: {
    ...base,
    id: 'Farm',
    name: 'Farm',
    description: 'Sends workers to harvest Crops within its area of influence.',
    glyph: '🌾',
    maxWorkersPerLevel: [3, 5],
    maxCountPerTownhallLevel: [1, 1, 2],
    influenceRadiusPerLevel: [1, 2],
    harvestSource: 'Crops',
    maxLevel: 2,
    buildCost: { Silver: 50, Wood: 10 },
    buildCostMultiplier: 2,
    buildCostExponentialGrowth: 1.5,
    buildDurationSeconds: 20,
    upgradeCost: { Silver: 300, Wood: 50 },
    upgradeDurationSeconds: 30,
    requiredTownhallLevelPerLevel: [2, 2],
  },
  FarmLands: {
    ...base,
    id: 'FarmLands',
    name: 'FarmLands',
    description: 'A crop plot: tap it for Food, or let Farm workers harvest it.',
    glyph: '🟩',
    maxCountPerTownhallLevel: [6, 6, 12],
    providesHarvestSource: 'Crops',
    buildCost: { Wood: 20 },
    buildCostMultiplier: 2,
    buildCostExponentialGrowth: 1.2,
    buildDurationSeconds: 10,
  },
  Sawmill: {
    ...base,
    id: 'Sawmill',
    name: 'Sawmill',
    description: 'Sends workers to harvest Forest cells within its area of influence.',
    glyph: '🪚',
    maxWorkersPerLevel: [3, 5, 7],
    maxCountPerTownhallLevel: [1, 2],
    influenceRadiusPerLevel: [1, 2, 3],
    harvestSource: 'Forest',
    maxLevel: 3,
    buildCost: { Silver: 50 },
    buildCostMultiplier: 4,
    buildCostExponentialGrowth: 1.45,
    buildDurationSeconds: 20,
    upgradeCost: { Silver: 300 },
    upgradeDurationSeconds: 30,
    requiredTownhallLevelPerLevel: [1, 1, 2],
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] = ['Housing', 'Farm', 'FarmLands', 'Sawmill'];

// ------------------------------------------------------------------ features

export interface FeatureDef {
  id: FeatureId;
  name: string;
  glyph: string;
  exhaustedGlyph: string;
  source: HarvestSourceId;
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  Trees: { id: 'Trees', name: 'Forest', glyph: '🌲', exhaustedGlyph: '🪵', source: 'Forest' },
};

/** Exhausted-crops visual (FarmLands districts have no feature). */
export const CROPS_EXHAUSTED_GLYPH = '🥀';

// -------------------------------------------------------------- fog settings

export const FOG = {
  silverPerTap: 1,
  // authored rings: distance → total Silver cost
  rings: [
    { distance: 2, cost: 3 },
    { distance: 3, cost: 4 },
    { distance: 4, cost: 5 },
  ],
  fallbackGrowth: 1.25,
};

// ----------------------------------------------------------------- city def

export const CITY_DEF = {
  name: 'Oakville',
  initialPopulation: 2,
  initialCurrencies: { Silver: 50, Food: 5 } as Wallet,
  populationCostBase: 5,
  populationCostGrowth: 1.45,
  buildQueueCapacity: 1,
  maxArmyPowerPerTownhallLevel: [10, 20, 30],
  buildMenuOrder: BUILDABLE_DISTRICTS,
};

// --------------------------------------------------------------- kingdom def

export const KINGDOM_DEF = {
  name: 'PlayerKingdom',
  startBuilders: 1,
  maxBuilders: 4,
  manaPerHour: 300, // 5/min trickle into the capped kingdom wallet
};

// ------------------------------------------------------------------- spells

export interface SpellLevelDef {
  manaCost: number;
  durationSeconds: number;
  effectMagnitude: number;
  upgradeCost: number;
}

export interface SpellDef {
  id: SpellId;
  name: string;
  description: string;
  glyph: string;
  unlockedFromStart: boolean;
  stackable: boolean;
  levels: SpellLevelDef[];
}

export const SPELLS: Record<SpellId, SpellDef> = {
  Rain: {
    id: 'Rain',
    name: 'Rain',
    description:
      'For {duration}, the rained cell recovers from exhaustion at ×{value} speed.',
    glyph: '🌧️',
    unlockedFromStart: true,
    stackable: false,
    levels: [{ manaCost: 10, durationSeconds: 30, effectMagnitude: 2, upgradeCost: 0 }],
  },
  // Dormant pending the spell rework: free player taps superseded its effect,
  // so it has no valid targets (kept listed, exactly like the original build).
  Tap: {
    id: 'Tap',
    name: 'Tap',
    description: 'Extract one resource from a wilderness feature. (Being reworked.)',
    glyph: '👆',
    unlockedFromStart: true,
    stackable: true,
    levels: [{ manaCost: 1, durationSeconds: 0, effectMagnitude: 5, upgradeCost: 0 }],
  },
};

// -------------------------------------------------------------------- units

export type UnitTag = 'Melee' | 'Distance' | 'Mounted';

export interface UnitDef {
  id: UnitId;
  name: string;
  description: string;
  glyph: string;
  power: number;
  tags: UnitTag[];
  recruitCost: Wallet; // city currencies
  trainDurationSeconds: number; // authored but unused — training is instant
}

export const UNITS: Record<UnitId, UnitDef> = {
  Archer: {
    id: 'Archer',
    name: 'Archer',
    description: 'Ranged support.',
    glyph: '🏹',
    power: 2,
    tags: ['Distance'],
    recruitCost: { Silver: 40, Wood: 20 },
    trainDurationSeconds: 25,
  },
  Swordsman: {
    id: 'Swordsman',
    name: 'Swordsman',
    description: 'Sturdy front line.',
    glyph: '⚔️',
    power: 3,
    tags: ['Melee'],
    recruitCost: { Silver: 50, Food: 20 },
    trainDurationSeconds: 30,
  },
  Cavalry: {
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Fast and hard-hitting.',
    glyph: '🐎',
    power: 5,
    tags: ['Mounted', 'Melee'],
    recruitCost: { Silver: 100, Food: 40 },
    trainDurationSeconds: 60,
  },
};

export const UNIT_ORDER: UnitId[] = ['Archer', 'Swordsman', 'Cavalry'];

export const GAME_VERSION = '0.1.0';
export const SAVE_VERSION = 2; // v1 saves (generator/vault era) are discarded
