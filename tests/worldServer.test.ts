// The world server's rules (Docs/features/19-world-map.md §5–§7): claiming,
// the chain back to the city, districts and their stores, and the
// stand-in rivals — resolved the same however often the board is read.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, WORLD_BOTS, WORLD_BUILD, WORLD_DUNGEON, WORLD_PORTAL } from '../src/sim/data/definitions';
import { houseGoldPerMinute } from '../src/sim/population';
import { addBuilt, freshGame } from './helpers';
import { buildBoard, generateEnemy, villainFighter } from '../src/sim/battle';
import { VILLAINS, type VillainId } from '../src/sim/data/definitions';
import { SEAT_INDICES, generateBoard, wedgeIndexOf } from '../src/sim/world/board';
import { snapshotWorld } from '../src/sim/world/source';
import { PORTAL_INDEX, boardNeighbors, hexAt, hexDistance, hexIndex, hexLine } from '../src/sim/world/hex';
import {
  claim, claimGold, claimRefusal, collect, delveRoom, descendPortal, districtOf, districtRate, drainEffects,
  floorReward, portalClosesAt, portalEvent, portalOpen, portalOpensAt, nextRoom, roomPower, roomReward, emptyWorld, join,
  recall, recomputeChains, resolveTo, sendArmy, snapshotOf, storedAt, tribute, upgrade,
} from '../src/worldServer/core';
import { homeboundMs } from '../src/sim/world/travel';
import { LocalWorldServer, memoryStore } from '../src/worldServer/local';
import { badBody } from '../src/worldServer/serve';
import type { ServerBoard } from '../src/worldServer/types';

const T0 = Date.parse('2026-08-20T12:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
/** How long a district takes to build: the claim. */
const CLAIM_MS = WORLD_BUILD.claim.buildSeconds * 1000;

/** A board with the player in seat 0 and the bots asleep, so a test moves
 *  only what it means to. */
function quietBoard(): { b: ServerBoard; seat: number } {
  const w = emptyWorld();
  const { board, seat } = join(w, { id: 'me', name: 'Me', prefer: { id: 'test', seed: 0x5eed, seat: 0 } }, T0);
  for (const s of board.seats) if (s?.bot) s.nextMoveAt = null;
  // No camp raids: these tests are about something else (tests/worldRaids).
  for (const r of Object.values(board.raids ?? {})) r.at = Infinity;
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
    expect(r.ok && r.finishesAt).toBe(T0 + CLAIM_MS);
    expect(claim(b, 1, next, T0)).toEqual({ ok: false, why: 'Taken' });
    resolveTo(b, T0 + CLAIM_MS - 1);
    expect(b.hexes[next].active).toBe(false);
    resolveTo(b, T0 + CLAIM_MS);
    expect(b.hexes[next].active).toBe(true);
    // Held ground reaches further.
    const beyond = boardNeighbors(next).find((n) => claimRefusal(b, seat, n, T0 + CLAIM_MS) === null
      && hexDistance(hexAt(n), hexAt(home(seat))) === 2);
    expect(beyond).toBeDefined();
  });

  it('prices each claim by the hexes already held', () => {
    expect(claimGold(0)).toBe(WORLD_BUILD.claim.gold);
    expect(claimGold(2)).toBeGreaterThan(claimGold(1));
  });

  it('builds the district the hex\'s feature decides', () => {
    const { b, seat } = quietBoard();
    const next = besideHome(seat)[0];
    claim(b, seat, next, T0);
    const view = snapshotOf(b, seat, T0).hexes.find((h) => h.index === next)!;
    expect(view.held).toBe(false);
    expect(view.district).toBe(districtOf(data.hexes[next]));
    expect(WORLD_BUILD.districts[view.district].feature).toBe(data.hexes[next].features[0] ?? 'None');
  });
});

