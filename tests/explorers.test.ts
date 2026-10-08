// Explorers and the world fog (Docs/features/19-world-map.md §3).
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD } from '../src/sim/data/definitions';
import { deserialize, serialize, type CatchUpReport } from '../src/sim/save';
import type { GameState } from '../src/sim/state';
import { HOME_RING, SEAT_INDICES } from '../src/sim/world/board';
import {
  arrivesAt, dispatchExplorer, exploreGold, exploreWorkMs, explorerRoute, explorerSlots, explorerSpeed, fogStateOf, fogStatesOf,
  explorerRushCost, finishExplorerWithGems, freshWorld, homeIndex, readyAt, readyTrips, returnsAt, revealExplored, tripPhase,
  tripRevealing, worldFog,
} from '../src/sim/world/explorers';
import type { ExplorerTrip } from '../src/sim/state';
import { RUSH } from '../src/sim/data/definitions';
import { boardOf } from '../src/sim/world/source';
import { homeboundMs, outboundMs, stepTimes } from '../src/sim/world/travel';
import { bitIndices, bitsFrom, countBits, hasBit, setBit } from '../src/sim/world/fogBits';
import {
  BOARD_RADIUS, BOARD_SIZE, HEX_DIRS, PORTAL_INDEX, PORTAL_INDICES, boardNeighbors, boardWithin, hexAt, hexDistance, hexIndex,
} from '../src/sim/world/hex';
import { grantHero } from '../src/sim/heroes';
import { HEROES } from '../src/sim/data/definitions';
import { freshGame, fund, map, T0 } from './helpers';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** A hex next to the city: Sensed from the start, so it can be explored. */
const nextDoor = (state: GameState) => boardNeighbors(homeIndex(state)).find((n) => n !== PORTAL_INDEX)!;

/** The rim hex across the board from the city. */
const rim = (state: GameState) => {
  const home = hexAt(homeIndex(state));
  return hexIndex({ q: (-home.q * BOARD_RADIUS) / HOME_RING, r: (-home.r * BOARD_RADIUS) / HOME_RING });
};

/** A kingdom that has seen the whole board but for its outer ring. */
const seenMost = (state: GameState) => {
  state.world.revealed = bitsFrom(boardWithin(hexIndex({ q: 0, r: 0 }), BOARD_RADIUS - 1));
};

/** A kingdom with its own explorer and Gold to send it. */
function exploring(): GameState {
  const state = freshGame();
  fund(state, { Gold: 1e9 }); // exploring is priced in Gold; what it costs is tested below
  return state;
}

const sent = (state: GameState, target: number, now: number) => {
  const r = dispatchExplorer(state, target, now);
  if (r.kind !== 'Sent') throw new Error(`not sent: ${r.kind}`);
  return r.trip;
};

/** The player's tap on the hex a trip waits at, the moment its work is done. */
const revealed = (state: GameState, trip: ExplorerTrip, at = readyAt(trip)) => {
  const r = revealExplored(state, trip.target, at);
  if (r.kind !== 'Revealed') throw new Error('not revealed');
  return r.found;
};

/** The Portal, from the player's city: four hexes away. */
/** What every player always sees: every Portal. */
const portals = [...PORTAL_INDICES];

describe('a new kingdom on the board', () => {
  it('sees its own city and the Portal, and nothing else', () => {
    const state = freshGame();
    expect(bitIndices(worldFog(state))).toEqual([homeIndex(state), ...portals].sort((a, b) => a - b));
    expect(countBits(state.world.revealed)).toBe(0);
    expect(SEAT_INDICES).toContain(homeIndex(state));
  });

  it('senses what is next to its city, but nothing round the Portal', () => {
    const state = freshGame();
    for (const n of boardNeighbors(homeIndex(state))) expect(fogStateOf(state, n)).toBe('Sensed');
    for (const d of HEX_DIRS) expect(fogStateOf(state, hexIndex(d))).toBe('Unknown');
    expect(fogStateOf(state, PORTAL_INDEX)).toBe('Revealed');
  });

  it('reads the fog of the whole world at once as it reads one hex', () => {
    const state = freshGame();
    // A scatter of revealed hexes, Portals and seams among them.
    const fog = bitsFrom(Array.from({ length: BOARD_SIZE }, (_, i) => i).filter((i) => (i * 7919) % 11 === 0));
    const states = fogStatesOf(fog);
    expect(states).toHaveLength(BOARD_SIZE);
    for (let i = 0; i < BOARD_SIZE; i++) expect(states[i]).toBe(fogStateOf(state, i, fog));
  });

  it('has its board and seat from its own seed', () => {
    const state = freshGame();
    expect(state.world).toEqual(freshWorld(state.seed));
    expect(freshWorld(1)).not.toEqual(freshWorld(2));
  });
});

