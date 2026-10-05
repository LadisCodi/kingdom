// The real world server (Docs/plans/online-server.md §3): `serveWorld` over
// boards kept as versioned documents, and the client that reaches it over a
// network that loses answers.
import { describe, expect, it } from 'vitest';
import { UNITS } from '../src/sim/data/definitions';
import type { UnitId } from '../src/sim/state';
import { SEAT_INDICES } from '../src/sim/world/board';
import { boardNeighbors } from '../src/sim/world/hex';
import { RemoteWorldServer, type WorldCall } from '../src/worldServer/remote';
import type { JoinResult } from '../src/worldServer/handle';
import { memoryBoards, serveWorld, type BoardStore } from '../src/worldServer/serve';
import { HexCamera } from '../src/render/world/hexCamera';
import { freshGame, freshPresenter, T0 } from './helpers';

const join = (nickname: string) => ({ opId: `j-${nickname}`, ack: 0, cmd: { kind: 'join', nickname } });
const claimBeside = (seat: number, opId: string) =>
  ({ opId, ack: 0, cmd: { kind: 'claim', index: boardNeighbors(SEAT_INDICES[seat])[0] } });
/** Join, and the board and seat it gave. */
async function joined(store: BoardStore, userId: string, nickname: string) {
  const r = await serveWorld(store, userId, join(nickname), T0);
  const reply = (r.status === 200 ? r.reply : null) as JoinResult | null;
  if (reply === null || !reply.ok) throw new Error(`no seat: ${JSON.stringify(r)}`);
  return reply.snapshot.board;
}

describe('a first join', () => {
  it('opens a board of the player\'s own when no board has a rival to replace', async () => {
    const store = memoryBoards();
    const board = await joined(store, 'u1', 'Ada');
    expect(board.id).toBe('b-u1');
    expect(store.seats.get('u1')).toBe('b-u1');
    expect(store.nicknames.get('u1')).toBe('Ada');
    const doc = (await store.load('b-u1'))!.doc;
    expect(doc.seats[board.seat]).toMatchObject({ name: 'Ada', bot: false });
    expect(doc.seats.filter((s) => s?.bot)).toHaveLength(5);
  });

  it('puts the next player in a rival\'s city on the newest board, and the rival leaves', async () => {
    const store = memoryBoards();
    const first = await joined(store, 'u1', 'Ada');
    // The rival a seat goes to had ground; it stays, nobody's.
    const before = (await store.load('b-u1'))!.doc;
    const rival = before.seats.findIndex((s) => s?.bot === true);
    before.hexes[boardNeighbors(SEAT_INDICES[rival])[0]] = {
      owner: rival, standsAt: T0 - 1, fortress: 0, work: null, active: true, stored: 50, storeAt: T0, garrison: null,
    };
    await store.update('b-u1', before, (await store.load('b-u1'))!.version);
    const second = await joined(store, 'u2', 'Brin');
    expect(second.id).toBe('b-u1');
    expect(second.seat).toBe(rival);
    expect(second.seat).not.toBe(first.seat);
    const doc = (await store.load('b-u1'))!.doc;
    expect(doc.seats[rival]).toMatchObject({ playerId: 'u2', name: 'Brin', bot: false });
    expect(doc.seats.filter((s) => s?.bot)).toHaveLength(4);
    const left = doc.hexes[boardNeighbors(SEAT_INDICES[rival])[0]];
    expect(left).toMatchObject({ owner: null, stored: 0 });
  });

  it('opens a new board once every rival on the old one is replaced', async () => {
    const store = memoryBoards();
    await joined(store, 'u0', 'Player 0');
    for (let i = 1; i <= 5; i++) expect((await joined(store, `u${i}`, `Player ${i}`)).id).toBe('b-u0');
    expect((await joined(store, 'u6', 'Player 6')).id).toBe('b-u6');
  });

  it('refuses a nickname another player has, whatever its case, and one of the wrong shape', async () => {
    const store = memoryBoards();
    await joined(store, 'u1', 'Ada');
    const taken = await serveWorld(store, 'u2', join('ADA'), T0);
    expect(taken.status === 200 && taken.reply).toEqual({ ok: false, why: 'NicknameTaken' });
    const bad = await serveWorld(store, 'u2', join('<script>'), T0);
    expect(bad.status === 200 && bad.reply).toEqual({ ok: false, why: 'BadNickname' });
    expect(store.seats.has('u2')).toBe(false);
  });

  it('keeps the name chosen first: a player seated already keeps their seat and name', async () => {
    const store = memoryBoards();
    const board = await joined(store, 'u1', 'Ada');
    expect(await joined(store, 'u1', 'Someone Else')).toEqual(board);
    expect(store.nicknames.get('u1')).toBe('Ada');
  });

  it('answers a player on no board with nothing', async () => {
    const store = memoryBoards();
    const r = await serveWorld(store, 'u1', { opId: 's', ack: 0, cmd: { kind: 'snapshot' } }, T0);
    expect(r.status === 200 && r.reply).toBeNull();
    const c = await serveWorld(store, 'u1', claimBeside(0, 'c'), T0);
    expect(c.status === 200 && c.reply).toEqual({ ok: false, why: 'NoBoard' });
  });
});

