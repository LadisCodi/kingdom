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
  Stone: currency('city', balance.currencies.Stone),
  Iron: currency('city', balance.currencies.Iron),
  Berries: currency('city', balance.currencies.Berries),
  Meat: currency('city', balance.currencies.Meat),
  Fish: currency('city', balance.currencies.Fish),
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

// Exhaustion/recovery applies to NATURAL sources only — buildings (Townhall,
// Housing) are tapped to advance their timers instead, and never exhaust.
export const HARVEST: Record<HarvestSourceId, HarvestSpec> = {
  Forest: { currencyId: 'Wood', ...balance.harvest.Forest },
  Crops: { currencyId: 'Food', ...balance.harvest.Crops },
  Berries: { currencyId: 'Berries', ...balance.harvest.Berries },
  Meat: { currencyId: 'Meat', ...balance.harvest.Meat },
  Stone: { currencyId: 'Stone', ...balance.harvest.Stone },
  Fish: { currencyId: 'Fish', ...balance.harvest.Fish },
  Iron: { currencyId: 'Iron', ...balance.harvest.Iron },
};

// Every delivery (of yieldPerWorker units) registers 1 tap of wear on the cell.
export const WORKER = balance.worker;

// Player collect taps: cooldown between collects (upgradeable later).
export const TAP = balance.tap;


// Villager training at the Townhall: duration + tap boost (upgradeable later).
export const TRAINING = balance.training;

// Passive taxes: gold per housed villager per minute (boostable by
// TradeRoutes); tapping a lived-in house adds tapBoostSeconds to the clock.
export const TAXES = balance.taxes;

// Adjacency rules (Adjacency sheet): flat gold a district gains — or loses —
// per adjacent neighbor of a given type. Directional: (district, neighbor).
export interface AdjacencyRule {
  district: DistrictId;
  neighbor: DistrictId;
  goldPerMinute: number;
}
export const ADJACENCY = balance.adjacency as unknown as AdjacencyRule[];

export const OFFLINE_CAP_HOURS = balance.offlineCapHours;

// -------------------------------------------------------------------- quests

/** Absolute types are state predicates (done-or-not, regardless of when the
 *  quest activated); relative types count events only while active. */
export type QuestGoalType =
  | 'BuildDistrict' | 'UpgradeDistrict' | 'HoldResource' | 'ReachPopulation'
  | 'CompleteTech' | 'CompleteTechs' | 'AssignWorkers' | 'TrainArmy'
  | 'CollectResource' | 'CollectTaps' | 'DiscoverCells' | 'SellGoods';

export const RELATIVE_QUEST_TYPES: ReadonlySet<QuestGoalType> =
  new Set(['CollectResource', 'CollectTaps', 'DiscoverCells', 'SellGoods']);

export interface QuestDef {
  id: string; // content id — data-side, not a TS union
  name: string;
  description: string;
  goalType: QuestGoalType;
  /** DistrictId / TechId / CurrencyId depending on goalType; null otherwise. */
  goalTarget: string | null;
  goalAmount: number;
  /** UpgradeDistrict only: the level bar ("n districts at level ≥ L"). */
  goalLevel: number | null;
  reward: Wallet;
  /** Gems paid into the PLAYER wallet (city currencies go through `reward`). */
  rewardGems: number;
}

/** The chain, in sheet order — one quest active at a time. */
export const QUESTS = balance.quests as unknown as QuestDef[];

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
  /** Housing capacity by level; empty = houses nobody. */
  populationCapacityPerLevel: readonly number[];
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
  /** Technology gating each upgrade; index 0 = requirement to REACH level 2. */
  requiredTechPerLevel: readonly (TechId | null)[];
}

// Numbers (costs, times, caps, sizes, radii) come from balance/*.csv via
// balance.json; only identity, art, and rules wiring is authored here.
const rules = {
  buildable: true, harvestSource: null, providesHarvestSource: null, requiredTech: null,
} as const;

/** The per-level tech gates arrive from JSON as plain strings — the importer
 *  already validated them against the tech id list. */
