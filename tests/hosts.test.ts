// A relic's host (sim/hosts.ts; Docs/features/09-relics.md §2): a restored
// city relic acts over the aura of the Shrine that holds it, and only while
// it is ACTIVATED — Mana paid, a window as long as the relic's level allows.

import { beforeEach, describe, expect, it } from 'vitest';
import { castState } from '../src/sim/casting';
import { advance, moveDistrict } from '../src/sim/commands';
import { CITY_RELIC_LEVELS } from '../src/sim/data/definitions';
import { cityRelicSteps, nextCityRelicAxis, passiveValueAtLevel, relicWindowMsAt } from '../src/sim/artifacts';
import {
  activateBlock, activateRelic, activationCost, auraOf, auraRadiusAt, hostOf, hostRelic,
  isAwake, relicAura, unhostRelic,
} from '../src/sim/hosts';
import { mana } from '../src/sim/mana';
import { areaCovers } from '../src/sim/modifiers';
import { houseGoldPerMinute } from '../src/sim/population';
import { deserialize, serialize } from '../src/sim/save';
import { districtAt, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, fund, map, reveal, T0 } from './helpers';

const MIN = 60_000;
const WINDOWS = CITY_RELIC_LEVELS.windowMinutes;

/** The first level of the Crown at which `moved` holds. */
const firstLevel = (moved: (level: number) => boolean): number => {
  for (let l = 2; l < 100; l++) if (moved(l)) return l;
  throw new Error('never');
};

/** A built Shrine at `at`. */
function shrine(state: GameState, id: string, at: { x: number; y: number }): void {
  state.city.districts.push({
    uniqueId: id, definitionId: 'Shrine', ordinal: 9, level: 1, assignedWorkers: 0,
    location: at, state: 'Built', visualVariant: 1,
  });
}

// A CITY RELIC GROWS ROUND A CYCLE (09-relics.md §2.1): every level-up from
// level 2 raises one of its window, its reach and its number, in turn.
describe('a city relic levels round its cycle', () => {
  const { cycle } = CITY_RELIC_LEVELS;

  it('names each axis once', () => {
    expect([...cycle].sort()).toEqual(['effect', 'radius', 'window']);
  });

  it('starts at the first window, its authored reach and its base number', () => {
    expect(relicWindowMsAt('GildedLedger', 1)).toBe(WINDOWS[0]! * MIN);
    expect(cityRelicSteps('GildedLedger', 1)).toEqual({ window: 0, radius: 0, effect: 0 });
  });

  // Every level is worth having: each raises exactly one axis, and a window
  // step past the last authored window raises the number instead.
  it('raises exactly one axis a level, round the cycle, for ever', () => {
    for (let level = 1; level < 60; level++) {
      const now = cityRelicSteps('GildedLedger', level);
      const next = cityRelicSteps('GildedLedger', level + 1);
      const moved = (['window', 'radius', 'effect'] as const).filter((a) => next[a] !== now[a]);
      expect(moved, `level ${level + 1}`).toEqual([nextCityRelicAxis('GildedLedger', level)]);
      const due = cycle[(level - 1) % cycle.length];
      const windowFull = due === 'window' && now.window >= WINDOWS.length - 1;
      expect(moved[0], `level ${level + 1}`).toBe(windowFull ? 'effect' : due);
    }
  });

  it('reads each axis where the game reads it', () => {
    const at = (axis: 'window' | 'radius' | 'effect') => firstLevel((l) => cityRelicSteps('GildedLedger', l)[axis] > 0);
    expect(relicWindowMsAt('GildedLedger', at('window'))).toBe(WINDOWS[1]! * MIN);
    expect(auraRadiusAt('GildedLedger', at('radius'))).toBe(auraRadiusAt('GildedLedger', 1) + 1);
    expect(passiveValueAtLevel('GildedLedger', at('effect'))).toBeGreaterThan(passiveValueAtLevel('GildedLedger', 1));
    // The two a level leaves alone stay where they were.
    expect(passiveValueAtLevel('GildedLedger', at('window'))).toBe(passiveValueAtLevel('GildedLedger', 1));
    expect(relicWindowMsAt('GildedLedger', at('radius'))).toBe(relicWindowMsAt('GildedLedger', at('window')));
  });

  it('stops the window at its last entry', () => {
    expect(relicWindowMsAt('GildedLedger', 500)).toBe(WINDOWS[WINDOWS.length - 1]! * MIN);
  });

  // A world relic has no cycle: every level is its number.
  it('leaves a world relic climbing its number every level', () => {
    expect(nextCityRelicAxis('MusterHorn', 3)).toBeNull();
    expect(passiveValueAtLevel('MusterHorn', 3)).toBeGreaterThan(passiveValueAtLevel('MusterHorn', 2));
  });
});

