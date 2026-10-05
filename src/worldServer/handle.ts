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
import type { HeroId } from '../sim/state';
import type { WorldUpgrade } from '../sim/world/types';
import {
  claim, collect, delveRoom, descendPortal, finish, join, owedTo, postOffer, recall, repair, reportSeen, resolveTo,
  sendArmy, setBoost, snapshotOf, takeOffer, tribute, upgrade, withdrawOffer,
} from './core';
import type {
  ArmyPurpose, BoardRef, CollectResult, CommandResult, DelveResult, Lot, SeatBoost, SendResult, ServerBoard,
  ServerWorld, TradeResult, WorldSnapshot,
} from './types';

/** What an army is sent out with. */
export interface SendArmyRequest {
  purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: Board; path?: number[]; speed?: number;
}

/** Everything a client can ask, and what each is answered with. */
export interface WorldCommands {
  join: { cmd: { name: string; prefer?: BoardRef }; reply: WorldSnapshot };
  snapshot: { cmd: Record<never, never>; reply: WorldSnapshot | null };
  claim: { cmd: { index: number }; reply: CommandResult };
  upgrade: { cmd: { index: number; what: WorldUpgrade }; reply: CommandResult };
  tribute: { cmd: { index: number }; reply: CommandResult };
  repair: { cmd: { index: number }; reply: CommandResult };
  finish: { cmd: { index: number }; reply: CommandResult };
  collect: { cmd: { index: number }; reply: CollectResult };
  reportSeen: { cmd: { indices: number[] }; reply: CommandResult };
  postOffer: { cmd: { give: Lot; want: Lot }; reply: TradeResult };
  takeOffer: { cmd: { offerId: string }; reply: TradeResult };
  withdrawOffer: { cmd: { offerId: string }; reply: TradeResult };
  sendArmy: { cmd: { req: SendArmyRequest }; reply: SendResult };
  recall: { cmd: { armyId: string }; reply: CommandResult };
  delveRoom: { cmd: { armyId: string }; reply: DelveResult };
  descendPortal: { cmd: { armyId: string }; reply: DelveResult };
  setBoost: { cmd: { boost: SeatBoost }; reply: null };
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
    const { board, seat } = join(w, { id: req.playerId, name: cmd.name, prefer: cmd.prefer }, now);
    resolveTo(board, now);
    return deliver(board, seat, req.ack, true, snapshotOf(board, seat, now)) as WorldReply<K>;
  }
  const mine = seatOf(w, req.playerId);
  if (mine === null) return refusedFor(cmd.kind) as WorldReply<K>;
  const { board } = mine;
  const own = req.asSeat === undefined;
  const seat = req.asSeat ?? mine.seat;
  if (cmd.kind === 'snapshot') {
    resolveTo(board, now);
    return deliver(board, mine.seat, req.ack, own, snapshotOf(board, seat, now)) as WorldReply<K>;
  }
  // Acknowledged effects are forgotten before anything new is owed.
  if (own) owedTo(board, seat, req.ack);
  const ops = ((board.ops ??= {})[seat] ??= []);
  const seen = ops.find((o) => o.id === req.opId);
  if (seen !== undefined) {
    resolveTo(board, now);
    return answerAgain(board, seat, req.ack, own, seen.reply, now) as WorldReply<K>;
  }
  const reply = run(board, seat, cmd, now);
  if (!READS.has(cmd.kind)) {
    ops.push({ id: req.opId, reply: withoutSnapshot(reply) });
    if (ops.length > OPS_KEPT) ops.splice(0, ops.length - OPS_KEPT);
  }
  return deliver(board, seat, req.ack, own, reply) as WorldReply<K>;
}

function run(b: ServerBoard, seat: number, cmd: WorldCommand, t: number): unknown {
  switch (cmd.kind) {
    case 'claim': return claim(b, seat, cmd.index, t);
    case 'upgrade': return upgrade(b, seat, cmd.index, cmd.what, t);
    case 'tribute': return tribute(b, seat, cmd.index, t);
    case 'repair': return repair(b, seat, cmd.index, t);
    case 'finish': return finish(b, seat, cmd.index, t);
    case 'collect': return collect(b, seat, cmd.index, t);
    case 'reportSeen': return reportSeen(b, seat, cmd.indices, t);
    case 'postOffer': return postOffer(b, seat, cmd.give, cmd.want, t);
    case 'takeOffer': return takeOffer(b, seat, cmd.offerId, t);
    case 'withdrawOffer': return withdrawOffer(b, seat, cmd.offerId, t);
    case 'sendArmy': return sendArmy(b, seat, cmd.req, t);
    case 'recall': return recall(b, seat, cmd.armyId, t);
    case 'delveRoom': return delveRoom(b, seat, cmd.armyId, t);
    case 'descendPortal': return descendPortal(b, seat, cmd.armyId, t);
    case 'setBoost': setBoost(b, seat, cmd.boost, t); return null;
    case 'join': case 'snapshot': throw new Error(`${cmd.kind} is not a command`);
  }
}

/** A player not seated anywhere. */
function refusedFor(kind: WorldCommandKind): unknown {
  if (kind === 'snapshot' || kind === 'setBoost') return null;
  return { ok: false, why: 'NoBoard' };
}

/** What the server owes the player rides out with every answer to them —
 *  never with one made for another seat. */
function deliver(b: ServerBoard, seat: number, ack: number, own: boolean, reply: unknown): unknown {
  const snap = snapshotIn(reply);
  if (own && snap !== null) snap.effects = owedTo(b, seat, ack);
  return reply;
}

/** A command already run: its first answer, with the board as it is now. */
function answerAgain(b: ServerBoard, seat: number, ack: number, own: boolean, stored: unknown, t: number): unknown {
  if (stored === null || typeof stored !== 'object') return stored;
  const r = structuredClone(stored) as Record<string, unknown>;
  if (r.ok === true) r.snapshot = snapshotOf(b, seat, t);
  return deliver(b, seat, ack, own, r);
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
