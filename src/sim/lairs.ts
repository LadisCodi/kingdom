// The lair — a garrison with a clock (Docs/features/18-garrisons-and-raids.md).
//
// Every lair holds one garrison, and DISCOVERING
// the lair starts its counter. When the counter runs out the garrison walks to
// the city and takes a slice of what sits UNCOLLECTED in the buildings'
// stores — never the wallet; it does that at most
// three times and then sits on what it took. Clearing the lair stops the clock
// and hands the whole hoard back.
//
// FOUR RULES DECIDE EVERYTHING HERE, and each of them is load-bearing.
//
//  1. A RAID IS NOT A FIGHT. Nothing at home defends. The only answer is to go
//     and clear the lair, which is the point: the raid is the incentive that
//     sends a player to the lair, not a punishment for being away.
//  2. IT IS A TIMER, NOT PRODUCTION. It runs and resolves in full while the
//     player is away.
//  3. A RAID IS PRICED IN PRODUCTION, NOT IN UNITS. It takes `take_seconds` of
//     the city's own output of each material, capped by a fraction of what
//     the stores hold. What is in the wallet is safe: collecting is the
//     defence. `cityRate` is a FACT about the city rather than an accrual, so a
//     raid replays identically however the window was split — and a material
//     the city does not produce is never taken.
//  4. IT IS RECOVERABLE. The hoard is a per-lair counter, and clearing pays
//     every coin of it back. That is what lets the first promise survive a
//     system that takes: nothing is taken that cannot be taken back.
//
// The FIGHT is not here. Clearing a lair is a party command — supplies, a
// hero, a matchup — and it lives beside the delve launch in `expeditions.ts`,
// which already owns all three. This module owns the clock, the take and the
// hoard, and it imports nothing from expeditions so that the party code can
// ask it whether the lair still stands.

import { GARRISONS, RAID, LAIRS, LAIR_ORDER, garrisonForTier } from './data/definitions';
import type { EnemySquad } from './combat';
import { boardPower, buildBoard, generateEnemy, type Board } from './battle';
import { fogState } from './fog';
import type { MapData } from './grid';
import { cityGoldPerMinute } from './population';
import { cityGatherPerSecond } from './upgrades';
import { cityStored, storedOf, takeFromStore } from './storage';
import {
  addToWallet, newId,
  type GameState, type LairState, type LairId, type Wallet,
} from './state';

/** What a raid can take. Materials only — never Gems, Mana, Knowledge,
 *  Stardust, Hero XP, goods, relics, heroes or units. Iterated in this fixed
 *  order so a raid writes the same report in replay as in live ticking. */
export const RAIDABLE = ['Gold', 'Food', 'Wood', 'Stone'] as const;

export type RaidableId = (typeof RAIDABLE)[number];

export const lairOf = (state: GameState, lairId: LairId): LairState | undefined =>
  state.lairs[lairId];

/** True once a party has beaten the garrison. A cleared lair is gone for
 *  good: there is no re-infestation. */
export const lairIsCleared = (state: GameState, lairId: LairId): boolean =>
  state.lairs[lairId]?.cleared === true;

/** The lair still stands. A lair nobody has found yet has no state at all,
 *  and reads as standing. */
export const lairStands = (state: GameState, lairId: LairId): boolean =>
  !lairIsCleared(state, lairId);

/** Lairs the player has met and not yet cleared, in lair order. */
export const openLairs = (state: GameState): LairId[] =>
  LAIR_ORDER.filter((id) => state.lairs[id] !== undefined && !state.lairs[id]!.cleared);

/** How many raids this garrison has left in it. */
export const tripsLeft = (lair: LairState): number =>
  Math.max(0, RAID.maxRaids - lair.trips);

// ------------------------------------------------------------------ arming

/**
 * Start the counter on every lair the player can now SEE.
 *
 * A SWEEP rather than a hook, for the reason `recordVisibleSites` is one: fog
 * state is derived, so "became visible" is not a mutation there is a single
 * write to hang off. It runs inside `advance()`, which is what stamps the
 * counter with a boundary's `t` instead of a clock the sim is not allowed to
 * read — and it is also what arms a save written before lairs existed, on the
 * first advance after the update, with the full warning rather than a raid
 * already overdue.
 *
 * Visible means not `Undiscovered`, exactly like the discovery banner: the
 * moment a player can make the place out is the moment the garrison notices
 * them back.
 */
export function armLairs(state: GameState, map: MapData, t: number): void {
  for (const id of LAIR_ORDER) {
    if (state.lairs[id] !== undefined) continue;
    if (fogState(state, map, LAIRS[id].location) === 'Undiscovered') continue;
    state.lairs[id] = {
      nextRaidAt: t + LAIRS[id].guard.warningMinutes * 60_000,
      trips: 0,
      hoard: {},
      cleared: false,
    };
  }
}