describe('sending an explorer', () => {
  it('has an explorer from the start, and needs a free one and a hex that is not home', () => {
    const state = exploring();
    expect(explorerSlots(state)).toBe(WORLD.startingExplorers);
    expect(dispatchExplorer(state, -1, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, BOARD_SIZE, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, homeIndex(state), T0).kind).toBe('Home');
    const trip = sent(state, nextDoor(state), T0);
    // Somewhere the first trip will not reveal: no explorer is left for it —
    // and none is on its way home until its hex is revealed.
    const elsewhere = boardNeighbors(homeIndex(state))
      .find((n) => n !== PORTAL_INDEX && hexDistance(hexAt(n), hexAt(trip.target)) > trip.radius)!;
    expect(dispatchExplorer(state, elsewhere, T0)).toEqual({ kind: 'NoExplorerFree', nextFreeAt: null });
    revealed(state, trip);
    expect(dispatchExplorer(state, elsewhere, readyAt(trip))).toEqual({ kind: 'NoExplorerFree', nextFreeAt: returnsAt(trip) });
  });

  it('goes only where it has seen the way, to a hex it has at least sensed', () => {
    const state = exploring();
    // Across the board, sensed but with no way there seen.
    const across = rim(state);
    const span = hexDistance(hexAt(across), hexAt(homeIndex(state)));
    setBit(state.world.revealed, boardNeighbors(across).find((n) => hexDistance(hexAt(n), hexAt(homeIndex(state))) === span - 1)!);
    expect(fogStateOf(state, across)).toBe('Sensed');
    expect(dispatchExplorer(state, across, T0).kind).toBe('NoRoute');
    state.world.revealed = bitsFrom([]);
    const far = hexIndex({ q: 0, r: -5 });
    expect(fogStateOf(state, far)).toBe('Unknown');
    expect(dispatchExplorer(state, far, T0).kind).toBe('NoRoute');
    seenMost(state);
    expect(dispatchExplorer(state, PORTAL_INDEX, T0).kind).toBe('Explored');
    const edge = boardOf(state.world.board).hexes.find((h) => fogStateOf(state, h.index) === 'Sensed')!;
    expect(dispatchExplorer(state, edge.index, T0).kind).toBe('Sent');
  });

  it('has nothing to explore where it has already seen', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    revealed(state, trip);
    advance(state, map, returnsAt(trip));
    expect(dispatchExplorer(state, nextDoor(state), returnsAt(trip)).kind).toBe('Explored');
    expect(dispatchExplorer(state, PORTAL_INDEX, returnsAt(trip)).kind).toBe('Explored');
  });

  it('takes the quickest way through explored ground, every hex timed as it is left', () => {
    const state = exploring();
    seenMost(state);
    const target = rim(state);
    const trip = sent(state, target, T0);
    const fog = worldFog(state);
    expect(trip.path[0]).toBe(homeIndex(state));
    expect(trip.path.at(-1)).toBe(target);
    expect(trip.path.slice(0, -1).every((i) => hasBit(fog, i))).toBe(true);
    const hexes = boardOf(state.world.board).hexes;
    expect(trip.stepMs).toEqual(stepTimes(hexes, trip.path, 'explorer'));
    expect(trip.stepMs[0]).toBe(WORLD.explorerSecondsPerHex * 1000); // the city is open ground
    expect(arrivesAt(trip) - T0).toBe(outboundMs(trip.stepMs));
    expect(readyAt(trip) - arrivesAt(trip)).toBe(trip.workMs);
    // Home only once the player has revealed it: the road back from the tap.
    expect(returnsAt(trip)).toBe(Number.POSITIVE_INFINITY);
    const tap = readyAt(trip) + 5 * HOUR;
    revealed(state, trip, tap);
    expect(returnsAt(trip) - tap).toBe(homeboundMs(trip.stepMs));
    // No way through the seen ground is quicker: a straight line of open ground
    // is the floor.
    const d = hexDistance(hexAt(homeIndex(state)), hexAt(target));
    expect(outboundMs(trip.stepMs)).toBeGreaterThanOrEqual(d * WORLD.explorerSecondsPerHex * 1000);
  });

  it('sends the first trip free — the tutorial\'s — and counts every trip', () => {
    const state = freshGame();
    state.city.wallet.Gold = 0;
    expect(exploreGold(state, rim(state))).toBe(0);
    sent(state, nextDoor(state), T0);
    expect(state.world.tripsSent).toBe(1);
    expect(exploreGold(state, nextDoor(state))).toBe(WORLD.exploreGoldBase);
  });

  it('costs Gold when it leaves, dearer the further the hex lies, and refuses a short purse', () => {
    const state = exploring();
    state.world.tripsSent = 1; // past the tutorial's free trip
    const near = nextDoor(state);
    expect(exploreGold(state, near)).toBe(WORLD.exploreGoldBase);
    expect(exploreGold(state, rim(state))).toBeGreaterThan(exploreGold(state, near));
    state.city.wallet.Gold = exploreGold(state, near) - 1;
    expect(dispatchExplorer(state, near, T0)).toEqual({ kind: 'NotEnoughGold', gold: exploreGold(state, near) });
    expect(state.world.explorers).toHaveLength(0);
    state.city.wallet.Gold = exploreGold(state, near);
    sent(state, near, T0);
    expect(state.city.wallet.Gold).toBe(0);
  });

  it('works longer at a hex the further it lies from the city', () => {
    const state = exploring();
    const near = nextDoor(state);
    expect(exploreWorkMs(state, near)).toBe((WORLD.exploreWorkSeconds + WORLD.exploreWorkSecondsPerHex) * 1000);
    expect(exploreWorkMs(state, PORTAL_INDEX)).toBe((WORLD.exploreWorkSeconds + HOME_RING * WORLD.exploreWorkSecondsPerHex) * 1000);
    expect(sent(state, near, T0).workMs).toBe(exploreWorkMs(state, near));
  });

  it('works faster with Cartography, and never slower', () => {
    const state = exploring();
    const near = nextDoor(state);
    const slow = exploreWorkMs(state, near);
    state.research.completed.push('Cartography');
    expect(exploreWorkMs(state, near)).toBe(Math.round(slow / 1.5));
  });

  it('marches faster with the Scout, and never slower', () => {
    const state = exploring();
    seenMost(state);
    expect(explorerSpeed(state)).toBe(1);
    const slow = explorerRoute(state, rim(state))!;
    grantHero(state, 'Scout');
    const quick = explorerRoute(state, rim(state))!;
    const v = HEROES.Scout.boon!.value;
    expect(quick.path).toEqual(slow.path);
    // Each hex's time divided by the boon — to the millisecond either way,
    // since both are rounded from the unrounded time.
    quick.stepMs.forEach((ms, k) => expect(Math.abs(ms - slow.stepMs[k] / v)).toBeLessThanOrEqual(1));
  });
});