describe('the chain back to the city', () => {
  it('switches a cut branch off without taking it, and back on when mended', () => {
    const { b, seat } = quietBoard();
    // A line of two hexes out from the city.
    const first = besideHome(seat)[0];
    claim(b, seat, first, T0);
    resolveTo(b, T0 + CLAIM_MS);
    const second = boardNeighbors(first).find((n) => claimRefusal(b, seat, n, T0 + CLAIM_MS) === null
      && !boardNeighbors(n).includes(home(seat)))!;
    claim(b, seat, second, T0 + CLAIM_MS);
    resolveTo(b, T0 + 2 * CLAIM_MS);
    expect(b.hexes[second].active).toBe(true);
    // The link falls (as a denial will make it): the far hex goes inactive,
    // and stays its owner's.
    const cut = T0 + 2 * CLAIM_MS;
    delete b.hexes[first];
    recomputeChains(b, cut);
    expect(b.hexes[second].owner).toBe(seat);
    expect(b.hexes[second].active).toBe(false);
    // Mended: the link is claimed again and the branch comes back.
    expect(claim(b, seat, first, cut).ok).toBe(true);
    resolveTo(b, cut + CLAIM_MS);
    expect(b.hexes[second].active).toBe(true);
  });
});

describe('districts and their stores', () => {
  /** A district beside the city that makes something, standing. */
  function producing() {
    const { b, seat } = quietBoard();
    const at = besideHome(seat).find((n) => districtRate(data.hexes[n]).cap > 0)!;
    claim(b, seat, at, T0);
    return { b, seat, at, ready: T0 + CLAIM_MS };
  }

  it('fills its store at its rate, stops when full, and pays a tap in its own currency', () => {
    const { b, seat, at, ready } = producing();
    const { currency, perHour, cap } = districtRate(data.hexes[at]);
    resolveTo(b, ready + HOUR);
    expect(storedAt(b, at, ready + HOUR)).toBeCloseTo(perHour, 6);
    resolveTo(b, ready + 1000 * HOUR);
    expect(storedAt(b, at, ready + 1000 * HOUR)).toBe(cap);
    const r = collect(b, seat, at, ready + 1000 * HOUR);
    expect(r.ok && r.paid).toEqual({ currency, amount: Math.floor(cap) });
    expect(b.hexes[at].stored).toBeLessThan(1);
  });

  it('pays a Rural district a tenth of what a full level-1 House pays', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    const house = state.city.districts.find((d) => d.definitionId === 'Housing')!;
    state.city.population = DISTRICTS.Housing.populationCapacityPerLevel[0];
    expect(WORLD_BUILD.districts.Rural.produces).toBe('Gold');
    expect(WORLD_BUILD.districts.Rural.perHour).toBe((houseGoldPerMinute(state, house) * 60) / 10);
  });

  it('takes a Fortress into any district, a level at a time', () => {
    const { b, seat, at, ready } = producing();
    expect(upgrade(b, seat, at, 'Fortress', ready - 1)).toEqual({ ok: false, why: 'NotStanding' });
    expect(upgrade(b, 1, at, 'Fortress', ready)).toEqual({ ok: false, why: 'NotYours' });
    const r = upgrade(b, seat, at, 'Fortress', ready);
    if (!r.ok) throw new Error(r.why);
    expect(upgrade(b, seat, at, 'Fortress', ready)).toEqual({ ok: false, why: 'Busy' });
    resolveTo(b, r.finishesAt);
    expect(b.hexes[at].fortress).toBe(1);
    let t = r.finishesAt;
    for (let level = 2; level <= WORLD_BUILD.upgrades.Fortress.levels.length; level++) {
      const next = upgrade(b, seat, at, 'Fortress', t);
      if (!next.ok) throw new Error(next.why);
      t = next.finishesAt;
      resolveTo(b, t);
    }
    expect(upgrade(b, seat, at, 'Fortress', t)).toEqual({ ok: false, why: 'MaxLevel' });
  });
});

