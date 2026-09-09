// The gate — a garrison with a clock (Docs/features/18-garrisons-and-raids.md).
//
// Three things are worth more than the rest here, and they are the ones this
// file spends its length on:
//
//  1. THE REPLAY ASSERTION. A raid landing during an absence has to leave the
//     same wallet whether the window was walked in one call or ticked a step
//     at a time. It is the load-bearing property of the whole codebase, and a
//     raid is the first thing in the game that TAKES.
//  2. THE BOUND. A week away with a gate open is three raids and never more,
//     each at most a tenth of the purse — and all of it comes back.
//  3. THE DOOR. Nothing enters a ruin until its gate is down.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import { RAID, RUINS, RUIN_ORDER, UNITS, garrisonForTier } from '../src/sim/data/definitions';
import { threatStrength } from '../src/sim/combat';
import {
  advanceRaids, cityRatePerSecond, clearedGateCount, formationPower, gateFormation,
  gateIsCleared, gatePower, gateSupplies, nextRaidBoundary, openGates, raidTake,
} from '../src/sim/gates';
import { attemptGate, launchDelve, previewGate } from '../src/sim/expeditions';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GameState, type RuinId } from '../src/sim/state';
import {
  addAllTrainers, addBuilt, freshGame, freshPresenter, fund, map, reveal, T0,
} from './helpers';

const BARROW = 'HollowBarrow' as const;
const MINUTE = 60_000;
const HOUR = 3_600_000;

/** A city that MAKES something — a raid takes seconds of production, so a
 *  kingdom that produces nothing is never worth robbing. */
function earningKingdom(): GameState {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addBuilt(state, 'Housing', { x: 2, y: 3 });
  state.city.population = 6;
  fund(state, { Gold: 10_000, Food: 2000, Wood: 2000, Stone: 500 });
  return state;
}

/** …and has found the Barrow, so its counter is running. */
function watched(at = T0): GameState {
  const state = earningKingdom();
  reveal(state, [RUINS[BARROW].location]);
  advance(state, map, at); // the sweep inside advance() arms the gate
  return state;
}

describe('the counter', () => {
  it('starts on discovery, with the whole warning ahead of it', () => {
    const state = watched();
    const gate = state.gates[BARROW]!;
    expect(gate.cleared).toBe(false);
    expect(gate.trips).toBe(0);
    expect(gate.nextRaidAt).toBe(T0 + RUINS[BARROW].guard.warningMinutes * MINUTE);
  });

  it('does not run on a ruin nobody has found', () => {
    const state = earningKingdom();
    advance(state, map, T0 + HOUR);
    expect(state.gates[BARROW]).toBeUndefined();
    expect(nextRaidBoundary(state, T0)).toBeNull();
  });

  it('is stamped inside advance(), never from a clock the sim may not read', () => {
    // The save predates the feature: the ruin is visible and nothing is
    // counting. The counter starts where the sim LEFT OFF and gets its whole
    // warning from there — not from the moment the player happened to return,
    // and not already overdue (Docs/features/18-garrisons-and-raids.md §3).
    const state = earningKingdom();
    reveal(state, [RUINS[BARROW].location]);
    state.gates = {};
    advance(state, map, T0 + 10 * MINUTE);
    expect(state.gates[BARROW]!.nextRaidAt)
      .toBe(T0 + RUINS[BARROW].guard.warningMinutes * MINUTE);
    expect(state.raidReports).toHaveLength(0);
  });

  it('is a TIMER: it resolves past the offline cap', () => {
    // The Barrow warns in thirty minutes and raids every thirty after that,
    // so an absence of a day is well past both the 8-hour production cap and
    // the trip limit. Measured against the SAME kingdom with no ruin in
    // sight, because rent keeps accruing either way — what the raid does is
    // leave the purse smaller than it would have been.
    const raided = watched();
    const control = earningKingdom();
    advance(raided, map, T0 + 24 * HOUR);
    advance(control, map, T0 + 24 * HOUR);
    expect(getWallet(raided.city.wallet, 'Gold'))
      .toBeLessThan(getWallet(control.city.wallet, 'Gold'));
    expect(raided.gates[BARROW]!.trips).toBe(RAID.maxRaids);
  });
});

