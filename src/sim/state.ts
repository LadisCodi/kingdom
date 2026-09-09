// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.
// (The DISTRICTS import is safe: definitions.ts only imports types from here.)

import { DISTRICTS } from './data/definitions';
// Imported for its KEYS, which are the technology ids (see TechId below).
import techTree from './data/tech-tree.json';
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
  | 'Gems' // player-scoped, premium
  // The two gacha keys: one banner each, bought with Gems, spent on a pull.
  // Player-scoped like Gems, and NOT on the plank — the purse is where they
  // are read (Docs/features/10-heroes.md §5).
  | 'SilverKey' | 'GoldKey';
/** Refined goods: what a workshop turns raw resources into, and what an
 *  advanced building level is priced in. Deliberately NOT a `CurrencyId` —
 *  the city keeps a stockpile, the way the collection keeps ingredients, so
 *  four coins on the plank stays four (Docs/plans/builder-30-days.md §2). */
export type GoodId = 'Planks' | 'CutStone' | 'Iron' | 'Runestone';
/** What the city holds of each. Absent = none, exactly like a Wallet. */
export type GoodsStock = Partial<Record<GoodId, number>>;

export type DistrictId =
  | 'Townhall' | 'Housing' | 'Farm' | 'FarmLands' | 'Sawmill'
  | 'Quarry' | 'Docks' | 'Sanctum'
  | 'Barracks' | 'SpearHall' | 'ShootingGrounds' | 'Stables' | 'Infirmary' // military
  | 'Carpenter' | 'MasonsYard' | 'Smelter' | 'RuneCarver' // workshops
  | 'Garden' | 'Well' | 'Orchard' | 'Statue' | 'Plaza' | 'Shrine'; // decorations
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
export type LandmarkKind = 'Shrine' | 'StandingStones' | 'Leyspring';
export type RuinId =
  | 'HollowBarrow' | 'SunkenChapel' | 'DrownedIronworks' | 'CountingHouse' | 'StarObservatory';
export type ArtifactId =
  | 'DowsingRod' | 'VerdantSeal' | 'ForemansSigil' | 'GildedLedger' | 'WanderersCompass';
export type HeroId =
  'Warden' | 'Quartermaster' | 'Scholar' | 'RelicHunter' | 'Scout' | 'Adventurer' |
  'Bard' | 'BeastkinHunter' | 'Cleric' | 'Cook' | 'Gardener' | 'Joker' | 'Merchant' |
  'Priest' | 'Rogue' | 'ThreeMice' | 'Sellsword' | 'DarkKnight' | 'Paladin' | 'Wizard' |
  'Witch' | 'Druid' | 'IceLancer' | 'HolyWarrior' | 'SavageWarrior' | 'Spymaster' |
  'ElectricArcher' | 'GoldenDragon' | 'VampireLord' | 'Necromancer' | 'Pharao' |
  'ElvenPrincess';
/** The three tomes. The shelf is the layout: one bounded page per book,
 *  each paced by eras (Docs/features/07-research.md §2). */
export type TomeId = 'Civics' | 'Warfare' | 'Magic';

/** A real-money SKU of the simulated store (definitions.ts `STORE`). */
export type StoreSkuId =
  | 'GemsPouch' | 'GemsPurse' | 'GemsChest' | 'GemsVault' | 'GemsHoard' | 'GemsTreasury'
  /** Not a Gem pack: it grants nothing on purchase and unlocks the daily
   *  chest's Royal track for the season (sim/daily.ts). */
  | 'RoyalChest';

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
  level: number;
  assignedWorkers: number;
  location: Coord;
  state: ConstructionState;
  visualVariant: number;
}

export interface QueueItem {
  uniqueId: string;
  kind: 'build' | 'upgrade';
  districtUniqueId: string;
  targetLevel?: number; // upgrades only
  durationSeconds: number;
  startedAt: number | null; // epoch ms; null until it enters the active window
}

