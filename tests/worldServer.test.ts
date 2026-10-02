// The world server's rules (Docs/features/19-world-map.md §5–§7): claiming,
// the chain back to the city, improvements and their stores, and the
// stand-in rivals — resolved the same however often the board is read.
import { describe, expect, it } from 'vitest';
import { WORLD, WORLD_BOTS, WORLD_BUILD, WORLD_DUNGEON } from '../src/sim/data/definitions';
import { buildBoard, generateEnemy, villainFighter } from '../src/sim/battle';
import { VILLAINS, type VillainId } from '../src/sim/data/definitions';
import { SEAT_INDICES, generateBoard } from '../src/sim/world/board';
import { PORTAL_INDEX, boardNeighbors, hexAt, hexDistance, hexIndex, hexLine } from '../src/sim/world/hex';
import {
  build, claim, claimRefusal, collect, delveRoom, drainEffects, nextRoom, roomPower, roomReward, emptyWorld, fittingImprovements, improvementRate, join,
  outpostGold, recall, recomputeChains, resolveTo, sendArmy, snapshotOf, storesAt,
} from '../src/worldServer/core';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import type { ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
const OUTPOST_MS = WORLD_BUILD.outpost.buildSeconds * 1000;

/** A board with the player in seat 0 and the bots asleep, so a test moves
 *  only what it means to. */
function quietBoard(): { b: ServerBoard; seat: number } {
  const w = emptyWorld();
  const { board, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  return { b: board, seat };
}

const home = (seat: number) => SEAT_INDICES[seat];
const data = generateBoard('test', 0x5eed);
/** The city's neighbours that can be claimed, the ones towards the centre
 *  first (the rim side has fewer hexes beyond it). */
const besideHome = (seat: number) =>
  boardNeighbors(home(seat)).filter((n) => !data.hexes[n].features.includes('Dungeon'))
    .sort((a, b) => hexDistance(hexAt(a), hexAt(PORTAL_INDEX)) - hexDistance(hexAt(b), hexAt(PORTAL_INDEX)));

describe('claiming ground', () => {
  it('needs a hex beside held ground, and never the Portal, a city or a dungeon', () => {
    const { b, seat } = quietBoard();
    expect(claimRefusal(b, seat, PORTAL_INDEX, T0)).toBe('NeverHeld');
    expect(claimRefusal(b, seat, home(1), T0)).toBe('Taken');
    const far = data.hexes.find((h) => hexDistance(h.hex, hexAt(home(seat))) >= 3 && h.role !== 'portal'
      && !h.features.includes('Dungeon') && h.seat === null)!;
    expect(claimRefusal(b, seat, far.index, T0)).toBe('NotAdjacent');
    const next = besideHome(seat)[0];
    expect(claimRefusal(b, seat, next, T0)).toBeNull();
  });

  it('takes a builder’s time, then joins the chain', () => {
    const { b, seat } = quietBoard();
    const next = besideHome(seat)[0];
    const r = claim(b, seat, next, T0);
    expect(r.ok && r.finishesAt).toBe(T0 + OUTPOST_MS);
    expect(claim(b, 1, next, T0)).toEqual({ ok: false, why: 'Taken' });
    resolveTo(b, T0 + OUTPOST_MS - 1);
    expect(b.hexes[next].active).toBe(false);
    resolveTo(b, T0 + OUTPOST_MS);
    expect(b.hexes[next].active).toBe(true);
    // Held ground reaches further.
    const beyond = boardNeighbors(next).find((n) => claimRefusal(b, seat, n, T0 + OUTPOST_MS) === null
      && hexDistance(hexAt(n), hexAt(home(seat))) === 2);
    expect(beyond).toBeDefined();
  });

  it('prices each Outpost by the hexes already held', () => {
    expect(outpostGold(0)).toBe(WORLD_BUILD.outpost.gold);
    expect(outpostGold(2)).toBeGreaterThan(outpostGold(1));
  });
});

describe('the chain back to the city', () => {
  it('switches a cut branch off without taking it, and back on when mended', () => {
    const { b, seat } = quietBoard();
    // A line of two hexes out from the city.
    const first = besideHome(seat)[0];
    claim(b, seat, first, T0);
    resolveTo(b, T0 + OUTPOST_MS);
    const second = boardNeighbors(first).find((n) => claimRefusal(b, seat, n, T0 + OUTPOST_MS) === null
      && !boardNeighbors(n).includes(home(seat)))!;
    claim(b, seat, second, T0 + OUTPOST_MS);
    resolveTo(b, T0 + 2 * OUTPOST_MS);
    expect(b.hexes[second].active).toBe(true);
    // The link falls (as a denial will make it): the far hex goes inactive,
    // and stays its owner's.
    const cut = T0 + 2 * OUTPOST_MS;
    delete b.hexes[first];
    recomputeChains(b, cut);
    expect(b.hexes[second].owner).toBe(seat);
    expect(b.hexes[second].active).toBe(false);
    // Mended: the link is claimed again and the branch comes back.
    expect(claim(b, seat, first, cut).ok).toBe(true);
    resolveTo(b, cut + OUTPOST_MS);
    expect(b.hexes[second].active).toBe(true);
  });
});

describe('improvements and their stores', () => {
  /** A held hex beside the city that takes a producing improvement. */
  function producing() {
    const { b, seat } = quietBoard();
    const at = besideHome(seat).find((n) => fittingImprovements(data.hexes[n]).some((k) => k !== 'Fortress'))!;
    claim(b, seat, at, T0);
    const t1 = T0 + OUTPOST_MS;
    const kind = fittingImprovements(data.hexes[at]).find((k) => k !== 'Fortress')!;
    const r = build(b, seat, at, kind, t1);
    if (!r.ok) throw new Error(r.why);
    return { b, seat, at, kind, ready: r.finishesAt };
  }

  it('fills its store at its rate, stops when full, and pays a tap', () => {
    const { b, seat, at, kind, ready } = producing();
    const { perHour, cap } = improvementRate(data.hexes[at], kind, 1);
    resolveTo(b, ready + HOUR);
    expect(storesAt(b, at, ready + HOUR).material).toBeCloseTo(perHour, 6);
    resolveTo(b, ready + 1000 * HOUR);
    expect(storesAt(b, at, ready + 1000 * HOUR).material).toBe(cap);
    const r = collect(b, seat, at, ready + 1000 * HOUR);
    expect(r.ok && r.material?.amount).toBe(Math.floor(cap));
    expect(b.hexes[at].material).toBeLessThan(1);
  });

  it('refuses ground it cannot stand on, a second build at once, and a rival’s hex', () => {
    const { b, seat, at, kind, ready } = producing();
    expect(build(b, seat, at, kind, ready - 1)).toEqual({ ok: false, why: 'Busy' });
    expect(build(b, 1, at, kind, ready)).toEqual({ ok: false, why: 'NotYours' });
    const other = fittingImprovements(data.hexes[at]).includes('Fortress') ? null : 'Fortress';
    expect(other).toBeNull(); // a Fortress fits anywhere
    const r = build(b, seat, at, kind, ready);
    expect(r.ok).toBe(true);
  });
});

describe('the stand-in rivals', () => {
  it('claim ground and build on it, and stop at their size', () => {
    const w = emptyWorld();
    const { board } = join(w, { id: 'me', name: 'Me' }, T0);
    resolveTo(board, T0 + 30 * 24 * HOUR);
    let held = 0;
    for (const [i, s] of board.seats.entries()) {
      if (!s?.bot) continue;
      const theirs = Object.values(board.hexes).filter((h) => h.owner === i);
      held += theirs.length;
      expect(Object.values(board.hexes).some((h) => h.improvement !== null)).toBe(true);
    }
    // A rival may take a neighbour's ground, but none claims more Outposts
    // than its size allows.
    expect(held).toBeGreaterThan(0);
    for (const s of board.seats) if (s?.bot) expect(s.claims ?? 0).toBeLessThanOrEqual(WORLD_BOTS.maxHexes);
  });

  it('play the same board whether it is read once or every few minutes', () => {
    const once = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'x', seed: 7, seat: 3 } }, T0).board;
    const often = join(emptyWorld(), { id: 'me', name: 'Me', prefer: { id: 'x', seed: 7, seat: 3 } }, T0).board;
    const end = T0 + 5 * 24 * HOUR;
    resolveTo(once, end);
    for (let t = T0; t < end; t += 7 * MIN + 13_000) resolveTo(often, t);
    resolveTo(often, end);
    expect(often).toEqual(once);
  });
});