describe('a raid', () => {
  it('takes seconds of production, capped at a fraction of the purse', () => {
    const state = watched();
    const took = raidTake(state, BARROW);
    const seconds = garrisonForTier(RUINS[BARROW].tier).takeSeconds;
    for (const [c, n] of Object.entries(took)) {
      const rate = cityRatePerSecond(state, c as 'Gold');
      expect(n).toBeLessThanOrEqual(Math.floor(rate * seconds));
      expect(n).toBeLessThanOrEqual(
        Math.floor(getWallet(state.city.wallet, c as 'Gold') * RAID.takeFractionMax));
    }
  });

  it('takes only what the city MAKES', () => {
    // Two houses and nobody in the woods: rent, and nothing else.
    const state = watched();
    const took = raidTake(state, BARROW);
    expect(took.Gold ?? 0).toBeGreaterThan(0);
    expect(took.Wood ?? 0).toBe(0);
    expect(took.Stone ?? 0).toBe(0);
  });

  it('never touches anything but the four materials', () => {
    const state = watched();
    fund(state, { Gems: 500, Stardust: 90 });
    const mana = getWallet(state.city.wallet, 'Mana');
    advance(state, map, T0 + 24 * HOUR);
    expect(state.gates[BARROW]!.trips).toBe(RAID.maxRaids);
    // Nothing that is not a material moved DOWN: Gems and Stardust have no
    // drip to confuse the reading, and Mana only ever regenerates.
    expect(getWallet(state.player.wallet, 'Gems')).toBe(500);
    expect(getWallet(state.kingdom.wallet, 'Stardust')).toBe(90);
    expect(getWallet(state.city.wallet, 'Mana')).toBeGreaterThanOrEqual(mana);
    for (const report of state.raidReports) {
      for (const c of Object.keys(report.took)) {
        expect(['Gold', 'Food', 'Wood', 'Stone']).toContain(c);
      }
    }
  });

  it('stops after three trips, however long the absence', () => {
    const state = watched();
    advance(state, map, T0 + 7 * 24 * HOUR);
    const gate = state.gates[BARROW]!;
    expect(gate.trips).toBe(RAID.maxRaids);
    expect(gate.nextRaidAt).toBeNull();
    expect(state.raidReports).toHaveLength(RAID.maxRaids);
    // …and it sits on the hoard from there: a second week takes nothing more.
    const purse = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + 14 * 24 * HOUR);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThanOrEqual(purse);
  });

  it('banks every unit it took in the gate hoard', () => {
    const state = watched();
    const before = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + 40 * MINUTE);
    const gate = state.gates[BARROW]!;
    expect(gate.trips).toBe(1);
    // Rent kept accruing across the window, so the wallet is not a subtraction
    // — the hoard is what left it, and it is exactly what the report says.
    expect(gate.hoard.Gold).toBe(state.raidReports[0].took.Gold);
    expect(gate.hoard.Gold).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
  });

  it('costs a garrison no trip when there is nothing to take', () => {
    // A kingdom with no production and an empty purse: raided for nothing,
    // and it still owes three real raids once it starts earning.
    const state = freshGame();
    state.city.wallet = {};
    reveal(state, [RUINS[BARROW].location]);
    advance(state, map, T0);
    advance(state, map, T0 + 6 * HOUR);
    expect(state.gates[BARROW]!.trips).toBe(0);
    expect(state.raidReports).toHaveLength(0);
  });
});

