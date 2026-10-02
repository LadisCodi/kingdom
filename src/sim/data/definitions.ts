// Game data definitions. Identity/content (names, descriptions, glyphs,
// sprites, rules wiring) lives here; every balancing NUMBER comes from
// `balance.ts` — one file per collection in `data/game/`, authored in the
// data editor (`?dev=data`, Docs/plans/data-editor.md).
// Lists indexed "per level" are 1-based by (level − 1) and clamp to the last entry.
//
// MAP content is the exception: terrain, features, landmarks and lairs are
// authored by coordinate, so they live in region-map.json and are edited in
// the map editor (?dev=map), not in the workbook. See Docs/map-editor.md.

import balance from './balance';
import regionMap from './region-map.json';
import treeDoc from './tech-tree.json';
import {
  eraCells, eraCount, isPlaced, techIds, type TechKind, type TechTreeDoc, type TechUnlock,
} from './techTreeRules';
import type { TechEffect } from './techEffectRules';
import type { Rarity } from './seasons';
import type { ModifierScope, ModifierStat } from '../modifiers';
import type { RolledRole, WorldFeature, WorldImprovement, WorldTerrain } from '../world/types';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, FeatureId, GoodId, GoodsStock,
  HarvestSourceId, HeroId,
  LandmarkKind, LairId, StoreSkuId, TechId, TerrainId, TomeId, TrainableId, UnitId,
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
  cost: Wallet; // city Gold and kingdom Knowledge
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
export const STORAGE = balance.storage;

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

// -------------------------------------------------------------------- quests

/** Absolute types are state predicates (done-or-not, regardless of when the
 *  quest activated); relative types count events only while active. */
export type QuestGoalType =
  | 'BuildDistrict' | 'RepairDistrict' | 'UpgradeDistrict' | 'HoldResource' | 'ReachPopulation'
  | 'CompleteTech' | 'CompleteTechs' | 'AssignWorkers' | 'TrainArmy'
  | 'CollectResource' | 'CollectTaps' | 'DiscoverCells' | 'DiscoverFeature'
  | 'ClaimLandmarks' | 'FindLairs' | 'ClearLairs' | 'OwnArtifacts'
  | 'OwnHeroes';

export const RELATIVE_QUEST_TYPES: ReadonlySet<QuestGoalType> =
  new Set([
    'CollectResource', 'CollectTaps', 'DiscoverFeature',
  ]);

export interface QuestDef {
  id: string; // content id — data-side, not a TS union
  /** Flavour: "Timber!", "Tax day". What the quest ASKS is not written down —
   *  `questLine()` renders it from the goal below (src/sim/questProse.ts). */
  name: string;
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
  /** A card pack handed over on the claim, or null. The first one is how the
   *  collection is met (Docs/features/22-progression.md §7). */
  rewardPack: PackTier | null;
  /** Claims itself the moment it is done (Docs/features/12-quests.md §1). */
  autoClaim: boolean;
}

/** The chain, in sheet order — one quest active at a time. */
export const QUESTS = balance.quests as unknown as QuestDef[];

// ------------------------------------------------------------- the stage
//
// The first-time experience's scenes, speakers and help timings
// (Docs/features/23-tutorials.md, 24-dialogue.md). Data the SIM never reads:
// the stage is UI. They live here beside the quests they walk through so the
// tool, the tests and the stage read one definition.

/** What starts a scene, or moves a line on. The kinds are code
 *  (`src/ui/stage/conditions.ts`); which one a line waits on is data. */
export type SceneCondition =
  | 'tap' | 'always' | 'questReached' | 'questComplete' | 'questClaimed' | 'questProgress'
  | 'techDone' | 'techFilled' | 'placing' | 'placed' | 'built' | 'overlay' | 'noOverlay' | 'mainScreen' | 'ui'
  | 'taps' | 'lairFound' | 'lairDefeated' | 'lairCleared' | 'landmarkClaimed' | 'landmarkSeen'
  | 'bookOpen' | 'doorOpen' | 'manaEmpty' | 'buildersBusy' | 'raided' | 'wounded' | 'heroes'
  | 'population' | 'training' | 'revealed' | 'featureSeen' | 'sighted'
  | 'treasureRevealed' | 'treasurePicked' | 'abandonedRevealed' | 'siteOpen' | 'repairing';

export interface SceneLine {
  speaker: string;
  side: 'left' | 'right';
  text: string;
  box: 'bottom' | 'top' | 'middle' | 'auto';
  /** What the pointer shows; empty = nothing (24-dialogue.md §4). */
  point: string;
  lock: 'none' | 'target' | 'map' | 'all';
  until: SceneCondition;
  untilTarget: string;
  untilAmount: number;
  exit: boolean;
  /** The speaker's face on this line — `<portrait>_<expression>` art; empty
   *  is at rest (24-dialogue.md §6). */
  expression: '' | 'happy' | 'worried' | 'surprised' | 'idea';
  /** A book the speaker hands the player as this line is read; absent or
   *  null hands nothing (Docs/features/24-dialogue.md §3). */
  gives?: TomeId | null;
  /** A building the speaker makes up the price of: the line plays only while
   *  the wallet cannot pay for one more of it, and as it is read hands over
   *  what is missing. Absent or null: an ordinary line. */
  stocks?: DistrictId | null;
}

export interface SceneDef {
  id: string;
  trigger: Exclude<SceneCondition, 'tap'>;
  triggerTarget: string;
  triggerAmount: number;
  /** May start over a sheet the player opened. */
  anywhere: boolean;
  skippable: boolean;
  lines: SceneLine[];
}

export interface SpeakerDef {
  name: string;
  title: string;
  portrait: string;
  frame: 'figure' | 'medallion';
}

/** Every scene, in the order the stage considers them. */
export const SCENES = balance.scenes as unknown as SceneDef[];
export const SPEAKERS = balance.speakers as unknown as Record<string, SpeakerDef>;
/** The help's timings (23-tutorials.md §5, §8). */
export const HELP = balance.help as {
  idleWiggleSeconds: number; idleAdvisorSeconds: number; advisorRestSeconds: number;
  advisorShowSeconds: number; pointerSeconds: number; untilQuest: string;
  lockFailsafeSeconds: number; typeCharsPerSecond: number; sceneGapSeconds: number;
  inputGraceSeconds: number;
};

/** The full-screen splash a big unlock opens with (23-tutorials.md §4.6):
 *  a door of the UI or a book of research. `target` is a `DoorId` or a
 *  `TomeId` by `kind` (checked by `dataRules.ts`). */
export interface UnlockDef {
  kind: 'door' | 'book';
  target: string;
  title: string;
  text: string;
  icon: string;
}

/** Every unlock splash, by id, in the order two that open at once are shown. */
export const UNLOCKS = balance.unlocks as unknown as Record<string, UnlockDef>;

// ----------------------------------------------------------------- districts

