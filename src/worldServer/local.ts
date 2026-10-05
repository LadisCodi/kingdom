// THE LOCAL WORLD SERVER — a stand-in for the real one, in the browser.
//
// It plays the server's whole part: it seats the player on a board with five
// stand-in rivals, holds world control, resolves everything due when the
// board is read, and answers commands. It keeps its state under its own key,
// apart from the player's save, as the real server's database will be.
//
// Every method is async, as a call to the real server will be, so nothing
// that uses it changes the day it is swapped for one. Every request goes
// through `handleWorld` (handle.ts) — the one function the real server runs.

import type { WorldUpgrade } from '../sim/world/types';
import { emptyWorld, freshPortal } from './core';
import { handleWorld, seatOf, type SendArmyRequest, type WorldCommand, type WorldCommandKind, type WorldReply } from './handle';
import type {
  BoardRef, CollectResult, CommandResult, DelveResult, Lot, SeatBoost, SendResult, ServerWorld, TradeResult,
  WorldSnapshot,
} from './types';

/** What the client asks of the world server. The server keeps the time:
 *  nothing here says when. `asSeat` is the dev tool's "play as a rival": the
 *  command is made for that seat instead. */
export interface WorldServerApi {
  join(player: { id: string; name: string; prefer?: BoardRef }): Promise<WorldSnapshot>;
  snapshot(asSeat?: number): Promise<WorldSnapshot | null>;
  claim(index: number, asSeat?: number): Promise<CommandResult>;
  /** Build an upgrade into a district that stands, or raise it a level. */
  upgrade(index: number, what: WorldUpgrade, asSeat?: number): Promise<CommandResult>;
  /** Pay a camp off — the tribute paid by the client (19 §5.4). */
  tribute(index: number, asSeat?: number): Promise<CommandResult>;
  /** The Exchange (19 §7.5): the client pays what it gives, and is handed
   *  what it receives. */
  postOffer(give: Lot, want: Lot, asSeat?: number): Promise<TradeResult>;
  /** Repair a district a camp burnt (19 §5.5); the client pays. */
  repair(index: number, asSeat?: number): Promise<CommandResult>;
  /** Tell the server which lurking camps the player has now seen. */
  reportSeen(indices: number[]): Promise<CommandResult>;
  takeOffer(offerId: string, asSeat?: number): Promise<TradeResult>;
  withdrawOffer(offerId: string, asSeat?: number): Promise<TradeResult>;
  /** Finish a builder's work on a hex now — paid for by the client. */
  finish(index: number, asSeat?: number): Promise<CommandResult>;
  collect(index: number, asSeat?: number): Promise<CollectResult>;
  sendArmy(req: SendArmyRequest, asSeat?: number): Promise<SendResult>;
  recall(armyId: string, asSeat?: number): Promise<CommandResult>;
  /** What this kingdom's research does to its districts' output and stores. */
  setBoost(boost: SeatBoost): Promise<void>;
  delveRoom(armyId: string): Promise<DelveResult>;
  descendPortal(armyId: string): Promise<DelveResult>;
  /** The last effect the client has applied AND saved: the next request
   *  tells the server, which then stops sending it. */
  acknowledge(seq: number): void;
  /** How far the server's clock is ahead of this device's, in ms. The
   *  client keeps its time on the server's (Game.now). */
  clockOffset(): number;
  /** Dev only: move every time on the player's board `ms` into the past,
   *  so the next read plays that much more of the world. */
  devShift?(ms: number): Promise<void>;
}

/** A command id: unique per command, made once and reused on a retry. */
export const newOpId = (): string => globalThis.crypto.randomUUID();

/** Where the local server keeps its state: localStorage in the game, a map
 *  in the tests. */
export interface WorldStore { load(): string | null; save(text: string): void }

export const memoryStore = (): WorldStore => {
  let text: string | null = null;
  return { load: () => text, save: (t) => { text = t; } };
};

export const browserStore = (key = 'kingdom.worldServer'): WorldStore => ({
  load: () => { try { return localStorage.getItem(key); } catch { return null; } },
  save: (t) => { try { localStorage.setItem(key, t); } catch { /* private window */ } },
});

export class LocalWorldServer implements WorldServerApi {
  private world: ServerWorld;
  private playerId: string | null = null;
  private ack = 0;

