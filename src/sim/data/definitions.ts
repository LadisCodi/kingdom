// Game data definitions. Identity/content (names, descriptions, glyphs,
// sprites, rules wiring) lives here; every balancing NUMBER comes from
// balance.json, which is generated from the editable balance/*.csv sheets
// (edit those, then run: npm run balance).
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.

import balance from './balance.json';
import type { ModifierScope, ModifierStat } from '../modifiers';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, FeatureId, HarvestSourceId, HeroId,
  LandmarkKind, RuinId, TechId, UnitId, UpgradeId, Wallet,
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
  // Mana's ceiling is DYNAMIC (Townhall level + Sanctum levels), so its `cap`
  // column stays blank and sim/mana.ts owns the real number.
  Mana: currency('city', balance.currencies.Mana),
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
  /** The technology a player needs before they may tap this at all; null =
   *  none. Forestry gates the Forest so the trees around the Townhall are
   *  VISIBLE and refusing from the first second — which is what makes the
   *  first research something the player wants rather than a chore. */
  requiredTech: TechId | null;
  /** FINITE sources only: seconds after depletion until the feature
   *  reappears in a random tile adjacent to its ORIGINAL map cell
   *  (0 = never — removed for good). */
  respawnSeconds: number;
}

// Exhaustion/recovery applies to NATURAL sources only — buildings (Townhall,
// Housing) are tapped to advance their timers instead, and never exhaust.
const harvest = (
  currencyId: CurrencyId,
  b: Omit<HarvestSpec, 'currencyId' | 'requiredTech'> & { requiredTech: unknown },
): HarvestSpec => ({ ...b, currencyId, requiredTech: (b.requiredTech ?? null) as TechId | null });

export const HARVEST: Record<HarvestSourceId, HarvestSpec> = {
  Forest: harvest('Wood', balance.harvest.Forest),
  Crops: harvest('Food', balance.harvest.Crops),
  Berries: harvest('Berries', balance.harvest.Berries),
  Meat: harvest('Meat', balance.harvest.Meat),
  Stone: harvest('Stone', balance.harvest.Stone),
  Fish: harvest('Fish', balance.harvest.Fish),
  Iron: harvest('Iron', balance.harvest.Iron),
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
  | 'CollectResource' | 'CollectTaps' | 'DiscoverCells' | 'SellGoods'
  | 'ClaimLandmarks' | 'ReachDepth' | 'ClearRuins' | 'OwnArtifacts'
  | 'OwnHeroes' | 'BuyUpgrade';

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
  /** Kingdom-scoped, so it is NOT part of `reward` — that wallet is the
   *  city's. Quests are the steady half of the research budget; exploring
   *  is the half that scales. */
  rewardKnowledge: number;
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
  /** Army cap this building contributes at each level (TOTAL, not
   *  incremental). Empty = it is not a military building. */
  armyCapPerLevel: readonly number[];
  /** The unit this building trains; null = it trains nothing. Army size is a
   *  city-building decision now, so wanting Cavalry means finding room for
   *  Stables — which is the strongest link between the two halves of the game. */
  trains: UnitId | null;
}

