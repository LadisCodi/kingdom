// Game data definitions. Identity/content (names, descriptions, glyphs,
// sprites, rules wiring) lives here; every balancing NUMBER comes from
// balance.json, which is generated from the editable balance/*.csv sheets
// (edit those, then run: npm run balance).
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.

import balance from './balance.json';
import type {
  CurrencyId, DistrictId, FeatureId, HarvestSourceId, TechId, UnitId, UpgradeId, Wallet,
} from '../state';

/** 1-based per-level list lookup that clamps to the last entry (the docs' convention). */
export const levelIndexed = <T>(list: readonly T[], level: number): T =>
  list[Math.min(Math.max(level, 1), list.length) - 1];

// ---------------------------------------------------------------- currencies

export interface CurrencyDef {
  scope: 'city' | 'kingdom' | 'player';
  cap: number | null;
  start: number;
  /** Shown as a widget in the top resource bar. */
  primary: boolean;
  /** This currency is stored separately but pays costs of another one at a
   *  fixed rate (a Berry counts as 1 Food, a Meat as 3). Null = plain. */
  countsAs: { currency: CurrencyId; value: number } | null;
  /** The Market sells 1 unit for this much Gold; null = not sellable. */
  goldValue: number | null;
}

interface CurrencyBalance {
  cap: number | null; start: number; primary?: boolean; countsAs?: unknown;
  goldValue?: number | null;
}
const currency = (scope: CurrencyDef['scope'], b: CurrencyBalance): CurrencyDef => ({
  scope,
  cap: b.cap,
  start: b.start,
  primary: b.primary ?? false,
  countsAs: (b.countsAs ?? null) as CurrencyDef['countsAs'],
  goldValue: b.goldValue ?? null,
});

// Object order = header widget order AND the Market's sell order.
export const CURRENCIES: Record<CurrencyId, CurrencyDef> = {
  Gold: currency('city', balance.currencies.Gold),
  Food: currency('city', balance.currencies.Food),
  Wood: currency('city', balance.currencies.Wood),
  Berries: currency('city', balance.currencies.Berries),
  Meat: currency('city', balance.currencies.Meat),
  Knowledge: currency('kingdom', balance.currencies.Knowledge),
  Gems: currency('player', balance.currencies.Gems),
};

// -------------------------------------------------------------- harvest loop

export interface HarvestSpec {
  currencyId: CurrencyId;
  /** Units per player tap (click collection). */
  yieldPerTap: number;
  /** Units per worker delivery (auto collection) — upgradeable separately. */
  yieldPerWorker: number;
  tapsToExhaust: number;
  /** Seconds to recover after exhausting; 0 = FINITE — the feature is
   *  consumed and vanishes from the map when drained. */
  recoverySeconds: number;
  /** FINITE sources only: seconds after depletion until the feature
   *  reappears in a random tile adjacent to its ORIGINAL map cell
   *  (0 = never — removed for good). */
  respawnSeconds: number;
}

export const HARVEST: Record<HarvestSourceId, HarvestSpec> = {
  Forest: { currencyId: 'Wood', ...balance.harvest.Forest },
  Crops: { currencyId: 'Food', ...balance.harvest.Crops },
  Berries: { currencyId: 'Berries', ...balance.harvest.Berries },
  Meat: { currencyId: 'Meat', ...balance.harvest.Meat },
};

// Every delivery (of yieldPerWorker units) registers 1 tap of wear on the cell.
export const WORKER = balance.worker;

// Player collect taps: cooldown between collects (upgradeable later).
export const TAP = balance.tap;


// Villager training at the Townhall: duration + tap boost (upgradeable later).
export const TRAINING = balance.training;

// The Market's drip sale: one unit per interval, queue capacity (both upgradeable).
export const MARKET = balance.market;

export const OFFLINE_CAP_HOURS = balance.offlineCapHours;

// ----------------------------------------------------------------- districts

export interface DistrictDef {
  id: DistrictId;
  name: string;
  description: string;
  buildable: boolean;
  glyph: string; // placeholder art (fallback when no sprite image is present)
  sprite: string; // asset filename stem in src/render/assets (e.g. 'townhall' → townhall.png)
  /** Footprint in cells; `location` is the top-left (anchor) cell. */
  size: { x: number; y: number };
  /** Fog fully revealed this far around the footprint (at seed / build completion). */
  fogRevealRadius: number;
  /** Fog turned Discovered (payable frontier) this far around the footprint. */
  fogDiscoverRadius: number;
  /** Technology that must be completed before this district can be built. */
  requiredTech: TechId | null;
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
  buildDurationSeconds: number;
  buildDurationDistrictGrowth: number;
  buildDurationDistanceGrowth: number;
  upgradeCost: Wallet;
  upgradeCostLevelGrowth: number;
  upgradeDurationSeconds: number;
  upgradeDurationLevelGrowth: number;
  requiredTownhallLevelPerLevel: readonly number[]; // index 0 = requirement to REACH level 2
}

