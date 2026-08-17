// All balancing data transcribed from Docs/03, 04, 05, 07, 08.
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.

import type { CurrencyId, DistrictId, FeatureId, SpellId, UnitId, Wallet } from '../state';

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

// ----------------------------------------------------------------- districts

export type WorkedSource =
  | { kind: 'feature'; featureId: FeatureId } // Lumber → connected revealed Trees
  | { kind: 'district'; districtId: DistrictId }; // Farm → adjacent built FarmLands

export interface DistrictDef {
  id: DistrictId;
  name: string;
  description: string;
  buildable: boolean;
  glyph: string; // placeholder art
  populationCapacity: number;
  silverPerPopulation: number; // per minute per population point
  maxWorkersPerLevel: readonly number[]; // empty = no workers
  maxCountPerTownhallLevel: readonly number[]; // empty = unlimited
  baseGeneration: Wallet; // per minute
  baseGenerationPerLevel: number; // 0 everywhere today
  workedSource: WorkedSource | null;
  yieldPerWorkedTile: Wallet; // per minute per staffed worked unit
  vaultCapacity: number;
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
  silverPerPopulation: 0,
  maxWorkersPerLevel: [],
  maxCountPerTownhallLevel: [],
  baseGeneration: {},
  baseGenerationPerLevel: 0,
  workedSource: null,
  yieldPerWorkedTile: {},
  vaultCapacity: 0,
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
    description: 'Heart of the city. Houses 3, taxes population into Silver, gates everything.',
    glyph: '🏛️',
    buildable: false,
    populationCapacity: 3,
    silverPerPopulation: 5,
    vaultCapacity: 50,
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
    description: 'Produces Food. Works adjacent FarmLands for bonus Food.',
    glyph: '🌾',
    maxWorkersPerLevel: [3, 5, 7],
    maxCountPerTownhallLevel: [1, 1, 2],
    baseGeneration: { Food: 5 },
    workedSource: { kind: 'district', districtId: 'FarmLands' },
    yieldPerWorkedTile: { Food: 3 },
    vaultCapacity: 50,
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
    description: 'Cheap filler: drips Food, and is worked by an adjacent Farm.',
    glyph: '🟩',
    maxCountPerTownhallLevel: [6, 6, 12],
    baseGeneration: { Food: 3 }, // wallet-direct: no vault
    buildCost: { Wood: 20 },
    buildCostMultiplier: 2,
    buildCostExponentialGrowth: 1.2,
    buildDurationSeconds: 10,
  },
  Lumber: {
    ...base,
    id: 'Lumber',
    name: 'Lumber',
    description: 'Produces Wood. Works nearby Trees for bonus Wood.',
    glyph: '🪓',
    maxWorkersPerLevel: [3, 5, 7],
    maxCountPerTownhallLevel: [1, 2],
    baseGeneration: { Wood: 5 },
    workedSource: { kind: 'feature', featureId: 'Trees' },
    yieldPerWorkedTile: { Wood: 3 },
    vaultCapacity: 50,
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

export const BUILDABLE_DISTRICTS: DistrictId[] = ['Housing', 'Farm', 'FarmLands', 'Lumber'];

// ------------------------------------------------------------------ features

export interface FeatureDef {
  id: FeatureId;
  name: string;
  glyph: string;
  // Fidelity fix (a): Trees get a Wood BaseYield so the Tap spell has valid
  // targets (the Unity data left this empty, making Tap unreachable).
  baseYield: Wallet;
  tapMinDurability: number;
  tapMaxDurability: number; // 0/0 = indestructible
  destroyedReplacement: FeatureId | null;
  upgradedReplacement: FeatureId | null; // via Rain regrowth
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  Trees: {
    id: 'Trees',
    name: 'Trees',
    glyph: '🌲',
    baseYield: { Wood: 1 },
    tapMinDurability: 5,
    tapMaxDurability: 12,
    destroyedReplacement: 'TreesCut',
    upgradedReplacement: null,
  },
  TreesCut: {
    id: 'TreesCut',
    name: 'Felled forest',
    glyph: '🪵',
    baseYield: {},
    tapMinDurability: 0,
    tapMaxDurability: 0,
    destroyedReplacement: null,
    upgradedReplacement: 'Trees',
  },
};

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
  // {currencyId, perHour} generators
  production: [{ currencyId: 'Mana' as CurrencyId, perHour: 300 }],
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
    description: 'Multiplies a cell’s Food generation ×{value} for {duration}. Regrows felled forests.',
    glyph: '🌧️',
    unlockedFromStart: true,
    stackable: false,
    levels: [{ manaCost: 10, durationSeconds: 30, effectMagnitude: 5, upgradeCost: 0 }],
  },
  Tap: {
    id: 'Tap',
    name: 'Tap',
    description: 'Extract one resource from a wilderness feature. Risks wearing it out.',
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

export const GAME_VERSION = '0.1.0-web';
