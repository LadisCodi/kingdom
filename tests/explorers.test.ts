// Explorers and the world fog (Docs/features/19-world-map.md §3).
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { WORLD } from '../src/sim/data/definitions';
import { deserialize, serialize, type CatchUpReport } from '../src/sim/save';
import type { GameState } from '../src/sim/state';
import { SEAT_INDICES } from '../src/sim/world/board';
import {
  arrivesAt, dispatchExplorer, explorerSlots, fogStateOf, freshWorld, homeIndex, marchMsPerHex,
  returnsAt, worldFogAt,
} from '../src/sim/world/explorers';
import { bitIndices, bitsFrom } from '../src/sim/world/fogBits';
import {
  BOARD_SIZE, HEX_DIRS, PORTAL_INDEX, boardNeighbors, boardWithin, hexAt, hexDistance, hexIndex,
} from '../src/sim/world/hex';
import { grantHero } from '../src/sim/heroes';
import { HEROES } from '../src/sim/data/definitions';
import { freshGame, map, T0 } from './helpers';

const MIN = 60_000;
const HOUR = 60 * MIN;
const STEP = WORLD.marchSecondsPerHex * 1000;

/** A kingdom that has researched Cartography: one explorer. */
function exploring(): GameState {
  const state = freshGame();
  state.research.completed.push('Cartography');
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
    expect(dispatchExplorer(state, portal, T0).kind).toBe('NoCartography');
    state.research.completed.push('Cartography');
    expect(explorerSlots(state)).toBe(WORLD.cartographyExplorers);
    expect(dispatchExplorer(state, -1, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, BOARD_SIZE, T0).kind).toBe('OffBoard');
    expect(dispatchExplorer(state, homeIndex(state), T0).kind).toBe('Home');
    const trip = sent(state, portal, T0);
    const busy = dispatchExplorer(state, portal, T0);
    expect(busy).toEqual({ kind: 'NoExplorerFree', nextFreeAt: returnsAt(trip) });
  });

  it('marches in a straight line, at a pace linear in hexes, out and back', () => {
    const state = exploring();
    const trip = sent(state, portal, T0);
    const d = hexDistance(hexAt(homeIndex(state)), hexAt(portal));
    expect(d).toBe(4);
    expect(trip.path).toHaveLength(d + 1);
    expect(trip.path[0]).toBe(homeIndex(state));
    expect(trip.path[d]).toBe(portal);
    expect(arrivesAt(trip) - T0).toBe(d * STEP);
    expect(returnsAt(trip) - T0).toBe(2 * d * STEP);
  });

  it('marches faster with the Scout, and never slower', () => {
    const state = exploring();
    expect(marchMsPerHex(state)).toBe(STEP);
    grantHero(state, 'Scout');
    expect(marchMsPerHex(state)).toBe(Math.round(STEP / HEROES.Scout.boon!.value));
  });
});

describe('what a march reveals', () => {
  it('reveals nothing as it leaves, then a disc round each hex it reaches', () => {
    const state = exploring();
    const trip = sent(state, portal, T0);
    const start = bitIndices(worldFogAt(state, T0));
    expect(start).toEqual([homeIndex(state), portal].sort((a, b) => a - b));

    const disc = (upTo: number) => {
      const out = new Set([homeIndex(state), portal]);
      for (let k = 1; k <= upTo; k++) for (const i of boardWithin(trip.path[k], trip.radius)) out.add(i);
      return [...out].sort((a, b) => a - b);
    };
    expect(bitIndices(worldFogAt(state, T0 + STEP - 1))).toEqual(start);
    expect(bitIndices(worldFogAt(state, T0 + STEP))).toEqual(disc(1));
    expect(bitIndices(worldFogAt(state, T0 + 3 * STEP + 1))).toEqual(disc(3));
    expect(bitIndices(worldFogAt(state, arrivesAt(trip)))).toEqual(disc(4));
    // The way home reaches nothing new.
    expect(bitIndices(worldFogAt(state, returnsAt(trip) - 1))).toEqual(disc(4));
  });

  it('frees its slot the moment it is home, and keeps what it saw', () => {
    const state = exploring();
    const trip = sent(state, portal, T0);
    const seen = worldFogAt(state, arrivesAt(trip));

    let r = advance(state, map, returnsAt(trip) - 1);
    expect(state.world.explorers).toHaveLength(1);
    expect(r.explorersHome).toEqual([]);

    r = advance(state, map, returnsAt(trip));
    expect(state.world.explorers).toHaveLength(0);
    expect(r.explorersHome).toHaveLength(1);
    expect(r.explorersHome[0]).toMatchObject({ id: trip.id, target: portal });
    expect(r.explorersHome[0].revealed).toBe(bitIndices(seen).length - 2);
    expect(worldFogAt(state, returnsAt(trip) + HOUR)).toEqual(seen);
    // The city and the Portal are never stored.
    expect(bitIndices(state.world.revealed)).not.toContain(portal);
    expect(bitIndices(state.world.revealed)).not.toContain(homeIndex(state));
    expect(dispatchExplorer(state, portal, returnsAt(trip)).kind).toBe('Sent');
  });
});

describe('one-call replay equals stepped ticking', () => {
  it('lands the same fog and the same kingdom over three days, a second trip sent midway', () => {
    const T1 = T0 + HOUR;
    const rim = hexIndex({ q: 0, r: -5 }); // across the board from most seats
    const second = T1 + 20 * HOUR;
    const end = T1 + 3 * 24 * HOUR;

    const play = (stepMs: number | null): GameState => {
      const state = exploring();
      const to = (t: number) => {
        if (stepMs === null) { advance(state, map, t); return; }
        while (state.lastAdvance < t) advance(state, map, Math.min(t, state.lastAdvance + stepMs));
      };
      to(T1);
      sent(state, portal, T1);
      to(second);
      sent(state, rim, second);
      to(end);
      return state;
    };

    const once = play(null);
    const stepped = play(7 * MIN + 13_000);
    expect(stepped.world).toEqual(once.world);
    expect(serialize(stepped, end)).toEqual(serialize(once, end));
    expect(once.world.explorers).toHaveLength(0);
    expect(bitIndices(once.world.revealed).length).toBeGreaterThan(10);
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
    const trip = sent(state, portal, T0);
    const mid = T0 + 2 * STEP + 1;
    advance(state, map, mid);

    const { loaded: onTheRoad } = reload(state, mid, mid);
    expect(onTheRoad.world).toEqual(state.world);
    expect(worldFogAt(onTheRoad, mid)).toEqual(worldFogAt(state, mid));

    const { loaded: home, report } = reload(state, mid, returnsAt(trip) + HOUR);
    expect(home.world.explorers).toEqual([]);
    expect(worldFogAt(home, returnsAt(trip))).toEqual(worldFogAt(state, arrivesAt(trip)));
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

  it('drops a trip that does not walk the board, and a broken fog', () => {
    const state = exploring();
    sent(state, portal, T0);
    const file = serialize(state, T0);
    const world = (file.Modules as Record<string, any>)['kingdom.world'];
    world.Explorers.push({ ...world.Explorers[0], ID: 'explorer_bad', Path: [0, 90] });
    world.Revealed = 'nope';
    const loaded = deserialize(file, map, T0)!;
    expect(loaded.world.explorers.map((e) => e.id)).toEqual([state.world.explorers[0].id]);
    expect(loaded.world.revealed).toEqual(bitsFrom([]));
  });
});