const districtBalance = <B extends { requiredTechPerLevel: readonly (string | null)[] }>(
  b: B,
): Omit<B, 'requiredTechPerLevel'> & { requiredTechPerLevel: readonly (TechId | null)[] } =>
  b as never;

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  Townhall: {
    ...rules,
    id: 'Townhall',
    name: 'Townhall',
    description:
      'Heart of the city. Trains new villagers — tap it to speed training up.',
    glyph: '🏛️',
    sprite: 'townhall',
    buildable: false,
    ...districtBalance(balance.districts.Townhall),
  },
  Housing: {
    ...rules,
    id: 'Housing',
    name: 'Housing',
    description: 'Provides homes. Residents pay taxes in Gold — tap to speed collection up.',
    glyph: '🏠',
    sprite: 'housing',
    ...districtBalance(balance.districts.Housing),
  },
  Farm: {
    ...rules,
    id: 'Farm',
    name: 'Farm',
    description: 'Sends workers to harvest Crops within its area of influence.',
    glyph: '🌾',
    sprite: 'farm',
    harvestSource: 'Crops',
    requiredTech: 'Farming',
    ...districtBalance(balance.districts.Farm),
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
    ...districtBalance(balance.districts.FarmLands),
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
    ...districtBalance(balance.districts.Sawmill),
  },
  Market: {
    ...rules,
    id: 'Market',
    name: 'Market',
    description: 'Trade surplus goods for Gold — tap it to open the trade screen.',
    glyph: '🏪',
    sprite: 'market',
    requiredTech: 'Market',
    ...districtBalance(balance.districts.Market),
  },
  Quarry: {
    ...rules,
    id: 'Quarry',
    name: 'Quarry',
    description: 'Sends workers to cut Stone from Rocks within its area of influence.',
    glyph: '⛏️',
    sprite: 'quarry',
    harvestSource: 'Stone',
    requiredTech: 'Masonry',
    ...districtBalance(balance.districts.Quarry),
  },
  Docks: {
    ...rules,
    id: 'Docks',
    name: 'Docks',
    description: 'A pier: one half on land, one on water. Its boats net Fish (1 Food each).',
    glyph: '⚓',
    sprite: 'docks',
    harvestSource: 'Fish',
    requiredTech: 'Fishing',
    ...districtBalance(balance.districts.Docks),
  },
  Mine: {
    ...rules,
    id: 'Mine',
    name: 'Mine',
    description: 'Sends workers to dig Iron from veins within its area of influence.',
    glyph: '⚒️',
    sprite: 'mine',
    harvestSource: 'Iron',
    requiredTech: 'Mining',
    ...districtBalance(balance.districts.Mine),
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] =
  ['Housing', 'Farm', 'FarmLands', 'Sawmill', 'Quarry', 'Docks', 'Mine', 'Market'];

// ------------------------------------------------------------------ features

