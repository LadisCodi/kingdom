// Camp raids (Docs/features/19-world-map.md §5.5): one raid at a time per
// player. A camp beside one of their districts chooses it and announces the
// raid `raidWarnHours` ahead; it lands, and the next is a raid-gap away. A
// garrisoned Fortress fights it; a raided district burns until repaired;
// beating the camp first calls the raid off. A beaten camp stands again
// `returnHours` later (§5.4).
import { describe, expect, it } from 'vitest';
import { WORLD_BUILD, WORLD_CAMPS } from '../src/sim/data/definitions';
import { buildBoard, generateEnemy } from '../src/sim/battle';
import { SEAT_INDICES, generateBoard, type Board } from '../src/sim/world/board';
import { boardNeighbors, hexAt, hexDistance } from '../src/sim/world/hex';
import {
  claim, claimRefusal, drainEffects, emptyWorld, finish, hasBeaten, join, raidOf, raidersOf, repair, repairPrice,
  reportSeen, resolveTo, sendArmy, snapshotOf, storedAt, tribute,
} from '../src/worldServer/core';
import type { RaidPlan, ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const HOUR = 3_600_000;
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;
const WARN = WORLD_CAMPS.raidWarnHours * HOUR;

/** A neighbour of seat 0's city with a camp beside it two hexes out — every
 *  camp beside it lurking, or none — and that camp. */
function campBeside(board: Board, lurking: boolean): { camp: number; via: number } | null {
  for (const via of boardNeighbors(SEAT_INDICES[0])) {
    if (board.hexes[via].features.includes('Dungeon')) continue;
    const camps = boardNeighbors(via).filter((n) => board.hexes[n].camp !== null);
    if (camps.length === 0 || camps.some((n) => board.hexes[n].camp!.lurking !== lurking)) continue;
    const camp = camps.find((n) => hexDistance(hexAt(n), hexAt(SEAT_INDICES[0])) === 2);
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

/** Resolve the board until a camp has announced its raid on the player. */
function announced(b: ServerBoard, seat: number): RaidPlan {
  for (let i = 0; i < 50; i++) {
    const r = raidOf(b, seat)!;
    if (r.camp !== null) return { ...r };
    resolveTo(b, r.at);
  }
  throw new Error('no raid was announced');
}

const army = (power: number, key: string) => {
  const plan = generateEnemy({ seed: 4, parts: ['guard', key], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, plan.fighters);
};

describe('a camp raid', () => {
  it('is announced ahead, on one district, burns it and carries off a share of its store', () => {
    const { b, seat, camp, via } = threatened();
    const raid = announced(b, seat);
    expect(raid).toMatchObject({ camp, target: via });
    const chosenAt = b.resolvedTo;
    expect(raid.at).toBe(chosenAt + WARN);
    const threat = snapshotOf(b, seat, chosenAt).hexes.find((h) => h.index === via)?.threat;
    expect(threat).toEqual({ camps: [camp], nextRaidAt: raid.at });
    const before = storedAt(b, via, raid.at);
    resolveTo(b, raid.at);
    expect(b.hexes[via].burnt).toBe(true);
    expect(b.hexes[via].stored).toBeCloseTo(before * (1 - WORLD_CAMPS.raidShare), 6);
    expect(drainEffects(b, seat).some((e) => e.kind === 'report' && !e.good && e.text.includes('burns'))).toBe(true);
    // Burnt, it makes nothing.
    expect(storedAt(b, via, raid.at + 10 * HOUR)).toBeCloseTo(b.hexes[via].stored, 6);
    // The next camp chooses a raid-gap after it landed.
    const next = raidOf(b, seat)!;
    expect(next.camp).toBeNull();
    expect(next.at - raid.at).toBeGreaterThanOrEqual(WORLD_CAMPS.raidGapMinHours * HOUR);
    expect(next.at - raid.at).toBeLessThanOrEqual(WORLD_CAMPS.raidGapMaxHours * HOUR);
  });

  it('is repaired by a builder in a share of the build time, and works again', () => {
    const { b, seat, via } = threatened();
    const raid = announced(b, seat);
    resolveTo(b, raid.at);
    const price = repairPrice(b, seat);
    expect(price.seconds).toBe(Math.round(WORLD_BUILD.claim.buildSeconds * WORLD_CAMPS.repairTimeShare));
    const r = repair(b, seat, via, raid.at + 1);
    if (!r.ok) throw new Error(r.why);
    expect(repair(b, seat, via, raid.at + 2)).toEqual({ ok: false, why: 'Busy' });
    resolveTo(b, r.finishesAt);
    expect(b.hexes[via].burnt).toBe(false);
    // Gems finish one too.
    const again = announced(b, seat);
    resolveTo(b, again.at);
    expect(b.hexes[via].burnt).toBe(true);
    expect(repair(b, seat, via, again.at + 1).ok).toBe(true);
    expect(finish(b, seat, via, again.at + 2).ok).toBe(true);
    expect(b.hexes[via].burnt).toBe(false);
  });

  it('waits, from a lurking camp, until the player has seen it', () => {
    const { b, seat, camp, via, t } = threatened(true);
    expect(raidersOf(b, seat, via, t)).toEqual([]);
    resolveTo(b, t + 24 * HOUR);
    expect(raidOf(b, seat)!.camp).toBeNull();
    expect(b.hexes[via].burnt ?? false).toBe(false);
    reportSeen(b, seat, [camp], t + 24 * HOUR);
    expect(raidersOf(b, seat, via, t + 24 * HOUR)).toContain(camp);
    const raid = announced(b, seat);
    resolveTo(b, raid.at);
    expect(b.hexes[via].burnt).toBe(true);
  });

  it('is called off when the player beats the camp first', () => {
    const { b, seat, camp, via } = threatened();
    const raid = announced(b, seat);
    const paid = tribute(b, seat, camp, b.resolvedTo + 1);
    expect(paid.ok).toBe(true);
    expect(raidOf(b, seat)!.camp).toBeNull();
    expect(paid.ok && paid.snapshot.hexes.find((h) => h.index === via)?.threat).toBeNull();
    resolveTo(b, raid.at);
    expect(b.hexes[via].burnt ?? false).toBe(false);
  });

  it('is fought off by a strong Fortress garrison, at the cost of some of it', () => {
    const { b, seat, via, t } = threatened();
    b.hexes[via].fortress = 1;
    const g = sendArmy(b, seat, { purpose: 'garrison', target: via, heroes: [], board: army(50_000, 'strong') }, t);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, g.arrivesAt);
    const raid = announced(b, seat);
    resolveTo(b, raid.at);
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
    const raid = announced(b, seat);
    resolveTo(b, raid.at);
    expect(b.hexes[via].burnt).toBe(true);
    expect(b.hexes[via].garrison).toBeNull();
    expect(drainEffects(b, seat).some((e) => e.kind === 'armyHome')).toBe(true);
  });

  it('never threatens more than one district at a time', () => {
    const { b, seat, t } = threatened();
    // Every claimable neighbour of the city, so several camps are in reach.
    let at = t;
    for (const n of boardNeighbors(SEAT_INDICES[seat])) {
      if (claimRefusal(b, seat, n, at) === null) {
        claim(b, seat, n, at);
        at += CLAIM_MS;
        resolveTo(b, at);
      }
    }
    let seen = 0;
    for (let h = 0; h < 72; h++) {
      resolveTo(b, at + h * HOUR);
      const threats = snapshotOf(b, seat, at + h * HOUR).hexes.filter((x) => x.threat != null).length;
      expect(threats).toBeLessThanOrEqual(1);
      seen += threats;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('lands the same read once after three days as read every few minutes', () => {
    const once = threatened().b;
    const stepped = threatened().b;
    const end = T0 + 72 * HOUR;
    resolveTo(once, end);
    for (let t = T0; t < end; t += 7 * 60_000) resolveTo(stepped, t);
    resolveTo(stepped, end);
    expect(stepped.raids).toEqual(once.raids);
    expect(stepped.hexes).toEqual(once.hexes);
    expect(stepped.effects).toEqual(once.effects);
  });

  it('never touches a stand-in rival', () => {
    const { board: b } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'r', seed: seedFor(false), seat: 0 } }, T0);
    resolveTo(b, T0 + 20 * 24 * HOUR);
    for (const [, h] of Object.entries(b.hexes)) if (h.owner !== null && b.seats[h.owner]?.bot) expect(h.burnt ?? false).toBe(false);
    expect(Object.keys(b.raids ?? {})).toEqual(['0']);
  });
});

describe('a beaten camp', () => {
  it('stands again for the player who beat it, after its hours', () => {
    const { b, seat, camp, t } = threatened();
    expect(tribute(b, seat, camp, t).ok).toBe(true);
    expect(hasBeaten(b, seat, camp, t)).toBe(true);
    expect(snapshotOf(b, seat, t).beaten).toContain(camp);
    const back = t + WORLD_CAMPS.returnHours * HOUR;
    expect(hasBeaten(b, seat, camp, back - 1)).toBe(true);
    expect(hasBeaten(b, seat, camp, back)).toBe(false);
    resolveTo(b, back);
    expect(snapshotOf(b, seat, back).beaten).not.toContain(camp);
    expect(tribute(b, seat, camp, back).ok).toBe(true);
  });

  it('beaten before camps came back, stands again its hours from then', () => {
    const { b, seat, camp, t } = threatened();
    b.beaten = { [seat]: [camp] };
    resolveTo(b, t + 1);
    expect(b.campsBack?.[seat]?.[camp]).toBe(t + WORLD_CAMPS.returnHours * HOUR);
  });
});
