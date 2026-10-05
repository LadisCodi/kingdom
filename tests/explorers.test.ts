// Explorers and the world fog (Docs/features/19-world-map.md §3).
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD } from '../src/sim/data/definitions';
import { deserialize, serialize, type CatchUpReport } from '../src/sim/save';
import type { GameState } from '../src/sim/state';
import { SEAT_INDICES } from '../src/sim/world/board';
import {
  arrivesAt, dispatchExplorer, exploreGold, exploreWorkMs, explorerRoute, explorerSlots, explorerSpeed, fogStateOf,
  freshWorld, homeIndex, returnsAt, revealsAt, worldFogAt,
} from '../src/sim/world/explorers';
import { boardOf } from '../src/sim/world/source';
import { homeboundMs, outboundMs, stepTimes } from '../src/sim/world/travel';
import { bitIndices, bitsFrom, hasBit, setBit } from '../src/sim/world/fogBits';
import {
  BOARD_SIZE, HEX_DIRS, PORTAL_INDEX, boardNeighbors, boardWithin, hexAt, hexDistance, hexIndex,
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
  return hexIndex({ q: (-home.q * 5) / 4, r: (-home.r * 5) / 4 });
};

/** A kingdom that has seen the whole board but for its outer ring. */
const seenMost = (state: GameState) => {
  state.world.revealed = bitsFrom(boardWithin(hexIndex({ q: 0, r: 0 }), 4));
};

/** A kingdom that has researched Cartography: one explorer. */
function exploring(): GameState {
  const state = freshGame();
  state.research.completed.push('Cartography');
  fund(state, { Gold: 1e9 }); // exploring is priced in Gold; what it costs is tested below
  return state;
}

const sent = (state: GameState, target: number, now: number) => {
  const r = dispatchExplorer(state, target, now);
  if (r.kind !== 'Sent') throw new Error(`not sent: ${r.kind}`);
  return r.trip;
};

/** The Portal, from the player's city: four hexes away. */
const portal = PORTAL_INDEX;

describe('a new kingdom on the board', () => {
  it('sees its own city and the Portal, and nothing else', () => {
    const state = freshGame();
    expect(bitIndices(worldFogAt(state, T0))).toEqual([homeIndex(state), portal].sort((a, b) => a - b));
    expect(state.world.revealed).toEqual([0, 0, 0]);
    expect(SEAT_INDICES).toContain(homeIndex(state));
  });

  it('senses what is next to its city, but nothing round the Portal', () => {
    const state = freshGame();
    for (const n of boardNeighbors(homeIndex(state))) expect(fogStateOf(state, n, T0)).toBe('Sensed');
    for (const d of HEX_DIRS) expect(fogStateOf(state, hexIndex(d), T0)).toBe('Unknown');
    expect(fogStateOf(state, portal, T0)).toBe('Revealed');
  });

  it('has its board and seat from its own seed', () => {
    const state = freshGame();
    expect(state.world).toEqual(freshWorld(state.seed));
    expect(freshWorld(1)).not.toEqual(freshWorld(2));
  });
});