export interface FeatureDef {
  id: FeatureId;
  name: string;
  glyph: string;
  exhaustedGlyph: string;
  sprite: string; // asset filename stem; `${sprite}_exhausted` for the exhausted state
  source: HarvestSourceId;
  /** Terrain a FINITE feature respawns on (adjacent to its origin). */
  respawnTerrain: 'Grassland' | 'Water';
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  Trees: {
    id: 'Trees', name: 'Forest', glyph: '🌲', exhaustedGlyph: '🪵',
    sprite: 'forest', source: 'Forest', respawnTerrain: 'Grassland',
  },
  Rocks: {
    id: 'Rocks', name: 'Rocks', glyph: '🪨', exhaustedGlyph: '🧱',
    sprite: 'rocks', source: 'Stone', respawnTerrain: 'Grassland',
  },
  IronVein: {
    id: 'IronVein', name: 'Iron vein', glyph: '⛰️', exhaustedGlyph: '🕳️',
    sprite: 'iron_vein', source: 'Iron', respawnTerrain: 'Grassland',
  },
  // Finite sources (recovery 0): consumed and removed from the map when drained.
  BerryBush: {
    id: 'BerryBush', name: 'Berry bush', glyph: '🫐', exhaustedGlyph: '🍂',
    sprite: 'berry_bush', source: 'Berries', respawnTerrain: 'Grassland',
  },
  WildAnimals: {
    id: 'WildAnimals', name: 'Wild animals', glyph: '🐗', exhaustedGlyph: '🦴',
    sprite: 'wild_animals', source: 'Meat', respawnTerrain: 'Grassland',
  },
  FishShoal: {
    id: 'FishShoal', name: 'Fish shoal', glyph: '🐟', exhaustedGlyph: '🫧',
    sprite: 'fish_shoal', source: 'Fish', respawnTerrain: 'Water',
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
): TechnologyDef => ({
  ...content, cost: b.cost, durationSeconds: b.durationSeconds,
  requires: b.requires as TechId[]
});

// Four branches out of Forestry (Docs/features/tech-tree.md): CIVICS up,
// ECONOMICS left (farm row 0, stone row −1), EXPLORATION right, MILITARY down.
// Cells (−1,0) and (1,0) stay EMPTY on purpose: the branch trunks route their
// elbows through them, so no connector ever crosses another node.
export const TECHNOLOGIES: Record<TechId, TechnologyDef> = {
  Forestry: tech({
    id: 'Forestry',
    name: 'Forestry',
    description: 'Unlocks the Sawmill — its workers chop nearby forests for you.',
    glyph: '🪓',
    node: { x: 0, y: 0 },
  }, balance.technologies.Forestry),
  // ---- civics (up)
  UrbanPlanning: tech({
    id: 'UrbanPlanning',
    name: 'Urban Planning',
    description: 'Ordered streets — Housing reaches level 2.',
    glyph: '🏘️',
    node: { x: 0, y: -1 },
  }, balance.technologies.UrbanPlanning),
  Communities: tech({
    id: 'Communities',
    name: 'Communities',
    description: 'Tighter neighborhoods — every Housing holds +1 resident.',
    glyph: '👥',
    node: { x: 0, y: -2 },
  }, balance.technologies.Communities),
  Architecture: tech({
    id: 'Architecture',
    name: 'Architecture',
    description: 'Iron-braced monuments — the Townhall reaches level 3.',
    glyph: '📐',
    node: { x: 0, y: -3 },
  }, balance.technologies.Architecture),
  // ---- economics: farm side (left, row 0)
  Agriculture: tech({
    id: 'Agriculture',
    name: 'Agriculture',
    description: 'Unlocks crop plots (FarmLands) — tap them for Food.',
    glyph: '🌱',
    node: { x: -2, y: 0 },
  }, balance.technologies.Agriculture),
  Farming: tech({
    id: 'Farming',
    name: 'Farming',
    description: 'Unlocks the Farm — its workers harvest nearby crop plots for you.',
    glyph: '🚜',
    node: { x: -3, y: 0 },
  }, balance.technologies.Farming),
  Market: tech({
    id: 'Market',
    name: 'Market',
    description: 'Organized trade — unlocks the Market building.',
    glyph: '🤝',
    node: { x: -2, y: 1 },
  }, balance.technologies.Market),
  CropRotation: tech({
    id: 'CropRotation',
    name: 'Crop Rotation',
    description: 'Smarter fields — the Farm reaches level 2.',
    glyph: '🔄',
    node: { x: -4, y: 0 },
  }, balance.technologies.CropRotation),
  // ---- economics: stone side (upper left, row −1)
  Masonry: tech({
    id: 'Masonry',
    name: 'Masonry',
    description: 'Unlocks the Quarry — its workers cut Stone from nearby rocks.',
    glyph: '🧱',
    node: { x: -1, y: -1 },
  }, balance.technologies.Masonry),
  Mining: tech({
    id: 'Mining',
    name: 'Mining',
    description: 'Unlocks the Mine — its workers dig Iron, the army\'s metal.',
    glyph: '⛏️',
    node: { x: -2, y: -1 },
  }, balance.technologies.Mining),
  Engineering: tech({
    id: 'Engineering',
    name: 'Engineering',
    description: 'Cranes and gears — Quarry level 2 and Sawmill level 3.',
    glyph: '⚙️',
    node: { x: -1, y: -2 },
  }, balance.technologies.Engineering),
  DeepMining: tech({
    id: 'DeepMining',
    name: 'Deep Mining',
    description: 'Braced shafts — the Mine reaches level 2.',
    glyph: '🕯️',
    node: { x: -3, y: -1 },
  }, balance.technologies.DeepMining),
  // ---- exploration (right)
  Sailing: tech({
    id: 'Sailing',
    name: 'Sailing',
    description: 'Rafts and rigging — sea cells can be explored.',
    glyph: '⛵',
    node: { x: 2, y: 0 },
  }, balance.technologies.Sailing),
  Fishing: tech({
    id: 'Fishing',
    name: 'Fishing',
    description: 'Unlocks the Docks — send fishing boats out for Fish (worth 1 Food each).',
    glyph: '🎣',
    node: { x: 3, y: 0 },
  }, balance.technologies.Fishing),
  Shipbuilding: tech({
    id: 'Shipbuilding',
    name: 'Shipbuilding',
    description: 'Sturdier hulls — the Docks reach level 2.',
    glyph: '🛶',
    node: { x: 4, y: 0 },
  }, balance.technologies.Shipbuilding),
  ScalingTools: tech({
    id: 'ScalingTools',
    name: 'Scaling Tools',
    description: 'Ropes and pitons — mountain cells can be explored.',
    glyph: '🧗',
    node: { x: 1, y: 1 },
  }, balance.technologies.ScalingTools),
  // ---- military (down)
  Warrior: tech({
    id: 'Warrior',
    name: 'Warrior',
    description: 'Unlocks the Warrior — a sturdy front line for your army.',
    glyph: '🗡️',
    node: { x: 0, y: 2 },
  }, balance.technologies.Warrior),
  Spears: tech({
    id: 'Spears',
    name: 'Spears',
    description: 'Unlocks the Lancer — long reach that keeps the line safe.',
    glyph: '🔱',
    node: { x: -1, y: 3 },
  }, balance.technologies.Spears),
  Archery: tech({
    id: 'Archery',
    name: 'Archery',
    description: 'Unlocks the Archer — ranged support for your army.',
    glyph: '🏹',
    node: { x: 0, y: 3 },
  }, balance.technologies.Archery),
  Cavalry: tech({
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Unlocks the Cavalry — fast, hard-hitting mounted units.',
    glyph: '🐎',
    node: { x: 1, y: 3 },
  }, balance.technologies.Cavalry),
};

export const TECH_ORDER: TechId[] = [
  'Forestry',
  'UrbanPlanning', 'Communities', 'Architecture',
  'Agriculture', 'Farming', 'Market', 'CropRotation',
  'Masonry', 'Mining', 'Engineering', 'DeepMining',
  'Sailing', 'Fishing', 'Shipbuilding', 'ScalingTools',
  'Warrior', 'Spears', 'Archery', 'Cavalry',
];

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
  WorkerLoad: upgrade({
    id: 'WorkerLoad', name: 'Worker Load', glyph: '🎒',
    description: '+1 resource per worker delivery',
  }, balance.upgrades.WorkerLoad),
  MarketStall: upgrade({
    id: 'MarketStall', name: 'Market Stall', glyph: '🛒',
    description: '+5% Market sale prices',
  }, balance.upgrades.MarketStall),
  TradeRoutes: upgrade({
    id: 'TradeRoutes', name: 'Trade Routes', glyph: '⛵',
    description: '+10% tax income',
  }, balance.upgrades.TradeRoutes),
  Stonecutting: upgrade({
    id: 'Stonecutting', name: 'Stonecutting', glyph: '🪨',
    description: '+1 Stone per worker delivery',
  }, balance.upgrades.Stonecutting),
  BigNets: upgrade({
    id: 'BigNets', name: 'Big Nets', glyph: '🕸️',
    description: '+1 Fish per worker delivery',
  }, balance.upgrades.BigNets),
  IronPicks: upgrade({
    id: 'IronPicks', name: 'Iron Picks', glyph: '⛏️',
    description: '+1 Iron per worker delivery',
  }, balance.upgrades.IronPicks),
};