// ------------------------------------------------------------------- raids

/**
 * What the city makes of one material a second — the crews' gather rate, plus
 * rent for Gold. It is what the city produces NOW, not what it has banked, so
 * the same raid resolves to the same number however `advance()` split the
 * window around it.
 */
export function cityRatePerSecond(state: GameState, currency: RaidableId): number {
  const gathered = cityGatherPerSecond(state, currency);
  return currency === 'Gold' ? gathered + cityGoldPerMinute(state) / 60 : gathered;
}

/**
 * What one raid on this lair would take right now.
 *
 * `take_seconds` bounds it on full stores — a raid is a number of SECONDS of
 * the city's own work, so it stays the same size relative to the city as the
 * city grows — and `take_fraction_max` bounds it on nearly empty ones, so a
 * player who collects often loses little. The wallet is never touched.
 */
export function raidTake(state: GameState, lairId: LairId): Wallet {
  const seconds = garrisonForTier(LAIRS[lairId].tier).takeSeconds;
  const took: Wallet = {};
  for (const c of RAIDABLE) {
    const produced = cityRatePerSecond(state, c) * seconds;
    if (produced <= 0) continue; // they take from what you MAKE
    const stored = cityStored(state, c);
    const take = Math.floor(Math.min(produced, stored * RAID.takeFractionMax));
    if (take > 0) took[c] = take;
  }
  return took;
}

export interface RaidEvent {
  lairId: LairId;
  took: Wallet;
  /** Trips the garrison has spent, after this one. */
  trips: number;
  /** True when this was its last: it sits on the hoard from here. */
  done: boolean;
}

/**
 * Resolve every raid due by `t`. Runs in `applyDueAt`, because a raid changes
 * the wallet another subsystem may be reading — and in LAIR ORDER, so two
 * lairs due at the same instant always take in the same sequence.
 *
 * A raid that takes nothing costs the garrison no trip. It still moves its
 * clock on, so a city that produces nothing today is raided for nothing and
 * still owes three real raids once it does — the trip limit bounds what is
 * TAKEN, and taking nothing is not a raid worth counting.
 */
export function advanceRaids(state: GameState, t: number): RaidEvent[] {
  const events: RaidEvent[] = [];
  for (const lairId of LAIR_ORDER) {
    const lair = state.lairs[lairId];
    if (!lair) continue;
    // Bounded: each pass either stops the clock or pushes it a whole period
    // forward, and the period is at least a minute.
    while (lair.nextRaidAt !== null && lair.nextRaidAt <= t && !lair.cleared) {
      const took = raidTake(state, lairId);
      let taken = 0;
      for (const [c, n] of Object.entries(took)) {
        const got = takeFromStores(state, c as RaidableId, n);
        if (got <= 0) { delete took[c as RaidableId]; continue; }
        took[c as RaidableId] = got;
        lair.hoard[c as RaidableId] = (lair.hoard[c as RaidableId] ?? 0) + got;
        taken += got;
      }
      if (taken > 0) {
        lair.trips += 1;
        state.raidReports.push({
          id: newId(state, 'raid'), lairId, at: lair.nextRaidAt, took,
        });
      }
      const done = lair.trips >= RAID.maxRaids;
      lair.nextRaidAt = done
        ? null
        : lair.nextRaidAt + LAIRS[lairId].guard.periodMinutes * 60_000;
      if (taken > 0 || done) events.push({ lairId, took, trips: lair.trips, done });
    }
  }
  return events;
}

/**
 * Take `amount` of one material out of the city's stores, each store giving
 * its share of what they hold between them — rounded up, in district order,
 * so the same raid takes the same units from the same buildings in replay.
 */
function takeFromStores(state: GameState, c: RaidableId, amount: number): number {
  const total = cityStored(state, c);
  if (total <= 0 || amount <= 0) return 0;
  let left = Math.min(amount, total);
  for (const d of state.city.districts) {
    if (left <= 0) break;
    const here = storedOf(d, c);
    if (here <= 0) continue;
    left -= takeFromStore(d, c, Math.min(left, Math.ceil((amount * here) / total)));
  }
  return Math.min(amount, total) - left;
}

/** A boundary source: the earliest raid still to come. */
export function nextRaidBoundary(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const id of LAIR_ORDER) {
    const lair = state.lairs[id];
    if (!lair || lair.cleared || lair.nextRaidAt === null) continue;
    if (lair.nextRaidAt <= after) continue;
    if (best === null || lair.nextRaidAt < best) best = lair.nextRaidAt;
  }
  return best;
}

// --------------------------------------------------------- the formation

/**
 * What is standing in the doorway.
 *
 * Derived from the lair's `guard`, never authored: `threat` says WHICH type
 * holds it and `power` says how much of it there is
 * (Docs/features/18-garrisons-and-raids.md §2). The generator is the
 * resolver's (`combat.ts`, combat.md §11) — a lair is a room, and a room's
 * enemies are made one way.
 */
