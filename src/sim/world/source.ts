// Where the board comes from (Docs/features/02-map-scopes.md §3).
//
// World control is server state in the design. Until the server exists the
// board is generated here, from the seed the save keeps, and the five other
// cities are stand-ins — but every reader goes through this interface, so
// the day the server hands the client a board, only this file changes. NO
// SIM CODE READS ANOTHER PLAYER'S CONTROL: the explorers need only the
// player's own seat, which is in the save.

import { WORLD, WORLD_GEN } from '../data/definitions';
import { generateBoard, SEAT_INDICES, type Board } from './board';
import type { WorldImprovement } from './types';

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

export interface Seat {
  seat: number;
  /** The city hex's board index. */
  index: number;
  /** The player's own, or a rival's name. */
  owner: { you: true } | { you: false; name: string; rival: number };
}

/** A held or claimed hex as the server describes it (worldServer/types.ts
 *  `HexView`), in the shape the renderer and the sheets read. */
export interface HexControl {
  /** Null on ground nobody holds that still carries what was built on it. */
  owner: number | null;
  held: boolean;
  outpostAt: number;
  improvement: { kind: WorldImprovement; level: number } | null;
  work: { kind: WorldImprovement; toLevel: number; at: number } | null;
  active: boolean;
  stores: { material: number; materialCap: number; knowledge: number; knowledgeCap: number } | null;
  /** The army standing in its Fortress, if any. */
  garrison?: { army: string; owner: number; power: number } | null;
}

export interface WorldSource {
  board(): Board;
  seats(): readonly Seat[];
  /** Whose city or ground a hex is, or null when nobody's. */
  controlOf(index: number): Seat | null;
  /** What stands on a held or claimed hex, or null. Never a city. */
  hexOf(index: number): HexControl | null;
}

const BOARDS = new Map<string, Board>();

/** The board the save names, generated once per id and seed. */
export function boardOf(ref: BoardRef): Board {
  const key = `${ref.id}:${ref.seed}`;
  let board = BOARDS.get(key);
  if (board === undefined) {
    board = generateBoard(ref.id, ref.seed, WORLD_GEN);
    BOARDS.set(key, board);
  }
  return board;
}

/** The local stand-in for the server: the generated board, the player in
 *  their seat and the authored rivals in the other five, in seat order. */
export function localWorld(ref: BoardRef): WorldSource {
  const seats: Seat[] = [];
  let rival = 0;
  SEAT_INDICES.forEach((index, seat) => {
    seats.push({
      seat,
      index,
      owner: seat === ref.seat
        ? { you: true }
        : { you: false, name: WORLD.rivals[rival % WORLD.rivals.length] ?? `Rival ${seat + 1}`, rival: rival++ },
    });
  });
  return {
    board: () => boardOf(ref),
    seats: () => seats,
    controlOf: (index) => seats.find((s) => s.index === index) ?? null,
    hexOf: () => null,
  };
}

/** The board as the world server last described it: its seats, and every
 *  hex it says is held or being claimed. */
export function snapshotWorld(snap: {
  board: BoardRef;
  seats: ReadonlyArray<{ seat: number; name: string; you: boolean }>;
  hexes: ReadonlyArray<HexControl & { index: number }>;
}): WorldSource {
  let rival = 0;
  const seats: Seat[] = snap.seats.map((s) => ({
    seat: s.seat,
    index: SEAT_INDICES[s.seat],
    owner: s.you ? { you: true } : { you: false, name: s.name, rival: rival++ },
  }));
  const hexes = new Map(snap.hexes.map((h) => [h.index, h]));
  return {
    board: () => boardOf(snap.board),
    seats: () => seats,
    controlOf: (index) => {
      const city = seats.find((s) => s.index === index);
      if (city !== undefined) return city;
      const h = hexes.get(index);
      return h === undefined || h.owner === null ? null : seats[h.owner] ?? null;
    },
    hexOf: (index) => hexes.get(index) ?? null,
  };
}
