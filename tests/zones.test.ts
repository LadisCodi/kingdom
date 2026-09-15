// ZONES — a relic's active, which is a modifier with a centre
// (Docs/features/09-relics.md §2.1).
//
// A zone is not a new system. It is the modifier stack plus a place, which
// means it inherits expiry-as-a-boundary, pruning, the save key and the
// defined fold order for free. What it must NOT inherit is reach: a zone that
// leaked into `resolve()` would apply to the whole kingdom, and that is the
// one bug this file exists to make impossible.

import { describe, expect, it } from 'vitest';
import { grantArtifactLevel } from '../src/sim/artifacts';
import {
  activeDurationMs, activeRadius, activeRadiusAt, cast, castBlock, castCost,
  castState, reapCells, tapBudget, tapRunSeconds,
} from '../src/sim/casting';
import { advance } from '../src/sim/commands';
import {
  ARTIFACT_AUTO_TAP_PER_SECOND, ARTIFACT_COOLDOWN_SECONDS, ARTIFACT_RADIUS_STEPS,
  HARVEST,
} from '../src/sim/data/definitions';
import { spellStatChanges, spellStatsAt } from '../src/ui/relicStats';
import { effectiveRecoveryMs } from '../src/sim/harvest';
import {
  activeZones, addModifier, areaCovers, resolve, resolveAt, type Modifier,
} from '../src/sim/modifiers';
import { deserialize, serialize } from '../src/sim/save';
import { workerStrikeMs, effectiveWorkerSpeed } from '../src/sim/upgrades';
import {
  addToWallet, districtAt, getWallet, type Coord, type GameState,
} from '../src/sim/state';
import {
  addBuilt, canGather, freshGame, fund, map, reveal, FOREST, T0,
} from './helpers';
import { cellsWithinRadius } from '../src/sim/grid';

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

// ---------------------------------------------------------------- the cycle

describe('an active walks ACTIVE → COOLDOWN → READY', () => {
  /** A relic in hand, with a 60-minute window on its ability. */
  const armed = (): GameState => {
    const state = freshGame();
    state.lastAdvance = T0;
    grantArtifactLevel(state, 'ForemansSigil');
    fund(state, { Mana: 999 });
    return state;
  };

  it('is READY before the first cast and never counts down', () => {
    const state = armed();
    expect(castState(state, 'ForemansSigil', T0)).toEqual({ phase: 'Ready', until: null });
    expect(castBlock(state, 'ForemansSigil', T0)).toBeNull();
  });

  // THE COOLDOWN IS COUNTED FROM THE WINDOW'S CLOSE. A 60-minute window on a
  // 5-minute cooldown counted from the CAST would be 100% uptime, which is no
  // cooldown at all — so the relic is busy for the window AND the wait after.
  it('is ACTIVE for its window and only then starts resting', () => {
    const state = armed();
    const window = activeDurationMs('ForemansSigil');
    expect(window).toBeGreaterThan(0);
    expect(cast(state, map, 'ForemansSigil', null, T0).result).toBe('Cast');

    expect(castState(state, 'ForemansSigil', T0 + 1).phase).toBe('Active');
    expect(castState(state, 'ForemansSigil', T0 + window - 1).phase).toBe('Active');
    expect(castState(state, 'ForemansSigil', T0 + window).phase).toBe('Cooldown');
    const rest = ARTIFACT_COOLDOWN_SECONDS * 1000;
    expect(castState(state, 'ForemansSigil', T0 + window + rest - 1).phase).toBe('Cooldown');
    expect(castState(state, 'ForemansSigil', T0 + window + rest).phase).toBe('Ready');
  });

  it('refuses a second cast while its own window is open, and while it rests', () => {
    const state = armed();
    const window = activeDurationMs('ForemansSigil');
    cast(state, map, 'ForemansSigil', null, T0);
    expect(castBlock(state, 'ForemansSigil', T0 + 1)).toBe('Active');
    expect(cast(state, map, 'ForemansSigil', null, T0 + 1).result).toBe('Active');
    expect(castBlock(state, 'ForemansSigil', T0 + window + 1)).toBe('OnCooldown');
    const ready = T0 + window + ARTIFACT_COOLDOWN_SECONDS * 1000;
    expect(castBlock(state, 'ForemansSigil', ready)).toBeNull();
    expect(cast(state, map, 'ForemansSigil', null, ready).result).toBe('Cast');
  });

  // The cycle is checked BEFORE the purse: a relic that is still running tells
  // the player to wait, not that they are poor.
  it('says it is running rather than that the player is poor', () => {
    const state = armed();
    cast(state, map, 'ForemansSigil', null, T0);
    addToWallet(state.city.wallet, 'Mana', -getWallet(state.city.wallet, 'Mana'));
    expect(castBlock(state, 'ForemansSigil', T0 + 1)).toBe('Active');
  });

  // A WINDOW SURVIVES A CLOSED TAB, because the zone it placed does. A relic
  // that came back READY while its own zone still stood would let the player
  // lay a second one on top of the first.
  it('carries both instants through a save', () => {
    const state = armed();
    cast(state, map, 'ForemansSigil', null, T0);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.artifacts.casts.ForemansSigil)
      .toEqual(state.artifacts.casts.ForemansSigil);
    expect(castState(back, 'ForemansSigil', T0 + 1).phase).toBe('Active');
  });

  // The cooldown gates a COMMAND, not an accrual — nothing in the sim
  // integrates differently across it — so, unlike a zone's expiry, it is
  // deliberately NOT a boundary. This asserts the sim does not need it to be.
  it('needs no boundary: one-call replay equals stepped ticking across it', () => {
    const walk = (steps: number): string => {
      const state = armed();
      cast(state, map, 'ForemansSigil', null, T0);
      const end = T0 + 120 * 60_000;
      for (let i = 1; i <= steps; i++) advance(state, map, T0 + ((end - T0) * i) / steps);
      return castState(state, 'ForemansSigil', end).phase;
    };
    expect(walk(1)).toBe('Ready');
    expect(walk(240)).toBe('Ready');
  });
});

