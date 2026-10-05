// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.
// (The DISTRICTS import is safe: definitions.ts only imports types from here.)

import type { SimTrack } from './analytics';
import { DISTRICTS } from './data/definitions';
import type { WorldDistrict, WorldUpgrade } from './world/types';
// Imported for its KEYS, which are the technology ids (see TechId below).
import techTree from './data/tech-tree.json';
import buildings from './data/game/buildings.json';
import items from './data/game/items.json';
import type { Modifier } from './modifiers';
import type { WorkshopLine } from './workshops';

export type CurrencyId =
  | 'Gold' | 'Food' | 'Wood' | 'Stone' // city coins
  | 'Mana' // the only capped currency — see sim/mana.ts
  | 'Knowledge' // kingdom-scoped research clock; buys technologies and nothing else
  | 'Stardust' // kingdom-scoped; levels relics, and tolls a hero's ascension
  // Kingdom-scoped, and spent on ANY hero rather than the one that earned it:
  // a Legendary pulled today is levelled with what the Commons brought back
  // (Docs/features/10-heroes.md §4). Not on the plank — it reads on the
  // roster, beside the button that spends it.
  | 'HeroXp'
  | 'Gems'; // player-scoped, premium
// The two gacha keys are Bag items, not currencies (`items.json`, kind
// `key`): one banner each, bought with Gems, spent on a pull.
/** Refined goods: what a workshop turns raw resources into, and what an
 *  advanced building level is priced in. Deliberately NOT a `CurrencyId` —
 *  the city keeps a stockpile, the way the collection keeps ingredients, so
 *  four coins on the plank stays four (Docs/features/17-workshops-and-goods.md §1). */
export type GoodId = 'Planks' | 'CutStone' | 'Iron' | 'Runestone' | PreciousId;
/** The world's three precious materials: goods nothing makes (19 §7.4). */
export type PreciousId = 'Starmetal' | 'Heartwood' | 'Moonglass';
export const PRECIOUS: readonly PreciousId[] = ['Starmetal', 'Heartwood', 'Moonglass'];
/** What the city holds of each. Absent = none, exactly like a Wallet. */
export type GoodsStock = Partial<Record<GoodId, number>>;

/** Every building's id. The union IS `data/game/buildings.json`'s keys, the
 *  way `TechId` is the tree's: a building added in `?dev=data` is a type the
 *  moment it is saved, and a typo anywhere still fails to compile. */
export type DistrictId = keyof typeof buildings;
/** Every item the Bag can hold — `data/game/items.json`'s keys, like
 *  `DistrictId` (Docs/plans/relics-and-bag.md). */
export type ItemId = keyof typeof items;
/** Which authored region this kingdom is playing. One today — the field
 *  exists now because the SAVE FILE is the only artefact that cannot be
 *  changed retroactively: every save written before it exists is ambiguous
 *  the moment a second region appears, and "it must be the first one" is a
 *  guess that fails for anyone mid-migration. */
export type RegionId = 'oakville';

export type TerrainId =
  | 'Grassland' | 'Plains' | 'Desert' | 'Snow' | 'Tundra' | 'Water';
// A mountain is a FEATURE, not a terrain: the Quarry works it the way the
// Sawmill works a forest, and `state.features` already keeps a cell
// unbuildable without a terrain rule of its own.
// Three kinds of mountain: bare rock the Quarry cuts, and two that carry a
// metal the Mine goes after. They are the same landform, so they share the
// research that opens one to a pick and differ only in what they pay.
export type FeatureId =
  | 'Trees' | 'BerryBush' | 'WildAnimals' | 'FishShoal'
  | 'Mountain' | 'MountainIron' | 'MountainGold';
export type HarvestSourceId =
  | 'Forest' | 'Crops' | 'Berries' | 'Meat' | 'Fish'
  | 'Stone' | 'MountainIron' | 'MountainGold';
export type UnitId = 'Warrior' | 'Lancer' | 'Archer' | 'Cavalry';
/** A landmark's kind decides its art and name — and, for the Watchtower, a
 *  door: claiming it opens the world (Docs/features/22-progression.md §5). */
export type LandmarkKind = 'Shrine' | 'StandingStones' | 'Leyspring' | 'Watchtower';
export type LairId =
  | 'Orcs' | 'Harpies' | 'Goblins' | 'WolfRiders' | 'Drake';
export type ArtifactId =
  | 'DowsingRod' | 'VerdantSeal' | 'ForemansSigil' | 'GildedLedger' | 'WanderersCompass'
  // The three pillars the city relics do not touch: the dungeon, the war and
  // the world map (Docs/proposals/relic-effects.md §6).
  | 'DelversLantern' | 'MusterHorn' | 'BailiffsTally';
export type HeroId =
  'Warden' | 'Quartermaster' | 'Scholar' | 'RelicHunter' | 'Scout' | 'Adventurer' |
  'Bard' | 'BeastkinHunter' | 'Cleric' | 'Cook' | 'Gardener' | 'Joker' | 'Merchant' |
  'Priest' | 'Rogue' | 'ThreeMice' | 'Sellsword' | 'DarkKnight' | 'Paladin' | 'Wizard' |
  'Witch' | 'Druid' | 'IceLancer' | 'HolyWarrior' | 'SavageWarrior' | 'Spymaster' |
  'ElectricArcher' | 'GoldenDragon' | 'VampireLord' | 'Necromancer' | 'Pharao' |
  'ElvenPrincess';
