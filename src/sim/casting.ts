// The four relic ACTIVES — spells in waiting (Docs/features/07-research.md §6).
//
// They are gated on OWNING the relic: attunement is gone, so there is no
// socket to require and no swap to time.
//
// Cast mode reuses PLACEMENT mode wholesale: select → valid cells highlight →
// tap to commit is exactly what placementInfo(), markers() and the priority-300
// tap handler already do. Casting is a second mode through the same machinery,
// not a new interaction model — which is why this file is about effects rather
// than about input.
//
// Each active is a pure function of (state, map, target, now). No closures, no
// UI, no Date.now(): the determinism argument the whole sim rests on collapses
// the moment an effect can only be replayed by re-running the UI.

import {
  ARTIFACTS, ARTIFACT_AUTO_TAP_PER_SECOND, ARTIFACT_COOLDOWN_SECONDS,
  ARTIFACT_RADIUS_STEPS, type ArtifactActiveId,
} from './data/definitions';
import { isWithinReach, revealCostForCell, revealPaidSoFar } from './fog';
import { cellsWithinRadius, type MapData } from './grid';
import { effectiveStock, harvestSourceAt, harvestSpecAt, tapCell } from './harvest';
import { mana, payMana } from './mana';
import { addModifier, areaCovers, resolve, type ModifierArea } from './modifiers';
import {
  coordKey, newId,
  type ArtifactId, type Coord, type District, type GameState,
} from './state';
import { pullHouseForward, residentsOf } from './population';
import { artifactLevel, ownsArtifact } from './artifacts';
import { techValue } from './techEffects';

export type CastBlock =
  | 'NotOwned' | 'NoActive' | 'NotEnoughMana' | 'InvalidTarget'
  // Its own window is still open, or the wait after it has not run out.
  | 'Active' | 'OnCooldown';

export type CastResult = 'Cast' | CastBlock;

/**
 * WHERE A RELIC'S ABILITY IS IN ITS CYCLE (Docs/features/09-relics.md §2.1).
 *
 * ACTIVE while its own window is open, COOLDOWN until the wait after it runs
 * out, READY otherwise. A relic that was never cast is READY.
 */
export type CastPhase = 'Active' | 'Cooldown' | 'Ready';

export interface CastState {
  phase: CastPhase;
  /** When the current phase ends, or null when READY. A TIMESTAMP, never a
   *  decremented integer, so a throttled background tab comes back correct. */
  until: number | null;
}

/**
 * THE COOLDOWN IS COUNTED FROM THE WINDOW'S CLOSE, never from the cast. A
 * 10-minute window on a 5-minute cooldown counted from the cast is 100%
 * uptime, which is no cooldown at all.
 *
 * Read at `now` rather than at `state.lastAdvance`: this answers a question
 * the player is asking with their thumb, and the sim's clock can be up to a
 * tick stale. Nothing accrues at these instants — a cooldown ending changes
 * only whether a cast is ALLOWED — so, unlike the zone's expiry, neither of
 * them is a boundary.
 */
export function castState(state: GameState, id: ArtifactId, now: number): CastState {
  const c = state.artifacts.casts[id];
  if (c === undefined) return { phase: 'Ready', until: null };
  if (now < c.endsAt) return { phase: 'Active', until: c.endsAt };
  if (now < c.readyAt) return { phase: 'Cooldown', until: c.readyAt };
  return { phase: 'Ready', until: null };
}

/**
 * HOW LONG THE WINDOW A CAST OPENS LASTS, at this relic's level. 0 for an
 * ability that resolves at once and leaves nothing standing.
 *
 * A window is the growing axis of a zone whose effect is a RATE — how much
 * recovers inside it is time — where a zone whose effect is a multiplier
 * grows its power instead. Exactly one of the two moves per relic.
 */
export function activeDurationMsAt(id: ArtifactId, level: number): number {
  const active = ARTIFACTS[id].active;
  if (active === null || active.durationSeconds <= 0) return 0;
  const n = Math.max(1, level);
  return (active.durationSeconds + active.durationPerLevel * (n - 1)) * 1000;
}

/** The window this relic's ability opens right now. */
export const activeDurationMs = (state: GameState, id: ArtifactId): number =>
  activeDurationMsAt(id, artifactLevel(state, id));

/**
 * HOW FAR AN ABILITY REACHES AT A LEVEL — the sheet's base plus one ring for
 * every step the relic has passed (§2.1).
 *
 * Pure in `level`, so the relic's page can ask it for this level and the next
 * and print the pair. An ability with no radius at all stays at 0: a step
 * ladder on a spell that is not an area would be three rungs of nothing.
 */
export function activeRadiusAt(id: ArtifactId, level: number): number {
  const base = ARTIFACTS[id].active?.radius ?? 0;
  if (base <= 0) return 0;
  return base + ARTIFACT_RADIUS_STEPS.filter((at) => level >= at).length;
}

