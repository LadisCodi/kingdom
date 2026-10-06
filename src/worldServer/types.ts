// What the world server holds, and what it tells a player
// (Docs/features/02-map-scopes.md §3, Docs/features/19-world-map.md §5–§7).
//
// World CONTROL is server state: who holds a hex, what stands on it, what
// its stores hold. None of it lives in a player's save. Until the real
// server exists, `local.ts` keeps this in the browser and plays the server's
// part; the shapes here are what the real one will store and send.

import type { Board } from '../sim/battle';
import type { ArtifactId, HeroId, LairId, PreciousId, UnitId } from '../sim/state';
import type { WorldDistrict, WorldUpgrade } from '../sim/world/types';

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

/** A held hex — or one being claimed (its district not yet standing), or
 *  one nobody holds that still carries its district. Which district it is
 *  is the hex's feature's (19 §7), so it is never stored. */
export interface ServerHex {
  /** The seat that holds or is claiming it; null once it was denied — its
   *  district and its upgrades still standing, waiting to be taken. */
  owner: number | null;
  /** When its district stands; later than now while a builder is on it. */
  standsAt: number;
  /** The Fortress built into it: its level, 0 for none (19 §7.2). */
  fortress: number;
  /** The Chapel built into it: 1, or 0 / missing for none
   *  (relic-restoration.md §5.2). A Shrine district has one of its own. */
  chapel?: number;
  /** The world relic its owner hosts in its Chapel; missing or null for none. */
  relic?: ArtifactId | null;
  /** An upgrade under construction: it reaches `toLevel` at `at`. */
  work: { upgrade: WorldUpgrade; toLevel: number; at: number } | null;
  /** On the chain back to its owner's city (19 §5.2). */
  active: boolean;
  /** What its store holds, in its district's currency, settled at
   *  `storeAt`. Fractions carry. */
  stored: number;
  storeAt: number;
  /** A rich district's precious store, settled at the same `storeAt`
   *  (19 §7.4). Missing on a hex stored before materials: read as 0. */
  precious?: number;
  /** The army garrisoned in its Fortress, by id. */
  garrison: string | null;
  /** Burnt by a camp's raid (19 §5.5): it makes nothing until repaired. */
  burnt?: boolean;
  /** When its repair is done; null or missing while none is under way. */
  repairAt?: number | null;
}

export type ArmyPhase = 'out' | 'garrison' | 'camp' | 'home';

/** What an army was sent to do (19 §4, §5.1, §6, §8.1). */
export type ArmyPurpose = 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' | 'clear';

/** An army out on the board — server state from the moment it leaves
 *  (02-map-scopes.md §3.1). */
export interface ServerArmy {
  id: string;
  owner: number;
  heroes: HeroId[];
  /** What it fights with as it stands: the board the client built when it
   *  set out, less what every fight since has taken. */
  board: Board;
  /** Board indices from the city to the target. */
  path: number[];
  departedAt: number;
  /** Milliseconds to leave each hex of the path (sim/world/travel.ts). */
  stepMs: number[];
  purpose: ArmyPurpose;
  /** Marching out, standing in a Fortress, camped at a dungeon, or walking
   *  home. */
  phase: ArmyPhase;
  target: number;
  /** When it reaches where it is going: the target, or home. Null while it
   *  stands in a Fortress or camps at a dungeon. */
  at: number | null;
  /** Everyone it has lost so far, for the count it comes home with. */
  fallen: Array<{ unitId: UnitId; count: number }>;
}

/** What the server owes a player, delivered with every snapshot until the
 *  client acknowledges it, and applied by the client once (15-social.md
 *  §1.2). `seq` numbers a seat's effects from 1, in the order they were
 *  owed: the client applies those above the last it saved, and its ack
 *  lets the server forget the rest. */
export type WorldEffect = { seq?: number } & (
  | {
    kind: 'armyHome'; armyId: string; at: number;
    troops: Array<{ unitId: UnitId; count: number }>;
    fallen: Array<{ unitId: UnitId; count: number }>;
    heroes: Array<{ id: HeroId; hp: number }>;
  }
  | { kind: 'report'; at: number; text: string; good: boolean }
  /** Precious material the server hands back: an offer the closed
   *  Exchange still held. */
  | { kind: 'goods'; at: number; lot: Lot; text: string }
  /** What a cleared dungeon room paid (11-expeditions.md §7). */
  | {
    kind: 'loot'; at: number; gold: number; knowledge: number; heroXp: number; stardust: number;
    gems?: number; pack?: 'Rose' | 'Golden';
    /** Where it was won — what a world relic's door is (relic-restoration.md
     *  §2). Absent from a server older than the doors. */
    from?: 'room' | 'boss' | 'portal';
    /** A camp's lump of precious material (19 §5.4). */
    precious?: { id: PreciousId; amount: number };
  }
);

