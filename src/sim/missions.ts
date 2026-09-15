// The missions: eight errands on one board, two more every eight hours.
//
// THEY ARE THE PASS'S ENGINE (sim/pass.ts) and nothing else reads them. What
// they are for is a reason to open the game on a Tuesday, so every rule here
// is about making the ask REAL: relative to the moment it was issued, bounded
// by what the city can actually do, and payable in what the player is short
// of rather than in a number a spreadsheet chose in era one.
//
// FOUR RULES, and every question about this file answers to one of them.
//
//   1. RELATIVE, ALWAYS. A mission stores the odometer key it watches and what
//      that odometer READ when it was issued (sim/events.ts). Progress is the
//      difference, so nothing that happened before the mission existed counts
//      and nothing it counts can be taken back.
//   2. NEVER ISSUE WHAT CANNOT BE DONE. `canIssue` asks the same questions the
//      buttons ask — `maxLevel`, `isHeroMaxLevel`, `gateIsCleared`,
//      `maxDistrictCount` — so a mission can never disagree with the refusal
//      the player would get. And there is a FALLBACK that is always eligible,
//      so a board can always be filled.
//   3. A FULL BOARD BLOCKS. Eight is the cap and nothing expires; the cap
//      replaces the deadline. That rule is enforced in `pass.ts`, which owns
//      the board — THIS FILE HOLDS NO STATE. It says what a mission may be
//      and how far along one is; the pass says which ones exist.
//   4. THE ROLL IS A HASH, NOT A STREAM (invariant 4). The parts are the
//      window and the slot — the EVENT — never a draw counter, and a kind is
//      chosen by SCORING EVERY KIND BY ITS OWN ID rather than by picking from
//      a list. Adding a twelfth kind then inserts one score and leaves the
//      other eleven in the same relative order; a `pick` over a list whose
//      length changed would re-roll every window in the game.
//
// Docs/features/20-season-pass.md §3.

import { DISTRICTS, MISSIONS, CURRENCIES } from './data/definitions';
import { armyCap, committedTroops, trainerFor } from './army';
import { maxDistrictCount, requiredTechForLevel } from './districts';
import { gateIsCleared } from './gates';
import { heroEntry } from './heroes';
import { isHeroMaxLevel } from './heroLadder';
import { ruinIsFinished } from './expeditions';
import { isTechComplete } from './research';
import { rand } from './rng';
import { tally } from './events';
import { cityGatherPerSecond } from './upgrades';
import { cityGoldPerSecond } from './collection';
import {
  newId,
  type CurrencyId, type DistrictId, type GameState, type Mission, type MissionKind,
  type RuinId,
} from './state';

const HOUR_MS = 3_600_000;
const WEEK_MS = 604_800_000;
/** Epoch ms of Monday 29 December 1969 — the Monday the epoch's Thursday sits
 *  in. Weeks are Monday-aligned because the source spec's reward path is. */
const WEEK_EPOCH = -3 * 86_400_000;

/** Which eight-hour window an instant falls in. Eight divides a day evenly
 *  from the epoch, so the boundaries land on 00:00, 08:00 and 16:00 UTC
 *  without anything having to say so. */
export const windowIndex = (t: number): number =>
  Math.floor(t / (MISSIONS.windowHours * HOUR_MS));

/** When the next window opens — absolute, so a countdown derives from it. */
export const nextWindowAt = (t: number): number =>
  (windowIndex(t) + 1) * MISSIONS.windowHours * HOUR_MS;

/** Which Monday-aligned week an instant falls in. */
export const weekIndex = (t: number): number => Math.floor((t - WEEK_EPOCH) / WEEK_MS);

/** EVERY KIND, in a fixed order that is part of the save's contract: the id is
 *  what the roll hashes on, so renaming one re-rolls every window. */
export const MISSION_KINDS: readonly MissionKind[] = [
  'Population', 'UpgradeDistricts', 'RaiseTownhall', 'CollectResource',
  'DiscoverCells', 'BuildDistricts', 'TrainTroops', 'LevelHeroes',
  'ClearRooms', 'CompleteDepths', 'OpenPacks',
];

/**
 * THE FALLBACK — the one kind that is eligible whenever anything at all is.
 *
 * The source spec's `CLIENT_RIDES` rule: a board that cannot be filled is a
 * dead system, so one kind has to be reachable from any state. Collecting a
 * resource qualifies because a city that produces nothing cannot be played at
 * all, and `collectSubject` falls back to Gold, which taxes alone pay.
 */
const FALLBACK: MissionKind = 'CollectResource';

// --------------------------------------------------------------- eligibility