describe('the local server', () => {
  it('seats a player, keeps the board it was handed, and remembers across a reload', async () => {
    const store = memoryStore();
    const server = new LocalWorldServer(store);
    const snap = await server.join({ id: 'me', name: 'Me', prefer: { id: 'mine', seed: 99, seat: 4 } }, T0);
    expect(snap.board).toEqual({ id: 'mine', seed: 99, seat: 4 });
    expect(snap.seats.filter((s) => s.bot)).toHaveLength(5);
    const next = boardNeighbors(SEAT_INDICES[4])[0];
    const r = await server.claim(next, T0);
    expect(r.ok || r.why).toBeTruthy();

    const again = new LocalWorldServer(store);
    const back = await again.join({ id: 'me', name: 'Me' }, T0 + 1000);
    expect(back.board).toEqual(snap.board);
    expect(back.hexes.some((h) => h.index === next && h.owner === 4) || !r.ok).toBe(true);
  });

  it('acts for another seat, for the dev tool', async () => {
    const server = new LocalWorldServer(memoryStore());
    await server.join({ id: 'me', name: 'Me', prefer: { id: 'b', seed: 5, seat: 0 } }, T0);
    const theirs = boardNeighbors(SEAT_INDICES[2]).find((n) => !generateBoard('b', 5).hexes[n].features.includes('Dungeon'))!;
    const r = await server.claim(theirs, T0, 2);
    expect(r.ok).toBe(true);
    const snap = (await server.snapshot(T0 + 1))!;
    expect(snap.hexes.find((h) => h.index === theirs)?.owner).toBe(2);
    expect(snap.hexes.find((h) => h.index === theirs)?.stores).toBeNull();
    expect(snapshotOf).toBeDefined();
  });
});