/** The Build menu's three tabs, in their order on the menu. */
export const BUILD_TABS = ['Economy', 'Military', 'Decoration'] as const;
export type BuildTab = typeof BUILD_TABS[number];

export interface DistrictDef {
  id: DistrictId;
  name: string;
  /** The build card's one line (src/ui/buildPromise.ts). */
  promise: string;
  /** The Build menu tab it is listed under. */
  buildTab: BuildTab;
  description: string;
  buildable: boolean;
  glyph: string; // placeholder art (fallback when no sprite image is present)
  sprite: string; // asset filename stem in src/render/assets (e.g. 'townhall' → townhall.png)
  /** Who works it: character names from the animated atlas, one cast per
   *  worker by a stable hash (src/render/cast.ts). Empty = no crew drawn. */
  crew: readonly string[];
  /** Footprint in cells; `location` is the top-left (anchor) cell. */
  size: { x: number; y: number };
  /** Fog fully revealed this far around the footprint (at seed / build completion). */
  fogRevealRadius: number;
  /** The same, by level — the last value holding past it; an upgrade
   *  reveals its new ring. Empty: `fogRevealRadius` at every level. */
  fogRevealRadiusPerLevel: readonly number[];
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
  /** Gold a minute the building makes BY ITSELF, with nobody living in it,
   *  into its store, by level — the Townhall's own income, so the city always
   *  has a source of Gold. Empty = none of its own. */
  goldPerMinutePerLevel: readonly number[];
  /** What it holds uncollected, in units, by level: a house's rent, a
   *  producer's hauls. Production stops while it is full; a tap empties it
   *  into the wallet (Docs/features/03-economy.md §3.2). Empty = it makes
   *  nothing that waits for a tap. */
  storageCapacityPerLevel: readonly number[];
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
  /** Percent more Hero XP the kingdom earns while this stands — the TOTAL at
   *  each level. Only the Tavern has any (Docs/features/22-progression.md §6). */
  heroXpBonusPerLevel: readonly number[];
  /** Armies more the kingdom can have out on the world board, the TOTAL at
   *  each level. Only the War Camp has any (Docs/features/19-world-map.md §4). */
  armySlotsPerLevel: readonly number[];
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

/**
 * Every building, whole, as `data/game/buildings.json` holds it — identity,
 * art, crew and every number — authored in the data editor. The ids its lists
 * name arrive as plain strings, already checked by its schema
 * (`schema/buildings.json`). The tech GATES are not here: they are the
 * technologies' to state, and `districtGates` adds them below.
 */
const DISTRICT_CONTENT: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(balance.districts).map(([id, b]) => [id, { id, ...b }]),
);

/** Every building the player may place, in the file's order — which is the
 *  build menu's. A new building authored in `?dev=data` joins it. */
const DISTRICT_IDS_IN_ORDER = Object.keys(balance.districts) as DistrictId[];
export const BUILDABLE_DISTRICTS: DistrictId[] =
  DISTRICT_IDS_IN_ORDER.filter((id) => balance.districts[id].buildable);

/** Every workshop — a building that `produces` a good — in build-menu order. */
export const WORKSHOPS: DistrictId[] =
  DISTRICT_IDS_IN_ORDER.filter((id) => balance.districts[id].produces !== null);

/** Every decoration — a building that supplies Harmony — in the file's order,
 *  which is cheapest first and so the order their Townhall gates open in. The
 *  build menu shows them as their own section. */
export const DECORATIONS: DistrictId[] =
  DISTRICT_IDS_IN_ORDER.filter((id) => balance.districts[id].harmonySupply > 0);

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
  /**
   * HOW BIG A BLOCK OF THIS FEATURE MAY BE, in cells a side. 1 unless stated.
   *
   * Some features are ONE OBJECT and some are a mass of small ones. A forest
   * is a stand of trees on this cell and another stand on the next; a
   * mountain is a mountain. So painted mountain cells are GROUPED into square
   * footprints up to this size, drawn once across the whole block, revealed
   * together and exhausted from one depot
   * (Docs/features/01-map-and-fog.md §3.1).
   *
   * Iron and gold stay at 1: a lone rich outcrop reads, and three sizes of
   * each is nine more drawings for no gain.
   */
  maxFootprint?: number;
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
    maxFootprint: 3,
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

/** What the people who fled left on the ground — a coin under the fog, due
 *  every few cells revealed (Docs/features/01-map-and-fog.md §6.2). */
