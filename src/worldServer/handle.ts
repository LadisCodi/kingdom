// THE WORLD SERVER'S ONE DOOR. Everything a client asks of the world server
// arrives here as a request, and this is all the real server runs: the
// Supabase edge function loads the world, calls `handleWorld` with ITS clock,
// and stores the world back. The local stand-in (local.ts) calls the same
// function, so the two cannot drift apart.
//
// Three rules hold for every request (Docs/features/15-social.md §1):
// - `now` is the server's. A client never says what time it is.
// - A command carries an id the client made. A retry of the same id is
//   answered with the first answer, never run again.
// - What the server owes a player rides out with every answer to them until
//   the client acknowledges it (`ack`, the last effect it has SAVED), so an
//   answer lost on the way loses nothing.

import type { Board } from '../sim/battle';
import type { ArtifactId, HeroId } from '../sim/state';
import type { WorldUpgrade } from '../sim/world/types';
import {
  claim, collect, delveRoom, descendPortal, finish, hostRelic, hurry, hurryArmy, join, owedTo, recall, repair, reportSeen, resolveTo,
  sendArmy, setBoost, setCrest, setTownhall, snapshotOf, tribute, unhostRelic, upgrade,
} from './core';
import { nicknameProblem, normalNickname } from './nickname';
import type {
  ArmyPurpose, CollectResult, CommandResult, DelveResult, SeatBoost, SendResult, ServerBoard,
  ServerWorld, WorldSnapshot,
} from './types';

/** A join: the seat, or why there is none. */
export type JoinResult =
  | { ok: true; snapshot: WorldSnapshot }
  | { ok: false; why: 'BadNickname' | 'NicknameTaken' | 'Offline' };

/** What an army is sent out with. */
export interface SendArmyRequest {
  purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: Board; path?: number[]; speed?: number;
}

/** Everything a client can ask, and what each is answered with. */
export interface WorldCommands {
  /** Take a seat on the board, by the nickname the player chose; already
   *  seated, the seat they have. The nickname's uniqueness is the caller's
   *  to settle first — it is a fact about every board, not this one. */
  join: { cmd: { nickname: string }; reply: JoinResult };
  snapshot: { cmd: Record<never, never>; reply: WorldSnapshot | null };
  claim: { cmd: { index: number }; reply: CommandResult };
  upgrade: { cmd: { index: number; what: WorldUpgrade }; reply: CommandResult };
  tribute: { cmd: { index: number }; reply: CommandResult };
  repair: { cmd: { index: number }; reply: CommandResult };
  finish: { cmd: { index: number }; reply: CommandResult };
  /** A speed-up from the Bag: `seconds` off a builder's work on a hex. */
  hurry: { cmd: { index: number; seconds: number }; reply: CommandResult };
  /** A speed-up or Gems: `seconds` off an army's march, out or home. */
  hurryArmy: { cmd: { armyId: string; seconds: number }; reply: CommandResult };
  collect: { cmd: { index: number }; reply: CollectResult };
  reportSeen: { cmd: { indices: number[] }; reply: CommandResult };
  sendArmy: { cmd: { req: SendArmyRequest }; reply: SendResult };
  recall: { cmd: { armyId: string }; reply: CommandResult };
  delveRoom: { cmd: { armyId: string }; reply: DelveResult };
  descendPortal: { cmd: { armyId: string }; reply: DelveResult };
  setBoost: { cmd: { boost: SeatBoost }; reply: null };
  /** The crest the player chose, or null for their nickname's. */
  setCrest: { cmd: { crest: string | null }; reply: null };
  /** The player's Townhall level, for the ranking (19 §12). */
  setTownhall: { cmd: { level: number }; reply: null };
  /** Host a world relic, at its level, in the Chapel on a hex — or send its
   *  new level after a level-up (relic-restoration.md §5.2). */
  hostRelic: { cmd: { index: number; relic: ArtifactId; level: number }; reply: CommandResult };
  unhostRelic: { cmd: { relic: ArtifactId }; reply: CommandResult };
}

export type WorldCommandKind = keyof WorldCommands;
export type WorldCommand<K extends WorldCommandKind = WorldCommandKind> =
  K extends WorldCommandKind ? { kind: K } & WorldCommands[K]['cmd'] : never;
export type WorldReply<K extends WorldCommandKind> = WorldCommands[K]['reply'];

export interface WorldRequest<K extends WorldCommandKind = WorldCommandKind> {
  /** Made by the client, once per command, and sent again on a retry. */
  opId: string;
  /** Who asks. On the real server this is the signed-in user, never a
   *  field the client fills. */
  playerId: string;
  /** The last effect the client has applied and saved. */
  ack: number;
  /** Dev only: make the command for another seat on the player's board. */
  asSeat?: number;
  /** Server only, never from a client: what a board this join has to open
   *  is called. */
  newBoard?: { id: string; seed: number };
  /** Server only: the player's friends' ids, whose seats the answer marks. */
  friends?: readonly string[];
  cmd: WorldCommand<K>;
}

/** How many answered commands each seat keeps for retries. */
export const OPS_KEPT = 32;

/** The commands that only read: nothing to answer twice. */
const READS: ReadonlySet<WorldCommandKind> = new Set(['join', 'snapshot']);

/** Where a player sits: the board and seat that are theirs. */
export function seatOf(w: ServerWorld, playerId: string): { board: ServerBoard; seat: number } | null {
  for (const board of w.boards) {
    const seat = board.seats.findIndex((s) => s?.playerId === playerId);
    if (seat >= 0) return { board, seat };
  }
  return null;
}

/**
 * Answer one request at the server's `now`, changing `w` in place. The
 * caller stores `w` afterwards whatever the answer — a refused command has
 * still resolved the board to `now`.
 */