/** The radius this relic's ability reaches right now. */
export const activeRadius = (state: GameState, id: ArtifactId): number =>
  activeRadiusAt(id, artifactLevel(state, id));

/**
 * Whether the relic can be cast at all, ignoring the target.
 *
 * HAVING IT IS THE WHOLE GATE. There is no socket to commit and no swap to
 * time: every relic the player has is on, so an ability is reachable the
 * moment its relic arrives. These four are spells in waiting
 * (Docs/features/07-research.md §6) and the gate they are designed to have is
 * the technology that discovers them; until that exists the relic is the
 * thing that knows the spell.
 */
export function castBlock(
  state: GameState, id: ArtifactId, now: number = state.lastAdvance,
): CastBlock | null {
  if (!ownsArtifact(state, id)) return 'NotOwned';
  const active = ARTIFACTS[id].active;
  if (active === null) return 'NoActive';
  // The cycle before the purse: a relic that is still running tells the player
  // to wait, not that they are poor.
  const phase = castState(state, id, now).phase;
  if (phase === 'Active') return 'Active';
  if (phase === 'Cooldown') return 'OnCooldown';
  if (mana(state) < castCost(state, id)) return 'NotEnoughMana';
  return null;
}

/** What casting actually costs right now — Resonance buys it down permanently,
 *  a timed boon can halve it on top. */
export function castCost(state: GameState, id: ArtifactId): number {
  const active = ARTIFACTS[id].active;
  if (active === null) return 0;
  const bought = active.manaCost * Math.max(0, techValue(state, 'activeCost', 1));
  return Math.max(0, Math.round(resolve(state, 'activeCost', bought)));
}

/** Cells a targeted active may legally be cast on. Empty for an untargeted
 *  one — the UI then shows a plain confirm instead of entering cast mode. */
export function validCastCells(state: GameState, map: MapData, id: ArtifactId): Coord[] {
  const active = ARTIFACTS[id].active;
  if (active === null || !active.targeted) return [];
  switch (active.id) {
    case 'Survey':
      // Cast on ground you HOLD, and it clears outward from there. The fog
      // still grows from what the player has rather than appearing as islands,
      // and the Townhall's reach still gates it: the spell buys the GOLD,
      // never the ladder.
      return map.cells.filter((c) => state.fog.revealed[coordKey(c)] === true
        && isWithinReach(state, map, c));
    case 'Divining':
    case 'Reap':
    case 'Haste':
    case 'Tithe':
      // Anywhere revealed — the radius does the work, so the player is
      // choosing a CENTRE, not a cell. A zone over nothing is a wasted cast
      // and the preview says so before the tap, which is the house rule:
      // the grid answers the question rather than a dialog afterwards.
      return map.cells.filter((c) => state.fog.revealed[coordKey(c)] === true);
    default:
      return [];
  }
}

/** The fog Survey would lift: unrevealed ground inside the zone that the
 *  Townhall can already reach. Nearest-first, so it reads as rings. */
export const surveyCells = (
  state: GameState, map: MapData, centre: Coord, radius: number,
): Coord[] =>
  cellsWithinRadius(map, centre, radius).filter(
    (c) => state.fog.revealed[coordKey(c)] !== true && isWithinReach(state, map, c),
  );

// ------------------------------------------------------- the auto-tap engine

/**
 * HOW MANY TAPS A CAST BUYS. The spell IS an exchange rate, and the rate is
 * what the relic's level moves (Docs/proposals/relic-effects.md §3.2).
 *
 * Priced off what the cast ACTUALLY cost, not off the sheet's sticker: a
 * Resonance rank that buys the cast down buys fewer taps with it, which is the
 * honest reading of "taps per Mana" and stops a discount doubling as a bonus.
 */
export function tapBudget(state: GameState, id: ArtifactId): number {
  const active = ARTIFACTS[id].active;
  if (active === null || active.tapsPerMana <= 0) return 0;
  const level = Math.max(1, artifactLevel(state, id));
  const rate = active.tapsPerMana + active.tapsPerManaPerLevel * (level - 1);
  return Math.max(0, Math.floor(castCost(state, id) * rate));
}

/**
 * HOW LONG THE RUN TAKES TO WATCH — the tap count over the tap rate.
 *
 * DERIVED, never authored. A window is what a budget looks like at a speed, so
 * authoring it beside the budget would be two numbers that can disagree.
 */
export const tapRunSeconds = (state: GameState, id: ArtifactId): number =>
  tapBudget(state, id) / ARTIFACT_AUTO_TAP_PER_SECOND;

/** The cells Reap will work: revealed harvest nodes in the zone, nearest
 *  first — `cellsWithinRadius` is already ordered that way. */