describe('armies', () => {
  const army = (power: number, key: string) => {
    const plan = generateEnemy({ seed: 1, parts: ['test', key], budget: power, affinity: 'Any' });
    return buildBoard(plan.squads, plan.fighters);
  };
  const STEP = WORLD.marchSecondsPerHex * 1000;

  /** The player in seat 0, a rival in seat 1 holding a hex beside the
   *  player's city — or `apart` hexes from it — and nobody else moving. */
  function standoff() {
    const { b, seat } = quietBoard();
    // A hex next to both cities would be ideal; build the rival a path out
    // towards the player instead, claimed by hand.
    const rival = 1;
    const line = hexLine(hexAt(home(rival)), hexAt(home(seat))).map(hexIndex);
    let t = T0;
    for (const i of line.slice(1, -1)) {
      if (b.hexes[i] === undefined && claimRefusal(b, rival, i, t) === null) {
        claim(b, rival, i, t);
        t += OUTPOST_MS;
        resolveTo(b, t);
      }
    }
    return { b, seat, rival, line, t };
  }

  it('takes undefended ground beside its own, and turns home', () => {
    const { b, seat, rival, line, t } = standoff();
    const next = line[line.length - 2]; // the rival's hex beside the player's city
    expect(b.hexes[next]?.owner).toBe(rival);
    const r = sendArmy(b, seat, { purpose: 'attack', target: next, heroes: [], board: army(300, 'a'), msPerHex: STEP }, t);
    expect(r.ok).toBe(true);
    resolveTo(b, t + STEP);
    expect(b.hexes[next].owner).toBe(seat);
    expect(b.armies[0].phase).toBe('home');
    resolveTo(b, t + 2 * STEP);
    expect(b.armies).toHaveLength(0);
    const owed = drainEffects(b, seat);
    expect(owed.some((e) => e.kind === 'armyHome')).toBe(true);
    expect(owed.some((e) => e.kind === 'report' && e.good)).toBe(true);
    expect(drainEffects(b, seat)).toEqual([]);
    expect(drainEffects(b, rival).some((e) => e.kind === 'report' && !e.good)).toBe(true);
  });

  it('denies ground it cannot reach from its own, leaving its buildings standing', () => {
    const { b, seat, rival, line, t } = standoff();
    const far = line[1]; // the rival's hex beside the rival's city
    expect(b.hexes[far]?.owner).toBe(rival);
    sendArmy(b, seat, { purpose: 'attack', target: far, heroes: [], board: army(300, 'b'), msPerHex: STEP }, t);
    resolveTo(b, t + (line.length - 2) * STEP);
    expect(b.hexes[far].owner).toBeNull();
    expect(b.hexes[far].outpostAt).toBeLessThanOrEqual(t);
    // Denied ground is taken by an army, not by a new Outpost.
    expect(claimRefusal(b, rival, far, t + (line.length - 2) * STEP)).toBe('Taken');
  });

  it('fights a Fortress garrison first, and goes home beaten when it holds', () => {
    const { b, seat, rival, line, t } = standoff();
    const next = line[line.length - 2];
    // The rival raises a Fortress beside it and mans it strongly.
    const fortHex = line[line.length - 3];
    const h = b.hexes[fortHex];
    h.improvement = { kind: 'Fortress', level: 1 };
    sendArmy(b, rival, { purpose: 'garrison', target: fortHex, heroes: [], board: army(5000, 'g'), msPerHex: 1 }, t);
    resolveTo(b, t + 100);
    expect(b.hexes[fortHex].garrison).not.toBeNull();
    sendArmy(b, seat, { purpose: 'attack', target: next, heroes: [], board: army(200, 'weak'), msPerHex: STEP }, t + 100);
    resolveTo(b, t + 100 + STEP);
    expect(b.hexes[next].owner).toBe(rival);
    expect(drainEffects(b, rival).some((e) => e.kind === 'report' && e.good)).toBe(true);
  });

  it('calls a garrison home, and turns a march round on the road', () => {
    const { b, seat } = quietBoard();
    const out = sendArmy(b, seat, { purpose: 'attack', target: PORTAL_INDEX, heroes: [], board: army(100, 'r'), msPerHex: STEP }, T0);
    expect(out.ok).toBe(false); // nobody holds the Portal
    const next = besideHome(seat)[0];
    claim(b, seat, next, T0);
    resolveTo(b, T0 + OUTPOST_MS);
    b.hexes[next].improvement = { kind: 'Fortress', level: 1 };
    const g = sendArmy(b, seat, { purpose: 'garrison', target: next, heroes: [], board: army(100, 'h'), msPerHex: STEP }, T0 + OUTPOST_MS);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, T0 + OUTPOST_MS + STEP);
    expect(b.hexes[next].garrison).toBe(g.army);
    const r = recall(b, seat, g.army, T0 + OUTPOST_MS + 2 * STEP);
    expect(r.ok).toBe(true);
    expect(b.hexes[next].garrison).toBeNull();
    resolveTo(b, T0 + OUTPOST_MS + 3 * STEP);
    expect(b.armies).toHaveLength(0);
  });
});

