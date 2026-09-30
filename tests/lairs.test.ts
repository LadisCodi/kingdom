// The lair — a garrison with a clock (Docs/features/18-garrisons-and-raids.md).
//
// Three things are worth more than the rest here, and they are the ones this
// file spends its length on:
//
//  1. THE REPLAY ASSERTION. A raid landing during an absence has to leave the
//     same stores whether the window was walked in one call or ticked a step
//     at a time. It is the load-bearing property of the whole codebase, and a
//     raid is the first thing in the game that TAKES.
//  2. THE BOUND. A week away with a lair open is three raids and never more,
//     each at most a fraction of what the stores hold — never the wallet —
//     and all of it comes back.
//  3. THE FIGHT. A lair is cleared once, and that is the whole lair.
import { describe, expect, it } from 'vitest';
import { advance } from '../src/sim/commands';
import {
  RAID, LAIRS, LAIR_ORDER, UNITS, garrisonForTier,
} from '../src/sim/data/definitions';
import {
  advanceRaids, cityRatePerSecond, clearedLairCount, lairFormation,
  lairIsCleared, lairPower, lairSupplies, nextRaidBoundary, openLairs, raidTake,
} from '../src/sim/lairs';
import { formationPower } from '../src/sim/combat';
import { attackLair, previewLair } from '../src/sim/expeditions';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, type GameState, type LairId } from '../src/sim/state';
import {
  addAllTrainers, addBuilt, freshGame, freshPresenter, fund, map, reveal, stored, T0,
} from './helpers';

const ORCS = 'Orcs' as const;
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

/** …and has found the orc lair, so its counter is running. */
function watched(at = T0): GameState {
  const state = earningKingdom();
  reveal(state, [LAIRS[ORCS].location]);
  advance(state, map, at); // the sweep inside advance() arms the lair
  return state;
}

describe('the counter', () => {
  it('starts on discovery, with the whole warning ahead of it', () => {
    const state = watched();
    const lair = state.lairs[ORCS]!;
    expect(lair.cleared).toBe(false);
    expect(lair.trips).toBe(0);
    expect(lair.nextRaidAt).toBe(T0 + LAIRS[ORCS].guard.warningMinutes * MINUTE);
  });

  it('does not run on a lair nobody has found', () => {
    const state = earningKingdom();
    advance(state, map, T0 + HOUR);
    expect(state.lairs[ORCS]).toBeUndefined();
    expect(nextRaidBoundary(state, T0)).toBeNull();
  });

  it('is stamped inside advance(), never from a clock the sim may not read', () => {
    // The save predates the feature: the lair is visible and nothing is
    // counting. The counter starts where the sim LEFT OFF and gets its whole
    // warning from there — not from the moment the player happened to return,
    // and not already overdue (Docs/features/18-garrisons-and-raids.md §3).
    const state = earningKingdom();
    reveal(state, [LAIRS[ORCS].location]);
    state.lairs = {};
    advance(state, map, T0 + 10 * MINUTE);
    expect(state.lairs[ORCS]!.nextRaidAt)
      .toBe(T0 + LAIRS[ORCS].guard.warningMinutes * MINUTE);
    expect(state.raidReports).toHaveLength(0);
  });

  it('is a TIMER: it resolves in full while the player is away', () => {
    // The Barrow warns in thirty minutes and raids every thirty after that,
    // so a hundred minutes away is past the trip limit and short of the
    // houses filling. Measured against the SAME kingdom with no lair in
    // sight, because rent keeps accruing either way — what the raid does is
    // leave the stores smaller than they would have been, and the wallet
    // exactly as it was.
    const raided = watched();
    const control = earningKingdom();
    const purse = getWallet(raided.city.wallet, 'Gold');
    advance(raided, map, T0 + 100 * MINUTE);
    advance(control, map, T0 + 100 * MINUTE);
    expect(stored(raided, 'Gold')).toBeLessThan(stored(control, 'Gold'));
    expect(getWallet(raided.city.wallet, 'Gold')).toBe(purse);
    expect(raided.lairs[ORCS]!.trips).toBe(RAID.maxRaids);
  });
});

