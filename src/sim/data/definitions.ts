// Game data definitions. Identity/content (names, descriptions, glyphs,
// sprites, rules wiring) lives here; every balancing NUMBER comes from
// balance.json, which is generated from the editable balance/*.csv sheets
// (edit those, then run: npm run balance).
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.
//
// MAP content is the exception: terrain, features, landmarks and ruins are
// authored by coordinate, so they live in region-map.json and are edited in
// the map editor (?dev=map), not in the workbook. See Docs/map-editor.md.

import balance from './balance.json';
import regionMap from './region-map.json';
import type { ModifierScope, ModifierStat } from '../modifiers';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, FeatureId, HarvestSourceId, HeroId,
  LandmarkKind, RuinId, StoreSkuId, TechId, TechLineId, TerrainId, TomeId, TrainableId, UnitId,
  Wallet,
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
  /** The Market sells 1 unit for this much Gold; null = not sellable. */
  goldValue: number | null;
}

interface CurrencyBalance {
  cap: number | null; start: number; primary?: boolean;
  goldValue?: number | null;
}
const currency = (scope: CurrencyDef['scope'], b: CurrencyBalance): CurrencyDef => ({
  scope,
  cap: b.cap,
  start: b.start,
  primary: b.primary ?? false,
  goldValue: b.goldValue ?? null,
});

// Object order = header widget order AND the Market's sell order.
export const CURRENCIES: Record<CurrencyId, CurrencyDef> = {
  Gold: currency('city', balance.currencies.Gold),
  Food: currency('city', balance.currencies.Food),
  Wood: currency('city', balance.currencies.Wood),
  Stone: currency('city', balance.currencies.Stone),
  // Mana's ceiling is DYNAMIC (Townhall level + Sanctum levels), so its `cap`
  // column stays blank and sim/mana.ts owns the real number.
  Mana: currency('city', balance.currencies.Mana),
  // Both are kingdom-scoped, and for the same reason: they outlive the city
  // that earned them. Knowledge is the research clock — a technology is
  // something the KINGDOM knows, and contested world-map landmarks pay
  // Knowledge lumps, which a city purse could not coherently receive.
  // Stardust is the collection currency. They swapped jobs on 2026-09-03 —
  // Docs/features/07-research.md §4.
  Knowledge: currency('kingdom', balance.currencies.Knowledge),
  Stardust: currency('kingdom', balance.currencies.Stardust),
  Gems: currency('player', balance.currencies.Gems),
};

// -------------------------------------------------------------- harvest loop

export interface HarvestSpec {
  /** Which kind of cell this is. Distinct from `currencyId`, which is what it
   *  PAYS — bushes, game and shoals all pay Food, veins pay Stone — and the
   *  key the cell-scoped upgrades (Butchery, Big Nets, Iron Picks) hang on. */
  id: HarvestSourceId;
  currencyId: CurrencyId;
  /** Units one extraction takes — the CHUNK. Raised by this cell's abundance
   *  upgrade, and it lifts the tap and the worker alike, because both draw
   *  from the same depot. */
  unitsPerStrike: number;
  /** Seconds one extraction takes — the RHYTHM. Together with the chunk this
   *  is the cell's rate, and it is what a tap is priced against: a tap pays
   *  `tap.workSeconds` of it. Iron as three units every sixty seconds is a
   *  heavy swing; crops as one every eight is a light tick. */
  secondsPerStrike: number;
  /** Units the cell holds when full — the BURST. 0 = bedrock: never runs
   *  down, never recovers, keeps no cell state at all. */
  stock: number;
  /** Seconds to recover after emptying; 0 = FINITE — the feature is
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
  id: HarvestSourceId,
  currencyId: CurrencyId,
  b: Omit<HarvestSpec, 'id' | 'currencyId' | 'requiredTech'> & { requiredTech: unknown },
): HarvestSpec =>
  ({ ...b, id, currencyId, requiredTech: (b.requiredTech ?? null) as TechId | null });

// A cell's IDENTITY and the currency it pays are two different things. Berry
// bushes, game and shoals are all Food at different rates — the bush is worth
// 1 a tap, an animal 3, a shoal 2 — and an iron vein is a rich Stone node at 3
// a tap. That is where the old Berries/Meat/Fish/Iron wallet rows went: the
// map keeps its texture, the purse stops carrying four rows to express it.
export const HARVEST: Record<HarvestSourceId, HarvestSpec> = {
  Forest: harvest('Forest', 'Wood', balance.harvest.Forest),
  Crops: harvest('Crops', 'Food', balance.harvest.Crops),
  Berries: harvest('Berries', 'Food', balance.harvest.Berries),
  Meat: harvest('Meat', 'Food', balance.harvest.Meat),
  Stone: harvest('Stone', 'Stone', balance.harvest.Stone),
  Fish: harvest('Fish', 'Food', balance.harvest.Fish),
  // The two metal mountains. Iron is bare rock at FIVE times the yield —
  // the same material, worth the walk. Gold is the first thing on the map
  // outside a lived-in house that pays the city's money.
  MountainIron: harvest('MountainIron', 'Stone', balance.harvest.MountainIron),
  MountainGold: harvest('MountainGold', 'Gold', balance.harvest.MountainGold),
};

/**
 * What the ground under a cell does to what comes out of it.
 *
 * A multiplier per currency, and it scales the cell's **STOCK** — how much is
 * in the ground — rather than what a single extraction takes. That is forced
 * rather than chosen: a chunk is 1 unit on most cells, and 1 x 0.75 rounds
 * straight back to 1, so a percentage on the chunk is a no-op. Stock runs
 * 5 to 30, which has room for a quarter either way in whole units.
 *
 * It therefore applies to the thumb and the crew alike and needs no second
 * set of books, because both draw the same depot.
 *
 * Blank = 1. Water is authored at 1 deliberately: fish shoals sit on it and
 * pay Food, and a fishing multiplier is not what anybody asked for.
 */
export const TERRAIN_YIELD = balance.terrain as
  Record<TerrainId, Partial<Record<CurrencyId, number>>>;

/** The ground's multiplier on this currency; 1 for anything unauthored. */
export const terrainYield = (terrain: TerrainId, currency: CurrencyId): number =>
  TERRAIN_YIELD[terrain]?.[currency] ?? 1;

// Worker travel. There is no global work time any more: how long an
// extraction takes is a property of the CELL (`secondsPerStrike`), which is
// what lets a farm plot be fast and thirsty where an iron mountain is slow.
export const WORKER = balance.worker;

// Player collect taps: cooldown between collects (upgradeable later).
export const TAP = balance.tap;

// Buying time with Gems: seconds of a build or training line one Gem finishes.
export const RUSH = balance.rush;


// Villager training at the Townhall. There is no tap that hurries it: a queue
// is a FIXED duration and a tap is a scaling one, so a maxed thumb would
// finish a villager in one press. A timer is hurried with Gems, not Mana.
export const TRAINING = balance.training;

// Passive taxes: gold per housed villager per minute (boostable by
// TradeRoutes); tapping a lived-in house sells `tap.workSeconds` of its own
// rent forward, bounded by the Mana pool and nothing else.
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
  | 'CollectResource' | 'CollectTaps' | 'DiscoverCells' | 'DiscoverFeature' | 'SellGoods'
  | 'ClaimLandmarks' | 'ReachDepth' | 'ClearRuins' | 'OwnArtifacts'
  | 'OwnHeroes';

export const RELATIVE_QUEST_TYPES: ReadonlySet<QuestGoalType> =
  new Set([
    'CollectResource', 'CollectTaps', 'DiscoverCells', 'DiscoverFeature', 'SellGoods',
  ]);

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
  rewardStardust: number;
  /** The research clock, seeded by the chain before the first landmark drips
   *  (07-research.md §3). */
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
  /** Every source this building sends workers after; empty = it harvests
   *  nothing. A LIST because the Mine goes after two different mountains —
   *  iron pays Stone and gold pays Gold, so they cannot share a spec — and
   *  the same reason `trains` is a list for the military halls. */
  harvestSources: readonly HarvestSourceId[];
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
  /** One more of this district may stand once this technology is done. */
  extraCountTech: TechId | null;
  /** Army cap this building contributes at each level (TOTAL, not
   *  incremental). Empty = it is not a military building. */
  armyCapPerLevel: readonly number[];
  /** Everything this building can turn out; empty = it trains nothing. A list
   *  rather than one id, so a hall can offer a choice — and so the Townhall
   *  can offer the Villager on the same footing. Army size is a
   *  city-building decision now, so wanting Cavalry means finding room for
   *  Stables — which is the strongest link between the two halves of the game. */
  trains: readonly TrainableId[];
}

