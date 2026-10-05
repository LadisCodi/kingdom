// Camp raids (Docs/features/19-world-map.md §5.5): a camp the player has not
// beaten raids their districts beside it every `raidHours`; a garrisoned
// Fortress fights it; a raided district burns until it is repaired.
import { describe, expect, it } from 'vitest';
import { WORLD_BUILD, WORLD_CAMPS } from '../src/sim/data/definitions';
import { buildBoard, generateEnemy } from '../src/sim/battle';
import { SEAT_INDICES, generateBoard, type Board } from '../src/sim/world/board';
import { boardNeighbors, hexAt, hexDistance } from '../src/sim/world/hex';
import {
  claim, drainEffects, emptyWorld, finish, join, nextRaidAt, raidersOf, repair, repairPrice, reportSeen, resolveTo,
  sendArmy, snapshotOf, storedAt,
} from '../src/worldServer/core';
import type { ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const HOUR = 3_600_000;
const RAID = WORLD_CAMPS.raidHours * HOUR;
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;

/** A camp two hexes from seat 0's city, lurking or not, and the city's
 *  neighbour beside it. */
function campBeside(board: Board, lurking: boolean): { camp: number; via: number } | null {
  for (const via of boardNeighbors(SEAT_INDICES[0])) {
    if (board.hexes[via].features.includes('Dungeon')) continue;
    const camp = boardNeighbors(via).find((n) => board.hexes[n].camp?.lurking === lurking
      && hexDistance(hexAt(n), hexAt(SEAT_INDICES[0])) === 2);
    if (camp !== undefined) return { camp, via };
  }
  return null;
}
const seedFor = (lurking: boolean): number => {
  let seed = 1;
  while (campBeside(generateBoard('r', seed), lurking) === null) seed += 1;
  return seed;
};

/** The player's district standing beside a camp, the rivals asleep. */
function threatened(lurking = false): { b: ServerBoard; seat: number; camp: number; via: number; t: number } {
  const seed = seedFor(lurking);
  const { board: b, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'r', seed, seat: 0 } }, T0);
  for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
  const { camp, via } = campBeside(generateBoard('r', seed), lurking)!;
  claim(b, seat, via, T0);
  const t = T0 + CLAIM_MS;
  resolveTo(b, t);
  return { b, seat, camp, via, t };
}

const army = (power: number, key: string) => {
  const plan = generateEnemy({ seed: 4, parts: ['guard', key], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, plan.fighters);
};

describe('a camp raid', () => {
  it('lands on the raid hours, burns the district and carries off a share of its store', () => {
    const { b, seat, via, t } = threatened();
    const raid = nextRaidAt(t);
    expect(raid % RAID).toBe(0);
    expect(snapshotOf(b, seat, t).hexes.find((h) => h.index === via)?.threat?.nextRaidAt).toBe(raid);
    const before = storedAt(b, via, raid);
    resolveTo(b, raid);
    expect(b.hexes[via].burnt).toBe(true);
    expect(b.hexes[via].stored).toBeCloseTo(before * (1 - WORLD_CAMPS.raidShare), 6);
    expect(drainEffects(b, seat).some((e) => e.kind === 'report' && !e.good && e.text.includes('burns'))).toBe(true);
    // Burnt, it makes nothing.
    expect(storedAt(b, via, raid + 10 * HOUR)).toBeCloseTo(b.hexes[via].stored, 6);
  });

  it('is repaired by a builder in a share of the build time, and works again', () => {
    const { b, seat, via, t } = threatened();
    const raid = nextRaidAt(t);
    resolveTo(b, raid);
    const price = repairPrice(b, seat);
    expect(price.seconds).toBe(Math.round(WORLD_BUILD.claim.buildSeconds * WORLD_CAMPS.repairTimeShare));
    const r = repair(b, seat, via, raid + 1);
    if (!r.ok) throw new Error(r.why);
    expect(repair(b, seat, via, raid + 2)).toEqual({ ok: false, why: 'Busy' });
    resolveTo(b, r.finishesAt);
    expect(b.hexes[via].burnt).toBe(false);
    // Gems finish one too.
    resolveTo(b, nextRaidAt(r.finishesAt));
    expect(b.hexes[via].burnt).toBe(true);
    const again = repair(b, seat, via, nextRaidAt(r.finishesAt) + 1);
    expect(again.ok).toBe(true);
    expect(finish(b, seat, via, nextRaidAt(r.finishesAt) + 2).ok).toBe(true);
    expect(b.hexes[via].burnt).toBe(false);
  });

  it('waits, from a lurking camp, until the player has seen it', () => {
    const { b, seat, camp, via, t } = threatened(true);
    expect(raidersOf(b, seat, via)).toEqual([]);
    resolveTo(b, nextRaidAt(t));
    expect(b.hexes[via].burnt ?? false).toBe(false);
    reportSeen(b, seat, [camp], nextRaidAt(t) + 1);
    expect(raidersOf(b, seat, via)).toContain(camp);
    resolveTo(b, nextRaidAt(nextRaidAt(t) + 1));
    expect(b.hexes[via].burnt).toBe(true);
  });

  it('is fought off by a strong Fortress garrison, at the cost of some of it', () => {
    const { b, seat, via, t } = threatened();
    b.hexes[via].fortress = 1;
    const g = sendArmy(b, seat, { purpose: 'garrison', target: via, heroes: [], board: army(50_000, 'strong') }, t);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, g.arrivesAt);
    resolveTo(b, nextRaidAt(g.arrivesAt));
    expect(b.hexes[via].burnt ?? false).toBe(false);
    expect(b.hexes[via].garrison).not.toBeNull();
    expect(drainEffects(b, seat).some((e) => e.kind === 'report' && e.good && e.text.includes('drove off'))).toBe(true);
  });

  it('beats a weak garrison, sends what is left home, and burns the district', () => {
    const { b, seat, via, t } = threatened();
    b.hexes[via].fortress = 1;
    const g = sendArmy(b, seat, { purpose: 'garrison', target: via, heroes: [], board: army(20, 'weak') }, t);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, g.arrivesAt);
    resolveTo(b, nextRaidAt(g.arrivesAt));
    expect(b.hexes[via].burnt).toBe(true);
    expect(b.hexes[via].garrison).toBeNull();
    expect(drainEffects(b, seat).some((e) => e.kind === 'armyHome')).toBe(true);
  });

  it('never touches a stand-in rival', () => {
    const { board: b } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'r', seed: seedFor(false), seat: 0 } }, T0);
    resolveTo(b, T0 + 20 * 24 * HOUR);
    for (const [, h] of Object.entries(b.hexes)) if (h.owner !== null && b.seats[h.owner]?.bot) expect(h.burnt ?? false).toBe(false);
  });
});