export const TREASURE = balance.treasure as {
  everyReveals: number;
  workSeconds: number;
  floor: Partial<Record<CurrencyId, number>>;
  weights: Partial<Record<CurrencyId, number>>;
  knowledge: number;
  firstCoin: CurrencyId;
  firstAmount: number;
};

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
 * The shelf, in reading order: the three general books, then the found ones.
 *
 * Civics is open from the first minute; every other book opens on a fact
 * about the world, never on a research (`sim/research.ts#TOME_OPENS`,
 * Docs/features/22-progression.md §4). What paces an open book is its era
 * bars, which ask for revealed cells.
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
    blurb: 'The army, and the lairs it clears.',
  },
  Sagas: {
    id: 'Sagas', name: 'Sagas', glyph: '📖',
    blurb: 'Heroes, and the Tavern that hosts them.',
  },
  Atlas: {
    id: 'Atlas', name: 'Atlas', glyph: '🧭',
    blurb: 'Sight, landmarks, and the world beyond the province.',
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

/**
 * The four pack tiers (Docs/features/09-relics.md §6). A tier says how many
 * cards a pack holds and which rarities it can hold, at PUBLISHED odds — the
 * whole faucet, in four rows.
 */
export type PackTier =
  // The six SOBRES, named for the rarity each guarantees.
  | 'Green' | 'Yellow' | 'Rose' | 'Blue' | 'Purple' | 'Golden'
  // The three CHESTS. Not a faucet: what duplicates buy, in the vault.
  | 'BronzeChest' | 'SilverChest' | 'GoldChest';

export const PACK_ORDER: readonly PackTier[] = [
  'Green', 'Yellow', 'Rose', 'Blue', 'Purple', 'Golden',
  'BronzeChest', 'SilverChest', 'GoldChest',
];

/** Sobres only, easiest first — the ladder a player reads. */
export const SOBRE_ORDER: readonly PackTier[] = [
  'Green', 'Yellow', 'Rose', 'Blue', 'Purple', 'Golden',
];

export const CHEST_ORDER: readonly PackTier[] = [
  'BronzeChest', 'SilverChest', 'GoldChest',
];

/**
 * THE SEVEN FACES a card can wear: five rarities and the gold editions of the
 * top two. Gold is a FACE rather than a coin flipped after the rarity, which
 * is what stops a pack having a rarity it can never reach — the old shape
 * built hard walls, and an album behind one was impossible rather than dear.
 *
 * The order is the order of every `weights` array and of `starsPerFace`.
 */
export const FACE_ORDER = [
  '1star', '2star', '3star', '4star', '5star', '4gold', '5gold',
] as const;
export type FaceId = (typeof FACE_ORDER)[number];

/** A face as the collection reads it: a rarity, and whether it is the gold
 *  edition of that rarity. */
export const faceOf = (id: FaceId): { rarity: number; gold: boolean } => ({
  rarity: Number(id[0]),
  gold: id.endsWith('gold'),
});

export interface PackDef {
  /** Total cards the pack holds, guarantees included. */
  cards: number;
  /** How many of each face the pack ALWAYS holds. */
  guarantees: Partial<Record<FaceId, number>>;
  /** What the remaining `cards − Σguarantees` slots roll on, in `FACE_ORDER`.
   *  Weights rather than percentages so a row can be retuned without
   *  rebalancing it to 100. */
  weights: number[];
  /** What the store charges, or **0 for one the store does not sell** — which
   *  is how the three free sobres stay the faucet and the chests the vault's. */
  gemCost: number;
}

export const PACKS: Record<PackTier, PackDef> = Object.fromEntries(
  PACK_ORDER.map((id) => {
    const b = (balance.packs as Record<string, {
      cards: number; guarantees: Record<string, number>; weights: number[]; gemCost: number;
    }>)[id];
    return [id, {
      cards: b.cards,
      guarantees: b.guarantees as Partial<Record<FaceId, number>>,
      weights: b.weights,
      gemCost: b.gemCost,
    }];
  }),
) as Record<PackTier, PackDef>;

/**
 * The HERO collection substrate: Fragments raise a tier cap and Hero XP buys
 * levels within it.
 *
 * It used to be shared with the relics, and is not any more: a relic is
 * levelled by finishing its album and by nothing else, so it has no tier, no
 * Fragments and no level cap (Docs/features/09-relics.md §13).
 */
export const COLLECTION = balance.collection;

/**
 * What a relic waits before its ability can be cast again — counted from the
 * moment the WINDOW CLOSES, never from the cast (Docs/features/09-relics.md
 * §2.1).
 *
 * Flat across all eight relics and at every level. A cooldown that shrank with
 * the level would be a discount wearing a hat, and a relic that did more AND
 * did it more often would grow on two axes at once.
 */
export const ARTIFACT_COOLDOWN_SECONDS = balance.artifactCooldownSeconds;

/**
 * THE LEVELS AT WHICH AN ABILITY'S RADIUS STEPS UP, one ring each and the same
 * three rungs on every relic (Docs/features/09-relics.md §2.1).
 *
 * The one number of an active that does NOT creep. A Chebyshev radius covers
 * `(2r+1)²` cells, so each rung roughly DOUBLES the ground — and a number that
 * doubles cannot creep, but it makes a superb milestone.
 */
export const ARTIFACT_RADIUS_STEPS: readonly number[] = balance.artifactRadiusSteps;

/**
 * HOW FAST AN AUTO-TAP ABILITY SPENDS ITS BUDGET, taps a second.
 *
 * It buys no Mana of its own — the cast already paid — so this decides only
 * how long the run takes to WATCH. Holding a finger does 2 a second at 1 Mana
 * each, so the spell is twice the speed at a fraction of the price, and the
 * player can always see which of the two they would rather spend.
 */
export const ARTIFACT_AUTO_TAP_PER_SECOND = balance.artifactAutoTapPerSecond;

/** The Knowledge bar — its drip, its cap, what a landmark and a lair
 *  pay into it, and what a point costs to buy (07-research.md §3). */
export const KNOWLEDGE = balance.knowledge;

export interface LandmarkDef {
  id: string; // content id — data-side, not a TS union
  kind: LandmarkKind;
  location: Coord;
  /** Gold to claim. Authored per sanctuary rather than derived from distance:
   *  the tiers are the design — one in sight to save up for, then two rings
   *  beyond it — and no curve lands on 5,000 / 25,000 / 100,000 exactly. */
  claimCost: number;
  /** How many cells a side it occupies, anchored at `location`. 1 unless
   *  stated (Docs/features/01-map-and-fog.md §3.1). Authored rather than
   *  grouped: a sanctuary is placed, not painted. */
  size: number;
}

export const LANDMARK_ART: Record<LandmarkKind, { name: string; glyph: string; sprite: string }> = {
  Shrine: { name: 'Shrine', glyph: '⛩️', sprite: 'landmark_shrine' },
  StandingStones: { name: 'Standing stones', glyph: '🗿', sprite: 'landmark_stones' },
  Leyspring: { name: 'Leyspring', glyph: '💧', sprite: 'landmark_leyspring' },
  Watchtower: { name: 'Watchtower', glyph: '🗼', sprite: 'landmark_watchtower' },
};

export const LANDMARKS: LandmarkDef[] = (regionMap.landmarks as Array<{
  id: string; kind: string; x: number; y: number; claimCost: number; size?: number;
}>).map((l) => ({
  id: l.id,
  kind: l.kind as LandmarkKind,
  location: { x: l.x, y: l.y },
  claimCost: l.claimCost,
  size: l.size ?? 1,
}));

/** A building standing in ruin where the fog took it, to be found and
 *  repaired (Docs/features/01-map-and-fog.md §6.3). Authored in the map. */
export interface AbandonedDef {
  id: string;
  districtId: DistrictId;
  /** Anchor, top-left; the footprint is the building's own size. */
  location: Coord;
  /** How far its ruin is sighted past the fog; 0 = never. */
  sight: number;
  /** What its card and its banner call it. */
  name: string;
}

export const ABANDONED: readonly AbandonedDef[] = ((regionMap as {
  abandoned?: Array<{ id: string; district: string; x: number; y: number; sight: number; name?: string }>;
}).abandoned ?? []).map((a) => ({
  id: a.id,
  districtId: a.district as DistrictId,
  location: { x: a.x, y: a.y },
  sight: a.sight,
  name: a.name ?? `The old ${DISTRICTS[a.district as DistrictId]?.name ?? a.district}`,
}));

/**
 * A relic: ONE permanent kingdom passive, always on, whose number rises with
 * its level and has no ceiling (Docs/features/09-relics.md §1-§2).
 *
 * Every effect is a speed or a yield, never a discount, because a discount
 * dies at 100%. Hand-authored, one legible effect each, no random rolls —
 * which is what keeps a collection system cozy rather than a spreadsheet.
 *
 * A relic has no battlefield stats and nothing carries one anywhere: the only
 * question a relic asks is which album the player finishes.
 *
 * `active` is the ONE piece of the old model still standing. The four
 * abilities are designed to become Magic-tome SPELLS
 * (Docs/features/07-research.md §6) and that is not built, so they stay on the
 * relic that discovers them, gated on owning it rather than on a socket —
 * deleting them would remove working content in exchange for a doc that
 * already says where they are going.
 */
export interface ArtifactDef {
  id: ArtifactId;
  name: string;
  glyph: string;
  sprite: string;
  /** One line, player-facing, about what having it does. */
  passiveText: string;
  /**
   * ONE IDEA, sometimes spread over more than one number.
   *
   * The Verdant Seal moves a node's stock and what a strike takes out of it,
   * and the Foreman's Sigil moves a crew's swing and its walk: in both cases
   * half the pair alone saturates or reads as nothing, so they are one passive
   * with two stats rather than two passives (Docs/proposals/relic-effects.md
   * §4.2). They share one `base` and one `per_level`, which is not a
   * convenience — it is the design saying the two must move together.
   */
  passive: {
    stats: readonly { stat: ModifierStat; scope: ModifierScope; op: 'add' | 'mul' }[];
    /** Value at level 1, and how much each further level moves it. */
    base: number;
    perLevel: number;
  };
  /** A spell in waiting (see the type docblock); null = it never had one. */
  active: ArtifactActive | null;
  /**
   * WHY THIS RELIC'S NUMBER DOES NOTHING YET, or null when it works.
   *
   * A relic is a whole album — nine cards and a season — so a card that
   * promised an effect the build cannot deliver would be lying to somebody who
   * spent one. The card prints this instead, in muted ink, and the level
   * accrues normally against the day the system lands
   * (Docs/proposals/relic-effects.md §6.4).
   */
  pending: string | null;
}

export type ArtifactActiveId =
  | 'Divining' | 'Reap' | 'Haste' | 'Tithe' | 'Survey' | 'Lamplight';

export interface ArtifactActive {
  id: ArtifactActiveId;
  name: string;
  text: string;
  manaCost: number;
  /** Cast targets a map cell through placement mode. */
  targeted: boolean;
  /** Timed effects only; 0 = instant. The LADDER's base — the levelled window
   *  is `activeDurationMs`. */
  durationSeconds: number;
  /** Seconds a level adds to the window, for the abilities whose growing axis
   *  is how long they last. */
  durationPerLevel: number;
  /** Area effects only; 0 = the target cell alone. The LADDER's base — the
   *  levelled reach is `activeRadiusAt` (Docs/features/09-relics.md §2.1). */
  radius: number;
  /** AUTO-TAP ABILITIES ONLY: taps bought per Mana of the cast, at level 1,
   *  and what a level adds. 0 means this ability does not buy taps at all —
   *  not that it buys none. */
  tapsPerMana: number;
  tapsPerManaPerLevel: number;
  /** HOW HARD IT HITS, for the abilities whose growing axis is power: a
   *  multiplier read inside the zone while the window lasts. 0 = not one. */
  power: number;
  powerPerLevel: number;
  /** USES, for an ability whose window is counted in EVENTS rather than in
   *  seconds. 0 = it is not one of those. */
  charges: number;
  chargesPerLevel: number;
}

type ArtifactBalance = {
  passiveBase: number; passivePerLevel: number;
  activeManaCost: number; activeDurationSeconds: number; activeRadius: number;
  activeTapsPerMana: number; activeTapsPerManaPerLevel: number;
  activePower: number; activePowerPerLevel: number;
  activeDurationPerLevel: number;
  activeCharges: number; activeChargesPerLevel: number;
};
const ab = (id: ArtifactId): ArtifactBalance =>
  (balance.artifacts as Record<ArtifactId, ArtifactBalance>)[id];

export const ARTIFACTS: Record<ArtifactId, ArtifactDef> = {
  DowsingRod: {
    id: 'DowsingRod', name: 'Dowsing Rod', glyph: '🔮', sprite: 'artifact_dowsing_rod',
    passiveText: 'Forests, crops and stone recover faster',
    passive: {
      stats: [{ stat: 'recoverySpeed', scope: null, op: 'mul' }],
      base: ab('DowsingRod').passiveBase, perLevel: ab('DowsingRod').passivePerLevel,
    },
    // A RELIC IS ONE IDEA AT TWO SPEEDS, and this one's idea is RECOVERY. Its
    // ability used to pay a cell's reveal cost, which is a fine spell about a
    // different subject — the passive was about ground coming back and the
    // active was about fog. The fog is the Compass's, and always was.
    //
    // THE REFILL MUST LAND BEFORE THE ZONE MATTERS. A recovery wait is stamped
    // when the cell EXHAUSTS, not read each tick, so a faster-recovery zone
    // only reaches cells that empty inside it — which is exactly what emptying
    // the waiting list first arranges.
    active: {
      id: 'Divining', name: 'Divining', targeted: true,
      manaCost: ab('DowsingRod').activeManaCost,
      durationSeconds: ab('DowsingRod').activeDurationSeconds,
      radius: ab('DowsingRod').activeRadius,
      tapsPerMana: 0, tapsPerManaPerLevel: 0,
      power: ab('DowsingRod').activePower,
      powerPerLevel: ab('DowsingRod').activePowerPerLevel,
      durationPerLevel: ab('DowsingRod').activeDurationPerLevel,
      charges: 0, chargesPerLevel: 0,
      text: 'Wakes every tired node nearby at once, and keeps them coming back',
    },
    pending: null,
  },
  VerdantSeal: {
    id: 'VerdantSeal', name: 'Verdant Seal', glyph: '🌱', sprite: 'artifact_verdant_seal',
    passiveText: 'Richer ground, and more out of every swing',
    passive: {
      stats: [
        { stat: 'harvestStock', scope: null, op: 'add' },
        { stat: 'harvestUnitsPerStrike', scope: null, op: 'add' },
      ],
      base: ab('VerdantSeal').passiveBase, perLevel: ab('VerdantSeal').passivePerLevel,
    },
    // THE SPELL IS AN EXCHANGE RATE (Docs/proposals/relic-effects.md §3.2).
    // It used to clear exhaustion, which was a worse version of the passive
    // said twice; now it BUYS TAPS with the Mana of the cast, and what the
    // level moves is how many each Mana is worth.
    active: {
      id: 'Reap', name: 'Reap', targeted: true,
      manaCost: ab('VerdantSeal').activeManaCost, durationSeconds: 0,
      radius: ab('VerdantSeal').activeRadius,
      tapsPerMana: ab('VerdantSeal').activeTapsPerMana,
      tapsPerManaPerLevel: ab('VerdantSeal').activeTapsPerManaPerLevel,
      power: 0, powerPerLevel: 0, durationPerLevel: 0, charges: 0, chargesPerLevel: 0,
      text: 'Harvests every node nearby, over and over, for free',
    },
    pending: null,
  },
  ForemansSigil: {
    id: 'ForemansSigil', name: 'Foreman’s Sigil', glyph: '⚡', sprite: 'artifact_foremans_sigil',
    passiveText: 'Your crews swing and walk faster',
    passive: {
      stats: [
        { stat: 'workerStrikeSpeed', scope: null, op: 'mul' },
        { stat: 'workerSpeed', scope: null, op: 'mul' },
      ],
      base: ab('ForemansSigil').passiveBase, perLevel: ab('ForemansSigil').passivePerLevel,
    },
    // A ZONE ON BUILDINGS, not a kingdom-wide hour. It used to double
    // `workerYield` everywhere for 60 minutes, which is a relic that asks
    // nothing of the player but the press — there is no wrong place to put a
    // global. Placing it makes it a question: which crews, for five minutes?
    //
    // AND IT IS PLACED ON BUILDINGS, never on workers. A worker walks, so a
    // zone asking where it stood would flicker as it crossed the edge — and
    // travel is Euclidean while a zone is Chebyshev.
    active: {
      id: 'Haste', name: 'Haste', targeted: true,
      manaCost: ab('ForemansSigil').activeManaCost,
      durationSeconds: ab('ForemansSigil').activeDurationSeconds,
      radius: ab('ForemansSigil').activeRadius,
      tapsPerMana: 0, tapsPerManaPerLevel: 0,
      power: ab('ForemansSigil').activePower,
      powerPerLevel: ab('ForemansSigil').activePowerPerLevel,
      durationPerLevel: ab('ForemansSigil').activeDurationPerLevel,
      charges: 0, chargesPerLevel: 0,
      text: 'The crews of every building nearby work much faster for a while',
    },
    pending: null,
  },
  GildedLedger: {
    id: 'GildedLedger', name: 'Gilded Ledger', glyph: '🪙', sprite: 'artifact_gilded_ledger',
    passiveText: 'Your villagers pay more tax',
    passive: {
      stats: [{ stat: 'taxRate', scope: null, op: 'mul' }],
      base: ab('GildedLedger').passiveBase, perLevel: ab('GildedLedger').passivePerLevel,
    },
    // THE OTHER EXCHANGE RATE. Its Mana price is dearer than the Seal's
    // because the ground is: a node empties and stops paying, so the Seal's
    // run hits a wall, where a house always has rent to pay forward and the
    // Ledger's run always spends the whole budget (OQ-99).
    active: {
      id: 'Tithe', name: 'Tithe', targeted: true,
      manaCost: ab('GildedLedger').activeManaCost, durationSeconds: 0,
      radius: ab('GildedLedger').activeRadius,
      tapsPerMana: ab('GildedLedger').activeTapsPerMana,
      tapsPerManaPerLevel: ab('GildedLedger').activeTapsPerManaPerLevel,
      power: 0, powerPerLevel: 0, durationPerLevel: 0, charges: 0, chargesPerLevel: 0,
      text: 'Collects from every house nearby, over and over, for free',
    },
    pending: null,
  },
  DelversLantern: {
    id: 'DelversLantern', name: 'The Delver\u2019s Lantern', glyph: '\u{1F3EE}',
    sprite: 'artifact_delvers_lantern',
    passiveText: 'Every room pays more gold and stone',
    passive: {
      stats: [{ stat: 'roomHaul', scope: null, op: 'mul' }],
      base: ab('DelversLantern').passiveBase, perLevel: ab('DelversLantern').passivePerLevel,
    },
    // COUNTED IN ROOMS, NOT MINUTES. The only clock a delve has is the player
    // opening the next door, so a window of minutes would be a timer running
    // while nothing happens — and a spell bought before a delve would expire
    // in the party screen. It is UNTARGETED for the same reason: a delve is
    // the place, and the player is already standing in it.
    active: {
      id: 'Lamplight', name: 'Lamplight', targeted: false,
      manaCost: ab('DelversLantern').activeManaCost, durationSeconds: 0, radius: 0,
      tapsPerMana: 0, tapsPerManaPerLevel: 0,
      power: ab('DelversLantern').activePower,
      powerPerLevel: ab('DelversLantern').activePowerPerLevel,
      durationPerLevel: 0,
      charges: ab('DelversLantern').activeCharges,
      chargesPerLevel: ab('DelversLantern').activeChargesPerLevel,
      text: 'The next rooms you clear pay double \u2014 cast it before you go down',
    },
    pending: null,
  },
  MusterHorn: {
    id: 'MusterHorn', name: 'The Muster Horn', glyph: '\u{1F4EF}',
    sprite: 'artifact_muster_horn',
    passiveText: 'Your halls field a bigger army',
    passive: {
      stats: [{ stat: 'armyCap', scope: null, op: 'mul' }],
      base: ab('MusterHorn').passiveBase, perLevel: ab('MusterHorn').passivePerLevel,
    },
    active: null,
    pending: null,
  },
  BailiffsTally: {
    id: 'BailiffsTally', name: 'The Bailiff\u2019s Tally', glyph: '\u{1F9FE}',
    sprite: 'artifact_bailiffs_tally',
    passiveText: 'Every improvement you hold pays more an hour',
    passive: {
      stats: [{ stat: 'worldImprovementYield', scope: null, op: 'mul' }],
      base: ab('BailiffsTally').passiveBase, perLevel: ab('BailiffsTally').passivePerLevel,
    },
    active: null,
    // The Sawmill, the Farm and the Quarry are authored in
    // Docs/features/19-world-map.md and the map itself is not built.
    pending: 'when the world map opens',
  },
  WanderersCompass: {
    id: 'WanderersCompass', name: 'Wanderer’s Compass', glyph: '🧭',
    sprite: 'artifact_wanderers_compass',
    passiveText: 'Rooms pay more Stardust',
    passive: {
      stats: [{ stat: 'stardustYield', scope: null, op: 'mul' }],
      base: ab('WanderersCompass').passiveBase, perLevel: ab('WanderersCompass').passivePerLevel,
    },
    // THE FOG IS THE COMPASS'S. It called a depleted resource back, which is
    // the Verdant Seal's subject wearing a compass; what a compass is FOR is
    // ground you have not seen.
    //
    // RADIUS IS ITS WHOLE GROWTH (§2.1) — for a reveal, more ground IS the
    // effect, so it needs no second axis and has none.
    active: {
      id: 'Survey', name: 'Survey', targeted: true,
      manaCost: ab('WanderersCompass').activeManaCost, durationSeconds: 0,
      radius: ab('WanderersCompass').activeRadius,
      tapsPerMana: 0, tapsPerManaPerLevel: 0, power: 0, powerPerLevel: 0,
      durationPerLevel: 0, charges: 0, chargesPerLevel: 0,
      text: 'Clears the fog around a cell you hold, free of gold',
    },
    pending: null,
  },
};

export const ARTIFACT_ORDER: ArtifactId[] = [
  'DowsingRod', 'VerdantSeal', 'ForemansSigil', 'GildedLedger', 'WanderersCompass',
  'DelversLantern', 'MusterHorn', 'BailiffsTally',
];

// ------------------------------------------------------------------- lairs

/**
 * A lair is one garrison, one fight, cleared once (Docs/proposals/lairs.md §1).
 */
export interface LairDef {
  id: LairId;
  name: string;
  description: string;
  glyph: string;
  sprite: string;
  location: Coord;
  /** How many cells a side it occupies, anchored at `location`. 1 unless
   *  stated (Docs/features/01-map-and-fog.md §3.1). Authored rather than
   *  grouped: a lair is placed, not painted. */
  size: number;
  tier: number;
  /** How far its zone reaches past its footprint, in Chebyshev rings: no
   *  tap, no build, no harvest inside (Docs/proposals/lairs.md §3). */
  radius: number;
  /** How far it is SIGHTED past the fog while not yet found: a silhouette
   *  while a revealed cell lies within this many cells of its footprint
   *  (Docs/features/01-map-and-fog.md §4.1). 0 = never; else past `radius`. */
  sight: number;
  /** The card's line over its painting (§6). */
  flavour: string;
  /** The garrison that holds it (Docs/features/18-garrisons-and-raids.md). */
  guard: GuardDef;
}

/**
 * The garrison in a lair, and its clock.
 *
 * `threat` is a unit type or 'Any', and the creature is DERIVED from it —
 * there is no second list to keep in step (§2). It is also the lair's
 * affinity, so the fight teaches the matchup. `power` is the fight's budget.
 */
export interface GuardDef {
  threat: UnitId | 'Any';
  power: number;
  /** Minutes from DISCOVERY to the first raid. Every raid after it follows
   *  the daily schedule (`RAID`, Docs/proposals/lairs.md §4.1). */
  warningMinutes: number;
}

const lairContent: Record<LairId, Pick<LairDef, 'name' | 'description' | 'glyph' | 'sprite'>> = {
  Orcs: {
    name: 'Orc Lair', glyph: '👹', sprite: 'lair_orcs',
    description: 'Orcs dug in on the hillside, and bored of waiting.',
  },
  Harpies: {
    name: 'Harpy Roost', glyph: '🦅', sprite: 'lair_harpies',
    description: 'Harpies on the high rocks, watching everything that shines.',
  },
  Goblins: {
    name: 'Goblin Den', glyph: '👺', sprite: 'lair_goblins',
    description: 'Goblins with sharp sticks and sharper ideas about your stores.',
  },
  WolfRiders: {
    name: 'Wolf-rider Camp', glyph: '🐺', sprite: 'lair_wolfriders',
    description: 'Wolf riders who reach your walls before the dust of their riding does.',
  },
  Drake: {
    name: "Drake's Lair", glyph: '🐉', sprite: 'lair_drake',
    description: 'A drake asleep on a hoard it means to make larger.',
  },
};

const lairBalance = regionMap.lairs as Record<LairId, {
  x: number; y: number; size?: number; tier: number; radius: number; sight: number; flavour: string;
  guard: { threat: string; power: number; warningMinutes: number };
}>;

/** Every lair the code knows about. LairId is a union, so the roster is fixed
 *  in code and the map editor may move and retune a lair but not add one. */
export const LAIR_ORDER: LairId[] = Object.keys(lairContent) as LairId[];

export const LAIRS: Record<LairId, LairDef> = Object.fromEntries(
  LAIR_ORDER.map((id) => {
    const b = lairBalance[id];
    // A hand-edit that drops a lair would otherwise white-screen the app on a
    // TypeError three frames from here.
    if (!b) throw new Error(`region-map.json is missing the lair "${id}"`);
    return [id, {
      id,
      ...lairContent[id],
      location: { x: b.x, y: b.y },
      size: b.size ?? 1,
      tier: b.tier,
      radius: b.radius,
      sight: b.sight,
      flavour: b.flavour,
      guard: { ...b.guard, threat: b.guard.threat as GuardDef['threat'] },
    }];
  }),
) as Record<LairId, LairDef>;

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

/** One number a Legendary moves for the whole kingdom. */
export interface HeroBoon {
  stat: ModifierStat;
  /** ALWAYS A MULTIPLIER, always above 1 — there is no `op`, because there is
   *  no choice. A flat bonus is worth less every hour the kingdom grows and a
   *  falling number has a floor; a multiplier stays proportionally worth the
   *  same for ever and only ever approaches its limit. */
  value: number;
}

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
  /**
   * THE BOON (Docs/proposals/legendary-boons.md) — a LEGENDARY's kingdom
   * passive, null on every Common and Rare.
   *
   * It is not the type passive above (which acts on the board) and not the
   * trait beside it (which acts on a party). It is a modifier at the base
   * stage, on while the hero is OWNED, in the same stack a relic uses — and
   * it points UP, always: a speed, a yield or a capacity, never a discount,
   * because a discount dies at 100% and a permanent passive must not.
   */
  boon: HeroBoon | null;
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
    name: 'The Relic-hunter', title: 'Knows a good lair by its smell', glyph: '🗝️',
    sprite: 'hero_relic_hunter',
    traitText: 'Finds half again as many Fragments',
  },
  Scout: {
    name: 'The Scout', title: 'Goes on ahead', glyph: '🧭', sprite: 'hero_scout',
    traitText: 'Knows the short road — a lair costs 40% less to supply',
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
    traitText: 'Lives off the land — a lair costs 15% less to supply',
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
    traitText: 'Had the road scouted already — a lair costs 25% less to supply',
  },
  ElectricArcher: {
    name: 'The Storm Archer', title: 'Counts the seconds between', glyph: '⚡',
    sprite: 'hero_electric_archer',
    traitText: 'Brings back 50% more Stardust',
  },
  GoldenDragon: {
    name: 'The Golden Dragon', title: 'Older than the lair, and bored of it', glyph: '🐉',
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
      // Only a Legendary has one, so the column is absent on 26 of the 32
      // rows and the JSON's inferred type says so.
      boon: ('boon' in b ? (b.boon as HeroBoon) : null),
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
    if (!b) throw new Error(`data/game/banners.json is missing the banner "${id}"`);
    return [id, { id, ...bannerContent[id], ...b }];
  }),
) as Record<BannerId, BannerDef>;

