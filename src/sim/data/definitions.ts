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
  eraCells, eraCount, isPlaced, techIds, type TechKind, type TechTreeDoc, type TechUnlock,
} from './techTreeRules';
import type { TechEffect } from './techEffectRules';
import type { ModifierScope, ModifierStat } from '../modifiers';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, FeatureId, GoodId, GoodsStock,
  HarvestSourceId, HeroId,
  LandmarkKind, RuinId, StoreSkuId, TechId, TerrainId, TomeId, TrainableId, UnitId,
  Wallet,
} from '../state';

/** 1-based per-level list lookup that clamps to the last entry (the docs' convention). */
export const levelIndexed = <T>(list: readonly T[], level: number): T =>
  list[Math.min(Math.max(level, 1), list.length) - 1];

// ------------------------------------------------------------- technologies

export interface TechnologyDef {
  id: TechId;
  name: string;
  /** A `mechanic`'s written prose, and empty on every other kind. What the
   *  player reads is `techLine(id)` (`src/sim/techProse.ts`), generated from
   *  `unlocks` or `effects` — this is only the fallback that generator reaches
   *  for when there is nothing in the data to read. */
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
   *  Flat, not a nested `slot`, so `TECHNOLOGIES` is directly what
   *  `ui/research/layout.ts` lays out. Meaningless when `placed` is false. */
  row: number;
  col: number;
  /** Is it on a page at all? `?dev=tree` can leave a technology in the
   *  holding pen (`techTreeRules.ts`), and such a file saves, so the game has
   *  to cope with one: an UNPLACED technology is not drawn, cannot be
   *  researched and gates nothing. Its four slot fields carry `NO_SLOT` so
   *  every reader stays total, and this is the flag that says not to trust
   *  them. */
  placed: boolean;
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
  /** What this technology moves, and what it aims at — the declarative half
   *  of a bonus (`data/techEffectRules.ts`, resolved by `sim/techEffects.ts`).
   *  Empty on anything that moves no number. */
  effects: TechEffect[];
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
 *  down the page and across it. That makes it RANK order inside a ladder too —
 *  a rank requires the one before it, and a requirement always sits higher up
 *  the page. */
export const TECH_ORDER: TechId[] = techIds(treeDoc as unknown as TechTreeDoc) as TechId[];

/**
 * The slot a technology with no slot reports: inert, and never read.
 *
 * `?dev=tree` can take one OFF THE PAGE while a book is rearranged, and such
 * a tree SAVES — a rearrangement that spans a coffee break has to survive
 * being written down. So the game receives them, and `placed: false` is how
 * every consumer knows to leave them out: `techsInTome` does not list one,
 * the page does not draw one, `canStartTech` refuses one and `GATES` below
 * skips one. These four numbers only exist so the fields stay non-optional.
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
      description: node.description ?? '',
      glyph: node.glyph,
      kind: node.kind,
      unlocks: node.unlocks ?? [],
      tome: slot.tome,
      era: slot.era,
      row: slot.row,
      col: slot.col,
      placed: isPlaced(node),
      requires: (node.requires ?? []) as TechId[],
      cost: knowledge > 0 ? { Gold: node.gold, Knowledge: knowledge } : { Gold: node.gold },
      durationSeconds: node.seconds,
      effects: node.effects ?? [],
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
 *
 * OFF THE PAGE opens nothing. A technology in the editor's holding pen cannot
 * be researched, so leaving it in charge of a gate would lock the Sawmill
 * away with no card anywhere that opens it — silently, which is the worst of
 * the two answers. Ungated is the loud one, and it is also what "this
 * technology is not in the game yet" ought to mean.
 */
const GATES = (() => {
  const district = new Map<string, TechId>();
  const districtLevel = new Map<string, TechId>();
  const districtCount = new Map<string, TechId>();
  const unit = new Map<string, TechId>();
  const harvest = new Map<string, TechId>();
  const terrain = new Map<string, TechId>();
  for (const id of TECH_ORDER) {
    if (!TECHNOLOGIES[id].placed) continue;
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
  /** What one unit is worth in Gold, for the cards that price it;
   *  null = it has no Gold price at all. */
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

// Object order = header widget order.
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
  HeroXp: currency('kingdom', balance.currencies.HeroXp),
  Gems: currency('player', balance.currencies.Gems),
  SilverKey: currency('player', balance.currencies.SilverKey),
  GoldKey: currency('player', balance.currencies.GoldKey),
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

/**
 * Harmony's surplus bonus: what `supply / demand` has to reach, and what each
 * tier pays on the tax rate. Ascending — a reader takes the LAST tier
 * reached. **At demand 0 there is no ratio and no bonus**, or one Garden at
 * Townhall 5 would pay the top tier for the whole midgame, for free
 * (Docs/plans/builder-30-days.md §6.2).
 */
export const HARMONY = balance.harmony as {
  readonly surplusTiers: readonly { readonly at: number; readonly bonus: number }[];
};

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
 * hall", "a producer beside a workshop" — and spelling those as directed pairs
 * costs twelve rows for the halls alone, plus a rewrite of the block every
 * time a building joins the kind. Membership is DERIVED from what a district
 * already is, so nothing is authored twice.
 */
export type AdjacencyGroup = 'AnyHall' | 'AnyWorkshop' | 'AnyProducer' | 'AnyDecoration';
export type AdjacencyTarget = DistrictId | AdjacencyGroup;

export const ADJACENCY_GROUPS: Record<AdjacencyGroup, (d: DistrictDef) => boolean> = {
  AnyHall: (d) => d.armyCapPerLevel.length > 0,
  AnyWorkshop: (d) => d.produces !== null,
  AnyProducer: (d) => d.harvestSources.length > 0,
  AnyDecoration: (d) => d.harmonySupply > 0,
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
  | 'CollectResource' | 'CollectTaps' | 'DiscoverCells' | 'DiscoverFeature'
  | 'ClaimLandmarks' | 'ReachDepth' | 'ClearRuins' | 'ClearGarrisons' | 'OwnArtifacts'
  | 'OwnHeroes';

export const RELATIVE_QUEST_TYPES: ReadonlySet<QuestGoalType> =
  new Set([
    'CollectResource', 'CollectTaps', 'DiscoverCells', 'DiscoverFeature',
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
  /** Mana, into the city purse. A city currency, but not one of the four
   *  materials `reward` carries — and the one reward that buys TAPS rather
   *  than things, which is what the opening is short of
   *  (Docs/features/12-quests.md §2.1). */
  rewardMana: number;
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
  /** What this house's LEVEL adds to the rent its residents pay: a fraction
   *  of the base rate, the TOTAL at that level rather than an increment,
   *  indexed from level 1 like `armyCapPerLevel`. So entry 0 is what a
   *  freshly built house pays over the base (+0%) and the rest are its
   *  levels. Empty = +0% everywhere, which is every building that houses
   *  nobody. A level fact, read at the base stage — never a modifier. */
  taxBonusPerLevel: readonly number[];
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
  /** What every level costs the FIRST instance of this building, one entry
   *  per level: index 0 is the BUILD, index 1 what reaching level 2 costs.
   *  Authored on the `DistrictCosts` sheet, never derived from a curve
   *  (Docs/features/05-city-and-districts.md §3). Exactly `maxLevel` long. */
  costPerLevel: readonly { cost: Wallet; goods: GoodsStock }[];
  /** How much dearer a LATER instance is:
   *  `M(N) = linear × (N − 1) + growth^(N − 1)`, which is exactly 1 at N = 1,
   *  so the first one pays the table. The linear term prices the early
   *  copies, the exponential the tail. Currencies only — a recipe does not
   *  know how many of the thing the city owns, so the goods column is never
   *  multiplied (§3.2). */
  instanceLinearGrowth: number;
  instanceExponentialGrowth: number;
  buildDurationSeconds: number;
  buildDurationDistrictGrowth: number;
  buildDurationDistanceGrowth: number;
  upgradeDurationSeconds: number;
  upgradeDurationLevelGrowth: number;
  /** The late WAIT, from `city.lateUpgradeFromLevel`: seconds to reach the
   *  pivot level itself, the growth compounding from there. The early columns
   *  are tuned for the opening — minutes — and continuing them to level 10
   *  gives a day-20 upgrade that finishes in eight. 0 = this building has no
   *  late levels and the early curve simply continues. There is no late COST
   *  curve: a late level is dear because a designer typed a big number. */
  upgradeDurationLateSeconds: number;
  upgradeDurationLateLevelGrowth: number;
  requiredTownhallLevelPerLevel: readonly number[]; // index 0 = requirement to REACH level 2
  /** Villagers the city must have to REACH each level, same indexing. Empty =
   *  no gate. Authored on the Townhall: a town grows when its people do
   *  (Docs/features/05-city-and-districts.md §1). */
  requiredPopulationPerLevel: readonly number[];
  /** Technology gating each upgrade; index 0 = requirement to REACH level 2. */
  requiredTechPerLevel: readonly (TechId | null)[];
  /** One more of this district may stand once this technology is done. */
  extraCountTech: TechId | null;
  /** Army cap this building contributes at each level (TOTAL, not
   *  incremental). Empty = it is not a military building. */
  armyCapPerLevel: readonly number[];
  /** Beds for the wounded, per level. Only the Infirmary has any: it is what
   *  turns a casualty into a bill instead of a loss
   *  (Docs/features/combat.md §4). */
  bedsPerLevel: readonly number[];
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
  /** How many items may be queued at once, by level. Empty = not a workshop.
   *  A longer queue is a longer absence covered, never more goods per hour —
   *  that is the crew (Docs/plans/builder-30-days.md §2.2). */
  queueLengthPerLevel: readonly number[];
  /** Harmony this building SUPPLIES once built. Non-zero = it is a
   *  decoration, which is the whole of what it does: no level, no crew, no
   *  residents, no tap. */
  harmonySupply: number;
  /** Harmony this building DEMANDS — the **total** at each level, not an
   *  increment, indexed from level 1 the way `armyCapPerLevel` is. So entry 0
   *  is the gate on BUILDING it and the rest are the gates on its levels, one
   *  column for both and no prefix summed anywhere. Empty = it demands
   *  nothing (Docs/plans/builder-30-days.md §6.1). */
  harmonyCostPerLevel: readonly number[];
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

/** A decoration: it supplies Harmony and does nothing else — no level, no
 *  crew, no residents, no tap, and no fog ring, which would have made a
 *  200-Wood Garden a cheaper frontier than paying for one. Its count cap is
 *  its Townhall gate too, the way a workshop's already is. */
const decoration = (
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
    // The id is a key; the name is read aloud on a card ("Unlocks the crop
    // plots"), so it is two words and lower case like the thing it names.
    name: 'crop plots',
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
  Infirmary: {
    ...rules,
    id: 'Infirmary',
    name: 'Infirmary',
    description: 'Beds for the soldiers who came back hurt. Mending one costs a '
      + 'fraction of replacing them.',
    glyph: '⛑️',
    sprite: 'infirmary',
    ...districtBalance(balance.districts.Infirmary),
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
  Garden: {
    ...decoration('Garden', 'Garden', 'Beds of flowers. The cheapest beauty a city can keep.',
      '🌷', 'garden'),
    ...districtBalance(balance.districts.Garden),
  },
  Well: {
    ...decoration('Well', 'Well', 'Cobbled stone and a bucket — where the street meets.',
      '🪣', 'well'),
    ...districtBalance(balance.districts.Well),
  },
  Orchard: {
    ...decoration('Orchard', 'Orchard', 'Two rows of fruit trees, kept for the look of them.',
      '🌳', 'orchard'),
    ...districtBalance(balance.districts.Orchard),
  },
  Statue: {
    ...decoration('Statue', 'Statue', 'A crowned figure in pale stone. Somebody paid for this.',
      '🗿', 'statue'),
    ...districtBalance(balance.districts.Statue),
  },
  Plaza: {
    ...decoration('Plaza', 'Plaza', 'A paved square with room for a market day.',
      '⛲', 'plaza'),
    ...districtBalance(balance.districts.Plaza),
  },
  Shrine: {
    ...decoration('Shrine', 'Shrine', 'A round temple of pale stone, cut through with runes.',
      '⛩️', 'shrine'),
    ...districtBalance(balance.districts.Shrine),
  },
};

export const BUILDABLE_DISTRICTS: DistrictId[] = [
  'Housing', 'Farm', 'FarmLands', 'Sawmill', 'Quarry', 'Docks',
  'Sanctum',
  'Barracks', 'SpearHall', 'ShootingGrounds', 'Stables', 'Infirmary',
  'Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver',
  'Garden', 'Well', 'Orchard', 'Statue', 'Plaza', 'Shrine',
];

/** Every workshop, in build-menu order. */
export const WORKSHOPS: DistrictId[] = ['Carpenter', 'MasonsYard', 'Smelter', 'RuneCarver'];

/** Every decoration, cheapest first — which is also the order their Townhall
 *  gates open in. The build menu shows them as their own section. */
export const DECORATIONS: DistrictId[] = ['Garden', 'Well', 'Orchard', 'Statue', 'Plaza', 'Shrine'];

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

/** THE RESOLVER'S OWN DIALS (Docs/features/combat.md §17). A tick is logical
 *  — 100 ms of replay, not a frame — and the type fractions are integer pairs
 *  because the whole fight is integer arithmetic (§16). */
export const COMBAT = balance.combat;

// ------------------------------------------------------------------ tomes

export interface TomeDef {
  id: TomeId;
  name: string;
  /** One sentence for what the book is FOR. If a tome cannot be described in
   *  one, it is carrying two subjects and should be two tomes. */
  blurb: string;
  glyph: string;
}

/**
 * The shelf, in reading order.
 *
 * All three are open from the first minute. A book used to be opened by a
 * granted cover page — Civics with the kingdom, Magic on the first paid
 * reveal, Warfare on the first ruin in sight — and the card existed only to
 * be the marker. What paces a book is its era bars, which ask for revealed
 * cells, so the marker was doing nothing the bars were not.
 */
export const TOMES: Record<TomeId, TomeDef> = {
  Civics: {
    id: 'Civics', name: 'Civics', glyph: '🏛️',
    blurb: 'The city and its purse.',
  },
  Magic: {
    id: 'Magic', name: 'Magic', glyph: '🔯',
    blurb: 'The land’s magic, and what you can see of it.',
  },
  Warfare: {
    id: 'Warfare', name: 'Warfare', glyph: '🚩',
    blurb: 'The army, and what it goes into the ground for.',
  },
};

export const TOME_ORDER = Object.keys(TOMES) as TomeId[];

/** Every technology on one tome's page, in file order. One in the editor's
 *  holding pen is on no page, so it is in no book. */
export const techsInTome = (tome: TomeId): TechId[] =>
  TECH_ORDER.filter((id) => TECHNOLOGIES[id].placed && TECHNOLOGIES[id].tome === tome);

/**
 * How many bands each book has — authored in `?dev=tree`, not a constant.
 *
 * Per book, because a book is where a band belongs: Civics may run to five
 * while Warfare stays at four. The LAST band of a book is its sealed one.
 */
export const ERA_COUNT: Record<TomeId, number> = (() => {
  const out = {} as Record<TomeId, number>;
  for (const tome of TOME_ORDER) out[tome] = eraCount(treeDoc as unknown as TechTreeDoc, tome);
  return out;
})();

/** The deepest band any book reaches — for anything that has to size an array
 *  across all three. How deep a given book goes is `ERA_COUNT[tome]`. */
export const MAX_ERA = Math.max(...TOME_ORDER.map((tome) => ERA_COUNT[tome]));

/**
 * What opens a band: how much of the region has to have been revealed before
 * the page continues past that era bar (07-research.md §2.1).
 *
 * Era 1 is 0 — a book's first band opens with the book. The bar is a gate in
 * the WORLD, not a research: the tree paces on exploring, so a player cannot
 * buy their way down a page while standing still.
 *
 * Indexed by era, so `[0]` is unused and `[1]` is the first band — the shape
 * every reader already asks for. The authored file is a plain ladder from era
 * 1, and this is the one place the two meet.
 */
export const ERA_UNLOCK_CELLS: Record<TomeId, number[]> = (() => {
  const out = {} as Record<TomeId, number[]>;
  for (const tome of TOME_ORDER) {
    out[tome] = [0, ...Array.from(
      { length: ERA_COUNT[tome] },
      (_, i) => eraCells(treeDoc as unknown as TechTreeDoc, tome, i + 1),
    )];
  }
  return out;
})();

// -------------------------------------------------------------------- units

export type UnitTag = 'Melee' | 'Distance' | 'Mounted';

export interface UnitDef {
  id: UnitId;
  name: string;
  description: string;
  glyph: string;
  /** Stem of its art in src/render/assets/. `<sprite>` is the whole soldier;
   *  `<sprite>_avatar` is the bust the small widgets draw, because a standing
   *  figure at 48px is a smudge (Docs/art/portraits/unit-blocks.md §2). */
  sprite: string;
  /**
   * What it costs against the army cap, and the scale every room's
   * `power_req` is written in (Docs/features/combat.md §12).
   *
   * **Power is not damage.** They were one number while combat was a scoring
   * pass; the resolver hits with `dmg`, and a room that reads "72" would mean
   * something else entirely if it followed the damage table.
   */
  power: number;
  /** What one troop of this type takes off a target it hits (§7). */
  dmg: number;
  def: number;
  hp: number;
  /**
   * How many troops of the squad can reach the enemy at once (§7).
   *
   * `hits = min(alive, frontage)`, so a squad's output is FLAT until its
   * count falls below this and then falls linearly — everyone above it is
   * reserve who absorbs damage and swings at nothing.
   */
  frontage: number;
  /** Ticks between this type's attacks (§10). A tick is 100 ms logical. */
  cooldown: number;
  /** Troops of this type in ONE squad — the cap on a party slot's count, and
   *  the size the battle screen fills a slot to (Docs/features/combat.md §4).
   *  Fixed at every tier: a tier multiplies what a troop is worth, never how
   *  many of them stand together. */
  squadSize: number;
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
    sprite: 'unit_warrior',
    glyph: '⚔️',
    tags: ['Melee'],
    ...balance.units.Warrior,
  },
  Lancer: {
    id: 'Lancer',
    name: 'Lancer',
    description: 'Long reach that keeps the line safe.',
    sprite: 'unit_lancer',
    glyph: '🔱',
    tags: ['Melee'],
    ...balance.units.Lancer,
  },
  Archer: {
    id: 'Archer',
    name: 'Archer',
    description: 'Ranged support: the most attack per Gold, and the least of everything else.',
    sprite: 'unit_archer',
    glyph: '🏹',
    tags: ['Distance'],
    ...balance.units.Archer,
  },
  Cavalry: {
    id: 'Cavalry',
    name: 'Cavalry',
    description: 'Fast and hard-hitting.',
    sprite: 'unit_cavalry',
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
  id: string; kind: string; x: number; y: number; claimCost: number;
}>).map((l) => ({
  id: l.id,
  kind: l.kind as LandmarkKind,
  location: { x: l.x, y: l.y },
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
 * A relic has no battlefield stats: nothing carries one into a fight, so the
 * only question a relic asks is which passive the kingdom wears
 * (Docs/features/09-relics.md §5).
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

type ArtifactBalance = {
  passiveBase: number; passivePerLevel: number;
  activeManaCost: number; activeDurationSeconds: number; activeRadius: number;
};
const ab = (id: ArtifactId): ArtifactBalance =>
  (balance.artifacts as Record<ArtifactId, ArtifactBalance>)[id];

export const ARTIFACTS: Record<ArtifactId, ArtifactDef> = {
  DowsingRod: {
    id: 'DowsingRod', name: 'Dowsing Rod', glyph: '🔮', sprite: 'artifact_dowsing_rod',
    passiveText: 'Fog costs less to clear',
    passive: {
      stat: 'revealCost', scope: null, op: 'mul',
      base: ab('DowsingRod').passiveBase, perLevel: ab('DowsingRod').passivePerLevel,
    },
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
  /** The threat type dominating its depths: a dungeon rewards a COMPOSITION
   *  rather than a single unit. 'Any' rotates. */
  affinity: UnitId | 'Any';
  /** Granted, guaranteed, on the first full clear. No randomness on the thing
   *  that gates a system. */
  artifact: ArtifactId;
  /** The gate that holds the entrance (Docs/features/18-garrisons-and-raids.md). */
  guard: GuardDef;
}

/**
 * The garrison on a ruin's doorstep, and its clock.
 *
 * `threat` is a unit type or 'Any', and the creature is DERIVED from it —
 * there is no second list to keep in step (§2). It is also the ruin's
 * affinity, so the first fight teaches the matchup the whole ruin is built
 * on. `power` is the gate's budget, authored BELOW the ruin's first room:
 * the gate is easier than the room it guards, because it is the room the
 * player is pushed into on a clock.
 */
export interface GuardDef {
  threat: UnitId | 'Any';
  power: number;
  /** Minutes from DISCOVERY to the first raid. */
  warningMinutes: number;
  /** Minutes between raids after that. */
  periodMinutes: number;
}

/**
 * ONE DEPTH OF ONE RUIN (Docs/features/11-expeditions.md §2).
 *
 * A ruin is depths of ROOMS and a room is one fight, resolved the instant the
 * player enters it. Rooms are cleared in order and never replayed, so a
 * depth is a ladder the player climbs once: `power_start` is what room 1
 * fields and `power_step` is what each room adds.
 */
export interface DepthDef {
  ruin: RuinId;
  /** 1-based. The canonical address of a fight is `Depth D · Room R`. */
  depth: number;
  rooms: number;
  /** The Adventurers' Guild level that opens it. Nothing reads it yet — the
   *  Guild is unbuilt, so a depth opens when the one above it is finished. */
  guildReq: number;
  powerStart: number;
  powerStep: number;
  /** Scales what every room in the depth pays (§7.1). */
  rewardBase: number;
  /** Who the generator may spend part of a room's budget on, above the
   *  threshold ([`combat.md`](combat.md) §11). Empty = squads only. */
  villainPool: string;
  /** Who stands in the last room of the depth, always — a boss's villain is
   *  authored, never rolled (§11). */
  bossVillain: string;
  /** What ONE room attempt costs, paid on entry and never refunded. */
  supplies: Wallet;
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
  x: number; y: number; tier: number; affinity: string; artifact: string;
  guard: { threat: string; power: number; warningMinutes: number; periodMinutes: number };
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
      affinity: b.affinity as RuinDef['affinity'],
      artifact: b.artifact as ArtifactId,
      guard: { ...b.guard, threat: b.guard.threat as GuardDef['threat'] },
    }];
  }),
) as Record<RuinId, RuinDef>;

/** Every depth of every ruin, in ruin order then depth order. */
export const DEPTHS = balance.depths as DepthDef[];

/** The depths of one ruin, shallowest first. */
export const depthsOf = (ruinId: RuinId): DepthDef[] =>
  DEPTHS.filter((d) => d.ruin === ruinId);

export const depthDef = (ruinId: RuinId, depth: number): DepthDef | undefined =>
  DEPTHS.find((d) => d.ruin === ruinId && d.depth === depth);

/** How many depths a ruin has, and how many rooms in all of them. */
export const depthCount = (ruinId: RuinId): number => depthsOf(ruinId).length;
export const roomCount = (ruinId: RuinId): number =>
  depthsOf(ruinId).reduce((sum, d) => sum + d.rooms, 0);

/**
 * What room `room` of depth `depth` fields:
 * `power_start + power_step × (room − 1)` (§6).
 */
export function roomPower(ruinId: RuinId, depth: number, room: number): number {
  const def = depthDef(ruinId, depth);
  if (def === undefined) return 0;
  return def.powerStart + def.powerStep * (Math.max(1, room) - 1);
}

// ------------------------------------------------------------------ heroes

/**
 * A hero is MANDATORY on every expedition, so heroes gate delve throughput as
 * well as capability. One is free at the start; the rest come from the gacha —
 * and a second is a prize twice over: another delve at a time, and coverage of
 * another matchup.
 */
/**
 * What a hero's rarity is worth: its stats, the magnitude of its trait, and
 * WHICH banner can roll it. A banner weights each rarity and a weight of 0 is
 * what keeps a rarity off a banner, so the weights ARE the pool — there is no
 * pool column and no rate-up table (Docs/features/10-heroes.md §5).
 */
export type HeroRarity = 'Common' | 'Rare' | 'Legendary';
export const HERO_RARITIES: HeroRarity[] = ['Common', 'Rare', 'Legendary'];

export type HeroTrait =
  | 'PartyDefence' | 'SupplyDiscount' | 'KnowledgeBonus' | 'FragmentBonus'
  /** How many of the fallen are carried home alive. Read where a fight's
   *  casualties are split (Docs/features/combat.md §4) — a hero with it is
   *  worth bringing precisely when a fight is going to be expensive. */
  | 'WoundedRecovery';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  glyph: string;
  sprite: string;
  /** Heroes carry a unit type of their own, so the hero choice feeds the same
   *  matchup chart as the troops. */
  rarity: HeroRarity;
  unitType: UnitId;
  trait: HeroTrait;
  traitValue: number;
  traitText: string;
  /** The body it brings to the board: it hits for `dmg` every `cooldown`
   *  ticks with a frontage of one, and dies when its `hp` runs out — which
   *  stops it attacking and nothing else (Docs/features/combat.md §9.1). */
  dmg: number;
  def: number;
  hp: number;
  cooldown: number;
  dmgPerLevel: number;
  defPerLevel: number;
  hpPerLevel: number;
  /**
   * THE PASSIVE (§9.2). Applies to every squad on this hero's side whose type
   * matches its own — no effect on any other type — computed at battle start
   * and standing whether or not the hero survives.
   */
  troopDmgMult: number;
  troopHpMult: number;
  troopDefBonus: number;
}

/**
 * A VILLAIN is an enemy hero.
 *
 * Same schema, same slots, same rules — the resolver has one code path and
 * reads a resolved stat block either way. The only difference is where the
 * numbers come from: a hero's are derived from its level, a villain's are
 * authored per room (Docs/features/combat.md §9).
 */
export interface VillainDef {
  id: VillainId;
  name: string;
  glyph: string;
  sprite: string;
  unitType: UnitId;
  dmg: number;
  def: number;
  hp: number;
  cooldown: number;
  /** What it costs the generator against a room's budget — its own output
   *  AND the buff it hands the squads beside it (§11). */
  power: number;
  troopDmgMult: number;
  troopHpMult: number;
  troopDefBonus: number;
}

export type VillainId = keyof typeof balance.villains;

export const VILLAINS: Record<VillainId, VillainDef> = Object.fromEntries(
  Object.entries(balance.villains).map(([id, v]) => [id, { id: id as VillainId, ...v }]),
) as Record<VillainId, VillainDef>;

export const VILLAIN_ORDER = Object.keys(VILLAINS) as VillainId[];

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
    name: 'The Scout', title: 'Goes on ahead', glyph: '🧭', sprite: 'hero_scout',
    traitText: 'Knows the short road — a room costs 40% less to supply',
  },
  Adventurer: {
    name: 'The Adventurer', title: 'In it for the story', glyph: '🎒',
    sprite: 'hero_adventurer',
    traitText: 'Brings back 25% more fragments',
  },
  Bard: {
    name: 'The Bard', title: 'Sings the road shorter', glyph: '🎻',
    sprite: 'hero_bard',
    traitText: 'Brings back 25% more Stardust',
  },
  BeastkinHunter: {
    name: 'The Beastkin Hunter', title: 'Reads a trail nobody else sees', glyph: '🐺',
    sprite: 'hero_beastkin_hunter',
    traitText: 'Lives off the land — a room costs 15% less to supply',
  },
  Cleric: {
    name: 'The Cleric', title: 'Keeps the wounded upright', glyph: '✚',
    sprite: 'hero_cleric',
    traitText: 'Walks the field afterwards — 15% more of the fallen reach a bed',
  },
  Cook: {
    name: 'The Cook', title: 'Makes a week of three days’ rations', glyph: '🍲',
    sprite: 'hero_cook',
    traitText: 'Packs light — expeditions cost 15% less to supply',
  },
  Gardener: {
    name: 'The Gardener', title: 'Patient with everything that grows', glyph: '🌿',
    sprite: 'hero_gardener',
    traitText: 'The whole party fights harder to stay standing (+20% defence)',
  },
  Joker: {
    name: 'The Joker', title: 'Pockets what nobody was watching', glyph: '🃏',
    sprite: 'hero_joker',
    traitText: 'Brings back 25% more fragments',
  },
  Merchant: {
    name: 'The Merchant', title: 'Never pays the asking price', glyph: '⚖️',
    sprite: 'hero_merchant',
    traitText: 'Packs light — expeditions cost 15% less to supply',
  },
  Priest: {
    name: 'The Priest', title: 'Says the words that hold a line', glyph: '🕯️',
    sprite: 'hero_priest',
    traitText: 'Says the words over them — 15% more of the fallen reach a bed',
  },
  Rogue: {
    name: 'The Rogue', title: 'Light fingers, lighter step', glyph: '🗡️',
    sprite: 'hero_rogue',
    traitText: 'Brings back 25% more fragments',
  },
  ThreeMice: {
    name: 'Three Mice in a Coat', title: 'Nobody has ever asked', glyph: '🐭',
    sprite: 'hero_three_mouses',
    traitText: 'Brings back 25% more Stardust',
  },
  Sellsword: {
    name: 'The Sellsword', title: 'Paid by the day, loyal by the hour', glyph: '⚔️',
    sprite: 'hero_warrior',
    traitText: 'The whole party fights harder to stay standing (+20% defence)',
  },
  DarkKnight: {
    name: 'The Dark Knight', title: 'Owes somebody something', glyph: '🖤',
    sprite: 'hero_dark_knight',
    traitText: 'The whole party fights harder to stay standing (+30% defence)',
  },
  Paladin: {
    name: 'The Paladin', title: 'Has never once been late', glyph: '🛡️',
    sprite: 'hero_paladin',
    traitText: 'Carries them out himself — 25% more of the fallen reach a bed',
  },
  Wizard: {
    name: 'The Wizard', title: 'Certain about the wrong things, loudly', glyph: '🧙',
    sprite: 'hero_wizard',
    traitText: 'Brings back 50% more Stardust',
  },
  Witch: {
    name: 'The Witch', title: 'Knows which mushrooms', glyph: '🌙',
    sprite: 'hero_witch',
    traitText: 'Brings back 50% more Stardust',
  },
  Druid: {
    name: 'The Druid', title: 'Eats what the road offers', glyph: '🍃',
    sprite: 'hero_druid',
    traitText: 'Knows which leaves close a wound — 25% more of the fallen reach a bed',
  },
  IceLancer: {
    name: 'The Ice Lancer', title: 'Colder than the depth she stands in', glyph: '❄️',
    sprite: 'hero_ice_lancer',
    traitText: 'The whole party fights harder to stay standing (+30% defence)',
  },
  HolyWarrior: {
    name: 'The Holy Warrior', title: 'Digs where the light falls', glyph: '☀️',
    sprite: 'hero_holy_warrior',
    traitText: 'Brings back 50% more fragments',
  },
  SavageWarrior: {
    name: 'The Savage', title: 'Takes the whole door with him', glyph: '🪓',
    sprite: 'hero_savage_warrior',
    traitText: 'Brings back 50% more fragments',
  },
  Spymaster: {
    name: 'The Spymaster', title: 'Was already down there yesterday', glyph: '🕵️',
    sprite: 'hero_spymaster',
    traitText: 'Had the road scouted already — a room costs 25% less to supply',
  },
  ElectricArcher: {
    name: 'The Storm Archer', title: 'Counts the seconds between', glyph: '⚡',
    sprite: 'hero_electric_archer',
    traitText: 'Brings back 50% more Stardust',
  },
  GoldenDragon: {
    name: 'The Golden Dragon', title: 'Older than the ruin, and bored of it', glyph: '🐉',
    sprite: 'hero_golden_dragon',
    traitText: 'The whole party fights harder to stay standing (+45% defence)',
  },
  VampireLord: {
    name: 'The Vampire Lord', title: 'Collects, and has done for centuries', glyph: '🦇',
    sprite: 'hero_vampire_lord',
    traitText: 'Brings back 85% more fragments',
  },
  Necromancer: {
    name: 'The Necromancer', title: 'Asks the previous expedition', glyph: '💀',
    sprite: 'hero_necromancer',
    traitText: 'Brings back 85% more Stardust',
  },
  Pharao: {
    name: 'The Pharaoh', title: 'Was buried with better men', glyph: '𓂀',
    sprite: 'hero_pharao',
    traitText: 'Death waits when he says so — 40% more of the fallen reach a bed',
  },
  ElvenPrincess: {
    name: 'The Elven Princess', title: 'Travels light, and expects you to', glyph: '🌸',
    sprite: 'hero_elven_princess',
    traitText: 'Packs light — expeditions cost 40% less to supply',
  },
};

const heroBalance = balance.heroes as Record<HeroId, {
  rarity: string; unitType: string; trait: string; traitValue: number;
  dmg: number; def: number; hp: number; cooldown: number;
  dmgPerLevel: number; defPerLevel: number; hpPerLevel: number;
  troopDmgMult: number; troopHpMult: number; troopDefBonus: number;
}>;

export const HEROES: Record<HeroId, HeroDef> = Object.fromEntries(
  (Object.keys(heroContent) as HeroId[]).map((id) => {
    const b = heroBalance[id];
    return [id, {
      id,
      ...heroContent[id],
      rarity: b.rarity as HeroRarity,
      unitType: b.unitType as UnitId,
      trait: b.trait as HeroTrait,
      traitValue: b.traitValue,
      dmg: b.dmg, def: b.def, hp: b.hp, cooldown: b.cooldown,
      dmgPerLevel: b.dmgPerLevel, defPerLevel: b.defPerLevel, hpPerLevel: b.hpPerLevel,
      troopDmgMult: b.troopDmgMult,
      troopHpMult: b.troopHpMult,
      troopDefBonus: b.troopDefBonus,
    }];
  }),
) as Record<HeroId, HeroDef>;

/** Roster order: the five the game shipped with, then the rest by rarity.
 *  It is the pool order and the order every roster screen lists. */
export const HERO_ORDER: HeroId[] = [
  'Warden', 'Quartermaster', 'Scholar', 'RelicHunter', 'Scout', 'Adventurer', 'Bard',
  'BeastkinHunter', 'Cleric', 'Cook', 'Gardener', 'Joker', 'Merchant', 'Priest', 'Rogue',
  'ThreeMice', 'Sellsword', 'DarkKnight', 'Paladin', 'Wizard', 'Witch', 'Druid',
  'IceLancer', 'HolyWarrior', 'SavageWarrior', 'Spymaster', 'ElectricArcher',
  'GoldenDragon', 'VampireLord', 'Necromancer', 'Pharao', 'ElvenPrincess'
];

/** Every hero of a rarity, in roster order. The pool a banner rolls from is
 *  this, narrowed to what the player does not own yet. */
export const heroesOfRarity = (rarity: HeroRarity): HeroId[] =>
  HERO_ORDER.filter((id) => HEROES[id].rarity === rarity);

// ------------------------------------------------------------------ banners

export type BannerId = 'basic' | 'advanced';

export interface BannerDef {
  id: BannerId;
  name: string;
  /** The currency one pull costs. One key per banner, and the key is what
   *  tells the two apart before the player has read a single number. */
  key: CurrencyId;
  /** What one key costs in Gems, in the store. */
  keyGemCost: number;
  heroChance: number;
  softPityAt: number;
  hardPityAt: number;
  /** Pulls since the last Legendary that force one. 0 = this banner has no
   *  Legendary to guarantee, which the importer ties to a zero weight. */
  legendaryPityAt: number;
  weights: Record<HeroRarity, number>;
  duplicateFragments: number;
  fragmentsPerMiss: number;
  pullStardust: number;
  /** Free pulls a day for a rewarded ad, and how long between them. */
  freePerDay: number;
  freeCooldownSeconds: number;
}

const bannerContent: Record<BannerId, { name: string }> = {
  basic: { name: 'The common call' },
  advanced: { name: 'The golden call' },
};

export const BANNERS: Record<BannerId, BannerDef> = Object.fromEntries(
  (Object.keys(bannerContent) as BannerId[]).map((id) => {
    const b = (balance.banners as Record<string, Omit<BannerDef, 'id' | 'name'>>)[id];
    if (!b) throw new Error(`balance.json is missing the banner "${id}"`);
    return [id, { id, ...bannerContent[id], ...b }];
  }),
) as Record<BannerId, BannerDef>;

export const BANNER_ORDER = Object.keys(bannerContent) as BannerId[];

/** Delve rewards, the 50% failure bite, and party slots. */
export const DELVE = balance.delve;
export const PARTY = balance.party;

/**
 * What a garrison is worth per ruin TIER: how many seconds of the city's own
 * production a raid takes of each material, and what clearing that tier's
 * gate costs in supplies. Everything ELSE about a gate — its creature, its
 * power and its two counters — is authored by coordinate in `?dev=map`,
 * because it belongs to the site rather than to the tier
 * (Docs/features/18-garrisons-and-raids.md §8).
 */
export interface GarrisonDef {
  tier: number;
  takeSeconds: number;
  supplies: Wallet;
}

export const GARRISONS = balance.garrisons as GarrisonDef[];

/** The tier row, or the deepest one authored — a ruin can never fall off the
 *  end of the table and take nothing. */
export const garrisonForTier = (tier: number): GarrisonDef =>
  GARRISONS.find((g) => g.tier === tier) ?? GARRISONS[GARRISONS.length - 1];

/** How a raid is bounded: a fraction of the purse, and a trip count. */
export const RAID = balance.raid;
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
  RoyalChest: { name: 'The Royal chest', description: "The daily chest's second track, for one season.", sprite: 'royal_chest' },
};

/** The Gem packs alone, for the store's 3×2 grid. A SKU that grants no Gems
 *  on purchase is sold where it is UNDERSTOOD, not on the pack shelf
 *  (Docs/features/12-quests.md §3.3). */
export const GEM_PACK_ORDER = (Object.keys(balance.store) as StoreSkuId[])
  .filter((id) => (balance.store as Record<string, { gems: number }>)[id]!.gems > 0);

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

/** The daily chest season — Docs/features/12-quests.md §3. Parallel lists,
 *  one per reward kind; their length IS the length of the ladder. The free
 *  track is `manaFractions` and `gems`; the Royal track is the `premium*`
 *  ones. */
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

/**
 * The authored schedule. EMPTY on purpose (2026-09-08): the Conjunction was
 * retired and events are being redesigned, so the timeline machinery stands
 * with no content in it. Adding a template here is all it takes to schedule
 * one again ([`Docs/features/13-events.md`]).
 */
export const EVENTS: readonly EventTemplate[] = [];

export const GAME_VERSION = '0.1.0';
// v16 predates Mana, artifacts and expeditions. Everything those add is
// ADDITIVE, and every module read in save.ts defaults — so this bump needs no
// migrator, only the version (see Docs/implementation-plan.md §1).
// v18 predates ad offers. `kingdom.adOffers` is additive and its reader
// defaults, so this bump needs no migrator either.
// v31 adds the decorations. Nothing new is SERIALIZED — Harmony is derived
// from the built set — but a save can now name a district id a build without
// them cannot resolve, and `DefinitionID` is read as a blind cast. The bump
// is what makes an older build REFUSE such a save instead of loading it and
// finding an undefined definition; no migrator, since an older save simply
// has no decoration in it.
// v32 adds the two banners: two wallet keys on the player wallet, and
// `gacha.legendaryPity` and `gacha.freePulls`. Every one of them is additive
// and read defensively, so there is no migrator; the bump exists so that a
// build without the keys refuses a save that holds them rather than dropping
// what the player paid Gems for.
// v33 predates the daily refill allowances. `kingdom.adOffers.Refills` is
// additive and its reader defaults to a fresh day, so there is no migrator;
// the bump exists so a build without the counters refuses a save that holds
// them rather than handing the player unlimited refills.
// v34 predates the mana refill split. v35 turns the daily chest into a SEASON
// with a second track: `Daily.LadderStep` becomes `Daily.Rung` inside a
// `Daily.Season`, and `Daily.RoyalSeason` records the paid track. The rung
// count means something different from the step count, so this one HAS a
// migrator (save.ts) — it drops the old block and lands the player in the
// running season owing nothing.
// v39 predates the open board: `PartySlotsPurchased` is retired with the
// troop-slot ladder, and a save that holds one is simply read without it.
// v38 predates the party of heroes: a delve carried ONE `HeroID` and the
// roster had no `HeroSlotsPurchased`. Both readers default — a one-hero save
// reads as a party of one, and a roster with no purchases has the free slot
// only — so there is no migrator; the bump exists so a build without hero
// slots refuses a save that holds them rather than dropping what the player
// paid Gems for.
export const SAVE_VERSION = 43;