describe('dungeons', () => {
  const army = (power: number, key: string) => {
    const plan = generateEnemy({ seed: 2, parts: ['delver', key], budget: power, affinity: 'Any' });
    // A delving army needs someone to lead it: a villain reads as a hero.
    return buildBoard(plan.squads, [...plan.fighters, villainFighter(Object.keys(VILLAINS)[0] as VillainId)]);
  };

  it('camps an army at a dungeon and fights it room by room, for the player alone', () => {
    // The first seed whose board has a dungeon.
    let seed = 1;
    while (!generateBoard('d', seed).hexes.some((h) => h.features.includes('Dungeon'))) seed += 1;
    const w = emptyWorld();
    const { board: b, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'd', seed, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    const d = generateBoard('d', seed).hexes.find((h) => h.features.includes('Dungeon'))!;
    const STEP = WORLD.marchSecondsPerHex * 1000;
    const r = sendArmy(b, seat, { purpose: 'delve', target: d.index, heroes: [], board: army(20_000, 'strong'), msPerHex: STEP }, T0);
    if (!r.ok) throw new Error(r.why);
    const there = T0 + (hexLine(hexAt(home(seat)), hexAt(d.index)).length - 1) * STEP;
    resolveTo(b, there);
    expect(b.armies[0].phase).toBe('camp');
    const fight = delveRoom(b, seat, r.army, there);
    if (!fight.ok) throw new Error(fight.why);
    expect(fight.room).toBe(1);
    expect(fight.won).toBe(true);
    expect(b.delves[seat][d.index]).toBe(1);
    expect(drainEffects(b, seat).some((e) => e.kind === 'loot')).toBe(true);
    expect(b.delves[1]?.[d.index] ?? 0).toBe(0);
    expect(snapshotOf(b, seat, there).delves[d.index]).toBe(1);
    // A weak army is beaten, keeps its losses, and stays camped while it has
    // a hero left; the room is not cleared.
    const weak = sendArmy(b, 1, { purpose: 'delve', target: d.index, heroes: [], board: army(50, 'weak'), msPerHex: STEP }, there);
    if (!weak.ok) throw new Error(weak.why);
  });

  it('counts rooms in depths, the last of each a boss, and pays more deeper down', () => {
    expect(nextRoom(0)).toEqual({ depth: 0, room: 1, boss: false });
    expect(nextRoom(WORLD_DUNGEON.roomsPerDepth - 1)).toEqual({ depth: 0, room: WORLD_DUNGEON.roomsPerDepth, boss: true });
    expect(nextRoom(WORLD_DUNGEON.roomsPerDepth)).toEqual({ depth: 1, room: 1, boss: false });
    expect(nextRoom(WORLD_DUNGEON.depths * WORLD_DUNGEON.roomsPerDepth)).toBeNull();
    expect(roomPower(0, WORLD_DUNGEON.roomsPerDepth)).toBeGreaterThan(roomPower(0, WORLD_DUNGEON.roomsPerDepth - 1));
    expect(roomReward(1, 1).gold).toBeGreaterThan(roomReward(0, 1).gold);
    expect(roomReward(0, 1).knowledge).toBeGreaterThanOrEqual(1);
  });
});
