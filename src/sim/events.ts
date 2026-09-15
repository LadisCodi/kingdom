// What the sim NOTICES, and the odometer it keeps of it.
//
// One dispatcher, two readers. `recordEvent` is called from the handful of
// places where something a player can be asked for actually HAPPENS — a level
// completes, a trainee lands, a room falls — and from there it feeds the quest
// chain (unchanged) and bumps a lifetime counter the season pass's missions
// read (sim/missions.ts).
//
// WHY AN ODOMETER RATHER THAN A SNAPSHOT. A mission is relative: it stores a
// BASE and asks for `meter − base`. That only works if the meter never falls.
// `state.army.length` falls when a room kills soldiers; `wallet.Wood` falls
// when you spend it. Baselining either would UN-PROGRESS "train 5 troops"
// after a bad fight, which reads as the game taking something back. A counter
// that only ever goes up cannot do that.
//
// THE TALLIES ARE NOT SEASONAL. They sit at the top level of `GameState`,
// outside every season-stamped block, because a live mission's base is a
// reading of one: a wipe that touched them would silently move every mission
// on the board.
//
// ACTIVE PLAY ONLY. `state.replaying` is set around the load path's catch-up
// advance and nowhere else; while it is set the odometer does not move. That
// is the one place in this codebase where offline replay and live ticking
// deliberately disagree — see the field's note in state.ts.

import { recordQuestEvent } from './quests';
import type {
  CurrencyId, DistrictId, FeatureId, GameState, HeroId, RuinId, UnitId,
} from './state';

/**
 * Everything the sim announces.
 *
 * The first three are the quest chain's own vocabulary and predate the
 * missions; the rest were added for them. `recordQuestEvent`'s switch ends in
 * a `default`, so a new kind here costs the chain nothing.
 */
export type SimEvent =
  | { kind: 'collect'; currency: CurrencyId; amount: number }
  | { kind: 'tap' }
  /** `feature` is whatever was standing on the cell, or null for bare ground. */
  | { kind: 'reveal'; feature: FeatureId | null }
  /** A district finished a LEVEL — level 2 and up, never the build. */
  | { kind: 'districtLevel'; district: DistrictId; level: number }
  /** A district finished its BUILD — level 1, the first time it stands. */
  | { kind: 'districtBuilt'; district: DistrictId }
  | { kind: 'unitTrained'; unit: UnitId }
  /** A villager was delivered — the one path population grows by. */
  | { kind: 'villager' }
  | { kind: 'heroLevel'; hero: HeroId }
  | { kind: 'roomCleared'; ruin: RuinId }
  | { kind: 'depthCleared'; ruin: RuinId }
  | { kind: 'packOpened' };

/**
 * WHICH ODOMETER AN EVENT BUMPS, as a key.
 *
 * Strings rather than a union because half of them are scoped — `collect:Wood`
 * and `levels:Townhall` are the same event counted two ways — and a mission
 * stores the key it is watching. A key nobody has bumped reads as 0, so this
 * needs no initialisation and no migrator.
 */
function keysFor(event: SimEvent): string[] {
  switch (event.kind) {
    case 'collect': return [`collect:${event.currency}`];
    case 'tap': return ['taps'];
    case 'reveal': return ['reveal'];
    // A level is counted twice: once in the total every "upgrade buildings X
    // times" mission reads, and once scoped, so "raise the Townhall" can ask
    // about one building without a counter of its own.
    case 'districtLevel': return ['levels', `levels:${event.district}`];
    case 'districtBuilt': return ['built', `built:${event.district}`];
    case 'unitTrained': return ['troops', `troops:${event.unit}`];
    case 'villager': return ['villagers'];
    case 'heroLevel': return ['heroLevels'];
    case 'roomCleared': return ['rooms'];
    case 'depthCleared': return ['depths'];
    case 'packOpened': return ['packs'];
    default: return [];
  }
}

/**
 * Announce one event.
 *
 * The quest chain sees it FIRST and exactly as it always did, then the
 * odometer moves. The `amount` on a collect is the amount: a haul of 40 Wood
 * is 40 on the meter, not one.
 */
export function recordEvent(state: GameState, event: SimEvent): void {
  recordQuestEvent(state, event);
  if (state.replaying) return;
  const amount = event.kind === 'collect' ? event.amount : 1;
  if (amount <= 0) return;
  for (const key of keysFor(event)) {
    state.tallies[key] = (state.tallies[key] ?? 0) + amount;
  }
}

/** What an odometer reads. Never written by anything but `recordEvent`. */
export const tally = (state: GameState, key: string): number => state.tallies[key] ?? 0;

/**
 * Run `fn` with the odometer held still — the load path's catch-up replay.
 *
 * A try/finally rather than two assignments because an advance that throws
 * must not leave the game permanently unable to progress a mission.
 */
export function withoutTallies<T>(state: GameState, fn: () => T): T {
  const before = state.replaying;
  state.replaying = true;
  try {
    return fn();
  } finally {
    state.replaying = before;
  }
}