describe('serving a request', () => {
  it('keeps a seated player\'s board, a version a write', async () => {
    const store = memoryBoards();
    const board = await joined(store, 'u1', 'Ada');
    const claimed = await serveWorld(store, 'u1', claimBeside(board.seat, 'c'), T0 + 1);
    expect(claimed.status === 200 && (claimed.reply as { ok: boolean }).ok).toBe(true);
    expect(store.boards.get('b-u1')?.version).toBe(1);
  });

  it('refuses a request of the wrong shape, and touches nothing', async () => {
    const store = memoryBoards();
    expect((await serveWorld(store, 'u1', { opId: 'x', ack: -1, cmd: { kind: 'join', nickname: 'Ada' } }, T0)).status).toBe(400);
    expect((await serveWorld(store, 'u1', { opId: 'x', ack: 0, cmd: { kind: 'dropTables' } }, T0)).status).toBe(400);
    expect((await serveWorld(store, 'u1', { opId: 'x', ack: 0, cmd: { kind: 'join' } }, T0)).status).toBe(400);
    expect(store.boards.size).toBe(0);
  });

  it('plays a rival for the dev tool, never the player', async () => {
    const store = memoryBoards();
    const board = await joined(store, 'u1', 'Ada');
    const rival = (await store.load('b-u1'))!.doc.seats.findIndex((s) => s?.bot === true);
    const asSelf = await serveWorld(store, 'u1', { ...claimBeside(board.seat, 'a'), asSeat: board.seat }, T0);
    expect(asSelf.status === 200 && asSelf.reply).toEqual({ ok: false, why: 'NotARival' });
    const asRival = await serveWorld(store, 'u1', { ...claimBeside(rival, 'b'), asSeat: rival }, T0);
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
    const board = await joined(store, 'u1', 'Ada');
    const r = await serveWorld(store, 'u1', claimBeside(board.seat, 'c'), T0);
    expect(r.status === 200 && (r.reply as { ok: boolean }).ok).toBe(true);
    expect(inner.boards.get('b-u1')?.version).toBe(2);
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
    const j = await net.server.join('Ada');
    const seat = j.ok ? j.snapshot.board.seat : -1;
    const index = boardNeighbors(SEAT_INDICES[seat])[0];
    net.lose(1);
    const r = await net.server.claim(index);
    expect(r.ok).toBe(true);
    // Sent twice, with one id; held once.
    expect(net.sent.slice(-2)[0]).toBe(net.sent.slice(-2)[1]);
    const doc = (await net.store.load('b-u1'))!.doc;
    expect(Object.values(doc.hexes).filter((h) => h.owner === seat)).toHaveLength(1);
  });

  it('refuses a command as Offline when the server cannot be reached, and never throws', async () => {
    const net = network();
    expect(await net.server.connect('u1')).toEqual({ kind: 'unseated' });
    await net.server.join('Ada');
    net.setDown(true);
    expect(await net.server.claim(1)).toEqual({ ok: false, why: 'Offline' });
    expect(await net.server.snapshot()).toBeNull();
    expect(await net.server.connect('u1')).toEqual({ kind: 'offline' });
    expect(await net.server.join('Ada')).toEqual({ ok: false, why: 'Offline' });
  });

  it('keeps the game on the server\'s clock', async () => {
    const net = network(memoryBoards(), { t: Date.now() + 60_000 });
    await net.server.join('Ada');
    expect(Math.abs(net.server.clockOffset() - 60_000)).toBeLessThan(1_000);
  });
});