// ------------------------------------------------------------- the radius

/**
 * THE ONE NUMBER OF AN ABILITY THAT STEPS RATHER THAN CREEPS
 * (Docs/features/09-relics.md §2.1). A Chebyshev radius covers (2r+1)² cells,
 * so each rung roughly DOUBLES the ground — which is why it is three named
 * levels and not a slope.
 */
describe('an ability reaches further at three named levels', () => {
  const RADIUS_RELIC = 'VerdantSeal';

  it('holds its base until the first step, then adds a ring at each', () => {
    const base = activeRadiusAt(RADIUS_RELIC, 1);
    expect(base).toBeGreaterThan(0);
    for (let level = 1; level < ARTIFACT_RADIUS_STEPS[0]!; level++) {
      expect(activeRadiusAt(RADIUS_RELIC, level), `level ${level}`).toBe(base);
    }
    ARTIFACT_RADIUS_STEPS.forEach((at, i) => {
      expect(activeRadiusAt(RADIUS_RELIC, at), `level ${at}`).toBe(base + i + 1);
      expect(activeRadiusAt(RADIUS_RELIC, at - 1), `level ${at - 1}`).toBe(base + i);
    });
  });

  // MONOTONE AND BOUNDED. It only ever climbs, and it stops climbing once the
  // last rung is behind it — a relic at level 500 is not a relic that covers
  // the map.
  it('never falls, and stops at the last rung', () => {
    let last = 0;
    for (let level = 1; level <= 60; level++) {
      const r = activeRadiusAt(RADIUS_RELIC, level);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    const top = ARTIFACT_RADIUS_STEPS[ARTIFACT_RADIUS_STEPS.length - 1]!;
    expect(activeRadiusAt(RADIUS_RELIC, 500)).toBe(activeRadiusAt(RADIUS_RELIC, top));
  });

  // A STEP LADDER ON A SPELL THAT IS NOT AN AREA would be three rungs of
  // nothing, so a radius of 0 stays 0 at every level.
  it('leaves an ability with no area alone', () => {
    expect(activeRadiusAt('DowsingRod', 1)).toBe(0);
    expect(activeRadiusAt('DowsingRod', 50)).toBe(0);
  });

  // THE CARD IS NOT ALLOWED TO LIE. What the tile says the reach is has to be
  // what the cast actually covers.
  it('is what the cast really touches', () => {
    const state = freshGame();
    state.lastAdvance = T0;
    state.artifacts.levels[RADIUS_RELIC] = ARTIFACT_RADIUS_STEPS[0]!;
    expect(activeRadius(state, RADIUS_RELIC))
      .toBe(activeRadiusAt(RADIUS_RELIC, ARTIFACT_RADIUS_STEPS[0]!));
    // And the band the page prints reads the same ladder.
    const before = spellStatsAt(RADIUS_RELIC, ARTIFACT_RADIUS_STEPS[0]! - 1);
    const after = spellStatsAt(RADIUS_RELIC, ARTIFACT_RADIUS_STEPS[0]!);
    expect(after.find((s) => s.key === 'radius')!.value)
      .not.toBe(before.find((s) => s.key === 'radius')!.value);
  });

  // The COOLDOWN is on the band and never moves — which is the design saying
  // so, not a row going missing.
  it('never shortens the cooldown, at any level', () => {
    const cd = (level: number) =>
      spellStatsAt(RADIUS_RELIC, level).find((s) => s.key === 'cooldown')!.value;
    expect(cd(1)).toBe(cd(50));
    expect(spellStatChanges(RADIUS_RELIC, 1).find((s) => s.key === 'cooldown')!.changed)
      .toBe(false);
  });
});

// ----------------------------------------------------------- the auto-tap

/**
 * THE SPELL IS AN EXCHANGE RATE (Docs/features/09-relics.md §2.1): a cast buys
 * TAPS with its Mana, and what the level moves is how many each Mana is worth.
 *
 * It is the one exception to *every player tap costs 1 Mana* — thirty taps at
 * a Mana each would be impossible — and the exception is the design.
 */
describe('an auto-tap spell buys taps with the Mana of the cast', () => {
  const REAPER = 'VerdantSeal';

  /** A kingdom that can harvest, holding the Seal at `level`. */
  const reaper = (level: number): GameState => {
    const state = canGather(freshGame());
    // A zone needs GROUND to spend on: `canGather` clears three cells, and a
    // run over one node is a run that proves nothing about round robin.
    reveal(state, cellsWithinRadius(map, FOREST, 2));
    state.lastAdvance = T0;
    state.artifacts.levels[REAPER] = level;
    fund(state, { Mana: 999 });
    return state;
  };

  it('buys more taps per Mana at every level', () => {
    const one = tapBudget(reaper(1), REAPER);
    expect(one).toBeGreaterThan(0);
    let last = one;
    for (let level = 2; level <= 20; level++) {
      const now = tapBudget(reaper(level), REAPER);
      expect(now, `level ${level}`).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(last).toBeGreaterThan(one);
  });

  // THE WINDOW IS DERIVED, never authored: a window is what a budget looks
  // like at a speed, so authoring it beside the budget would be two numbers
  // that can disagree.
  it('derives the window from the budget and the rate', () => {
    const state = reaper(5);
    expect(tapRunSeconds(state, REAPER))
      .toBeCloseTo(tapBudget(state, REAPER) / ARTIFACT_AUTO_TAP_PER_SECOND);
  });

  // A relic whose ability is not an auto-tap buys NO taps — zero means "this
  // spell does not buy taps" rather than "it buys none of them".
  it('buys nothing for a spell that is not one', () => {
    expect(tapBudget(reaper(9), 'DowsingRod')).toBe(0);
    expect(tapBudget(reaper(9), 'ForemansSigil')).toBe(0);
  });

  it('harvests, and charges no Mana for the taps it lands', () => {
    const state = reaper(1);
    const before = getWallet(state.city.wallet, 'Wood');
    const pool = getWallet(state.city.wallet, 'Mana');
    const cost = castCost(state, REAPER);

    const report = cast(state, map, REAPER, FOREST, T0);
    expect(report.result).toBe('Cast');
    expect(report.taps).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThan(before);
    // The CAST was paid for and nothing else: the taps themselves are free.
    expect(getWallet(state.city.wallet, 'Mana')).toBe(pool - cost);
  });

  // ROUND ROBIN, not one cell drained at a time: the budget is the decision
  // and the area is only where it is spent, so a player who put the zone over
  // three nodes meant all three.
  it('spreads its taps over every node in the zone', () => {
    const state = reaper(1);
    const cells = reapCells(state, map, FOREST, activeRadius(state, REAPER));
    expect(cells.length).toBeGreaterThan(1);
    const report = cast(state, map, REAPER, FOREST, T0);
    expect(report.affected.length).toBeGreaterThan(1);
  });

  // IT ALL LANDS AT THE CAST, so nothing about it is a boundary and a player
  // who casts and closes the app still gets what they paid for. This is the
  // assertion that would break if the run ever grew a clock of its own.
  it('leaves nothing running behind it', () => {
    const state = reaper(3);
    const wood = (): number => getWallet(state.city.wallet, 'Wood');
    cast(state, map, REAPER, FOREST, T0);
    const afterCast = wood();
    // An hour later the city has earned whatever a city earns — and not one
    // tap more of the run, because the run was over before the tick.
    advance(state, map, T0 + 60 * 60_000);
    const idle = reaper(3);
    advance(idle, map, T0 + 60 * 60_000);
    expect(wood() - afterCast).toBe(getWallet(idle.city.wallet, 'Wood'));
  });

  // The ground runs out before the budget does, which is the asymmetry the
  // cooldown exists to hold (OQ-99): a run cannot spend taps on nothing.
  it('stops when the ground is empty rather than spending on nothing', () => {
    const state = reaper(20);
    const report = cast(state, map, REAPER, FOREST, T0);
    expect(report.taps).toBeLessThanOrEqual(tapBudget(state, REAPER));
    expect(report.taps).toBeGreaterThan(0);
  });
});
