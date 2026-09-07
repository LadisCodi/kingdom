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
import treeDoc from './tech-tree.json';
import {
  isPlaced, techIds, type TechKind, type TechTreeDoc, type TechUnlock,
} from './techTreeRules';
import type { ModifierScope, ModifierStat } from '../modifiers';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, FeatureId, GoodId, GoodsStock,
  HarvestSourceId, HeroId,
  LandmarkKind, RuinId, StoreSkuId, TechId, TechLineId, TerrainId, TomeId, TrainableId, UnitId,
  Wallet,
} from '../state';

/** 1-based per-level list lookup that clamps to the last entry (the docs' convention). */
export const levelIndexed = <T>(list: readonly T[], level: number): T =>
  list[Math.min(Math.max(level, 1), list.length) - 1];

// ------------------------------------------------------------- technologies

export interface TechnologyDef {
  id: TechId;
  name: string;
  description: string;
  glyph: string;
  /** Which tome this sits in, and which band of it. The shelf IS the layout:
   *  one page per book, read top to bottom, with an era bar wherever the next
   *  band begins (Docs/features/07-research.md §2). Both are SHAPE — they
   *  come from `tech-tree.json`, not the workbook, because which book a node
   *  belongs in is a drag in `?dev=tree`, not a spreadsheet edit. */
  tome: TomeId;
  era: number;
  /** Its slot on that page: which row down, and which of the three columns
   *  across ([`Docs/tech-tree-editor.md`](../../../Docs/tech-tree-editor.md)).
   *  Every technology has one — ranks included. Flat, not a nested `slot`,
   *  so `TECHNOLOGIES` is directly what `ui/research/layout.ts` lays out. */
  row: number;
  col: number;
  /** What this technology IS: content it opens, a number it moves, or
   *  something the code reads by id (`techTreeRules.ts`). Authored — it is
   *  the first thing `?dev=tree` asks for. */
  kind: TechKind;
  /** What it opens, when its kind is `unlock`. Every gate in the game is
   *  derived from these (`GATES` below), so this is the ONE statement of
   *  "this technology unlocks the Sawmill". */
  unlocks: TechUnlock[];
  cost: Wallet; // city currencies
  durationSeconds: number;
  requires: TechId[]; // tree edges — all must be completed first
  /** Set on a MINOR rank; null on a major. Ranks of one line share it. */
  line: TechLineId | null;
  /** What one completed rank of this line adds. 0 on a major. */
  effectPerRank: number;
  /** On the tree for its shape; does nothing yet. Badged in the game, and the
   *  tree editor warns when anything requires one (tech-tree.md §7). */
  planned: boolean;
}

/**
 * Every technology in the game, built from the one file that holds them.
 *
 * `tech-tree.json` is a technology's whole home now — name, prose, glyph,
 * what KIND it is and what it unlocks, its price and clock, its slot on its
 * tome page and what it needs before it — and `?dev=tree` is what writes it
 * (Docs/tech-tree-editor.md). There is no `Technologies` sheet: the tree's
 * numbers went with the rest of it, because a graph a designer arranges by
 * dragging cannot have half of itself in a spreadsheet.
 *
 * What is left here is the derivation: this record, and the GATES below,
 * which every consumer still reads exactly as it did.
 */
const DOC = (treeDoc as unknown as TechTreeDoc).technologies;

/** File order, which the editor writes in reading order: book by book, then
 *  down the page and across it. That makes it RANK order inside a line too —
 *  a rank requires the one before it, and a requirement always sits higher up
 *  the page — so `TECH_LINES` can be derived from it rather than restated. */
export const TECH_ORDER: TechId[] = techIds(treeDoc as unknown as TechTreeDoc) as TechId[];

/**
 * Where a technology with no slot is drawn: nowhere anyone will look.
 *
 * `?dev=tree` can take one OFF THE PAGE while a book is rearranged, and the
 * rules call that an error, so the save endpoint and CI both refuse a tree
 * that still has one — the game cannot receive it. This is what a
 * hand-broken file gets instead of a crash: a card in the corner of Civics
 * era 1, colliding with whatever is there, which is loud in the editor and
 * harmless in the sim.
 */
