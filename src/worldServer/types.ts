// What the world server holds, and what it tells a player
// (Docs/features/02-map-scopes.md §3, Docs/features/19-world-map.md §5–§7).
//
// World CONTROL is server state: who holds a hex, what stands on it, what
// its stores hold. None of it lives in a player's save. Until the real
// server exists, `local.ts` keeps this in the browser and plays the server's
// part; the shapes here are what the real one will store and send.

import type { Board } from '../sim/battle';
import type { HeroId, PreciousId, UnitId } from '../sim/state';
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

/** What the server owes a player, delivered with the next snapshot and
 *  applied by the client (15-social.md §1.2). */
export type WorldEffect =
  | {
    kind: 'armyHome'; armyId: string; at: number;
    troops: Array<{ unitId: UnitId; count: number }>;
    fallen: Array<{ unitId: UnitId; count: number }>;
    heroes: Array<{ id: HeroId; hp: number }>;
  }
  | { kind: 'report'; at: number; text: string; good: boolean }
  /** What a cleared dungeon room paid (11-expeditions.md §7). */
  | {
    kind: 'loot'; at: number; gold: number; knowledge: number; heroXp: number; stardust: number;
    gems?: number; pack?: 'Rose' | 'Golden';
    /** A camp's lump of precious material (19 §5.4). */
    precious?: { id: PreciousId; amount: number };
  };

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
  /** Owed to each seat, oldest first. */
  effects: Record<number, WorldEffect[]>;
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
  version: 3;
  boards: ServerBoard[];
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
  work: { upgrade: WorldUpgrade; toLevel: number; at: number } | null;
  active: boolean;
  /** Only on the player's own hexes: its store, in its district's currency. */
  stores: { currency: WorldStoreCurrency; amount: number; cap: number } | null;
  /** A rich district's precious store; only on the player's own hexes. */
  precious?: { id: PreciousId; amount: number; cap: number } | null;
  /** The army standing in its Fortress: whose, and what it is worth. */
  garrison: { army: string; owner: number; power: number } | null;
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
}

export interface SeatView { seat: number; name: string; you: boolean; bot: boolean }

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
  /** The hexes a dungeon stands on now. */
  dungeons: number[];
  /** The Dark Portal as the player sees it. */
  portal: PortalView;
  /** What the server owed the player, delivered with this snapshot. */
  effects: WorldEffect[];
}

/** Why a command was refused, in a word the client turns into a line. */
export type Refusal =
  | 'NoSuchHex' | 'NotAdjacent' | 'Taken' | 'NeverHeld' | 'NotYours' | 'NotStanding'
  | 'Busy' | 'WrongGround' | 'MaxLevel' | 'Inactive' | 'NoBoard'
  | 'NoArmy' | 'NotAFortress' | 'Garrisoned' | 'NothingThere' | 'OwnGround' | 'Shut' | 'NoAttempts' | 'NoRoute'
  | 'NothingBuilding' | 'Guarded';

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
  | { ok: true; won: boolean; log: import('../sim/battle').BattleLog; depth: number; room: number; boss: boolean; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };
