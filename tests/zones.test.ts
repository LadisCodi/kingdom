// ZONES — a modifier with a centre, and the world relics' spells that place
// or read them (Docs/features/09-relics.md §2).
//
// A zone is not a new system. It is the modifier stack plus a place, which
// means it inherits expiry-as-a-boundary, pruning, the save key and the
// defined fold order for free. What it must NOT inherit is reach: a zone that
// leaked into `resolve()` would apply to the whole kingdom, and that is the
// one bug this file exists to make impossible.

import { activateRelic } from '../src/sim/hosts';
import { describe, expect, it } from 'vitest';
import { syncArtifactModifiers } from '../src/sim/artifacts';
import {
  activeChargesAt, activeDurationMsAt, activePowerAt, activeRadius,
  activeRadiusAt, cast, castBlock, castState, chargesLeft, spendCharge,
  surveyCells,
} from '../src/sim/casting';
import { advance } from '../src/sim/commands';
import {
  ARTIFACT_COOLDOWN_SECONDS, ARTIFACT_RADIUS_STEPS,
  HARVEST,
} from '../src/sim/data/definitions';
import { spellStatChanges, spellStatsAt } from '../src/ui/relicStats';
import {
  drawFromCell, effectiveRecoveryMs, harvestSourceAt, recoveryProgress,
} from '../src/sim/harvest';
import { isWithinReach } from '../src/sim/fog';
import {
  activeZones, addModifier, areaCovers, resolve, resolveAt, type Modifier,
} from '../src/sim/modifiers';
import { deserialize, serialize } from '../src/sim/save';
import { workerStrikeMs, effectiveWorkerSpeed } from '../src/sim/upgrades';
import {
  coordKey, districtAt, getWallet, type Coord, type GameState,
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
    value, expiresAt: T0 + minutes * 60_000,
    area: { centre, radius, relic: 'DowsingRod', since: T0 },
  });
};