export function handleWorld<K extends WorldCommandKind>(w: ServerWorld, req: WorldRequest<K>, now: number): WorldReply<K> {
  const cmd = req.cmd as WorldCommand;
  if (cmd.kind === 'join') {
    if (seatOf(w, req.playerId) === null && nicknameProblem(cmd.nickname) !== null) {
      return { ok: false, why: 'BadNickname' } as WorldReply<K>;
    }
    const { board, seat } = join(w, { id: req.playerId, name: normalNickname(cmd.nickname), fresh: req.newBoard }, now);
    resolveTo(board, now);
    const snapshot = deliver(board, seat, req.ack, true, snapshotOf(board, seat, now), req.friends) as WorldSnapshot;
    return { ok: true, snapshot } as WorldReply<K>;
  }
  const mine = seatOf(w, req.playerId);
  if (mine === null) return refusedFor(cmd.kind) as WorldReply<K>;
  const { board } = mine;
  const own = req.asSeat === undefined;
  const seat = req.asSeat ?? mine.seat;
  if (cmd.kind === 'snapshot') {
    resolveTo(board, now);
    return deliver(board, mine.seat, req.ack, own, snapshotOf(board, seat, now), req.friends) as WorldReply<K>;
  }
  // Acknowledged effects are forgotten before anything new is owed.
  if (own) owedTo(board, seat, req.ack);
  const ops = ((board.ops ??= {})[seat] ??= []);
  const seen = ops.find((o) => o.id === req.opId);
  if (seen !== undefined) {
    resolveTo(board, now);
    return answerAgain(board, seat, req.ack, own, seen.reply, now, req.friends) as WorldReply<K>;
  }
  const reply = run(board, seat, cmd, now);
  if (!READS.has(cmd.kind)) {
    ops.push({ id: req.opId, reply: withoutSnapshot(reply) });
    if (ops.length > OPS_KEPT) ops.splice(0, ops.length - OPS_KEPT);
  }
  return deliver(board, seat, req.ack, own, reply, req.friends) as WorldReply<K>;
}

function run(b: ServerBoard, seat: number, cmd: WorldCommand, t: number): unknown {
  switch (cmd.kind) {
    case 'claim': return claim(b, seat, cmd.index, t);
    case 'upgrade': return upgrade(b, seat, cmd.index, cmd.what, t);
    case 'tribute': return tribute(b, seat, cmd.index, t);
    case 'repair': return repair(b, seat, cmd.index, t);
    case 'finish': return finish(b, seat, cmd.index, t);
    case 'hurry': return hurry(b, seat, cmd.index, cmd.seconds, t);
    case 'hurryArmy': return hurryArmy(b, seat, cmd.armyId, cmd.seconds, t);
    case 'collect': return collect(b, seat, cmd.index, t);
    case 'reportSeen': return reportSeen(b, seat, cmd.indices, t);
    case 'sendArmy': return sendArmy(b, seat, cmd.req, t);
    case 'recall': return recall(b, seat, cmd.armyId, t);
    case 'delveRoom': return delveRoom(b, seat, cmd.armyId, t);
    case 'descendPortal': return descendPortal(b, seat, cmd.armyId, t);
    case 'setBoost': setBoost(b, seat, cmd.boost, t); return null;
    case 'setCrest': setCrest(b, seat, cmd.crest); return null;
    case 'setTownhall': setTownhall(b, seat, cmd.level); return null;
    case 'hostRelic': return hostRelic(b, seat, cmd.index, cmd.relic, cmd.level, t);
    case 'unhostRelic': return unhostRelic(b, seat, cmd.relic, t);
    case 'join': case 'snapshot': throw new Error(`${cmd.kind} is not a command`);
  }
}

/** A player not seated anywhere. */
function refusedFor(kind: WorldCommandKind): unknown {
  if (kind === 'snapshot' || kind === 'setBoost' || kind === 'setCrest' || kind === 'setTownhall') return null;
  return { ok: false, why: 'NoBoard' };
}

/** What the server owes the player rides out with every answer to them —
 *  never with one made for another seat — and which seats are their
 *  friends'. */
function deliver(b: ServerBoard, seat: number, ack: number, own: boolean, reply: unknown, friends: readonly string[] = []): unknown {
  const snap = snapshotIn(reply);
  if (own && snap !== null) {
    snap.effects = owedTo(b, seat, ack);
    for (const s of snap.seats) {
      const id = b.seats[s.seat]?.playerId;
      if (id !== undefined && friends.includes(id)) s.friend = true;
    }
  }
  return reply;
}

/** A command already run: its first answer, with the board as it is now. */
function answerAgain(b: ServerBoard, seat: number, ack: number, own: boolean, stored: unknown, t: number, friends?: readonly string[]): unknown {
  if (stored === null || typeof stored !== 'object') return stored;
  const r = structuredClone(stored) as Record<string, unknown>;
  if (r.ok === true) r.snapshot = snapshotOf(b, seat, t);
  return deliver(b, seat, ack, own, r, friends);
}

function snapshotIn(reply: unknown): WorldSnapshot | null {
  if (reply === null || typeof reply !== 'object') return null;
  if ('snapshot' in reply) return (reply as { snapshot: WorldSnapshot }).snapshot ?? null;
  if ('effects' in reply && 'board' in reply) return reply as WorldSnapshot;
  return null;
}

/** An answer as it is kept for a retry: the board in it goes stale at once. */
function withoutSnapshot(reply: unknown): unknown {
  if (reply === null || typeof reply !== 'object' || !('snapshot' in reply)) return reply;
  const { snapshot: _stale, ...rest } = reply as Record<string, unknown>;
  return structuredClone(rest);
}
