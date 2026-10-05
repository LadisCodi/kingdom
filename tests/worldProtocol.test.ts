// The world server's door (src/worldServer/handle.ts): what holds for every
// request whichever server answers it — the stand-in today, the edge function
// tomorrow (Docs/features/15-social.md §1). The server keeps the time, a
// retried command runs once, and what the server owes a player is sent until
// the player has saved it.
import { describe, expect, it } from 'vitest';
import { WORLD_EXCHANGE } from '../src/sim/data/definitions';
import { PRECIOUS } from '../src/sim/state';
import { deserialize, serialize } from '../src/sim/save';
import { generateBoard, SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { emptyWorld } from '../src/worldServer/core';
import { handleWorld, OPS_KEPT, type WorldCommand, type WorldCommandKind, type WorldRequest } from '../src/worldServer/handle';
import { ClockSync } from '../src/worldServer/clockSync';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import type { ServerWorld } from '../src/worldServer/types';
import { HexCamera } from '../src/render/world/hexCamera';
import { freshGame, freshPresenter, map, T0 } from './helpers';

const HOUR = 3_600_000;
const SEED = 0x5eed;
const own = generateBoard('x', SEED).materials[0];
const other = PRECIOUS.find((p) => p !== own)!;

/** A world with the player seated on board 'x' and the rivals asleep. */
function seated(): ServerWorld {
  const w = emptyWorld();
  handleWorld(w, req('join', { kind: 'join', name: 'Me', prefer: { id: 'x', seed: SEED, seat: 0 } }), T0);
  for (const s of w.boards[0].seats) if (s?.bot) s.nextMoveAt = null;
  return w;
}

function req<K extends WorldCommandKind>(opId: string, cmd: WorldCommand<K>, ack = 0): WorldRequest<K> {
  return { opId, playerId: 'me', ack, cmd };
}

/** An offer a rival takes: the server then owes the player what it wanted. */
const fairOffer: WorldCommand<'postOffer'> = { kind: 'postOffer', give: { id: own, amount: 10 }, want: { id: other, amount: 10 } };
const TAKEN = T0 + WORLD_EXCHANGE.botTakeHours * HOUR;

describe('a retried command', () => {
  it('runs once, and is answered again with its first answer', () => {
    const w = seated();
    const next = boardNeighbors(SEAT_INDICES[0])[0];
    const first = handleWorld(w, req('claim-1', { kind: 'claim', index: next }), T0);
    expect(first.ok).toBe(true);
    // The same id, a minute later: the claim is not made twice, and not
    // refused as Taken either — the player is told what happened the first time.
    const again = handleWorld(w, req('claim-1', { kind: 'claim', index: next }), T0 + 60_000);
    expect(again.ok && again.finishesAt).toBe(first.ok && first.finishesAt);
    expect(again.ok && again.snapshot.at).toBe(T0 + 60_000);
    expect(Object.values(w.boards[0].hexes).filter((h) => h.owner === 0)).toHaveLength(1);
    // A new id is a new command.
    expect(handleWorld(w, req('claim-2', { kind: 'claim', index: next }), T0 + 60_000)).toEqual({ ok: false, why: 'Taken' });
  });

  it('is remembered for the last few commands only', () => {
    const w = seated();
    for (let i = 0; i <= OPS_KEPT; i++) handleWorld(w, req(`seen-${i}`, { kind: 'reportSeen', indices: [] }), T0);
    const kept = w.boards[0].ops?.[0] ?? [];
    expect(kept).toHaveLength(OPS_KEPT);
    expect(kept.some((o) => o.id === 'seen-0')).toBe(false);
  });
});

describe('what the server owes', () => {
  it('is sent with every answer until the player acknowledges it', () => {
    const w = seated();
    handleWorld(w, req('offer', fairOffer), T0);
    const first = handleWorld(w, req('s1', { kind: 'snapshot' }), TAKEN)!;
    expect(first.effects.map((e) => e.kind)).toEqual(['goods']);
    const seq = first.effects[0].seq!;
    expect(seq).toBeGreaterThan(0);
    // Not acknowledged: sent again.
    expect(handleWorld(w, req('s2', { kind: 'snapshot' }), TAKEN + 1)!.effects.map((e) => e.seq)).toEqual([seq]);
    // Acknowledged: forgotten.
    expect(handleWorld(w, req('s3', { kind: 'snapshot' }, seq), TAKEN + 2)!.effects).toEqual([]);
    expect(w.boards[0].effects[0]).toBeUndefined();
  });

  it('is never sent with an answer made for another seat', () => {
    const w = seated();
    handleWorld(w, req('offer', fairOffer), T0);
    const asRival = handleWorld(w, { ...req('s', { kind: 'snapshot' }), asSeat: 2 }, TAKEN)!;
    expect(asRival.effects).toEqual([]);
    expect(handleWorld(w, req('s2', { kind: 'snapshot' }), TAKEN)!.effects).toHaveLength(1);
  });
});

describe('the client', () => {
  /** A connected game whose acknowledgements never reach the server, as if
   *  every answer to them were lost: everything owed comes again. */
  async function deaf() {
    const game = freshPresenter(freshGame());
    const clock = { t: T0 };
    game.now = () => clock.t;
    game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
    const server = new LocalWorldServer(memoryStore(), () => clock.t);
    const order: string[] = [];
    server.acknowledge = (seq) => { order.push(`ack ${seq}`); };
    game.persist = () => order.push(`save ${game.state.world.effectSeq}`);
    game.worldServer = server;
    await game.connectWorld();
    return { game, clock, server, order };
  }

  it('applies what it is owed once, however often it is sent, and saves before it acknowledges', async () => {
    const { game, clock, server, order } = await deaf();
    const r = await server.postOffer({ id: own, amount: 10 }, { id: other, amount: 10 });
    expect(r.ok).toBe(true);
    const before = game.state.city.goods[other] ?? 0;
    clock.t = TAKEN;
    await game.refreshWorld();
    await game.refreshWorld();
    expect(game.state.city.goods[other] ?? 0).toBe(before + 10);
    const seq = game.state.world.effectSeq;
    expect(seq).toBeGreaterThan(0);
    // Saved with the effect in it, THEN acknowledged.
    expect(order.indexOf(`save ${seq}`)).toBeLessThan(order.indexOf(`ack ${seq}`));
    expect(order.indexOf(`save ${seq}`)).toBeGreaterThanOrEqual(0);
  });

  it('keeps the last effect it applied across a save', async () => {
    const { game, clock, server } = await deaf();
    await server.postOffer({ id: own, amount: 10 }, { id: other, amount: 10 });
    clock.t = TAKEN;
    await game.refreshWorld();
    const back = deserialize(serialize(game.state, TAKEN), map, TAKEN)!;
    expect(back.world.effectSeq).toBe(game.state.world.effectSeq);
  });
});

describe('the stand-in', () => {
  it('hands the seat it once gave everyone to this device\'s player', async () => {
    const store = memoryStore();
    const old = new LocalWorldServer(store, () => T0);
    await old.join({ id: 'local-player', name: 'Me', prefer: { id: 'x', seed: SEED, seat: 3 } });
    const now = new LocalWorldServer(store, () => T0 + 1);
    const snap = await now.join({ id: 'local-4f2a', name: 'Me' });
    expect(snap.board).toEqual({ id: 'x', seed: SEED, seat: 3 });
  });
});

describe('the clock', () => {
  it('is the server\'s, guessed from the quickest recent round trip', () => {
    const sync = new ClockSync();
    expect(sync.offset()).toBe(0);
    // The server runs 5 s ahead; a slow trip guesses badly, a quick one well.
    sync.observe(1_000, 6_900, 3_000);
    expect(sync.offset()).toBe(4_900);
    sync.observe(10_000, 15_050, 10_100);
    expect(sync.offset()).toBe(5_000);
    // A clock changed under the device is followed once the old trips age out.
    for (let i = 0; i < 8; i++) sync.observe(20_000 + i, 20_000 + i + 60_200, 20_000 + i + 400);
    expect(sync.offset()).toBe(60_000);
  });

  it('is never the client\'s to give: a request carries no time', () => {
    const w = seated();
    const a = handleWorld(w, req('s', { kind: 'snapshot' }), T0 + 5 * HOUR)!;
    expect(a.at).toBe(T0 + 5 * HOUR);
  });
});