describe('what a trip reveals', () => {
  it('reveals nothing on its own — not on the way, not when its work is done, not a day later', () => {
    const state = exploring();
    const target = nextDoor(state);
    const trip = sent(state, target, T0);
    const start = bitIndices(worldFog(state));
    expect(start).toEqual([homeIndex(state), ...portals].sort((a, b) => a - b));
    expect(tripPhase(trip, arrivesAt(trip) - 1)).toBe('out');
    expect(tripPhase(trip, arrivesAt(trip))).toBe('working');
    expect(tripPhase(trip, readyAt(trip))).toBe('ready');
    expect(revealExplored(state, target, readyAt(trip) - 1).kind).toBe('NotReady');
    const r = advance(state, map, readyAt(trip) + 24 * HOUR);
    expect(bitIndices(worldFog(state))).toEqual(start);
    expect(r.explorersHome).toEqual([]);
    expect(readyTrips(state, state.lastAdvance)).toEqual([trip]);
  });

  it('reveals a disc round its hex at the player\'s tap, then walks home', () => {
    const state = exploring();
    const target = nextDoor(state);
    const trip = sent(state, target, T0);
    const tap = readyAt(trip) + HOUR;
    advance(state, map, tap);
    const found = revealed(state, trip, tap);
    const disc = [...new Set([homeIndex(state), ...portals, ...boardWithin(target, trip.radius)])].sort((a, b) => a - b);
    expect(bitIndices(worldFog(state))).toEqual(disc);
    expect(found).toMatchObject({ id: trip.id, target, revealed: disc.length - 1 - portals.length });
    expect(tripPhase(trip, tap)).toBe('home');
    // Nothing to reveal twice.
    expect(revealExplored(state, target, tap).kind).toBe('NotReady');
    // The city and the Portal are never stored.
    expect(bitIndices(state.world.revealed)).not.toContain(PORTAL_INDEX);
    expect(bitIndices(state.world.revealed)).not.toContain(homeIndex(state));
  });

  it('frees its slot the moment it is home, and keeps what it saw', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    revealed(state, trip);
    const seen = worldFog(state);

    let r = advance(state, map, returnsAt(trip) - 1);
    expect(state.world.explorers).toHaveLength(1);
    expect(r.explorersHome).toEqual([]);

    r = advance(state, map, returnsAt(trip));
    expect(state.world.explorers).toHaveLength(0);
    expect(r.explorersHome).toEqual([trip.id]);
    expect(worldFog(state)).toEqual(seen);
    const further = boardOf(state.world.board).hexes.find((h) => fogStateOf(state, h.index) === 'Sensed')!;
    expect(dispatchExplorer(state, further.index, returnsAt(trip)).kind).toBe('Sent');
  });
});