/** The books: three general ones and two found ones. The shelf is the
 *  layout: one bounded page per book, each paced by eras
 *  (Docs/features/07-research.md §2); what opens each is
 *  `sim/research.ts#TOME_OPENS`. */
export type TomeId = 'Kingdom' | 'Sagas' | 'Atlas';

/** A real-money SKU of the simulated store (definitions.ts `STORE`). */
export type StoreSkuId =
  | 'GemsPouch' | 'GemsPurse' | 'GemsChest' | 'GemsVault' | 'GemsHoard' | 'GemsTreasury'
  /** The season pass's paid column, for one season: it grants nothing on
   *  purchase and opens the levels already reached (sim/pass.ts). */
  | 'SeasonPass'
  /** The Survey's paid column, once for the whole province: the same shape
   *  (sim/survey.ts). */
  | 'Survey'
  /** The Bag's bundles: items for money (Docs/proposals/inventory.md §5). */
  | 'SpeedupSatchel' | 'SpeedupCrate' | 'SpeedupChest' | 'ResourceSack' | 'ResourceCart' | 'BuildersCrate';

/** Who the playtester says they are (Docs/features/14-monetization.md §3). One
 *  choice per save; the only way to another profile is a fresh game. */
export type PayerProfile = 'F2P' | 'Minnow' | 'Dolphin' | 'Whale' | 'SuperWhale';

/** One simulated purchase, kept so the read-out can be produced from the save
 *  alone until a real event pipeline exists. */
export interface Purchase {
  sku: StoreSkuId;
  priceCents: number;
  at: number; // epoch ms
}

export interface PayerState {
  profile: PayerProfile;
  chosenAt: number;
  /** The calendar month (`monthIndex`, UTC) the running spend belongs to. A
   *  read in a later month sees a fresh budget; nothing rolls over. */
  monthIndex: number;
  /** Cents, never dollars: 1.99 + 9.99 has to add up exactly. */
  spentCentsThisMonth: number;
  purchases: Purchase[];
  /** Taps on a price the budget could not cover — unmet demand, counted. */
  refusals: number;
}

/**
 * Every technology in the game, as a type — the KEYS of `tech-tree.json`.
 *
 * It used to be 180 hand-written string literals, which is the third copy of
 * the same list (the importer had one too) and the reason creating a
 * technology was a four-file job. TypeScript reads a JSON import's keys as
 * literals, so this union now IS the file: `?dev=tree` adds a technology and
 * the type follows, while a typo anywhere still fails to compile.
 */
export type TechId = keyof typeof techTree.technologies;


export interface Coord { x: number; y: number }
export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const parseCoordKey = (k: string): Coord => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const sameCell = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;

export type Wallet = Partial<Record<CurrencyId, number>>;

export type ConstructionState = 'UnderConstruction' | 'Built';

export interface District {
  uniqueId: string;
  definitionId: DistrictId;
  /** Which one of its kind this is — 1 for the first Sawmill, 2 for the next.
   *  Stamped when it is placed and never changed, because it prices every
   *  level of this building for ever (Docs/features/05-city-and-districts.md
   *  §3.1). It is also what a card calls it: *Housing #3*. */
  ordinal: number;
  level: number;
  assignedWorkers: number;
  location: Coord;
  state: ConstructionState;
  visualVariant: number;
  /** What this building has made and the player has not collected yet —
   *  a house's rent, a producer's hauls. Absent = empty. It is not the
   *  player's until a tap moves it to the wallet, and a raid may take from
   *  it (Docs/features/03-economy.md §3.2). */
  stored?: Wallet;
  /** A house's rent anchor, epoch ms: rent accrues in whole units from here,
   *  into `stored`, the way Mana accrues against `lastManaAt`. Absent on
   *  anything that is not a house. */
  rentAnchor?: number;
}

export interface QueueItem {
  uniqueId: string;
  kind: 'build' | 'upgrade';
  districtUniqueId: string;
  targetLevel?: number; // upgrades only
  durationSeconds: number;
  startedAt: number | null; // epoch ms; null until it enters the active window
  /** Milliseconds speed-ups have taken off it (sim/speedups.ts): the end
   *  moves, the start stays. Absent = none. */
  cutMs?: number;
}

export const completesAt = (item: QueueItem): number =>
  (item.startedAt ?? Infinity) + item.durationSeconds * 1000 - (item.cutMs ?? 0);
export const remainingSeconds = (item: QueueItem, now: number): number =>
  item.startedAt === null ? item.durationSeconds : Math.max(0, (completesAt(item) - now) / 1000);
export const queueProgress = (item: QueueItem, now: number): number =>
  item.startedAt === null || item.durationSeconds === 0
    ? (item.startedAt === null ? 0 : 1)
    : Math.min(1, Math.max(0, (now - item.startedAt + (item.cutMs ?? 0)) / (item.durationSeconds * 1000)));

