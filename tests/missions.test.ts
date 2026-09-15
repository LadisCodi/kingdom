// The missions: what may be asked, how much of it, and when.
//
// The riskiest rule in the whole feature is ACTIVE PLAY ONLY — it is the one
// place offline replay and live ticking are meant to read differently, which
// is the opposite of what every other test in this repo holds. It is the first
// thing tested here and the reason `tallies` and `replaying` exist.

import { describe, expect, it } from 'vitest';
import { DISTRICTS, MISSIONS, RUINS } from '../src/sim/data/definitions';
import { recordEvent, tally } from '../src/sim/events';
import {
  MISSION_KINDS, canIssue, missionComplete, missionProgress, weekIndex, windowIndex,
} from '../src/sim/missions';
import { boardIsFull, boardMissions, rollMissionsIfDue } from '../src/sim/pass';
import { advance } from '../src/sim/commands';
import { rand } from '../src/sim/rng';
import { deserialize, serialize } from '../src/sim/save';
import { enterRoom } from '../src/sim/expeditions';
import {
  addAllTrainers, addBuilt, freshGame, fund, map, openRuin, reveal, T0,
} from './helpers';
import type { GameState, MissionKind } from '../src/sim/state';

const HOUR = 3_600_000;
const WINDOW = MISSIONS.windowHours * HOUR;

/** A kingdom that can be asked for most things. */
function playableKingdom(): GameState {
  const state = freshGame();
  addBuilt(state, 'Housing', { x: 3, y: 2 });
  addAllTrainers(state);
  fund(state, { Gold: 100_000, Food: 100_000, Wood: 100_000, Stone: 100_000 });
  return state;
}

describe('active play only', () => {
  it('moves the odometer live and never in a replay', () => {
    const state = freshGame();
    recordEvent(state, { kind: 'packOpened' });
    expect(tally(state, 'packs')).toBe(1);

    state.replaying = true;
    recordEvent(state, { kind: 'packOpened' });
    expect(tally(state, 'packs')).toBe(1); // the replay counted nothing

    state.replaying = false;
    recordEvent(state, { kind: 'packOpened' });
    expect(tally(state, 'packs')).toBe(2);
  });

  it('leaves a live mission exactly where it was across a three-day absence', () => {
    const state = playableKingdom();
    // A quiet city still earns taxes, and a "collect" mission would otherwise
    // fill itself while the player slept — which is the whole thing the rule
    // forbids.
    state.city.population = 8;
    rollMissionsIfDue(state, T0);
    const board = boardMissions(state, T0);
    expect(board.length).toBe(MISSIONS.perWindow);
    const before = board.map((m) => missionProgress(state, m));

    const loaded = deserialize(serialize(state, T0), map, T0 + 3 * 86_400_000)!;
    const after = boardMissions(loaded, T0 + 3 * 86_400_000);
    // The same missions, and not one of them moved.
    expect(after.map((m) => m.uniqueId)).toEqual(board.map((m) => m.uniqueId));
    expect(after.map((m) => missionProgress(loaded, m))).toEqual(before);
  });

  it('does move it when the same span is played through', () => {
    const state = playableKingdom();
    state.city.population = 8;
    const gold = tally(state, 'collect:Gold');
    advance(state, map, T0 + 6 * HOUR);
    expect(tally(state, 'collect:Gold')).toBeGreaterThan(gold);
  });

  it('replays the same whether it is one call or many', () => {
    const one = playableKingdom();
    one.city.population = 8;
    const many = playableKingdom();
    many.city.population = 8;

    const oneShot = deserialize(serialize(one, T0), map, T0 + 6 * HOUR)!;
    // Six one-hour reloads: each one replays with the flag set, exactly as the
    // single call does — invariant 1 still holds INSIDE the replay mode.
    let stepped = many;
    for (let h = 1; h <= 6; h++) {
      stepped = deserialize(serialize(stepped, T0 + (h - 1) * HOUR), map, T0 + h * HOUR)!;
    }
    expect(stepped.tallies).toEqual(oneShot.tallies);
  });
});

describe('the odometer', () => {
  it('never goes backwards when the army does', () => {
    const state = playableKingdom();
    for (let i = 0; i < 3; i++) {
      recordEvent(state, { kind: 'unitTrained', unit: 'Warrior' });
      state.army.push({ uniqueId: `u${i}`, definitionId: 'Warrior' });
    }
    expect(tally(state, 'troops')).toBe(3);
    // A room eats the whole squad. A baseline over `army.length` would now
    // read as minus three, which is the game taking progress back.
    state.army.length = 0;
    expect(tally(state, 'troops')).toBe(3);
  });

  it('counts a level twice — once in the total, once scoped', () => {
    const state = freshGame();
    recordEvent(state, { kind: 'districtLevel', district: 'Townhall', level: 2 });
    recordEvent(state, { kind: 'districtLevel', district: 'Housing', level: 2 });
    expect(tally(state, 'levels')).toBe(2);
    expect(tally(state, 'levels:Townhall')).toBe(1);
  });

  it('leaves the quest chain alone', () => {
    const state = freshGame();
    const before = state.quests.progress;
    for (const e of [
      { kind: 'districtLevel', district: 'Housing' as const, level: 2 },
      { kind: 'unitTrained', unit: 'Warrior' as const },
      { kind: 'villager' as const },
      { kind: 'heroLevel', hero: 'Warden' as const },
      { kind: 'roomCleared', ruin: 'HollowBarrow' as const },
      { kind: 'depthCleared', ruin: 'HollowBarrow' as const },
      { kind: 'packOpened' as const },
    ] as const) {
      recordEvent(state, e);
    }
    expect(state.quests.progress).toBe(before);
  });
});

