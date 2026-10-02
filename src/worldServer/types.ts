// What the world server holds, and what it tells a player
// (Docs/features/02-map-scopes.md §3, Docs/features/19-world-map.md §5–§7).
//
// World CONTROL is server state: who holds a hex, what stands on it, what
// its stores hold. None of it lives in a player's save. Until the real
// server exists, `local.ts` keeps this in the browser and plays the server's
// part; the shapes here are what the real one will store and send.

import type { WorldImprovement } from '../sim/world/types';

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

/** A held hex — or one being claimed (its Outpost not yet standing). */
export interface ServerHex {
  /** The seat that holds or is claiming it. */
  owner: number;
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
}

export interface ServerWorld {
  version: 1;
  boards: ServerBoard[];
}

// ------------------------------------------------------------ the view

/** A hex as a player is told about it. */
export interface HexView {
  index: number;
  owner: number;
  /** Its Outpost stands. */
  held: boolean;
  outpostAt: number;
  improvement: { kind: WorldImprovement; level: number } | null;
  work: { kind: WorldImprovement; toLevel: number; at: number } | null;
  active: boolean;
  /** Only on the player's own hexes. */
  stores: { material: number; materialCap: number; knowledge: number; knowledgeCap: number } | null;
}

export interface SeatView { seat: number; name: string; you: boolean; bot: boolean }

/** Everything a player is told about their board at one moment. */
export interface WorldSnapshot {
  board: BoardRef;
  at: number;
  seats: SeatView[];
  hexes: HexView[];
}

/** Why a command was refused, in a word the client turns into a line. */
export type Refusal =
  | 'NoSuchHex' | 'NotAdjacent' | 'Taken' | 'NeverHeld' | 'NotYours' | 'NotStanding'
  | 'Busy' | 'WrongGround' | 'MaxLevel' | 'Inactive' | 'NoBoard';

export type CommandResult =
  | { ok: true; finishesAt: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };

export type CollectResult =
  | { ok: true; material: { currency: 'Wood' | 'Food' | 'Stone'; amount: number } | null; knowledge: number; snapshot: WorldSnapshot }
  | { ok: false; why: Refusal };