export interface City {
  name: string;
  wallet: Wallet;
  /** The refined-goods stockpile. Read where it is spent — a workshop's card
   *  and the price of a building level — never on the plank. */
  goods: GoodsStock;
  population: number;
  districts: District[];
  queue: QueueItem[];
  /** Everything in training anywhere in the city — villagers at the Townhall
   *  and soldiers at the military halls, in ONE list. Each building draws its
   *  own line out of it by `buildingId`. */
  trainingQueue: TrainingItem[];
  /** Every workshop's queue, by district uniqueId. Absent = never used as
   *  one (sim/workshops.ts). */
  workshops: Record<string, WorkshopLine>;
  /**
   * THE INFIRMARY: soldiers who came back from a fight and cannot stand in a
   * line yet, by type.
   *
   * They are off the roster — they do not count against the army cap and they
   * cannot be sent anywhere — until a military hall puts them back together
   * (sim/army.ts). What the hall charges is a fraction of what recruiting the
   * same soldier would, which is the whole point of the pool: a bad fight is
   * a bill rather than a loss.
   */
  wounded: Partial<Record<UnitId, number>>;
  /** Epoch ms anchor for Mana regeneration (whole units only), the same
   *  shape as a house's `rentAnchor` so both replay deterministically. */
  lastManaAt: number;
}

/** Per-resource-cell harvest state. Absent entry = fresh cell (0 taps). */
export interface CellHarvestState {
  /** Units left in the depot. Everything that extracts — thumb or worker —
   *  draws this down; at zero the cell is exhausted. */
  units: number;
  exhaustedUntil: number | null; // epoch ms; recovery is lazy (derived from time)
  /**
   * HOW LONG THAT WAIT WAS, when it was stamped. Null while the cell is not
   * exhausted.
   *
   * The wait is priced ONCE, at the moment of exhaustion
   * (`effectiveRecoveryMs`), so the BAR that counts it down has to be told
   * what it is counting. Deriving the span from the authored
   * `recoverySeconds` instead made the bar start nearly full under anything
   * that speeds recovery up — a Dowsing Rod at level 16 shortens a Forest's
   * 90 seconds to 21, and a bar spanning 90 opens at 77%.
   */
  recoveryMs: number | null;
}

export type WorkerActivity = 'Idle' | 'MovingToCell' | 'Working' | 'MovingHome';

export interface Worker {
  id: string;
  buildingId: string; // district uniqueId
  activity: WorkerActivity;
  claimedCell: Coord | null;
  /** Units in hand, walking home. They left the DEPOT the instant the strike
   *  finished — so nobody can take them twice — and they reach the WALLET only
   *  when the worker gets back. Matter in transit, and it is real: unassigning
   *  a loaded worker loses the load. */
  carrying: number;
  /** WHAT is in the hands. Held rather than re-read off the claimed cell,
   *  because the last strike on a bush or a herd CONSUMES it: by the time the
   *  worker gets home the cell is bare, and the Food it is carrying still has
   *  to land somewhere. */
  carriedSource: HarvestSourceId | null;
  /** The fraction of a unit the last strike was owed and could not take —
   *  the tree's yields are percentages, so a strike owes 1.1 units, takes 1
   *  and keeps 0.1 for the next. Always in [0, 1). Its own, so two workers
   *  on one cell never share a remainder. */
  strikeCarry: number;
  stateStartedAt: number; // epoch ms — for render interpolation
  stateUntil: number | null; // event time; null while Idle
}

/** What a scheduled window DOES. Payloads are data; the handlers that read
 *  them are pure functions of (state, entry, t) — no closures over UI, or the
 *  sim stops being replayable. */
export type SchedulePayload =
  | { kind: 'banner'; occurrence: number };

export interface ScheduledEntry {
  id: string;
  /** Which authored template produced it, for reconciliation. */
  templateId: string;
  startsAt: number;
  /** null = instant: it fires on open and is done. */
  endsAt: number | null;
  payload: SchedulePayload;
  /** THE termination guarantee: applyDueAt transitions the phase, so the same
   *  boundary can never be proposed twice. It must persist, or an event that
   *  already paid out pays again on reload. */
  phase: 'pending' | 'active' | 'done';
}

export interface ArmyUnit {
  uniqueId: string;
  definitionId: UnitId;
}

/**
 * Anything a building can put in its line. Villagers are not army units — no
 * stats, no power, and a price that climbs with the population — so they are
 * not in the UNITS table. But they QUEUE identically, so the queue carries the
 * union rather than two parallel systems that drift apart.
 */
export type TrainableId = UnitId | 'Villager';

/** One trainee waiting. Paid for up front; `startedAt` is stamped when it
 *  reaches the front of its BUILDING's line. */
export interface TrainingItem {
  uniqueId: string;
  trainee: TrainableId;
  buildingId: string;
  /**
   * What this item IS. A `recruit` turns a price into a new soldier; a `heal`
   * takes `count` of them out of the infirmary and puts them back in the
   * ranks, cheaper and faster than recruiting the same number.
   *
   * Absent in a pre-41 save, which is a save with no infirmary in it, so it
   * reads as `recruit` and nothing else has to change.
   */
  kind?: 'recruit' | 'heal';
  /** How many this item delivers. Only a `heal` sets it — a recruit is always
   *  one — so the whole batch is one wait rather than a queue of them. */
  count?: number;
  startedAt: number | null;
  /** Seconds this one will take, stamped with `startedAt` — because the
   *  building's neighbours are priced when the clock starts, not on read
   *  (sim/adjacency.ts). Null until it starts; absent in a pre-30 save, where
   *  it falls back to the authored duration. */
  seconds: number | null;
  /** Milliseconds speed-ups have taken off it (sim/speedups.ts). Absent = none. */
  cutMs?: number;
}

/** A committed stack. A party SLOT holds a unit TYPE and every unit of it you
 *  chose to send, so slots limit composition BREADTH rather than headcount —
 *  which is what makes the type chart interesting and what "coverage" means
 *  when a second hero arrives. */