export const BANNER_ORDER = Object.keys(bannerContent) as BannerId[];

/** A lair's first-clear Knowledge. */
export const DELVE = balance.delve;
export const PARTY = balance.party;

/**
 * What a garrison is worth per lair TIER: how many seconds of the city's own
 * production a raid takes of each material, and what clearing that tier's
 * lair costs in supplies. Everything ELSE about a lair — its creature, its
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

/** The tier row, or the deepest one authored — a lair can never fall off the
 *  end of the table and take nothing. */
export const garrisonForTier = (tier: number): GarrisonDef =>
  GARRISONS.find((g) => g.tier === tier) ?? GARRISONS[GARRISONS.length - 1];

/** How raids are paced and bounded: raids a day inside the player's local
 *  window, and the fraction of the stores one may take
 *  (Docs/proposals/lairs.md §4). */
export const RAID = balance.raid;

// ------------------------------------------------------------ the world board

/** Marches and explorers on the shared board (Docs/features/19-world-map.md
 *  §3–§4). */
export interface WorldDef {
  /** Seconds a marcher takes to leave a hex of open ground: an explorer, an
   *  army — each hex multiplies its own (worldTravel). */
  explorerSecondsPerHex: number;
  armySecondsPerHex: number;
  /** An explorer's work at its target before the hex is revealed: a base,
   *  and more for every hex it lies from the city. */
  exploreWorkSeconds: number;
  exploreWorkSecondsPerHex: number;
  explorerRevealRadius: number;
  revealRadiusMax: number;
  cartographyExplorers: number;
  /** Armies out at once before the War Camp adds any. */
  armySlots: number;
  /** Who holds the five other cities until the board comes from the server. */
  rivals: readonly string[];
}