const NO_SLOT = { tome: 'Civics' as TomeId, era: 1, row: 0, col: 0 };

export const TECHNOLOGIES: Record<TechId, TechnologyDef> = Object.fromEntries(
  TECH_ORDER.map((id) => {
    const node = DOC[id];
    const slot = isPlaced(node) ? node : NO_SLOT;
    const knowledge = node.knowledge ?? 0;
    return [id, {
      id,
      name: node.name,
      description: node.description,
      glyph: node.glyph,
      kind: node.kind,
      unlocks: node.unlocks ?? [],
      tome: slot.tome,
      era: slot.era,
      row: slot.row,
      col: slot.col,
      requires: (node.requires ?? []) as TechId[],
      cost: knowledge > 0 ? { Gold: node.gold, Knowledge: knowledge } : { Gold: node.gold },
      durationSeconds: node.seconds,
      line: (node.line ?? null) as TechLineId | null,
      effectPerRank: node.effectPerRank ?? 0,
      planned: node.planned === true,
    }];
  }),
) as unknown as Record<TechId, TechnologyDef>;

/**
 * The gates, derived from what each technology says it opens.
 *
 * The arrow used to point the other way: a district named its own
 * `required_tech`, a unit named its own, a harvest source had a column for it,
 * and `techUnlocks()` read all three BACKWARDS to answer "what is this
 * technology for". Now the technology says it once and every gate is a
 * lookup — which is the direction a designer thinks in, and the only one an
 * editor can author. `techTreeRules.ts` refuses two technologies claiming one
 * gate, so each of these is unambiguous.
 */
const GATES = (() => {
  const district = new Map<string, TechId>();
  const districtLevel = new Map<string, TechId>();
  const districtCount = new Map<string, TechId>();
  const unit = new Map<string, TechId>();
  const harvest = new Map<string, TechId>();
  const terrain = new Map<string, TechId>();
  for (const id of TECH_ORDER) {
    for (const unlock of TECHNOLOGIES[id].unlocks) {
      if ('district' in unlock) district.set(unlock.district, id);
      else if ('districtLevel' in unlock) {
        districtLevel.set(`${unlock.districtLevel.id}:${unlock.districtLevel.level}`, id);
      } else if ('districtCount' in unlock) districtCount.set(unlock.districtCount, id);
      else if ('unit' in unlock) unit.set(unlock.unit, id);
      else if ('harvest' in unlock) harvest.set(unlock.harvest, id);
      else if ('terrain' in unlock) terrain.set(unlock.terrain, id);
    }
  }
  return { district, districtLevel, districtCount, unit, harvest, terrain };
})();

/** The technology a cell of this terrain waits on, or null. One gate today:
 *  Water waits on Sailing (`src/sim/fog.ts` reads this). */
export const terrainGate = (id: string): TechId | null => GATES.terrain.get(id) ?? null;

/** What a district's gates are, for the record built below. `maxLevel` bounds
 *  the per-level list so it is the same length the sheet used to author. */
const districtGates = (id: string, maxLevel: number) => ({
  requiredTech: GATES.district.get(id) ?? null,
  // Index n gates level n+2, which is the shape every reader already expects
  // (`requiredTechForLevel`, `techUnlocks`).
  requiredTechPerLevel: Array.from({ length: Math.max(0, maxLevel - 1) },
    (_, i) => GATES.districtLevel.get(`${id}:${i + 2}`) ?? null),
  extraCountTech: GATES.districtCount.get(id) ?? null,
});

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

/**
 * A refined good: what one workshop turns raw resources into.
 *
 * `workSeconds` is the work ONE villager does on a queued item. The crew
 * shares itself over the items in progress, so two workers on one item finish
 * it in half the time (Docs/plans/builder-30-days.md §3).
 */
