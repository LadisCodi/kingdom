// THE REAL WORLD SERVER'S BODY (Docs/plans/online-server.md §3): one request
// from one signed-in player, against boards kept in a database. The edge
// function (supabase/functions/world) is only the glue around this — who the
// user is, the tables, the clock — so everything that can go wrong in between
// is here, and tested with a store in memory.
//
// A board is one document with a version. A request reads the player's
// board, answers it with `handleWorld`, and writes it back only if nobody
// wrote it in between; if somebody did, it starts again on the newer board.

import { SEATS } from '../sim/world/board';
import { newBoardSeed } from './core';
import { handleWorld, type WorldCommandKind, type WorldRequest } from './handle';
import { nicknameProblem, normalNickname } from './nickname';
import type { ServerBoard, ServerWorld } from './types';

/** Where boards live: tables on the server, maps in the tests. */
export interface BoardStore {
  /** The board a player sits on, if any. */
  boardOf(userId: string): Promise<string | null>;
  load(boardId: string): Promise<{ doc: ServerBoard; version: number } | null>;
  /** Write a board back if it is still at `version`; false if it moved on. */
  update(boardId: string, doc: ServerBoard, version: number): Promise<boolean>;
  /** A new board and the player's seat on it; false if either is taken. */
  create(doc: ServerBoard, userId: string, seat: number): Promise<boolean>;
  /** The newest board with a rival's city left to take, if any. */
  openBoard(): Promise<string | null>;
  /** Write a board back with the player now in `seat`, if it is still at
   *  `version` and the seat is free; false otherwise. */
  takeSeat(boardId: string, doc: ServerBoard, version: number, userId: string, seat: number): Promise<boolean>;
  /** Reserve a nickname for a player: the one they already have if any,
   *  else this one; null if another player has it, whatever its case. */
  claimNickname(userId: string, nickname: string): Promise<string | null>;
  /** The player's friends' ids (15 §2.1). */
  friendsOf(userId: string): Promise<string[]>;
}

/** What a client sends: a request without the player — that is the
 *  signed-in user's, never the body's — and without a new board's name,
 *  which is the server's to give. */
export type WorldBody = Omit<WorldRequest, 'playerId' | 'newBoard'>;

export type Served =
  | { status: 200; reply: unknown }
  | { status: 400 | 409; error: string };

/** Every command the server takes. A record, not a list, so a command added
 *  to `WorldCommands` and missing here is a type error, not a 400 online. */
const KIND_TABLE: Record<WorldCommandKind, true> = {
  join: true, snapshot: true, claim: true, upgrade: true, tribute: true, repair: true, finish: true, hurry: true, hurryArmy: true,
  collect: true, reportSeen: true, sendArmy: true, recall: true, delveRoom: true, fightCamp: true, descendPortal: true, setBoost: true,
  setCrest: true, setTownhall: true, hostRelic: true, unhostRelic: true,
};
const KINDS: ReadonlySet<string> = new Set(Object.keys(KIND_TABLE));

/** How many times a request starts again on a board written under it. */
const ATTEMPTS = 5;

/** The shape of a request, checked before anything reads it. */
export function badBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return 'not an object';
  const b = body as Record<string, unknown>;
  if (typeof b.opId !== 'string' || b.opId.length === 0 || b.opId.length > 64) return 'opId';
  if (!Number.isInteger(b.ack) || (b.ack as number) < 0) return 'ack';
  if (b.asSeat !== undefined && (!Number.isInteger(b.asSeat) || (b.asSeat as number) < 0 || (b.asSeat as number) >= SEATS.length)) return 'asSeat';
  const cmd = b.cmd as Record<string, unknown> | null;
  if (cmd === null || typeof cmd !== 'object' || !KINDS.has(cmd.kind as WorldCommandKind)) return 'cmd';
  if (cmd.kind === 'join' && typeof cmd.nickname !== 'string') return 'nickname';
  if (cmd.kind === 'setCrest' && cmd.crest !== null && (typeof cmd.crest !== 'string' || cmd.crest.length > 32)) return 'crest';
  if (cmd.kind === 'setTownhall' && (!Number.isInteger(cmd.level) || (cmd.level as number) < 1 || (cmd.level as number) > 999)) return 'level';
  return null;
}

