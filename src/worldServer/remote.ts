// THE REAL WORLD SERVER, from the client's side: every request sent to the
// `world` edge function (supabase/functions/world), which answers it with
// the same `handleWorld` the local stand-in runs (Docs/plans/online-server.md).
//
// A command keeps its id across retries, so a retry after an answer lost on
// the way is answered, not run again. A command that cannot get through at
// all is refused as Offline — never thrown — so the game treats it as any
// other refusal.

import type { WorldUpgrade } from '../sim/world/types';
import type { ArtifactId } from '../sim/state';
import { ClockSync } from './clockSync';
import type { JoinResult, SendArmyRequest, WorldCommand, WorldCommandKind, WorldReply } from './handle';
import { newOpId, type WorldConnect, type WorldServerApi } from './local';
import type { WorldBody } from './serve';
import type {
  CollectResult, CommandResult, DelveResult, Lot, SeatBoost, SendResult, TradeResult, WorldSnapshot,
} from './types';

/** One trip to the server: its answer, or whether trying again could help. */
export type WorldCall = (body: WorldBody) => Promise<{ ok: true; data: unknown } | { ok: false; retry: boolean; error: string }>;

/** How many times a request is sent before it is given up, and how long the
 *  first wait between two is; each wait doubles. */
const TRIES = 4;
const FIRST_WAIT_MS = 400;

export class RemoteWorldServer implements WorldServerApi {
  private ack = 0;
  private sync = new ClockSync();

  constructor(
    private call: WorldCall,
    private wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Send a command until it is answered or plainly cannot be. Null when it
   *  could not get through — never when the answer itself is null. */
  private async send<K extends WorldCommandKind>(cmd: WorldCommand<K>, asSeat?: number): Promise<{ reply: WorldReply<K> } | null> {
    const opId = newOpId();
    let last = '';
    for (let n = 0; n < TRIES; n++) {
      if (n > 0) await this.wait(FIRST_WAIT_MS * 2 ** (n - 1));
      const body: WorldBody = { opId, ack: this.ack, cmd, ...(asSeat === undefined ? {} : { asSeat }) };
      const sentAt = Date.now();
      const r = await this.call(body);
      if (r.ok) {
        const at = serverTimeIn(r.data);
        if (at !== null) this.sync.observe(sentAt, at, Date.now());
        return { reply: r.data as WorldReply<K> };
      }
      last = r.error;
      if (!r.retry) break;
    }
    console.warn(`kingdom: the world server did not answer ${cmd.kind}: ${last}`);
    return null;
  }

  private async command<K extends WorldCommandKind>(cmd: WorldCommand<K>, asSeat?: number): Promise<WorldReply<K>> {
    return (await this.send(cmd, asSeat))?.reply ?? ({ ok: false, why: 'Offline' } as WorldReply<K>);
  }

  /** The player is the signed-in user: the server reads them off the
   *  session, so the id is not sent. */
  async connect(_playerId: string): Promise<WorldConnect> {
    const r = await this.send({ kind: 'snapshot' });
    if (r === null) return { kind: 'offline' };
    return r.reply === null ? { kind: 'unseated' } : { kind: 'seated', snapshot: r.reply };
  }

  join(nickname: string): Promise<JoinResult> { return this.command({ kind: 'join', nickname }); }

  async snapshot(asSeat?: number): Promise<WorldSnapshot | null> {
    return (await this.send({ kind: 'snapshot' }, asSeat))?.reply ?? null;
  }

  claim(index: number, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'claim', index }, asSeat); }
  upgrade(index: number, what: WorldUpgrade, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'upgrade', index, what }, asSeat); }
  tribute(index: number, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'tribute', index }, asSeat); }
  repair(index: number, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'repair', index }, asSeat); }
  reportSeen(indices: number[]): Promise<CommandResult> { return this.command({ kind: 'reportSeen', indices }); }
  postOffer(give: Lot, want: Lot, asSeat?: number): Promise<TradeResult> { return this.command({ kind: 'postOffer', give, want }, asSeat); }
  takeOffer(offerId: string, asSeat?: number): Promise<TradeResult> { return this.command({ kind: 'takeOffer', offerId }, asSeat); }
  withdrawOffer(offerId: string, asSeat?: number): Promise<TradeResult> { return this.command({ kind: 'withdrawOffer', offerId }, asSeat); }
  finish(index: number, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'finish', index }, asSeat); }
  hurry(index: number, seconds: number): Promise<CommandResult> { return this.command({ kind: 'hurry', index, seconds }); }
  hostRelic(index: number, relic: ArtifactId, level: number): Promise<CommandResult> { return this.command({ kind: 'hostRelic', index, relic, level }); }
  unhostRelic(relic: ArtifactId): Promise<CommandResult> { return this.command({ kind: 'unhostRelic', relic }); }
  collect(index: number, asSeat?: number): Promise<CollectResult> { return this.command({ kind: 'collect', index }, asSeat); }
  sendArmy(req: SendArmyRequest, asSeat?: number): Promise<SendResult> { return this.command({ kind: 'sendArmy', req }, asSeat); }
  recall(armyId: string, asSeat?: number): Promise<CommandResult> { return this.command({ kind: 'recall', armyId }, asSeat); }
  delveRoom(armyId: string): Promise<DelveResult> { return this.command({ kind: 'delveRoom', armyId }); }
  descendPortal(armyId: string): Promise<DelveResult> { return this.command({ kind: 'descendPortal', armyId }); }

  async setBoost(boost: SeatBoost): Promise<void> {
    await this.send({ kind: 'setBoost', boost });
  }

  async setCrest(crest: string | null): Promise<void> {
    await this.send({ kind: 'setCrest', crest });
  }

  acknowledge(seq: number): void {
    this.ack = Math.max(this.ack, seq);
  }

  clockOffset(): number {
    return this.sync.offset();
  }

  /** A trip costs a request: the board is read every few seconds on screen. */
  readEverySeconds(): number {
    return 5;
  }
}

/** The server's time in an answer: its snapshot's. */
function serverTimeIn(data: unknown): number | null {
  if (data === null || typeof data !== 'object') return null;
  const d = data as { at?: unknown; board?: unknown; snapshot?: { at?: unknown } };
  if (d.board !== undefined && typeof d.at === 'number') return d.at;
  return typeof d.snapshot?.at === 'number' ? d.snapshot.at : null;
}
