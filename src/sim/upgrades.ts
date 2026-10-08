// The city's effective numbers: what a tap owes, what a worker hauls, how
// long a build takes, what a house pays.
//
// Every node in the tree is a technology (Docs/features/tech-tree.md §1
// rule 2), so what used to be a levelled upgrade is a rank: `Sawpits I -> II
// -> III`, each requiring the one before, each costing Gold AND time like
// anything else in the tree.
//
// The effective-value helpers below are the ONE place effects are applied, and
// each is a three-stage pipeline: base -> the completed technologies -> the
// modifier stack (artifact passives, hero traits, seasons; see
// sim/modifiers.ts). The middle stage is `techValue` and its siblings
// (sim/techEffects.ts), which sum whatever the tree AIMS at that number —
// there is no hook per bonus, and a new one is data. Both the tech stage and
// an empty modifier stack are the bit-exact identity, so nothing changes until
// something is researched or granted.
//
// A yield is a FRACTION on purpose, for the tap and the crew alike: the tree's
// bonuses are percentages (+10% Wood from forests), and a percentage of a
// one-unit chunk is a tenth of a unit. The remainder CARRIES — `tapCarry` for
// the thumb, `Worker.strikeCarry` for each crew member — so a worker brings
// home 1 on one trip and 2 on the next and the average is exact. Nothing
// fractional ever reaches a wallet or a store.

import {
  DISTRICTS, HARVEST, TAP, TAXES, WORKER, levelIndexed,
  type DistrictDef, type HarvestSpec,
} from './data/definitions';
import {
  type Coord, type CurrencyId, type District, type DistrictId, type GameState,
} from './state';
import { techMultiplier, techValue } from './techEffects';
import { resolve, resolveAt } from './modifiers';
import { harmonySurplusMultiplier } from './harmony';

/**
 * What the city gathers of one resource per second, from its own numbers.
 *
 * A worker's loop is walk out, strike, walk back. Cell distances vary, so this
 * takes the influence radius as the distance: a NOMINAL rate, not a measured
 * one. That is the point — it needs no map and no clock.
 *
 * **The tap does NOT read this**, and that is the whole story of the
 * 2026-09-03 rebalance: pricing a tap against city-wide production made one
 * tap on one tree pay 413 Wood in a maxed city. A tap is priced against the
 * GROUND and the THUMB, never against the payroll — the ground's rate is its
 * chunk over its rhythm, with no travel in it, because travel is a property of
 * where you put the shed rather than of the cell. The remaining caller here is
 * order sizing, which is addressed to the CITY and so should read the city's
 * real throughput, travel and all.
 */
export function cityGatherPerSecond(state: GameState, currencyId: CurrencyId): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built' || d.assignedWorkers === 0) continue;
    const def = DISTRICTS[d.definitionId];
    const source = def.harvestSources.find((s) => HARVEST[s].currencyId === currencyId);
    if (source === undefined) continue;
    const spec = HARVEST[source];
    // workers.ts#influenceRadius, inlined: workers.ts imports this file.
    const radius = def.influenceRadiusPerLevel.length === 0 ? 0
      : Math.floor(techValue(state, 'influenceRadius', levelIndexed(def.influenceRadiusPerLevel, d.level),
        { district: d.definitionId }));
    // The building's own level is in the rate too: a late Sawmill swings
    // faster and carries more, so a reward priced in production has to see it.
    const cycleSeconds = (2 * radius) / effectiveWorkerSpeed(state)
      + workerStrikeMs(state, spec, d) / 1000;
    if (cycleSeconds <= 0) continue;
    // A building that goes after more than one thing splits its crew between
    // them. For every district with a single source it divides by one, so no
    // existing number moves.
    const crew = d.assignedWorkers / def.harvestSources.length;
    total += (crew * effectiveWorkerStrike(state, spec, d)) / cycleSeconds;
  }
  return total;
}

/**
 * Units one extraction takes out of this kind of cell — the chunk, after
 * whatever the tree aims at that ground. Shared by the thumb and the crew,
 * because both draw from the same depot: nobody creates matter, everyone pulls
 * from the same place at a different speed.
 *
 * Aimed at the CELL, not the currency: game and crop plots both pay Food, but
 * Butchery is about butchering and Irrigation is about fields. Two effects on
 * one cell simply stack, which is what the `Crops` row of the old
 * `ABUNDANCE_LINES` table said with a list.
 */
