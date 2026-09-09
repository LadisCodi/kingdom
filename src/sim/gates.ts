// The gate — a garrison with a clock (Docs/features/18-garrisons-and-raids.md).
//
// Every ruin opens with one garrison camped on its doorstep, and DISCOVERING
// the ruin starts its counter. When the counter runs out the garrison walks to
// the city and takes a slice of the banked materials; it does that at most
// three times and then sits on what it took. Clearing the gate stops the clock
// and hands the whole hoard back.
//
// FOUR RULES DECIDE EVERYTHING HERE, and each of them is load-bearing.
//
//  1. A RAID IS NOT A FIGHT. Nothing at home defends. The only answer is to go
//     and clear the gate, which is the point: the gate is the incentive that
//     sends a player into the ruin, not a punishment for being away.
//  2. IT IS A TIMER, NOT PRODUCTION. It runs and resolves in full while the
//     player is away — the 8-hour offline cap limits what the city MAKES,
//     never what a clock does.
//  3. A RAID IS PRICED IN PRODUCTION, NOT IN UNITS. It takes `take_seconds` of
//     the city's own output of each material, capped by a fraction of the
//     purse. `cityRate` is a FACT about the city rather than an accrual, so a
//     raid replays identically however the window was split — and a material
//     the city does not produce is never taken.
//  4. IT IS RECOVERABLE. The hoard is a per-gate counter, and clearing pays
//     every coin of it back. That is what lets the first promise survive a
//     system that takes: nothing is taken that cannot be taken back.
//
// The FIGHT is not here. Clearing a gate is a party command — supplies, a
// hero, a matchup — and it lives beside the delve launch in `expeditions.ts`,
// which already owns all three. This module owns the clock, the take and the
// hoard, and it imports nothing from expeditions so that the delve can ask it
// whether the gate still stands.

import {
  GARRISONS, RAID, RUINS, RUIN_ORDER, UNITS, UNIT_ORDER, garrisonForTier,
} from './data/definitions';
import { fogState } from './fog';
import type { MapData } from './grid';
import { cityGoldPerMinute } from './population';
import { cityGatherPerSecond } from './upgrades';
import {
  addToWallet, getWallet, newId,
  type GameState, type GateState, type RuinId, type UnitId, type Wallet,
} from './state';

/** What a raid can take. Materials only — never Gems, Mana, Knowledge,
 *  Stardust, Hero XP, goods, relics, heroes or units. Iterated in this fixed
 *  order so a raid writes the same report in replay as in live ticking. */
export const RAIDABLE = ['Gold', 'Food', 'Wood', 'Stone'] as const;

export type RaidableId = (typeof RAIDABLE)[number];

export const gateOf = (state: GameState, ruinId: RuinId): GateState | undefined =>
  state.gates[ruinId];

/** True once a party has beaten the garrison. A cleared gate is gone for
 *  good: there is no re-infestation. */
export const gateIsCleared = (state: GameState, ruinId: RuinId): boolean =>
  state.gates[ruinId]?.cleared === true;

/** The gate is up and the ruin is shut behind it. A ruin nobody has found
 *  yet has no gate state at all, and reads as standing — you cannot delve
 *  what you have not discovered either. */
export const gateStands = (state: GameState, ruinId: RuinId): boolean =>
  !gateIsCleared(state, ruinId);

/** Gates the player has met and not yet cleared, in ruin order. */
export const openGates = (state: GameState): RuinId[] =>
  RUIN_ORDER.filter((id) => state.gates[id] !== undefined && !state.gates[id]!.cleared);

/** How many raids this garrison has left in it. */
export const tripsLeft = (gate: GateState): number =>
  Math.max(0, RAID.maxRaids - gate.trips);

// ------------------------------------------------------------------ arming

/**
 * Start the counter on every gate the player can now SEE.
 *
 * A SWEEP rather than a hook, for the reason `recordVisibleSites` is one: fog
 * state is derived, so "became visible" is not a mutation there is a single
 * write to hang off. It runs inside `advance()`, which is what stamps the
 * counter with a boundary's `t` instead of a clock the sim is not allowed to
 * read — and it is also what arms a save written before gates existed, on the
 * first advance after the update, with the full warning rather than a raid
 * already overdue.
 *
 * Visible means not `Undiscovered`, exactly like the discovery banner: the
 * moment a player can make the place out is the moment the garrison notices
 * them back.
 */
