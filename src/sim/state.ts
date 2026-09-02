// Core simulation state types. This module (and everything under src/sim/) is
// pure TypeScript: no DOM, no Date.now() — callers pass `now` (epoch ms) and an
// injectable rng so the sim stays deterministic and portable to a server.
// (The DISTRICTS import is safe: definitions.ts only imports types from here.)

import { DISTRICTS } from './data/definitions';
import type { Modifier } from './modifiers';

export type CurrencyId =
  | 'Gold' | 'Food' | 'Wood' | 'Stone' | 'Iron' | 'Knowledge' | 'Gems'
  | 'Mana' // the only capped currency — see sim/mana.ts
  | 'Berries' | 'Meat' | 'Fish'; // food-valued (see CurrencyDef.countsAs)
export type DistrictId =
  | 'Townhall' | 'Housing' | 'Farm' | 'FarmLands' | 'Sawmill' | 'Market'
  | 'Quarry' | 'Docks' | 'Mine' | 'Sanctum'
  | 'Barracks' | 'SpearHall' | 'ShootingGrounds' | 'Stables'; // military
/** Which authored region this kingdom is playing. One today — the field
 *  exists now because the SAVE FILE is the only artefact that cannot be
 *  changed retroactively: every save written before it exists is ambiguous
 *  the moment a second region appears, and "it must be the first one" is a
 *  guess that fails for anyone mid-migration. */
export type RegionId = 'oakville';

export type TerrainId =
  | 'Grassland' | 'Plains' | 'Desert' | 'Snow' | 'Tundra' | 'Water' | 'Mountain';
export type FeatureId = 'Trees' | 'BerryBush' | 'WildAnimals' | 'Rocks' | 'FishShoal' | 'IronVein';
export type HarvestSourceId = 'Forest' | 'Crops' | 'Berries' | 'Meat' | 'Stone' | 'Fish' | 'Iron';
export type UnitId = 'Warrior' | 'Lancer' | 'Archer' | 'Cavalry';
export type LandmarkKind = 'Shrine' | 'StandingStones' | 'Leyspring';
export type RuinId =
  | 'HollowBarrow' | 'SunkenChapel' | 'DrownedIronworks' | 'CountingHouse' | 'StarObservatory';
export type ArtifactId =
  | 'DowsingRod' | 'VerdantSeal' | 'ForemansSigil' | 'GildedLedger' | 'WanderersCompass';
export type HeroId = 'Warden' | 'Quartermaster' | 'Scholar' | 'RelicHunter' | 'Scout';
export type TechId =
  | 'Forestry'
  | 'UrbanPlanning' | 'Communities' | 'Architecture' // civics (up)
  | 'Agriculture' | 'Farming' | 'Market' | 'CropRotation' // economics: farm side
  | 'Masonry' | 'Mining' | 'Engineering' | 'DeepMining' // economics: stone side
  | 'Sailing' | 'Fishing' | 'Shipbuilding' | 'ScalingTools' // exploration (right)
  | 'Warrior' | 'Spears' | 'Archery' | 'Cavalry' // military (down)
  | 'Attunement' | 'Warband'; // the magic and expedition leaves
export type UpgradeId =
  | 'TapPower' | 'QuickHands' | 'WorkerLoad' | 'MarketStall' | 'TradeRoutes'
  | 'Stonecutting' | 'BigNets' | 'IronPicks';

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
  /** Housing: when this house's collection cycle last rolled over. A tap
   *  collects early WITHIN the current cycle and cannot exceed it, so a house
   *  can never pay more than a cycle's worth however fast you tap.
   *  0 = never tapped (the first cycle is ready immediately). */
  lastTapAt: number;
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
  population: number;
  districts: District[];
  queue: QueueItem[];
  /** Villager training queue at the Townhall: `queued` villagers are paid
   *  for; the current one started at `startedAt`, the rest follow. */
  training: { queued: number; startedAt: number } | null;
  /** Units in training, across all four military buildings. */
  armyQueue: ArmyTrainingItem[];
  /** Epoch ms anchor for passive tax gold (whole units only). */
  lastTaxAt: number;
  /** Epoch ms anchor for Mana regeneration (whole units only), the same
   *  shape as lastTaxAt so both replay deterministically. */
  lastManaAt: number;
}

/** Per-resource-cell harvest state. Absent entry = fresh cell (0 taps). */
export interface CellHarvestState {
  taps: number;
  exhaustedUntil: number | null; // epoch ms; recovery is lazy (derived from time)
}

export type WorkerActivity = 'Idle' | 'MovingToCell' | 'Working' | 'MovingHome';

export interface Worker {
  id: string;
  buildingId: string; // district uniqueId
  activity: WorkerActivity;
  claimedCell: Coord | null;
  carrying: boolean; // true on the way home with a harvested unit
  stateStartedAt: number; // epoch ms — for render interpolation
  stateUntil: number | null; // event time; null while Idle
}

/** What a scheduled window DOES. Payloads are data; the handlers that read
 *  them are pure functions of (state, entry, t) — no closures over UI, or the
 *  sim stops being replayable. */
export type SchedulePayload =
  | { kind: 'conjunction'; occurrence: number }
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

/** One unit waiting to be trained. Paid for up front; `startedAt` is stamped
 *  when it reaches the front of its BUILDING's line. */
export interface ArmyTrainingItem {
  uniqueId: string;
  unitId: UnitId;
  buildingId: string;
  startedAt: number | null;
}

/** A committed stack. A party SLOT holds a unit TYPE and every unit of it you
 *  chose to send, so slots limit composition BREADTH rather than headcount —
 *  which is what makes the type chart interesting and what "coverage" means
 *  when a second hero arrives. */