describe('a zone is a modifier with a centre', () => {
  it('covers a Chebyshev square, inclusive of the centre', () => {
    const area = { centre: CENTRE, radius: 2, relic: 'DowsingRod' as const, since: T0 };
    expect(areaCovers(area, CENTRE)).toBe(true);
    expect(areaCovers(area, { x: 2, y: 2 })).toBe(true);   // the corner is in
    expect(areaCovers(area, { x: -2, y: 2 })).toBe(true);
    expect(areaCovers(area, { x: 3, y: 0 })).toBe(false);
    expect(areaCovers(area, { x: 2, y: 3 })).toBe(false);
    // Chebyshev, not Euclidean: the corner of the square is inside, which a
    // circle of the same radius would exclude.
    expect(areaCovers({ centre: CENTRE, radius: 0, relic: 'DowsingRod', since: T0 }, CENTRE)).toBe(true);
    expect(areaCovers({ centre: CENTRE, radius: 0, relic: 'DowsingRod', since: T0 }, { x: 1, y: 0 })).toBe(false);
  });

  // THE ASYMMETRY IS THE SAFETY. Every number in the game that is not about a
  // place still calls `resolve()`, so a zone must be invisible there — or the
  // Winged Hammer's 5×5 would speed up the whole kingdom's crews.
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
      op: 'mul', value: 3, expiresAt: T0 + 600_000,
      area: { centre: { x: 1, y: 0 }, radius: 2, relic: 'VerdantSeal', since: T0 },
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
  // The Staff of Renewal: recovery runs faster inside the zone. The wait is stamped
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

  // The Winged Hammer: read at the BUILDING, never at the cell. A worker
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
    expect(z.area).toEqual({
      centre: { x: 3, y: -4 }, radius: 3, relic: 'DowsingRod', since: T0,
    });
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

// ------------------------------------------------------------- the radius

/**
 * THE ONE NUMBER OF AN ABILITY THAT STEPS RATHER THAN CREEPS
 * (Docs/features/09-relics.md §2.1). A Chebyshev radius covers (2r+1)² cells,
 * so each rung roughly DOUBLES the ground — which is why it is three named
 * levels and not a slope.
 */
describe('an ability reaches further at three named levels', () => {
  const RADIUS_RELIC = 'WanderersCompass';

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

  // A STEP LADDER ON A RELIC WITH NO ABILITY would be three rungs of nothing,
  // so a radius of 0 stays 0 at every level.
  it('leaves a relic with no ability alone', () => {
    expect(activeRadiusAt('DelversLantern', 1)).toBe(0);
    expect(activeRadiusAt('DelversLantern', 50)).toBe(0);
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

describe('Survey buys the fog with Mana instead of Gold', () => {
  const compass = (level: number): GameState => {
    const state = freshGame();
    // A world relic's spell waits for a Chapel (sim/casting.ts).
    state.world.chapels = ['WanderersCompass', 'DelversLantern'];
    state.lastAdvance = T0;
    state.artifacts.levels.WanderersCompass = level;
    fund(state, { Mana: 999 });
    return state;
  };

  it('clears the fog it covers, and charges no Gold for it', () => {
    const state = compass(1);
    const centre = { x: 0, y: 0 };
    reveal(state, [centre]);
    const cells = surveyCells(state, map, centre, activeRadius(state, 'WanderersCompass'));
    expect(cells.length).toBeGreaterThan(0);
    const gold = getWallet(state.city.wallet, 'Gold');

    const report = cast(state, map, 'WanderersCompass', centre, T0);
    expect(report.result).toBe('Cast');
    expect(report.goldSaved).toBeGreaterThan(0);
    for (const c of cells) expect(state.fog.revealed[coordKey(c)]).toBe(true);
    // The fog was bought with Mana: not one coin left the purse.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold);
  });

  // THE SPELL BUYS THE GOLD, NEVER THE LADDER: the Townhall's reach still
  // gates every cell, so the fog grows out of what the player holds.
  it('never reaches past the Townhall', () => {
    const state = compass(20);
    const centre = { x: 0, y: 0 };
    reveal(state, [centre]);
    const cells = surveyCells(state, map, centre, activeRadius(state, 'WanderersCompass'));
    for (const c of cells) expect(isWithinReach(state, map, c)).toBe(true);
  });

  // RADIUS IS ITS WHOLE GROWTH — for a reveal, more ground IS the effect — so
  // it has no second axis and wants none.
  it('grows by reach alone', () => {
    expect(activePowerAt('WanderersCompass', 1)).toBe(activePowerAt('WanderersCompass', 20));
    expect(activeDurationMsAt('WanderersCompass', 20)).toBe(0);
    expect(activeRadiusAt('WanderersCompass', ARTIFACT_RADIUS_STEPS[0]!))
      .toBeGreaterThan(activeRadiusAt('WanderersCompass', 1));
  });
});

// ------------------------------------------------- the bar that counts it

/**
 * THE RECOVERY BAR SPANS THE WAIT THAT WAS STAMPED.
 *
 * A wait is priced ONCE, at exhaustion, so a bar measured against the authored
 * `recoverySeconds` opens nearly full under anything that speeds recovery up —
 * which is every level of the Staff of Renewal, and then its zone on top. The bar
 * should fill FASTER, not start fuller.
 */
describe('a faster recovery fills the bar faster, not fuller', () => {
  /** A kingdom that can harvest, holding the Staff at `level` — passives and
   *  all, because a level set by hand moves no modifier. */
  const holder = (level: number): GameState => {
    const state = canGather(freshGame());
    reveal(state, cellsWithinRadius(map, FOREST, 2));
    state.lastAdvance = T0;
    state.artifacts.levels.DowsingRod = level;
    // A city relic acts where a Shrine holds it: one beside the forest.
    state.city.districts.push({
      uniqueId: 'shrine_rod', definitionId: 'Shrine', ordinal: 9, level: 5, assignedWorkers: 0,
      location: { x: FOREST.x + 2, y: FOREST.y + 2 }, state: 'Built', visualVariant: 1, hosts: 'DowsingRod',
    });
    syncArtifactModifiers(state);
    fund(state, { Mana: 999 });
    // Hosted is not enough: the Staff acts while it is awake.
    expect(activateRelic(state, 'DowsingRod', T0)).toBe('Activated');
    return state;
  };

  const spec = (state: GameState) => HARVEST[harvestSourceAt(state, FOREST)!];

  /** Empty the forest at T0 and read the bar the instant it went. */
  const barAtEmpty = (level: number): number => {
    const state = holder(level);
    drawFromCell(state, map, FOREST, spec(state), 999, T0);
    return recoveryProgress(state, map, FOREST, spec(state), T0)!;
  };

  it('starts at zero however fast the ground comes back', () => {
    expect(barAtEmpty(1)).toBeCloseTo(0);
    expect(barAtEmpty(16)).toBeCloseTo(0);
  });

  // The FIX, stated as the symptom it replaces: a bar spanning the authored
  // 90 seconds while the real wait is 21 opens at 77%.
  it('is not the authored wait that the bar spans', () => {
    const state = holder(16);
    drawFromCell(state, map, FOREST, spec(state), 999, T0);
    const stamped = state.harvest[coordKey(FOREST)]!.recoveryMs!;
    const authored = spec(state).recoverySeconds * 1000;
    expect(stamped).toBeLessThan(authored / 2);
    // Against the authored span the bar would already be most of the way up.
    expect(1 - stamped / authored).toBeGreaterThan(0.5);
    // Against the stamped one it is at the bottom, where it belongs.
    expect(recoveryProgress(state, map, FOREST, spec(state), T0)!).toBeCloseTo(0);
  });

  it('reaches full sooner when the ground is faster', () => {
    const wait = (level: number): number => {
      const state = holder(level);
      drawFromCell(state, map, FOREST, spec(state), 999, T0);
      return state.harvest[coordKey(FOREST)]!.recoveryMs!;
    };
    expect(wait(16)).toBeLessThan(wait(1));
    // And the bar is halfway at half of whatever that wait is, either way.
    for (const level of [1, 16]) {
      const state = holder(level);
      drawFromCell(state, map, FOREST, spec(state), 999, T0);
      const span = state.harvest[coordKey(FOREST)]!.recoveryMs!;
      expect(recoveryProgress(state, map, FOREST, spec(state), T0 + span / 2)!)
        .toBeCloseTo(0.5, 2);
    }
  });

  // A WAIT ALREADY RUNNING IS NOT REPRICED — the zone's own rule, applied to
  // the bar. A cell that emptied before a spell landed keeps the span it was
  // stamped with, so its bar cannot jump when a zone opens or closes.
  it('does not reprice a wait that is already running', () => {
    const state = holder(1);
    drawFromCell(state, map, FOREST, spec(state), 999, T0);
    const span = state.harvest[coordKey(FOREST)]!.recoveryMs!;
    const half = recoveryProgress(state, map, FOREST, spec(state), T0 + span / 2)!;

    // A recovery zone somewhere else entirely, a second later.
    zone(state, 'recoverySpeed', 5, { x: 9, y: 9 }, 2);

    expect(state.harvest[coordKey(FOREST)]!.recoveryMs).toBe(span);
    expect(recoveryProgress(state, map, FOREST, spec(state), T0 + span / 2)!).toBe(half);
  });
});

// ------------------------------------------------ an ability counted in rooms

/**
 * LAMPLIGHT IS COUNTED IN ROOMS, NOT MINUTES. The only clock a delve has is the
 * player opening the next door, so a window of minutes would be a timer running
 * while nothing happens — and a spell bought before a delve would expire in the
 * party screen.
 */
describe('Lamplight waits in the lantern until it is spent', () => {
  const lit = (level: number): GameState => {
    const state = freshGame();
    // A world relic's spell waits for a Chapel (sim/casting.ts).
    state.world.chapels = ['WanderersCompass', 'DelversLantern'];
    state.lastAdvance = T0;
    state.artifacts.levels.DelversLantern = level;
    syncArtifactModifiers(state);
    fund(state, { Mana: 999 });
    return state;
  };

  it('buys more rooms at every level', () => {
    let last = 0;
    for (const level of [1, 2, 5, 10, 20]) {
      const n = activeChargesAt('DelversLantern', level);
      expect(n, `level ${level}`).toBeGreaterThan(last);
      last = n;
    }
  });

  it('holds its charges with no clock on them at all', () => {
    const state = lit(1);
    expect(cast(state, map, 'DelversLantern', null, T0).result).toBe('Cast');
    expect(chargesLeft(state, 'DelversLantern')).toBe(activeChargesAt('DelversLantern', 1));
    // A DAY later, unspent and still lit: a charge cannot expire while
    // nothing is happening.
    expect(castState(state, 'DelversLantern', T0 + 24 * 3600_000).phase).toBe('Active');
    expect(chargesLeft(state, 'DelversLantern')).toBeGreaterThan(0);
  });

  // THE LAST CHARGE IS THE CLOSE. A charged ability has no window, so the
  // moment its last use is taken is what the cooldown counts from.
  it('starts its cooldown on the last room, not on the cast', () => {
    const state = lit(1);
    const n = activeChargesAt('DelversLantern', 1);
    cast(state, map, 'DelversLantern', null, T0);
    // An hour of delving later, the last charge goes.
    const late = T0 + 3600_000;
    for (let i = 0; i < n; i++) spendCharge(state, 'DelversLantern', late);
    expect(chargesLeft(state, 'DelversLantern')).toBe(0);
    expect(castState(state, 'DelversLantern', late).phase).toBe('Cooldown');
    expect(castState(state, 'DelversLantern', late + ARTIFACT_COOLDOWN_SECONDS * 1000).phase)
      .toBe('Ready');
  });

  it('refuses a second cast while charges are still in hand', () => {
    const state = lit(1);
    cast(state, map, 'DelversLantern', null, T0);
    expect(castBlock(state, 'DelversLantern', T0 + 1)).toBe('Active');
  });

  // Spending with nothing in hand is a no-op worth 1, so a call site can
  // multiply by it unconditionally.
  it('is worth exactly one when the lantern is dark', () => {
    const state = lit(1);
    expect(spendCharge(state, 'DelversLantern', T0)).toBe(1);
    expect(castState(state, 'DelversLantern', T0).phase).toBe('Ready');
  });
});
