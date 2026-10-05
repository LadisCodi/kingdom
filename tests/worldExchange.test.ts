// The Exchange (Docs/features/19-world-map.md §7.5): offers held by the
// server, taken by players or — when fair — by a rival, or come back.
import { describe, expect, it } from 'vitest';
import { WORLD_EXCHANGE } from '../src/sim/data/definitions';
import { PRECIOUS } from '../src/sim/state';
import { generateBoard } from '../src/sim/world/board';
import {
  drainEffects, emptyWorld, join, postOffer, resolveTo, snapshotOf, takeOffer, withdrawOffer,
} from '../src/worldServer/core';
import type { ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const HOUR = 3_600_000;
const SEED = 0x5eed;
const data = generateBoard('x', SEED);

function quietBoard(): { b: ServerBoard; seat: number } {
  const { board, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'x', seed: SEED, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  return { b: board, seat };
}

const own = data.materials[0];
const other = PRECIOUS.find((p) => p !== own)!;
const goodsOf = (b: ServerBoard, seat: number) => drainEffects(b, seat).filter((e) => e.kind === 'goods');

describe('an offer', () => {
  it('is refused when it gives what it wants, or nothing', () => {
    const { b, seat } = quietBoard();
    expect(postOffer(b, seat, { id: own, amount: 5 }, { id: own, amount: 5 }, T0)).toEqual({ ok: false, why: 'BadOffer' });
    expect(postOffer(b, seat, { id: own, amount: 0 }, { id: other, amount: 5 }, T0)).toEqual({ ok: false, why: 'BadOffer' });
  });

  it('is capped per player', () => {
    const { b, seat } = quietBoard();
    for (let i = 0; i < WORLD_EXCHANGE.maxOffers; i++) {
      expect(postOffer(b, seat, { id: own, amount: 5 }, { id: other, amount: 7 }, T0).ok).toBe(true);
    }
    expect(postOffer(b, seat, { id: own, amount: 5 }, { id: other, amount: 7 }, T0)).toEqual({ ok: false, why: 'TooManyOffers' });
  });

  it('when fair, is taken by the rival that yields what it wants', () => {
    const { b, seat } = quietBoard();
    const r = postOffer(b, seat, { id: own, amount: 10 }, { id: other, amount: 10 }, T0);
    expect(r.ok && r.snapshot.offers).toHaveLength(1);
    resolveTo(b, T0 + WORLD_EXCHANGE.botTakeHours * HOUR);
    const got = goodsOf(b, seat);
    expect(got).toHaveLength(1);
    expect(got[0].kind === 'goods' && got[0].lot).toEqual({ id: other, amount: 10 });
    expect(snapshotOf(b, seat, T0 + 3 * HOUR).offers).toHaveLength(0);
  });

  it('when uneven, waits, then comes back', () => {
    const { b, seat } = quietBoard();
    postOffer(b, seat, { id: own, amount: 10 }, { id: other, amount: 20 }, T0);
    resolveTo(b, T0 + WORLD_EXCHANGE.botTakeHours * HOUR);
    expect(goodsOf(b, seat)).toHaveLength(0);
    resolveTo(b, T0 + WORLD_EXCHANGE.offerHours * HOUR);
    const back = goodsOf(b, seat);
    expect(back[0].kind === 'goods' && back[0].lot).toEqual({ id: own, amount: 10 });
  });

  it('is taken by another player, who receives at once, and pays its maker', () => {
    const { b, seat } = quietBoard();
    const p = postOffer(b, seat, { id: own, amount: 10 }, { id: other, amount: 20 }, T0);
    const id = p.ok ? p.snapshot.offers![0].id : '';
    expect(takeOffer(b, seat, id, T0)).toEqual({ ok: false, why: 'OwnOffer' });
    const r = takeOffer(b, 1, id, T0 + 1000);
    expect(r.ok && r.received).toEqual({ id: own, amount: 10 });
    const paid = goodsOf(b, seat);
    expect(paid[0].kind === 'goods' && paid[0].lot).toEqual({ id: other, amount: 20 });
    expect(takeOffer(b, 1, id, T0 + 2000)).toEqual({ ok: false, why: 'NoSuchOffer' });
  });

  it('is withdrawn by its maker only, handing back what it held', () => {
    const { b, seat } = quietBoard();
    const p = postOffer(b, seat, { id: own, amount: 10 }, { id: other, amount: 20 }, T0);
    const id = p.ok ? p.snapshot.offers![0].id : '';
    expect(withdrawOffer(b, 1, id, T0)).toEqual({ ok: false, why: 'NotYours' });
    const r = withdrawOffer(b, seat, id, T0);
    expect(r.ok && r.received).toEqual({ id: own, amount: 10 });
  });
});

describe('the rivals', () => {
  it('keep an offer of their own material up, one for one', () => {
    const { board: b } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'x', seed: SEED, seat: 0 } }, T0);
    resolveTo(b, T0 + 48 * HOUR);
    const offers = snapshotOf(b, 0, T0 + 48 * HOUR).offers ?? [];
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.give.id).toBe(data.materials[o.seat]);
      expect(o.give.amount).toBe(o.want.amount);
      expect(o.want.id).not.toBe(o.give.id);
    }
  });
});
