// The lair — a garrison with a clock (Docs/proposals/lairs.md §4).
//
// Every lair holds a PATH of fights (its tier's `fights`), the last of them
// its own garrison, and FINDING the lair — revealing a cell of
// its zone — starts its clock. The first raid lands after the lair's warning;
// from then on it raids `raid.perDay` times every local day, inside the
// player's raid window, for as long as it stands. A raid takes a slice of what
// sits UNCOLLECTED in the buildings' stores — never the wallet — and the lair
// carries what it took, up to a day of raids; clearing it hands that back.
//
// FOUR RULES DECIDE EVERYTHING HERE, and each of them is load-bearing.
//
//  1. A RAID IS NOT A FIGHT. Nothing at home defends. The only answer is to go
//     and clear the lair, which is the point: the raid is the incentive that
//     sends a player to the lair, not a punishment for being away.
//  2. IT IS A TIMER, NOT PRODUCTION. It runs and resolves in full while the
//     player is away, and every raid time is a hash of the lair, the local
//     day and the slice — never of the moment it is asked — so one advance
//     over a week lands the same raids as a week of ticking (invariant 4).
//  3. A RAID IS PRICED IN PRODUCTION, NOT IN UNITS. It takes `take_seconds` of
//     the city's own output of each material, capped by a fraction of what
//     the stores hold. What is in the wallet is safe: collecting is the
//     defence. `cityRate` is a FACT about the city rather than an accrual, so a
//     raid replays identically however the window was split — and a material
//     the city does not produce is never taken.
//  4. THE HOARD IS BOUNDED. A lair carries at most a day of raids of each
//     material; a raid over that still takes, and the rest is lost. Without
//     the cap a lair left standing would be a store that never fills — every
//     raid on a full store sets its crew going again, and all of it would come
//     back on the clear.
//
// The FIGHT is not here. Clearing a lair is a party command — supplies, a
// hero, a matchup — and it lives in `expeditions.ts`, which already owns all
// three. This module owns the clock, the take and the hoard, and it imports
// nothing from expeditions so that the party code can ask it whether the lair
// still stands.