export const reapCells = (
  state: GameState, map: MapData, centre: Coord, radius: number,
): Coord[] =>
  [centre, ...cellsWithinRadius(map, centre, radius)].filter(
    (c) => harvestSourceAt(state, c) !== null && state.fog.revealed[coordKey(c)] === true,
  );

/**
 * SPEND A BUDGET OF TAPS over `cells`, nearest-first and round robin.
 *
 * ROUND ROBIN, not one cell drained at a time, because the budget is the
 * decision and the area is only where it is spent: a player who placed a zone
 * over five nodes meant all five.
 *
 * IT ALL LANDS AT THE CAST, and the window is a thing to WATCH rather than a
 * clock the sim keeps. Spreading thirty taps over seven seconds would put
 * thirty boundaries in the advance loop for an effect whose inputs cannot
 * change while it runs — the cells, the budget and the rate are all fixed the
 * moment the spell is paid for, so ticking it would produce exactly this
 * answer more slowly, and one-call replay would have to be argued rather than
 * being true by construction. It also means a player who casts and closes the
 * app still gets what they paid for.
 *
 * A TAP HERE COSTS NO MANA — `tapCell`, not `collectTap`. Thirty taps at 1
 * Mana each would be impossible, so this is the one exception to *every player
 * tap costs 1 Mana*, and the exception is the design.
 */
export function spendTaps(
  state: GameState, map: MapData, cells: readonly Coord[], budget: number, now: number,
): { spent: number; touched: Coord[] } {
  const touched: Coord[] = [];
  const seen = new Set<string>();
  let spent = 0;
  let live = [...cells];
  while (spent < budget && live.length > 0) {
    const next: Coord[] = [];
    for (const c of live) {
      if (spent >= budget) {
        next.push(c);
        continue;
      }
      // A cell that gives nothing is DROPPED for the rest of the run rather
      // than retried: the nodes exhaust and the houses do not, and a run that
      // kept asking an empty node would spend its budget on nothing.
      if (tapCell(state, map, c, now) !== 'Harvested') continue;
      spent += 1;
      next.push(c);
      const key = coordKey(c);
      if (!seen.has(key)) {
        seen.add(key);
        touched.push(c);
      }
    }
    live = next;
    if (spent === 0 && touched.length === 0) break;
  }
  return { spent, touched };
}

/**
 * HOW HARD A ZONE HITS at this relic's level — the multiplier the call sites
 * inside it read. Floored at 1, so a relic with no authored power is a zone
 * that changes nothing rather than one that divides by zero.
 */
export function activePowerAt(id: ArtifactId, level: number): number {
  const active = ARTIFACTS[id].active;
  if (active === null || active.power <= 0) return 1;
  const n = Math.max(1, level);
  return active.power + active.powerPerLevel * (n - 1);
}

/** How hard this relic's zone hits right now. */
export const activePower = (state: GameState, id: ArtifactId): number =>
  activePowerAt(id, artifactLevel(state, id));

/** The built districts standing in a zone. A building is its ANCHOR cell, so
 *  a wide building is in or out as a whole. */
export const buildingsIn = (state: GameState, area: ModifierArea): District[] =>
  state.city.districts.filter((d) => areaCovers(area, d.location));

/**
 * `spendTaps` for HOUSES. Same budget, same round robin, same freedom from
 * Mana — and one difference that is the whole asymmetry the cooldown exists
 * to hold: a house never runs dry, so this always spends the lot (OQ-99).
 */
export function spendHouseTaps(
  state: GameState, houses: readonly District[], budget: number, now: number,
): { spent: number; touched: Coord[]; gold: number } {
  const touched: Coord[] = [];
  let spent = 0;
  let gold = 0;
  if (houses.length === 0) return { spent, touched, gold };
  while (spent < budget) {
    for (const d of houses) {
      if (spent >= budget) break;
      gold += pullHouseForward(state, d, now);
      spent += 1;
      if (!touched.some((c) => coordKey(c) === coordKey(d.location))) touched.push(d.location);
    }
  }
  return { spent, touched, gold };
}

/** What a cast did, for the floaters and the banner. */
export interface CastReport {
  result: CastResult;
  activeId: ArtifactActiveId | null;
  /** Cells the effect touched — the renderer sparkles them. */
  affected: Coord[];
  /** Gold the player did NOT have to spend (Divination). */
  goldSaved: number;
  /** Taps an auto-tap ability actually landed. 0 for every other one. */
  taps: number;
}

const nothing = (result: CastResult): CastReport =>
  ({ result, activeId: null, affected: [], goldSaved: 0, taps: 0 });