export function armGates(state: GameState, map: MapData, t: number): void {
  for (const id of RUIN_ORDER) {
    if (state.gates[id] !== undefined) continue;
    if (fogState(state, map, RUINS[id].location) === 'Undiscovered') continue;
    state.gates[id] = {
      nextRaidAt: t + RUINS[id].guard.warningMinutes * 60_000,
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
 * What one raid on this ruin would take right now.
 *
 * `take_seconds` bounds it on a large purse — a raid is a number of SECONDS of
 * the city's own work, so it stays the same size relative to the city as the
 * city grows — and `take_fraction_max` bounds it on a small one, so a player
 * who has just started is never cleaned out.
 */
export function raidTake(state: GameState, ruinId: RuinId): Wallet {
  const seconds = garrisonForTier(RUINS[ruinId].tier).takeSeconds;
  const took: Wallet = {};
  for (const c of RAIDABLE) {
    const produced = cityRatePerSecond(state, c) * seconds;
    if (produced <= 0) continue; // they take from what you MAKE
    const banked = getWallet(state.city.wallet, c);
    const take = Math.floor(Math.min(produced, banked * RAID.takeFractionMax));
    if (take > 0) took[c] = take;
  }
  return took;
}

export interface RaidEvent {
  ruinId: RuinId;
  took: Wallet;
  /** Trips the garrison has spent, after this one. */
  trips: number;
  /** True when this was its last: it sits on the hoard from here. */
  done: boolean;
}

/**
 * Resolve every raid due by `t`. Runs in `applyDueAt`, because a raid changes
 * the wallet another subsystem may be reading — and in RUIN ORDER, so two
 * gates due at the same instant always take in the same sequence.
 *
 * A raid that takes nothing costs the garrison no trip. It still moves its
 * clock on, so a city that produces nothing today is raided for nothing and
 * still owes three real raids once it does — the trip limit bounds what is
 * TAKEN, and taking nothing is not a raid worth counting.
 */
export function advanceRaids(state: GameState, t: number): RaidEvent[] {
  const events: RaidEvent[] = [];
  for (const ruinId of RUIN_ORDER) {
    const gate = state.gates[ruinId];
    if (!gate) continue;
    // Bounded: each pass either stops the clock or pushes it a whole period
    // forward, and the period is at least a minute.
    while (gate.nextRaidAt !== null && gate.nextRaidAt <= t && !gate.cleared) {
      const took = raidTake(state, ruinId);
      let taken = 0;
      for (const [c, n] of Object.entries(took)) {
        addToWallet(state.city.wallet, c as RaidableId, -n);
        gate.hoard[c as RaidableId] = (gate.hoard[c as RaidableId] ?? 0) + n;
        taken += n;
      }
      if (taken > 0) {
        gate.trips += 1;
        state.raidReports.push({
          id: newId(state, 'raid'), ruinId, at: gate.nextRaidAt, took,
        });
      }
      const done = gate.trips >= RAID.maxRaids;
      gate.nextRaidAt = done
        ? null
        : gate.nextRaidAt + RUINS[ruinId].guard.periodMinutes * 60_000;
      if (taken > 0 || done) events.push({ ruinId, took, trips: gate.trips, done });
    }
  }
  return events;
}

/** A boundary source: the earliest raid still to come. */
export function nextRaidBoundary(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const id of RUIN_ORDER) {
    const gate = state.gates[id];
    if (!gate || gate.cleared || gate.nextRaidAt === null) continue;
    if (gate.nextRaidAt <= after) continue;
    if (best === null || gate.nextRaidAt < best) best = gate.nextRaidAt;
  }
  return best;
}

// --------------------------------------------------------- the formation

/** One enemy stack, the same shape as a party slot. */
export interface EnemySquad {
  unitId: UnitId;
  count: number;
}

/**
 * What is standing in the doorway.
 *
 * Derived from the gate's `guard`, never authored: `threat` says WHICH type
 * holds it and `power` says how much of it there is
 * (Docs/features/18-garrisons-and-raids.md §2). A named type is one kind of
 * creature in as many squads as the budget fills; `Any` — the drake — splits
 * the budget evenly across the four, which is the `threat_mix` the table
 * gives it and the reason it has no type answer.
 *
 * THE FORMATION IS WHAT THE PARTY FIGHTS, not a picture of it: `gatePower`
 * below sums these squads, and that sum is the number the attempt is scored
 * against. A display derived from one number while the fight used another is
 * exactly the fault `combat.ts` warns about — a promise on the sheet the
 * fight does not keep.
 */
export function gateFormation(ruinId: RuinId): EnemySquad[] {
  const guard = RUINS[ruinId].guard;
  const types: UnitId[] = guard.threat === 'Any' ? [...UNIT_ORDER] : [guard.threat];
  const share = guard.power / types.length;
  const squads: EnemySquad[] = [];
  for (const unitId of types) {
    const def = UNITS[unitId];
    // Whole troops, and never fewer than one: a share too small for a single
    // body still puts one there.
    let left = Math.max(1, Math.round(share / def.power));
    // A squad holds `squad_size` and no more, so a big budget spills into a
    // second squad of the same type rather than an impossible stack.
    while (left > 0) {
      const count = Math.min(def.squadSize, left);
      squads.push({ unitId, count });
      left -= count;
    }
  }
  return squads;
}

/** What a formation is worth — and therefore what the party has to beat. */
export const formationPower = (squads: readonly EnemySquad[]): number =>
  squads.reduce((sum, s) => sum + UNITS[s.unitId].power * s.count, 0);

/** The gate's power, read off the squads that are actually standing there. */
export const gatePower = (ruinId: RuinId): number =>
  formationPower(gateFormation(ruinId));

// ---------------------------------------------------------------- clearing

/**
 * The gate falls: the clock stops and the hoard comes home, in full.
 *
 * Called by the party command that won the fight (`expeditions.ts`), never on
 * its own — this module has no opinion about how a garrison is beaten, only
 * about what is owed when it is.
 */
export function markGateCleared(state: GameState, ruinId: RuinId): Wallet {
  const gate = state.gates[ruinId];
  if (!gate || gate.cleared) return {};
  const hoard: Wallet = { ...gate.hoard };
  for (const [c, n] of Object.entries(hoard)) {
    if (n > 0) addToWallet(state.city.wallet, c as RaidableId, n);
  }
  gate.cleared = true;
  gate.nextRaidAt = null;
  gate.hoard = {};
  // The reports for a gate that no longer exists are stale news.
  state.raidReports = state.raidReports.filter((r) => r.ruinId !== ruinId);
  return hoard;
}

/** How many gates the player has beaten — the `ClearGarrisons` quest goal. */
export const clearedGateCount = (state: GameState): number =>
  RUIN_ORDER.filter((id) => gateIsCleared(state, id)).length;

// ----------------------------------------------------------- the read-out

/** What clearing this gate costs in supplies: a flat price per ruin tier,
 *  paid on entry and never refunded, win or lose. */
export const gateSupplies = (ruinId: RuinId): Wallet =>
  ({ ...garrisonForTier(RUINS[ruinId].tier).supplies });

/** The creature the threat reads as. Derived, never a second authored list:
 *  a gate says what TYPE holds it and the fiction follows. */
const CREATURES: Record<string, string> = {
  Warrior: 'Orcs',
  Lancer: 'Goblins',
  Archer: 'Harpies',
  Cavalry: 'Wolf riders',
  Any: 'A drake',
};

export const gateCreature = (ruinId: RuinId): string =>
  CREATURES[RUINS[ruinId].guard.threat] ?? 'A warband';

/** Everything the widget and the ruin sheet need about one gate. */
export interface GateView {
  ruinId: RuinId;
  creature: string;
  threat: (typeof RUINS)[RuinId]['guard']['threat'];
  power: number;
  nextRaidAt: number | null;
  tripsLeft: number;
  hoard: Wallet;
  cleared: boolean;
}

export function gateView(state: GameState, ruinId: RuinId): GateView | null {
  const gate = state.gates[ruinId];
  if (!gate) return null;
  return {
    ruinId,
    creature: gateCreature(ruinId),
    threat: RUINS[ruinId].guard.threat,
    power: RUINS[ruinId].guard.power,
    nextRaidAt: gate.nextRaidAt,
    tripsLeft: tripsLeft(gate),
    hoard: { ...gate.hoard },
    cleared: gate.cleared,
  };
}

/** The gate whose raid lands soonest — what the widget names. */
export function nextGateToRaid(state: GameState): RuinId | null {
  let best: RuinId | null = null;
  let at = Infinity;
  for (const id of openGates(state)) {
    const gate = state.gates[id]!;
    if (gate.nextRaidAt === null || gate.nextRaidAt >= at) continue;
    at = gate.nextRaidAt;
    best = id;
  }
  return best;
}

export const dismissRaidReports = (state: GameState): void => {
  state.raidReports = [];
};

/** The authored tiers, for the dev read-out and the tests. */
export const GARRISON_TIERS = GARRISONS;