import { DELVE, GARRISONS, RAID, LAIRS, LAIR_ORDER, garrisonForTier } from './data/definitions';
import type { EnemySquad } from './combat';
import { boardPower, buildBoard, generateEnemy, type Board } from './battle';
import { recordSiteDiscovery } from './discovery';
import { lairIsFound } from './lairZone';
import { rand } from './rng';
import { cityGoldPerMinute, ownGoldBase, ownGoldPerMinute } from './population';
import { cityGatherPerSecond } from './upgrades';
import { storedOf, takeFromStore } from './storage';
import {
  addToWallet, townhall,
  type District, type GameState, type LairState, type LairId, type Wallet,
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

// ------------------------------------------------------------------ arming

/**
 * Start the clock on every lair the player has now FOUND.
 *
 * A SWEEP rather than a hook, for the reason `recordVisibleSites` is one: a
 * reveal happens in a tap, a finished build or a spell, and there is no single
 * write to hang the lair off. It runs inside `advance()`, which is what stamps
 * the clock with a boundary's `t` instead of a clock the sim is not allowed to
 * read.
 *
 * It also puts a clock back on a standing lair that has none — a save from
 * when a garrison stopped after three raids — onto the daily schedule from
 * `t`, so an old save picks the new pace up without a migrator.
 */
export function armLairs(state: GameState, t: number): void {
  for (const id of LAIR_ORDER) {
    const lair = state.lairs[id];
    if (lair !== undefined) {
      if (!lair.cleared && !lair.defeated && lair.nextRaidAt === null) {
        lair.nextRaidAt = raidTimeAfter(state, id, t);
      }
      continue;
    }
    if (!lairIsFound(state, id)) continue;
    state.lairs[id] = {
      armedAt: t,
      nextRaidAt: t + LAIRS[id].guard.warningMinutes * 60_000,
      hoard: {},
      defeated: false,
      cleared: false,
    };
    recordSiteDiscovery(state, id);
  }
}

// --------------------------------------------------------------- schedule

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * THE NEXT RAID STRICTLY AFTER `after`, on the daily schedule (§4.1).
 *
 * The player's local day is cut at the raid window — `windowStartHour` to
 * `windowEndHour` — and the window into `perDay` equal slices. Each slice
 * holds one raid, at a moment inside it that is a hash of the lair, the day
 * and the slice: the same lair on the same day always raids at the same
 * times, and two raids are never on top of each other. So a raid lands in the
 * hours the player plays, never in the night.
 *
 * `after` is the raid just made, or the boundary a schedule restarts from —
 * never the moment somebody asked.
 */
export function raidTimeAfter(state: GameState, lairId: LairId, after: number): number {
  const offset = state.kingdom.utcOffsetMinutes * 60_000;
  const open = RAID.windowStartHour * HOUR_MS;
  // A window authored inside out collapses to one hour rather than looping.
  const span = Math.max(HOUR_MS, RAID.windowEndHour * HOUR_MS - open);
  const perDay = Math.max(1, RAID.perDay);
  const slice = span / perDay;
  // The local day `after` falls in, counted from the epoch. A slice of it
  // already past is skipped, so the loop below ends inside two days.
  for (let day = Math.floor((after + offset) / DAY_MS); ; day++) {
    const localMidnight = day * DAY_MS - offset;
    for (let k = 0; k < perDay; k++) {
      const at = Math.floor(localMidnight + open + slice * (k + rand(state.seed, lairId, 'raid', day, k)));
      if (at > after) return at;
    }
  }
}

/**
 * The device's local time moved (travel, daylight saving): every standing
 * lair on the daily schedule is put back on it from `t`. A lair still inside
 * its first warning keeps it — that raid is a countdown the player has been
 * shown, not a slot on the schedule.
 */
export function setUtcOffset(state: GameState, minutes: number, t: number): void {
  if (!Number.isFinite(minutes) || state.kingdom.utcOffsetMinutes === minutes) return;
  state.kingdom.utcOffsetMinutes = Math.round(minutes);
  for (const id of LAIR_ORDER) {
    const lair = state.lairs[id];
    if (!lair || lair.cleared || lair.nextRaidAt === null) continue;
    const firstRaid = lair.armedAt + LAIRS[id].guard.warningMinutes * 60_000;
    if (lair.nextRaidAt === firstRaid) continue;
    lair.nextRaidAt = raidTimeAfter(state, id, t);
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
  if (currency !== 'Gold') return gathered;
  return gathered + (cityGoldPerMinute(state) - ownGoldPerMinute(state, townhall(state))) / 60;
}

/**
 * The stores a raid can reach. **The Townhall's own Gold is never raided**: it
 * is the city's floor, the one source of Gold a standing lair cannot shut off
 * (Docs/features/18-garrisons-and-raids.md §4).
 */
const raidable = (d: District): boolean => ownGoldBase(d) === 0;

const raidableStored = (state: GameState, c: RaidableId): number =>
  state.city.districts.reduce((n, d) => n + (raidable(d) ? storedOf(d, c) : 0), 0);

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
    const stored = raidableStored(state, c);
    const take = Math.floor(Math.min(produced, stored * RAID.takeFractionMax));
    if (take > 0) took[c] = take;
  }
  return took;
}

/**
 * The most a lair carries of one material: a day of raids at the city's
 * current rate (§4.2). Read at the raid, like the take itself, so it grows
 * with the city and replays identically.
 */
export function hoardCap(state: GameState, lairId: LairId, c: RaidableId): number {
  const seconds = garrisonForTier(LAIRS[lairId].tier).takeSeconds;
  return Math.floor(Math.max(1, RAID.perDay) * cityRatePerSecond(state, c) * seconds);
}

export interface RaidEvent {
  lairId: LairId;
  /** When it landed — the raid's own time, not the boundary's. */
  at: number;
  /** What it took from the stores, including what it could not carry. */
  took: Wallet;
}

/**
 * Resolve every raid due by `t`. Runs in `applyDueAt`, because a raid changes
 * the stores another subsystem may be reading — and in LAIR ORDER, so two
 * lairs due at the same instant always take in the same sequence.
 *
 * A raid that finds nothing to take still moves its clock on: the schedule is
 * the lair's, not the stores'.
 */