export interface WorldHexDef { terrain: WorldTerrain; features: readonly WorldFeature[] }

/** How a board is rolled (19 §9). */
export interface WorldGenDef {
  /** East first, on round in HEX_DIRS order. */
  innerRing: readonly WorldHexDef[];
  terrainWeights: Record<RolledRole, Partial<Record<WorldTerrain, number>>>;
  featureChance: Record<RolledRole, Partial<Record<WorldFeature, number>>>;
  /** Where each feature may roll, and what it never shares a hex with. */
  featureRules: Record<WorldFeature, WorldFeatureRule>;
  /** Sites placed, not rolled: so many on the outer ring of every wedge. */
  placedPerWedge: Partial<Record<WorldFeature, number>>;
  maxFeaturesPerHex: number;
}

/** A feature's place on the board (Docs/plans/world-hex-art.md §1). */
export interface WorldFeatureRule { terrains: readonly WorldTerrain[]; excludes: readonly WorldFeature[] }

export const WORLD: WorldDef = balance.world;
export const WORLD_GEN = balance.worldGen as WorldGenDef;

/** One level of a world improvement. */
export interface WorldImprovementLevel { gold: number; buildSeconds: number; perHour: number; store: number }

export interface WorldImprovementDef {
  name: string;
  /** What the hex must be: a Forest, open ground, a Mountain, or anything. */
  needs: 'Forest' | 'Open' | 'Mountain' | 'Any';
  /** The material its store fills with; '' for one that makes nothing. */
  produces: '' | 'Wood' | 'Food' | 'Stone';
  levels: readonly WorldImprovementLevel[];
}

