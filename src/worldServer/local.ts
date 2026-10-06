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
import type { ArtifactId } from '../sim/state';
import { emptyWorld, freshPortal, newBoardSeed } from './core';
import {
  handleWorld, seatOf, type JoinResult, type SendArmyRequest, type WorldCommand, type WorldCommandKind, type WorldReply,
} from './handle';
import { normalNickname } from './nickname';
import type {
  CollectResult, CommandResult, DelveResult, SeatBoost, SendResult, ServerWorld,
  WorldSnapshot,
} from './types';

/** What the client asks of the world server. The server keeps the time:
 *  nothing here says when. `asSeat` is the dev tool's "play as a rival": the
 *  command is made for that seat instead. */
export interface WorldServerApi {
  /** Who the player is, and whether they sit on a board yet. A player is on
   *  no board until they first go out onto one (19 §1.3). */
  connect(playerId: string): Promise<WorldConnect>;
  /** Take a seat, by the nickname chosen for it. */
  join(nickname: string): Promise<JoinResult>;
  snapshot(asSeat?: number): Promise<WorldSnapshot | null>;
  claim(index: number, asSeat?: number): Promise<CommandResult>;
  /** Build an upgrade into a district that stands, or raise it a level. */
  upgrade(index: number, what: WorldUpgrade, asSeat?: number): Promise<CommandResult>;
  /** Pay a camp off — the tribute paid by the client (19 §5.4). */
  tribute(index: number, asSeat?: number): Promise<CommandResult>;
  /** Repair a district a camp burnt (19 §5.5); the client pays. */
  repair(index: number, asSeat?: number): Promise<CommandResult>;
  /** Tell the server which lurking camps the player has now seen. */
  reportSeen(indices: number[]): Promise<CommandResult>;
  /** Finish a builder's work on a hex now — paid for by the client. */
  finish(index: number, asSeat?: number): Promise<CommandResult>;
  /** Take `seconds` off a builder's work on a hex — a speed-up, paid for by
   *  the client from its Bag. */
  hurry(index: number, seconds: number): Promise<CommandResult>;
  /** Host a world relic in the Chapel on a hex, at its level — sent again
   *  when it levels up. */
  hostRelic(index: number, relic: ArtifactId, level: number): Promise<CommandResult>;
  unhostRelic(relic: ArtifactId): Promise<CommandResult>;
  collect(index: number, asSeat?: number): Promise<CollectResult>;
  sendArmy(req: SendArmyRequest, asSeat?: number): Promise<SendResult>;
  recall(armyId: string, asSeat?: number): Promise<CommandResult>;
  /** What this kingdom's research does to its districts' output and stores. */
  setBoost(boost: SeatBoost): Promise<void>;
  /** The crest the player chose, or null for their nickname's. */
  setCrest(crest: string | null): Promise<void>;
  delveRoom(armyId: string): Promise<DelveResult>;
  descendPortal(armyId: string): Promise<DelveResult>;
  /** The last effect the client has applied AND saved: the next request
   *  tells the server, which then stops sending it. */
  acknowledge(seq: number): void;
  /** How far the server's clock is ahead of this device's, in ms. The
   *  client keeps its time on the server's (Game.now). */
  clockOffset(): number;
  /** How often the board is read while it is on screen. */
  readEverySeconds(): number;
  /** Dev only: move every time on the player's board `ms` into the past,
   *  so the next read plays that much more of the world. */
  devShift?(ms: number): Promise<void>;
}

/** What connecting finds: the player's board, no seat yet, or no server. */
export type WorldConnect =
  | { kind: 'seated'; snapshot: WorldSnapshot }
  | { kind: 'unseated' }
  | { kind: 'offline' };

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
    // a v1 board's hexes are numbered for a board that no longer exists,
    // v3's hexes are districts, v4's precious materials are deposits dealt
    // 3/2/1 (Docs/plans/precious-deposits.md §1.5), and v5's world is seven
    // boards (§3): each a fresh world.
    this.world = world?.version === 5 ? world : emptyWorld();
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
  private ask<K extends WorldCommandKind>(
    cmd: WorldCommand<K>, asSeat?: number, newBoard?: { id: string; seed: number },
  ): WorldReply<K> {
    const reply = handleWorld(this.world, {
      opId: newOpId(), playerId: this.playerId ?? '', ack: this.ack, asSeat, cmd, newBoard,
    }, this.clock());
    this.persist();
    // A copy, as the wire would hand over: the caller never holds the
    // server's own objects.
    return structuredClone(reply);
  }

  async connect(playerId: string): Promise<WorldConnect> {
    // Before players had ids, the stand-in seated everyone as 'local-player':
    // that seat is this device's player.
    if (seatOf(this.world, playerId) === null) {
      const legacy = seatOf(this.world, 'local-player');
      if (legacy !== null) legacy.board.seats[legacy.seat]!.playerId = playerId;
    }
    this.playerId = playerId;
    const snapshot = this.ask({ kind: 'snapshot' });
    return snapshot === null ? { kind: 'unseated' } : { kind: 'seated', snapshot };
  }

  async join(nickname: string): Promise<JoinResult> {
    // Unique as the real server holds it: across every player, whatever
    // the case. The stand-in's players are whoever this device has been.
    const name = normalNickname(nickname);
    const names = (this.world.nicknames ??= {});
    const mine = this.playerId === null ? undefined : names[this.playerId];
    const taken = Object.entries(names).some(([id, n]) => id !== this.playerId && n.toLowerCase() === name.toLowerCase());
    if (mine === undefined && taken) return { ok: false, why: 'NicknameTaken' };
    const r = this.ask({ kind: 'join', nickname: mine ?? name }, undefined, { id: `b-${this.playerId}`, seed: newBoardSeed(`b-${this.playerId}`) });
    if (r.ok && this.playerId !== null) names[this.playerId] = mine ?? name;
    this.persist();
    return r;
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

  async finish(index: number, asSeat?: number): Promise<CommandResult> {
    return this.ask({ kind: 'finish', index }, asSeat);
  }

  async hurry(index: number, seconds: number): Promise<CommandResult> {
    return this.ask({ kind: 'hurry', index, seconds });
  }

  async hostRelic(index: number, relic: ArtifactId, level: number): Promise<CommandResult> {
    return this.ask({ kind: 'hostRelic', index, relic, level });
  }

  async unhostRelic(relic: ArtifactId): Promise<CommandResult> {
    return this.ask({ kind: 'unhostRelic', relic });
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

  async setCrest(crest: string | null): Promise<void> {
    this.ask({ kind: 'setCrest', crest });
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

  /** A read costs nothing here: every second. */
  readEverySeconds(): number {
    return 1;
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