describe('sending an explorer', () => {
  it('needs Cartography, a free explorer, and a hex that is not home', () => {
    const state = freshGame();
    fund(state, { Gold: 1e9 });
    expect(dispatchExplorer(state, nextDoor(state), T0).kind).toBe('NoCartography');
    state.research.completed.push('Cartography');
    expect(explorerSlots(state)).toBe(WORLD.cartographyExplorers);
    expect(dispatchExplorer(state, -1, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, BOARD_SIZE, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, homeIndex(state), T0).kind).toBe('Home');
    const trip = sent(state, nextDoor(state), T0);
    const busy = dispatchExplorer(state, nextDoor(state), T0);
    expect(busy).toEqual({ kind: 'NoExplorerFree', nextFreeAt: returnsAt(trip) });
  });

  it('goes only where it has seen the way, to a hex it has at least sensed', () => {
    const state = exploring();
    // Across the board, sensed but with no way there seen.
    const across = rim(state);
    const span = hexDistance(hexAt(across), hexAt(homeIndex(state)));
    setBit(state.world.revealed, boardNeighbors(across).find((n) => hexDistance(hexAt(n), hexAt(homeIndex(state))) === span - 1)!);
    expect(fogStateOf(state, across, T0)).toBe('Sensed');
    expect(dispatchExplorer(state, across, T0).kind).toBe('NoRoute');
    state.world.revealed = bitsFrom([]);
    const far = hexIndex({ q: 0, r: -5 });
    expect(fogStateOf(state, far, T0)).toBe('Unknown');
    expect(dispatchExplorer(state, far, T0).kind).toBe('NoRoute');
    seenMost(state);
    expect(dispatchExplorer(state, portal, T0).kind).toBe('Explored');
    const edge = boardOf(state.world.board).hexes.find((h) => fogStateOf(state, h.index, T0) === 'Sensed')!;
    expect(dispatchExplorer(state, edge.index, T0).kind).toBe('Sent');
  });

  it('has nothing to explore where it has already seen', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    advance(state, map, returnsAt(trip));
    expect(dispatchExplorer(state, nextDoor(state), returnsAt(trip)).kind).toBe('Explored');
    expect(dispatchExplorer(state, portal, returnsAt(trip)).kind).toBe('Explored');
  });

  it('takes the quickest way through explored ground, every hex timed as it is left', () => {
    const state = exploring();
    seenMost(state);
    const target = rim(state);
    const trip = sent(state, target, T0);
    const fog = worldFogAt(state, T0);
    expect(trip.path[0]).toBe(homeIndex(state));
    expect(trip.path.at(-1)).toBe(target);
    expect(trip.path.slice(0, -1).every((i) => hasBit(fog, i))).toBe(true);
    const hexes = boardOf(state.world.board).hexes;
    expect(trip.stepMs).toEqual(stepTimes(hexes, trip.path, 'explorer'));
    expect(trip.stepMs[0]).toBe(WORLD.explorerSecondsPerHex * 1000); // the city is open ground
    expect(arrivesAt(trip) - T0).toBe(outboundMs(trip.stepMs));
    expect(revealsAt(trip) - arrivesAt(trip)).toBe(trip.workMs);
    expect(returnsAt(trip) - revealsAt(trip)).toBe(homeboundMs(trip.stepMs));
    // No way through the seen ground is quicker: a straight line of open ground
    // is the floor.
    const d = hexDistance(hexAt(homeIndex(state)), hexAt(target));
    expect(outboundMs(trip.stepMs)).toBeGreaterThanOrEqual(d * WORLD.explorerSecondsPerHex * 1000);
  });

  it('costs Gold when it leaves, dearer the further the hex lies, and refuses a short purse', () => {
    const state = exploring();
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
    expect(exploreWorkMs(state, portal)).toBe((WORLD.exploreWorkSeconds + 4 * WORLD.exploreWorkSecondsPerHex) * 1000);
    expect(sent(state, near, T0).workMs).toBe(exploreWorkMs(state, near));
  });

  it('marches faster with the Scout, and never slower', () => {
    const state = exploring();
    seenMost(state);
    expect(explorerSpeed(state)).toBe(1);
    const slow = explorerRoute(state, rim(state), T0)!;
    grantHero(state, 'Scout');
    const quick = explorerRoute(state, rim(state), T0)!;
    const v = HEROES.Scout.boon!.value;
    expect(quick.path).toEqual(slow.path);
    expect(quick.stepMs).toEqual(slow.stepMs.map((ms) => Math.round(ms / v)));
  });
});