/** Which currency a "collect X" mission should ask for: the one the city
 *  makes most of, so the ask is the errand the player is already running. */
function collectSubject(state: GameState): CurrencyId {
  const candidates: CurrencyId[] = ['Food', 'Wood', 'Stone'];
  let best: CurrencyId = 'Gold';
  let bestRate = cityGoldPerSecond(state);
  for (const c of candidates) {
    if (CURRENCIES[c] === undefined) continue;
    const rate = cityGatherPerSecond(state, c);
    if (rate > bestRate) { best = c; bestRate = rate; }
  }
  return best;
}

/** A district the player could still raise a level of. */
const anyUpgradable = (state: GameState): boolean =>
  state.city.districts.some((d) =>
    d.state === 'Built' && d.level < DISTRICTS[d.definitionId].maxLevel);

/** A district definition the player could still place one more of — the count
 *  cap and the unlock technology, which are the two refusals `placementBlock`
 *  owns that do not depend on a particular cell. */
const anyBuildable = (state: GameState): boolean =>
  (Object.keys(DISTRICTS) as DistrictId[]).some((id) => {
    const def = DISTRICTS[id];
    if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return false;
    return state.city.districts.filter((d) => d.definitionId === id).length
      < maxDistrictCount(state, def);
  });

/** A ruin with its gate down and rooms left, and a hero to send into it. */
const anyRuinOpen = (state: GameState): boolean =>
  state.heroes.owned.length > 0 &&
  (Object.keys(state.ruins) as RuinId[]).concat(
    (Object.keys(state.gates) as RuinId[]),
  ).some((id) => gateIsCleared(state, id) && !ruinIsFinished(state, id));

/**
 * CAN THIS KIND BE ISSUED RIGHT NOW?
 *
 * The 🚫 column of the source spec, asked against the sim's own refusals
 * rather than against a second opinion — so a mission can never ask for
 * something the button would decline.
 */
export function canIssue(state: GameState, kind: MissionKind): boolean {
  switch (kind) {
    case 'Population':
      // Villagers are trained like a unit, so what gates the ask is a hall
      // that trains them — not the housing, which only caps where they live.
      return trainerFor(state, 'Villager') !== undefined;
    case 'UpgradeDistricts':
      return anyUpgradable(state);
    case 'RaiseTownhall': {
      const hall = state.city.districts.find((d) => d.definitionId === 'Townhall');
      if (hall === undefined) return false;
      if (hall.level >= DISTRICTS.Townhall.maxLevel) return false;
      // The next level's technology has to be IN HAND. A gate the player
      // cannot open yet is exactly the "impossible bar" rule 2 forbids.
      const gate = requiredTechForLevel('Townhall', hall.level + 1);
      return gate === null || isTechComplete(state, gate);
    }
    case 'CollectResource':
      return true;
    case 'DiscoverCells':
      // There is always more map while the region is not fully revealed, and
      // a reveal is paid in Gold, which the city always makes.
      return true;
    case 'BuildDistricts':
      return anyBuildable(state);
    case 'TrainTroops':
      return committedTroops(state) < armyCap(state) &&
        (['Warrior', 'Lancer', 'Archer', 'Cavalry'] as const)
          .some((u) => trainerFor(state, u) !== undefined);
    case 'LevelHeroes':
      return state.heroes.owned.some((id) => !isHeroMaxLevel(heroEntry(state, id)));
    case 'ClearRooms':
    case 'CompleteDepths':
      return anyRuinOpen(state);
    case 'OpenPacks':
      return true;
    default:
      return false;
  }
}

// ------------------------------------------------------------ what it asks for

/** The odometer a kind watches, and what it is about. */
function meterFor(state: GameState, kind: MissionKind): { meter: string; subject: CurrencyId | null } {
  switch (kind) {
    case 'Population': return { meter: 'villagers', subject: null };
    case 'UpgradeDistricts': return { meter: 'levels', subject: null };
    case 'RaiseTownhall': return { meter: 'levels:Townhall', subject: null };
    case 'CollectResource': {
      const subject = collectSubject(state);
      return { meter: `collect:${subject}`, subject };
    }
    case 'DiscoverCells': return { meter: 'reveal', subject: null };
    case 'BuildDistricts': return { meter: 'built', subject: null };
    case 'TrainTroops': return { meter: 'troops', subject: null };
    case 'LevelHeroes': return { meter: 'heroLevels', subject: null };
    case 'ClearRooms': return { meter: 'rooms', subject: null };
    case 'CompleteDepths': return { meter: 'depths', subject: null };
    default: return { meter: 'packs', subject: null };
  }
}