/** What is built on a held world hex and what it pays (19 §5.1, §7). */
export interface WorldBuildDef {
  outpost: { gold: number; goldGrowth: number; buildSeconds: number };
  improvements: Record<WorldImprovement, WorldImprovementDef>;
  innerRingMultiplier: number;
  featureFoodBonus: number;
  landmark: { knowledgePerDay: number; store: number };
  sanctuaryManaCap: number;
}

export const WORLD_BUILD = balance.worldBuild as WorldBuildDef;

/** How long a march takes to leave a hex, as factors on the base (19 §4). */
export interface WorldTravelDef {
  terrain: Partial<Record<WorldTerrain, number>>;
  feature: Partial<Record<WorldFeature, number>>;
  portal: number;
}

export const WORLD_TRAVEL = balance.worldTravel as WorldTravelDef;

/** A dungeon's depths and rooms, and what a room pays (19 §8.1). */
export interface WorldDungeonDef {
  depths: number;
  roomsPerDepth: number;
  powerStart: readonly number[];
  powerStep: readonly number[];
  bossMultiplier: number;
  rewardBase: readonly number[];
  rewardGrowth: number;
  gold: number;
  heroXp: number;
  stardust: number;
  knowledge: number;
  bossRewardMultiplier: number;
  /** Closing a dungeon pays its last boss again, this many times over. */
  closeRewardMultiplier: number;
  /** A closed dungeon comes back after a roll between these many hours. */
  returnHoursMin: number;
  returnHoursMax: number;
}