export const completesAt = (item: QueueItem): number =>
  (item.startedAt ?? Infinity) + item.durationSeconds * 1000;
export const remainingSeconds = (item: QueueItem, now: number): number =>
  item.startedAt === null ? item.durationSeconds : Math.max(0, (completesAt(item) - now) / 1000);
export const queueProgress = (item: QueueItem, now: number): number =>
  item.startedAt === null || item.durationSeconds === 0
    ? (item.startedAt === null ? 0 : 1)
    : Math.min(1, Math.max(0, (now - item.startedAt) / (item.durationSeconds * 1000)));

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
  /** Epoch ms anchor for passive tax gold (whole units only). */
  lastTaxAt: number;
  /** Epoch ms anchor for Mana regeneration (whole units only), the same
   *  shape as lastTaxAt so both replay deterministically. */
  lastManaAt: number;
}

/** Per-resource-cell harvest state. Absent entry = fresh cell (0 taps). */
export interface CellHarvestState {
  /** Units left in the depot. Everything that extracts — thumb or worker —
   *  draws this down; at zero the cell is exhausted. */
  units: number;
  exhaustedUntil: number | null; // epoch ms; recovery is lazy (derived from time)
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
 * One ruin's gate.
 *
 * `nextRaidAt` is the whole clock: null means nothing is counting — the gate
 * is cleared, or the garrison is out of trips and sitting on what it took.
 * The `hoard` is what it holds, and clearing the gate hands every coin of it
 * back, which is what keeps a raid a bill rather than a loss.
 */
export interface GateState {
  /** Epoch ms of the next raid, or null when nothing is counting. */
  nextRaidAt: number | null;
  /** Raids that actually took something. Capped at `raid.maxRaids`. */
  trips: number;
  /** What it has taken, returned in full when the gate falls. */
  hoard: Wallet;
  cleared: boolean;
}

/** One raid, for the widget. Kept until the player dismisses it. */
export interface RaidReport {
  id: string;
  ruinId: RuinId;
  at: number;
  took: Wallet;
}

/**
 * HOW FAR INTO ONE RUIN THE PLAYER HAS GOT.
 *
 * A ruin is depths of rooms and a room is one fight, cleared in order and
 * never replayed (Docs/features/11-expeditions.md §1). So progress is one
 * address — the deepest room cleared — and the FRONTIER is the room after it.
 *
 * There is no party underground and no timer: a room resolves the instant it
 * is entered, so nothing about a ruin is ever in flight. That is why this
 * replaced the staged delve wholesale rather than being added beside it.
 */
export interface RuinProgress {
  /** The depth the frontier is in, 1-based. */
  depth: number;
  /** Rooms cleared IN that depth. The frontier is room `cleared + 1`; when it
   *  reaches the depth's room count, the next depth opens at 0. */
  cleared: number;
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
    /** The daily chest season. KINGDOM-scoped on purpose, like Knowledge, so
     *  it survives a region reset — a habit is a property of the player, not
     *  of the city they happen to be playing. See sim/daily.ts. */
    daily: {
      /** The `seasonIndex` `rung` belongs to. A stale one reads as rung 0,
       *  so a season turns over with nothing scheduled and nothing to reset. */
      season: number;
      /** Rungs claimed INSIDE that season — days played, not days elapsed. */
      rung: number;
      /** `dayIndex` of the last claim, or null if none — stamped rather than
       *  incremented, so a second claim in one day is impossible however the
       *  clock moves, including backwards. */
      lastClaimedDay: number | null;
      /** The `seasonIndex` the Royal chest was bought for, or null. A
       *  comparison rather than a flag, so nothing has to clear it when the
       *  season turns. */
      royalSeason: number | null;
      /** Which Royal cells have been taken this season, by rung. The paid
       *  track is claimed CELL BY CELL and out of order — buying the chest on
       *  rung 9 leaves nine of them waiting — so this cannot be a count.
       *  Belongs to `season`: a stale one reads as empty. */
      royalClaimed: number[];
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
    /** Technologies in progress — length is capped by techSlots(). */
    /** `durationMs` is fixed when the research STARTS (Scriveners applies then,
     *  not retroactively): a rank landing mid-research must not move a
     *  boundary into the past, which one-call replay and stepped ticking
     *  would then land on differently. Absent on older saves → the authored
     *  duration, which is what they were started at. */
    active: Array<{ id: TechId; startedAt: number; durationMs?: number }>;
    /** Extra concurrent slots bought with Gems (escalating price). */
    slotsPurchased: number;
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
  /** How far into each ruin the player has got. Absent = the gate is still
   *  standing, or nobody has been in yet. */
  ruins: Partial<Record<RuinId, RuinProgress>>;
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
  /** The deepest depth cleared in ANY ruin — a milestone, and what the quest
   *  chain reads. Derived from `ruins` on write rather than recomputed, so a
   *  ruin the player abandons still counts for how deep they have been. */
  deepestDepth: number;
  /** Ruins whose deepest depth has been cleared at least once. The artifact
   *  is granted on the FIRST one — no randomness on the thing that gates a
   *  system. */
  ruinsCleared: Partial<Record<RuinId, true>>;
  /** Claimed landmarks, by content id. Claiming raises the Mana CEILING,
   *  which is what makes exploration compound rather than merely pay. No
   *  landmark is defended: a sanctuary is bought with Gold, and the fight
   *  with a clock belongs to the ruins (sim/gates.ts). */
  landmarks: {
    claimed: Record<string, true>;
  };
  /**
   * The gate on every ruin — one garrison, one clock
   * (Docs/features/18-garrisons-and-raids.md).
   *
   * Absent = the ruin has not been discovered, so nothing is counting. The
   * entry is written by the sweep in `advance()` rather than by the reveal,
   * so the counter is stamped with a boundary's `t` and never with a clock
   * the sim is not allowed to read.
   */
  gates: Partial<Record<RuinId, GateState>>;
  /** Raids the player has not read yet. Persisted: a raid that landed over
   *  lunch is still news when they come back, and the widget carries it until
   *  it is dismissed. */
  raidReports: RaidReport[];
  /**
   * The relic collection. `attuned` is indexed BY SLOT and is exactly as long
   * as the player has slots, so a null is a visibly empty socket rather than
   * an absence; `lockedUntil` is per-slot and derived lazily from time, the
   * same pattern as `exhaustedUntil` on harvest cells.
   */
  artifacts: {
    owned: ArtifactId[];
    levels: Partial<Record<ArtifactId, number>>;
    /** Fragments raise a TIER cap; Stardust buys levels within it. */
    tiers: Partial<Record<ArtifactId, number>>;
    fragments: Partial<Record<ArtifactId, number>>;
    attuned: Array<ArtifactId | null>;
    /** Extra slots bought with Gems (escalating price). */
    slotsPurchased: number;
    /** Per slot; 0 = free. Swapping is immediate, then the slot locks. */
    lockedUntil: number[];
  };
  /** Upgrade levels (instant, gold-bought); absent = level 0. */
  /** The modifier stack: artifact passives (permanent), actives and seasons
   *  (timed). Kingdom-scoped concepts, so this sits beside `upgrades` at the
   *  top level rather than inside `city`. See sim/modifiers.ts. */
  modifiers: Modifier[];
  /** The quest chain: index into QUESTS (length = all done); progress is the
   *  event counter for RELATIVE goals, reset when a quest is claimed. */
  quests: { index: number; progress: number };
  /** First-time discoveries already announced (keys like 'resource:Wood'). */
  discoveries: Record<string, true>;
  /** Discoveries made since the UI last drained them. Transient — a banner
   *  missed at quit simply doesn't replay. */
  pendingDiscoveries: string[];
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
