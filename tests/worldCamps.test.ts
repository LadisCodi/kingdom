// Monster camps on the world board (Docs/features/19-world-map.md §5.4):
// where they stand, that they guard a claim, and the three ways past one —
// a fight, a tribute, and a rival's slow work.

import { describe, expect, it } from 'vitest';
import { UNITS, WORLD_BOTS, WORLD_CAMPS } from '../src/sim/data/definitions';
import { buildBoard, generateEnemy } from '../src/sim/battle';
import { SEAT_INDICES, generateBoard, type Board } from '../src/sim/world/board';
import { campDifficulty, campShown, campTribute } from '../src/sim/world/camps';
import { boardNeighbors, hexAt, hexDistance, hexIndex, localHex, miniBoardOf, rotate60, worldHex } from '../src/sim/world/hex';
import { snapshotWorld } from '../src/sim/world/source';
import { hexActions } from '../src/ui/world/worldActions';
import {
  claim, claimRefusal, drainEffects, emptyWorld, join, resolveTo, sendArmy, snapshotOf, tribute,
} from '../src/worldServer/core';
import type { ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const HOUR = 3_600_000;
const home = (seat: number) => SEAT_INDICES[seat];

/** A camp two hexes from seat 0's city, beside one of its neighbours. */
function campBeside(board: Board): { camp: number; via: number } | null {
  for (const via of boardNeighbors(home(0))) {
    if (board.hexes[via].features.includes('Dungeon')) continue;
    const camp = boardNeighbors(via).find((n) => board.hexes[n].camp !== null
      && hexDistance(hexAt(n), hexAt(home(0))) === 2);
    if (camp !== undefined) return { camp, via };
  }
  return null;
}

/** The first seed with a camp that close, so a test can reach one. */
let SEED = 1;
while (campBeside(generateBoard('test', SEED)) === null) SEED += 1;
const data = generateBoard('test', SEED);

function quietBoard(): { b: ServerBoard; seat: number } {
  const { board, seat } = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'test', seed: SEED, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  return { b: board, seat };
}

const campNearHome = (_seat: number): { camp: number; via: number } => campBeside(data)!;

const army = (power: number, key: string) => {
  const plan = generateEnemy({ seed: 3, parts: ['camper', key], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, plan.fighters);
};

describe('where camps stand', () => {
  it('holds every inner hex, and none beside a city or on a site', () => {
    for (const h of data.hexes) {
      if (h.role === 'inner') expect(h.camp).not.toBeNull();
      if (h.role === 'portal' || h.seat !== null) expect(h.camp).toBeNull();
      if (h.features.some((f) => f === 'Dungeon' || f === 'Sanctuary' || f === 'Landmark') && h.role !== 'inner') {
        expect(h.camp).toBeNull();
      }
    }
    for (const s of SEAT_INDICES) for (const n of boardNeighbors(s)) expect(data.hexes[n].camp).toBeNull();
  });

  it('covers about its share of the ground it may stand on', () => {
    const beside = new Set(SEAT_INDICES.flatMap((s) => boardNeighbors(s)));
    const open = data.hexes.filter((h) => h.role !== 'inner' && h.role !== 'portal' && h.seat === null
      && !beside.has(h.index) && !h.features.some((f) => f === 'Dungeon' || f === 'Sanctuary' || f === 'Landmark'));
    const share = open.filter((h) => h.camp !== null).length / open.length;
    expect(share).toBeGreaterThan(WORLD_CAMPS.share * 0.5);
    expect(share).toBeLessThan(WORLD_CAMPS.share * 1.5);
  });

  it('is the same in every wedge past the inner ring, so no seat is luckier', () => {
    for (const h of data.hexes) {
      if (h.role === 'inner' || h.role === 'portal' || h.features.includes('Dungeon')) continue;
      const twin = data.hexes[hexIndex(worldHex(miniBoardOf(h.hex), rotate60(localHex(h.hex))))];
      if (twin.features.includes('Dungeon')) continue;
      expect(twin.camp).toEqual(h.camp);
    }
  });

  it('is strongest at the centre', () => {
    const inner = data.hexes.filter((h) => h.role === 'inner').map((h) => h.camp!.power);
    const outer = data.hexes.filter((h) => h.role === 'outer' && h.camp !== null).map((h) => h.camp!.power);
    expect(Math.min(...inner)).toBeGreaterThan(Math.max(...outer));
  });
});

describe('a camp guards its hex', () => {
  it('refuses a claim until the player beats it', () => {
    const { b, seat } = quietBoard();
    const { camp, via } = campNearHome(seat);
    claim(b, seat, via, T0);
    const t = T0 + 24 * HOUR;
    resolveTo(b, t);
    expect(claimRefusal(b, seat, camp, t)).toBe('Guarded');
    expect(claim(b, seat, camp, t)).toEqual({ ok: false, why: 'Guarded' });
  });

  it('is beaten by a strong army, for that player alone, and pays its loot', () => {
    const { b, seat } = quietBoard();
    const { camp, via } = campNearHome(seat);
    claim(b, seat, via, T0);
    const t = T0 + 24 * HOUR;
    const power = data.hexes[camp].camp!.power;
    const r = sendArmy(b, seat, { purpose: 'clear', target: camp, heroes: [], board: army(power * 4, 'strong') }, t);
    if (!r.ok) throw new Error(r.why);
    expect(sendArmy(b, seat, { purpose: 'clear', target: camp, heroes: [], board: army(power, 'again') }, t))
      .toEqual({ ok: false, why: 'Busy' });
    resolveTo(b, r.arrivesAt);
    expect(claimRefusal(b, seat, camp, r.arrivesAt)).toBeNull();
    expect(claimRefusal(b, 1, camp, r.arrivesAt)).not.toBe(null);
    const loot = drainEffects(b, seat).find((e) => e.kind === 'loot');
    expect(loot).toMatchObject({ gold: Math.round(power * WORLD_CAMPS.goldPerPower) });
    expect(loot?.kind === 'loot' && loot.precious?.amount).toBeGreaterThan(0);
    expect(snapshotOf(b, seat, r.arrivesAt).beaten).toContain(camp);
    expect(snapshotOf(b, 1, r.arrivesAt).beaten ?? []).not.toContain(camp);
  });

  it('beats a weak army back and still stands', () => {
    const { b, seat } = quietBoard();
    const { camp } = campNearHome(seat);
    const power = data.hexes[camp].camp!.power;
    const r = sendArmy(b, seat, { purpose: 'clear', target: camp, heroes: [], board: army(Math.max(10, power / 10), 'weak') }, T0);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    expect(snapshotOf(b, seat, r.arrivesAt).beaten).not.toContain(camp);
    expect(drainEffects(b, seat).some((e) => e.kind === 'loot')).toBe(false);
  });

  it('takes a tribute instead, dearer than the troops the fight would cost', () => {
    const { b, seat } = quietBoard();
    const { camp } = campNearHome(seat);
    const r = tribute(b, seat, camp, T0);
    expect(r.ok).toBe(true);
    expect(tribute(b, seat, camp, T0)).toEqual({ ok: false, why: 'NothingThere' });
    expect(drainEffects(b, seat).some((e) => e.kind === 'loot')).toBe(false);
    const power = data.hexes[camp].camp!.power;
    const lost = (power * WORLD_CAMPS.tributeLossShare) / UNITS.Warrior.power;
    for (const [c, n] of Object.entries(UNITS.Warrior.recruitCost)) {
      expect(campTribute(power)[c as 'Gold']).toBeGreaterThan((n as number) * lost);
    }
  });

  it('is beaten by a rival after its delay, without a fight', () => {
    const { b } = quietBoard();
    // The rival beside the player, a sixth round the board: the camp beside
    // its city is the player's turned (every wedge holds the same camps).
    const rival = 1;
    const turn = (i: number) => hexIndex(rotate60(hexAt(i)));
    const { camp, via } = campNearHome(0);
    const r = claim(b, rival, turn(via), T0);
    if (!r.ok) throw new Error(r.why);
    b.seats[rival]!.nextMoveAt = r.finishesAt;
    resolveTo(b, T0 + 30 * 24 * HOUR);
    expect(Object.keys(b.botCamps?.[rival] ?? {})).toContain(String(turn(camp)));
    expect(b.beaten?.[rival] ?? []).toContain(turn(camp));
    expect(WORLD_BOTS.maxHexes).toBeGreaterThan(0);
  });
});

describe('what the player is offered', () => {
  it('Attack and Pay off on a revealed camp, and no Claim', () => {
    const { b, seat } = quietBoard();
    const { camp, via } = campNearHome(seat);
    claim(b, seat, via, T0);
    const t = T0 + 24 * HOUR;
    resolveTo(b, t);
    const source = snapshotWorld(snapshotOf(b, seat, t));
    const kinds = hexActions(source, seat, data.hexes[camp], { revealed: true }).map((a) => a.kind);
    expect(kinds).toEqual(['army', 'tribute']);
    tribute(b, seat, camp, t);
    const after = snapshotWorld(snapshotOf(b, seat, t));
    expect(hexActions(after, seat, data.hexes[camp], { revealed: true }).map((a) => a.kind)).toEqual(['claim']);
  });

  it('hides a lurking camp in the mist, and shows the rest', () => {
    const { b, seat } = quietBoard();
    const source = snapshotWorld(snapshotOf(b, seat, T0));
    const lurk = data.hexes.find((h) => h.camp?.lurking)!;
    const open = data.hexes.find((h) => h.camp !== null && !h.camp.lurking)!;
    expect(campShown(source, lurk, 'Sensed')).toBe(false);
    expect(campShown(source, lurk, 'Revealed')).toBe(true);
    expect(campShown(source, open, 'Sensed')).toBe(true);
    expect(campShown(source, open, 'Unknown')).toBe(false);
  });

  it('reads harder as the camp outweighs the party', () => {
    expect(campDifficulty(100, 1000)).toBe('Very easy');
    expect(campDifficulty(1000, 1000)).toBe('Fair');
    expect(campDifficulty(3000, 1000)).toBe('Deadly');
    expect(campDifficulty(10, 0)).toBe('Deadly');
  });
});