export interface PartySlotState {
  unitId: UnitId;
  count: number;
}

export type DelvePhase = 'descending' | 'checkpoint' | 'done';

/** A party in a ruin. The haul is NOT yours until you extract it — that
 *  framing is what makes a failed push cost half of it without breaking the
 *  promise that nothing you OWN is ever taken. */
export interface Delve {
  id: string;
  ruinId: RuinId;
  heroId: HeroId;
  party: PartySlotState[];
  /** Depths already cleared. */
  depth: number;
  partyHp: number;
  maxPartyHp: number;
  /** Banked only on extraction. */
  haul: Wallet;
  haulFragments: number;
  phase: DelvePhase;
  /** When the depth currently being cleared finishes. Delve timers NEVER
   *  pause: the offline cap limits what the city PRODUCES, never a timer. */
  depthEndsAt: number;
  /** "Delve to depth N, then come back" — the opt-out for anyone who does not
   *  want to be asked. Null = ask me at every checkpoint. */
  standingOrder: number | null;
  /** The threat of the depth being cleared right now, rolled when the party
   *  committed to it. The gamble is INFORMATION, not dice. */
  threat: UnitId | 'Any';
  /** How the run ended, for the report. */
  outcome: 'extracted' | 'failed' | null;
}

export interface GameState {
  regionId: RegionId;
  city: City;
  kingdom: {
    maxBuilders: number;
    wallet: Wallet;
    /** Epoch ms anchor for the Knowledge drip (whole units only). */
    lastKnowledgeAt: number;
  };
  player: { wallet: Wallet };
  fog: {
    revealed: Record<string, true>; // coordKey → revealed
    /** coordKey → discovered by a building's discover radius. (Cells adjacent
     *  to a revealed cell are ALSO Discovered — that part stays derived.) */
    discovered: Record<string, true>;
    progress: Record<string, number>; // coordKey → gold paid so far
  };
  features: Record<string, FeatureId>; // coordKey → feature at its CURRENT cell
  /** Respawning features: current cell → its map-authored ORIGIN + respawn
   *  generation (drives the deterministic "random" adjacent placement). */
  featureMeta: Record<string, { origin: string; generation: number }>;
  /** Depleted features waiting to reappear next to their origin. */
  featureRespawns: Array<{
    origin: string; feature: FeatureId; readyAt: number; generation: number;
  }>;
  harvest: Record<string, CellHarvestState>; // coordKey → taps/exhaustion
  workers: Worker[];
  army: ArmyUnit[];
  research: {
    completed: TechId[];
    /** Technologies in progress — length is capped by techSlots(). */
    active: Array<{ id: TechId; startedAt: number }>;
    /** Extra concurrent slots bought with Gems (escalating price). */
    slotsPurchased: number;
  };
  /**
   * Scheduled content: seasons, events, gacha banners, the Conjunction.
   *
   * Reconciled from the BUILD's catalogue at load, so a save written before a
   * content drop still learns the new window exists — and a window that
   * opened and closed during an absence still fires, because boundaries are
   * absolute-time and reconciliation happens before the replay.
   */
  schedule: ScheduledEntry[];
  /** Parties currently in ruins. One per hero: heroes gate delve throughput
   *  as well as capability, which is what makes a second hero a prize twice
   *  over. */
  delves: Delve[];
  /** The hero roster, on the same collection substrate as the relics. */
  heroes: {
    owned: HeroId[];
    levels: Partial<Record<HeroId, number>>;
    tiers: Partial<Record<HeroId, number>>;
    fragments: Partial<Record<HeroId, number>>;
    xp: Partial<Record<HeroId, number>>;
    /** Extra party slots bought with Gems. */
    partySlotsPurchased: number;
  };
  /** Pull counters, per banner. Persisted because pity depends on them — and
   *  because the counter IS the rng key, which is what lets a hash beat a
   *  stream here. */
  gacha: {
    pullCounts: Record<string, number>;
    pityCounters: Record<string, number>;
  };
  /** The deepest depth any party has ever cleared. Persisted rather than
   *  derived, because a delve that ended is gone — and "how deep have you
   *  been" is a milestone, not a live reading. */
  deepestDepth: number;
  /** Ruins whose deepest depth has been cleared at least once. The artifact
   *  is granted on the FIRST one — no randomness on the thing that gates a
   *  system. */
  ruinsCleared: Partial<Record<RuinId, true>>;
  /** Claimed landmarks (by content id) and, for the defended ones, whose
   *  guard has already been beaten. Claiming raises Mana PRODUCTION, which is
   *  what makes exploration compound rather than merely pay. */
  landmarks: {
    claimed: Record<string, true>;
    cleared: Record<string, true>;
  };
  /**
   * The relic collection. `attuned` is indexed BY SLOT and is exactly as long
   * as the player has slots, so a null is a visibly empty socket rather than
   * an absence; `lockedUntil` is per-slot and derived lazily from time, the
   * same pattern as `exhaustedUntil` on harvest cells.
   */
  artifacts: {
    owned: ArtifactId[];
    levels: Partial<Record<ArtifactId, number>>;
    /** Fragments raise a TIER cap; Knowledge buys levels within it. */
    tiers: Partial<Record<ArtifactId, number>>;
    fragments: Partial<Record<ArtifactId, number>>;
    attuned: Array<ArtifactId | null>;
    /** Extra slots bought with Gems (escalating price). */
    slotsPurchased: number;
    /** Per slot; 0 = free. Swapping is immediate, then the slot locks. */
    lockedUntil: number[];
  };
  /** Upgrade levels (instant, gold-bought); absent = level 0. */
  upgrades: Partial<Record<UpgradeId, number>>;
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