// Numbers (costs, times, caps, sizes, radii) come from balance/*.csv via
// balance.json; only identity, art, and rules wiring is authored here.
const rules = {
  buildable: true, harvestSources: [], providesHarvestSource: null, requiredTech: null,
  trains: [],
} as const;

/** The per-level tech gates arrive from JSON as plain strings — the importer
 *  already validated them against the tech id list. */
const districtBalance = <B extends {
  requiredTechPerLevel: readonly (string | null)[]; extraCountTech: string | null;
}>(
  b: B,
): Omit<B, 'requiredTechPerLevel' | 'extraCountTech'>
  & { requiredTechPerLevel: readonly (TechId | null)[]; extraCountTech: TechId | null } =>
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
    // The Townhall is a trainer like any other hall; the Villager is simply
    // what it turns out.
    trains: ['Villager'],
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
    harvestSources: ['Crops'],
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
    harvestSources: ['Forest'],
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
    description: 'Sends workers into every mountain within its area of influence — bare rock and metal alike.',
    glyph: '⛏️',
    sprite: 'quarry',
    harvestSources: ['Stone', 'MountainIron', 'MountainGold'],
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
    harvestSources: ['Fish'],
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
    requiredTech: 'Consecration',
    ...districtBalance(balance.districts.Sanctum),
  },
  Barracks: {
    ...rules,
    id: 'Barracks',
    name: 'Barracks',
    description: 'Drills foot soldiers, and every level lets you keep a bigger army.',
    glyph: '🛖',
    sprite: 'barracks',
    requiredTech: 'Warrior',
    // The Barracks turns out every foot soldier; each is still behind its own
    // technology, so the row fills in as the player researches. The Spear Hall
    // and Shooting Grounds keep their specialty as well — a second hall is a
    // second PARALLEL line and more army cap, not a different roster.
    trains: ['Warrior', 'Lancer', 'Archer'],
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
    trains: ['Lancer'],
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
    trains: ['Archer'],
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
    trains: ['Cavalry'],
    ...districtBalance(balance.districts.Stables),
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] = [
  'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Quarry', 'Docks', 'Market',
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
  // A mountain is where Stone comes from, and the Quarry works every one in
  // range exactly as the Sawmill works every forest. It replaced the `Rocks`
  // feature and the `Mountain` TERRAIN at once: the ground under a peak is
  // ordinary, and what makes the cell unbuildable is the feature sitting on
  // it — which `placementBlock` already refused before this existed.
  Mountain: {
    id: 'Mountain', name: 'Mountain', glyph: '🏔️', exhaustedGlyph: '🧱',
    sprite: 'mountain', source: 'Stone', respawnTerrain: 'Grassland',
  },
  MountainIron: {
    id: 'MountainIron', name: 'Iron mountain', glyph: '⛰️', exhaustedGlyph: '🕳️',
    sprite: 'mountain_iron', source: 'MountainIron', respawnTerrain: 'Grassland',
  },
  MountainGold: {
    id: 'MountainGold', name: 'Gold mountain', glyph: '🏔️', exhaustedGlyph: '🕳️',
    sprite: 'mountain_gold', source: 'MountainGold', respawnTerrain: 'Grassland',
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

// rings: authored distance → total Gold cost to clear one cell at that ring.
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
  /** Which tome this sits in, and how deep. The shelf IS the layout now:
   *  three bounded pages instead of one unbounded canvas
   *  (Docs/features/07-research.md §2). */
  tome: TomeId;
  era: number;
  /** Hand-authored position ON ITS TOME'S PAGE (the layout is content). NULL
   *  for a minor rank: it is drawn as a bead under its line's parent, so
   *  there is no position to author. */
  node: { x: number; y: number } | null;
  cost: Wallet; // city currencies
  durationSeconds: number;
  requires: TechId[]; // tree edges — all must be completed first
  /** Set on a MINOR rank; null on a major. Ranks of one line share it. */
  line: TechLineId | null;
  /** What one completed rank of this line adds. 0 on a major. */
  effectPerRank: number;
  /** On the tree for its shape; does nothing yet. Badged, and never required
   *  by a keystone (tech-tree.md §7). */
  planned: boolean;
}

const tech = (
  content: Pick<TechnologyDef, 'id' | 'name' | 'description' | 'glyph'>,
  b: {
    cost: Wallet; durationSeconds: number; requires: unknown;
    line: string | null; effectPerRank: number;
    tome: string; era: number; node: { x: number; y: number } | null; planned: boolean;
  },
): TechnologyDef => ({
  ...content, cost: b.cost, durationSeconds: b.durationSeconds,
  requires: b.requires as TechId[],
  line: b.line as TechLineId | null, effectPerRank: b.effectPerRank,
  tome: b.tome as TomeId, era: b.era, node: b.node, planned: b.planned,
});

// Four branches out of Forestry (Docs/features/07-research.md §2.2): CIVICS up,
// ECONOMICS left (farm row 0, stone row −1), EXPLORATION right, MILITARY down.
// Cells (−1,0) and (1,0) stay EMPTY on purpose: the branch trunks route their
// elbows through them, so no connector ever crosses another node.
export const TECHNOLOGIES: Record<TechId, TechnologyDef> = {
  CharterI: tech({
    id: 'CharterI',
    name: 'Charter I',
    description: 'The city charter. Each seal on it lets the Townhall stand a level higher — and the Townhall is what every other building asks permission from.',
    glyph: '📜',
  }, balance.technologies.CharterI),
  CharterII: tech({
    id: 'CharterII',
    name: 'Charter II',
    description: 'The city charter. Each seal on it lets the Townhall stand a level higher — and the Townhall is what every other building asks permission from.',
    glyph: '📜',
  }, balance.technologies.CharterII),
  CharterIII: tech({
    id: 'CharterIII',
    name: 'Charter III',
    description: 'The city charter. Each seal on it lets the Townhall stand a level higher — and the Townhall is what every other building asks permission from.',
    glyph: '📜',
  }, balance.technologies.CharterIII),
  CharterIV: tech({
    id: 'CharterIV',
    name: 'Charter IV',
    description: 'The city charter. Each seal on it lets the Townhall stand a level higher — and the Townhall is what every other building asks permission from.',
    glyph: '📜',
  }, balance.technologies.CharterIV),
  Forestry: tech({
    id: 'Forestry',
    name: 'Forestry',
    description: 'Axes and foraging — you can work the woods and berry bushes around you.',
    glyph: '🪓',
  }, balance.technologies.Forestry),
  UrbanPlanning: tech({
    id: 'UrbanPlanning',
    name: 'Urban Planning',
    description: 'Ordered streets — Housing reaches level 2.',
    glyph: '🏘️',
  }, balance.technologies.UrbanPlanning),
  Saws: tech({
    id: 'Saws',
    name: 'Saws',
    description: 'Unlocks the Sawmill — its workers chop nearby forests for you.',
    glyph: '🪚',
  }, balance.technologies.Saws),
  Agriculture: tech({
    id: 'Agriculture',
    name: 'Agriculture',
    description: 'Unlocks crop plots and the Farm that works them.',
    glyph: '🌱',
  }, balance.technologies.Agriculture),
  Masonry: tech({
    id: 'Masonry',
    name: 'Masonry',
    description: 'Unlocks the Quarry — its workers cut Stone from the mountains, bare rock and metal alike.',
    glyph: '🧱',
  }, balance.technologies.Masonry),
  Communities: tech({
    id: 'Communities',
    name: 'Communities',
    description: 'Tighter neighborhoods — every Housing holds +1 resident.',
    glyph: '👥',
  }, balance.technologies.Communities),
  Hunting: tech({
    id: 'Hunting',
    name: 'Hunting',
    description: 'Snares and spears — you can take the wild game on the plains.',
    glyph: '🏹',
  }, balance.technologies.Hunting),
  Farming: tech({
    id: 'Farming',
    name: 'Farming',
    description: 'Deeper furrows — the Farm reaches level 2.',
    glyph: '🚜',
  }, balance.technologies.Farming),
  Market: tech({
    id: 'Market',
    name: 'Market',
    description: 'Organized trade — unlocks the Market building.',
    glyph: '🤝',
  }, balance.technologies.Market),
  Mining: tech({
    id: 'Mining',
    name: 'Mining',
    description: 'Picks and braces — the iron mountains give up their metal, the army\'s Stone.',
    glyph: '⛏️',
  }, balance.technologies.Mining),
  Architecture: tech({
    id: 'Architecture',
    name: 'Architecture',
    description: 'Iron-braced monuments — the Townhall reaches level 3.',
    glyph: '📐',
  }, balance.technologies.Architecture),
  Engineering: tech({
    id: 'Engineering',
    name: 'Engineering',
    description: 'Cranes and gears — Quarry level 2 and Sawmill level 3.',
    glyph: '⚙️',
  }, balance.technologies.Engineering),
  DeepMining: tech({
    id: 'DeepMining',
    name: 'Deep Mining',
    description: 'Braced shafts — the gold mountains can be worked.',
    glyph: '🕯️',
  }, balance.technologies.DeepMining),
  WarbandI: tech({
    id: 'WarbandI',
    name: 'Warband I',
    description: 'Marching order. Each banner raised lets the four halls train a rank higher, and a bigger hall is a bigger army.',
    glyph: '🚩',
  }, balance.technologies.WarbandI),
  WarbandII: tech({
    id: 'WarbandII',
    name: 'Warband II',
    description: 'Marching order. Each banner raised lets the four halls train a rank higher, and a bigger hall is a bigger army.',
    glyph: '🚩',
  }, balance.technologies.WarbandII),
  WarbandIII: tech({
    id: 'WarbandIII',
    name: 'Warband III',
    description: 'Marching order. Each banner raised lets the four halls train a rank higher, and a bigger hall is a bigger army.',
    glyph: '🚩',
  }, balance.technologies.WarbandIII),
  WarbandIV: tech({
    id: 'WarbandIV',
    name: 'Warband IV',
    description: 'Marching order. Each banner raised lets the four halls train a rank higher, and a bigger hall is a bigger army.',
    glyph: '🚩',
  }, balance.technologies.WarbandIV),
  Warrior: tech({
    id: 'Warrior',
    name: 'Warrior',
    description: 'Unlocks the Warrior — a sturdy front line for your army.',
    glyph: '🗡️',
  }, balance.technologies.Warrior),
  Spears: tech({
    id: 'Spears',
    name: 'Spears',
    description: 'Unlocks the Lancer — long reach that keeps the line safe.',
    glyph: '🔱',
  }, balance.technologies.Spears),
  Archery: tech({
    id: 'Archery',
    name: 'Archery',
    description: 'Unlocks the Archer — ranged support for your army.',
    glyph: '🏹',
  }, balance.technologies.Archery),
  Cavalry: tech({
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Unlocks the Cavalry — fast, hard-hitting mounted units.',
    glyph: '🐎',
  }, balance.technologies.Cavalry),
  AttunementI: tech({
    id: 'AttunementI',
    name: 'Attunement I',
    description: 'Communion with the land. Each degree of it lets the Sanctum hold a level more, and the Sanctum is where Mana comes from.',
    glyph: '🔯',
  }, balance.technologies.AttunementI),
  AttunementII: tech({
    id: 'AttunementII',
    name: 'Attunement II',
    description: 'Communion with the land. Each degree of it lets the Sanctum hold a level more, and the Sanctum is where Mana comes from.',
    glyph: '🔯',
  }, balance.technologies.AttunementII),
  AttunementIII: tech({
    id: 'AttunementIII',
    name: 'Attunement III',
    description: 'Communion with the land. Each degree of it lets the Sanctum hold a level more, and the Sanctum is where Mana comes from.',
    glyph: '🔯',
  }, balance.technologies.AttunementIII),
  AttunementIV: tech({
    id: 'AttunementIV',
    name: 'Attunement IV',
    description: 'Communion with the land. Each degree of it lets the Sanctum hold a level more, and the Sanctum is where Mana comes from.',
    glyph: '🔯',
  }, balance.technologies.AttunementIV),
  Cartography: tech({
    id: 'Cartography',
    name: 'Cartography',
    description: 'Survey and chart — every tap on the fog counts double. Opens the water.',
    glyph: '🗺️',
  }, balance.technologies.Cartography),
  Consecration: tech({
    id: 'Consecration',
    name: 'Consecration',
    description: 'Unlocks the Sanctum — the well the kingdom draws its Mana from.',
    glyph: '🔯',
  }, balance.technologies.Consecration),
  Sailing: tech({
    id: 'Sailing',
    name: 'Sailing',
    description: 'Rafts and rigging — sea cells can be explored.',
    glyph: '⛵',
  }, balance.technologies.Sailing),
  ScalingTools: tech({
    id: 'ScalingTools',
    name: 'Scaling Tools',
    description: 'Ropes and pitons — the surveyors reach the high ground. Pitons, Vigils and Farsight build on it.',
    glyph: '🧗',
  }, balance.technologies.ScalingTools),
  Fishing: tech({
    id: 'Fishing',
    name: 'Fishing',
    description: 'Unlocks the Docks — send fishing boats out for Fish (worth 1 Food each).',
    glyph: '🎣',
  }, balance.technologies.Fishing),
  Shipbuilding: tech({
    id: 'Shipbuilding',
    name: 'Shipbuilding',
    description: 'Sturdier hulls — the Docks reach level 2.',
    glyph: '🛶',
  }, balance.technologies.Shipbuilding),
  TapPowerI: tech({
    id: 'TapPowerI',
    name: 'Tap Power I',
    description: '+1 resource per collect tap',
    glyph: '👆',
  }, balance.technologies.TapPowerI),
  TapPowerII: tech({
    id: 'TapPowerII',
    name: 'Tap Power II',
    description: '+1 resource per collect tap',
    glyph: '👆',
  }, balance.technologies.TapPowerII),
  TapPowerIII: tech({
    id: 'TapPowerIII',
    name: 'Tap Power III',
    description: '+1 resource per collect tap',
    glyph: '👆',
  }, balance.technologies.TapPowerIII),
  TapPowerIV: tech({
    id: 'TapPowerIV',
    name: 'Tap Power IV',
    description: '+1 resource per collect tap',
    glyph: '👆',
  }, balance.technologies.TapPowerIV),
  TapPowerV: tech({
    id: 'TapPowerV',
    name: 'Tap Power V',
    description: '+1 resource per collect tap',
    glyph: '👆',
  }, balance.technologies.TapPowerV),
  QuickHandsI: tech({
    id: 'QuickHandsI',
    name: 'Quick Hands I',
    description: '−0.05s between auto-taps while holding',
    glyph: '⚡',
  }, balance.technologies.QuickHandsI),
  QuickHandsII: tech({
    id: 'QuickHandsII',
    name: 'Quick Hands II',
    description: '−0.05s between auto-taps while holding',
    glyph: '⚡',
  }, balance.technologies.QuickHandsII),
  QuickHandsIII: tech({
    id: 'QuickHandsIII',
    name: 'Quick Hands III',
    description: '−0.05s between auto-taps while holding',
    glyph: '⚡',
  }, balance.technologies.QuickHandsIII),
  QuickHandsIV: tech({
    id: 'QuickHandsIV',
    name: 'Quick Hands IV',
    description: '−0.05s between auto-taps while holding',
    glyph: '⚡',
  }, balance.technologies.QuickHandsIV),
  QuickHandsV: tech({
    id: 'QuickHandsV',
    name: 'Quick Hands V',
    description: '−0.05s between auto-taps while holding',
    glyph: '⚡',
  }, balance.technologies.QuickHandsV),
  WorkerLoadI: tech({
    id: 'WorkerLoadI',
    name: 'Worker Load I',
    description: '+1 resource per worker delivery',
    glyph: '🎒',
  }, balance.technologies.WorkerLoadI),
  WorkerLoadII: tech({
    id: 'WorkerLoadII',
    name: 'Worker Load II',
    description: '+1 resource per worker delivery',
    glyph: '🎒',
  }, balance.technologies.WorkerLoadII),
  WorkerLoadIII: tech({
    id: 'WorkerLoadIII',
    name: 'Worker Load III',
    description: '+1 resource per worker delivery',
    glyph: '🎒',
  }, balance.technologies.WorkerLoadIII),
  SawpitsI: tech({
    id: 'SawpitsI',
    name: 'Sawpits I',
    description: '+1 Wood per worker delivery',
    glyph: '🪵',
  }, balance.technologies.SawpitsI),
  SawpitsII: tech({
    id: 'SawpitsII',
    name: 'Sawpits II',
    description: '+1 Wood per worker delivery',
    glyph: '🪵',
  }, balance.technologies.SawpitsII),
  SawpitsIII: tech({
    id: 'SawpitsIII',
    name: 'Sawpits III',
    description: '+1 Wood per worker delivery',
    glyph: '🪵',
  }, balance.technologies.SawpitsIII),
  ButcheryI: tech({
    id: 'ButcheryI',
    name: 'Butchery I',
    description: '+1 Food per tap on game',
    glyph: '🍖',
  }, balance.technologies.ButcheryI),
  ButcheryII: tech({
    id: 'ButcheryII',
    name: 'Butchery II',
    description: '+1 Food per tap on game',
    glyph: '🍖',
  }, balance.technologies.ButcheryII),
  ButcheryIII: tech({
    id: 'ButcheryIII',
    name: 'Butchery III',
    description: '+1 Food per tap on game',
    glyph: '🍖',
  }, balance.technologies.ButcheryIII),
  IrrigationI: tech({
    id: 'IrrigationI',
    name: 'Irrigation I',
    description: '+1 Food per delivery from a farm',
    glyph: '💧',
  }, balance.technologies.IrrigationI),
  IrrigationII: tech({
    id: 'IrrigationII',
    name: 'Irrigation II',
    description: '+1 Food per delivery from a farm',
    glyph: '💧',
  }, balance.technologies.IrrigationII),
  IrrigationIII: tech({
    id: 'IrrigationIII',
    name: 'Irrigation III',
    description: '+1 Food per delivery from a farm',
    glyph: '💧',
  }, balance.technologies.IrrigationIII),
  ScythesI: tech({
    id: 'ScythesI',
    name: 'Scythes I',
    description: '+1 Food per tap on a crop plot',
    glyph: '🌾',
  }, balance.technologies.ScythesI),
  ScythesII: tech({
    id: 'ScythesII',
    name: 'Scythes II',
    description: '+1 Food per tap on a crop plot',
    glyph: '🌾',
  }, balance.technologies.ScythesII),
  ScythesIII: tech({
    id: 'ScythesIII',
    name: 'Scythes III',
    description: '+1 Food per tap on a crop plot',
    glyph: '🌾',
  }, balance.technologies.ScythesIII),
  SurveyingI: tech({
    id: 'SurveyingI',
    name: 'Surveying I',
    description: '+1 Gold of reveal progress per tap on the fog',
    glyph: '🧭',
  }, balance.technologies.SurveyingI),
  SurveyingII: tech({
    id: 'SurveyingII',
    name: 'Surveying II',
    description: '+1 Gold of reveal progress per tap on the fog',
    glyph: '🧭',
  }, balance.technologies.SurveyingII),
  PitonsI: tech({
    id: 'PitonsI',
    name: 'Pitons I',
    description: '−10% Gold to clear a cell of fog',
    glyph: '⛏️',
  }, balance.technologies.PitonsI),
  PitonsII: tech({
    id: 'PitonsII',
    name: 'Pitons II',
    description: '−10% Gold to clear a cell of fog',
    glyph: '⛏️',
  }, balance.technologies.PitonsII),
  MarketStallI: tech({
    id: 'MarketStallI',
    name: 'Market Stall I',
    description: '+5% Market sale prices',
    glyph: '🛒',
  }, balance.technologies.MarketStallI),
  MarketStallII: tech({
    id: 'MarketStallII',
    name: 'Market Stall II',
    description: '+5% Market sale prices',
    glyph: '🛒',
  }, balance.technologies.MarketStallII),
  MarketStallIII: tech({
    id: 'MarketStallIII',
    name: 'Market Stall III',
    description: '+5% Market sale prices',
    glyph: '🛒',
  }, balance.technologies.MarketStallIII),
  MarketStallIV: tech({
    id: 'MarketStallIV',
    name: 'Market Stall IV',
    description: '+5% Market sale prices',
    glyph: '🛒',
  }, balance.technologies.MarketStallIV),
  TradeRoutesI: tech({
    id: 'TradeRoutesI',
    name: 'Trade Routes I',
    description: '+10% tax income',
    glyph: '⛵',
  }, balance.technologies.TradeRoutesI),
  TradeRoutesII: tech({
    id: 'TradeRoutesII',
    name: 'Trade Routes II',
    description: '+10% tax income',
    glyph: '⛵',
  }, balance.technologies.TradeRoutesII),
  TradeRoutesIII: tech({
    id: 'TradeRoutesIII',
    name: 'Trade Routes III',
    description: '+10% tax income',
    glyph: '⛵',
  }, balance.technologies.TradeRoutesIII),
  TradeRoutesIV: tech({
    id: 'TradeRoutesIV',
    name: 'Trade Routes IV',
    description: '+10% tax income',
    glyph: '⛵',
  }, balance.technologies.TradeRoutesIV),
  TradeRoutesV: tech({
    id: 'TradeRoutesV',
    name: 'Trade Routes V',
    description: '+10% tax income',
    glyph: '⛵',
  }, balance.technologies.TradeRoutesV),
  StonecuttingI: tech({
    id: 'StonecuttingI',
    name: 'Stonecutting I',
    description: '+1 Stone per worker delivery',
    glyph: '🪨',
  }, balance.technologies.StonecuttingI),
  StonecuttingII: tech({
    id: 'StonecuttingII',
    name: 'Stonecutting II',
    description: '+1 Stone per worker delivery',
    glyph: '🪨',
  }, balance.technologies.StonecuttingII),
  StonecuttingIII: tech({
    id: 'StonecuttingIII',
    name: 'Stonecutting III',
    description: '+1 Stone per worker delivery',
    glyph: '🪨',
  }, balance.technologies.StonecuttingIII),
  BigNetsI: tech({
    id: 'BigNetsI',
    name: 'Big Nets I',
    description: '+1 Food per delivery from a shoal',
    glyph: '🕸️',
  }, balance.technologies.BigNetsI),
  BigNetsII: tech({
    id: 'BigNetsII',
    name: 'Big Nets II',
    description: '+1 Food per delivery from a shoal',
    glyph: '🕸️',
  }, balance.technologies.BigNetsII),
  BigNetsIII: tech({
    id: 'BigNetsIII',
    name: 'Big Nets III',
    description: '+1 Food per delivery from a shoal',
    glyph: '🕸️',
  }, balance.technologies.BigNetsIII),
  IronPicksI: tech({
    id: 'IronPicksI',
    name: 'Iron Picks I',
    description: '+1 Stone per delivery from a vein',
    glyph: '⛏️',
  }, balance.technologies.IronPicksI),
  IronPicksII: tech({
    id: 'IronPicksII',
    name: 'Iron Picks II',
    description: '+1 Stone per delivery from a vein',
    glyph: '⛏️',
  }, balance.technologies.IronPicksII),
  IronPicksIII: tech({
    id: 'IronPicksIII',
    name: 'Iron Picks III',
    description: '+1 Stone per delivery from a vein',
    glyph: '⛏️',
  }, balance.technologies.IronPicksIII),
  ResonanceI: tech({
    id: 'ResonanceI',
    name: 'Resonance I',
    description: '−20% Mana to cast a relic',
    glyph: '🔔',
  }, balance.technologies.ResonanceI),
  ResonanceII: tech({
    id: 'ResonanceII',
    name: 'Resonance II',
    description: '−20% Mana to cast a relic',
    glyph: '🔔',
  }, balance.technologies.ResonanceII),
  CarpentryI: tech({
    id: 'CarpentryI',
    name: 'Carpentry I',
    description: '−5% time to raise or upgrade a building',
    glyph: '🧰',
  }, balance.technologies.CarpentryI),
  CarpentryII: tech({
    id: 'CarpentryII',
    name: 'Carpentry II',
    description: '−5% time to raise or upgrade a building',
    glyph: '🧰',
  }, balance.technologies.CarpentryII),
  CarpentryIII: tech({
    id: 'CarpentryIII',
    name: 'Carpentry III',
    description: '−5% time to raise or upgrade a building',
    glyph: '🧰',
  }, balance.technologies.CarpentryIII),
  ScrivenersI: tech({
    id: 'ScrivenersI',
    name: 'Scriveners I',
    description: '−5% time to complete a research',
    glyph: '✒️',
  }, balance.technologies.ScrivenersI),
  ScrivenersII: tech({
    id: 'ScrivenersII',
    name: 'Scriveners II',
    description: '−5% time to complete a research',
    glyph: '✒️',
  }, balance.technologies.ScrivenersII),
  ScrivenersIII: tech({
    id: 'ScrivenersIII',
    name: 'Scriveners III',
    description: '−5% time to complete a research',
    glyph: '✒️',
  }, balance.technologies.ScrivenersIII),
  CartageI: tech({
    id: 'CartageI',
    name: 'Cartage I',
    description: '+5% worker walking speed',
    glyph: '🐂',
  }, balance.technologies.CartageI),
  CartageII: tech({
    id: 'CartageII',
    name: 'Cartage II',
    description: '+5% worker walking speed',
    glyph: '🐂',
  }, balance.technologies.CartageII),
  CartageIII: tech({
    id: 'CartageIII',
    name: 'Cartage III',
    description: '+5% worker walking speed',
    glyph: '🐂',
  }, balance.technologies.CartageIII),
  DeepWellsI: tech({
    id: 'DeepWellsI',
    name: 'Deep Wells I',
    description: '+10 to the Mana the kingdom can hold',
    glyph: '⚗️',
  }, balance.technologies.DeepWellsI),
  DeepWellsII: tech({
    id: 'DeepWellsII',
    name: 'Deep Wells II',
    description: '+10 to the Mana the kingdom can hold',
    glyph: '⚗️',
  }, balance.technologies.DeepWellsII),
  DeepWellsIII: tech({
    id: 'DeepWellsIII',
    name: 'Deep Wells III',
    description: '+10 to the Mana the kingdom can hold',
    glyph: '⚗️',
  }, balance.technologies.DeepWellsIII),
  DeepWellsIV: tech({
    id: 'DeepWellsIV',
    name: 'Deep Wells IV',
    description: '+10 to the Mana the kingdom can hold',
    glyph: '⚗️',
  }, balance.technologies.DeepWellsIV),
  DeepWellsV: tech({
    id: 'DeepWellsV',
    name: 'Deep Wells V',
    description: '+10 to the Mana the kingdom can hold',
    glyph: '⚗️',
  }, balance.technologies.DeepWellsV),
  LeyTapsI: tech({
    id: 'LeyTapsI',
    name: 'Ley Taps I',
    description: '+1 Mana per hour from every claimed landmark',
    glyph: '🔷',
  }, balance.technologies.LeyTapsI),
  LeyTapsII: tech({
    id: 'LeyTapsII',
    name: 'Ley Taps II',
    description: '+1 Mana per hour from every claimed landmark',
    glyph: '🔷',
  }, balance.technologies.LeyTapsII),
  LeyTapsIII: tech({
    id: 'LeyTapsIII',
    name: 'Ley Taps III',
    description: '+1 Mana per hour from every claimed landmark',
    glyph: '🔷',
  }, balance.technologies.LeyTapsIII),
  WaypostsI: tech({
    id: 'WaypostsI',
    name: 'Wayposts I',
    description: '+1 Knowledge per hour from every claimed landmark',
    glyph: '🪧',
  }, balance.technologies.WaypostsI),
  WaypostsII: tech({
    id: 'WaypostsII',
    name: 'Wayposts II',
    description: '+1 Knowledge per hour from every claimed landmark',
    glyph: '🪧',
  }, balance.technologies.WaypostsII),
  WaypostsIII: tech({
    id: 'WaypostsIII',
    name: 'Wayposts III',
    description: '+1 Knowledge per hour from every claimed landmark',
    glyph: '🪧',
  }, balance.technologies.WaypostsIII),
  ScriptoriumI: tech({
    id: 'ScriptoriumI',
    name: 'Scriptorium I',
    description: '+5% to the Knowledge the land teaches you',
    glyph: '📖',
  }, balance.technologies.ScriptoriumI),
  ScriptoriumII: tech({
    id: 'ScriptoriumII',
    name: 'Scriptorium II',
    description: '+5% to the Knowledge the land teaches you',
    glyph: '📖',
  }, balance.technologies.ScriptoriumII),
  ScriptoriumIII: tech({
    id: 'ScriptoriumIII',
    name: 'Scriptorium III',
    description: '+5% to the Knowledge the land teaches you',
    glyph: '📖',
  }, balance.technologies.ScriptoriumIII),
  VigilsI: tech({
    id: 'VigilsI',
    name: 'Vigils I',
    description: '+1 Knowledge per hour from every cleared ruin',
    glyph: '🔥',
  }, balance.technologies.VigilsI),
  VigilsII: tech({
    id: 'VigilsII',
    name: 'Vigils II',
    description: '+1 Knowledge per hour from every cleared ruin',
    glyph: '🔥',
  }, balance.technologies.VigilsII),
  VigilsIII: tech({
    id: 'VigilsIII',
    name: 'Vigils III',
    description: '+1 Knowledge per hour from every cleared ruin',
    glyph: '🔥',
  }, balance.technologies.VigilsIII),
  PilgrimageI: tech({
    id: 'PilgrimageI',
    name: 'Pilgrimage I',
    description: '−5% Gold to claim a landmark',
    glyph: '🚶',
  }, balance.technologies.PilgrimageI),
  PilgrimageII: tech({
    id: 'PilgrimageII',
    name: 'Pilgrimage II',
    description: '−5% Gold to claim a landmark',
    glyph: '🚶',
  }, balance.technologies.PilgrimageII),
  PilgrimageIII: tech({
    id: 'PilgrimageIII',
    name: 'Pilgrimage III',
    description: '−5% Gold to claim a landmark',
    glyph: '🚶',
  }, balance.technologies.PilgrimageIII),
  ProspectingI: tech({
    id: 'ProspectingI',
    name: 'Prospecting I',
    description: '+5% Stardust carried out of a ruin',
    glyph: '💫',
  }, balance.technologies.ProspectingI),
  ProspectingII: tech({
    id: 'ProspectingII',
    name: 'Prospecting II',
    description: '+5% Stardust carried out of a ruin',
    glyph: '💫',
  }, balance.technologies.ProspectingII),
  ProspectingIII: tech({
    id: 'ProspectingIII',
    name: 'Prospecting III',
    description: '+5% Stardust carried out of a ruin',
    glyph: '💫',
  }, balance.technologies.ProspectingIII),
  ColoursI: tech({
    id: 'ColoursI',
    name: 'Colours I',
    description: '+2 to the army power the halls can field',
    glyph: '🎌',
  }, balance.technologies.ColoursI),
  ColoursII: tech({
    id: 'ColoursII',
    name: 'Colours II',
    description: '+2 to the army power the halls can field',
    glyph: '🎌',
  }, balance.technologies.ColoursII),
  ColoursIII: tech({
    id: 'ColoursIII',
    name: 'Colours III',
    description: '+2 to the army power the halls can field',
    glyph: '🎌',
  }, balance.technologies.ColoursIII),
  ColoursIV: tech({
    id: 'ColoursIV',
    name: 'Colours IV',
    description: '+2 to the army power the halls can field',
    glyph: '🎌',
  }, balance.technologies.ColoursIV),
  ColoursV: tech({
    id: 'ColoursV',
    name: 'Colours V',
    description: '+2 to the army power the halls can field',
    glyph: '🎌',
  }, balance.technologies.ColoursV),
  MusterDrillI: tech({
    id: 'MusterDrillI',
    name: 'Muster Drill I',
    description: '−10% to what a unit costs to recruit',
    glyph: '📣',
  }, balance.technologies.MusterDrillI),
  MusterDrillII: tech({
    id: 'MusterDrillII',
    name: 'Muster Drill II',
    description: '−10% to what a unit costs to recruit',
    glyph: '📣',
  }, balance.technologies.MusterDrillII),
  MusterDrillIII: tech({
    id: 'MusterDrillIII',
    name: 'Muster Drill III',
    description: '−10% to what a unit costs to recruit',
    glyph: '📣',
  }, balance.technologies.MusterDrillIII),
  RationsI: tech({
    id: 'RationsI',
    name: 'Rations I',
    description: '−5% to what an expedition costs to provision',
    glyph: '🥖',
  }, balance.technologies.RationsI),
  RationsII: tech({
    id: 'RationsII',
    name: 'Rations II',
    description: '−5% to what an expedition costs to provision',
    glyph: '🥖',
  }, balance.technologies.RationsII),
  RationsIII: tech({
    id: 'RationsIII',
    name: 'Rations III',
    description: '−5% to what an expedition costs to provision',
    glyph: '🥖',
  }, balance.technologies.RationsIII),
  DrillmasterI: tech({
    id: 'DrillmasterI',
    name: 'Drillmaster I',
    description: '+5% XP a hero brings back from a delve',
    glyph: '🎖️',
  }, balance.technologies.DrillmasterI),
  DrillmasterII: tech({
    id: 'DrillmasterII',
    name: 'Drillmaster II',
    description: '+5% XP a hero brings back from a delve',
    glyph: '🎖️',
  }, balance.technologies.DrillmasterII),
  DrillmasterIII: tech({
    id: 'DrillmasterIII',
    name: 'Drillmaster III',
    description: '+5% XP a hero brings back from a delve',
    glyph: '🎖️',
  }, balance.technologies.DrillmasterIII),
  BearersI: tech({
    id: 'BearersI',
    name: 'Bearers I',
    description: '−3% of the haul lost when a depth goes wrong',
    glyph: '🎒',
  }, balance.technologies.BearersI),
  BearersII: tech({
    id: 'BearersII',
    name: 'Bearers II',
    description: '−3% of the haul lost when a depth goes wrong',
    glyph: '🎒',
  }, balance.technologies.BearersII),
  BearersIII: tech({
    id: 'BearersIII',
    name: 'Bearers III',
    description: '−3% of the haul lost when a depth goes wrong',
    glyph: '🎒',
  }, balance.technologies.BearersIII),
  PathfindersI: tech({
    id: 'PathfindersI',
    name: 'Pathfinders I',
    description: '−10% time to resolve each depth of a ruin',
    glyph: '🐎',
  }, balance.technologies.PathfindersI),
  PathfindersII: tech({
    id: 'PathfindersII',
    name: 'Pathfinders II',
    description: '−10% time to resolve each depth of a ruin',
    glyph: '🐎',
  }, balance.technologies.PathfindersII),
  PathfindersIII: tech({
    id: 'PathfindersIII',
    name: 'Pathfinders III',
    description: '−10% time to resolve each depth of a ruin',
    glyph: '🐎',
  }, balance.technologies.PathfindersIII),
  ShieldWallI: tech({
    id: 'ShieldWallI',
    name: 'Shield Wall I',
    description: '+1 DEF to every Melee unit',
    glyph: '🛡️',
  }, balance.technologies.ShieldWallI),
  ShieldWallII: tech({
    id: 'ShieldWallII',
    name: 'Shield Wall II',
    description: '+1 DEF to every Melee unit',
    glyph: '🛡️',
  }, balance.technologies.ShieldWallII),
  ShieldWallIII: tech({
    id: 'ShieldWallIII',
    name: 'Shield Wall III',
    description: '+1 DEF to every Melee unit',
    glyph: '🛡️',
  }, balance.technologies.ShieldWallIII),
  FletchingI: tech({
    id: 'FletchingI',
    name: 'Fletching I',
    description: '+1 ATK to every Distance unit',
    glyph: '🪶',
  }, balance.technologies.FletchingI),
  FletchingII: tech({
    id: 'FletchingII',
    name: 'Fletching II',
    description: '+1 ATK to every Distance unit',
    glyph: '🪶',
  }, balance.technologies.FletchingII),
  FletchingIII: tech({
    id: 'FletchingIII',
    name: 'Fletching III',
    description: '+1 ATK to every Distance unit',
    glyph: '🪶',
  }, balance.technologies.FletchingIII),
  BardingI: tech({
    id: 'BardingI',
    name: 'Barding I',
    description: '+1 DEF to every Mounted unit',
    glyph: '🐴',
  }, balance.technologies.BardingI),
  BardingII: tech({
    id: 'BardingII',
    name: 'Barding II',
    description: '+1 DEF to every Mounted unit',
    glyph: '🐴',
  }, balance.technologies.BardingII),
  BardingIII: tech({
    id: 'BardingIII',
    name: 'Barding III',
    description: '+1 DEF to every Mounted unit',
    glyph: '🐴',
  }, balance.technologies.BardingIII),
  WarhornsI: tech({
    id: 'WarhornsI',
    name: 'Warhorns I',
    description: '+1 ATK to every unit',
    glyph: '📯',
  }, balance.technologies.WarhornsI),
  WarhornsII: tech({
    id: 'WarhornsII',
    name: 'Warhorns II',
    description: '+1 ATK to every unit',
    glyph: '📯',
  }, balance.technologies.WarhornsII),
  WarhornsIII: tech({
    id: 'WarhornsIII',
    name: 'Warhorns III',
    description: '+1 ATK to every unit',
    glyph: '📯',
  }, balance.technologies.WarhornsIII),
  ManoeuvreI: tech({
    id: 'ManoeuvreI',
    name: 'Manoeuvre I',
    description: '+2% off the penalty for a bad matchup',
    glyph: '♟️',
  }, balance.technologies.ManoeuvreI),
  ManoeuvreII: tech({
    id: 'ManoeuvreII',
    name: 'Manoeuvre II',
    description: '+2% off the penalty for a bad matchup',
    glyph: '♟️',
  }, balance.technologies.ManoeuvreII),
  ManoeuvreIII: tech({
    id: 'ManoeuvreIII',
    name: 'Manoeuvre III',
    description: '+2% off the penalty for a bad matchup',
    glyph: '♟️',
  }, balance.technologies.ManoeuvreIII),
  FarsightI: tech({
    id: 'FarsightI',
    name: 'Farsight I',
    description: '+1 to how far every building can see into the fog',
    glyph: '🔭',
  }, balance.technologies.FarsightI),
  FarsightII: tech({
    id: 'FarsightII',
    name: 'Farsight II',
    description: '+1 to how far every building can see into the fog',
    glyph: '🔭',
  }, balance.technologies.FarsightII),
  FarsightIII: tech({
    id: 'FarsightIII',
    name: 'Farsight III',
    description: '+1 to how far every building can see into the fog',
    glyph: '🔭',
  }, balance.technologies.FarsightIII),
  Aqueducts: tech({
    id: 'Aqueducts',
    name: 'Aqueducts',
    description: 'Channelled water — Housing reaches level 3.',
    glyph: '🚰',
  }, balance.technologies.Aqueducts),
  Guildhalls: tech({
    id: 'Guildhalls',
    name: 'Guildhalls',
    description: 'Chartered trades — a second Market may be built.',
    glyph: '🏪',
  }, balance.technologies.Guildhalls),
  Roadworks: tech({
    id: 'Roadworks',
    name: 'Roadworks',
    description: 'Paved ways — every worker walks a quarter faster.',
    glyph: '🛤️',
  }, balance.technologies.Roadworks),
  LandSurvey: tech({
    id: 'LandSurvey',
    name: 'Land Survey',
    description: 'Chains and stakes — every building works one cell farther out.',
    glyph: '📏',
  }, balance.technologies.LandSurvey),
  Apprenticeships: tech({
    id: 'Apprenticeships',
    name: 'Apprenticeships',
    description: 'Masters and their apprentices — the Townhall trains two villagers at once.',
    glyph: '👥',
  }, balance.technologies.Apprenticeships),
  FieldMedicine: tech({
    id: 'FieldMedicine',
    name: 'Field Medicine',
    description: 'Bandages and splints — the party recovers some HP between depths.',
    glyph: '🩹',
  }, balance.technologies.FieldMedicine),
  Veterancy: tech({
    id: 'Veterancy',
    name: 'Veterancy',
    description: 'Hard-won experience — heroes gain levels from delving.',
    glyph: '🎖️',
  }, balance.technologies.Veterancy),
  Siegecraft: tech({
    id: 'Siegecraft',
    name: 'Siegecraft',
    description: 'Ladders and rams — a party can clear a defended landmark.',
    glyph: '🏰',
  }, balance.technologies.Siegecraft),
  Tactics: tech({
    id: 'Tactics',
    name: 'Tactics',
    description: 'Reading the ground — a bad matchup costs a tenth less.',
    glyph: '♟️',
  }, balance.technologies.Tactics),
  Scouting: tech({
    id: 'Scouting',
    name: 'Scouting',
    description: 'Eyes ahead — a ruin shows its threat before you launch.',
    glyph: '🔍',
  }, balance.technologies.Scouting),
  Salvage: tech({
    id: 'Salvage',
    name: 'Salvage',
    description: 'Pick over the losses — a failed depth costs 35% of the haul, not half.',
    glyph: '⚒️',
  }, balance.technologies.Salvage),
  Vanguard: tech({
    id: 'Vanguard',
    name: 'Vanguard',
    description: 'Known ground — the first depth of a ruin you have cleared resolves at once.',
    glyph: '🏇',
  }, balance.technologies.Vanguard),
  Standards: tech({
    id: 'Standards',
    name: 'Standards',
    description: 'Regimental colours — the army cap rises with every hall level.',
    glyph: '🏴',
  }, balance.technologies.Standards),
  Conquest: tech({
    id: 'Conquest',
    name: 'Conquest',
    description: 'Held ground — every cleared ruin teaches you more, hour by hour.',
    glyph: '👑',
  }, balance.technologies.Conquest),
  Meditation: tech({
    id: 'Meditation',
    name: 'Meditation',
    description: 'Stillness — the kingdom holds 30 more Mana.',
    glyph: '🧘',
  }, balance.technologies.Meditation),
  LeyReading: tech({
    id: 'LeyReading',
    name: 'Ley Reading',
    description: 'Reading the lines — a landmark shows what it grants before you pay.',
    glyph: '🔮',
  }, balance.technologies.LeyReading),
  Scrying: tech({
    id: 'Scrying',
    name: 'Scrying',
    description: 'Seeing into stone — a ruin shows its tier before you commit a party.',
    glyph: '🪞',
  }, balance.technologies.Scrying),
  Invocation: tech({
    id: 'Invocation',
    name: 'Invocation',
    description: 'Spoken twice — a relic\'s active gains a second charge.',
    glyph: '✨',
  }, balance.technologies.Invocation),
  Lorekeeping: tech({
    id: 'Lorekeeping',
    name: 'Lorekeeping',
    description: 'Records of the deep — ruins give up more of what they hold.',
    glyph: '📚',
  }, balance.technologies.Lorekeeping),
  Wayshrines: tech({
    id: 'Wayshrines',
    name: 'Wayshrines',
    description: 'Shrines on the road — a cleared defended landmark becomes claimable.',
    glyph: '⛩️',
  }, balance.technologies.Wayshrines),
  LeyLines: tech({
    id: 'LeyLines',
    name: 'Ley Lines',
    description: 'The land\'s own current — a district beside the Sanctum produces a tenth more.',
    glyph: '🕸️',
  }, balance.technologies.LeyLines),
  FrugalRites: tech({
    id: 'FrugalRites',
    name: 'Frugal Rites',
    description: 'Economy of gesture — some taps cost no Mana.',
    glyph: '🕯️',
  }, balance.technologies.FrugalRites),
  SanctifiedRuins: tech({
    id: 'SanctifiedRuins',
    name: 'Sanctified Ruins',
    description: 'Consecrated ground — a cleared ruin\'s Knowledge drip doubles.',
    glyph: '⛪',
  }, balance.technologies.SanctifiedRuins),
  RitualCasting: tech({
    id: 'RitualCasting',
    name: 'Ritual Casting',
    description: 'Rites over the roof — a relic\'s active can target a building.',
    glyph: '🌀',
  }, balance.technologies.RitualCasting),
  LeyStorm: tech({
    id: 'LeyStorm',
    name: 'Ley Storm',
    description: 'Once a day — a kingdom-wide surge of production for a while.',
    glyph: '🌩️',
  }, balance.technologies.LeyStorm),
  SecondSanctum: tech({
    id: 'SecondSanctum',
    name: 'Second Sanctum',
    description: 'Twin wells — a second Sanctum may be built.',
    glyph: '🔯',
  }, balance.technologies.SecondSanctum),
};

/** Every technology, in workbook order — which is also RANK order inside a
 *  line, so TECH_LINES can be derived from it rather than restated. */
export const TECH_ORDER: TechId[] = [
  'CharterI', 'CharterII', 'CharterIII', 'CharterIV',
  'Forestry', 'UrbanPlanning', 'Saws', 'Agriculture',
  'Masonry', 'Communities', 'Hunting', 'Farming',
  'Market', 'Mining', 'Architecture', 'Engineering',
  'DeepMining', 'WarbandI', 'WarbandII', 'WarbandIII',
  'WarbandIV', 'Warrior', 'Spears', 'Archery',
  'Cavalry', 'AttunementI', 'AttunementII', 'AttunementIII',
  'AttunementIV', 'Cartography', 'Consecration', 'Sailing',
  'ScalingTools', 'Fishing', 'Shipbuilding', 'TapPowerI',
  'TapPowerII', 'TapPowerIII', 'TapPowerIV', 'TapPowerV',
  'QuickHandsI', 'QuickHandsII', 'QuickHandsIII', 'QuickHandsIV',
  'QuickHandsV', 'WorkerLoadI', 'WorkerLoadII', 'WorkerLoadIII',
  'SawpitsI', 'SawpitsII', 'SawpitsIII', 'ButcheryI',
  'ButcheryII', 'ButcheryIII', 'IrrigationI', 'IrrigationII',
  'IrrigationIII', 'ScythesI', 'ScythesII', 'ScythesIII',
  'SurveyingI', 'SurveyingII', 'PitonsI', 'PitonsII',
  'MarketStallI', 'MarketStallII', 'MarketStallIII', 'MarketStallIV',
  'TradeRoutesI', 'TradeRoutesII', 'TradeRoutesIII', 'TradeRoutesIV',
  'TradeRoutesV', 'StonecuttingI', 'StonecuttingII', 'StonecuttingIII',
  'BigNetsI', 'BigNetsII', 'BigNetsIII', 'IronPicksI',
  'IronPicksII', 'IronPicksIII', 'ResonanceI', 'ResonanceII',
  'CarpentryI', 'CarpentryII', 'CarpentryIII', 'ScrivenersI',
  'ScrivenersII', 'ScrivenersIII', 'CartageI', 'CartageII',
  'CartageIII', 'DeepWellsI', 'DeepWellsII', 'DeepWellsIII',
  'DeepWellsIV', 'DeepWellsV', 'LeyTapsI', 'LeyTapsII',
  'LeyTapsIII', 'WaypostsI', 'WaypostsII', 'WaypostsIII',
  'ScriptoriumI', 'ScriptoriumII', 'ScriptoriumIII', 'VigilsI',
  'VigilsII', 'VigilsIII', 'PilgrimageI', 'PilgrimageII',
  'PilgrimageIII', 'ProspectingI', 'ProspectingII', 'ProspectingIII',
  'ColoursI', 'ColoursII', 'ColoursIII', 'ColoursIV',
  'ColoursV', 'MusterDrillI', 'MusterDrillII', 'MusterDrillIII',
  'RationsI', 'RationsII', 'RationsIII', 'DrillmasterI',
  'DrillmasterII', 'DrillmasterIII', 'BearersI', 'BearersII',
  'BearersIII', 'PathfindersI', 'PathfindersII', 'PathfindersIII',
  'ShieldWallI', 'ShieldWallII', 'ShieldWallIII', 'FletchingI',
  'FletchingII', 'FletchingIII', 'BardingI', 'BardingII',
  'BardingIII', 'WarhornsI', 'WarhornsII', 'WarhornsIII',
  'ManoeuvreI', 'ManoeuvreII', 'ManoeuvreIII', 'FarsightI',
  'FarsightII', 'FarsightIII', 'Aqueducts', 'Guildhalls',
  'Roadworks', 'LandSurvey', 'Apprenticeships', 'FieldMedicine',
  'Veterancy', 'Siegecraft', 'Tactics', 'Scouting',
  'Salvage', 'Vanguard', 'Standards', 'Conquest',
  'Meditation', 'LeyReading', 'Scrying', 'Invocation',
  'Lorekeeping', 'Wayshrines', 'LeyLines', 'FrugalRites',
  'SanctifiedRuins', 'RitualCasting', 'LeyStorm', 'SecondSanctum',
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

// ------------------------------------------------------------------ tomes

export interface TomeDef {
  id: TomeId;
  name: string;
  /** One sentence for what the book is FOR. If a tome cannot be described in
   *  one, it is carrying two subjects and should be two tomes. */
  blurb: string;
  glyph: string;
  /** The spine whose ranks pace it. Rank I is the cover page, granted when
   *  the tome opens; every keystone after requires the whole era above it. */
  spine: string;
}

/**
 * The shelf, in reading order.
 *
 * Civics is open from the start because it is the game. Magic opens on the
 * first PAID REVEAL — the fog is the magic, it is guaranteed inside two
 * minutes, and it needs no landmark to have spawned nearby, which is what
 * makes Cartography reachable when the `Mapmakers` quest asks for it. Warfare
 * opens on the first discovered ruin, because that is the first moment an
 * army is for anything.
 */
export const TOMES: Record<TomeId, TomeDef> = {
  Civics: {
    id: 'Civics', name: 'Civics', glyph: '🏛️', spine: 'Charter',
    blurb: 'The city and its purse.',
  },
  Magic: {
    id: 'Magic', name: 'Magic', glyph: '🔯', spine: 'Attunement',
    blurb: 'The land’s magic, and what you can see of it.',
  },
  Warfare: {
    id: 'Warfare', name: 'Warfare', glyph: '🚩', spine: 'Warband',
    blurb: 'The army, and what it goes into the ground for.',
  },
};

export const TOME_ORDER = Object.keys(TOMES) as TomeId[];

/** A tome's cover page — the rank I granted when the book opens. */
export const tomeCoverPage = (tome: TomeId): TechId => `${TOMES[tome].spine}I` as TechId;

/** Every technology in one tome, in workbook order. */
export const techsInTome = (tome: TomeId): TechId[] =>
  TECH_ORDER.filter((id) => TECHNOLOGIES[id].tome === tome);

// ------------------------------------------------------------- tech lines

/**
 * The ranks of each minor line, in order, DERIVED from `TECH_ORDER` rather
 * than restated.
 *
 * The list it replaces (`UPGRADE_ORDER`) was hand-written once and silently
 * went stale — Surveying was added, never listed, and so never drew in the
 * tree at all while a quest pointed the player straight at it. A second list
 * of the same names can only ever be a chance to forget one.
 */
export const TECH_LINES: Record<TechLineId, TechId[]> = (() => {
  const out = {} as Record<TechLineId, TechId[]>;
  for (const id of TECH_ORDER) {
    const line = TECHNOLOGIES[id].line;
    if (line === null) continue;
    (out[line] ??= []).push(id);
  }
  return out;
})();

/** Every line id, in the order the workbook authors them. */
export const TECH_LINE_ORDER = Object.keys(TECH_LINES) as TechLineId[];

/** The major technology a line hangs under — the first rank's requirement.
 *  Derived, so moving a line in the workbook moves its fan in the tree. */
export const lineParent = (line: TechLineId): TechId | null =>
  TECHNOLOGIES[TECH_LINES[line][0]].requires[0] ?? null;

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

export const LANDMARKS: LandmarkDef[] = (regionMap.landmarks as Array<{
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

const ruinBalance = regionMap.ruins as Record<RuinId, {
  x: number; y: number; tier: number; difficulty: number; baseDepthSeconds: number;
  depthGrowth: number; maxDepth: number; supplies: Wallet; affinity: string; artifact: string;
}>;

/** Every ruin the code knows about. RuinId is a union, so the roster is fixed
 *  in code and the map editor may move and retune a ruin but not add one. */
export const RUIN_ORDER: RuinId[] = Object.keys(ruinContent) as RuinId[];

export const RUINS: Record<RuinId, RuinDef> = Object.fromEntries(
  RUIN_ORDER.map((id) => {
    const b = ruinBalance[id];
    // A hand-edit that drops a ruin would otherwise white-screen the app on a
    // TypeError three frames from here.
    if (!b) throw new Error(`region-map.json is missing the ruin "${id}"`);
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

// ------------------------------------------------------------------ the store

/** A real-money SKU of the SIMULATED store (Docs/features/14-monetization.md
 *  §2). Nothing here ever charges: the price is deducted from the player's
  *  monthly budget (`PAYER`), which is the whole instrument. */
export interface StoreSkuDef {
  id: StoreSkuId;
  name: string;
  description: string;
  /** Dollars, as displayed and as deducted from the monthly budget. */
  priceUsd: number;
  gems: number;
  /** The pack's own art: `render/assets/<sprite>.png`. Falls back to the Gems
   *  icon until the file lands, like every other sprite. */
  sprite: string;
}

const skuContent: Record<StoreSkuId, Pick<StoreSkuDef, 'name' | 'description' | 'sprite'>> = {
  GemsPouch: { name: 'Pouch of Gems', description: "A handful \u2014 a builder, or a pull.", sprite: 'gems_pouch' },
  GemsPurse: { name: 'Purse of Gems', description: "A few calls, or a couple of hires.", sprite: 'gems_purse' },
  GemsChest: { name: 'Chest of Gems', description: "A crew's worth, with change.", sprite: 'gems_chest' },
  GemsVault: { name: 'Vault of Gems', description: "Every slot the kingdom has, and then some.", sprite: 'gems_vault' },
  GemsHoard: { name: 'Hoard of Gems', description: "A season of pulls.", sprite: 'gems_hoard' },
  GemsTreasury: { name: 'Treasury of Gems', description: "The whole ladder, twice over.", sprite: 'gems_treasury' },
};

export const STORE: Record<StoreSkuId, StoreSkuDef> = Object.fromEntries(
  (Object.keys(skuContent) as StoreSkuId[]).map((id) => {
    const b = (balance.store as Record<string, { priceUsd: number; gems: number }>)[id];
    if (!b) throw new Error(`balance.json is missing the store SKU "${id}"`);
    return [id, { id, ...skuContent[id], priceUsd: b.priceUsd, gems: b.gems }];
  }),
) as Record<StoreSkuId, StoreSkuDef>;

/** Workbook row order — the order the store shows them in. */
export const STORE_ORDER = Object.keys(balance.store) as StoreSkuId[];

/** Monthly simulated budgets by payer profile, in dollars
 *  (Docs/features/14-monetization.md §3). */
export const PAYER = balance.payer;

/** The daily chest ladder — Docs/features/12-quests.md §3.1. Three parallel
 *  lists, one per reward kind; their length IS the length of the ladder. */
export const DAILY = balance.daily;

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

export const GAME_VERSION = '0.1.0';
// v16 predates Mana, artifacts and expeditions. Everything those add is
// ADDITIVE, and every module read in save.ts defaults — so this bump needs no
// migrator, only the version (see Docs/implementation-plan.md §1).
// v18 predates ad offers. `kingdom.adOffers` is additive and its reader
// defaults, so this bump needs no migrator either.
export const SAVE_VERSION = 28;
