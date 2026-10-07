// The world ranking (Docs/features/19-world-map.md §12): a world's kingdoms
// by the hexes each holds, and the Townhall each seat tells the server.
import { describe, expect, it } from 'vitest';
import { behind, worldRanking } from '../src/sim/world/ranking';
import { memoryBoards, serveWorld } from '../src/worldServer/serve';
import type { JoinResult } from '../src/worldServer/handle';
import type { WorldSnapshot } from '../src/worldServer/types';
import { T0 } from './helpers';

const seat = (n: number, extra: Record<string, unknown> = {}) => ({ seat: n, name: `K${n}`, you: false, ...extra });
const held = (owner: number, count: number, isHeld = true) => Array.from({ length: count }, () => ({ owner, held: isHeld }));

describe('the ranking', () => {
  it('counts a city and its standing hexes, most first, and leaves free cities out', () => {
    const rows = worldRanking({
      seats: [seat(0, { you: true }), seat(1), seat(2, { free: true }), seat(3, { friend: true, townhall: 7 })],
      hexes: [...held(0, 2), ...held(1, 5), ...held(3, 1), ...held(1, 3, false), { owner: null, held: true }],
    });
    expect(rows.map((r) => [r.seat, r.hexes, r.rank])).toEqual([[1, 6, 1], [0, 3, 2], [3, 2, 3]]);
    expect(rows[2]).toMatchObject({ friend: true, townhall: 7 });
    expect(rows[1].townhall).toBeNull();
  });

  it('gives kingdoms with as many hexes one place, and the next place counts them all', () => {
    const rows = worldRanking({
      seats: [seat(0), seat(1, { you: true }), seat(2), seat(3)],
      hexes: [...held(0, 4), ...held(1, 2), ...held(2, 2)],
    });
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(behind(rows)).toEqual({ hexes: 2, rank: 1 });
  });

  it('says nobody is ahead of the first', () => {
    const rows = worldRanking({ seats: [seat(0, { you: true }), seat(1)], hexes: held(0, 1) });
    expect(behind(rows)).toBeNull();
  });
});

describe('the server', () => {
  it('keeps the Townhall a seat sends and shows it in every snapshot; the rivals have none', async () => {
    const store = memoryBoards();
    const send = (cmd: unknown, opId: string) => serveWorld(store, 'u1', { opId, ack: 0, cmd }, T0);
    const joined = await send({ kind: 'join', nickname: 'Ada' }, 'j');
    const mine = ((joined as { reply: JoinResult }).reply as { snapshot: WorldSnapshot }).snapshot.board.seat;
    let snap = (await send({ kind: 'snapshot' }, 's0') as { reply: WorldSnapshot }).reply;
    expect(snap.seats[mine].townhall).toBeNull();
    expect(await send({ kind: 'setTownhall', level: 6 }, 't1')).toMatchObject({ status: 200 });
    snap = (await send({ kind: 'snapshot' }, 's1') as { reply: WorldSnapshot }).reply;
    expect(snap.seats[mine]).toMatchObject({ you: true, townhall: 6 });
    const rows = worldRanking(snap);
    expect(rows.length).toBe(snap.seats.length);
    expect(rows.find((r) => r.you)).toMatchObject({ townhall: 6, hexes: 1, rank: 1 });
    expect(rows.filter((r) => !r.you).every((r) => r.townhall === null)).toBe(true);
    expect((await send({ kind: 'setTownhall', level: 0 }, 't2')).status).toBe(400);
  });
});
