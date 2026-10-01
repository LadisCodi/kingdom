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

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

export interface Seat {
  seat: number;
  /** The city hex's board index. */
  index: number;
  /** The player's own, or a rival's name. */
  owner: { you: true } | { you: false; name: string };
}

export interface WorldSource {
  board(): Board;
  seats(): readonly Seat[];
  /** Who holds a hex, or null when nobody does. Step 1 knows only the
   *  cities. */
  controlOf(index: number): Seat | null;
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
        : { you: false, name: WORLD.rivals[rival++ % WORLD.rivals.length] ?? `Rival ${seat + 1}` },
    });
  });
  return {
    board: () => boardOf(ref),
    seats: () => seats,
    controlOf: (index) => seats.find((s) => s.index === index) ?? null,
  };
}