// Numbers (costs, times, caps, sizes, radii) come from balance/*.csv via
// balance.json; only identity, art, and rules wiring is authored here.
const rules = {
  buildable: true, harvestSource: null, providesHarvestSource: null, requiredTech: null,
} as const;

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  Townhall: {
    ...rules,
    id: 'Townhall',
    name: 'Townhall',
    description:
      'Heart of the city. Houses 3 and trains new villagers — tap it to speed training up.',
    glyph: '🏛️',
    sprite: 'townhall',
    buildable: false,
    ...balance.districts.Townhall,
  },
  Housing: {
    ...rules,
    id: 'Housing',
    name: 'Housing',
    description: 'Provides homes — raises max population.',
    glyph: '🏠',
    sprite: 'housing',
    ...balance.districts.Housing,
  },
  Farm: {
    ...rules,
    id: 'Farm',
    name: 'Farm',
    description: 'Sends workers to harvest Crops within its area of influence.',
    glyph: '🌾',
    sprite: 'farm',
    harvestSource: 'Crops',
    requiredTech: 'Irrigation',
    ...balance.districts.Farm,
  },
  FarmLands: {
    ...rules,
    id: 'FarmLands',
    name: 'FarmLands',
    description: 'A crop plot: tap it for Food. Build a Farm nearby to have workers harvest it.',
    glyph: '🟩',
    sprite: 'farmlands',
    providesHarvestSource: 'Crops',
    requiredTech: 'Agriculture',
    ...balance.districts.FarmLands,
  },
  Sawmill: {
    ...rules,
    id: 'Sawmill',
    name: 'Sawmill',
    description: 'Sends workers to harvest Forest cells within its area of influence.',
    glyph: '🪚',
    sprite: 'sawmill',
    harvestSource: 'Forest',
    requiredTech: 'Forestry',
    ...balance.districts.Sawmill,
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] = ['Housing', 'Farm', 'FarmLands', 'Sawmill'];

// ------------------------------------------------------------------ features

export interface FeatureDef {
  id: FeatureId;
  name: string;
  glyph: string;
  exhaustedGlyph: string;
  sprite: string; // asset filename stem; `${sprite}_exhausted` for the exhausted state
  source: HarvestSourceId;
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  Trees: {
    id: 'Trees', name: 'Forest', glyph: '🌲', exhaustedGlyph: '🪵',
    sprite: 'forest', source: 'Forest',
  },
  // Finite sources (recovery 0): consumed and removed from the map when drained.
  BerryBush: {
    id: 'BerryBush', name: 'Berry bush', glyph: '🫐', exhaustedGlyph: '🍂',
    sprite: 'berry_bush', source: 'Berries',
  },
  WildAnimals: {
    id: 'WildAnimals', name: 'Wild animals', glyph: '🐗', exhaustedGlyph: '🦴',
    sprite: 'wild_animals', source: 'Meat',
  },
};

/** Exhausted-crops visual (FarmLands districts have no feature). */
export const CROPS_EXHAUSTED_GLYPH = '🥀';

// -------------------------------------------------------------- fog settings

// rings: authored distance → total Silver cost.
export const FOG = balance.fog;

// ----------------------------------------------------------------- city def

export const CITY_DEF = {
  name: 'Oakville',
  ...balance.city,
  initialCurrencies: balance.city.initialCurrencies as Wallet,
  buildMenuOrder: BUILDABLE_DISTRICTS,
};

// --------------------------------------------------------------- kingdom def

export const KINGDOM_DEF = {
  name: 'PlayerKingdom',
  ...balance.kingdom,
};

// ------------------------------------------------------------- technologies

export interface TechnologyDef {
  id: TechId;
  name: string;
  description: string;
  glyph: string;
  /** Hand-authored tree grid position (the layout IS content). */
  node: { x: number; y: number };
  cost: Wallet; // city currencies
  durationSeconds: number;
  requires: TechId[]; // tree edges — all must be completed first
}

const tech = (
  content: Omit<TechnologyDef, 'cost' | 'durationSeconds' | 'requires'>,
  b: { cost: Wallet; durationSeconds: number; requires: unknown },
): TechnologyDef => ({ ...content, cost: b.cost, durationSeconds: b.durationSeconds,
  requires: b.requires as TechId[] });