export function advanceRaids(state: GameState, t: number): RaidEvent[] {
  const events: RaidEvent[] = [];
  for (const lairId of LAIR_ORDER) {
    const lair = state.lairs[lairId];
    if (!lair) continue;
    // Bounded: each pass moves the clock to a later slice, so a week away is
    // at most `perDay × 7` passes a lair — well inside MAX_BOUNDARY_STEPS.
    while (lair.nextRaidAt !== null && lair.nextRaidAt <= t && !lair.cleared) {
      const at = lair.nextRaidAt;
      const took = raidTake(state, lairId);
      let taken = 0;
      for (const [c, n] of Object.entries(took)) {
        const r = c as RaidableId;
        // The cap is read BEFORE the take, which moves no rate but keeps the
        // order of questions the same in replay as in ticking.
        const room = Math.max(0, hoardCap(state, lairId, r) - (lair.hoard[r] ?? 0));
        const got = takeFromStores(state, r, n);
        if (got <= 0) { delete took[r]; continue; }
        took[r] = got;
        // A raid always takes; what the lair cannot carry is lost (§4.2).
        const kept = Math.min(got, room);
        if (kept > 0) lair.hoard[r] = (lair.hoard[r] ?? 0) + kept;
        taken += got;
      }
      if (taken > 0) events.push({ lairId, at, took });
      lair.nextRaidAt = raidTimeAfter(state, lairId, at);
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
  const total = raidableStored(state, c);
  if (total <= 0 || amount <= 0) return 0;
  let left = Math.min(amount, total);
  for (const d of state.city.districts) {
    if (left <= 0) break;
    const here = raidable(d) ? storedOf(d, c) : 0;
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

// ---------------------------------------------------------------- the path

/** How many fights this lair takes to clear — its tier's
 *  (Docs/features/18-garrisons-and-raids.md §5). */
export const lairFights = (lairId: LairId): number =>
  Math.max(1, garrisonForTier(LAIRS[lairId].tier).fights);

/** Fights won on its path so far. */
export const lairFightsWon = (state: GameState, lairId: LairId): number =>
  Math.min(lairFights(lairId), state.lairs[lairId]?.won ?? (state.lairs[lairId]?.defeated ? lairFights(lairId) : 0));

/** Which fight is next, 0-based — the last one is the lair's own garrison. */
export const lairFightIndex = (state: GameState, lairId: LairId): number =>
  Math.min(lairFightsWon(state, lairId), lairFights(lairId) - 1);

/**
 * The power of fight `i` of a lair: the LAST is the lair's `guard.power`,
 * and the ones before it ramp evenly up to it from `firstFightPower` of it.
 * The path does not make the lair harder to finish, only longer.
 */
export function lairFightPower(lairId: LairId, i: number): number {
  const n = lairFights(lairId);
  const full = LAIRS[lairId].guard.power;
  if (n <= 1 || i >= n - 1) return full;
  const share = DELVE.firstFightPower + (1 - DELVE.firstFightPower) * (Math.max(0, i) / (n - 1));
  return Math.max(1, Math.round(full * share));
}

/**
 * What is standing in the doorway — the garrison of the NEXT fight on the
 * lair's path, or of fight `i`.
 *
 * Derived from the lair's `guard`, never authored: `threat` says WHICH type
 * holds it and the path says how much of it there is
 * (Docs/features/18-garrisons-and-raids.md §2, §5). The generator is the
 * resolver's (`combat.ts`, combat.md §11) — a lair is a room, and a room's
 * enemies are made one way. The last fight rolls under the key the lair's one
 * fight always had, so its garrison is the one a player has looked at.
 */
export function lairBoard(state: GameState, lairId: LairId, i = lairFightIndex(state, lairId)): Board {
  const guard = LAIRS[lairId].guard;
  const last = i >= lairFights(lairId) - 1;
  const plan = generateEnemy({
    seed: state.seed,
    parts: last ? [ROLL_KEY[lairId], 'gate'] : [ROLL_KEY[lairId], 'gate', i],
    budget: lairFightPower(lairId, i),
    affinity: guard.threat,
    ...(guard.mix ? { mix: guard.mix } : {}),
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
 * The garrison is beaten: the clock stops for good, and the lair waits on
 * the map, holding its ground and its hoard, for the player to claim what it
 * owes (Docs/proposals/lairs.md §5). Called by the party command that won the
 * fight (`expeditions.ts`), never on its own.
 */
export function markLairDefeated(state: GameState, lairId: LairId): void {
  const lair = state.lairs[lairId];
  if (!lair || lair.cleared) return;
  lair.won = lairFights(lairId);
  lair.defeated = true;
  lair.nextRaidAt = null;
}

/**
 * One fight on the path is won. Short of the last, the lair still stands and
 * still raids; the last one beats it (`markLairDefeated`). Returns whether
 * this win beat it. Called by the party command that won, never on its own.
 */
export function markLairFightWon(state: GameState, lairId: LairId): boolean {
  const lair = state.lairs[lairId];
  if (!lair || lair.cleared || lair.defeated) return false;
  const won = lairFightsWon(state, lairId) + 1;
  if (won >= lairFights(lairId)) {
    markLairDefeated(state, lairId);
    return true;
  }
  lair.won = won;
  return false;
}

/** Beaten, and its reward not yet claimed. */
export const lairAwaitsClaim = (state: GameState, lairId: LairId): boolean =>
  state.lairs[lairId]?.defeated === true && state.lairs[lairId]?.cleared !== true;

/**
 * The claim: the hoard comes home and the ground it held is the city's
 * (`lairZone.ts` reads `cleared`). Only a DEFEATED lair can be cleared —
 * `claimLair` in `expeditions.ts` pays the rest of the reward around it.
 */
export function markLairCleared(state: GameState, lairId: LairId): Wallet {
  const lair = state.lairs[lairId];
  if (!lair || lair.cleared || !lair.defeated) return {};
  const hoard: Wallet = { ...lair.hoard };
  for (const [c, n] of Object.entries(hoard)) {
    if (n > 0) addToWallet(state.city.wallet, c as RaidableId, n);
  }
  lair.cleared = true;
  lair.nextRaidAt = null;
  lair.hoard = {};
  return hoard;
}

/** How many lairs the player has found — the `FindLairs` quest goal. A lair
 *  is in `state.lairs` from the sweep that finds it (`armLairs`) on, cleared
 *  or not, which is the same fact the Book of Warfare opens on. */
export const foundLairCount = (state: GameState): number =>
  LAIR_ORDER.filter((id) => state.lairs[id] !== undefined).length;

/** How many lairs the player has beaten — the `ClearLairs` quest goal. */
export const clearedLairCount = (state: GameState): number =>
  LAIR_ORDER.filter((id) => lairIsCleared(state, id)).length;

// ----------------------------------------------------------- the read-out


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
  hoard: Wallet;
  /** True for a material the lair carries all it can of (§6's *full*). */
  hoardFull: Partial<Record<RaidableId, boolean>>;
  /** Its path: fights won, and how many it takes. */
  won: number;
  fights: number;
  /** Beaten, the reward waiting to be claimed. */
  defeated: boolean;
  cleared: boolean;
}

export function lairView(state: GameState, lairId: LairId): LairView | null {
  const lair = state.lairs[lairId];
  if (!lair) return null;
  return {
    lairId,
    creature: lairCreature(lairId),
    threat: LAIRS[lairId].guard.threat,
    power: lairFightPower(lairId, lairFightIndex(state, lairId)),
    nextRaidAt: lair.nextRaidAt,
    hoard: { ...lair.hoard },
    hoardFull: Object.fromEntries(RAIDABLE
      .filter((c) => (lair.hoard[c] ?? 0) > 0 && (lair.hoard[c] ?? 0) >= hoardCap(state, lairId, c))
      .map((c) => [c, true])),
    won: lairFightsWon(state, lairId),
    fights: lairFights(lairId),
    defeated: lair.defeated,
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

/** The authored tiers, for the dev read-out and the tests. */
export const GARRISON_TIERS = GARRISONS;