// Numbers (costs, times, caps, sizes, radii) come from balance/*.csv via
// balance.json; only identity, art, and rules wiring is authored here.
const rules = {
  buildable: true, harvestSource: null, providesHarvestSource: null, requiredTech: null,
  trains: null,
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
    requiredTech: 'Agriculture',
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
    requiredTech: 'Saws',
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
  Sanctum: {
    ...rules,
    id: 'Sanctum',
    name: 'Sanctum',
    description: 'A vault for raw magic. Each level holds more Mana against the hours you are away.',
    glyph: '🔯',
    sprite: 'sanctum',
    requiredTech: 'Attunement',
    ...districtBalance(balance.districts.Sanctum),
  },
  Barracks: {
    ...rules,
    id: 'Barracks',
    name: 'Barracks',
    description: 'Drills Warriors, and every level lets you keep a bigger army.',
    glyph: '🛖',
    sprite: 'barracks',
    requiredTech: 'Warrior',
    trains: 'Warrior',
    ...districtBalance(balance.districts.Barracks),
  },
  SpearHall: {
    ...rules,
    id: 'SpearHall',
    name: 'Spear Hall',
    description: 'Trains Lancers — long reach that stops a charge.',
    glyph: '🏚️',
    sprite: 'spear_hall',
    requiredTech: 'Spears',
    trains: 'Lancer',
    ...districtBalance(balance.districts.SpearHall),
  },
  ShootingGrounds: {
    ...rules,
    id: 'ShootingGrounds',
    name: 'Shooting Grounds',
    description: 'Trains Archers — the most attack per Gold, and the least armour.',
    glyph: '🎯',
    sprite: 'shooting_grounds',
    requiredTech: 'Archery',
    trains: 'Archer',
    ...districtBalance(balance.districts.ShootingGrounds),
  },
  Stables: {
    ...rules,
    id: 'Stables',
    name: 'Stables',
    description: 'Trains Cavalry — fast, hard-hitting, and expensive to keep.',
    glyph: '🐴',
    sprite: 'stables',
    requiredTech: 'Cavalry',
    trains: 'Cavalry',
    ...districtBalance(balance.districts.Stables),
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

export const BUILDABLE_DISTRICTS: DistrictId[] = [
  'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Quarry', 'Docks', 'Mine', 'Market',
  'Sanctum',
  'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
];

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
    description: 'Axes and foraging — you can work the woods and berry bushes around you.',
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
  Saws: tech({
    id: 'Saws',
    name: 'Saws',
    description: 'Unlocks the Sawmill — its workers chop nearby forests for you.',
    glyph: '🪚',
    node: { x: -1, y: 1 },
  }, balance.technologies.Saws),
  Agriculture: tech({
    id: 'Agriculture',
    name: 'Agriculture',
    description: 'Unlocks crop plots and the Farm that works them.',
    glyph: '🌱',
    node: { x: -2, y: 0 },
  }, balance.technologies.Agriculture),
  Farming: tech({
    id: 'Farming',
    name: 'Farming',
    description: 'Deeper furrows — the Farm reaches level 2.',
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
  //
  // Cartography heads the branch and sits at (2,0): the trunk elbow at (1,0)
  // stays empty, so the Forestry→Attunement connector still has it to itself.
  Cartography: tech({
    id: 'Cartography',
    name: 'Cartography',
    description: 'Survey and chart — every tap on the fog counts double. Opens rock and water.',
    glyph: '🗺️',
    node: { x: 2, y: 0 },
  }, balance.technologies.Cartography),
  Sailing: tech({
    id: 'Sailing',
    name: 'Sailing',
    description: 'Rafts and rigging — sea cells can be explored.',
    glyph: '⛵',
    node: { x: 3, y: 0 },
  }, balance.technologies.Sailing),
  Fishing: tech({
    id: 'Fishing',
    name: 'Fishing',
    description: 'Unlocks the Docks — send fishing boats out for Fish (worth 1 Food each).',
    glyph: '🎣',
    node: { x: 4, y: 0 },
  }, balance.technologies.Fishing),
  Shipbuilding: tech({
    id: 'Shipbuilding',
    name: 'Shipbuilding',
    description: 'Sturdier hulls — the Docks reach level 2.',
    glyph: '🛶',
    node: { x: 5, y: 0 },
  }, balance.technologies.Shipbuilding),
  ScalingTools: tech({
    id: 'ScalingTools',
    name: 'Scaling Tools',
    description: 'Ropes and pitons — mountain cells can be explored.',
    glyph: '🧗',
    node: { x: 2, y: 1 },
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
  // ---- magic (up-right) and the warband leaf (below the military trunk)
  Attunement: tech({
    id: 'Attunement',
    name: 'Attunement',
    description: 'Unlocks the Sanctum, and a second relic can be attuned at once.',
    glyph: '🔯',
    node: { x: 1, y: -1 },
  }, balance.technologies.Attunement),
  Warband: tech({
    id: 'Warband',
    name: 'Warband',
    description: 'Marching order — one more companion joins every expedition.',
    glyph: '🚩',
    node: { x: 0, y: 4 },
  }, balance.technologies.Warband),
};

export const TECH_ORDER: TechId[] = [
  'Forestry',
  'UrbanPlanning', 'Communities', 'Architecture',
  'Saws', 'Agriculture', 'Farming', 'Market',
  'Masonry', 'Mining', 'Engineering', 'DeepMining',
  'Cartography', 'Sailing', 'Fishing', 'Shipbuilding', 'ScalingTools',
  'Warrior', 'Spears', 'Archery', 'Cavalry',
  'Attunement', 'Warband',
];

// Slots & gem pricing for extra slots.
export const RESEARCH_SETTINGS = balance.research;

/**
 * Combat, in six numbers.
 *
 * `army.power_cap_per_townhall_level` is retired: army size stops being a
 * passive consequence of a gate the player was going to pass anyway and
 * becomes a city-building decision.
 *
 * The type values are deliberately soft (x1.5 / x0.75). Sharper ones are more
 * dramatic but make one bad guess feel like a wasted trip, which is the
 * un-cozy end of the dial.
 */
export const ARMY = balance.army;

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
    // Only holding is paced, so this only ever speeds holding up. A
    // deliberate tap has no cooldown to shave.
    description: '−0.05s between auto-taps while holding',
  }, balance.upgrades.QuickHands),
  WorkerLoad: upgrade({
    id: 'WorkerLoad', name: 'Worker Load', glyph: '🎒',
    description: '+1 resource per worker delivery',
  }, balance.upgrades.WorkerLoad),
  Surveying: upgrade({
    id: 'Surveying', name: 'Surveying', glyph: '🧭',
    // Each level makes one tap on the fog do the work of one more. The Gold
    // a cell costs is unchanged — this buys the player's TIME back, which is
    // the thing exploration actually spends once the far rings get expensive.
    description: '+1 Gold of reveal progress per tap on the fog',
  }, balance.upgrades.Surveying),
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
  'TapPower', 'QuickHands', 'WorkerLoad', 'MarketStall', 'TradeRoutes',
  'Stonecutting', 'BigNets', 'IronPicks',
];

// -------------------------------------------------------------------- units

export type UnitTag = 'Melee' | 'Distance' | 'Mounted';

export interface UnitDef {
  id: UnitId;
  name: string;
  description: string;
  glyph: string;
  /** What it costs against the army cap — equal to `atk` by construction, so
   *  the cap table reads directly as attack potential. */
  power: number;
  atk: number;
  def: number;
  hp: number;
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
    description: 'Sturdy front line: the most armour and health per Gold.',
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
    description: 'Ranged support: the most attack per Gold, and the least of everything else.',
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

// ---------------------------------------------------------------- magic

/** Mana production, capacity, landmarks and Gem refills. The pool's ceiling is
 *  DYNAMIC, so the Currencies sheet's static `cap` column is blank for Mana and
 *  these are the numbers that decide it — see src/sim/mana.ts. */
export const MANA = balance.mana;

/** Attunement slots: one at start, one from research, the rest with Gems. */
export const ATTUNEMENT = balance.attunement;

/**
 * The COLLECTION substrate — one set of rules shared by artifacts and heroes.
 *
 * Built as two systems they would teach the player the same lesson twice and
 * neither would feel special. So: Fragments raise a TIER cap, Knowledge buys
 * LEVELS within it, and a hero and a relic are two kinds of thing rather than
 * two systems with two vocabularies.
 */
export const COLLECTION = balance.collection;

/** Knowledge drips from every ruin the player has FOUND, whether or not they
 *  ever delve it — so the fog keeps paying even between expeditions. */
export const KNOWLEDGE = balance.knowledge;

export interface LandmarkDef {
  id: string; // content id — data-side, not a TS union
  kind: LandmarkKind;
  location: Coord;
  /** An enemy army holds it: clear the encounter first, then claim. */
  defended: boolean;
  /** Gold to claim. Authored per sanctuary rather than derived from distance:
   *  the tiers are the design — one in sight to save up for, then two rings
   *  beyond it — and no curve lands on 5,000 / 25,000 / 100,000 exactly. */
  claimCost: number;
}

export const LANDMARK_ART: Record<LandmarkKind, { name: string; glyph: string; sprite: string }> = {
  Shrine: { name: 'Shrine', glyph: '⛩️', sprite: 'landmark_shrine' },
  StandingStones: { name: 'Standing stones', glyph: '🗿', sprite: 'landmark_stones' },
  Leyspring: { name: 'Leyspring', glyph: '💧', sprite: 'landmark_leyspring' },
};

export const LANDMARKS: LandmarkDef[] = (balance.landmarks as Array<{
  id: string; kind: string; x: number; y: number; defended: boolean; claimCost: number;
}>).map((l) => ({
  id: l.id,
  kind: l.kind as LandmarkKind,
  location: { x: l.x, y: l.y },
  defended: l.defended,
  claimCost: l.claimCost,
}));

/**
 * An artifact: a PASSIVE while attuned to the kingdom, and usually one ACTIVE
 * cast on the map. Hand-authored, one legible effect each, no random rolls —
 * which is what keeps a collection system cozy rather than a spreadsheet.
 *
 * Attuning is FREE. Relics used to draw an hourly Mana upkeep, which was
 * removed once Mana became the energy every tap is paid from — the two jobs
 * fought, and a player wearing the set had no pool left to play with.
 *
 * Attune-or-arm survives that intact, because the rule was never really about
 * price: a relic is attuned to the kingdom OR carried down by a hero, never
 * both, so the question is still "which do I need right now" — an economy
 * passive at home, or combat stats below.
 */
export interface ArtifactDef {
  id: ArtifactId;
  name: string;
  glyph: string;
  sprite: string;
  /** One line, player-facing, about what wearing it does. */
  passiveText: string;
  passive: {
    stat: ModifierStat;
    scope: ModifierScope;
    op: 'add' | 'mul';
    /** Value at level 1, and how much each further level moves it. */
    base: number;
    perLevel: number;
  };
  /** Mana per hour drawn while attuned. */
  /**
   * What the relic is worth when a hero carries it DOWN rather than the
   * kingdom wearing it — the other half of attune-OR-arm.
   *
   * Attuning draws Mana every hour; carrying draws none. That asymmetry is
   * deliberate and does the real work: the trade is never "which is cheaper"
   * but "which do I need right now" — a standing economic benefit against a
   * burst of delve power.
   */
  carried: CarriedStats;
  active: ArtifactActive | null;
  /** The ruin whose full clear grants it. */
  source: RuinId;
}

export type ArtifactActiveId = 'Divination' | 'Bloom' | 'Haste' | 'Beckon';

export interface ArtifactActive {
  id: ArtifactActiveId;
  name: string;
  text: string;
  manaCost: number;
  /** Cast targets a map cell through placement mode. */
  targeted: boolean;
  /** Timed effects only (Haste); 0 = instant. */
  durationSeconds: number;
  /** Area effects only (Bloom); 0 = the target cell alone. */
  radius: number;
}

/** A relic's contribution to a party, before any matchup. */
export interface CarriedStats {
  atk: number;
  def: number;
  hp: number;
  atkPerLevel: number;
  defPerLevel: number;
  hpPerLevel: number;
}

type ArtifactBalance = {
  passiveBase: number; passivePerLevel: number;
  activeManaCost: number; activeDurationSeconds: number; activeRadius: number;
  carriedAtk: number; carriedDef: number; carriedHp: number;
  carriedAtkPerLevel: number; carriedDefPerLevel: number; carriedHpPerLevel: number;
};
const ab = (id: ArtifactId): ArtifactBalance =>
  (balance.artifacts as Record<ArtifactId, ArtifactBalance>)[id];

const carried = (id: ArtifactId): CarriedStats => ({
  atk: ab(id).carriedAtk,
  def: ab(id).carriedDef,
  hp: ab(id).carriedHp,
  atkPerLevel: ab(id).carriedAtkPerLevel,
  defPerLevel: ab(id).carriedDefPerLevel,
  hpPerLevel: ab(id).carriedHpPerLevel,
});

export const ARTIFACTS: Record<ArtifactId, ArtifactDef> = {
  DowsingRod: {
    id: 'DowsingRod', name: 'Dowsing Rod', glyph: '🔮', sprite: 'artifact_dowsing_rod',
    passiveText: 'Fog costs less to clear',
    passive: {
      stat: 'revealCost', scope: null, op: 'mul',
      base: ab('DowsingRod').passiveBase, perLevel: ab('DowsingRod').passivePerLevel,
    },
    carried: carried('DowsingRod'),
    active: {
      id: 'Divination', name: 'Divination', targeted: true,
      manaCost: ab('DowsingRod').activeManaCost, durationSeconds: 0, radius: 0,
      // Its Mana price is FLAT while the Gold reveal cost doubles every ring,
      // so its value grows with depth — exactly where the pain is. This one
      // relic turns the fog from a chore into a real question: Gold, or Mana?
      text: 'Pays a frontier cell\u2019s entire remaining reveal cost, at any distance',
    },
    source: 'HollowBarrow',
  },
  VerdantSeal: {
    id: 'VerdantSeal', name: 'Verdant Seal', glyph: '🌱', sprite: 'artifact_verdant_seal',
    passiveText: 'Resource cells recover faster',
    passive: {
      stat: 'cellRecovery', scope: null, op: 'mul',
      base: ab('VerdantSeal').passiveBase, perLevel: ab('VerdantSeal').passivePerLevel,
    },
    carried: carried('VerdantSeal'),
    active: {
      id: 'Bloom', name: 'Bloom', targeted: true,
      manaCost: ab('VerdantSeal').activeManaCost, durationSeconds: 0,
      radius: ab('VerdantSeal').activeRadius,
      text: 'Clears exhaustion from every resource cell nearby',
    },
    source: 'SunkenChapel',
  },
  ForemansSigil: {
    id: 'ForemansSigil', name: 'Foreman’s Sigil', glyph: '⚡', sprite: 'artifact_foremans_sigil',
    passiveText: 'Every worker carries more',
    passive: {
      stat: 'workerYield', scope: null, op: 'add',
      base: ab('ForemansSigil').passiveBase, perLevel: ab('ForemansSigil').passivePerLevel,
    },
    carried: carried('ForemansSigil'),
    active: {
      id: 'Haste', name: 'Haste', targeted: false,
      manaCost: ab('ForemansSigil').activeManaCost,
      durationSeconds: ab('ForemansSigil').activeDurationSeconds, radius: 0,
      // Cast on the way OUT. Divination and Bloom reward being present; a
      // game played in visits needs a good departure move too.
      text: 'Workers carry double for an hour \u2014 cast it on your way out',
    },
    source: 'DrownedIronworks',
  },
  GildedLedger: {
    id: 'GildedLedger', name: 'Gilded Ledger', glyph: '🪙', sprite: 'artifact_gilded_ledger',
    passiveText: 'Your villagers pay more tax',
    passive: {
      stat: 'taxRate', scope: null, op: 'mul',
      base: ab('GildedLedger').passiveBase, perLevel: ab('GildedLedger').passivePerLevel,
    },
    carried: carried('GildedLedger'),
    // No active at all, deliberately: the clearest proof that the SLOT rather
    // than the ability is the constraint.
    active: null,
    source: 'CountingHouse',
  },
  WanderersCompass: {
    id: 'WanderersCompass', name: 'Wanderer’s Compass', glyph: '🧭',
    sprite: 'artifact_wanderers_compass',
    passiveText: 'Delves teach you more',
    passive: {
      stat: 'knowledgeYield', scope: null, op: 'mul',
      base: ab('WanderersCompass').passiveBase, perLevel: ab('WanderersCompass').passivePerLevel,
    },
    carried: carried('WanderersCompass'),
    active: {
      id: 'Beckon', name: 'Beckon', targeted: true,
      manaCost: ab('WanderersCompass').activeManaCost, durationSeconds: 0, radius: 0,
      text: 'Calls a depleted resource back onto a cell you choose',
    },
    source: 'StarObservatory',
  },
};

export const ARTIFACT_ORDER: ArtifactId[] = [
  'DowsingRod', 'VerdantSeal', 'ForemansSigil', 'GildedLedger', 'WanderersCompass',
];

// ------------------------------------------------------------------- ruins

/**
 * A ruin is a repeatable DUNGEON, not a one-time pickup. That is the whole
 * point: revealing one discovers a content node that keeps paying for months,
 * rather than a reward that ends.
 *
 * `depthTime = baseDepthSeconds × depthGrowth^(depth − 1)` — time grows with
 * depth INSIDE a run, not only across tiers, which is what makes "one more
 * depth" a real escalation and naturally caps how far anyone pushes in one
 * sitting.
 */
export interface RuinDef {
  id: RuinId;
  name: string;
  description: string;
  glyph: string;
  sprite: string;
  location: Coord;
  tier: number;
  /** Threat strength at depth 1; each depth raises it. */
  difficulty: number;
  baseDepthSeconds: number;
  depthGrowth: number;
  maxDepth: number;
  /** Flat, paid once at launch — NOT per depth, so the checkpoint decision is
   *  purely risk against reward with nothing else muddying it. */
  supplies: Wallet;
  /** The threat type dominating its depths: a dungeon rewards a COMPOSITION
   *  rather than a single unit. 'Any' rotates. */
  affinity: UnitId | 'Any';
  /** Granted, guaranteed, on the first full clear. No randomness on the thing
   *  that gates a system. */
  artifact: ArtifactId;
}

const ruinContent: Record<RuinId, Pick<RuinDef, 'name' | 'description' | 'glyph' | 'sprite'>> = {
  HollowBarrow: {
    name: 'Hollow Barrow', glyph: '⚱️', sprite: 'ruin_barrow',
    description: 'A grave-mound with the turf still on it. Something down there is awake.',
  },
  SunkenChapel: {
    name: 'Sunken Chapel', glyph: '⛪', sprite: 'ruin_chapel',
    description: 'Half-drowned pews and a bell that rings when nobody is near it.',
  },
  DrownedIronworks: {
    name: 'Drowned Ironworks', glyph: '🏚️', sprite: 'ruin_ironworks',
    description: 'The furnaces went out an age ago. The hammers did not.',
  },
  CountingHouse: {
    name: 'The Counting House', glyph: '🏦', sprite: 'ruin_counting_house',
    description: 'Ledgers stacked to the ceiling, every column still balancing itself.',
  },
  StarObservatory: {
    name: 'Star Observatory', glyph: '🔭', sprite: 'ruin_observatory',
    description: 'A brass eye aimed at a sky that has since moved on.',
  },
};

const ruinBalance = balance.ruins as Record<RuinId, {
  x: number; y: number; tier: number; difficulty: number; baseDepthSeconds: number;
  depthGrowth: number; maxDepth: number; supplies: Wallet; affinity: string; artifact: string;
}>;

export const RUINS: Record<RuinId, RuinDef> = Object.fromEntries(
  (Object.keys(ruinContent) as RuinId[]).map((id) => {
    const b = ruinBalance[id];
    return [id, {
      id,
      ...ruinContent[id],
      location: { x: b.x, y: b.y },
      tier: b.tier,
      difficulty: b.difficulty,
      baseDepthSeconds: b.baseDepthSeconds,
      depthGrowth: b.depthGrowth,
      maxDepth: b.maxDepth,
      supplies: b.supplies,
      affinity: b.affinity as RuinDef['affinity'],
      artifact: b.artifact as ArtifactId,
    }];
  }),
) as Record<RuinId, RuinDef>;

// ------------------------------------------------------------------ heroes

/**
 * A hero is MANDATORY on every expedition, so heroes gate delve throughput as
 * well as capability. One is free at the start; the rest come from the gacha —
 * and a second is a prize twice over: another delve at a time, and coverage of
 * another matchup.
 */
export type HeroTrait =
  | 'PartyDefence' | 'SupplyDiscount' | 'KnowledgeBonus' | 'FragmentBonus' | 'RevealNextDepth';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  glyph: string;
  sprite: string;
  /** Heroes carry a unit type of their own, so the hero choice feeds the same
   *  matchup chart as the troops. */
  unitType: UnitId;
  trait: HeroTrait;
  traitValue: number;
  traitText: string;
  atk: number;
  def: number;
  hp: number;
  atkPerLevel: number;
  defPerLevel: number;
  hpPerLevel: number;
}

const heroContent: Record<HeroId, Pick<HeroDef, 'name' | 'title' | 'glyph' | 'sprite' | 'traitText'>> = {
  Warden: {
    name: 'The Warden', title: 'Shield of the old wall', glyph: '🛡️', sprite: 'hero_warden',
    traitText: 'The whole party fights harder to stay standing (+20% defence)',
  },
  Quartermaster: {
    name: 'The Quartermaster', title: 'Counts every biscuit', glyph: '📦',
    sprite: 'hero_quartermaster',
    traitText: 'Packs light — expeditions cost a quarter less to supply',
  },
  Scholar: {
    name: 'The Scholar', title: 'Reads what the walls say', glyph: '📖', sprite: 'hero_scholar',
    traitText: 'Brings back half again as much Knowledge',
  },
  RelicHunter: {
    name: 'The Relic-hunter', title: 'Knows a good ruin by its smell', glyph: '🗝️',
    sprite: 'hero_relic_hunter',
    traitText: 'Finds half again as many Fragments',
  },
  Scout: {
    // A design piece rather than a stat: it converts the delve's uncertainty
    // from something you endure into something you can buy your way out of,
    // which is exactly what a management game should sell.
    name: 'The Scout', title: 'Goes on ahead', glyph: '🧭', sprite: 'hero_scout',
    traitText: 'Sees what waits at the next depth before you commit to it',
  },
};

const heroBalance = balance.heroes as Record<HeroId, {
  unitType: string; trait: string; traitValue: number;
  atk: number; def: number; hp: number;
  atkPerLevel: number; defPerLevel: number; hpPerLevel: number;
}>;

export const HEROES: Record<HeroId, HeroDef> = Object.fromEntries(
  (Object.keys(heroContent) as HeroId[]).map((id) => {
    const b = heroBalance[id];
    return [id, {
      id,
      ...heroContent[id],
      unitType: b.unitType as UnitId,
      trait: b.trait as HeroTrait,
      traitValue: b.traitValue,
      atk: b.atk, def: b.def, hp: b.hp,
      atkPerLevel: b.atkPerLevel, defPerLevel: b.defPerLevel, hpPerLevel: b.hpPerLevel,
    }];
  }),
) as Record<HeroId, HeroDef>;

export const HERO_ORDER: HeroId[] = [
  'Warden', 'Quartermaster', 'Scholar', 'RelicHunter', 'Scout',
];

/** Delve rewards, the 50% failure bite, and party slots. */
export const DELVE = balance.delve;
export const PARTY = balance.party;
export const GACHA = balance.gacha;
/** Rewarded-ad offers: the cooldown range, the pool fraction that makes one
 *  eligible, and how long the (faked) video runs. */
export const AD = balance.ads;

// ------------------------------------------------------------ the timeline

/**
 * Authored windows. Live-ops content with wall-clock dates, so this lives in
 * hand-written data rather than in the balance workbook: the xlsx is for
 * numbers designers tune, and a season's SCHEDULE is typically server-driven
 * and changed after ship. Magnitudes are still numbers, and they live in the
 * boon table below.
 *
 * The epoch is a fixed Monday rather than each player's start, so the whole
 * world is inside the same window at the same time — which is what makes an
 * event something players can talk to each other about.
 */
export interface EventTemplate {
  id: string;
  startsAt: number;
  durationMs: number;
  /** 0 = a one-off. */
  periodMs: number;
}

const EPOCH_MONDAY = Date.parse('2026-01-05T00:00:00Z');

export const EVENTS: readonly EventTemplate[] = [
  {
    id: 'conjunction',
    startsAt: EPOCH_MONDAY,
    durationMs: 48 * 3_600_000, // 48 hours...
    periodMs: 7 * 86_400_000,   // ...every seven days
  },
];

/**
 * What a Conjunction can be. Every primitive at once: the timeline schedules
 * it, the RNG picks it, a modifier applies it, and the deadline is the
 * pressure.
 *
 * The free-socket boon earns its keep by making this week's loadout decision
 * different from last week's, which is the whole point of an event that
 * returns rather than a one-off gift.
 */
export interface ConjunctionBoon {
  id: string;
  text: string;
  stat: ModifierStat;
  op: 'add' | 'mul';
  value: number;
  /** Paid on OPENING, so showing up inside the window is itself rewarded. */
  knowledge: number;
  gems: number;
}

export const CONJUNCTION_BOONS: readonly ConjunctionBoon[] = [
  {
    id: 'flood', text: 'The leylines run high — Mana gathers twice as fast.',
    stat: 'manaRegen', op: 'mul', value: 2, knowledge: 60, gems: 5,
  },
  {
    id: 'cheapMagic', text: 'Spellwork comes easy — abilities cost half.',
    stat: 'activeCost', op: 'mul', value: 0.5, knowledge: 60, gems: 5,
  },
  {
    id: 'insight', text: 'The old writing makes sense — Knowledge comes three times over.',
    stat: 'knowledgeYield', op: 'mul', value: 3, knowledge: 60, gems: 5,
  },
  {
    id: 'swiftDelves', text: 'The dark is thin — parties move through ruins twice as fast.',
    stat: 'delveSpeed', op: 'mul', value: 0.5, knowledge: 60, gems: 5,
  },
  {
    id: 'lentSocket', text: 'The sky lends you a socket — one extra relic, for now.',
    stat: 'attunementSlots', op: 'add', value: 1, knowledge: 60, gems: 5,
  },
];

export const RUIN_ORDER: RuinId[] = [
  'HollowBarrow', 'SunkenChapel', 'DrownedIronworks', 'CountingHouse', 'StarObservatory',
];

export const GAME_VERSION = '0.1.0';
// v16 predates Mana, artifacts and expeditions. Everything those add is
// ADDITIVE, and every module read in save.ts defaults — so this bump needs no
// migrator, only the version (see Docs/features/engine-seams.md §4).
// v18 predates ad offers. `kingdom.adOffers` is additive and its reader
// defaults, so this bump needs no migrator either.
export const SAVE_VERSION = 19;