describe('what may be asked', () => {
  it('refuses every kind a fresh kingdom cannot do, and never the fallback', () => {
    const state = freshGame();
    expect(canIssue(state, 'CollectResource')).toBe(true);
    expect(canIssue(state, 'ClearRooms')).toBe(false);   // no ruin open
    expect(canIssue(state, 'CompleteDepths')).toBe(false);
    expect(canIssue(state, 'TrainTroops')).toBe(false);  // no trainer
  });

  it('refuses the Townhall once it is maxed', () => {
    const state = playableKingdom();
    const hall = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    expect(canIssue(state, 'RaiseTownhall')).toBe(true);
    hall.level = DISTRICTS.Townhall.maxLevel;
    expect(canIssue(state, 'RaiseTownhall')).toBe(false);
  });

  it('refuses upgrades once every district is maxed', () => {
    const state = playableKingdom();
    expect(canIssue(state, 'UpgradeDistricts')).toBe(true);
    for (const d of state.city.districts) d.level = DISTRICTS[d.definitionId].maxLevel;
    expect(canIssue(state, 'UpgradeDistricts')).toBe(false);
  });

  it('opens the dungeon kinds once a ruin is', () => {
    const state = playableKingdom();
    expect(canIssue(state, 'ClearRooms')).toBe(false);
    openRuin(state, 'HollowBarrow');
    expect(canIssue(state, 'ClearRooms')).toBe(true);
  });

  it('never issues one that is impossible, or already done', () => {
    // Every kind refused except the fallback: the board must still fill.
    const state = freshGame();
    for (const d of state.city.districts) d.level = DISTRICTS[d.definitionId].maxLevel;
    state.heroes.owned = [];
    rollMissionsIfDue(state, T0);
    const board = boardMissions(state, T0);
    expect(board.length).toBe(MISSIONS.perWindow);
    for (const m of board) {
      expect(canIssue(state, m.kind)).toBe(true);
      expect(missionComplete(state, m)).toBe(false);
      expect(m.target).toBeGreaterThan(0);
    }
  });

  it('prices a collect target in the city its own production', () => {
    const poor = playableKingdom();
    const rich = playableKingdom();
    reveal(rich, [{ x: 1, y: 3 }, { x: 1, y: 4 }]);
    for (const d of rich.city.districts) {
      if (DISTRICTS[d.definitionId].maxWorkersPerLevel.length > 0) d.level = 5;
    }
    rich.city.population = 40;
    rollMissionsIfDue(poor, T0);
    rollMissionsIfDue(rich, T0);
    // Same seed, same window: the KIND is the same, so any difference in the
    // target is the city's own rate and nothing else.
    const a = boardMissions(poor, T0).find((m) => m.kind === 'CollectResource');
    const b = boardMissions(rich, T0).find((m) => m.kind === 'CollectResource');
    if (a && b) expect(b.target).toBeGreaterThanOrEqual(a.target);
  });
});