export const WORLD_DUNGEON: WorldDungeonDef = balance.worldDungeon;

/** The Dark Portal's week and its ladder (19 §10). */
export interface WorldPortalDef {
  openWeekday: number;
  openDays: number;
  floors: number;
  attemptsPerDay: number;
  powerStart: number;
  powerGrowth: number;
  rewardBase: number;
  rewardGrowth: number;
  roseEvery: number;
  goldenEvery: number;
  milestoneEvery: number;
  milestoneGems: number;
  rankGems: readonly number[];
  botFloorChance: number;
}

export const WORLD_PORTAL: WorldPortalDef = balance.worldPortal;

/** The local world server's stand-in rivals. */
export const WORLD_BOTS: {
  actEveryHours: number; maxHexes: number; attackChance: number; armyPower: number; garrisonPower: number;
} = balance.worldBots;

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
  /** The hand of cards this SKU hands over, or **null for a SKU that is not a
   *  bundle** — every Gem pack and the Royal chest. */
  bundle: CardBundleDef | null;
  /** The pack's own art: `render/assets/<sprite>.png`. Falls back to the Gems
   *  icon until the file lands, like every other sprite. */
  sprite: string;
}

/**
 * A CARD BUNDLE (Docs/features/09-relics.md §6.1): the collection's packs and
 * wildcards for money rather than for Gems.
 *
 * It is a `Store` row rather than a Gem price because the BUDGET is the
 * instrument — the purchase log, the refusal and the monthly allowance all
 * have to see it — and it grants no Gems, on the Royal chest's precedent: a
 * bundle hands over the things, not the currency that buys them.
 */
export interface CardBundleDef {
  packs: number;
  tier: PackTier;
  wildcards: number;
  /** The rarity the wildcards cover. Never gold: there is no gold wildcard at
   *  any price, and money does not buy one either (§9). */
  wildcardRarity: Rarity;
}

const skuContent: Record<StoreSkuId, Pick<StoreSkuDef, 'name' | 'description' | 'sprite'>> = {
  GemsPouch: { name: 'Pouch of Gems', description: "A handful \u2014 a builder, or a pull.", sprite: 'gems_pouch' },
  GemsPurse: { name: 'Purse of Gems', description: "A few calls, or a couple of hires.", sprite: 'gems_purse' },
  GemsChest: { name: 'Chest of Gems', description: "A crew's worth, with change.", sprite: 'gems_chest' },
  GemsVault: { name: 'Vault of Gems', description: "Every slot the kingdom has, and then some.", sprite: 'gems_vault' },
  GemsHoard: { name: 'Hoard of Gems', description: "A season of pulls.", sprite: 'gems_hoard' },
  GemsTreasury: { name: 'Treasury of Gems', description: "The whole ladder, twice over.", sprite: 'gems_treasury' },
  SeasonPass: { name: 'The season pass', description: 'The pass\u2019s second column, for the whole season.', sprite: 'season_pass' },
  Survey: { name: 'The Royal Survey', description: 'The Survey\u2019s second column, for the whole province.', sprite: 'season_pass' },
  // The three bundles, a satchel to a cabinet: the same containment ladder the
  // Gem packs walk, in a collector's furniture rather than a treasury's.
  CardsSatchel: { name: "A collector's satchel", description: 'Star packs and a wildcard, for the album you are closest to.', sprite: 'bundle_satchel' },
  CardsCase: { name: "A collector's case", description: 'Star packs and the wildcard that fills any slot.', sprite: 'bundle_case' },
  CardsCabinet: { name: "A collector's cabinet", description: 'A season of star packs, and three wildcards to aim.', sprite: 'bundle_cabinet' },
};

