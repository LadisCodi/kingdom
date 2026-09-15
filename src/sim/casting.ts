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
  ARTIFACT_RADIUS_STEPS, FEATURES, type ArtifactActiveId,
} from './data/definitions';
import { fogState, isWithinReach, revealCostForCell, revealPaidSoFar } from './fog';
import { cellsWithinRadius, type MapData } from './grid';
import { harvestSourceAt, tapCell } from './harvest';
import { mana, payMana } from './mana';
import { addModifier, resolve } from './modifiers';
import {
  coordKey, districtAt, newId, type ArtifactId, type Coord, type GameState,
} from './state';
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

/** How long the window a cast opens lasts. 0 for an ability that resolves at
 *  once and leaves nothing standing. */
export const activeDurationMs = (id: ArtifactId): number =>
  (ARTIFACTS[id].active?.durationSeconds ?? 0) * 1000;

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
    case 'Divination':
      // The frontier only: a cell you have already paid off has nothing left
      // to buy, and one you cannot see is not a decision yet. And inside the
      // Townhall's reach: a spell is the player exploring, and it obeys the
      // same border a paid tap does.
      return map.cells.filter((c) => fogState(state, map, c) === 'Discovered'
        && isWithinReach(state, map, c));
    case 'Reap':
      // Anywhere revealed — the radius does the work, so the player is
      // choosing a CENTRE, not a cell.
      return map.cells.filter((c) => state.fog.revealed[coordKey(c)] === true);
    case 'Beckon':
      // Only where a called-back feature could actually stand.
      return map.cells.filter((c) => beckonTargetIsLegal(state, map, c));
    default:
      return [];
  }
}

/** Beckon needs a revealed, empty cell whose terrain suits SOME feature that
 *  is currently waiting to respawn. Without the pending-respawn clause it
 *  would be a "make resources appear" button rather than "hurry one back". */
function beckonTargetIsLegal(state: GameState, map: MapData, cell: Coord): boolean {
  const key = coordKey(cell);
  if (state.fog.revealed[key] !== true) return false;
  if (state.features[key] !== undefined) return false;
  if (districtAt(state, cell) !== undefined) return false;
  const terrain = map.terrain.get(key);
  return state.featureRespawns.some((r) => FEATURES[r.feature].respawnTerrain === terrain);
}

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
    case 'Divination': {
      // Its Mana price is FLAT while the Gold reveal cost DOUBLES every ring,
      // so its value grows with depth — exactly where the pain is. This is the
      // relic that turns the fog from a chore into a real question.
      const key = coordKey(target!);
      // What is left of the price, not the whole of it: the taps already
      // spent on this cell were paid, and Divination does not refund them.
      report.goldSaved = revealCostForCell(state, map, target!)
        - revealPaidSoFar(state, map, target!);
      delete state.fog.progress[key];
      delete state.fog.discovered[key];
      state.fog.revealed[key] = true;
      report.affected.push(target!);
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
      // Cast on the way OUT. Divination and Bloom reward being present; a game
      // played in visits needs a good departure move too.
      addModifier(state, {
        id: newId(state, 'haste'),
        source: 'artifact',
        stat: 'workerYield',
        scope: null,
        op: 'mul',
        value: 2,
        expiresAt: now + active.durationSeconds * 1000,
      });
      break;
    }
    case 'Beckon': {
      // Take the respawn that has been waiting longest and land it here, now.
      const terrain = map.terrain.get(coordKey(target!));
      const idx = state.featureRespawns
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => FEATURES[r.feature].respawnTerrain === terrain)
        .sort((a, b) => a.r.readyAt - b.r.readyAt)[0]?.i;
      if (idx === undefined) return nothing('InvalidTarget');
      const [pending] = state.featureRespawns.splice(idx, 1);
      const key = coordKey(target!);
      state.features[key] = pending.feature;
      state.featureMeta[key] = { origin: pending.origin, generation: pending.generation };
      delete state.harvest[key];
      report.affected.push(target!);
      break;
    }
  }
  payMana(state, castCost(state, id));
  // THE CYCLE STARTS HERE, and the wait is measured from where the window
  // ends — which for an ability that leaves nothing standing is `now`.
  const endsAt = now + activeDurationMs(id);
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