/** The Dark Portal on one board (19 §10). */
export interface PortalState {
  /** The weekly opening these floors belong to; a stale one reads as empty. */
  event: number;
  /** How deep each seat has gone this opening, and when it got there. */
  floors: Record<number, { floor: number; at: number }>;
  /** Floors each seat cleared on a UTC day — only a clear spends one. */
  attempts: Record<number, { day: number; used: number }>;
  /** Who reached each milestone floor first this opening. */
  milestones: Record<number, number>;
  /** The last opening whose close has been paid out. */
  closed: number;
}

export interface ServerSeat {
  playerId: string;
  name: string;
  /** The crest its kingdom chose (`<tincture>.<charge>`, sim/crest.ts);
   *  absent while it wears its nickname's (`setCrest`). */
  crest?: string;
  /** A stand-in rival the server plays (local only). */
  bot: boolean;
  /** When a bot makes its next move. */
  nextMoveAt: number | null;
  /** How many moves it has made — the key of its next roll. */
  moves: number;
  /** How many hexes it has ever claimed. */
  claims?: number;
  /** What its own research does to its improvements — multipliers (≥ 1) on
   *  what each makes an hour and what its store holds. Sent by the client
   *  (`setBoost`); absent = none. */
  boost?: SeatBoost;
  /** The level of each world relic it has hosted, as its client last sent
   *  it (`hostRelic`). */
  relics?: Partial<Record<ArtifactId, number>>;
}

/** A seat's multipliers on its improvements' output and stores. */
export interface SeatBoost { produce: number; store: number }

export interface ServerBoard {
  id: string;
  seed: number;
  /** Six cities, in seat order; null is a free one. */
  seats: Array<ServerSeat | null>;
  /** Held and claimed hexes, by board index. A city is never here: it is
   *  its seat's, always, and the root of its chain. */
  hexes: Record<number, ServerHex>;
  /** Everything due up to here has been resolved. */
  resolvedTo: number;
  armies: ServerArmy[];
  /** Owed to each seat, oldest first, until the seat acknowledges them. */
  effects: Record<number, WorldEffect[]>;
  /** The last `seq` given to an effect owed to each seat. */
  effectSeq?: Record<number, number>;
  /** The commands each seat made most recently, by the id the client gave
   *  them, with the answer they got: a retry is answered again, never run
   *  again. */
  ops?: Record<number, Array<{ id: string; reply: unknown }>>;
  /** The counter army ids are made from. */
  nextId: number;
  /** Rooms each seat has cleared in each dungeon, by hex index. Each player
   *  delves for themselves, and all of it is wiped when the dungeon closes
   *  (19 §8.1). */
  delves: Record<number, Record<number, number>>;
  /** One dungeon per sixth of the board, where it is now. Missing on a board
   *  stored before dungeons moved: it is read from the generated board. */
  dungeons?: ServerDungeon[];
  portal: PortalState;
  /** The monster camps each seat has beaten, by hex index (19 §5.4): a camp
   *  is beaten by each player for themselves. */
  beaten?: Record<number, number[]>;
  /** When each stand-in rival will have beaten a camp it means to claim. */
  botCamps?: Record<number, Record<number, number>>;
  /** The lurking camps each seat has seen, as its client reported them:
   *  only a camp the player has seen raids them (19 §5.5). */
  seenCamps?: Record<number, number[]>;
  /** Offers the closed Exchange still holds; handed back to their makers
   *  the next time the board is resolved (core.ts `closeExchange`). */
  offers?: Offer[];
}

/** An amount of one precious material. */
export interface Lot { id: PreciousId; amount: number }

/** An offer the closed Exchange held, as old boards still carry it. */
export interface Offer {
  id: string;
  seat: number;
  give: Lot;
}

/** A sixth's dungeon (19 §8.1): standing on a hex, or closed and coming
 *  back. */
export interface ServerDungeon {
  /** The sixth of the board it belongs to, and stays in. */
  wedge: number;
  /** How many times it has closed — the key of its next rolls. */
  n: number;
  /** The hex it stands on; null while it is gone. */
  index: number | null;
  /** When it comes back; null while it stands. */
  returnsAt: number | null;
  /** The hex it last stood on, which it never comes back to. */
  left?: number;
}

export interface ServerWorld {
  version: 5;
  boards: ServerBoard[];
  /** The stand-in's nicknames, by player. The real server keeps them in a
   *  table of their own: they are unique across every board. */
  nicknames?: Record<string, string>;
}

// ------------------------------------------------------------ the view

/** A hex as a player is told about it. */
export interface HexView {
  index: number;
  owner: number | null;
  /** Its district stands. */
  held: boolean;
  standsAt: number;
  district: WorldDistrict;
  fortress: number;
  /** A Chapel stands in it — built, or a Shrine district's own. */
  chapel: boolean;
  /** The world relic in its Chapel, and its level: every player sees it. */
  relic: { id: ArtifactId; level: number } | null;
  work: { upgrade: WorldUpgrade; toLevel: number; at: number } | null;
  active: boolean;
  /** Only on the player's own hexes: its store, in its district's currency. */
  stores: { currency: WorldStoreCurrency; amount: number; cap: number } | null;
  /** A rich district's precious store; only on the player's own hexes. */
  precious?: { id: PreciousId; amount: number; cap: number } | null;
  /** The army standing in its Fortress: whose, and what it is worth. */
  garrison: { army: string; owner: number; power: number } | null;
  /** Burnt by raiders, and when its repair is done if one is under way. */
  burnt?: boolean;
  repairAt?: number | null;
  /** Only on the player's own hexes: the camps beside it that will raid it,
   *  and when the next raid lands (19 §5.5). */
  threat?: { camps: number[]; nextRaidAt: number } | null;
}