export interface PartySlotState {
  unitId: UnitId;
  count: number;
}

/**
 * One lair.
 *
 * `nextRaidAt` is the whole clock: null means nothing is counting — the lair
 * is cleared, or the garrison is out of trips and sitting on what it took.
 * The `hoard` is what it holds, and clearing the lair hands every coin of it
 * back, which is what keeps a raid a bill rather than a loss.
 */
export interface LairState {
  /** Epoch ms of the boundary that DISCOVERED it — the first raid is
   *  `armedAt + warningMinutes`, and every one after it follows the daily
   *  schedule (Docs/proposals/lairs.md §4.1). */
  armedAt: number;
  /** Epoch ms of the next raid, or null once it is cleared. */
  nextRaidAt: number | null;
  /** What it carries of what it took, capped at a day of raids per material
   *  (§4.2), and handed back when the lair falls. */
  hoard: Wallet;
  /** Its garrison is beaten and it raids no more, but what it owes has not
   *  been CLAIMED: it still stands on the map, holding its ground, with its
   *  reward waiting on its card (Docs/proposals/lairs.md §5). */
  defeated: boolean;
  /** Claimed: the reward is paid and the lair is gone for good. */
  cleared: boolean;
}

/**
 * WHAT KIND OF ERRAND a mission is. The id is what the roll scores, so it is
 * stable for the life of a save: adding a fourteenth kind inserts one score
 * and leaves the other thirteen in the same relative order.
 */
export type MissionKind =
  | 'Population' | 'UpgradeDistricts' | 'RaiseTownhall' | 'CollectResource'
  | 'DiscoverCells' | 'BuildDistricts' | 'TrainTroops' | 'LevelHeroes'
  | 'UseItems';

/**
 * WHAT ONE MISSION PAYS, besides the pass XP every mission pays.
 *
 * ONE THING, rolled when the mission is issued and stored on it — so it can be
 * read off the board before the work is done, which is what lets a player pick
 * what to do next by what it pays. A reward decided at CLAIM time would be a
 * surprise, and a surprise cannot be chosen between.
 *
 * Mana is a FRACTION OF THE POOL rather than an amount, the ad reward's rule:
 * a reward priced in the player's own production is worth the same fraction of
 * an afternoon at every stage of the game.
 */
export type MissionReward =
  | { kind: 'Gems'; amount: number }
  | { kind: 'Mana'; fraction: number }
  | { kind: 'Fragments'; n: number };

/**
 * ONE ERRAND ON THE BOARD (sim/missions.ts).
 *
 * RELATIVE, always: `meter` names an odometer on `state.tallies` and `base` is
 * what it read the moment this was issued, so progress is `tally - base` and
 * nothing that happened before counts. There is no counter of its own to keep
 * in step with the sim.
 */
export interface Mission {
  uniqueId: string;
  kind: MissionKind;
  /** The odometer key this watches — `levels`, `collect:Wood`, `rooms`. */
  meter: string;
  /** That odometer's reading when this was issued. */
  base: number;
  /** How much more of it the mission asks for. */
  target: number;
  /** What the mission is ABOUT, when its kind is scoped: the currency to
   *  collect. Carried so the label and the icon need no second lookup. */
  subject: CurrencyId | null;
  /** What finishing it pays. Rolled at issue, so the board can show it. */
  reward: MissionReward;
  /** The window that issued it, and what it was issued for — the rng key, so
   *  re-rolling the same window is bit-identical. */
  window: number;
  slot: number;
  /** Set once the reward has been taken. A claimed mission leaves the board. */
  claimed: boolean;
}

/**
 * One explorer out on the world board (Docs/features/19-world-map.md §3.1).
 *
 * Everything a trip will ever do is priced when it leaves: its path, its
 * pace and how far it sees. What it has revealed at any moment is derived
 * from those and the clock (sim/world/explorers.ts), so a march is a TIMER
 * with one boundary — the moment it is home.
 */
/** What can stand on a held world hex (sim/world/types.ts). */
/** What a builder out on the world board is building: a hex's district
 *  (the claim), or an upgrade into one (Docs/features/19-world-map.md §7). */
/** A world build: a district's claim, an upgrade's level, or the repair of
 *  a district a camp burnt (19 §5.5). */
export type WorldBuildWhat = WorldDistrict | WorldUpgrade | 'Repair';

export interface ExplorerTrip {
  id: string;
  /** The hex it was sent to, as a board index. */
  target: number;
  /** Board indices from the city (first) to the target (last). */
  path: number[];
  departedAt: number;
  /** Milliseconds to leave each hex of the path, priced when it set out:
   *  out, every hex but the last; home, every hex but the city. */
  stepMs: number[];
  /** Milliseconds it works at the target before the hex is revealed. */
  workMs: number;
  /** Hexes it reveals round its target. */
  radius: number;
}