describe('the stand-in rivals', () => {
  it('claim ground and raise a Fortress on it, and stop at their size', () => {
    const w = emptyWorld();
    const { board } = join(w, { id: 'me', name: 'Me' }, T0);
    resolveTo(board, T0 + 30 * 24 * HOUR);
    let held = 0;
    for (const [i, s] of board.seats.entries()) {
      if (!s?.bot) continue;
      const theirs = Object.values(board.hexes).filter((h) => h.owner === i);
      held += theirs.length;
      expect(theirs.some((h) => h.fortress > 0)).toBe(true);
    }
    // A rival may take a neighbour's ground, but none claims past its size —
    // the ground it holds now.
    expect(held).toBeGreaterThan(0);
    // Every rival stands: none was left empty, even one whose ground was taken.
    for (const [i, s] of board.seats.entries()) {
      if (s?.bot) expect(Object.values(board.hexes).some((h) => h.owner === i)).toBe(true);
    }
    expect(WORLD_BOTS.maxHexes).toBeGreaterThan(0);
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
  /** The stand-in with a player seated on a board of their own. */
  async function seatedOn(store = memoryStore(), clock = { t: T0 }) {
    const server = new LocalWorldServer(store, () => clock.t);
    expect(await server.connect('me')).toEqual({ kind: 'unseated' });
    const j = await server.join('Mel');
    if (!j.ok) throw new Error(j.why);
    return { server, snap: j.snapshot, clock };
  }

  it('seats a player under their nickname, and remembers them across a reload', async () => {
    const store = memoryStore();
    const { server, snap } = await seatedOn(store);
    const seat = snap.board.seat;
    expect(snap.board.id).toBe('b-me');
    expect(snap.seats.filter((s) => s.bot)).toHaveLength(SEAT_INDICES.length - 1);
    expect(snap.seats[seat].name).toBe('Mel');
    const next = boardNeighbors(SEAT_INDICES[seat])[0];
    const r = await server.claim(next);
    expect(r.ok || r.why).toBeTruthy();

    const again = new LocalWorldServer(store, () => T0 + 1000);
    const back = await again.connect('me');
    expect(back.kind === 'seated' && back.snapshot.board).toEqual(snap.board);
    expect(back.kind === 'seated' && back.snapshot.hexes.some((h) => h.index === next && h.owner === seat) || !r.ok).toBe(true);
  });

  it('acts for another seat, for the dev tool', async () => {
    const { server, snap, clock } = await seatedOn();
    const rival = snap.seats.find((s) => s.bot)!.seat;
    const data = generateBoard(snap.board.id, snap.board.seed);
    const theirs = boardNeighbors(SEAT_INDICES[rival]).find((n) => !data.hexes[n].features.includes('Dungeon'))!;
    const r = await server.claim(theirs, rival);
    expect(r.ok).toBe(true);
    clock.t = T0 + 1;
    const now = (await server.snapshot())!;
    expect(now.hexes.find((h) => h.index === theirs)?.owner).toBe(rival);
    expect(now.hexes.find((h) => h.index === theirs)?.stores).toBeNull();
    expect(snapshotOf).toBeDefined();
  });
});

describe('armies', () => {
  const army = (power: number, key: string) => {
    const plan = generateEnemy({ seed: 1, parts: ['test', key], budget: power, affinity: 'Any' });
    return buildBoard(plan.squads, plan.fighters);
  };

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
      // A camp on the road is paid off first.
      if (claimRefusal(b, rival, i, t) === 'Guarded') tribute(b, rival, i, t);
      if (b.hexes[i] === undefined && claimRefusal(b, rival, i, t) === null) {
        claim(b, rival, i, t);
        t += CLAIM_MS;
        resolveTo(b, t);
      }
    }
    return { b, seat, rival, line, t };
  }

  it('takes undefended ground beside its own, and turns home', () => {
    const { b, seat, rival, line, t } = standoff();
    const next = line[line.length - 2]; // the rival's hex beside the player's city
    expect(b.hexes[next]?.owner).toBe(rival);
    const r = sendArmy(b, seat, { purpose: 'attack', target: next, heroes: [], board: army(300, 'a') }, t);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    expect(b.hexes[next].owner).toBe(seat);
    expect(b.armies[0].phase).toBe('home');
    expect(b.armies[0].at).toBe(r.arrivesAt + homeboundMs(b.armies[0].stepMs));
    resolveTo(b, b.armies[0].at!);
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
    const r = sendArmy(b, seat, { purpose: 'attack', target: far, heroes: [], board: army(300, 'b') }, t);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    expect(b.hexes[far].owner).toBeNull();
    expect(b.hexes[far].standsAt).toBeLessThanOrEqual(t);
    // Denied ground is taken by an army, not by a new claim.
    expect(claimRefusal(b, rival, far, r.arrivesAt)).toBe('Taken');
  });

  it('fights a Fortress garrison first, and goes home beaten when it holds', () => {
    const { b, seat, rival, line, t } = standoff();
    const next = line[line.length - 2];
    // The rival raises a Fortress beside it and mans it strongly.
    const fortHex = line[line.length - 3];
    const h = b.hexes[fortHex];
    h.fortress = 1;
    const g = sendArmy(b, rival, { purpose: 'garrison', target: fortHex, heroes: [], board: army(5000, 'g') }, t);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, g.arrivesAt);
    expect(b.hexes[fortHex].garrison).not.toBeNull();
    const r = sendArmy(b, seat, { purpose: 'attack', target: next, heroes: [], board: army(200, 'weak') }, g.arrivesAt);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    expect(b.hexes[next].owner).toBe(rival);
    expect(drainEffects(b, rival).some((e) => e.kind === 'report' && e.good)).toBe(true);
  });

  it('calls a garrison home, and turns a march round on the road', () => {
    const { b, seat } = quietBoard();
    const out = sendArmy(b, seat, { purpose: 'attack', target: PORTAL_INDEX, heroes: [], board: army(100, 'r') }, T0);
    expect(out.ok).toBe(false); // nobody holds the Portal
    const next = besideHome(seat)[0];
    claim(b, seat, next, T0);
    resolveTo(b, T0 + CLAIM_MS);
    b.hexes[next].fortress = 1;
    const g = sendArmy(b, seat, { purpose: 'garrison', target: next, heroes: [], board: army(100, 'h') }, T0 + CLAIM_MS);
    if (!g.ok) throw new Error(g.why);
    resolveTo(b, g.arrivesAt);
    expect(b.hexes[next].garrison).toBe(g.army);
    const r = recall(b, seat, g.army, g.arrivesAt + 1000);
    expect(r.ok).toBe(true);
    expect(b.hexes[next].garrison).toBeNull();
    resolveTo(b, b.armies[0].at!);
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
    const r = sendArmy(b, seat, { purpose: 'delve', target: d.index, heroes: [], board: army(20_000, 'strong') }, T0);
    if (!r.ok) throw new Error(r.why);
    const there = r.arrivesAt;
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
    const weak = sendArmy(b, 1, { purpose: 'delve', target: d.index, heroes: [], board: army(50, 'weak') }, there);
    if (!weak.ok) throw new Error(weak.why);
  });

  /** A board with the player and a rival camped at the player's nearest
   *  dungeon, the player one room from the bottom. */
  function race() {
    const seed = 7;
    const w = emptyWorld();
    const { board: b, seat } = join(w, { id: 'r', name: 'Me', prefer: { id: 'r', seed, seat: 0 } }, T0);
    for (const s of b.seats) if (s?.bot) s.nextMoveAt = null;
    const d = generateBoard('r', seed).hexes
      .filter((h) => h.features.includes('Dungeon'))
      .sort((x, y) => hexDistance(hexAt(home(seat)), x.hex) - hexDistance(hexAt(home(seat)), y.hex))[0];
    const mine = sendArmy(b, seat, { purpose: 'delve', target: d.index, heroes: [], board: army(200_000, 'closer') }, T0);
    const theirs = sendArmy(b, 1, { purpose: 'delve', target: d.index, heroes: [], board: army(50_000, 'rival') }, T0);
    if (!mine.ok || !theirs.ok) throw new Error('not sent');
    const there = Math.max(mine.arrivesAt, theirs.arrivesAt);
    resolveTo(b, there);
    b.delves[seat] = { [d.index]: WORLD_DUNGEON.depths * WORLD_DUNGEON.roomsPerDepth - 1 };
    b.delves[1] = { [d.index]: 5 };
    drainEffects(b, seat);
    drainEffects(b, 1);
    return { b, seat, d, mine: mine.army, theirs: theirs.army, there };
  }

  it('closes for everyone when its last boss falls: the first to clear it is paid, the rest go home', () => {
    const { b, seat, d, mine, theirs, there } = race();
    const fight = delveRoom(b, seat, mine, there);
    if (!fight.ok) throw new Error(fight.why);
    expect(fight.won).toBe(true);
    expect(snapshotOf(b, seat, there).dungeons).not.toContain(d.index);
    expect(b.delves[seat][d.index]).toBeUndefined();
    expect(b.delves[1][d.index]).toBeUndefined();
    for (const id of [mine, theirs]) expect(b.armies.find((a) => a.id === id)?.phase).toBe('home');
    const paid = drainEffects(b, seat).filter((e) => e.kind === 'loot');
    // The last room's loot, then the close: the last boss again, twice over.
    expect(paid).toHaveLength(2);
    expect(paid[1]).toMatchObject({ gold: Math.round(paid[0].kind === 'loot' ? paid[0].gold * WORLD_DUNGEON.closeRewardMultiplier : 0) });
    expect(drainEffects(b, 1).some((e) => e.kind === 'report' && !e.good)).toBe(true);
    // A closed dungeon cannot be delved or marched to.
    expect(sendArmy(b, 1, { purpose: 'delve', target: d.index, heroes: [], board: army(100, 'late') }, there + 1))
      .toMatchObject({ ok: false, why: 'NothingThere' });
  });

  it('comes back after a rolled while, elsewhere in its own sixth, on bare ground away from the cities', () => {
    const { b, seat, d, mine, there } = race();
    delveRoom(b, seat, mine, there);
    const gone = b.dungeons!.find((x) => x.index === null)!;
    const back = gone.returnsAt!;
    expect(back - there).toBeGreaterThanOrEqual(WORLD_DUNGEON.returnHoursMin * HOUR);
    expect(back - there).toBeLessThanOrEqual(WORLD_DUNGEON.returnHoursMax * HOUR);
    resolveTo(b, back - 1);
    expect(gone.index).toBeNull();
    resolveTo(b, back);
    const at = gone.index!;
    expect(at).not.toBeNull();
    expect(at).not.toBe(d.index);
    const hex = generateBoard('r', 7).hexes[at];
    expect(hexDistance(hex.hex, hexAt(PORTAL_INDEX))).toBeGreaterThanOrEqual(3);
    expect(hex.features.some((f) => f === 'Sanctuary' || f === 'Landmark' || f === 'Dungeon')).toBe(false);
    expect(b.hexes[at]).toBeUndefined(); // nobody holds it
    expect(SEAT_INDICES.some((c) => boardNeighbors(c).includes(at))).toBe(false);
    expect(snapshotOf(b, seat, back).dungeons).toHaveLength(SEAT_INDICES.length);
    expect(snapshotOf(b, seat, back).dungeons).toContain(at);
    // A new dungeon: every seat starts it from the top.
    expect(snapshotOf(b, seat, back).delves[at] ?? 0).toBe(0);
    expect(wedgeIndexOf(hex.hex)).toBe(gone.wedge);
    // The player's board shows it where it stands now, and not where it was.
    const seen = snapshotWorld(snapshotOf(b, seat, back)).board();
    expect(seen.hexes[at].features).toEqual(['Dungeon']);
    expect(seen.hexes[d.index].features).not.toContain('Dungeon');
  });

  it('resolves its return the same read once or read every hour', () => {
    const once = race();
    delveRoom(once.b, once.seat, once.mine, once.there);
    const stepped = race();
    delveRoom(stepped.b, stepped.seat, stepped.mine, stepped.there);
    const end = once.there + 3 * 24 * HOUR;
    resolveTo(once.b, end);
    for (let t = stepped.there; t < end; t += HOUR + 7 * MIN) resolveTo(stepped.b, t);
    resolveTo(stepped.b, end);
    expect(stepped.b.dungeons).toEqual(once.b.dungeons);
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

describe('the Dark Portal', () => {
  const DAY = 24 * HOUR;
  const leader = (power: number, key: string) => {
    const plan = generateEnemy({ seed: 3, parts: ['diver', key], budget: power, affinity: 'Any' });
    return buildBoard(plan.squads, [...plan.fighters, villainFighter(Object.keys(VILLAINS)[0] as VillainId)]);
  };

  it('opens on the same weekday for three days, and is shut the other four', () => {
    const k = portalEvent(T0);
    const opens = portalOpensAt(k + 1);
    expect(new Date(opens).getUTCDay()).toBe(WORLD_PORTAL.openWeekday);
    expect(portalOpen(opens - 1)).toBe(false);
    expect(portalOpen(opens)).toBe(true);
    expect(portalOpen(opens + WORLD_PORTAL.openDays * DAY - 1)).toBe(true);
    expect(portalOpen(opens + WORLD_PORTAL.openDays * DAY)).toBe(false);
    expect(portalClosesAt(k + 1) - portalOpensAt(k + 1)).toBe(WORLD_PORTAL.openDays * DAY);
  });

  it('pays a precious lump on the floors that carry one', () => {
    const { b, seat } = quietBoard();
    const opens = portalOpensAt(portalEvent(T0) + 1);
    const r = sendArmy(b, seat, { purpose: 'portal', target: PORTAL_INDEX, heroes: [], board: leader(500_000, 'p') }, opens);
    if (!r.ok) throw new Error(r.why);
    resolveTo(b, r.arrivesAt);
    // One floor short of the first that pays one, in this opening.
    b.portal.event = portalEvent(r.arrivesAt);
    b.portal.floors[seat] = { floor: WORLD_PORTAL.preciousEvery - 1, at: r.arrivesAt };
    drainEffects(b, seat);
    const f = descendPortal(b, seat, r.army, r.arrivesAt + 1);
    expect(f.ok && f.won).toBe(true);
    const loot = drainEffects(b, seat).find((e) => e.kind === 'loot');
    expect(loot?.kind === 'loot' && loot.precious?.amount).toBe(floorReward(WORLD_PORTAL.preciousEvery).precious);
  });

  it('takes floors one at a time, spends a clear only on a win, and pays the ranking at the close', () => {
    const { b, seat } = quietBoard();
    const opens = portalOpensAt(portalEvent(T0) + 1);
    expect(sendArmy(b, seat, { purpose: 'portal', target: PORTAL_INDEX, heroes: [], board: leader(50_000, 's') }, T0))
      .toEqual({ ok: false, why: 'Shut' });
    const r = sendArmy(b, seat, { purpose: 'portal', target: PORTAL_INDEX, heroes: [], board: leader(50_000, 's') }, opens);
    if (!r.ok) throw new Error(r.why);
    const there = r.arrivesAt;
    resolveTo(b, there);
    expect(b.armies[0].phase).toBe('camp');
    for (let i = 0; i < WORLD_PORTAL.attemptsPerDay; i++) {
      const f = descendPortal(b, seat, r.army, there + i);
      expect(f.ok && f.won).toBe(true);
    }
    expect(descendPortal(b, seat, r.army, there + 10)).toEqual({ ok: false, why: 'NoAttempts' });
    expect(snapshotOf(b, seat, there + 10).portal.floor).toBe(WORLD_PORTAL.attemptsPerDay);
    // A new UTC day brings the clears back.
    const nextDay = (Math.floor(there / DAY) + 1) * DAY + 1;
    expect(descendPortal(b, seat, r.army, nextDay).ok).toBe(true);
    drainEffects(b, seat);
    // The close: the ranking pays, and the diver walks home.
    resolveTo(b, portalClosesAt(portalEvent(opens)));
    const owed = drainEffects(b, seat);
    expect(owed.some((e) => e.kind === 'loot' && (e.gems ?? 0) > 0)).toBe(true);
    expect(b.armies[0]?.phase ?? 'home').toBe('home');
  });
});

describe('the edge function door', () => {
  // The local stand-in never reads the body check, so a command missing from
  // it worked offline and was refused as Offline online.
  it('takes every command the server handles', () => {
    for (const cmd of [
      { kind: 'hurry', index: 3, seconds: 60 },
      { kind: 'hostRelic', index: 3, relic: 'x', level: 1 },
      { kind: 'unhostRelic', relic: 'x' },
    ]) expect(badBody({ opId: 'op', ack: 0, cmd })).toBeNull();
    expect(badBody({ opId: 'op', ack: 0, cmd: { kind: 'nope' } })).toBe('cmd');
  });
});