/** An army as a player is told about it: where it walks and whose it is.
 *  What it carries is told only to its owner. */
export interface ArmyView {
  id: string;
  owner: number;
  purpose: ArmyPurpose;
  phase: ArmyPhase;
  path: number[];
  departedAt: number;
  stepMs: number[];
  target: number;
  at: number | null;
  power: number;
  heroes: HeroId[] | null;
  /** Its own owner sees what it fights with as it stands: each slot, a
   *  hero's wounds, and the soldiers lost so far. */
  slots?: Array<{ kind: 'troop' | 'hero'; unitId: UnitId | null; fighterId: string | null; name: string; count: number; hp: number; hpMax: number }>;
  fallen?: Array<{ unitId: UnitId; count: number }>;
}

export interface SeatView {
  seat: number;
  name: string;
  you: boolean;
  bot: boolean;
  /** The crest its kingdom chose; null while it wears its nickname's. */
  crest?: string | null;
}

export interface PortalView {
  open: boolean;
  /** When it next opens, or when it closes if it is open. */
  opensAt: number;
  closesAt: number;
  /** The player's deepest floor this opening, and clears left today. */
  floor: number;
  attemptsLeft: number;
  /** Every seat that has gone down, deepest first, earliest first. */
  ranking: Array<{ seat: number; floor: number }>;
}

/** Everything a player is told about their board at one moment. */
export interface WorldSnapshot {
  board: BoardRef;
  at: number;
  seats: SeatView[];
  hexes: HexView[];
  armies: ArmyView[];
  /** Rooms the player has cleared in each dungeon, by hex index. */
  delves: Record<number, number>;
  /** The monster camps the player has beaten, by hex index. */
  beaten?: number[];
  /** The lurking camps the server knows the player has seen. */
  seenCamps?: number[];
  /** The hexes a dungeon stands on now. */
  dungeons: number[];
  /** Each standing dungeon's name, creature and bosses, and the race. */
  dungeonInfo?: DungeonView[];
  /** The Dark Portal as the player sees it. */
  portal: PortalView;
  /** What the server owed the player, delivered with this snapshot. */
  effects: WorldEffect[];
}

/** A standing dungeon as a player reads it (19 §8.1). */
export interface DungeonView {
  index: number;
  /** What its rolls are keyed on: its sixth and how many times it moved. */
  key: string;
  name: string;
  creature: LairId;
  /** Who waits at the bottom of each depth. */
  bosses: string[];
  /** Every player who has cleared a room in it, furthest first. */
  race: Array<{ seat: number; cleared: number }>;
}

/** An offer as a player sees it: whose, and whether it is theirs. */
/** Why a command was refused, in a word the client turns into a line. */
export type Refusal =
  | 'NoSuchHex' | 'NotAdjacent' | 'Taken' | 'NeverHeld' | 'NotYours' | 'NotStanding'
  | 'Busy' | 'WrongGround' | 'MaxLevel' | 'Inactive' | 'NoBoard'
  | 'NoArmy' | 'NotAFortress' | 'Garrisoned' | 'NothingThere' | 'OwnGround' | 'Shut' | 'NoAttempts' | 'NoRoute'
  | 'NothingBuilding' | 'Guarded'

  /** A world relic's host (relic-restoration.md §5.2). */
  | 'NoChapel' | 'TooManyChapels' | 'NotAWorldRelic'
  /** The dev tool asked to play a seat that is not a rival's. */
  | 'NotARival'
  /** The server could not be reached, however often it was asked. */
  | 'Offline'
  /** A nickname of the wrong shape, or one another player has. */
  | 'BadNickname' | 'NicknameTaken';

export type CommandResult =
  | { ok: true; finishesAt: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

/** What a district's store can hold. */
export type WorldStoreCurrency = 'Gold' | 'Wood' | 'Food' | 'Stone' | 'Knowledge';

export type CollectResult =
  | {
    ok: true; paid: { currency: WorldStoreCurrency; amount: number } | null;
    /** What the precious store paid, if anything. */
    precious: { id: PreciousId; amount: number } | null;
    snapshot: WorldSnapshot;
  }
  | { ok: false; why: Refusal };

export type SendResult =
  | { ok: true; army: string; arrivesAt: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

/** A dungeon room fought: the fight itself, for the battle screen, and
 *  whether it fell. */
export type DelveResult =
  | {
    ok: true; won: boolean; log: import('../sim/battle').BattleLog; depth: number; room: number; boss: boolean;
    /** Soldiers this fight cost. */
    lost: number;
    snapshot: WorldSnapshot;
  }
  | { ok: false; why: Refusal };
