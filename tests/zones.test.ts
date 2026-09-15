// ZONES — a relic's active, which is a modifier with a centre
// (Docs/features/09-relics.md §2.1).
//
// A zone is not a new system. It is the modifier stack plus a place, which
// means it inherits expiry-as-a-boundary, pruning, the save key and the
// defined fold order for free. What it must NOT inherit is reach: a zone that
// leaked into `resolve()` would apply to the whole kingdom, and that is the
// one bug this file exists to make impossible.

import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { HARVEST } from '../src/sim/data/definitions';
import { effectiveRecoveryMs } from '../src/sim/harvest';
import {
  activeZones, addModifier, areaCovers, resolve, resolveAt, type Modifier,
} from '../src/sim/modifiers';
import { deserialize, serialize } from '../src/sim/save';
import { workerStrikeMs, effectiveWorkerSpeed } from '../src/sim/upgrades';
import { districtAt, type Coord, type GameState } from '../src/sim/state';
import { addBuilt, freshGame, map, T0 } from './helpers';

const CENTRE: Coord = { x: 0, y: 0 };

/** A zone of `radius` on `stat`, standing for `minutes`. */
const zone = (
  state: GameState, stat: Modifier['stat'], value: number,
  centre: Coord = CENTRE, radius = 2, minutes = 10,
): void => {
  addModifier(state, {
    id: `zone:${stat}`, source: 'artifact', stat, scope: null, op: 'mul',
    value, expiresAt: T0 + minutes * 60_000, area: { centre, radius },
  });
};