// THE load-bearing assertion, on the newest thing in the sim.
describe('one-call replay equals stepped ticking', () => {
  it('across an absence with three raids in it', () => {
    const walk = (stepMs: number): GameState => {
      const state = watched();
      for (let t = T0 + stepMs; t <= T0 + 6 * HOUR; t += stepMs) advance(state, map, t);
      advance(state, map, T0 + 6 * HOUR);
      return state;
    };
    const oneCall = watched();
    advance(oneCall, map, T0 + 6 * HOUR);
    const stepped = walk(60_000);

    expect(oneCall.gates[BARROW]).toEqual(stepped.gates[BARROW]);
    expect(getWallet(oneCall.city.wallet, 'Gold'))
      .toBe(getWallet(stepped.city.wallet, 'Gold'));
    expect(oneCall.raidReports.map((r) => r.took))
      .toEqual(stepped.raidReports.map((r) => r.took));
    // …and the raids really did land inside the window.
    expect(oneCall.gates[BARROW]!.trips).toBe(RAID.maxRaids);
  });

  it('reports the raids to the caller, so an absence can be summarised', () => {
    const state = watched();
    const result = advance(state, map, T0 + 6 * HOUR);
    expect(result.raids.length).toBeGreaterThan(0);
    expect(result.raids.every((r) => r.ruinId === BARROW)).toBe(true);
    expect(result.raids[result.raids.length - 1].done).toBe(true);
  });
});

describe('clearing the gate', () => {
  /** A kingdom that can put a party on the Barrow's doorstep. */
  function readyToFight(units = 0): GameState {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < units; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    return state;
  }

  it('is beatable by the free hero, alone, at the Barrow', () => {
    const state = readyToFight();
    // No troops at all: the first fight in the game asks for no army.
    const preview = previewGate(state, BARROW, ['Warden'], []);
    expect(preview.enough).toBe(true);
    expect(attemptGate(state, map, BARROW, ['Warden'], []).result).toBe('Cleared');
    expect(gateIsCleared(state, BARROW)).toBe(true);
    expect(clearedGateCount(state)).toBe(1);
  });

  it('stops the counter for good', () => {
    const state = readyToFight();
    attemptGate(state, map, BARROW, ['Warden'], []);
    expect(state.gates[BARROW]!.nextRaidAt).toBeNull();
    expect(nextRaidBoundary(state, T0)).toBeNull();
    const purse = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + 7 * 24 * HOUR);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThan(purse);
    expect(openGates(state)).toEqual([]);
  });

  it('hands back the whole hoard', () => {
    const state = readyToFight();
    advance(state, map, T0 + 6 * HOUR); // three raids' worth of taking
    const hoard = { ...state.gates[BARROW]!.hoard };
    expect(hoard.Gold).toBeGreaterThan(0);
    const before = getWallet(state.city.wallet, 'Gold');
    const report = attemptGate(state, map, BARROW, ['Warden'], []);
    expect(report.result).toBe('Cleared');
    expect(report.hoard).toEqual(hoard);
    // Every coin of it, less what the supplies cost on the way in.
    expect(getWallet(state.city.wallet, 'Gold'))
      .toBe(before + hoard.Gold! - (gateSupplies(BARROW).Gold ?? 0));
    expect(state.raidReports).toHaveLength(0);
  });

  it('costs the supplies and nothing else when it fails', () => {
    // The Observatory's drake, answered by one hero from the first hour.
    const state = readyToFight();
    reveal(state, [RUINS.StarObservatory.location]);
    advance(state, map, T0);
    const supplies = gateSupplies('StarObservatory');
    fund(state, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const gold = getWallet(state.city.wallet, 'Gold');
    const report = attemptGate(state, map, 'StarObservatory', ['Warden'], []);
    expect(report.result).toBe('Repelled');
    expect(report.attack).toBeLessThan(report.power);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - supplies.Gold!);
    expect(gateIsCleared(state, 'StarObservatory')).toBe(false);
    // …and a retry is identical to a first attempt.
    expect(attemptGate(state, map, 'StarObservatory', ['Warden'], []).result).toBe('Repelled');
  });

  it('refuses a ruin still under the fog, and one already cleared', () => {
    const state = readyToFight();
    expect(attemptGate(state, map, 'SunkenChapel', ['Warden'], []).result).toBe('RuinNotFound');
    attemptGate(state, map, BARROW, ['Warden'], []);
    expect(attemptGate(state, map, BARROW, ['Warden'], []).result).toBe('AlreadyCleared');
  });
});