describe('a city relic is hosted in a Shrine', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels.GildedLedger = 1;
    shrine(state, 'a', { x: 0, y: 0 });
    shrine(state, 'b', { x: 6, y: 0 });
  });

  it('refuses a relic not restored, and a host that is not a Shrine', () => {
    expect(hostRelic(state, 'DowsingRod', 'a', T0)).toBe('NotRestored');
    state.artifacts.levels.MusterHorn = 1;
    expect(hostRelic(state, 'MusterHorn', 'a', T0)).toBe('NotACityRelic');
    expect(hostRelic(state, 'GildedLedger', 'nowhere', T0)).toBe('NotAShrine');
  });

  it('has one host: hosting it again moves it', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    hostRelic(state, 'GildedLedger', 'b', T0);
    expect(hostOf(state, 'GildedLedger')?.uniqueId).toBe('b');
    expect(state.city.districts.find((d) => d.uniqueId === 'a')!.hosts).toBeUndefined();
  });

  // Hosting is free and does nothing on its own: the effect waits for Mana.
  it('does nothing while it sleeps, hosted or not', () => {
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 })).toEqual({ add: 0, mul: 1 });
    hostRelic(state, 'GildedLedger', 'a', T0);
    expect(isAwake(state, 'GildedLedger')).toBe(false);
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 })).toEqual({ add: 0, mul: 1 });
  });
});

describe('activating a hosted relic', () => {
  let state: GameState;
  beforeEach(() => {
    state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels.GildedLedger = 1;
    fund(state, { Mana: 999 });
    shrine(state, 'a', { x: 0, y: 0 });
    shrine(state, 'b', { x: 6, y: 0 });
  });

  it('needs a Shrine, and the Mana', () => {
    expect(activateBlock(state, 'GildedLedger')).toBe('NotHosted');
    hostRelic(state, 'GildedLedger', 'a', T0);
    fund(state, { Mana: -mana(state) });
    const before = mana(state);
    expect(activateRelic(state, 'GildedLedger', T0)).toBe('NotEnoughMana');
    expect(mana(state)).toBe(before);
    expect(isAwake(state, 'GildedLedger')).toBe(false);
  });

  it('charges its Mana once and wakes the aura', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    const before = mana(state);
    expect(activateRelic(state, 'GildedLedger', T0)).toBe('Activated');
    expect(mana(state)).toBe(before - activationCost(state, 'GildedLedger'));
    expect(activationCost(state, 'GildedLedger')).toBeGreaterThan(0);
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 }).mul).toBeGreaterThan(1);
    // Awake is awake: a second activation is refused, and charges nothing.
    expect(activateRelic(state, 'GildedLedger', T0 + 1)).toBe('Active');
    expect(mana(state)).toBe(before - activationCost(state, 'GildedLedger'));
  });

  // THE RELIC'S LEVEL IS THE DURATION: the Shrine adds nothing of its own.
  it('lasts its own window, whichever Shrine holds it', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    expect(state.artifacts.casts.GildedLedger!.endsAt).toBe(T0 + WINDOWS[0]! * MIN);
    unhostRelic(state, 'GildedLedger', T0);
    state.artifacts.levels.GildedLedger = firstLevel((l) => relicWindowMsAt('GildedLedger', l) > WINDOWS[0]! * MIN);
    hostRelic(state, 'GildedLedger', 'b', T0);
    activateRelic(state, 'GildedLedger', T0);
    expect(state.artifacts.casts.GildedLedger!.endsAt).toBe(T0 + WINDOWS[1]! * MIN);
  });

  // Priced when it opens: a level-up mid-window does not stretch it.
  it('keeps the window it was priced at when the relic climbs', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    state.artifacts.levels.GildedLedger = 20;
    expect(state.artifacts.casts.GildedLedger!.endsAt).toBe(T0 + WINDOWS[0]! * MIN);
  });

  // THE RELIC'S LEVEL IS THE POWER too: its number, and how far the aura reaches.
  it('reaches further and hits harder as the relic climbs', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    const r1 = auraRadiusAt('GildedLedger', 1);
    const edge = { x: r1 + 1, y: 0 };
    const weak = relicAura(state, 'taxRate', { x: 1, y: 0 }).mul;
    expect(relicAura(state, 'taxRate', edge).mul).toBe(1);
    state.artifacts.levels.GildedLedger = firstLevel((l) =>
      auraRadiusAt('GildedLedger', l) > r1 && passiveValueAtLevel('GildedLedger', l) > passiveValueAtLevel('GildedLedger', 1));
    expect(auraRadiusAt('GildedLedger', state.artifacts.levels.GildedLedger)).toBe(r1 + 1);
    expect(relicAura(state, 'taxRate', edge).mul).toBeGreaterThan(1);
    expect(relicAura(state, 'taxRate', { x: 1, y: 0 }).mul).toBeGreaterThan(weak);
  });

  it('reaches its Shrine and the ring round it, and no further', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    const r = auraRadiusAt('GildedLedger', 1);
    expect(relicAura(state, 'taxRate', { x: r, y: r }).mul).toBeGreaterThan(1);
    expect(relicAura(state, 'taxRate', { x: r + 1, y: r + 1 }).mul).toBe(1);
  });

  // RULE 3: a relic that leaves its Shrine loses the window it had running.
  it('falls asleep when it is taken out', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    expect(unhostRelic(state, 'GildedLedger', T0)).toBe(true);
    expect(isAwake(state, 'GildedLedger')).toBe(false);
    expect(relicAura(state, 'taxRate', { x: 1, y: 1 }).mul).toBe(1);
  });

  // RULE 2: where one relic's auras overlap the stronger counts — never both.
  it('counts once where two of its auras would overlap', () => {
    hostRelic(state, 'GildedLedger', 'a', T0);
    activateRelic(state, 'GildedLedger', T0);
    const once = relicAura(state, 'taxRate', { x: 2, y: 1 }).mul;
    // A second Shrine wrongly claiming the same relic still adds nothing.
    shrine(state, 'c', { x: 4, y: 0 });
    state.city.districts.find((d) => d.uniqueId === 'c')!.hosts = 'GildedLedger';
    expect(relicAura(state, 'taxRate', { x: 2, y: 1 }).mul).toBe(once);
  });
});

