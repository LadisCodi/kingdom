// THE LOCAL WORLD SERVER — a stand-in for the real one, in the browser.
//
// It plays the server's whole part: it seats the player on a board with five
// stand-in rivals, holds world control, resolves everything due when the
// board is read, and answers commands. It keeps its state under its own key,
// apart from the player's save, as the real server's database will be.
//
// Every method is async, as a call to the real server will be, so nothing
// that uses it changes the day it is swapped for one.

import type { WorldImprovement } from '../sim/world/types';
import { build, claim, collect, emptyWorld, join, resolveTo, snapshotOf } from './core';
import type { BoardRef, CollectResult, CommandResult, ServerBoard, ServerWorld, WorldSnapshot } from './types';

/** What the client asks of the world server. `asSeat` is the dev tool's
 *  "play as a rival": the command is made for that seat instead. */
export interface WorldServerApi {
  join(player: { id: string; name: string; prefer?: BoardRef }, now: number): Promise<WorldSnapshot>;
  snapshot(now: number, asSeat?: number): Promise<WorldSnapshot | null>;
  claim(index: number, now: number, asSeat?: number): Promise<CommandResult>;
  build(index: number, kind: WorldImprovement, now: number, asSeat?: number): Promise<CommandResult>;
  collect(index: number, now: number, asSeat?: number): Promise<CollectResult>;
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
    this.persist();
    return snapshotOf(board, seat, now);
  }

  async snapshot(now: number, asSeat?: number): Promise<WorldSnapshot | null> {
    const at = this.mine(asSeat);
    if (at === null) return null;
    resolveTo(at.board, now);
    this.persist();
    return snapshotOf(at.board, at.seat, now);
  }

  async claim(index: number, now: number, asSeat?: number): Promise<CommandResult> {
    const at = this.mine(asSeat);
    if (at === null) return { ok: false, why: 'NoBoard' };
    const r = claim(at.board, at.seat, index, now);
    this.persist();
    return r;
  }

  async build(index: number, kind: WorldImprovement, now: number, asSeat?: number): Promise<CommandResult> {
    const at = this.mine(asSeat);
    if (at === null) return { ok: false, why: 'NoBoard' };
    const r = build(at.board, at.seat, index, kind, now);
    this.persist();
    return r;
  }

  async collect(index: number, now: number, asSeat?: number): Promise<CollectResult> {
    const at = this.mine(asSeat);
    if (at === null) return { ok: false, why: 'NoBoard' };
    const r = collect(at.board, at.seat, index, now);
    this.persist();
    return r;
  }
}