describe('a raid', () => {
  it('takes from the stores, never from the wallet: collecting is the defence', () => {
    const state = watched();
    advance(state, map, T0 + 29 * MINUTE); // the houses fill for half an hour
    const purse = getWallet(state.city.wallet, 'Gold');
    const before = stored(state, 'Gold');
    advance(state, map, T0 + 30 * MINUTE); // …and the garrison comes down
    const took = state.raidReports[0]?.took.Gold ?? 0;
    expect(took).toBeGreaterThan(0);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(purse);
    expect(stored(state, 'Gold')).toBeLessThan(before + 60); // a minute of rent, less the take
    expect(state.lairs[ORCS]!.hoard.Gold).toBe(took);
  });

  it('takes seconds of production, capped at a fraction of what is stored', () => {
    const state = watched();
    advance(state, map, T0 + 20 * MINUTE); // something in the houses
    const took = raidTake(state, ORCS);
    expect(took.Gold ?? 0).toBeGreaterThan(0);
    const seconds = garrisonForTier(LAIRS[ORCS].tier).takeSeconds;
    for (const [c, n] of Object.entries(took)) {
      const rate = cityRatePerSecond(state, c as 'Gold');
      expect(n).toBeLessThanOrEqual(Math.floor(rate * seconds));
      expect(n).toBeLessThanOrEqual(
        Math.floor(stored(state, c as 'Gold') * RAID.takeFractionMax));
    }
  });

  it('takes only what the city MAKES', () => {
    // Two houses and nobody in the woods: rent, and nothing else.
    const state = watched();
    advance(state, map, T0 + 20 * MINUTE);
    const took = raidTake(state, ORCS);
    expect(took.Gold ?? 0).toBeGreaterThan(0);
    expect(took.Wood ?? 0).toBe(0);
    expect(took.Stone ?? 0).toBe(0);
  });

  it('never touches anything but the four materials', () => {
    const state = watched();
    fund(state, { Gems: 500, Stardust: 90 });
    const mana = getWallet(state.city.wallet, 'Mana');
    advance(state, map, T0 + 24 * HOUR);
    expect(state.lairs[ORCS]!.trips).toBe(RAID.maxRaids);
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
    const lair = state.lairs[ORCS]!;
    expect(lair.trips).toBe(RAID.maxRaids);
    expect(lair.nextRaidAt).toBeNull();
    expect(state.raidReports).toHaveLength(RAID.maxRaids);
    // …and it sits on the hoard from there: a second week takes nothing more.
    const purse = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + 14 * 24 * HOUR);
    expect(getWallet(state.city.wallet, 'Gold')).toBeGreaterThanOrEqual(purse);
  });

  it('banks every unit it took in the lair hoard', () => {
    const state = watched();
    const before = getWallet(state.city.wallet, 'Gold');
    advance(state, map, T0 + 40 * MINUTE);
    const lair = state.lairs[ORCS]!;
    expect(lair.trips).toBe(1);
    // Rent kept accruing across the window, so the wallet is not a subtraction
    // — the hoard is what left it, and it is exactly what the report says.
    expect(lair.hoard.Gold).toBe(state.raidReports[0].took.Gold);
    expect(lair.hoard.Gold).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
  });

  it('costs a garrison no trip when there is nothing to take', () => {
    // A kingdom with no production and an empty purse: raided for nothing,
    // and it still owes three real raids once it starts earning.
    const state = freshGame();
    state.city.wallet = {};
    reveal(state, [LAIRS[ORCS].location]);
    advance(state, map, T0);
    advance(state, map, T0 + 6 * HOUR);
    expect(state.lairs[ORCS]!.trips).toBe(0);
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

    expect(oneCall.lairs[ORCS]).toEqual(stepped.lairs[ORCS]);
    expect(getWallet(oneCall.city.wallet, 'Gold'))
      .toBe(getWallet(stepped.city.wallet, 'Gold'));
    for (let i = 0; i < oneCall.city.districts.length; i++) {
      expect(oneCall.city.districts[i].stored).toEqual(stepped.city.districts[i].stored);
    }
    expect(oneCall.raidReports.map((r) => r.took))
      .toEqual(stepped.raidReports.map((r) => r.took));
    // …and the raids really did land inside the window.
    expect(oneCall.lairs[ORCS]!.trips).toBe(RAID.maxRaids);
  });

  it('reports the raids to the caller, so an absence can be summarised', () => {
    const state = watched();
    const result = advance(state, map, T0 + 6 * HOUR);
    expect(result.raids.length).toBeGreaterThan(0);
    expect(result.raids.every((r) => r.lairId === ORCS)).toBe(true);
    expect(result.raids[result.raids.length - 1].done).toBe(true);
  });
});

