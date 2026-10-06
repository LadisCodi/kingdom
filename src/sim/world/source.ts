// Where the board comes from (Docs/features/02-map-scopes.md §3).
//
// World control is server state in the design. Until the server exists the
// board is generated here, from the seed the save keeps, and the five other
// cities are stand-ins — but every reader goes through this interface, so
// the day the server hands the client a board, only this file changes. NO
// SIM CODE READS ANOTHER PLAYER'S CONTROL: the explorers need only the
// player's own seat, which is in the save.

import { WORLD, WORLD_GEN } from '../data/definitions';
import { generateBoard, SEAT_INDICES, withDungeons, type Board } from './board';
import type { WorldDistrict, WorldUpgrade } from './types';
import type { ArtifactId, PreciousId } from '../state';

/** Which board, and which of its six cities is the player's. */
export interface BoardRef { id: string; seed: number; seat: number }

export interface Seat {
  seat: number;
  /** The city hex's board index. */
  index: number;
  /** Whose city it is, and the name every player reads under it: the
   *  player's nickname, or a rival's (19 §1.3). */
  owner: { you: true; name: string; crest?: string | null } | { you: false; name: string; rival: number; crest?: string | null };
}

/** A held or claimed hex as the server describes it (worldServer/types.ts
 *  `HexView`), in the shape the renderer and the sheets read. */
export interface HexControl {
  /** Null on ground nobody holds that still carries its district. */
  owner: number | null;
  /** Its district stands; until `standsAt` it is being claimed. */
  held: boolean;
  standsAt: number;
  district: WorldDistrict;
  /** The Fortress built into it: its level, 0 for none. */
  fortress: number;
  work: { upgrade: WorldUpgrade; toLevel: number; at: number } | null;
  active: boolean;
  /** Its store, in its district's currency; only on the player's own hexes. */
  stores: { currency: 'Gold' | 'Wood' | 'Food' | 'Stone' | 'Knowledge'; amount: number; cap: number } | null;
  /** A rich district's precious store (19 §7.4); only on the player's own. */
  precious?: { id: PreciousId; amount: number; cap: number } | null;
  /** Burnt by a camp's raid, and when its repair is done (19 §5.5). */
  burnt?: boolean;
  repairAt?: number | null;
  /** The player's own: the camps that will raid it, and when next. */
  threat?: { camps: number[]; nextRaidAt: number } | null;
  /** The army standing in its Fortress, if any. */
  garrison?: { army: string; owner: number; power: number } | null;
  /** A Chapel stands in it, and the world relic it holds, which every
   *  player sees (relic-restoration.md §5.2). */
  chapel?: boolean;
  relic?: { id: ArtifactId; level: number } | null;
}

export interface WorldSource {
  board(): Board;
  seats(): readonly Seat[];
  /** Whose city or ground a hex is, or null when nobody's. */
  controlOf(index: number): Seat | null;
  /** What stands on a held or claimed hex, or null. Never a city. */
  hexOf(index: number): HexControl | null;
  /** Armies out on the board, the player's and the rivals'. */
  armies(): readonly ArmyControl[];
  /** Rooms the player has cleared in the dungeon on a hex. */
  delved(index: number): number;
  /** Has the player beaten the monster camp on a hex (19 §5.4)? */
  campBeaten(index: number): boolean;
  /** The Dark Portal as the server last described it, or null. */
  portal(): PortalControl | null;
}

/** The Dark Portal as the board shows it (worldServer/types.ts `PortalView`). */
export interface PortalControl {
  open: boolean;
  opensAt: number;
  closesAt: number;
  floor: number;
  attemptsLeft: number;
  ranking: ReadonlyArray<{ seat: number; floor: number }>;
}

/** An army as the board shows it (worldServer/types.ts `ArmyView`). */
export interface ArmyControl {
  id: string;
  owner: number;
  purpose: 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' | 'clear';
  phase: 'out' | 'garrison' | 'camp' | 'home';
  target: number;
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
 *  their seat under `name` and the authored rivals in the other five, in
 *  seat order. */
export function localWorld(ref: BoardRef, name = 'Your kingdom'): WorldSource {
  const seats: Seat[] = [];
  let rival = 0;
  SEAT_INDICES.forEach((index, seat) => {
    seats.push({
      seat,
      index,
      owner: seat === ref.seat
        ? { you: true, name }
        : { you: false, name: WORLD.rivals[rival % WORLD.rivals.length] ?? `Rival ${seat + 1}`, rival: rival++ },
    });
  });
  return {
    board: () => boardOf(ref),
    seats: () => seats,
    controlOf: (index) => seats.find((s) => s.index === index) ?? null,
    hexOf: () => null,
    armies: () => [],
    delved: () => 0,
    campBeaten: () => false,
    portal: () => null,
  };
}

/** The board as the world server last described it: its seats, and every
 *  hex it says is held or being claimed. */
export function snapshotWorld(snap: {
  board: BoardRef;
  seats: ReadonlyArray<{ seat: number; name: string; you: boolean; crest?: string | null }>;
  hexes: ReadonlyArray<HexControl & { index: number }>;
  armies?: readonly ArmyControl[];
  delves?: Readonly<Record<number, number>>;
  /** The monster camps the player has beaten. */
  beaten?: readonly number[];
  /** Where the dungeons stand now; the generated board's when not told. */
  dungeons?: readonly number[];
  portal?: PortalControl;
}): WorldSource {
  let rival = 0;
  const seats: Seat[] = snap.seats.map((s) => ({
    seat: s.seat,
    index: SEAT_INDICES[s.seat],
    owner: s.you ? { you: true, name: s.name, crest: s.crest ?? null } : { you: false, name: s.name, rival: rival++, crest: s.crest ?? null },
  }));
  const hexes = new Map(snap.hexes.map((h) => [h.index, h]));
  return {
    board: () => (snap.dungeons === undefined ? boardOf(snap.board) : withDungeons(boardOf(snap.board), snap.dungeons)),
    seats: () => seats,
    controlOf: (index) => {
      const city = seats.find((s) => s.index === index);
      if (city !== undefined) return city;
      const h = hexes.get(index);
      return h === undefined || h.owner === null ? null : seats[h.owner] ?? null;
    },
    hexOf: (index) => hexes.get(index) ?? null,
    armies: () => snap.armies ?? [],
    delved: (index) => snap.delves?.[index] ?? 0,
    campBeaten: (index) => snap.beaten?.includes(index) ?? false,
    portal: () => snap.portal ?? null,
  };
}