describe('the board', () => {
  it('issues two a window and nothing in between', () => {
    const state = playableKingdom();
    rollMissionsIfDue(state, T0);
    expect(boardMissions(state, T0).length).toBe(MISSIONS.perWindow);
    rollMissionsIfDue(state, T0 + 60_000);
    expect(boardMissions(state, T0).length).toBe(MISSIONS.perWindow);
    rollMissionsIfDue(state, T0 + WINDOW);
    expect(boardMissions(state, T0).length).toBe(2 * MISSIONS.perWindow);
  });

  it('blocks when it is full, and owes nothing later', () => {
    const state = playableKingdom();
    let t = T0;
    while (!boardIsFull(state, t)) {
      rollMissionsIfDue(state, t);
      t += WINDOW;
    }
    expect(boardMissions(state, t).length).toBe(MISSIONS.boardSize);
    // Ten windows pass with the board full.
    rollMissionsIfDue(state, t + 10 * WINDOW);
    expect(boardMissions(state, t).length).toBe(MISSIONS.boardSize);
    // Space frees; the NEXT window fills it, not the ten that were skipped.
    state.kingdom.pass.live.splice(0, 4);
    rollMissionsIfDue(state, t + 11 * WINDOW);
    expect(boardMissions(state, t).length).toBe(4 + MISSIONS.perWindow);
  });

  it('issues one window s worth on return from a long absence', () => {
    const state = playableKingdom();
    const back = T0 + 30 * 86_400_000;
    rollMissionsIfDue(state, back);
    // Read at the instant it was rolled: thirty days is past the season, and
    // the board is the SEASON's — a stale one reads as empty, which is the
    // pull rule doing its job rather than a miscount.
    expect(boardMissions(state, back).length).toBe(MISSIONS.perWindow);
    expect(boardMissions(state, T0).length).toBe(0);
  });

  it('holds a kind to its weekly quota', () => {
    const state = freshGame();
    // Every kind refused but the fallback, so the quota is the only thing
    // that can stop it repeating — and it has to give way rather than leave
    // the board empty.
    for (const d of state.city.districts) d.level = DISTRICTS[d.definitionId].maxLevel;
    state.heroes.owned = [];
    const week = weekIndex(T0);
    for (let w = 0; w < 6; w++) rollMissionsIfDue(state, T0 + w * WINDOW);
    expect(state.kingdom.pass.week).toBe(week);
    expect(boardMissions(state, T0).length).toBeGreaterThan(MISSIONS.weeklyQuota);
  });

  it('resets the quota with the week', () => {
    const state = playableKingdom();
    rollMissionsIfDue(state, T0);
    expect(Object.keys(state.kingdom.pass.issuedThisWeek).length).toBeGreaterThan(0);
    rollMissionsIfDue(state, T0 + 8 * 86_400_000);
    expect(weekIndex(T0 + 8 * 86_400_000)).toBeGreaterThan(weekIndex(T0));
    const issued = Object.values(state.kingdom.pass.issuedThisWeek)
      .reduce((a, b) => a + b, 0);
    expect(issued).toBe(MISSIONS.perWindow);
  });
});

describe('determinism', () => {
  it('rolls the same board for the same seed and window', () => {
    const a = playableKingdom();
    const b = playableKingdom();
    b.seed = a.seed;
    rollMissionsIfDue(a, T0);
    rollMissionsIfDue(b, T0);
    expect(boardMissions(b, T0).map((m) => [m.kind, m.target]))
      .toEqual(boardMissions(a, T0).map((m) => [m.kind, m.target]));
  });

  it('does not reshuffle the others when a kind leaves the pool', () => {
    // THE PROPERTY RULE 4 BUYS. A kind is scored by its OWN id, so the
    // ranking of any subset is a restriction of the ranking of the whole set
    // — adding a twelfth kind inserts one score and moves nothing else. A
    // `pick` over a list whose length changed would re-roll every window in
    // the game.
    const seed = 0x5eed;
    const order = (pool: readonly MissionKind[], window: number, slot: number) =>
      [...pool].sort((a, b) =>
        rand(seed, 'missionKind', window, slot, b) - rand(seed, 'missionKind', window, slot, a));
    for (const [w, s] of [[0, 0], [7, 1], [1234, 0]] as const) {
      const whole = order(MISSION_KINDS, w, s);
      for (const dropped of MISSION_KINDS) {
        expect(order(MISSION_KINDS.filter((k) => k !== dropped), w, s))
          .toEqual(whole.filter((k) => k !== dropped));
      }
    }
  });
});

describe('the windows themselves', () => {
  it('lands on 00:00, 08:00 and 16:00 UTC', () => {
    for (const hhmm of ['00:00', '08:00', '16:00']) {
      const t = Date.parse(`2026-09-15T${hhmm}:00Z`);
      expect(windowIndex(t)).toBe(windowIndex(t + 1));
      expect(windowIndex(t - 1)).toBe(windowIndex(t) - 1);
    }
  });

  it('starts a week on a Monday', () => {
    const monday = Date.parse('2026-09-14T00:00:00Z');
    expect(new Date(monday).getUTCDay()).toBe(1);
    expect(weekIndex(monday)).toBe(weekIndex(monday + 1));
    expect(weekIndex(monday - 1)).toBe(weekIndex(monday) - 1);
  });
});

describe('the dungeon no longer pays packs', () => {
  it('pays gold and a room event instead', () => {
    const state = playableKingdom();
    reveal(state, [RUINS.HollowBarrow.location]);
    openRuin(state, 'HollowBarrow');
    for (let i = 0; i < 400; i++) {
      state.army.push({ uniqueId: `u${i}`, definitionId: 'Warrior' });
    }
    const packs = state.collection.packs.length;
    const report = enterRoom(state, map, 'HollowBarrow', ['Warden'],
      [{ unitId: 'Warrior', count: 400 }]);
    expect(report.result).toBe('Cleared');
    expect(state.collection.packs.length).toBe(packs);
    expect(tally(state, 'rooms')).toBe(1);
  });
});