describe('what a march reveals', () => {
  it('reveals nothing on the way, then a disc round the hex once its work there is done', () => {
    const state = exploring();
    const target = nextDoor(state);
    const trip = sent(state, target, T0);
    const start = bitIndices(worldFogAt(state, T0));
    expect(start).toEqual([homeIndex(state), portal].sort((a, b) => a - b));

    const disc = [...new Set([homeIndex(state), portal, ...boardWithin(target, trip.radius)])].sort((a, b) => a - b);
    expect(bitIndices(worldFogAt(state, arrivesAt(trip)))).toEqual(start);
    expect(bitIndices(worldFogAt(state, revealsAt(trip) - 1))).toEqual(start);
    expect(bitIndices(worldFogAt(state, revealsAt(trip)))).toEqual(disc);
    // The way home reaches nothing new.
    expect(bitIndices(worldFogAt(state, returnsAt(trip) - 1))).toEqual(disc);
  });

  it('frees its slot the moment it is home, and keeps what it saw', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    const seen = worldFogAt(state, revealsAt(trip));

    let r = advance(state, map, returnsAt(trip) - 1);
    expect(state.world.explorers).toHaveLength(1);
    expect(r.explorersHome).toEqual([]);

    r = advance(state, map, returnsAt(trip));
    expect(state.world.explorers).toHaveLength(0);
    expect(r.explorersHome).toHaveLength(1);
    expect(r.explorersHome[0]).toMatchObject({ id: trip.id, target: nextDoor(state) });
    expect(r.explorersHome[0].revealed).toBe(bitIndices(seen).length - 2);
    expect(worldFogAt(state, returnsAt(trip) + HOUR)).toEqual(seen);
    // The city and the Portal are never stored.
    expect(bitIndices(state.world.revealed)).not.toContain(portal);
    expect(bitIndices(state.world.revealed)).not.toContain(homeIndex(state));
    const further = boardOf(state.world.board).hexes.find((h) => fogStateOf(state, h.index, returnsAt(trip)) === 'Sensed')!;
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
      sent(state, nextDoor(state), T1);
      to(second);
      // The furthest hex it has sensed by then, through what the first saw.
      const home = hexAt(homeIndex(state));
      const fog = worldFogAt(state, second);
      const sensed = boardOf(state.world.board).hexes
        .filter((h) => fogStateOf(state, h.index, second, fog) === 'Sensed')
        .sort((a, b) => hexDistance(home, b.hex) - hexDistance(home, a.hex) || a.index - b.index);
      expect(hexDistance(home, sensed[0].hex)).toBeGreaterThan(1);
      sent(state, sensed[0].index, second);
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

  it('keeps an explorer on the road through a reload, and brings it home on the next', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    const mid = arrivesAt(trip) + 1;
    advance(state, map, mid);

    const { loaded: onTheRoad } = reload(state, mid, mid);
    expect(onTheRoad.world).toEqual(state.world);
    expect(worldFogAt(onTheRoad, mid)).toEqual(worldFogAt(state, mid));

    const { loaded: home, report } = reload(state, mid, returnsAt(trip) + HOUR);
    expect(home.world.explorers).toEqual([]);
    expect(worldFogAt(home, returnsAt(trip))).toEqual(worldFogAt(state, revealsAt(trip)));
    expect(report!.result.explorersHome.map((e) => e.id)).toEqual([trip.id]);
  });

  it('gives a save from before the world board the world its seed would have', () => {
    const state = freshGame();
    const file = serialize(state, T0);
    delete (file.Modules as Record<string, unknown>)['kingdom.world'];
    file.SaveVersion = 74;
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world).toEqual(freshWorld(state.seed));
  });

  it('reads a trip saved before travel was timed hex by hex at its old pace, with no work', () => {
    const state = exploring();
    const trip = sent(state, nextDoor(state), T0);
    const file = serialize(state, T0);
    const saved = (file.Modules as Record<string, any>)['kingdom.world'].Explorers[0];
    delete saved.StepMs;
    delete saved.WorkMs;
    saved.MsPerHex = 600_000;
    file.SaveVersion = 77;
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world.explorers[0]).toEqual({ ...trip, stepMs: [600_000, 600_000], workMs: 0 });
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