  /** `clock` is the server's: the device's own in the game, the test's in
   *  a test. */
  constructor(private store: WorldStore, private clock: () => number = () => Date.now()) {
    let world: ServerWorld | null = null;
    try {
      const text = store.load();
      if (text !== null) world = JSON.parse(text) as ServerWorld;
    } catch { world = null; }
    // A store of another version is thrown away: v2's board is radius 6, so
    // a v1 board's hexes are numbered for a board that no longer exists, and
    // v3's hexes are districts.
    this.world = world?.version === 3 ? world : emptyWorld();
    // A board kept from before armies existed.
    for (const b of this.world.boards) {
      b.armies ??= [];
      b.effects ??= {};
      b.nextId ??= 1;
      b.delves ??= {};
      b.portal ??= freshPortal(b.resolvedTo);
      for (const h of Object.values(b.hexes)) h.garrison ??= null;
    }
  }

  private persist(): void {
    this.store.save(JSON.stringify(this.world));
  }

  /** Send one request through the server's door and keep the world it left. */
  private ask<K extends WorldCommandKind>(cmd: WorldCommand<K>, asSeat?: number): WorldReply<K> {
    const reply = handleWorld(this.world, {
      opId: newOpId(), playerId: this.playerId ?? '', ack: this.ack, asSeat, cmd,
    }, this.clock());
    this.persist();
    // A copy, as the wire would hand over: the caller never holds the
    // server's own objects.
    return structuredClone(reply);
  }

  async join(player: { id: string; name: string; prefer?: BoardRef }): Promise<WorldSnapshot> {
    // Before players had ids, the stand-in seated everyone as 'local-player':
    // that seat is this device's player.
    if (seatOf(this.world, player.id) === null) {
      const legacy = seatOf(this.world, 'local-player');
      if (legacy !== null) legacy.board.seats[legacy.seat]!.playerId = player.id;
    }
    this.playerId = player.id;
    return this.ask({ kind: 'join', name: player.name, prefer: player.prefer });
  }

  async snapshot(asSeat?: number): Promise<WorldSnapshot | null> {
    return this.ask({ kind: 'snapshot' }, asSeat);
  }

  async claim(index: number, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'claim', index }, asSeat);
  }

  async upgrade(index: number, what: WorldUpgrade, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'upgrade', index, what }, asSeat);
  }

  async tribute(index: number, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'tribute', index }, asSeat);
  }

  async repair(index: number, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'repair', index }, asSeat);
  }

  async reportSeen(indices: number[]): Promise<CommandResult> {
    return this.ask({ kind: 'reportSeen', indices });
  }

  async postOffer(give: Lot, want: Lot, asSeat?: number): Promise<TradeResult> {
    return this.ask({ kind: 'postOffer', give, want }, asSeat);
  }

  async takeOffer(offerId: string, asSeat?: number): Promise<TradeResult> {
    return this.ask({ kind: 'takeOffer', offerId }, asSeat);
  }

  async withdrawOffer(offerId: string, asSeat?: number): Promise<TradeResult> {
    return this.ask({ kind: 'withdrawOffer', offerId }, asSeat);
  }

  async finish(index: number, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'finish', index }, asSeat);
  }

  async collect(index: number, asSeat?: number): Promise<CollectResult> {
    return this.ask({ kind: 'collect', index }, asSeat);
  }

  async sendArmy(req: SendArmyRequest, asSeat?: number): Promise<SendResult> {
    return this.ask({ kind: 'sendArmy', req }, asSeat);
  }

  async setBoost(boost: SeatBoost): Promise<void> {
    this.ask({ kind: 'setBoost', boost });
  }

  async recall(armyId: string, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'recall', armyId }, asSeat);
  }

  async delveRoom(armyId: string): Promise<DelveResult> {
    return this.ask({ kind: 'delveRoom', armyId });
  }

  async descendPortal(armyId: string): Promise<DelveResult> {
    return this.ask({ kind: 'descendPortal', armyId });
  }

  acknowledge(seq: number): void {
    this.ack = Math.max(this.ack, seq);
  }

  /** The stand-in keeps the device's own time. */
  clockOffset(): number {
    return 0;
  }

  async devShift(ms: number): Promise<void> {
    const at = this.playerId === null ? null : seatOf(this.world, this.playerId);
    if (at === null) return;
    const b = at.board;
    b.resolvedTo -= ms;
    for (const h of Object.values(b.hexes)) {
      h.standsAt -= ms;
      h.storeAt -= ms;
      if (h.work !== null) h.work.at -= ms;
    }
    for (const a of b.armies) {
      a.departedAt -= ms;
      if (a.at !== null) a.at -= ms;
    }
    for (const s of b.seats) if (s?.nextMoveAt != null) s.nextMoveAt -= ms;
    this.persist();
  }
}
