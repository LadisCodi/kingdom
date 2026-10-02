// THE LOCAL WORLD SERVER — a stand-in for the real one, in the browser.
//
// It plays the server's whole part: it seats the player on a board with five
// stand-in rivals, holds world control, resolves everything due when the
// board is read, and answers commands. It keeps its state under its own key,
// apart from the player's save, as the real server's database will be.
//
// Every method is async, as a call to the real server will be, so nothing
// that uses it changes the day it is swapped for one.

import type { Board } from '../sim/battle';
import type { HeroId } from '../sim/state';
import type { WorldImprovement } from '../sim/world/types';
import {
  build, claim, collect, drainEffects, emptyWorld, join, recall, resolveTo, sendArmy, snapshotOf,
} from './core';
import type {
  ArmyPurpose, BoardRef, CollectResult, CommandResult, SendResult, ServerBoard, ServerWorld, WorldSnapshot,
} from './types';

/** What the client asks of the world server. `asSeat` is the dev tool's
 *  "play as a rival": the command is made for that seat instead. */
export interface WorldServerApi {
  join(player: { id: string; name: string; prefer?: BoardRef }, now: number): Promise<WorldSnapshot>;
  snapshot(now: number, asSeat?: number): Promise<WorldSnapshot | null>;
  claim(index: number, now: number, asSeat?: number): Promise<CommandResult>;
  build(index: number, kind: WorldImprovement, now: number, asSeat?: number): Promise<CommandResult>;
  collect(index: number, now: number, asSeat?: number): Promise<CollectResult>;
  sendArmy(
    req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: Board; msPerHex: number },
    now: number, asSeat?: number,
  ): Promise<SendResult>;
  recall(armyId: string, now: number, asSeat?: number): Promise<CommandResult>;
}

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

  constructor(private store: WorldStore) {
    let world: ServerWorld | null = null;
    try {
      const text = store.load();
      if (text !== null) world = JSON.parse(text) as ServerWorld;
    } catch { world = null; }
    this.world = world?.version === 1 ? world : emptyWorld();
    // A board kept from before armies existed.
    for (const b of this.world.boards) {
      b.armies ??= [];
      b.effects ??= {};
      b.nextId ??= 1;
      for (const h of Object.values(b.hexes)) h.garrison ??= null;
    }
  }

  /** What the server owes the player rides out with every answer to them —
   *  never with one made for another seat. */
  private deliver<T extends { snapshot?: WorldSnapshot } | WorldSnapshot>(at: { board: ServerBoard; seat: number }, own: boolean, r: T): T {
    if (!own) return r;
    const snap = ('snapshot' in r ? r.snapshot : r) as WorldSnapshot | undefined;
    if (snap !== undefined && 'effects' in snap) snap.effects = drainEffects(at.board, at.seat);
    return r;
  }

  private persist(): void {
    this.store.save(JSON.stringify(this.world));
  }

  private mine(asSeat?: number): { board: ServerBoard; seat: number } | null {
    if (this.playerId === null) return null;
    for (const board of this.world.boards) {
      const seat = board.seats.findIndex((s) => s?.playerId === this.playerId);
      if (seat >= 0) return { board, seat: asSeat ?? seat };
    }
    return null;
  }

  async join(player: { id: string; name: string; prefer?: BoardRef }, now: number): Promise<WorldSnapshot> {
    this.playerId = player.id;
    const { board, seat } = join(this.world, player, now);
    resolveTo(board, now);
    const snap = this.deliver({ board, seat }, true, snapshotOf(board, seat, now));
    this.persist();
    return snap;
  }

  async snapshot(now: number, asSeat?: number): Promise<WorldSnapshot | null> {
    const at = this.mine(asSeat);
    if (at === null) return null;
    resolveTo(at.board, now);
    const snap = this.deliver(at, asSeat === undefined, snapshotOf(at.board, at.seat, now));
    this.persist();
    return snap;
  }

  /** Run a command for the player (or the seat it plays as), keep the
   *  result, and hand over what is owed with it. */
  private run<T extends { ok: boolean }>(asSeat: number | undefined, fn: (b: ServerBoard, seat: number) => T, refused: T): T {
    const at = this.mine(asSeat);
    if (at === null) return refused;
    const r = this.deliver(at, asSeat === undefined, fn(at.board, at.seat) as T & { snapshot?: WorldSnapshot });
    this.persist();
    return r;
  }

  async claim(index: number, now: number, asSeat?: number): Promise<CommandResult> {
    return this.run(asSeat, (b, seat) => claim(b, seat, index, now), { ok: false, why: 'NoBoard' });
  }

  async build(index: number, kind: WorldImprovement, now: number, asSeat?: number): Promise<CommandResult> {
    return this.run(asSeat, (b, seat) => build(b, seat, index, kind, now), { ok: false, why: 'NoBoard' });
  }

  async collect(index: number, now: number, asSeat?: number): Promise<CollectResult> {
    return this.run(asSeat, (b, seat) => collect(b, seat, index, now), { ok: false, why: 'NoBoard' });
  }

  async sendArmy(
    req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: Board; msPerHex: number },
    now: number, asSeat?: number,
  ): Promise<SendResult> {
    return this.run(asSeat, (b, seat) => sendArmy(b, seat, req, now), { ok: false, why: 'NoBoard' });
  }

  async recall(armyId: string, now: number, asSeat?: number): Promise<CommandResult> {
    return this.run(asSeat, (b, seat) => recall(b, seat, armyId, now), { ok: false, why: 'NoBoard' });
  }
}