export function cast(
  state: GameState,
  map: MapData,
  id: ArtifactId,
  target: Coord | null,
  now: number,
): CastReport {
  const block = castBlock(state, id, now);
  if (block !== null) return nothing(block);
  const active = ARTIFACTS[id].active!;
  if (active.targeted && target === null) return nothing('InvalidTarget');
  if (active.targeted && !validCastCells(state, map, id).some((c) => coordKey(c) === coordKey(target!))) {
    return nothing('InvalidTarget');
  }

  const report: CastReport = {
    result: 'Cast', activeId: active.id, affected: [], goldSaved: 0, taps: 0,
  };
  switch (active.id) {
    case 'Divining': {
      // THE REFILL FIRST. A recovery wait is stamped when the cell exhausts,
      // not read each tick, so the zone below only ever reaches cells that
      // empty INSIDE it — which is what emptying the waiting list arranges.
      for (const c of reapCells(state, map, target!, activeRadius(state, id))) {
        const spec = harvestSpecAt(state, c);
        const cell = state.harvest[coordKey(c)];
        if (spec === null || cell === undefined) continue;
        // To what the GROUND holds, not the authored stock: a wake on
        // grassland puts back more than one on sand, which is the rule
        // recovery already follows (04-harvest.md §2).
        const full = effectiveStock(state, map, c, spec);
        if (cell.units >= full && cell.exhaustedUntil === null) continue;
        cell.units = full;
        cell.exhaustedUntil = null;
        cell.recoveryMs = null;
        report.affected.push(c);
      }
      addModifier(state, {
        id: newId(state, 'divining'),
        source: 'artifact',
        stat: 'recoverySpeed',
        scope: null,
        op: 'mul',
        value: activePower(state, id),
        expiresAt: now + activeDurationMs(state, id),
        area: { centre: target!, radius: activeRadius(state, id), relic: id, since: now },
      });
      break;
    }
    case 'Reap': {
      const cells = reapCells(state, map, target!, activeRadius(state, id));
      const run = spendTaps(state, map, cells, tapBudget(state, id), now);
      report.affected.push(...run.touched);
      report.taps = run.spent;
      break;
    }
    case 'Haste': {
      // TWO NUMBERS, ONE IDEA. "Faster" for a crew is the swing AND the walk:
      // speeding only the walk would be a fraction of a round trip and would
      // read as nothing.
      const area = { centre: target!, radius: activeRadius(state, id), relic: id, since: now };
      const power = activePower(state, id);
      const until = now + activeDurationMs(state, id);
      for (const stat of ['workerStrikeSpeed', 'workerSpeed'] as const) {
        addModifier(state, {
          id: newId(state, `haste:${stat}`),
          source: 'artifact',
          stat,
          scope: null,
          op: 'mul',
          value: power,
          expiresAt: until,
          area,
        });
      }
      report.affected.push(...buildingsIn(state, area).map((d) => d.location));
      break;
    }
    case 'Tithe': {
      const zone = { centre: target!, radius: activeRadius(state, id), relic: id, since: now };
      const houses = buildingsIn(state, zone)
        .filter((d) => d.state === 'Built' && residentsOf(state, d) > 0);
      const run = spendHouseTaps(state, houses, tapBudget(state, id), now);
      report.affected.push(...run.touched);
      report.taps = run.spent;
      report.goldSaved = run.gold;
      break;
    }
    case 'Survey': {
      // RING BY RING from the cell it was cast on, so the fog grows out of
      // what the player holds rather than appearing as islands. Cells are
      // already ordered nearest-first, and the Townhall's reach still gates
      // each one: the spell buys the GOLD, never the ladder.
      for (const c of surveyCells(state, map, target!, activeRadius(state, id))) {
        const key = coordKey(c);
        report.goldSaved += revealCostForCell(state, map, c) - revealPaidSoFar(state, map, c);
        delete state.fog.progress[key];
        delete state.fog.discovered[key];
        state.fog.revealed[key] = true;
        report.affected.push(c);
      }
      break;
    }
  }
  payMana(state, castCost(state, id));
  // THE CYCLE STARTS HERE, and the wait is measured from where the window
  // ends — which for an ability that leaves nothing standing is `now`.
  const endsAt = now + activeDurationMs(state, id);
  state.artifacts.casts[id] = {
    endsAt,
    readyAt: endsAt + ARTIFACT_COOLDOWN_SECONDS * 1000,
  };
  return report;
}

/** Divination's value at a glance: the Gold this cast would save right here. */
export const divinationSaving = (state: GameState, map: MapData, cell: Coord): number =>
  Math.max(0, revealCostForCell(state, map, cell) - revealPaidSoFar(state, map, cell));

/** Cells Bloom would touch from this centre, for the placement preview. */
export const bloomPreview = (state: GameState, map: MapData, centre: Coord, radius: number): Coord[] =>
  [centre, ...cellsWithinRadius(map, centre, radius)].filter(
    (c) => harvestSourceAt(state, c) !== null && state.fog.revealed[coordKey(c)] === true,
  );