describe('one-call replay equals stepped ticking', () => {
  it('lands the same fog and the same kingdom over three days, a second trip sent midway', () => {
    const T1 = T0 + HOUR;
    const second = T1 + 20 * HOUR;
    const end = T1 + 3 * 24 * HOUR;

    const play = (stepMs: number | null): GameState => {
      const state = exploring();
      const to = (t: number) => {
        if (stepMs === null) { advance(state, map, t); return; }
        while (state.lastAdvance < t) advance(state, map, Math.min(t, state.lastAdvance + stepMs));
      };
      to(T1);
      const first = sent(state, nextDoor(state), T1);
      // The player taps its hex hours after its work was done.
      const tap = readyAt(first) + 5 * HOUR;
      to(tap);
      revealed(state, first, tap);
      to(second);
      // The furthest hex it has sensed by then, through what the first saw.
      const home = hexAt(homeIndex(state));
      const fog = worldFog(state);
      const sensed = boardOf(state.world.board).hexes
        .filter((h) => fogStateOf(state, h.index, fog) === 'Sensed')
        .sort((a, b) => hexDistance(home, b.hex) - hexDistance(home, a.hex) || a.index - b.index);
      expect(hexDistance(home, sensed[0].hex)).toBeGreaterThan(1);
      const last = sent(state, sensed[0].index, second);
      to(readyAt(last) + HOUR);
      revealed(state, last, readyAt(last) + HOUR);
      to(end);
      return state;
    };

    const once = play(null);
    const stepped = play(7 * MIN + 13_000);
    expect(stepped.world).toEqual(once.world);
    expect(serialize(stepped, end)).toEqual(serialize(once, end));
    expect(once.world.explorers).toHaveLength(0);
    expect(bitIndices(once.world.revealed).length).toBeGreaterThan(6);
  });
});

describe('the save', () => {
  const reload = (state: GameState, savedAt: number, at: number) => {
    let report: CatchUpReport | null = null;
    const loaded = deserialize(serialize(state, savedAt), map, at, (r) => { report = r; })!;
    return { loaded, report: report as CatchUpReport | null };
  };

  it('keeps an explorer at work through a reload, and waiting through any absence', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    const mid = arrivesAt(trip) + 1;
    advance(state, map, mid);

    const { loaded: atWork } = reload(state, mid, mid);
    expect(atWork.world).toEqual(state.world);

    const { loaded: away } = reload(state, mid, readyAt(trip) + 30 * 24 * HOUR);
    expect(away.world.explorers).toEqual(state.world.explorers);
    expect(worldFog(away)).toEqual(worldFog(state));
    expect(readyTrips(away, readyAt(trip) + 30 * 24 * HOUR).map((t) => t.id)).toEqual([trip.id]);
  });

  it('keeps an explorer on its road home through a reload, and brings it home on the next', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    revealed(state, trip);
    const tap = readyAt(trip);
    advance(state, map, tap);
    const { loaded: onTheRoad } = reload(state, tap, tap);
    expect(onTheRoad.world).toEqual(state.world);
    const { loaded: home, report } = reload(state, tap, returnsAt(trip) + HOUR);
    expect(home.world.explorers).toEqual([]);
    expect(worldFog(home)).toEqual(worldFog(state));
    expect(report!.result.explorersHome).toEqual([trip.id]);
  });

  it('reads a trip from before the tap as one waiting, and an explored kingdom as past its free trip', () => {
    const state = exploring();
    sent(state, nextDoor(state), T0);
    const file = serialize(state, T0);
    const world = (file.Modules as Record<string, any>)['kingdom.world'];
    delete world.TripsSent;
    file.SaveVersion = 111;
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world.explorers[0].revealedAt).toBeNull();
    expect(loaded.world.tripsSent).toBe(1);
    const fresh = freshGame();
    const blank = serialize(fresh, T0);
    delete (blank.Modules as Record<string, any>)['kingdom.world'].TripsSent;
    expect(deserialize(blank, map, T0)!.world.tripsSent).toBe(0);
  });

  it('gives a save from before the world board the world its seed would have', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    delete (file.Modules as Record<string, unknown>)['kingdom.world'];
    file.SaveVersion = 74;
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world).toEqual(freshWorld(state.seed));
  });

  it('resets a save from before the radius-6 board, and sends its armies\' troops home', () => {
    const state = exploring();
    sent(state, nextDoor(state), T0);
    state.world.revealed = bitsFrom([1, 2, 3]);
    state.world.armies = [{ id: 'army_1', heroes: [], troops: [{ unitId: 'Warrior', count: 3 }], target: 1, purpose: 'attack' }];
    const before = state.army.length;
    const file = serialize(state, T0);
    file.SaveVersion = 84;
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world.explorers).toEqual([]);
    expect(loaded.world.armies).toEqual([]);
    expect(loaded.world.board).toEqual(state.world.board);
    expect(bitIndices(loaded.world.revealed)).toEqual([]);
    expect(loaded.army).toHaveLength(before + 3);
    expect(loaded.army.slice(-3).every((u) => u.definitionId === 'Warrior')).toBe(true);
    expect(new Set(loaded.army.map((u) => u.uniqueId)).size).toBe(loaded.army.length);
  });

  it('drops a trip that does not walk the board, and a broken fog', () => {
    const state = exploring();
    sent(state, nextDoor(state), T0);
    const file = serialize(state, T0);
    const world = (file.Modules as Record<string, any>)['kingdom.world'];
    world.Explorers.push({ ...world.Explorers[0], ID: 'explorer_bad', Path: [0, 90] });
    world.Revealed = 'nope';
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world.explorers.map((e) => e.id)).toEqual([state.world.explorers[0].id]);
    expect(loaded.world.revealed).toEqual(bitsFrom([]));
  });
});