export const UPGRADE_ORDER: UpgradeId[] = [
  'TapPower', 'WorkerLoad', 'MarketStall', 'TradeRoutes',
  'Stonecutting', 'BigNets', 'IronPicks',
];

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
  Warrior: {
    id: 'Warrior',
    name: 'Warrior',
    description: 'Sturdy front line.',
    glyph: '⚔️',
    tags: ['Melee'],
    requiredTech: 'Warrior',
    ...balance.units.Warrior,
  },
  Lancer: {
    id: 'Lancer',
    name: 'Lancer',
    description: 'Long reach that keeps the line safe.',
    glyph: '🔱',
    tags: ['Melee'],
    requiredTech: 'Spears',
    ...balance.units.Lancer,
  },
  Archer: {
    id: 'Archer',
    name: 'Archer',
    description: 'Ranged support.',
    glyph: '🏹',
    tags: ['Distance'],
    requiredTech: 'Archery',
    ...balance.units.Archer,
  },
  Cavalry: {
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Fast and hard-hitting.',
    glyph: '🐎',
    tags: ['Mounted', 'Melee'],
    requiredTech: 'Cavalry',
    ...balance.units.Cavalry,
  },
};

export const UNIT_ORDER: UnitId[] = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];

export const GAME_VERSION = '0.1.0';
export const SAVE_VERSION = 16; // v15 saves predate the reshaped tech tree; discarded
