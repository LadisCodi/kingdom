// What the world server holds, and what it tells a player
// (Docs/features/02-map-scopes.md §3, Docs/features/19-world-map.md §5–§7).
//
// World CONTROL is server state: who holds a hex, what stands on it, what
// its stores hold. None of it lives in a player's save. Until the real
// server exists, `local.ts` keeps this in the browser and plays the server's
// part; the shapes here are what the real one will store and send.

import type { Board } from '../sim/battle';
import type { HeroId, UnitId } from '../sim/state';
import type { WorldImprovement } from '../sim/world/types';

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

/** A held hex — or one being claimed (its Outpost not yet standing), or
 *  one nobody holds that still carries what was built on it. */
export interface ServerHex {
  /** The seat that holds or is claiming it; null once it was denied — its
   *  Outpost and improvement still standing, waiting to be taken. */
  owner: number | null;
  /** When its Outpost stands; later than now while a builder is on it. */
  outpostAt: number;
  /** The improvement standing on it, and its level. */
  improvement: { kind: WorldImprovement; level: number } | null;
  /** A level under construction: the improvement reaches `toLevel` at `at`. */
  work: { kind: WorldImprovement; toLevel: number; at: number } | null;
  /** On the chain back to its owner's city (19 §5.2). */
  active: boolean;
  /** What its stores hold, settled at `storeAt`: the improvement's material
   *  and a landmark's Knowledge. Fractions carry. */
  material: number;
  knowledge: number;
  storeAt: number;
  /** The army garrisoned in its Fortress, by id. */
  garrison: string | null;
}

export type ArmyPhase = 'out' | 'garrison' | 'camp' | 'home';

/** What an army was sent to do (19 §4, §5.1, §6, §8.1). */
export type ArmyPurpose = 'attack' | 'claim' | 'garrison' | 'delve';

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
  msPerHex: number;
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
  | { kind: 'loot'; at: number; gold: number; knowledge: number; heroXp: number; stardust: number };

export interface ServerSeat {
  playerId: string;
  name: string;
  /** A stand-in rival the server plays (local only). */
  bot: boolean;
  /** When a bot makes its next move. */
  nextMoveAt: number | null;
  /** How many moves it has made — the key of its next roll. */
  moves: number;
  /** How many hexes it has ever claimed with an Outpost. */
  claims?: number;
}

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
  /** Rooms each seat has cleared in each dungeon, by hex index: progress is
   *  per player (19 §8.1). */
  delves: Record<number, Record<number, number>>;
}

export interface ServerWorld {
  version: 1;
  boards: ServerBoard[];
}

// ------------------------------------------------------------ the view

/** A hex as a player is told about it. */
export interface HexView {
  index: number;
  owner: number | null;
  /** Its Outpost stands. */
  held: boolean;
  outpostAt: number;
  improvement: { kind: WorldImprovement; level: number } | null;
  work: { kind: WorldImprovement; toLevel: number; at: number } | null;
  active: boolean;
  /** Only on the player's own hexes. */
  stores: { material: number; materialCap: number; knowledge: number; knowledgeCap: number } | null;
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
  msPerHex: number;
  target: number;
  at: number | null;
  power: number;
  heroes: HeroId[] | null;
}

export interface SeatView { seat: number; name: string; you: boolean; bot: boolean }

/** Everything a player is told about their board at one moment. */
export interface WorldSnapshot {
  board: BoardRef;
  at: number;
  seats: SeatView[];
  hexes: HexView[];
  armies: ArmyView[];
  /** Rooms the player has cleared in each dungeon, by hex index. */
  delves: Record<number, number>;
  /** What the server owed the player, delivered with this snapshot. */
  effects: WorldEffect[];
}

/** Why a command was refused, in a word the client turns into a line. */
export type Refusal =
  | 'NoSuchHex' | 'NotAdjacent' | 'Taken' | 'NeverHeld' | 'NotYours' | 'NotStanding'
  | 'Busy' | 'WrongGround' | 'MaxLevel' | 'Inactive' | 'NoBoard'
  | 'NoArmy' | 'NotAFortress' | 'Garrisoned' | 'NothingThere' | 'OwnGround';

export type CommandResult =
  | { ok: true; finishesAt: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

export type CollectResult =
  | { ok: true; material: { currency: 'Wood' | 'Food' | 'Stone'; amount: number } | null; knowledge: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

export type SendResult =
  | { ok: true; army: string; arrivesAt: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

/** A dungeon room fought: the fight itself, for the battle screen, and
 *  whether it fell. */
export type DelveResult =
  | { ok: true; won: boolean; log: import('../sim/battle').BattleLog; depth: number; room: number; boss: boolean; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };
