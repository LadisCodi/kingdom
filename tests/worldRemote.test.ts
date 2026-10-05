// The real world server (Docs/plans/online-server.md §3): `serveWorld` over
// boards kept as versioned documents, and the client that reaches it over a
// network that loses answers.
import { describe, expect, it } from 'vitest';
import { UNITS } from '../src/sim/data/definitions';
import type { UnitId } from '../src/sim/state';
import { SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { RemoteWorldServer, type WorldCall } from '../src/worldServer/remote';
import { memoryBoards, serveWorld, type BoardStore } from '../src/worldServer/serve';
import type { WorldSnapshot } from '../src/worldServer/types';
import { HexCamera } from '../src/render/world/hexCamera';
import { freshGame, freshPresenter, T0 } from './helpers';

const JOIN = { opId: 'j', ack: 0, cmd: { kind: 'join', name: 'Me', prefer: { id: 'x', seed: 7, seat: 2 } } };
const claimBeside = (seat: number, opId: string) =>
  ({ opId, ack: 0, cmd: { kind: 'claim', index: boardNeighbors(SEAT_INDICES[seat])[0] } });

describe('serving a request', () => {
  it('seats a new player on a board of their own, then keeps it', async () => {
    const store = memoryBoards();
    const first = await serveWorld(store, 'u1', JOIN, T0);
    expect(first.status).toBe(200);
    expect(store.seats.get('u1')).toBe('x');
    const claimed = await serveWorld(store, 'u1', claimBeside(2, 'c'), T0 + 1);
    expect(claimed.status === 200 && (claimed.reply as { ok: boolean }).ok).toBe(true);
    expect(store.boards.get('x')?.version).toBe(1);
  });

  it('gives a board of its own to a second player who asks for the first one\'s', async () => {
    const store = memoryBoards();
    await serveWorld(store, 'u1', JOIN, T0);
    const second = await serveWorld(store, 'u2', JOIN, T0);
    expect(second.status === 200 && (second.reply as WorldSnapshot).board.id).toBe('b-u2');
    expect(store.seats.get('u2')).toBe('b-u2');
  });

  it('refuses a request of the wrong shape, and touches nothing', async () => {
    const store = memoryBoards();
    expect((await serveWorld(store, 'u1', { opId: 'x', ack: -1, cmd: { kind: 'join' } }, T0)).status).toBe(400);
    expect((await serveWorld(store, 'u1', { opId: 'x', ack: 0, cmd: { kind: 'dropTables' } }, T0)).status).toBe(400);
    expect(store.boards.size).toBe(0);
  });

  it('plays a rival for the dev tool, never the player', async () => {
    const store = memoryBoards();
    await serveWorld(store, 'u1', JOIN, T0);
    const asSelf = await serveWorld(store, 'u1', { ...claimBeside(2, 'a'), asSeat: 2 }, T0);
    expect(asSelf.status === 200 && asSelf.reply).toEqual({ ok: false, why: 'NotARival' });
    const asRival = await serveWorld(store, 'u1', { ...claimBeside(4, 'b'), asSeat: 4 }, T0);
    expect(asRival.status === 200 && (asRival.reply as { ok: boolean }).ok).toBe(true);
  });

  it('starts again on the newer board when another request wrote it first', async () => {
    const inner = memoryBoards();
    let clashes = 1;
    const store: BoardStore = {
      ...inner,
      async update(id, doc, version) {
        if (clashes-- > 0) {
          // Someone else's write lands between this request's read and write.
          const r = inner.boards.get(id)!;
          inner.boards.set(id, { ...r, version: r.version + 1 });
          return false;
        }
        return inner.update(id, doc, version);
      },
    };
    await serveWorld(store, 'u1', JOIN, T0);
    const r = await serveWorld(store, 'u1', claimBeside(2, 'c'), T0);
    expect(r.status === 200 && (r.reply as { ok: boolean }).ok).toBe(true);
    expect(inner.boards.get('x')?.version).toBe(2);
  });
});

/** A network to the in-memory server that can lose answers on the way back. */
function network(store = memoryBoards(), clock = { t: T0 }) {
  let loseNext = 0;
  let down = false;
  const sent: string[] = [];
  const call: WorldCall = async (body) => {
    sent.push(body.opId);
    if (down) return { ok: false, retry: true, error: 'offline' };
    const served = await serveWorld(store, 'u1', structuredClone(body), clock.t);
    if (loseNext > 0) {
      loseNext--;
      return { ok: false, retry: true, error: 'answer lost' };
    }
    return served.status === 200 ? { ok: true, data: structuredClone(served.reply) } : { ok: false, retry: false, error: served.error };
  };
  const server = new RemoteWorldServer(call, async () => {});
  return { server, store, clock, sent, lose: (n: number) => { loseNext = n; }, setDown: (d: boolean) => { down = d; } };
}

describe('the client of the real server', () => {
  it('retries a command whose answer was lost, and it runs once', async () => {
    const net = network();
    await net.server.join({ id: 'ignored', name: 'Me', prefer: { id: 'x', seed: 7, seat: 2 } });
    const index = boardNeighbors(SEAT_INDICES[2])[0];
    net.lose(1);
    const r = await net.server.claim(index);
    expect(r.ok).toBe(true);
    // Sent twice, with one id; held once.
    expect(net.sent.slice(-2)[0]).toBe(net.sent.slice(-2)[1]);
    const doc = (await net.store.load('x'))!.doc;
    expect(Object.values(doc.hexes).filter((h) => h.owner === 2)).toHaveLength(1);
  });

  it('refuses a command as Offline when the server cannot be reached, and never throws', async () => {
    const net = network();
    await net.server.join({ id: 'ignored', name: 'Me', prefer: { id: 'x', seed: 7, seat: 2 } });
    net.setDown(true);
    expect(await net.server.claim(1)).toEqual({ ok: false, why: 'Offline' });
    expect(await net.server.snapshot()).toBeNull();
    await expect(net.server.join({ id: 'ignored', name: 'Me' })).rejects.toThrow();
  });

  it('keeps the game on the server\'s clock', async () => {
    const net = network(memoryBoards(), { t: Date.now() + 60_000 });
    await net.server.join({ id: 'ignored', name: 'Me' });
    expect(Math.abs(net.server.clockOffset() - 60_000)).toBeLessThan(1_000);
  });
});

describe('the game on the real server', () => {
  async function connected(down: boolean) {
    const net = network();
    net.setDown(down);
    const game = freshPresenter(freshGame());
    game.now = () => T0;
    game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
    game.worldServer = net.server;
    return { game, net };
  }

  it('plays on when the server cannot be reached, and joins on a later read', async () => {
    const { game, net } = await connected(true);
    await game.connectWorld();
    expect(game.worldView).toBeNull();
    net.setDown(false);
    await game.refreshWorld();
    expect(game.worldView).not.toBeNull();
  });

  it('brings home an army the server it joined never heard of', async () => {
    const { game } = await connected(false);
    const before = game.state.army.length;
    const unitId = Object.keys(UNITS)[0] as UnitId;
    game.state.world.armies.push({ id: 'from-the-stand-in', heroes: [], troops: [{ unitId, count: 3 }], target: 0, purpose: 'attack' });
    await game.connectWorld();
    expect(game.state.world.armies).toEqual([]);
    expect(game.state.army).toHaveLength(before + 3);
  });
});