describe('a window is a boundary', () => {
  /** A Tribute Crown awake over one house, in a Shrine clear of the Townhall. */
  const crowned = (): GameState => {
    const state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels.GildedLedger = 1;
    fund(state, { Mana: 999 });
    reveal(state, [{ x: 3, y: 3 }, { x: 4, y: 3 }]);
    shrine(state, 'a', { x: 3, y: 3 });
    addBuilt(state, 'Housing', { x: 4, y: 3 });
    state.city.population = 8;
    hostRelic(state, 'GildedLedger', 'a', T0);
    expect(activateRelic(state, 'GildedLedger', T0)).toBe('Activated');
    return state;
  };

  // RULE 4: rent is priced house by house, so a house inside the aura pays more
  // — and only while the window is open.
  it('raises the rent inside the aura until the window closes', () => {
    const state = crowned();
    const house = districtAt(state, { x: 4, y: 3 })!;
    const awake = houseGoldPerMinute(state, house);
    advance(state, map, T0 + WINDOWS[0]! * MIN + 1);
    expect(isAwake(state, 'GildedLedger')).toBe(false);
    expect(houseGoldPerMinute(state, house)).toBeLessThan(awake);
    // No cooldown: it can be woken again at once.
    expect(castState(state, 'GildedLedger', T0 + WINDOWS[0]! * MIN + 1).phase).toBe('Ready');
    expect(activateRelic(state, 'GildedLedger', T0 + WINDOWS[0]! * MIN + 1)).toBe('Activated');
  });

  // INVARIANT 1: one call across the close equals stepped ticking. Minute
  // steps, as tests/taxes.test.ts: rent's carry drifts a millisecond on
  // steps that land on no whole Gold, with or without a relic.
  it('closes at the same instant in one call and in steps', () => {
    const end = T0 + 2 * WINDOWS[0]! * MIN;
    const once = crowned();
    advance(once, map, end);
    const stepped = crowned();
    for (let t = T0 + MIN; t < end; t += MIN) advance(stepped, map, t);
    advance(stepped, map, end);
    expect(serialize(stepped, end)).toEqual(serialize(once, end));
  });

  it('survives a save', () => {
    const state = crowned();
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.artifacts.casts.GildedLedger).toEqual(state.artifacts.casts.GildedLedger);
    expect(isAwake(back, 'GildedLedger')).toBe(true);
  });

  // The aura is read from where the Shrine stands, so a move carries it,
  // window and all.
  it('follows its Shrine when it moves', () => {
    const state = crowned();
    reveal(state, [{ x: 3, y: 6 }]);
    expect(moveDistrict(state, map, 'a', { x: 3, y: 6 }, T0 + 1000)).toBe('Moved');
    expect(isAwake(state, 'GildedLedger')).toBe(true);
    const host = hostOf(state, 'GildedLedger')!;
    expect(areaCovers(auraOf(state, host, 'GildedLedger'), { x: 3, y: 6 })).toBe(true);
  });
});