/** An integer in `[min, max]`, inclusive, from one hash. */
const inBand = (roll: number, band: readonly number[]): number => {
  const min = Math.max(1, Math.round(band[0] ?? 1));
  const max = Math.max(min, Math.round(band[1] ?? min));
  return min + Math.floor(roll * (max - min + 1));
};

/**
 * HOW MUCH THIS MISSION ASKS FOR.
 *
 * Counts for everything a player does one of at a time — a level, a room, a
 * trainee — because those are the same size for every city. The one exception
 * is "collect X", which is priced in MINUTES OF THE PLAYER'S OWN PRODUCTION
 * (`tap.workSeconds`'s rule, and `productionChest`'s): an absolute pile is a
 * morning's work in era one and a rounding error in era three, and nothing
 * re-derives it per era.
 */
function targetFor(
  state: GameState, kind: MissionKind, subject: CurrencyId | null, roll: number,
): number {
  switch (kind) {
    case 'Population': return inBand(roll, MISSIONS.populationBand);
    case 'UpgradeDistricts': return inBand(roll, MISSIONS.upgradeBand);
    // One level. The whole mission IS the Townhall, so a band would only ever
    // ask for a second one the player may not be able to reach.
    case 'RaiseTownhall': return 1;
    case 'CollectResource': {
      const minutes = MISSIONS.collectMinutesMin +
        roll * (MISSIONS.collectMinutesMax - MISSIONS.collectMinutesMin);
      const rate = subject === 'Gold'
        ? cityGoldPerSecond(state)
        : cityGatherPerSecond(state, subject ?? 'Gold');
      return Math.max(MISSIONS.collectFloor, Math.round(rate * minutes * 60));
    }
    case 'DiscoverCells': return inBand(roll, MISSIONS.revealBand);
    case 'BuildDistricts': return inBand(roll, MISSIONS.buildBand);
    case 'TrainTroops': return inBand(roll, MISSIONS.troopsBand);
    case 'LevelHeroes': return inBand(roll, MISSIONS.heroLevelBand);
    case 'ClearRooms': return inBand(roll, MISSIONS.roomsBand);
    case 'CompleteDepths': return inBand(roll, MISSIONS.depthsBand);
    default: return inBand(roll, MISSIONS.packsBand);
  }
}

// ------------------------------------------------------------- the generation

/**
 * PICK ONE KIND for `(window, slot)`.
 *
 * Every eligible kind is scored by its OWN id, and the best one wins. Kinds
 * already on the board and kinds at their weekly quota are dropped first, but
 * only while something is left: a board that cannot be filled is worse than a
 * repeat, and the fallback is the floor under both.
 */
export function chooseKind(
  state: GameState, window: number, slot: number, avoid: ReadonlySet<MissionKind>,
  quota: Partial<Record<MissionKind, number>>,
): MissionKind {
  const eligible = MISSION_KINDS.filter((k) => canIssue(state, k));
  const score = (k: MissionKind): number => rand(state.seed, 'missionKind', window, slot, k);
  const best = (pool: readonly MissionKind[]): MissionKind | null =>
    pool.length === 0 ? null
      : pool.reduce((a, b) => (score(b) > score(a) ? b : a));
  const underQuota = eligible.filter((k) => (quota[k] ?? 0) < MISSIONS.weeklyQuota);
  // Four floors, each one giving up less than the last: prefer something new
  // and under quota, then something under quota, then something new, then
  // anything eligible — and under all four, the fallback, which cannot refuse.
  return best(underQuota.filter((k) => !avoid.has(k)))
    ?? best(underQuota)
    ?? best(eligible.filter((k) => !avoid.has(k)))
    ?? best(eligible)
    ?? FALLBACK;
}

/** Build one mission of `kind` for `(window, slot)`. */
export function issueMission(
  state: GameState, kind: MissionKind, window: number, slot: number,
): Mission {
  const { meter, subject } = meterFor(state, kind);
  const roll = rand(state.seed, 'missionTarget', window, slot, kind);
  return {
    uniqueId: newId(state, 'mission'),
    kind,
    meter,
    base: tally(state, meter),
    target: Math.max(1, targetFor(state, kind, subject, roll)),
    subject,
    window,
    slot,
    claimed: false,
  };
}

// ---------------------------------------------------------------- the reading

/** How far along a mission is — clamped, so a stale base can never read
 *  negative and an overshoot never reads past the target. */
export const missionProgress = (state: GameState, m: Mission): number =>
  Math.max(0, Math.min(m.target, tally(state, m.meter) - m.base));

export const missionComplete = (state: GameState, m: Mission): boolean =>
  missionProgress(state, m) >= m.target;