export function lairBoard(state: GameState, lairId: LairId): Board {
  const guard = LAIRS[lairId].guard;
  const plan = generateEnemy({
    seed: state.seed,
    parts: [ROLL_KEY[lairId], 'gate'],
    budget: guard.power,
    affinity: guard.threat,
  });
  return buildBoard(plan.squads, plan.fighters);
}

/**
 * What each lair's formation is rolled under. The lairs were rolled under the
 * ids of the places they used to be, and the roll is keyed on the EVENT
 * (`rng.ts`), so renaming them must not re-roll a garrison the player has
 * already looked at: the key stays the old id, whatever the lair is called.
 */
const ROLL_KEY: Record<LairId, string> = {
  Orcs: 'HollowBarrow',
  Harpies: 'SunkenChapel',
  Goblins: 'DrownedIronworks',
  WolfRiders: 'CountingHouse',
  Drake: 'StarObservatory',
};

/** The squads in the doorway, for the sheet that draws them. */
export const lairFormation = (state: GameState, lairId: LairId): EnemySquad[] =>
  lairBoard(state, lairId).slots
    .filter((s) => s.unitId !== null)
    .map((s) => ({ unitId: s.unitId!, count: s.count }));

/** The lair's power, read off the board that is actually standing there. */
export const lairPower = (state: GameState, lairId: LairId): number =>
  boardPower(lairBoard(state, lairId));

// ---------------------------------------------------------------- clearing

/**
 * The lair falls: the clock stops and the hoard comes home, in full.
 *
 * Called by the party command that won the fight (`expeditions.ts`), never on
 * its own — this module has no opinion about how a garrison is beaten, only
 * about what is owed when it is.
 */
export function markLairCleared(state: GameState, lairId: LairId): Wallet {
  const lair = state.lairs[lairId];
  if (!lair || lair.cleared) return {};
  const hoard: Wallet = { ...lair.hoard };
  for (const [c, n] of Object.entries(hoard)) {
    if (n > 0) addToWallet(state.city.wallet, c as RaidableId, n);
  }
  lair.cleared = true;
  lair.nextRaidAt = null;
  lair.hoard = {};
  // The reports for a lair that no longer exists are stale news.
  state.raidReports = state.raidReports.filter((r) => r.lairId !== lairId);
  return hoard;
}

/** How many lairs the player has beaten — the `ClearLairs` quest goal. */
export const clearedLairCount = (state: GameState): number =>
  LAIR_ORDER.filter((id) => lairIsCleared(state, id)).length;

// ----------------------------------------------------------- the read-out

/** What clearing this lair costs in supplies: a flat price per lair tier,
 *  paid on entry and never refunded, win or lose. */
export const lairSupplies = (lairId: LairId): Wallet =>
  ({ ...garrisonForTier(LAIRS[lairId].tier).supplies });

/** The creature the threat reads as. Derived, never a second authored list:
 *  a lair says what TYPE holds it and the fiction follows. */
const CREATURES: Record<string, string> = {
  Warrior: 'Orcs',
  Lancer: 'Goblins',
  Archer: 'Harpies',
  Cavalry: 'Wolf riders',
  Any: 'A drake',
};

export const lairCreature = (lairId: LairId): string =>
  CREATURES[LAIRS[lairId].guard.threat] ?? 'A warband';

/** Everything the widget and the lair sheet need about one lair. */
export interface LairView {
  lairId: LairId;
  creature: string;
  threat: (typeof LAIRS)[LairId]['guard']['threat'];
  power: number;
  nextRaidAt: number | null;
  tripsLeft: number;
  hoard: Wallet;
  cleared: boolean;
}

export function lairView(state: GameState, lairId: LairId): LairView | null {
  const lair = state.lairs[lairId];
  if (!lair) return null;
  return {
    lairId,
    creature: lairCreature(lairId),
    threat: LAIRS[lairId].guard.threat,
    power: LAIRS[lairId].guard.power,
    nextRaidAt: lair.nextRaidAt,
    tripsLeft: tripsLeft(lair),
    hoard: { ...lair.hoard },
    cleared: lair.cleared,
  };
}

/** The lair whose raid lands soonest — what the widget names. */
export function nextLairToRaid(state: GameState): LairId | null {
  let best: LairId | null = null;
  let at = Infinity;
  for (const id of openLairs(state)) {
    const lair = state.lairs[id]!;
    if (lair.nextRaidAt === null || lair.nextRaidAt >= at) continue;
    at = lair.nextRaidAt;
    best = id;
  }
  return best;
}

export const dismissRaidReports = (state: GameState): void => {
  state.raidReports = [];
};

/** The authored tiers, for the dev read-out and the tests. */
export const GARRISON_TIERS = GARRISONS;