// One explorer per hex: a second is not sent where one is already going, and
// the trip can be finished with Gems at the rate every other wait is bought
// at (Docs/features/19-world-map.md §3).
describe('a trip out', () => {
  it('is the only one sent to a hex, or to one its reveal will reach', () => {
    const state = exploring();
    const target = nextDoor(state);
    const trip = sent(state, target, T0);
    const again = dispatchExplorer(state, target, T0);
    expect(again.kind).toBe('BeingExplored');
    expect(tripRevealing(state, target)).toBe(trip);
    const reached = boardWithin(target, trip.radius).find((i) => i !== target && i !== homeIndex(state));
    if (reached !== undefined) expect(tripRevealing(state, reached)).toBe(trip);
  });

  it('is finished with Gems for the work it has left — the player\'s act, so the hex is revealed', () => {
    const state = exploring();
    const target = nextDoor(state);
    const trip = sent(state, target, T0);
    const now = T0 + 10_000;
    const gems = explorerRushCost(trip, now);
    expect(gems).toBe(Math.max(1, Math.ceil((readyAt(trip) - now) / 1000 / RUSH.secondsPerGem)));
    state.player.wallet.Gems = gems;
    const r = finishExplorerWithGems(state, trip.id, now);
    expect(r).toMatchObject({ kind: 'Finished', finished: { home: false } });
    expect(state.player.wallet.Gems).toBe(0);
    expect(hasBit(state.world.revealed, target)).toBe(true);
    expect(tripPhase(trip, now)).toBe('home');
    expect(returnsAt(trip)).toBe(now + homeboundMs(trip.stepMs));
  });

  it('is not hurried while it waits for the tap, and is brought home with Gems on the way back', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    state.player.wallet.Gems = 1e6;
    expect(finishExplorerWithGems(state, trip.id, readyAt(trip)).kind).toBe('Waiting');
    revealed(state, trip);
    const r = finishExplorerWithGems(state, trip.id, readyAt(trip) + 1);
    expect(r).toMatchObject({ kind: 'Finished', finished: { found: null, home: true } });
    expect(state.world.explorers).toEqual([]);
    // Nothing comes home twice when time catches up.
    expect(advance(state, map, returnsAt(trip) + 1).explorersHome).toEqual([]);
  });

  it('is not finished without the Gems', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    state.player.wallet.Gems = 0;
    expect(finishExplorerWithGems(state, trip.id, T0).kind).toBe('NotEnoughGems');
    expect(state.world.explorers).toHaveLength(1);
    expect(finishExplorerWithGems(state, 'nobody', T0).kind).toBe('NotFound');
  });
});
