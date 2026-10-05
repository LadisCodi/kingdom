// THE REAL WORLD SERVER'S BODY (Docs/plans/online-server.md §3): one request
// from one signed-in player, against boards kept in a database. The edge
// function (supabase/functions/world) is only the glue around this — who the
// user is, the tables, the clock — so everything that can go wrong in between
// is here, and tested with a store in memory.
//
// A board is one document with a version. A request reads the player's
// board, answers it with `handleWorld`, and writes it back only if nobody
// wrote it in between; if somebody did, it starts again on the newer board.

import { handleWorld, type WorldCommandKind, type WorldRequest } from './handle';
import type { ServerBoard, ServerWorld } from './types';

/** Where boards live: two tables on the server, a map in the tests. */
export interface BoardStore {
  /** The board a player sits on, if any. */
  boardOf(userId: string): Promise<string | null>;
  load(boardId: string): Promise<{ doc: ServerBoard; version: number } | null>;
  /** Write a board back if it is still at `version`; false if it moved on. */
  update(boardId: string, doc: ServerBoard, version: number): Promise<boolean>;
  /** A new board and the player's seat on it; false if the id is taken. */
  create(doc: ServerBoard, userId: string, seat: number): Promise<boolean>;
}

/** What a client sends: a request without the player — that is the
 *  signed-in user's, never the body's. */
export type WorldBody = Omit<WorldRequest, 'playerId'>;

export type Served =
  | { status: 200; reply: unknown }
  | { status: 400 | 409; error: string };

const KINDS: ReadonlySet<WorldCommandKind> = new Set<WorldCommandKind>([
  'join', 'snapshot', 'claim', 'upgrade', 'tribute', 'repair', 'finish', 'collect', 'reportSeen', 'postOffer',
  'takeOffer', 'withdrawOffer', 'sendArmy', 'recall', 'delveRoom', 'descendPortal', 'setBoost',
]);

/** How many times a request starts again on a board written under it. */
const ATTEMPTS = 5;

/** The shape of a request, checked before anything reads it. */
export function badBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return 'not an object';
  const b = body as Record<string, unknown>;
  if (typeof b.opId !== 'string' || b.opId.length === 0 || b.opId.length > 64) return 'opId';
  if (!Number.isInteger(b.ack) || (b.ack as number) < 0) return 'ack';
  if (b.asSeat !== undefined && (!Number.isInteger(b.asSeat) || (b.asSeat as number) < 0 || (b.asSeat as number) > 5)) return 'asSeat';
  const cmd = b.cmd as Record<string, unknown> | null;
  if (cmd === null || typeof cmd !== 'object' || !KINDS.has(cmd.kind as WorldCommandKind)) return 'cmd';
  return null;
}

/** Answer one player's request at the server's `now`. */
export async function serveWorld(store: BoardStore, userId: string, body: unknown, now: number): Promise<Served> {
  const bad = badBody(body);
  if (bad !== null) return { status: 400, error: `bad request: ${bad}` };
  const req: WorldRequest = { ...(body as WorldBody), playerId: userId };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const boardId = await store.boardOf(userId);
    const row = boardId === null ? null : await store.load(boardId);
    const world: ServerWorld = { version: 3, boards: row === null ? [] : [row.doc] };
    // Dev "play as" is for the rivals the server plays, never another player.
    if (req.asSeat !== undefined && row !== null && row.doc.seats[req.asSeat]?.bot !== true) {
      return { status: 200, reply: refusal(req.cmd.kind, 'NotARival') };
    }
    let reply: unknown;
    try {
      reply = handleWorld(world, req, now);
    } catch (err) {
      return { status: 400, error: `refused: ${err instanceof Error ? err.message : String(err)}` };
    }
    const board = world.boards[0];
    if (board === undefined) return { status: 200, reply };
    if (row !== null) {
      if (await store.update(board.id, board, row.version)) return { status: 200, reply };
      continue;
    }
    // A first join: the board was made for this player.
    const seat = board.seats.findIndex((s) => s?.playerId === userId);
    if (await store.create(board, userId, seat)) return { status: 200, reply };
    // The board id the client asked to keep is someone else's: a new one.
    const cmd = req.cmd;
    if (cmd.kind === 'join' && cmd.prefer !== undefined) {
      req.cmd = { ...cmd, prefer: { ...cmd.prefer, id: `b-${userId}` } };
    }
  }
  return { status: 409, error: 'the board kept changing' };
}

function refusal(kind: WorldCommandKind, why: 'NotARival'): unknown {
  return kind === 'snapshot' || kind === 'setBoost' ? null : { ok: false, why };
}

/** Boards in memory, for the tests — and the shape the tables keep. */
export function memoryBoards(): BoardStore & { boards: Map<string, { doc: string; version: number }>; seats: Map<string, string> } {
  const boards = new Map<string, { doc: string; version: number }>();
  const seats = new Map<string, string>();
  return {
    boards,
    seats,
    async boardOf(userId) { return seats.get(userId) ?? null; },
    async load(id) {
      const r = boards.get(id);
      return r === undefined ? null : { doc: JSON.parse(r.doc) as ServerBoard, version: r.version };
    },
    async update(id, doc, version) {
      const r = boards.get(id);
      if (r === undefined || r.version !== version) return false;
      boards.set(id, { doc: JSON.stringify(doc), version: version + 1 });
      return true;
    },
    async create(doc, userId) {
      if (boards.has(doc.id) || seats.has(userId)) return false;
      boards.set(doc.id, { doc: JSON.stringify(doc), version: 0 });
      seats.set(userId, doc.id);
      return true;
    },
  };
}

// The bundle's whole surface: the edge function needs the server and its door.
export { handleWorld };