export interface WorldState {
  /** Which board, and which of its six cities is the player's. */
  board: { id: string; seed: number; seat: number };
  /** The hexes revealed and folded in: three uint32 words over the board's
   *  91 indices. The city and the Portal are always revealed and never
   *  stored; a march under way is derived, not stored. */
  revealed: number[];
  explorers: ExplorerTrip[];
  /** Builders out on the world board: what each is raising and when it is
   *  done. The server holds the hex; this is the builder's half, so a
   *  province build and a world build share the one crew. */
  builds: WorldBuild[];
  /** Sanctuaries held and on the chain, as the server last said — each
   *  raises the Mana ceiling (Docs/features/19-world-map.md §8). */
  sanctuaries: number;
  /** The player's armies out on the board: the client's half — who went and
   *  with what. The army itself is server state (02-map-scopes.md §3.1). */
  armies: WorldArmyOut[];
  /** The last world-server effect applied (WorldEffect.seq): those at or
   *  below it are not applied again when the server sends them again. */
  effectSeq: number;
}

export interface WorldArmyOut {
  id: string;
  heroes: HeroId[];
  troops: Array<{ unitId: UnitId; count: number }>;
  target: number;
  purpose: 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' | 'clear';
}

export interface WorldBuild {
  /** The board hex, by index. */
  index: number;
  /** A district, or an upgrade's level. */
  what: WorldBuildWhat;
  level: number;
  finishesAt: number;
}

