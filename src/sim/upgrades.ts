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
// Integer stats (workerYield) round ONCE, here at the boundary, because they
// feed addToWallet directly and a fractional wallet would leak into quest
// counters, the Market and every displayed number. Math.round rather than
// floor: flooring makes a small multiplier useless at base-1 yields. The tap
// is the exception — it owes a FRACTION on purpose, and `tapCarry` keeps the
// remainder (see `tapDraw`).

import {
  DISTRICTS, HARVEST, TAP, TAXES, WORKER, levelIndexed,
  type DistrictDef, type HarvestSpec,
} from './data/definitions';
import { townhall, type CurrencyId, type District, type DistrictId, type GameState } from './state';
import { techMultiplier, techValue } from './techEffects';
import { isTechComplete } from './research';
import { resolve } from './modifiers';
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
    const radius = def.influenceRadiusPerLevel.length === 0
      ? 0 : levelIndexed(def.influenceRadiusPerLevel, d.level);
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
export function effectiveUnitsPerStrike(state: GameState, spec: HarvestSpec): number {
  return Math.max(0, techValue(
    state, 'harvestUnitsPerStrike', spec.unitsPerStrike, { harvest: spec.id }));
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
 * It is also the number behind what a rewarded ad is worth: the thumb is worth
 * `tapWorkSeconds / collectCooldown` workers, and **that has to stay ahead of
 * the crew** or the hand stops beating the machine (`04-harvest.md` §3.3).
 */
export const tapWorkSeconds = (state: GameState): number =>
  Math.max(0, resolve(state, 'tapYield', techValue(state, 'tapWorkSeconds', TAP.workSeconds)));

/** Units a tap owes on this kind of cell — a FRACTION on most ground, which is
 *  why `tapCarry` exists. `carry` is the remainder the last tap could not pay.
 *  The caller floors it, floors it at one unit, and caps it at what the cell
 *  actually holds. */
export const tapDraw = (state: GameState, spec: HarvestSpec, carry: number): number =>
  (spec.secondsPerStrike <= 0 ? 0
    : (tapWorkSeconds(state) * effectiveUnitsPerStrike(state, spec)) / spec.secondsPerStrike)
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

/** Units one worker strike deposits: the ground's abundance plus the global
 *  WorkerLoad, which is the one payroll-only dial and therefore the pressure
 *  generator — more units a strike empties a cell faster. `building` is the
 *  crew's own, and its late levels ADD units to the haul (a chunk is 1 to 5
 *  units, so a percentage of it would round away). */
export function effectiveWorkerStrike(
  state: GameState, spec: HarvestSpec, building: District | null = null,
): number {
  const base = techValue(state, 'workerStrikeUnits',
    effectiveUnitsPerStrike(state, spec)
    + levelTerm(building, (d) => d.extraUnitsPerDeliveryPerLevel, 0));
  return Math.max(0, Math.round(resolve(state, 'workerYield', base, spec.currencyId)));
}

/** Milliseconds between one worker's strikes on this kind of cell. A property
 *  of the CELL and of the BUILDING that sent the worker: a farm plot is fast
 *  and thirsty where an iron mountain is a heavy swing, and a level-10 Sawmill
 *  swings faster at both. No modifier scales it — a worker-speed stat would be
 *  a new `ModifierStat`, which is code, and nothing has asked.
 *  (`workerSpeed` below is how fast they WALK, which is a different thing.) */
export const workerStrikeMs = (
  state: GameState, spec: HarvestSpec, building: District | null = null,
): number => {
  void state;
  const speed = levelTerm(building, (d) => d.strikeSpeedPerLevel, 1);
  return Math.max(100, Math.round((spec.secondsPerStrike * 1000) / speed));
};

/** Cooldown between AUTO-taps — the repeats a held pointer generates, ms
 *  (QuickHands buys it down; floor 0.1s).
 *
 *  Deliberately asymmetric, and this is the whole design: a *manual* tap is
 *  never gated, so tapping fast stays a skill the player is rewarded for,
 *  while holding trades that speed for not having to work. Nothing here is
 *  ever consulted on a deliberate tap — see `collectTap`.
 *
 *  It follows that QuickHands only ever speeds HOLDING up. That makes it a
 *  convenience line rather than a raw-throughput one, which is the right
 *  shape: it narrows the gap toward manual tapping without closing it (0.5s
 *  down to 0.25s at rank 5, still slower than a determined tapper).
 *
 *  It is also half of what the thumb is worth: `tapWorkSeconds` over this is
 *  how many workers a held finger is equal to, and that number has to stay
 *  ahead of the crew (`04-harvest.md` §3.3). */
export const effectiveAutoTapCooldownMs = (state: GameState): number =>
  Math.max(100, resolve(
    state, 'autoTapCooldown', techValue(state, 'autoTapCooldown', TAP.collectCooldownSeconds) * 1000,
  ));

/** Tiles per second a worker walks (Cartage: +5%/rank). Read by the worker
 *  FSM when a leg STARTS, so a rank landing mid-walk shortens the next leg
 *  rather than teleporting the one in progress — which is also what keeps a
 *  one-call replay and stepped ticking on the same StateUntil. */
export const effectiveWorkerSpeed = (state: GameState): number =>
  Math.max(0.1, resolve(state, 'workerSpeed',
    WORKER.moveSpeedTilesPerSecond
      * (isTechComplete(state, 'Roadworks') ? 1.25 : 1) // paved ways: a quarter faster
      * techMultiplier(state, 'workerSpeed')));

/** Multiplier on build and upgrade time (Carpentry: −5%/rank), floor 0.25. */
export const effectiveBuildTimeMultiplier = (state: GameState): number =>
  Math.max(0.25, resolve(state, 'buildTime', techValue(state, 'buildTime', 1)));

/** Multiplier on research time (Scriveners: −5%/rank), floor 0.25. Applied
 *  ONCE, when a research starts, and persisted on it — see research.ts. */
export const effectiveResearchTimeMultiplier = (state: GameState): number =>
  Math.max(0.25, resolve(state, 'researchTime', techValue(state, 'researchTime', 1)));

/**
 * Tax gold per housed villager per minute.
 *
 * `district` is the house being taxed, so the tree can aim a rate at one kind
 * of building — "+5% gold income at Housing" — rather than only at every roof
 * at once. Absent is every roof, which is what the ladders in the tree today
 * do.
 *
 * The Harmony surplus and the Townhall's level ride at the **base stage**, the
 * way `marketSaleLevelMultiplier` does: a city kept beautiful past what its
 * buildings ask of it, and a capital that has grown, are standing facts about
 * the city, not modifiers with an expiry. The tax anchor is already settled
 * around every boundary batch and around a move, so a decoration or an
 * upgrade completing — each IS a build completion — reprices the partial
 * stretch without anything new (`population.ts`).
 */
export const effectiveTaxRate = (state: GameState, district?: DistrictId): number =>
  Math.max(0, resolve(
    state, 'taxRate',
    techValue(state, 'taxRate',
      TAXES.goldPerPopulationPerMinute
        * harmonySurplusMultiplier(state)
        * townhallTaxMultiplier(state),
      district === undefined ? undefined : { district }),
  ));

/**
 * What the Townhall's LEVEL does to every house's rent — the reason to raise
 * it once the count caps stop mattering. A total at each level, indexed from
 * level 1 (`taxes.townhall_multiplier_per_level`); an empty ladder is ×1.
 */
export const townhallTaxMultiplier = (state: GameState): number => {
  const ladder = TAXES.townhallMultiplierPerLevel;
  return ladder.length === 0 ? 1 : levelIndexed(ladder, townhall(state).level);
};