describe('clearing the lair', () => {
  /** A kingdom that can put a party on the orc lair's doorstep — the company
   *  the chain musters before `DriveThemOut` (12-quests.md §2). */
  function readyToFight(units = 24): GameState {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < units; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    return state;
  }

  const company = [{ unitId: 'Warrior' as const, count: 24 }];

  it('is beatable by the company the chain musters, at the orc lair', () => {
    const state = readyToFight();
    const preview = previewLair(state, ORCS, ['Warden'], company);
    expect(preview.enough).toBe(true);
    expect(attackLair(state, map, ORCS, ['Warden'], company).result).toBe('Cleared');
    expect(lairIsCleared(state, ORCS)).toBe(true);
    expect(clearedLairCount(state)).toBe(1);
  });

  it('IS beatable by a hero alone — the first fight needs no army', () => {
    // The one place in the game where that is true, and it is the point of
    // the beat: a garrison arrives before the player owns a company
    // (Docs/features/18-garrisons-and-raids.md §5). The Warden is a body on
    // the board now, and the orc lair's doorway is nine of the weakest thing
    // there is.
    const state = readyToFight();
    expect(attackLair(state, map, ORCS, ['Warden'], []).result).toBe('Cleared');
  });

  it('is not beatable alone one lair deeper — that one wants the company', () => {
    const state = readyToFight();
    reveal(state, [LAIRS.Harpies.location]);
    advance(state, map, T0);
    expect(attackLair(state, map, 'Harpies', ['Warden'], []).result).toBe('Repelled');
  });

  it('stops the counter for good', () => {
    const state = readyToFight();
    attackLair(state, map, ORCS, ['Warden'], company);
    expect(state.lairs[ORCS]!.nextRaidAt).toBeNull();
    expect(nextRaidBoundary(state, T0)).toBeNull();
    advance(state, map, T0 + 7 * 24 * HOUR);
    // A week of rent, and nothing taken from it.
    expect(state.raidReports).toHaveLength(0);
    expect(stored(state, 'Gold')).toBeGreaterThan(0);
    expect(openLairs(state)).toEqual([]);
  });

  it('hands back the whole hoard', () => {
    const state = readyToFight();
    advance(state, map, T0 + 6 * HOUR); // three raids' worth of taking
    const hoard = { ...state.lairs[ORCS]!.hoard };
    expect(hoard.Gold).toBeGreaterThan(0);
    const before = getWallet(state.city.wallet, 'Gold');
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(report.hoard).toEqual(hoard);
    // Every coin of it, less what the supplies cost on the way in.
    expect(getWallet(state.city.wallet, 'Gold'))
      .toBe(before + hoard.Gold! - (lairSupplies(ORCS).Gold ?? 0));
    expect(state.raidReports).toHaveLength(0);
  });

  it('costs what the fight cost — nothing when it is a rout', () => {
    // The company the chain musters walks over the orc lair's doorway before it
    // can swing, and the roster is untouched. Bringing more than enough is
    // supposed to be worth something, and this is what it is worth
    // (Docs/features/combat.md §4).
    const state = readyToFight();
    const before = state.army.length;
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.result).toBe('Cleared');
    expect(state.army.length).toBe(before - report.losses.reduce((n, l) => n + l.count, 0));

    // Being driven off costs the party: the garrison had all the time it
    // needed, and the fight only ends when one side is gone.
    const beaten = readyToFight();
    reveal(beaten, [LAIRS.Goblins.location]);
    advance(beaten, map, T0);
    fund(beaten, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const armed = beaten.army.length;
    const repulse = attackLair(beaten, map, 'Goblins', ['Warden'], company);
    expect(repulse.result).toBe('Repelled');
    expect(repulse.losses.reduce((n, l) => n + l.count, 0)).toBeGreaterThan(0);
    expect(beaten.army.length).toBeLessThan(armed);
  });

  it('costs the supplies and the fallen when it fails, and nothing else', () => {
    // The Observatory's drake, answered by one hero from the first hour.
    const state = readyToFight();
    reveal(state, [LAIRS.Drake.location]);
    advance(state, map, T0);
    const supplies = lairSupplies('Drake');
    fund(state, { Gold: 20_000, Food: 5000, Stone: 2000 });
    const gold = getWallet(state.city.wallet, 'Gold');
    const report = attackLair(state, map, 'Drake', ['Warden'], []);
    expect(report.result).toBe('Repelled');
    expect(report.attack).toBeLessThan(report.power);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - supplies.Gold!);
    expect(lairIsCleared(state, 'Drake')).toBe(false);
    // …and a retry is identical to a first attempt.
    expect(attackLair(state, map, 'Drake', ['Warden'], company).result).toBe('Repelled');
  });

  it('refuses a lair still under the fog, and one already cleared', () => {
    const state = readyToFight();
    expect(attackLair(state, map, 'Harpies', ['Warden'], company).result).toBe('LairNotFound');
    attackLair(state, map, ORCS, ['Warden'], company);
    expect(attackLair(state, map, ORCS, ['Warden'], company).result).toBe('AlreadyCleared');
  });
});