export function effectiveUnitsPerStrike(state: GameState, spec: HarvestSpec, at: Coord | null = null): number {
  // The tree's term is a PERCENT (`harvestYield`, +10% a rank): the same
  // share of a Forest's one unit and an iron vein's five. The relic's term is
  // a percent too, and rides on top. One number reaches the thumb (`tapDraw`) and the
  // crew (`effectiveWorkerStrike`) from this one place — a fraction, which
  // both of them carry.
  // AT THE CELL when there is one: a Sickle of Plenty's aura is a place
  // (sim/hosts.ts).
  const base = spec.unitsPerStrike * techMultiplier(state, 'harvestYield', { harvest: spec.id });
  return Math.max(0, at === null
    ? resolve(state, 'harvestUnitsPerStrike', base)
    : resolveAt(state, 'harvestUnitsPerStrike', base, at));
}

/**
 * Seconds of work one player tap is worth.
 *
 * > **One tap is `tap.workSeconds` of work on the thing you tapped.**
 *
 * `TapPower` buys this DURATION, +20% a rank, so it is a relative ladder that
 * never goes stale (README working rule 2) and, priced in Gold and time, the
 * permanent sink the economy loses when the tech tree runs out.
 *
 * It is also the number behind what a rewarded ad is worth (`04-harvest.md`
 * §3.3).
 */
export const tapWorkSeconds = (state: GameState): number =>
  Math.max(0, resolve(state, 'tapYield', techValue(state, 'tapWorkSeconds', TAP.workSeconds)));

/** Units a tap owes on this kind of cell — a FRACTION on most ground, which is
 *  why `tapCarry` exists. `carry` is the remainder the last tap could not pay.
 *  The caller floors it, floors it at one unit, and caps it at what the cell
 *  actually holds. */
export const tapDraw = (state: GameState, spec: HarvestSpec, carry: number, at: Coord | null = null): number =>
  (spec.secondsPerStrike <= 0 ? 0
    : (tapWorkSeconds(state) * effectiveUnitsPerStrike(state, spec, at)) / spec.secondsPerStrike)
  + carry;

/**
 * A per-level term off the crew's own building.
 *
 * `null` is the player's own arm: a tap is not a crew and no building's level
 * speaks for it, so the tap path — and every caller with no building in hand
 * — gets `blank`.
 */
const levelTerm = (
  building: District | null, list: (d: DistrictDef) => readonly number[], blank: number,
): number => {
  if (building === null) return blank;
  return levelIndexed(list(DISTRICTS[building.definitionId]), building.level) ?? blank;
};

/** Units one worker strike deposits — a FRACTION, which the worker carries
 *  (`Worker.strikeCarry`): the ground's abundance, the crew's own building's
 *  late levels (which ADD units), and Worker Load (`crewYield`), the one
 *  payroll-only dial and therefore the pressure generator — more units a
 *  strike empties a cell faster. */
export function effectiveWorkerStrike(
  state: GameState, spec: HarvestSpec, building: District | null = null,
): number {
  const base = (effectiveUnitsPerStrike(state, spec, building?.location ?? null)
    + levelTerm(building, (d) => d.extraUnitsPerDeliveryPerLevel, 0))
    * techMultiplier(state, 'crewYield');
  return Math.max(0, resolve(state, 'workerYield', base, spec.currencyId));
}

/**
 * What one strike actually takes out of the ground: the whole units of what
 * it is owed, the remainder carried to the next strike. `carry` is the
 * worker's own; the caller stores what comes back as `rest`.
 */
export function strikeDraw(
  state: GameState, spec: HarvestSpec, building: District | null, carry: number,
): { want: number; rest: number } {
  const owed = effectiveWorkerStrike(state, spec, building) + carry;
  const want = Math.floor(owed + 1e-9);
  return { want, rest: Math.max(0, owed - want) };
}