export const TECHNOLOGIES: Record<TechId, TechnologyDef> = {
  Agriculture: tech({
    id: 'Agriculture',
    name: 'Agriculture',
    description: 'Unlocks crop plots (FarmLands) — tap them for Food.',
    glyph: '🌱',
    node: { x: -1, y: 0 },
  }, balance.technologies.Agriculture),
  Irrigation: tech({
    id: 'Irrigation',
    name: 'Irrigation',
    description: 'Unlocks the Farm — its workers harvest nearby crop plots for you.',
    glyph: '💧',
    node: { x: -2, y: 1 },
  }, balance.technologies.Irrigation),
  Forestry: tech({
    id: 'Forestry',
    name: 'Forestry',
    description: 'Unlocks the Sawmill — its workers chop nearby forests for you.',
    glyph: '🪓',
    node: { x: 0, y: 0 },
  }, balance.technologies.Forestry),
  Archery: tech({
    id: 'Archery',
    name: 'Archery',
    description: 'Unlocks the Archer — ranged support for your army.',
    glyph: '🏹',
    node: { x: 1, y: 0 },
  }, balance.technologies.Archery),
  CavalryTraining: tech({
    id: 'CavalryTraining',
    name: 'Cavalry Training',
    description: 'Unlocks the Cavalry — fast, hard-hitting mounted units.',
    glyph: '🐎',
    node: { x: 2, y: 1 },
  }, balance.technologies.CavalryTraining),
};

export const TECH_ORDER: TechId[] =
  ['Agriculture', 'Irrigation', 'Forestry', 'Archery', 'CavalryTraining'];

// Slots & gem pricing for extra slots.
export const RESEARCH_SETTINGS = balance.research;

// ----------------------------------------------------------------- upgrades

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string; // include the per-level effect, player-facing
  glyph: string;
  costBase: number; // gold; level L costs round(costBase * costGrowth^L)
  costGrowth: number;
  maxLevel: number;
  effectPerLevel: number; // applied by src/sim/upgrades.ts effective helpers
  requiredTech: TechId | null;
}

const upgrade = (
  content: Pick<UpgradeDef, 'id' | 'name' | 'description' | 'glyph'>,
  b: Omit<UpgradeDef, 'id' | 'name' | 'description' | 'glyph' | 'requiredTech'>
    & { requiredTech: unknown },
): UpgradeDef => ({ ...content, ...b, requiredTech: (b.requiredTech ?? null) as TechId | null });

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  TapPower: upgrade({
    id: 'TapPower', name: 'Tap Power', glyph: '👆',
    description: '+1 resource per collect tap',
  }, balance.upgrades.TapPower),
  QuickHands: upgrade({
    id: 'QuickHands', name: 'Quick Hands', glyph: '⚡',
    description: '−0.05s collect cooldown',
  }, balance.upgrades.QuickHands),
  WorkerLoad: upgrade({
    id: 'WorkerLoad', name: 'Worker Load', glyph: '🎒',
    description: '+1 resource per worker delivery',
  }, balance.upgrades.WorkerLoad),
  MarketStall: upgrade({
    id: 'MarketStall', name: 'Market Stall', glyph: '🛒',
    description: '+25 Market queue capacity',
  }, balance.upgrades.MarketStall),
  TradeRoutes: upgrade({
    id: 'TradeRoutes', name: 'Trade Routes', glyph: '⛵',
    description: '−0.5s between Market sales',
  }, balance.upgrades.TradeRoutes),
};

export const UPGRADE_ORDER: UpgradeId[] =
  ['TapPower', 'QuickHands', 'WorkerLoad', 'MarketStall', 'TradeRoutes'];

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
  /** Technology that must be completed before this unit can be recruited. */
  requiredTech: TechId | null;
}

export const UNITS: Record<UnitId, UnitDef> = {
  Archer: {
    id: 'Archer',
    name: 'Archer',
    description: 'Ranged support.',
    glyph: '🏹',
    tags: ['Distance'],
    requiredTech: 'Archery',
    ...balance.units.Archer,
  },
  Swordsman: {
    id: 'Swordsman',
    name: 'Swordsman',
    description: 'Sturdy front line.',
    glyph: '⚔️',
    tags: ['Melee'],
    requiredTech: null,
    ...balance.units.Swordsman,
  },
  Cavalry: {
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Fast and hard-hitting.',
    glyph: '🐎',
    tags: ['Mounted', 'Melee'],
    requiredTech: 'CavalryTraining',
    ...balance.units.Cavalry,
  },
};

export const UNIT_ORDER: UnitId[] = ['Archer', 'Swordsman', 'Cavalry'];

export const GAME_VERSION = '0.1.0';
export const SAVE_VERSION = 9; // v8 saves predate feature respawning; discarded