export interface GameState {
  regionId: RegionId;
  city: City;
  kingdom: {
    /** How many builders the kingdom OWNS — the number of build/upgrade jobs
     *  that run at once, and the length of the queue that feeds them.
     *
     *  Not to be confused with `KINGDOM_DEF.maxBuilders`, which is the
     *  authored CEILING this may be raised to. That collision of names is why
     *  the dial sat dead: the workbook authors 4, `startBuilders` is 1, and
     *  a field called `maxBuilders` holding 1 reads like the ceiling IS 1. */
    builders: number;
    wallet: Wallet;
    /** Epoch ms anchor for the Knowledge drip (whole units only). */
    lastKnowledgeAt: number;
    /** Points of Knowledge ever bought with Gold. The nth costs n × base, and
     *  this never resets (sim/knowledge.ts). */
    knowledgeBoughtWithGold: number;
    /** The player's local time, as minutes EAST of UTC (UTC+2 is 120). The
     *  device reports it and the sim only ever reads it — a lair raids inside
     *  the player's local day (Docs/proposals/lairs.md §4.1), and the sim has
     *  no clock of its own to find out where that day is. */
    utcOffsetMinutes: number;
    /**
     * THE SEASON PASS (sim/pass.ts). Kingdom-scoped, like Knowledge: a habit
     * is a property of the player, not of the city they happen to be
     * playing. NOT on `state.collection`, which is wiped
     * whole at the close.
     */
    pass: {
      /** The `seasonAt` occurrence everything below belongs to. A stale one
       *  reads as a fresh, empty pass — the same pull rule the chest follows,
       *  so a season turns over with nothing scheduled. */
      season: number;
      /** Pass XP earned this season. Levels are DERIVED from it. */
      xp: number;
      /** Which cells of each column have been taken, by level. Claimed cell
       *  by cell and out of order — buying the pass on level 12 leaves twelve
       *  paid cells waiting — so neither can be a count. */
      claimedFree: number[];
      claimedPaid: number[];
      /** The occurrence the paid column was bought for, or null. A comparison
       *  rather than a flag, so nothing has to clear it. */
      paidSeason: number | null;
      /** The board. At most `MISSIONS.boardSize`; nothing on it expires. */
      live: Mission[];
      /** The last eight-hour window ISSUED FOR — a stamp, not a cursor. A
       *  window that passed while the board was full is never owed later. */
      lastWindow: number;
      /** How many of each kind have been issued in `week`, so a board cannot
       *  fill with eight of the same errand. */
      issuedThisWeek: Partial<Record<MissionKind, number>>;
      /** The Monday-aligned week `issuedThisWeek` belongs to. Stale reads as
       *  an empty quota, the same pull rule as `season`. */
      week: number;
    };
    /** THE SURVEY (sim/survey.ts): one ladder over the whole province. Its
     *  level is derived from the cells revealed; what is stored is what has
     *  been taken, and whether the paid column is bought. It never resets. */
    survey: {
      claimedFree: number[];
      claimedPaid: number[];
      owned: boolean;
    };
  };
  player: {
    wallet: Wallet;
    /** The simulated payer, or null until the player has picked a profile —
     *  which the UI forces before anything else (14-monetization.md §3). */
    payer: PayerState | null;
  };
  fog: {
    revealed: Record<string, true>; // coordKey → revealed
    /** coordKey → discovered by a building's discover radius. (Cells adjacent
     *  to a revealed cell are ALSO Discovered — that part stays derived.) */
    discovered: Record<string, true>;
    progress: Record<string, number>; // coordKey → taps spent so far, 1..4
    /** Cells the player has paid to reveal, ever — the treasures' clock
     *  (sim/treasures.ts). A building's ground or a claim does not count. */
    paidReveals: number;
    /** How many treasures the fog has placed, ever: the next one's ordinal. */
    treasuresPlaced: number;
    /** coordKey → a treasure waiting on that cell, Discovered or Revealed.
     *  Picked up, it leaves the record. */
    treasures: Record<string, { n: number; coin: CurrencyId; at: number }>;
  };
  features: Record<string, FeatureId>; // coordKey → feature at its CURRENT cell
  /** Respawning features: current cell → its map-authored ORIGIN + respawn
   *  generation (drives the deterministic "random" adjacent placement). */
  featureMeta: Record<string, { origin: string; generation: number }>;
  /** Depleted features waiting to reappear next to their origin. */
  featureRespawns: Array<{
    origin: string; feature: FeatureId; readyAt: number; generation: number;
  }>;
  harvest: Record<string, CellHarvestState>; // coordKey → depot/exhaustion
  workers: Worker[];
  army: ArmyUnit[];
  research: {
    completed: TechId[];
    /** Knowledge poured into technologies not yet researched. It stays there
     *  for ever; a technology leaves this map when it is researched. */
    poured: Partial<Record<TechId, number>>;
    /** Bands finished whole whose card pack has been paid, as `Tome:era` —
     *  so a band pays once, whatever is researched after. */
    rewarded: string[];
  };
  /**
   * Scheduled content: seasons, events and gacha banners.
   *
   * Reconciled from the BUILD's catalogue at load, so a save written before a
   * content drop still learns the new window exists — and a window that
   * opened and closed during an absence still fires, because boundaries are
   * absolute-time and reconciliation happens before the replay.
   */
  schedule: ScheduledEntry[];
  /** The hero roster, on the same collection substrate as the relics. */
  heroes: {
    owned: HeroId[];
    levels: Partial<Record<HeroId, number>>;
    tiers: Partial<Record<HeroId, number>>;
    fragments: Partial<Record<HeroId, number>>;
    /** Extra HERO slots bought with Gems: one is free and every further one
     *  is Gems, always, up to the board's three
     *  (Docs/features/10-heroes.md §3). */
    heroSlotsPurchased: number;
    /** What fights have taken from each hero and not yet given back: the
     *  share of its HP missing at `at` (epoch ms), recovering on its own,
     *  and whether it fell — an exhausted hero rests until whole. Absent =
     *  whole (sim/heroHealth.ts). */
    hurt: Partial<Record<HeroId, { missing: number; at: number; exhausted?: boolean }>>;
  };
  /** Pull counters, per banner. Persisted because pity depends on them — and
   *  because the counter IS the rng key, which is what lets a hash beat a
   *  stream here. */
  gacha: {
    pullCounts: Record<string, number>;
    pityCounters: Record<string, number>;
    /**
     * The free-pull allowance a rewarded ad spends, per banner: which day the
     * count belongs to, how many of that day's are gone, and when the next
     * one is offered.
     *
     * A STAMP plus a counter, the shape `store.ts` uses for the monthly
     * budget — the stamp is rolled lazily by every writer, so a stale day
     * never leaks and nothing has to run at midnight. Deliberately NOT a
     * boundary source (`adOffers.ts` makes the argument): a five-minute timer
     * registered in `advance()` would propose ~8,600 boundaries across a
     * thirty-day absence against a seatbelt of 10,000.
     */
    freePulls: Record<string, { day: number; used: number; readyAt: number }>;
    /** Pulls since the last Legendary, per banner. A second counter rather
     *  than a second meaning for the first: the short pity guarantees A hero,
     *  this one guarantees the rarity, and a player has to be able to read
     *  both (Docs/features/10-heroes.md §5). */
    legendaryPity: Record<string, number>;
  };
  /**
   * The rewarded-ad offer (sim/adOffers.ts).
   *
   * `claims` IS the rng key for the next cooldown, the same way `pullCounts`
   * keys a gacha roll — so it has to persist for the sequence to survive a
   * reload. `pending` persists too: an offer the player walked away from is
   * still owed to them, and a widget that vanished over lunch would read as
   * the game taking something back.
   *
   * Nothing in `advance()` touches any of this. The offer is an opportunity
   * shown to a player, not economy, so it is refreshed from the live tick —
   * which is what keeps offline replay exactly equal to stepped ticking.
   */
  ads: {
    /** Epoch ms; the cooldown only restarts on a claim. */
    readyAt: number;
    claims: number;
    /** Latched: set when the offer becomes visible, cleared by claiming. */
    pending: boolean;
    /**
     * The refills taken TODAY, one counter per route (sim/manaRefill.ts).
     *
     * Both routes to a refill live here because they are one surface — the
     * Mana sheet — and they roll on the same day, but the counters are
     * separate: a video allowance spent does not close the Gem ladder, and
     * buying five does not cost the player a video.
     *
     * `day` is a `dayIndex`, rolled LAZILY by every reader, so nothing has to
     * happen at midnight and a stale day can never leak.
     */
    refills: { day: number; watched: number; bought: number };
  };
  /** Claimed landmarks, by content id. Claiming raises the Mana CEILING,
   *  which is what makes exploration compound rather than merely pay. No
   *  landmark is defended: a sanctuary is bought with Gold, and the fight
   *  with a clock belongs to the lairs (sim/lairs.ts). */
  landmarks: {
    claimed: Record<string, true>;
  };
  /**
   * Every lair — one garrison, one clock
   * (Docs/features/18-garrisons-and-raids.md).
   *
   * Absent = the lair has not been discovered, so nothing is counting. The
   * entry is written by the sweep in `advance()` rather than by the reveal,
   * so the counter is stamped with a boundary's `t` and never with a clock
   * the sim is not allowed to read.
   */
  lairs: Partial<Record<LairId, LairState>>;
  /**
   * The five relics, as levels. Absent = not found; a relic is owned iff it
   * has a level, and every relic the player has is always on
   * (Docs/features/09-relics.md §1). There is nothing else to keep: no
   * sockets, no tiers, no Fragments and no cap.
   */
  artifacts: {
    levels: Partial<Record<ArtifactId, number>>;
    /**
     * WHEN EACH RELIC'S ABILITY LAST WENT OFF, for the ACTIVE → COOLDOWN →
     * READY walk (Docs/features/09-relics.md §2.1). Absent = never cast, which
     * reads as READY.
     *
     * Two timestamps and not one, because the window and the cooldown are
     * different facts: the window is what the zone is standing for, and the
     * cooldown starts where it ends. Storing the cast instant and deriving the
     * rest would reprice a running window every time the relic gained a level.
     */
    casts: Partial<Record<ArtifactId, { endsAt: number; readyAt: number }>>;
    /**
     * USES LEFT on an ability whose window is counted in EVENTS rather than
     * in seconds — the Delver's Lantern's rooms.
     *
     * It has no clock at all, and deliberately: the only clock a delve has is
     * the player opening the next door, so a charge cannot expire while
     * nothing is happening. A lantern lit and not spent stays lit, and the
     * relic stays ACTIVE until the last room takes it.
     */
    charges: Partial<Record<ArtifactId, number>>;
  };
  /**
   * The card collection — the live season only. Wiped whole at the close, so
   * every field here is a season's worth and none of it crosses the boundary
   * (sim/collection.ts).
   */
  /** Upgrade levels (instant, gold-bought); absent = level 0. */
  /** The modifier stack: artifact passives (permanent), actives and seasons
   *  (timed). Kingdom-scoped concepts, so this sits beside `upgrades` at the
   *  top level rather than inside `city`. See sim/modifiers.ts. */
  modifiers: Modifier[];
  /** The quest chain: index into QUESTS (length = all done); progress is the
   *  event counter for RELATIVE goals, reset when a quest is claimed. `rush`
   *  is the tutorial's rent rush (sim/quests.ts): the quest it is for, and
   *  when it tops the house up — null once it has. */
  quests: { index: number; progress: number; rush?: { index: number; at: number | null } };
  /**
   * THE LIFETIME ODOMETERS the season pass's missions read (sim/events.ts).
   *
   * One key per thing the sim announces — `levels`, `troops`, `collect:Wood`,
   * `levels:Townhall` — and every one of them only ever goes UP. A mission is
   * relative: it stores a BASE reading and asks for `meter - base`, which is
   * only honest against a counter that cannot fall. `army.length` falls when a
   * room kills soldiers and `wallet.Wood` falls when it is spent; baselining
   * either would un-progress a mission, which reads as the game taking
   * something back.
   *
   * TOP LEVEL, outside every season-stamped block, and deliberately: a live
   * mission's base is a reading of one of these, so a wipe that touched them
   * would silently move every mission on the board. A key nobody has bumped
   * reads as 0, so nothing here needs initialising or migrating.
   */
  tallies: Record<string, number>;
  /**
   * Set ONLY around the load path's catch-up advance (sim/save.ts), and the
   * one thing that reads it is the odometer above.
   *
   * THE MISSIONS ARE ACTIVE-PLAY-ONLY, which is the single place in this
   * codebase where offline replay and live ticking are meant to DISAGREE.
   * Invariant 1 still holds inside each mode — a six-hour replay in one call
   * and in six steps both run with this set and agree exactly, and the live
   * path agrees with itself — and the exception is confined to `tallies`.
   * Nothing else may read this flag.
   *
   * Transient, like `lastCollectTapAt`: never saved, false on load.
   */
  replaying: boolean;
  /** First-time discoveries already announced (keys like 'resource:Wood'). */
  discoveries: Record<string, true>;
  /**
   * The tutorial's memory (Docs/features/23-tutorials.md §7): which scenes
   * have played (`scene:<id>`), and which doors and books have been
   * announced open (`door:<id>`, `book:<tome>`). The sim never reads `seen`
   * for a rule — the presenter and the stage do — but it lives in the save
   * so a reset resets it and a second device agrees.
   *
   * `veteran` is a kingdom from before the doors existed: every door is open
   * and every scene counts as played (Docs/features/22-progression.md §1).
   * `startedAt` is when the kingdom was founded.
   */
  tutorial: { veteran: boolean; seen: Record<string, true>; startedAt: number };
  /** The abandoned buildings whose repair has started, by id — from then on
   *  each is a district (Docs/features/01-map-and-fog.md §6.3). */
  abandoned: { repaired: Record<string, true> };
  /**
   * THE BAG (Docs/proposals/inventory.md): what the player holds and has not
   * used yet. Not a wallet — an item is spent by being USED, never by a
   * price. `held` absent = none; nothing in it expires or can be raided.
   * `fresh` is every item gained since its tile was last tapped (the tile's
   * sparkle, the tab's dot); `badge` counts what was gained since the Bag was
   * last opened (the nav's orb).
   */
  bag: { held: Partial<Record<ItemId, number>>; fresh: Partial<Record<ItemId, true>>; badge: number };
  /**
   * RELIC FRAGMENTS (Docs/proposals/relic-restoration.md §2, sim/relics.ts):
   * by relic, six slots — five pieces, the keystone — counted found and
   * bound apart. A relic's level stays `artifacts.levels`. `chests` numbers
   * the Restorer's chests opened, so each one's roll is its own.
   */
  relics: { held: Partial<Record<ArtifactId, { found: number[]; bound: number[] }>>; chests: number };
  /**
   * THE PLAYTEST'S SIGNS (Docs/playtest.md §5), for the person reading the
   * save; nothing in the game reads them. Counts live on `tallies` under
   * `signal:*`; what is here is WHEN — times are the sim's `lastAdvance`,
   * never a clock.
   */
  signals: {
    /** When each sighted thing was first sighted, by id. */
    sightedAt: Record<string, number>;
    /** When each site was first discovered, by id. */
    discoveredAt: Record<string, number>;
    /** How long the treasures picked up had waited since they were placed,
     *  summed: divided by `signal:treasurePicked`, the average. */
    treasureWaitMs: number;
    /** The first tap of each of the last sessions, and what it was on. */
    returnTaps: Array<{ at: number; kind: string }>;
    /** How long the game has been on screen, ever, in ms: counted by the
     *  game while the page is visible (Docs/plans/analytics.md §2). */
    playMs: number;
  };
  /**
   * The world board as the player's own save knows it
   * (Docs/features/02-map-scopes.md §3, §6): which board and seat, the fog,
   * and the explorers out on it. World CONTROL is not here — it is server
   * state — and neither is the board's contents, which are a pure function
   * of its seed (sim/world/board.ts).
   */
  world: WorldState;
  /** Discoveries made since the UI last drained them. Transient — a banner
   *  missed at quit simply doesn't replay. */
  pendingDiscoveries: string[];
  /** Analytics events made since the game last drained them (sim/analytics.ts).
   *  Transient, never saved. */
  pendingAnalytics: SimTrack[];
  /** The world seed. Every random outcome in the game is a pure function of
   *  this plus the identity of the event asking (see sim/rng.ts) — never of
   *  how many draws came before, which is what makes offline replay and live
   *  ticking produce the same world. */
  seed: number;
  nextId: number; // monotonic counter for unique ids
  lastAdvance: number; // epoch ms — where the unified advance left off
  /** Epoch ms of the last successful player collect tap (cooldown anchor).
   *  Transient — not persisted; resets on load. */
  lastCollectTapAt: number;
  /** Fractional units a tap has earned but not yet been paid, per currency.
   *  A tap is priced in SECONDS of work, so on most cells it owes a fraction;
   *  carrying the remainder is what makes a +20% TapPower honest instead of
   *  destroyed by rounding. Never negative, never a whole unit. */
  tapCarry: Partial<Record<CurrencyId, number>>;
}

