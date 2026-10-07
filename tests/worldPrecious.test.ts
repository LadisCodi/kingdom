// Precious materials on the world board (Docs/plans/precious-deposits.md):
// the bag that deals every seat 3/2/1, where the deposits stand, the store a
// deposit's district fills, and the lumps camps pay.
import { describe, expect, it } from 'vitest';
import { GOODS, WORLD_GEN } from '../src/sim/data/definitions';
import { PRECIOUS } from '../src/sim/state';
import { SEATS, SEAT_INDICES, dealDeposits, generateBoard, lumpMaterial } from '../src/sim/world/board';
import { BOARD_COUNT, boardNeighbors, hexDistance, miniBoardOf } from '../src/sim/world/hex';
import { DEPOSIT_OF, depositMaterial } from '../src/sim/world/types';
import {
  claim, collect, emptyWorld, join, preciousAt, preciousRate, resolveTo, snapshotOf,
} from '../src/worldServer/core';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const HOUR = 3_600_000;

describe('the three materials', () => {
  it('are goods nothing makes', () => {
    for (const id of PRECIOUS) {
      expect(GOODS[id].precious).toBe(true);
      expect(GOODS[id].workSeconds).toBeNull();
    }
  });

  it('are dealt from a bag of the six orders, one a seat, by the seed', () => {
    for (const seed of [1, 2, 3, 0x5eed]) {
      const deal = dealDeposits(seed);
      expect(deal).toHaveLength(6);
      expect(new Set(deal.map((d) => `${d.strong}>${d.middle}>${d.weak}`)).size).toBe(6);
      for (const id of PRECIOUS) {
        for (const rank of ['strong', 'middle', 'weak'] as const) expect(deal.filter((d) => d[rank] === id)).toHaveLength(2);
      }
      expect(dealDeposits(seed)).toEqual(deal);
    }
  });

  it('a lump is any of the three alike', () => {
    const board = generateBoard('test', 0x5eed);
    const counts = new Map<string, number>();
    for (let i = 0; i < 900; i++) {
      const id = lumpMaterial(board, 0, 'test', i);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const id of PRECIOUS) expect(counts.get(id) ?? 0).toBeGreaterThan(240);
  });
});

describe('the deposits', () => {
  for (const seed of [1, 0x5eed, 99]) {
    const board = generateBoard('test', seed);
    const deposits = board.hexes.filter((h) => depositMaterial(h.features) !== null);

    it(`give every seat 3/2/1 of its deal, 2–3 from its city (seed ${seed})`, () => {
      for (let seat = 0; seat < 6; seat++) {
        const near = deposits.filter((h) => h.role === 'corridor'
          && SEATS.every((s, i) => i === seat || hexDistance(h.hex, s) > hexDistance(h.hex, SEATS[seat])));
        const deal = board.deposits[seat];
        const count = (id: string) => near.filter((h) => depositMaterial(h.features) === id).length;
        expect([count(deal.strong), count(deal.middle), count(deal.weak)]).toEqual([3, 2, 1]);
        for (const h of near) expect([2, 3]).toContain(hexDistance(h.hex, SEATS[seat]));
      }
    });

    it(`hold 12 of each on the corridors and 2 of each on the inner ring, facing a weak seat (seed ${seed})`, () => {
      for (const id of PRECIOUS) {
        expect(deposits.filter((h) => h.role === 'corridor' && depositMaterial(h.features) === id)).toHaveLength(12 * BOARD_COUNT);
        expect(deposits.filter((h) => h.role === 'inner' && depositMaterial(h.features) === id)).toHaveLength(2 * BOARD_COUNT);
      }
      for (const h of board.hexes.filter((x) => x.role === 'inner')) {
        const facing = SEATS.findIndex((s) => SEATS.every((o) => hexDistance(h.hex, s) <= hexDistance(h.hex, o)));
        expect(depositMaterial(h.features)).toBe(board.deposits[facing].weak);
      }
      // The bag is per board: every board deals each material 12 times.
      for (let b = 0; b < BOARD_COUNT; b++) {
        for (const id of PRECIOUS) {
          expect(deposits.filter((h) => h.role === 'corridor' && miniBoardOf(h.hex) === b && depositMaterial(h.features) === id)).toHaveLength(12);
        }
      }
    });

    it(`stand on ground their feature allows, and nowhere else (seed ${seed})`, () => {
      for (const h of deposits) {
        const f = DEPOSIT_OF[depositMaterial(h.features)!];
        expect(WORLD_GEN.featureRules[f].terrains).toContain(h.terrain);
        expect(h.features).toEqual([f]);
      }
      expect(deposits).toHaveLength((6 * 6 + 6) * BOARD_COUNT);
    });
  }
});

describe('a deposit\'s district', () => {
  const seed = 0x5eed;
  const data = generateBoard('p', seed);
  // Seat 0's nearest deposit and the hex between it and the city.
  const city = SEAT_INDICES[0];
  const at = data.hexes.find((h) => depositMaterial(h.features) !== null && h.role === 'corridor'
    && hexDistance(h.hex, SEATS[0]) === 2 && hexDistance(h.hex, SEATS[1]) > 2)!.index;
  const step = boardNeighbors(city).find((n) => boardNeighbors(n).includes(at))!;

  it('fills a precious store up to its cap, and pays it on collect', () => {
    const { board: b, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'p', seed, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    // No camp guards or raids it: this is about the store alone.
    b.beaten = { [seat]: data.hexes.filter((h) => h.camp !== null).map((h) => h.index) };
    for (const r of Object.values(b.raids ?? {})) r.at = Infinity;
    const first = claim(b, seat, step, T0);
    if (!first.ok) throw new Error(first.why);
    resolveTo(b, first.finishesAt);
    const r = claim(b, seat, at, first.finishesAt);
    if (!r.ok) throw new Error(r.why);
    const stands = r.finishesAt;
    resolveTo(b, stands);
    const rate = preciousRate(data, at);
    expect(rate.id).toBe(depositMaterial(data.hexes[at].features));
    expect(preciousRate(data, step).id).toBeNull();
    expect(preciousAt(b, at, stands + 6 * HOUR)).toBeCloseTo(rate.perHour * 6, 5);
    expect(preciousAt(b, at, stands + 1000 * HOUR)).toBeCloseTo(rate.cap, 5);
    expect(snapshotOf(b, seat, stands + HOUR).hexes.find((h) => h.index === at)?.precious?.id).toBe(rate.id);
    const paid = collect(b, seat, at, stands + 1000 * HOUR);
    expect(paid.ok && paid.precious).toEqual({ id: rate.id, amount: Math.floor(rate.cap) });
    expect(preciousAt(b, at, stands + 1000 * HOUR)).toBeLessThan(1);
  });
});