export interface GoodDef {
  id: GoodId;
  name: string;
  tier: number;
  /** Raw currencies one item consumes, paid when it is queued. */
  input: Wallet;
  /** Mana one item consumes. Its own field because Mana is capped and city
   *  scoped, and is spent through `payMana`, never through the wallet. */
  inputMana: number;
  /** The tier-2 recipe: a good made partly of another good. */
  inputGood: GoodId | null;
  inputGoodAmount: number;
  workSeconds: number;
}

export const GOODS: Record<GoodId, GoodDef> = {
  Planks: { id: 'Planks', ...balance.goods.Planks } as GoodDef,
  CutStone: { id: 'CutStone', ...balance.goods.CutStone } as GoodDef,
  Iron: { id: 'Iron', ...balance.goods.Iron } as GoodDef,
  Runestone: { id: 'Runestone', ...balance.goods.Runestone } as GoodDef,
};

export const GOOD_ORDER: readonly GoodId[] = Object.keys(GOODS) as GoodId[];

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
   *  first research something the player wants rather than a chore.
   *
   *  DERIVED: the technology says `unlocks: [{ harvest: 'Forest' }]` and this
   *  is the lookup (`GATES`). There is no `required_tech` column any more. */
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
  b: Omit<HarvestSpec, 'id' | 'currencyId' | 'requiredTech'>,
): HarvestSpec =>
  ({ ...b, id, currencyId, requiredTech: GATES.harvest.get(id) ?? null });

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
/**
 * What an adjacency rule moves. One line here plus one call site is the whole
 * cost of a new one — which is the point of the sheet having a `stat` column
 * rather than a Gold column (OQ-48).
 *
 * Units are the STAT's, not the column's, and there are only two kinds:
 * `goldPerMinute` is flat Gold a minute, everything else is a **fraction** of
 * the base (−0.10 = a tenth faster, or cheaper, or more).
 */
export type AdjacencyStat = 'goldPerMinute' | 'workTime' | 'trainTime';

/**
 * Who a rule's `neighbour` may name: one district, or a GROUP of them.
 *
 * Groups exist because the rules are written by kind — "a hall beside another
 * hall", "the Market beside a workshop" — and spelling those as directed pairs
 * costs twelve rows for the halls alone, plus a rewrite of the block every
 * time a building joins the kind. Membership is DERIVED from what a district
 * already is, so nothing is authored twice.
 */
export type AdjacencyGroup = 'AnyHall' | 'AnyWorkshop' | 'AnyProducer';
export type AdjacencyTarget = DistrictId | AdjacencyGroup;

export const ADJACENCY_GROUPS: Record<AdjacencyGroup, (d: DistrictDef) => boolean> = {
  AnyHall: (d) => d.armyCapPerLevel.length > 0,
  AnyWorkshop: (d) => d.produces !== null,
  AnyProducer: (d) => d.harvestSources.length > 0,
};

export const isAdjacencyGroup = (t: string): t is AdjacencyGroup => t in ADJACENCY_GROUPS;

export interface AdjacencyRule {
  /** Who RECEIVES the effect. A district id or a group token, like
   *  `neighbor` — so "a hall beside another hall" is one row. */
  district: AdjacencyTarget;
  neighbor: AdjacencyTarget;
  stat: AdjacencyStat;
  /** Signed: a penalty is negative, and for `workTime` and `trainTime` a
   *  NEGATIVE magnitude is the good one (less time). */
  magnitude: number;
}
export const ADJACENCY = balance.adjacency as unknown as AdjacencyRule[];

/** No single stat may be moved more than this by neighbours, either way, so
 *  no layout is ever wrong — only better. */