export const newId = (state: GameState, prefix: string): string => `${prefix}_${state.nextId++}`;

export const getWallet = (w: Wallet, c: CurrencyId): number => w[c] ?? 0;
export const addToWallet = (w: Wallet, c: CurrencyId, amount: number): void => {
  w[c] = getWallet(w, c) + amount;
};

// ------------------------------------------------------------- footprints

/** The cells of a size.x × size.y rectangle anchored (top-left) at `anchor`. */
export function cellsOfRect(anchor: Coord, size: { x: number; y: number }): Coord[] {
  const out: Coord[] = [];
  for (let dy = 0; dy < size.y; dy++) {
    for (let dx = 0; dx < size.x; dx++) out.push({ x: anchor.x + dx, y: anchor.y + dy });
  }
  return out;
}

export const districtSize = (d: District): { x: number; y: number } =>
  DISTRICTS[d.definitionId].size;

/** All cells a district occupies (location = top-left anchor). */
export const districtCells = (d: District): Coord[] => cellsOfRect(d.location, districtSize(d));

export const districtOccupies = (d: District, cell: Coord): boolean => {
  const size = districtSize(d);
  return (
    cell.x >= d.location.x && cell.x < d.location.x + size.x &&
    cell.y >= d.location.y && cell.y < d.location.y + size.y
  );
};