describe('a zone is a modifier with a centre', () => {
  it('covers a Chebyshev square, inclusive of the centre', () => {
    const area = { centre: CENTRE, radius: 2 };
    expect(areaCovers(area, CENTRE)).toBe(true);
    expect(areaCovers(area, { x: 2, y: 2 })).toBe(true);   // the corner is in
    expect(areaCovers(area, { x: -2, y: 2 })).toBe(true);
    expect(areaCovers(area, { x: 3, y: 0 })).toBe(false);
    expect(areaCovers(area, { x: 2, y: 3 })).toBe(false);
    // Chebyshev, not Euclidean: the corner of the square is inside, which a
    // circle of the same radius would exclude.
    expect(areaCovers({ centre: CENTRE, radius: 0 }, CENTRE)).toBe(true);
    expect(areaCovers({ centre: CENTRE, radius: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  // THE ASYMMETRY IS THE SAFETY. Every number in the game that is not about a
  // place still calls `resolve()`, so a zone must be invisible there — or the
  // Foreman's Sigil's 5×5 would speed up the whole kingdom's crews.
  it('is invisible to the cell-blind read and visible to the placed one', () => {
    const state = freshGame();
    zone(state, 'workerStrikeSpeed', 3);
    expect(resolve(state, 'workerStrikeSpeed', 1)).toBe(1);
    expect(resolveAt(state, 'workerStrikeSpeed', 1, CENTRE)).toBe(3);
    expect(resolveAt(state, 'workerStrikeSpeed', 1, { x: 9, y: 9 })).toBe(1);
  });

  // And the converse: a global modifier is read by BOTH, so a relic's passive
  // still reaches a call site that happens to know where it is.
  it('lets a global modifier through the placed read too', () => {
    const state = freshGame();
    addModifier(state, {
      id: 'passive', source: 'artifact', stat: 'workerStrikeSpeed', scope: null,
      op: 'mul', value: 2, expiresAt: null,
    });
    expect(resolve(state, 'workerStrikeSpeed', 1)).toBe(2);
    expect(resolveAt(state, 'workerStrikeSpeed', 1, { x: 9, y: 9 })).toBe(2);
  });

  // Zones overlap freely and multiply: the cooldown is what stops a player
  // carpeting the map, so an overlap is a choice rather than a rule to police.
  it('multiplies where two zones overlap', () => {
    const state = freshGame();
    zone(state, 'recoverySpeed', 2, { x: 0, y: 0 });
    addModifier(state, {
      id: 'zone:second', source: 'artifact', stat: 'recoverySpeed', scope: null,
      op: 'mul', value: 3, expiresAt: T0 + 600_000, area: { centre: { x: 1, y: 0 }, radius: 2 },
    });
    expect(resolveAt(state, 'recoverySpeed', 1, { x: 1, y: 0 })).toBe(6); // both
    expect(resolveAt(state, 'recoverySpeed', 1, { x: -2, y: 0 })).toBe(2); // the first only
    expect(resolveAt(state, 'recoverySpeed', 1, { x: 3, y: 0 })).toBe(3);  // the second only
  });

  it('lists what is standing, and stops listing it when the window closes', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    zone(state, 'recoverySpeed', 5, CENTRE, 2, 10);
    expect(activeZones(state)).toHaveLength(1);
    state.lastAdvance = T0 + 10 * 60_000;   // half-open: gone AT the instant
    expect(activeZones(state)).toHaveLength(0);
  });
});

describe('a zone reaches the numbers that belong to a place', () => {
  // The Dowsing Rod: recovery runs faster inside the zone. The wait is stamped
  // ONCE, when the cell exhausts, so what the zone buys is the cells that
  // empty inside it — never a retroactive wake-up of a cell already waiting.
  it('shortens a recovery stamped inside it, and not one stamped outside', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    const plain = effectiveRecoveryMs(state, HARVEST.Forest, CENTRE);
    zone(state, 'recoverySpeed', 5, CENTRE, 2);
    expect(effectiveRecoveryMs(state, HARVEST.Forest, CENTRE)).toBe(Math.round(plain / 5));
    expect(effectiveRecoveryMs(state, HARVEST.Forest, { x: 9, y: 9 })).toBe(plain);
  });

  // The Foreman's Sigil: read at the BUILDING, never at the cell. A worker
  // walks, so a zone asking where it was standing would flicker as it crossed
  // the edge — and travel is Euclidean while a zone is Chebyshev.
  it('speeds the crew of a building inside it, swing and walk alike', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    addBuilt(state, 'Sawmill', { x: 0, y: 0 });
    addBuilt(state, 'Sawmill', { x: 9, y: 9 });
    const inside = districtAt(state, { x: 0, y: 0 })!;
    const outside = districtAt(state, { x: 9, y: 9 })!;
    const swing = workerStrikeMs(state, HARVEST.Forest, inside);
    const walk = effectiveWorkerSpeed(state, inside.location);

    zone(state, 'workerStrikeSpeed', 3, CENTRE, 2);
    zone(state, 'workerSpeed', 3, CENTRE, 2);
    expect(workerStrikeMs(state, HARVEST.Forest, inside)).toBeLessThan(swing);
    expect(effectiveWorkerSpeed(state, inside.location)).toBeGreaterThan(walk);
    // The far Sawmill's crew is untouched, and so is the kingdom's own pace.
    expect(workerStrikeMs(state, HARVEST.Forest, outside)).toBe(swing);
    expect(effectiveWorkerSpeed(state)).toBe(walk);
  });
});

describe('a zone is a boundary, and it survives a save', () => {
  // INVARIANT 1. A zone's expiry is already a boundary because it is a
  // modifier's `expiresAt`, so this asserts the thing that would break if a
  // zone ever grew its own clock: one-call replay equals stepped ticking.
  it('expires at the same instant in one call and in steps', () => {
    const walk = (steps: number): number => {
      const state = freshGame();
      state.lastAdvance = T0;
      addBuilt(state, 'Sawmill', { x: 0, y: 0 });
      zone(state, 'workerStrikeSpeed', 4, CENTRE, 2, 10);
      const end = T0 + 30 * 60_000;
      for (let i = 1; i <= steps; i++) advance(state, map, T0 + ((end - T0) * i) / steps);
      return state.modifiers.length;
    };
    expect(walk(1)).toBe(walk(60));
    expect(walk(1)).toBe(0);      // pruned by the boundary, either way
  });

  it('round-trips its centre and radius through a save', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    zone(state, 'recoverySpeed', 5, { x: 3, y: -4 }, 3);
    const back = deserialize(serialize(state, T0), map, T0)!;
    const z = back.modifiers.find((m) => m.area !== undefined)!;
    expect(z.area).toEqual({ centre: { x: 3, y: -4 }, radius: 3 });
    expect(resolveAt(back, 'recoverySpeed', 1, { x: 6, y: -4 })).toBe(5);
    expect(resolve(back, 'recoverySpeed', 1)).toBe(1);
  });

  // A save written before zones existed has no `Area` key at all, and its
  // modifiers must come back GLOBAL — `area: undefined`, never `null`, or
  // every one of them would read as a zone of radius NaN.
  it('reads a modifier with no area as a global one', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    addModifier(state, {
      id: 'old', source: 'season', stat: 'taxRate', scope: null,
      op: 'mul', value: 2, expiresAt: null,
    });
    const save = serialize(state, T0);
    const dto = (save.Modules['kingdom.modifiers'] as { Modifiers: any[] }).Modifiers;
    for (const m of dto) delete m.Area;          // as an older client wrote it
    const back = deserialize(save, map, T0)!;
    expect(back.modifiers.find((m) => m.id === 'old')!.area).toBeUndefined();
    expect(resolve(back, 'taxRate', 1)).toBe(2);
  });
});