export const ADJACENCY_CLAMP = 0.25;

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
  /** Refined goods an upgrade costs on top of the currencies; index 0 = the
   *  price of reaching level 2, the same indexing as every other per-level
   *  column. Empty = this building is priced in raw resources alone. */
  upgradeCostGoodsPerLevel: readonly GoodsStock[];
  upgradeCostLevelGrowth: number;
  upgradeDurationSeconds: number;
  upgradeDurationLevelGrowth: number;
  /** The LATE curve, from `city.lateUpgradeFromLevel`. The columns above are
   *  tuned for the opening — minutes and tens of Wood — and continuing them
   *  to level 10 gives a day-20 upgrade that costs a morning's tapping and
   *  finishes in eight minutes. 0 = this building has no late levels, and
   *  every level is priced and timed by the curve above. */
  upgradeCostLateLevelGrowth: number;
  /** Seconds to reach the pivot level itself; the growth compounds from
   *  there. 0 = the early curve simply continues. */
  upgradeDurationLateSeconds: number;
  upgradeDurationLateLevelGrowth: number;
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
  /** The one refined good this building makes; null = it is not a workshop.
   *  One good per workshop, the way one forest is a Sawmill's. */
  produces: GoodId | null;
  /** What a producer's late level buys instead of crew: the plot has more
   *  cells than a crew can ever work, so levels 6-10 grow the HAUL and the
   *  swing rather than adding villagers.
   *
   *  Units ADDED to a delivery, not a multiplier on it — a chunk is 1 to 5
   *  units, and a percentage of that rounds away to nothing. The shape
   *  `WorkerLoad` already uses. Empty = 0 at every level.
   *
   *  `strikeSpeedPerLevel` IS a multiplier: it divides a cadence measured in
   *  whole seconds, where a tenth is visible. Empty = 1.0 everywhere.
   *
   *  Both are base-stage terms of the pipeline in `upgrades.ts`, read off the
   *  building's own level and never re-expressed as a modifier. */
  extraUnitsPerDeliveryPerLevel: readonly number[];
  strikeSpeedPerLevel: readonly number[];
  /** What a sold unit pays, by the level of the best Market in the city. A
   *  multiplier, empty = 1.0 — the Market is the only building with one. */
  salePricePerLevel: readonly number[];
  /** How many items may be queued at once, by level. Empty = not a workshop.
   *  A longer queue is a longer absence covered, never more goods per hour —
   *  that is the crew (Docs/plans/builder-30-days.md §2.2). */
  queueLengthPerLevel: readonly number[];
}

// Numbers (costs, times, caps, sizes, radii) come from balance/*.csv via
// balance.json; only identity, art, and rules wiring is authored here.
const rules = {
  buildable: true, harvestSources: [], providesHarvestSource: null,
  trains: [],
} as const;

/** A workshop: identity and art here, everything numeric from the sheet, and
 *  its gate from whichever technology says it unlocks it. */
const workshop = (
  id: DistrictId, name: string, description: string, glyph: string, sprite: string,
) => ({
  ...rules, id, name, description, glyph, sprite,
});

/** The good a workshop makes arrives from JSON as a plain string — the
 *  importer already validated it against the id list. The tech GATES are not
 *  here: they come from the technologies, through `districtGates`. */
const districtBalance = <B extends { produces: string | null }>(
  b: B,
): Omit<B, 'produces'> & { produces: GoodId | null } =>
  b as never;

/** Identity, art and the sheet's numbers. The tech gates are added below —
 *  they are the technologies' to state, not a district's. */
const DISTRICT_CONTENT = {
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
    ...districtBalance(balance.districts.Sawmill),
  },
  Market: {
    ...rules,
    id: 'Market',
    name: 'Market',
    description: 'Trade surplus goods for Gold — tap it to open the trade screen.',
    glyph: '🏪',
    sprite: 'market',
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
    ...districtBalance(balance.districts.Docks),
  },
  Sanctum: {
    ...rules,
    id: 'Sanctum',
    name: 'Sanctum',
    description: 'A vault for raw magic. Each level holds more Mana against the hours you are away.',
    glyph: '🔯',
    sprite: 'sanctum',
    ...districtBalance(balance.districts.Sanctum),
  },
  Barracks: {
    ...rules,
    id: 'Barracks',
    name: 'Barracks',
    description: 'Drills foot soldiers, and every level lets you keep a bigger army.',
    glyph: '🛖',
    sprite: 'barracks',
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
    trains: ['Cavalry'],
    ...districtBalance(balance.districts.Stables),
  },
  Carpenter: {
    ...workshop('Carpenter', 'Carpenter', 'Villagers here work Wood into Planks.',
      '🔨', 'carpenter'),
    ...districtBalance(balance.districts.Carpenter),
  },
  MasonsYard: {
    ...workshop('MasonsYard', "Mason's Yard", 'Villagers here dress Stone into blocks.',
      '🧱', 'masons_yard'),
    ...districtBalance(balance.districts.MasonsYard),
  },
  Smelter: {
    ...workshop('Smelter', 'Smelter', 'Villagers here smelt ore and gold into Iron.',
      '🔥', 'smelter'),
    ...districtBalance(balance.districts.Smelter),
  },
  RuneCarver: {
    ...workshop('RuneCarver', 'Rune Carver', 'Villagers here pour Mana into cut stone.',
      '🔯', 'rune_carver'),
    ...districtBalance(balance.districts.RuneCarver),
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] = [
  'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Quarry', 'Docks', 'Market',
  'Sanctum',
  'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables',
  'Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver',
];

