// What the sim NOTICES, and the odometer it keeps of it.
//
// One dispatcher, two readers. `recordEvent` is called from the handful of
// places where something a player can be asked for actually HAPPENS — a level
// completes, a trainee lands, a cell is revealed — and from there it feeds the
// quest chain and bumps a lifetime counter on `state.tallies`, which nothing
// in the game reads: it is for the person reading a playtester's save
// (Docs/playtest.md §5).
//
// ACTIVE PLAY ONLY. `state.replaying` is set around the load path's catch-up
// advance and nowhere else; while it is set the odometer does not move.

import { recordQuestEvent } from './quests';
import type {
  CurrencyId, DistrictId, FeatureId, GameState, HeroId, UnitId,
} from './state';

/**
 * Everything the sim announces.
 *
 * `recordQuestEvent`'s switch ends in a `default`, so a kind here the quest
 * chain has no goal for costs it nothing.
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
  | { kind: 'itemUsed'; count: number }
  /** A playtest signal (Docs/playtest.md §5): counted on `signal:<key>` and
   *  read by nothing in the game — it is for the person reading the save. */
  | { kind: 'signal'; key: string };

/**
 * WHICH ODOMETER AN EVENT BUMPS, as a key.
 *
 * Strings rather than a union because half of them are scoped — `collect:Wood`
 * and `levels:Townhall` are the same event counted two ways. A key nobody has
 * bumped reads as 0, so this needs no initialisation and no migrator.
 */
function keysFor(event: SimEvent): string[] {
  switch (event.kind) {
    case 'collect': return [`collect:${event.currency}`];
    case 'tap': return ['taps'];
    case 'reveal': return ['reveal'];
    // A level is counted twice: once in the total, and once scoped to the
    // building.
    case 'districtLevel': return ['levels', `levels:${event.district}`];
    case 'districtBuilt': return ['built', `built:${event.district}`];
    case 'unitTrained': return ['troops', `troops:${event.unit}`];
    case 'villager': return ['villagers'];
    case 'heroLevel': return ['heroLevels'];
    case 'itemUsed': return ['items'];
    case 'signal': return [`signal:${event.key}`];
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
  const amount = event.kind === 'collect' ? event.amount : event.kind === 'itemUsed' ? event.count : 1;
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
 * must not leave the odometer held for good.
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