describe('the door', () => {
  it('refuses a delve while the garrison stands, and opens once it does not', () => {
    const state = watched();
    addAllTrainers(state);
    fund(state, { Gold: 10_000, Food: 5000 });
    for (let i = 0; i < 4; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    const party = [{ unitId: 'Warrior' as const, count: 2 }];
    expect(launchDelve(state, map, BARROW, ['Warden'], party, T0)).toBe('GateStanding');
    expect(attemptGate(state, map, BARROW, ['Warden'], []).result).toBe('Cleared');
    expect(launchDelve(state, map, BARROW, ['Warden'], party, T0)).toBe('Launched');
  });
});

describe('a save', () => {
  it('carries the clock, the hoard and the reports', () => {
    const state = watched();
    advance(state, map, T0 + 40 * MINUTE);
    const restored = deserialize(serialize(state, T0 + 40 * MINUTE), map, T0 + 40 * MINUTE)!;
    expect(restored.gates[BARROW]).toEqual(state.gates[BARROW]);
    expect(restored.raidReports.map((r) => r.took))
      .toEqual(state.raidReports.map((r) => r.took));
  });

  it('carries a cleared gate, so nothing re-infests it', () => {
    const state = watched();
    addAllTrainers(state);
    attemptGate(state, map, BARROW, ['Warden'], []);
    const restored = deserialize(serialize(state, T0), map, T0 + 7 * 24 * HOUR)!;
    expect(gateIsCleared(restored, BARROW)).toBe(true);
    expect(restored.gates[BARROW]!.nextRaidAt).toBeNull();
  });
});

// The route the player actually taps: the ruin card offers the GATE and
// nothing else while it stands, the widget names the garrison closest to
// coming down the hill, and clearing it puts the delve back on the card.
describe('the route to a gate', () => {
  function presenterAtTheBarrow() {
    const state = watched();
    addAllTrainers(state);
    const game = freshPresenter(state);
    game.showRuin(BARROW);
    return game;
  }

  it('offers the gate instead of a party while the garrison stands', () => {
    const game = presenterAtTheBarrow();
    expect(game.gateFor(BARROW)!.cleared).toBe(false);
    expect(game.expeditionBlock(BARROW)).not.toBeNull();
    game.openGate(BARROW);
    expect(game.openOverlay).toBe('gate');
    // A hero alone, and the sheet is ready to go: the first fight asks for
    // no army.
    expect(game.partyHeroes).toEqual(['Warden']);
    expect(game.gateBlockText()).toBeNull();
    expect(game.gatePreview()!.enough).toBe(true);
  });

  it('clears it, closes the sheet and opens the ruin behind it', () => {
    const game = presenterAtTheBarrow();
    game.openGate(BARROW);
    game.doClearGate();
    expect(game.openOverlay).toBeNull();
    expect(game.gateFor(BARROW)!.cleared).toBe(true);
    expect(game.raidWidget()).toBeNull();
  });

  it('names the garrison closest to raiding, and never opens itself', () => {
    const game = presenterAtTheBarrow();
    const widget = game.raidWidget()!;
    expect(widget.ruinId).toBe(BARROW);
    expect(widget.creature).toBe('Orcs');
    expect(widget.raidsAt).toBe(T0 + RUINS[BARROW].guard.warningMinutes * MINUTE);
    expect(widget.took).toBeNull();
    expect(game.openOverlay).toBeNull();
  });

  it('turns into one summary after an absence, and dismisses', () => {
    const game = presenterAtTheBarrow();
    advance(game.state, map, T0 + 6 * HOUR);
    const widget = game.raidWidget()!;
    expect(widget.reports).toBe(RAID.maxRaids);
    expect(widget.took!.Gold).toBeGreaterThan(0);
    game.dismissRaids();
    // The gate is out of trips, so nothing is counting and the tab is gone.
    expect(game.raidWidget()).toBeNull();
  });
});

// What the player is SHOWN is what the party fights. The formation is derived
// from `guard`, and the fight is scored against the formation — so a squad on
// the screen can never be decoration.
describe('the formation in the doorway', () => {
  it('is the ruin\'s own creature, in as many squads as the budget fills', () => {
    for (const id of RUIN_ORDER) {
      const squads = gateFormation(id);
      expect(squads.length).toBeGreaterThan(0);
      if (RUINS[id].guard.threat === 'Any') {
        // The drake: an even mix across the four, and therefore no type answer.
        expect(new Set(squads.map((s) => s.unitId)).size).toBe(4);
      } else {
        for (const squad of squads) expect(squad.unitId).toBe(RUINS[id].guard.threat);
      }
      for (const squad of squads) {
        expect(squad.count).toBeGreaterThan(0);
        expect(squad.count).toBeLessThanOrEqual(UNITS[squad.unitId].squadSize);
      }
    }
  });

  it('is worth what the gate was authored to be worth', () => {
    for (const id of RUIN_ORDER) {
      const budget = RUINS[id].guard.power;
      // Whole troops, so the sum lands within one body of the budget — and
      // never below one troop, however small the authored number.
      const slack = Math.max(...gateFormation(id).map((s) => UNITS[s.unitId].power));
      expect(Math.abs(gatePower(id) - budget), `${id}'s gate`).toBeLessThanOrEqual(slack);
    }
  });

  it('is exactly what the attempt is scored against', () => {
    const state = watched();
    addAllTrainers(state);
    const preview = previewGate(state, BARROW, ['Warden'], []);
    expect(preview.enemy).toEqual(gateFormation(BARROW));
    expect(preview.power).toBe(formationPower(preview.enemy));
    const report = attemptGate(state, map, BARROW, ['Warden'], []);
    expect(report.power).toBe(preview.power);
  });
});

// Content, not machinery: the authored numbers have a shape the design states,
// and a map edit that breaks it should fail here rather than in a playtest.
describe('every authored gate', () => {
  // The AUTHORED budget is the designer's number and the rule is on that:
  // a gate is easier than the first room of the ruin it guards, because it is
  // the room the player is pushed into on a clock. What the generator makes
  // of it can land a body above, because a formation is whole troops and at
  // today's scale one soldier is worth more than a tier-1 ruin's first
  // depth — which is what **OQ-86** exists to re-author.
  it('is authored below the first room of the ruin it guards', () => {
    for (const id of RUIN_ORDER) {
      expect(RUINS[id].guard.power, `${id}'s gate`).toBeLessThan(threatStrength(id, 1));
    }
  });

  it('never fields more than one body past that first room', () => {
    for (const id of RUIN_ORDER) {
      const body = Math.max(...gateFormation(id).map((s) => UNITS[s.unitId].power));
      expect(gatePower(id), `${id}'s gate`)
        .toBeLessThanOrEqual(threatStrength(id, 1) + body);
    }
  });

  it('is the ruin\'s own affinity, so the first fight teaches the matchup', () => {
    for (const id of RUIN_ORDER) {
      expect(RUINS[id].guard.threat, `${id}'s gate`).toBe(RUINS[id].affinity);
    }
  });

  it('counts in minutes, and a deeper ruin gives longer', () => {
    const warnings = RUIN_ORDER.map((id: RuinId) => RUINS[id].guard.warningMinutes);
    for (const w of warnings) expect(w).toBeGreaterThanOrEqual(30);
    for (let i = 1; i < warnings.length; i++) {
      expect(warnings[i]).toBeGreaterThanOrEqual(warnings[i - 1]);
    }
  });

  it('costs less to enter than the ruin behind it', () => {
    for (const id of RUIN_ORDER) {
      const gate = gateSupplies(id);
      for (const [c, n] of Object.entries(RUINS[id].supplies)) {
        expect(gate[c as 'Gold'] ?? 0, `${id}'s gate supplies`).toBeLessThanOrEqual(n);
      }
    }
  });
});

// The seatbelt in `advance()` is 10,000 boundary steps, and a raid clock is
// the first source in the game that fires on a MINUTE scale. Three trips a
// gate is what keeps it far away from that, and this is the arithmetic.
describe('the boundary budget', () => {
  it('proposes a handful of boundaries across a month, not thousands', () => {
    const state = watched();
    let steps = 0;
    let cursor = T0;
    for (;;) {
      const next = nextRaidBoundary(state, cursor);
      if (next === null || next > T0 + 30 * 24 * HOUR) break;
      advance(state, map, next);
      advanceRaids(state, next);
      cursor = next;
      steps += 1;
      expect(steps).toBeLessThan(50);
    }
    expect(steps).toBe(RAID.maxRaids);
  });
});