/** The Gem packs alone, for the store's 3×2 grid. A SKU that grants no Gems
 *  on purchase is sold where it is UNDERSTOOD, not on the pack shelf
 *  (Docs/features/12-quests.md §3.3). */
export const GEM_PACK_ORDER = (Object.keys(balance.store) as StoreSkuId[])
  .filter((id) => (balance.store as Record<string, { gems: number }>)[id]!.gems > 0);

interface StoreRow {
  priceUsd: number; gems: number;
  packs: number; packTier: string; wildcards: number; wildcardRarity: number;
}

export const STORE: Record<StoreSkuId, StoreSkuDef> = Object.fromEntries(
  (Object.keys(skuContent) as StoreSkuId[]).map((id) => {
    const b = (balance.store as Record<string, StoreRow>)[id];
    if (!b) throw new Error(`data/game/store.json is missing the store SKU "${id}"`);
    // A row is a bundle when it names a hand. The importer already refuses
    // half a hand, so one column deciding it is enough.
    const bundle: CardBundleDef | null = b.packs > 0 || b.wildcards > 0
      ? {
          packs: b.packs,
          tier: (b.packTier || 'Star') as PackTier,
          wildcards: b.wildcards,
          wildcardRarity: (b.wildcardRarity || 1) as Rarity,
        }
      : null;
    return [id, { id, ...skuContent[id], priceUsd: b.priceUsd, gems: b.gems, bundle }];
  }),
) as Record<StoreSkuId, StoreSkuDef>;

/** The card bundles, cheapest first — the store's own bundle shelf
 *  (Docs/features/09-relics.md §6.1). Workbook row order, like every shelf. */
export const CARD_BUNDLE_ORDER = (Object.keys(balance.store) as StoreSkuId[])
  .filter((id) => STORE[id]?.bundle !== null);

/** Workbook row order — the order the store shows them in. */
export const STORE_ORDER = Object.keys(balance.store) as StoreSkuId[];

/** Monthly simulated budgets by payer profile, in dollars
 *  (Docs/features/14-monetization.md §3). */
export const PAYER = balance.payer;

/** The Survey — Docs/features/25-the-survey.md: one ladder over the whole
 *  province, climbed by cells revealed. Parallel lists, one per reward kind;
 *  their length IS the ladder's, and `cells` is what each level asks for. */
export const SURVEY = balance.survey as {
  cells: number[];
  goldFloorPerMinute: number;
  freeGoldMinutes: number[];
  freeKnowledge: number[];
  freeSilverKeys: number[];
  freeGoldKeys: number[];
  freePacks: string[];
  freeGems: number[];
  paidGems: number[];
  paidGoldKeys: number[];
  paidPacks: string[];
  paidStardust: number[];
};

/** The season pass — Docs/features/20-season-pass.md. Two reward columns as
 *  parallel lists, one per reward kind; their length IS the ladder's. A pack column holds a `PackTier` or `''` for no pack at
 *  that rung, so the INDEX IS THE RUNG and a gap may never close up. */
export const PASS = balance.pass as {
  missionXp: number;
  levelXpBase: number;
  levelXpGrowth: number;
  freePacks: string[]; freeGems: number[]; freeGoldKeys: number[]; freeStardust: number[];
  paidPacks: string[]; paidGems: number[]; paidGoldKeys: number[]; paidStardust: number[];
};

/** The missions that feed the pass — Docs/features/20-season-pass.md §3. A
 *  `*Band` is `[min, max]`, inclusive; the collect band is in MINUTES of the
 *  city's own production rather than in units. */
export const MISSIONS = balance.missions as {
  boardSize: number; perWindow: number; windowHours: number; weeklyQuota: number;
  collectMinutesMin: number; collectMinutesMax: number; collectFloor: number;
  populationBand: number[]; upgradeBand: number[]; revealBand: number[];
  buildBand: number[]; troopsBand: number[]; heroLevelBand: number[];
  packsBand: number[];
  /** The kinds that cannot be finished inside one session — they wait on a
   *  builder, a delve or a technology. They pay a pack; everything else rolls. */
  hardKinds: string[];
  hardPack: PackTier; normalPack: PackTier;
  rewardGems: number; rewardManaFraction: number;
};

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
// v61: research takes no time and has no slots. A running research is
// completed and the slots bought go back as Gems (save.ts); Knowledge poured
// into a technology and the count bought with Gold are new, additive fields.
// v63: the depths behind the gate are retired — a ruin is its gate. The
// migrator drops `kingdom.ruins` (rooms, bottomed ruins, deepest depth).
// v64: ruins and gates are lairs. `kingdom.gates` becomes `kingdom.lairs`,
// `RuinID` becomes `LairID`, and every persisted place id becomes its
// creature's (HollowBarrow → Orcs, …), discovery keys included.
// v69: the first-time experience. `kingdom.tutorial` (the scenes played, and
// `Veteran` for a kingdom from before the doors) is additive: a save without
// it reads as a veteran. A worker carries its strike's remainder
// (`StrikeCarry`), additive too. The tree in five books renamed and split a
// few cards: the migrator carries a researched one to its successors.
// v75: the world board. `kingdom.world` (the board and seat, the fog bitset,
// the explorers out) is additive: a save without it derives its board and
// seat from its own seed and starts with nothing revealed. No migrator.
// v76: the world board's builders and Sanctuaries — `Builds` and
// `Sanctuaries` on `kingdom.world`, additive. World control itself is server
// state and is never in the save.
// v77: armies out on the world board — `Armies` on `kingdom.world`, the
// troops and heroes each one took. Additive.
// v78: a march is priced hex by hex — an explorer trip keeps `StepMs`, the
// time to leave each hex of its path, in place of one `MsPerHex` (read as
// that pace on every hex). Additive.
// v79: the daily chest is cut — `kingdom.kingdoms.Daily` is dropped.
// v80: the fog's treasures (`PaidReveals`, `TreasuresPlaced`, `Treasures` on
// `kingdom.fogOfWar`), additive.
// v81: the abandoned buildings (`kingdom.abandoned`), additive.
// v82: the Survey (`kingdom.kingdoms.Survey`), additive.
// v83: the playtest's signals (`kingdom.signals`, a treasure's `AtUtc`), additive.
export const SAVE_VERSION = 83;