/** Every workshop, in build-menu order. */
export const WORKSHOPS: DistrictId[] = ['Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver'];

/**
 * The districts, with the gates the technologies hand them.
 *
 * One statement of "the Sawmill waits on Saws", and it lives on Saws
 * (`GATES`). Every reader is unchanged: `requiredTech`, the per-level list and
 * `extraCountTech` are the same three fields the sheet used to author.
 */
export const DISTRICTS: Record<DistrictId, DistrictDef> = Object.fromEntries(
  Object.entries(DISTRICT_CONTENT).map(([id, def]) => [id, {
    ...def, ...districtGates(id, (def as { maxLevel: number }).maxLevel),
  }]),
) as unknown as Record<DistrictId, DistrictDef>;

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
   *  the tome opens. The ranks after it are ordinary technologies that each
   *  raise a real dial; what opens a BAND is the era gate below (§2.1). */
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

/** How many bands a book has. Era 4 is the sealed one. */
export const MAX_ERA = 4;

/**
 * What opens a band: how much of the region has to have been revealed before
 * the page continues past that era bar (07-research.md §2.1).
 *
 * Era 1 is 0 — a book's first band opens with the book. The bar is a gate in
 * the WORLD, not a research: the tree paces on exploring, so a player cannot
 * buy their way down a page while standing still.
 */
export const ERA_UNLOCK_CELLS: Record<TomeId, number[]> = (() => {
  const out = {} as Record<TomeId, number[]>;
  for (const tome of TOME_ORDER) out[tome] = Array.from({ length: MAX_ERA + 1 }, () => 0);
  for (const row of balance.eras as Array<{ tome: string; era: number; unlockCells: number }>) {
    out[row.tome as TomeId][row.era] = row.unlockCells;
  }
  return out;
})();

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

const UNIT_CONTENT = {
  Warrior: {
    id: 'Warrior',
    name: 'Warrior',
    description: 'Sturdy front line: the most armour and health per Gold.',
    glyph: '⚔️',
    tags: ['Melee'],
    ...balance.units.Warrior,
  },
  Lancer: {
    id: 'Lancer',
    name: 'Lancer',
    description: 'Long reach that keeps the line safe.',
    glyph: '🔱',
    tags: ['Melee'],
    ...balance.units.Lancer,
  },
  Archer: {
    id: 'Archer',
    name: 'Archer',
    description: 'Ranged support: the most attack per Gold, and the least of everything else.',
    glyph: '🏹',
    tags: ['Distance'],
    ...balance.units.Archer,
  },
  Cavalry: {
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Fast and hard-hitting.',
    glyph: '🐎',
    tags: ['Mounted', 'Melee'],
    ...balance.units.Cavalry,
  },
};

/** The units, with the gate the technologies hand them — the same derivation
 *  the districts get, from the same one statement. */
export const UNITS: Record<UnitId, UnitDef> = Object.fromEntries(
  Object.entries(UNIT_CONTENT).map(([id, def]) => [id, {
    ...def, requiredTech: GATES.unit.get(id) ?? null,
  }]),
) as unknown as Record<UnitId, UnitDef>;

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
export const SAVE_VERSION = 30;