/** Milliseconds between one worker's strikes on this kind of cell. A property
 *  of the CELL and of the BUILDING that sent the worker: a farm plot is fast
 *  and thirsty where an iron mountain is a heavy swing, and a level-10 Sawmill
 *  swings faster at both.
 *  (`workerSpeed` below is how fast they WALK, which is a different thing.)
 *
 *  A ZONE IS READ AT THE BUILDING, never at the cell. A worker walks, so a
 *  zone asking where it was standing would flicker as it crossed the edge —
 *  and travel is Euclidean while a zone is Chebyshev. *The Sawmill is in the
 *  area, so the Sawmill's crew works faster* is one sentence and one stable
 *  answer (Docs/proposals/relic-effects.md §3.1). */
export const workerStrikeMs = (
  state: GameState, spec: HarvestSpec, building: District | null = null,
): number => {
  const speed = levelTerm(building, (d) => d.strikeSpeedPerLevel, 1)
    * Math.max(1, building === null
      ? resolve(state, 'workerStrikeSpeed', 1)
      : resolveAt(state, 'workerStrikeSpeed', 1, building.location))
    // The tree's `crewStrikeSpeed`: aimed at the building that sent the crew.
    * Math.max(1, building === null
      ? techMultiplier(state, 'crewStrikeSpeed')
      : techMultiplier(state, 'crewStrikeSpeed', { district: building.definitionId }));
  return Math.max(100, Math.round((spec.secondsPerStrike * 1000) / speed));
};

/** Tiles per second a worker walks (Cartage: +5%/rank). Read by the worker
 *  FSM when a leg STARTS, so a rank landing mid-walk shortens the next leg
 *  rather than teleporting the one in progress — which is also what keeps a
 *  one-call replay and stepped ticking on the same StateUntil.
 *
 *  `home` is the walker's BUILDING, for the same reason `workerStrikeMs`
 *  reads one: a crew in a Winged Hammer zone walks faster for the whole leg,
 *  including the half of it outside the zone. Omitted, this is the kingdom's
 *  walking speed with no zone in it — which is what the UI and a worker with
 *  no building want. */
export const effectiveWorkerSpeed = (state: GameState, home: Coord | null = null): number =>
  Math.max(0.1, (home === null ? resolve : resolveAtHome(home))(state, 'workerSpeed',
    WORKER.moveSpeedTilesPerSecond * techMultiplier(state, 'workerSpeed')));

/** `resolveAt` curried on the place, so the line above reads as one choice
 *  between two resolvers rather than as a duplicated expression. */
const resolveAtHome = (home: Coord) =>
  (state: GameState, stat: 'workerSpeed', base: number): number =>
    resolveAt(state, stat, base, home);

/**
 * Multiplier on build and upgrade time.
 *
 * Both halves are SPEEDS the time is divided by: the tree's (`buildSpeed`,
 * Carpentry, +10% a rank) and the modifier stack's (a relic, a season, a
 * legendary's boon). A discount would die at 100%; a speed only ever
 * approaches zero (Docs/proposals/legendary-boons.md §2.1). ×2 is half the
 * wait, ×5 a fifth, and no number of them reaches a build that takes no time.
 */
export const effectiveBuildTimeMultiplier = (state: GameState): number =>
  Math.max(0.25, resolve(state, 'buildTime', 1))
    / Math.max(1, techMultiplier(state, 'buildSpeed'))
    / Math.max(1, resolve(state, 'buildSpeed', 1));

/**
 * Tax gold per housed villager per minute.
 *
 * `district` is the house being taxed, so the tree can aim a rate at one kind
 * of building — "+5% gold income at Housing" — rather than only at every roof
 * at once. Absent is every roof, which is what the ladders in the tree today
 * do.
 *
 * The Harmony surplus rides at the **base stage**, the way
 * `marketSaleLevelMultiplier` does: a city kept beautiful past what its
 * buildings ask of it is a standing fact about the city, not a modifier with
 * an expiry. The tax anchor is already settled
 * around every boundary batch and around a move, so a decoration or an
 * upgrade completing — each IS a build completion — reprices the partial
 * stretch without anything new (`population.ts`).
 */
export const effectiveTaxRate = (state: GameState, district?: DistrictId): number =>
  Math.max(0, resolve(
    state, 'taxRate',
    techValue(state, 'taxRate',
      TAXES.goldPerPopulationPerMinute
        * harmonySurplusMultiplier(state),
      district === undefined ? undefined : { district }),
  ));

