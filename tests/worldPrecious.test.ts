// Precious materials on the world board (Docs/features/19-world-map.md §7.4):
// who is dealt which, which hexes are rich, the store a rich district fills,
// and the lumps camps pay.
import { describe, expect, it } from 'vitest';
import { GOODS, WORLD_PRECIOUS } from '../src/sim/data/definitions';
import { PRECIOUS } from '../src/sim/state';
import { SEAT_INDICES, dealMaterials, generateBoard, lumpMaterial, materialAt } from '../src/sim/world/board';
import { boardNeighbors, hexIndex, rotate60 } from '../src/sim/world/hex';
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

  it('are dealt two seats each, by the seed', () => {
    for (const seed of [1, 2, 3, 0x5eed]) {
      const deck = dealMaterials(seed);
      expect(deck).toHaveLength(6);
      for (const id of PRECIOUS) expect(deck.filter((d) => d === id)).toHaveLength(2);
      expect(dealMaterials(seed)).toEqual(deck);
    }
  });

  it('a lump is mostly the seat’s own', () => {
    const board = generateBoard('test', 0x5eed);
    let own = 0;
    for (let i = 0; i < 400; i++) if (lumpMaterial(board, 0, 'test', i) === board.materials[0]) own += 1;
    expect(own / 400).toBeGreaterThan(WORLD_PRECIOUS.ownShare - 0.1);
    expect(own / 400).toBeLessThan(WORLD_PRECIOUS.ownShare + 0.1);
  });
});

describe('rich hexes', () => {
  const board = generateBoard('test', 0x5eed);

  it('are forests, mountains or bare desert, never a city', () => {
    const rich = board.hexes.filter((h) => h.rich);
    expect(rich.length).toBeGreaterThan(0);
    for (const h of rich) {
      expect(h.seat).toBeNull();
      const ok = h.features.includes('Forest') || h.features.includes('Mountain')
        || (h.terrain === 'Desert' && h.features.length === 0);
      expect(ok).toBe(true);
    }
  });

  it('stand the same in every wedge, and yield the wedge’s material', () => {
    for (const h of board.hexes) {
      if (h.role === 'inner' || h.role === 'portal') continue;
      const twin = board.hexes[hexIndex(rotate60(h.hex))];
      expect(twin.rich).toBe(h.rich);
    }
    for (let seat = 0; seat < 6; seat++) expect(materialAt(board, SEAT_INDICES[seat])).toBe(board.materials[seat]);
  });
});

describe('a rich district', () => {
  /** The first seed with a rich hex next to seat 0's city. */
  let seed = 1;
  const richNextDoor = (s: number) => {
    const b = generateBoard('p', s);
    return boardNeighbors(SEAT_INDICES[0]).find((n) => b.hexes[n].rich && !b.hexes[n].features.includes('Dungeon'));
  };
  while (richNextDoor(seed) === undefined) seed += 1;

  it('fills a precious store up to its cap, and pays it on collect', () => {
    const { board: b, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'p', seed, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    const at = richNextDoor(seed)!;
    const r = claim(b, seat, at, T0);
    if (!r.ok) throw new Error(r.why);
    const stands = r.finishesAt;
    resolveTo(b, stands);
    const data = generateBoard('p', seed);
    const rate = preciousRate(data, at);
    expect(rate.id).toBe(data.materials[0]);
    expect(preciousAt(b, at, stands + 6 * HOUR)).toBeCloseTo(rate.perHour * 6, 5);
    expect(preciousAt(b, at, stands + 1000 * HOUR)).toBeCloseTo(rate.cap, 5);
    expect(snapshotOf(b, seat, stands + HOUR).hexes.find((h) => h.index === at)?.precious?.id).toBe(rate.id);
    const paid = collect(b, seat, at, stands + 1000 * HOUR);
    expect(paid.ok && paid.precious).toEqual({ id: rate.id, amount: Math.floor(rate.cap) });
    expect(preciousAt(b, at, stands + 1000 * HOUR)).toBeLessThan(1);
  });
});