describe('the game on the real server', () => {
  async function connected(down: boolean, store = memoryBoards()) {
    const net = network(store);
    net.setDown(down);
    const game = freshPresenter(freshGame());
    game.now = () => T0;
    game.worldCamera = new HexCamera({ clientWidth: 390, clientHeight: 844 });
    game.worldServer = net.server;
    return { game, net };
  }

  /** Let what an action set going on the server finish. */
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('asks a player on no board for a name the first time out, and seats them under it', async () => {
    const { game } = await connected(false);
    await game.connectWorld();
    expect(game.worldSeated).toBe(false);
    expect(game.worldView).toBeNull();
    // Nothing to read for a kingdom on no board.
    await game.refreshWorld();
    expect(game.worldView).toBeNull();
    game.enterWorld();
    await settle();
    expect(game.openOverlay).toBe('nickname');
    expect(game.scene).not.toBe('world');
    await game.doJoinWorld('x');
    expect(game.nicknameRefused).toBe('At least three characters');
    await game.doJoinWorld('  Ada   of  Kent ');
    expect(game.worldSeated).toBe(true);
    expect(game.scene).toBe('world');
    expect(game.openOverlay).toBeNull();
    expect(game.worldView?.seats.find((s) => s.you)?.name).toBe('Ada of Kent');
    // The name the board draws under the player's city (19 §1.3).
    expect(game.worldSource().seats().find((s) => s.owner.you)?.owner.name).toBe('Ada of Kent');
  });

  it('says so when the name is taken, and stays on the sheet', async () => {
    const store = memoryBoards();
    await store.claimNickname('someone-else', 'Ada');
    const { game } = await connected(false, store);
    await game.connectWorld();
    game.setOverlay('nickname');
    await game.doJoinWorld('ada');
    expect(game.nicknameRefused).toBe('Another kingdom has that name');
    expect(game.worldSeated).toBe(false);
    expect(game.openOverlay).toBe('nickname');
  });

  it('plays on when the server cannot be reached, and finds out where it sits on a later read', async () => {
    const { game, net } = await connected(true);
    await game.connectWorld();
    expect(game.worldSeated).toBeNull();
    game.enterWorld();
    await settle();
    expect(game.openOverlay).not.toBe('nickname');
    net.setDown(false);
    await game.refreshWorld();
    expect(game.worldSeated).toBe(false);
  });

  it('brings home an army the server it joined never heard of', async () => {
    const { game } = await connected(false);
    const before = game.state.army.length;
    const unitId = Object.keys(UNITS)[0] as UnitId;
    game.state.world.armies.push({ id: 'from-the-stand-in', heroes: [], troops: [{ unitId, count: 3 }], target: 0, purpose: 'attack' });
    await game.connectWorld();
    await game.doJoinWorld('Ada');
    expect(game.state.world.armies).toEqual([]);
    expect(game.state.army).toHaveLength(before + 3);
  });
});