/** Answer one player's request at the server's `now`. */
export async function serveWorld(store: BoardStore, userId: string, body: unknown, now: number): Promise<Served> {
  const bad = badBody(body);
  if (bad !== null) return { status: 400, error: `bad request: ${bad}` };
  const { opId, ack, asSeat, cmd } = body as WorldBody;
  const req: WorldRequest = { opId, ack, asSeat, cmd, playerId: userId, friends: await store.friendsOf(userId) };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const boardId = await store.boardOf(userId);
    if (boardId === null) {
      if (cmd.kind !== 'join') return { status: 200, reply: refusal(cmd.kind, 'NoBoard') };
      const seated = await seatNewPlayer(store, req, cmd.nickname, now);
      if (seated !== null) return seated;
      continue;
    }
    const row = await store.load(boardId);
    if (row === null) return { status: 409, error: 'the board is gone' };
    const world: ServerWorld = { version: 5, boards: [row.doc] };
    // Dev "play as" is for the rivals the server plays, never another player.
    if (req.asSeat !== undefined && row.doc.seats[req.asSeat]?.bot !== true) {
      return { status: 200, reply: refusal(cmd.kind, 'NotARival') };
    }
    let reply: unknown;
    try {
      reply = handleWorld(world, req, now);
    } catch (err) {
      return { status: 400, error: `refused: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (await store.update(boardId, world.boards[0], row.version)) return { status: 200, reply };
  }
  return { status: 409, error: 'the board kept changing' };
}

/** A first join: the nickname reserved, then a rival's city on the newest
 *  board that has one, else a board of the player's own. Null when the
 *  board changed under it — the caller starts again. */
async function seatNewPlayer(store: BoardStore, req: WorldRequest, nickname: string, now: number): Promise<Served | null> {
  if (nicknameProblem(nickname) !== null) return { status: 200, reply: { ok: false, why: 'BadNickname' } };
  const name = await store.claimNickname(req.playerId, normalNickname(nickname));
  if (name === null) return { status: 200, reply: { ok: false, why: 'NicknameTaken' } };
  const id = `b-${req.playerId}`;
  const join: WorldRequest = { ...req, cmd: { kind: 'join', nickname: name }, newBoard: { id, seed: newBoardSeed(id) } };
  const open = await store.openBoard();
  const row = open === null ? null : await store.load(open);
  const world: ServerWorld = { version: 5, boards: row === null ? [] : [row.doc] };
  const reply = handleWorld(world, join, now);
  const board = world.boards[0];
  const seat = board.seats.findIndex((s) => s?.playerId === req.playerId);
  const kept = row === null
    ? await store.create(board, req.playerId, seat)
    : await store.takeSeat(board.id, board, row.version, req.playerId, seat);
  return kept ? { status: 200, reply } : null;
}

function refusal(kind: WorldCommandKind, why: 'NotARival' | 'NoBoard'): unknown {
  return kind === 'snapshot' || kind === 'setBoost' || kind === 'setCrest' || kind === 'setTownhall' ? null : { ok: false, why };
}

/** Boards in memory, for the tests — and the shape the tables keep. */
export function memoryBoards(): BoardStore & {
  boards: Map<string, { doc: string; version: number; at: number }>;
  seats: Map<string, string>;
  nicknames: Map<string, string>;
  friends: Map<string, string[]>;
} {
  const boards = new Map<string, { doc: string; version: number; at: number }>();
  const seats = new Map<string, string>();
  const nicknames = new Map<string, string>();
  const friends = new Map<string, string[]>();
  let made = 0;
  const write = (id: string, doc: ServerBoard, version: number) =>
    boards.set(id, { doc: JSON.stringify(doc), version: version + 1, at: boards.get(id)!.at });
  return {
    boards,
    seats,
    nicknames,
    friends,
    async friendsOf(userId) { return friends.get(userId) ?? []; },
    async boardOf(userId) { return seats.get(userId) ?? null; },
    async load(id) {
      const r = boards.get(id);
      return r === undefined ? null : { doc: JSON.parse(r.doc) as ServerBoard, version: r.version };
    },
    async update(id, doc, version) {
      if (boards.get(id)?.version !== version) return false;
      write(id, doc, version);
      return true;
    },
    async create(doc, userId) {
      if (boards.has(doc.id) || seats.has(userId)) return false;
      boards.set(doc.id, { doc: JSON.stringify(doc), version: 0, at: made++ });
      seats.set(userId, doc.id);
      return true;
    },
    async openBoard() {
      const open = [...boards.entries()]
        .filter(([, r]) => (JSON.parse(r.doc) as ServerBoard).seats.some((s) => s?.bot === true))
        .sort((a, b) => b[1].at - a[1].at);
      return open[0]?.[0] ?? null;
    },
    async takeSeat(id, doc, version, userId) {
      if (boards.get(id)?.version !== version || seats.has(userId)) return false;
      write(id, doc, version);
      seats.set(userId, id);
      return true;
    },
    async claimNickname(userId, nickname) {
      const mine = nicknames.get(userId);
      if (mine !== undefined) return mine;
      const lower = nickname.toLowerCase();
      if ([...nicknames.values()].some((n) => n.toLowerCase() === lower)) return null;
      nicknames.set(userId, nickname);
      return nickname;
    },
  };
}

// The bundle's whole surface: the edge function needs the server and its door.
export { handleWorld };
// …and the friends list's, which the `social` function runs from the same bundle.
export { serveSocial } from '../socialServer/serve';