describe('a save', () => {
  it('carries the clock, the hoard and the reports', () => {
    const state = watched();
    advance(state, map, T0 + 40 * MINUTE);
    const restored = deserialize(serialize(state, T0 + 40 * MINUTE), map, T0 + 40 * MINUTE)!;
    expect(restored.lairs[ORCS]).toEqual(state.lairs[ORCS]);
    expect(restored.raidReports.map((r) => r.took))
      .toEqual(state.raidReports.map((r) => r.took));
  });

  it('carries a cleared lair, so nothing re-infests it', () => {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < 24; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    attackLair(state, map, ORCS, ['Warden'], [{ unitId: 'Warrior', count: 24 }]);
    const restored = deserialize(serialize(state, T0), map, T0 + 7 * 24 * HOUR)!;
    expect(lairIsCleared(restored, ORCS)).toBe(true);
    expect(restored.lairs[ORCS]!.nextRaidAt).toBeNull();
  });
});

// The route the player actually taps: the lair card offers the LAIR while it
// stands, the widget names the garrison closest to coming down the hill, and
// clearing it closes the sheet — there is nothing behind it.
describe('the route to a lair', () => {
  function presenterAtTheBarrow() {
    const state = watched();
    addAllTrainers(state);
    // The company the chain musters before this fight (12-quests.md §2).
    for (let i = 0; i < 24; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    const game = freshPresenter(state);
    game.showLair(ORCS);
    return game;
  }

  it('offers the lair instead of a party while the garrison stands', () => {
    const game = presenterAtTheBarrow();
    expect(game.lairFor(ORCS)!.cleared).toBe(false);
    game.openLair(ORCS);
    expect(game.openOverlay).toBe('lair');
    // The sheet opens with the company already in its slots, ready to go.
    expect(game.partyHeroes).toEqual(['Warden']);
    expect(game.expeditionParty).toEqual([{ unitId: 'Warrior', count: 24 }]);
    expect(game.lairBlockText()).toBeNull();
    expect(game.lairPreview()!.enough).toBe(true);
  });

  it('clears it and closes the sheet', () => {
    const game = presenterAtTheBarrow();
    game.openLair(ORCS);
    game.doAttackLair();
    expect(game.openOverlay).toBeNull();
    expect(game.lairFor(ORCS)!.cleared).toBe(true);
    expect(game.raidWidget()).toBeNull();
  });

  it('names the garrison closest to raiding, and never opens itself', () => {
    const game = presenterAtTheBarrow();
    const widget = game.raidWidget()!;
    expect(widget.lairId).toBe(ORCS);
    expect(widget.creature).toBe('Orcs');
    expect(widget.raidsAt).toBe(T0 + LAIRS[ORCS].guard.warningMinutes * MINUTE);
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
    // The lair is out of trips, so nothing is counting and the tab is gone.
    expect(game.raidWidget()).toBeNull();
  });
});

// What the player is SHOWN is what the party fights. The formation is derived
// from `guard`, and the fight is scored against the formation — so a squad on
// the screen can never be decoration.
describe('the formation in the doorway', () => {
  it('LEADS with the lair\'s own creature, and is never only that', () => {
    // The generator spends the lion's share on the affinity and the rest
    // across the others (Docs/features/combat.md §11), so a doorway teaches
    // the matchup without being a single-answer puzzle.
    const state = freshGame();
    for (const id of LAIR_ORDER) {
      const squads = lairFormation(state, id);
      expect(squads.length).toBeGreaterThan(0);
      if (LAIRS[id].guard.threat !== 'Any') {
        expect(squads[0]!.unitId, `${id}'s lair`).toBe(LAIRS[id].guard.threat);
      }
      for (const squad of squads) {
        expect(squad.count).toBeGreaterThan(0);
        expect(squad.count).toBeLessThanOrEqual(UNITS[squad.unitId].squadSize);
      }
    }
  });

  it('is worth what the lair was authored to be worth', () => {
    const state = freshGame();
    for (const id of LAIR_ORDER) {
      const budget = LAIRS[id].guard.power;
      // Whole troops, so a formation lands a little under its budget and
      // never over it: what a board cannot hold, a doorway does not field.
      const spent = lairPower(state, id);
      expect(spent, `${id}'s lair`).toBeLessThanOrEqual(budget);
      expect(spent, `${id}'s lair`).toBeGreaterThan(budget * 0.75);
    }
  });

  it('is exactly what the attempt is scored against', () => {
    const state = watched();
    addAllTrainers(state);
    for (let i = 0; i < 24; i++) {
      state.army.push({ uniqueId: `u_${i}`, definitionId: 'Warrior' });
    }
    const company = [{ unitId: 'Warrior' as const, count: 24 }];
    const preview = previewLair(state, ORCS, ['Warden'], company);
    expect(preview.enemy).toEqual(lairFormation(state, ORCS));
    expect(preview.power).toBe(formationPower(preview.enemy));
    const report = attackLair(state, map, ORCS, ['Warden'], company);
    expect(report.power).toBe(preview.power);
  });
});

// Content, not machinery: the authored numbers have a shape the design states,
// and a map edit that breaks it should fail here rather than in a playtest.
describe('every authored lair', () => {
  it('is stronger the deeper the lair', () => {
    const powers = LAIR_ORDER.map((id: LairId) => LAIRS[id].guard.power);
    for (let i = 1; i < powers.length; i++) {
      expect(powers[i]).toBeGreaterThan(powers[i - 1]);
    }
  });

  it('counts in minutes, and a deeper lair gives longer', () => {
    const warnings = LAIR_ORDER.map((id: LairId) => LAIRS[id].guard.warningMinutes);
    for (const w of warnings) expect(w).toBeGreaterThanOrEqual(30);
    for (let i = 1; i < warnings.length; i++) {
      expect(warnings[i]).toBeGreaterThanOrEqual(warnings[i - 1]);
    }
  });
});

// The seatbelt in `advance()` is 10,000 boundary steps, and a raid clock is
// the first source in the game that fires on a MINUTE scale. Three trips a
// lair is what keeps it far away from that, and this is the arithmetic.
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