export const districtAt = (state: GameState, cell: Coord): District | undefined =>
  state.city.districts.find((d) => districtOccupies(d, cell));

export const districtById = (state: GameState, uniqueId: string): District | undefined =>
  state.city.districts.find((d) => d.uniqueId === uniqueId);

export const townhall = (state: GameState): District =>
  state.city.districts.find((d) => d.definitionId === 'Townhall')!;

/**
 * Jobs that build at once. Floored at 1 so a corrupt or pre-builders save can
 * never deadlock the queue.
 */
export const builderCount = (state: GameState): number => Math.max(1, state.kingdom.builders);

/**
 * How many jobs the city can have in flight — which is exactly the builder
 * count, because THERE IS NO WAITING LINE.
 *
 * A build or upgrade either starts, because a builder is free, or it does not
 * start at all; nothing is ever parked waiting for a slot. That is the design
 * (`Docs/features/06-construction.md`), and it is what makes the refusal a moment
 * worth selling into: the player is told "every builder is busy" and offered
 * one more for Gems, rather than being quietly put in a line.
 *
 * It also means `advanceQueue`'s promotion path — the branch that stamps a
 * waiting item with the moment its slot freed — is unreachable through play
 * BY DESIGN rather than by accident. It is kept because it is the correct
 * behaviour for a queue longer than its slots, and this rule is a design
 * choice that could change; `tests/builders.test.ts` holds it to its
 * contract directly.
 *
 * `city.build_queue_capacity` used to live beside this and is gone from the
 * workbook: a second dial for the same number could only ever disagree with
 * the first, which is how the original bug survived — both gates read the
 * constant (1) and neither read the builders.
 */
export const buildQueueCapacity = (state: GameState): number => builderCount(state);

/** Builders at work: on the city's queue, and out on the world board. */
export const busyBuilders = (state: GameState): number =>
  state.city.queue.length + state.world.builds.length;
