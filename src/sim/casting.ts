// The WORLD relics' spells — Survey and Lamplight (Docs/features/09-relics.md
// §2.2). A city relic has no spell: it is ACTIVATED in its Shrine instead
// (sim/hosts.ts).
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
  ARTIFACTS, ARTIFACT_COOLDOWN_SECONDS, ARTIFACT_RADIUS_STEPS, relicKind,
  type ArtifactActiveId,
} from './data/definitions';
import { isWithinReach, revealCostForCell, revealPaidSoFar } from './fog';
import { onPaidReveal, undiscoveredAround } from './treasures';
import { cellsWithinRadius, type MapData } from './grid';
import { mana, payMana } from './mana';
import { resolve } from './modifiers';
import { coordKey, type ArtifactId, type Coord, type GameState } from './state';
import { artifactLevel, ownsArtifact } from './artifacts';

export type CastBlock =
  | 'NotOwned' | 'NoActive' | 'NotEnoughMana' | 'InvalidTarget'
  // A world relic's spell waits for a Chapel to hold it.
  | 'NotHosted'
  // Its own window is still open, or the wait after it has not run out.
  | 'Active' | 'OnCooldown';

export type CastResult = 'Cast' | CastBlock;

/**
 * WHERE A RELIC'S ABILITY IS IN ITS CYCLE (Docs/features/09-relics.md §2.2).
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
  // CHARGES FIRST, and they have no clock. A lantern lit and not spent stays
  // lit: the only clock a delve has is the player opening the next door, so
  // the relic is ACTIVE until the last room takes the last charge.
  if (chargesLeft(state, id) > 0) return { phase: 'Active', until: null };
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
 * every step the relic has passed (09-relics.md §2.2).
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
 * Whether the relic can be cast at all, ignoring the target: owned, holding
 * a spell, held by a Chapel, out of its cycle, and paid for.
 */
export function castBlock(
  state: GameState, id: ArtifactId, now: number = state.lastAdvance,
): CastBlock | null {
  if (!ownsArtifact(state, id)) return 'NotOwned';
  const active = ARTIFACTS[id].active;
  if (active === null) return 'NoActive';
  // A world relic's spell waits for a Chapel to hold it.
  if (relicKind(id) === 'world' && !state.world.chapels.includes(id)) return 'NotHosted';
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
  const bought = active.manaCost * Math.max(0, 1);
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

/**
 * HOW HARD AN ABILITY HITS at this relic's level — the multiplier it pays.
 * Floored at 1, so a relic with no authored power changes nothing rather than
 * dividing by zero.
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

/** How many uses a cast buys, for an ability counted in events. 0 = not one. */
export function activeChargesAt(id: ArtifactId, level: number): number {
  const active = ARTIFACTS[id].active;
  if (active === null || active.charges <= 0) return 0;
  const n = Math.max(1, level);
  return Math.round(active.charges + active.chargesPerLevel * (n - 1));
}

/** Uses this relic's ability still has in hand. */
export const chargesLeft = (state: GameState, id: ArtifactId): number =>
  state.artifacts.charges[id] ?? 0;

/**
 * SPEND ONE USE, and return the multiplier it was worth — 1 when the relic has
 * none in hand, so a call site can multiply unconditionally.
 *
 * THE COOLDOWN STARTS ON THE LAST ONE. A charged ability has no window to
 * close, so the moment its last use is taken IS the close, and the wait is
 * counted from there like every other spell's (09-relics.md §2.2).
 */
export function spendCharge(state: GameState, id: ArtifactId, now: number): number {
  const left = chargesLeft(state, id);
  if (left <= 0) return 1;
  state.artifacts.charges[id] = left - 1;
  if (left - 1 === 0) {
    delete state.artifacts.charges[id];
    state.artifacts.casts[id] = {
      endsAt: now,
      readyAt: now + ARTIFACT_COOLDOWN_SECONDS * 1000,
    };
  }
  return activePower(state, id);
}

/** What a cast did, for the floaters and the banner. */
export interface CastReport {
  result: CastResult;
  activeId: ArtifactActiveId | null;
  /** Cells the effect touched — the renderer sparkles them. */
  affected: Coord[];
  /** Gold the player did NOT have to spend (Survey). */
  goldSaved: number;
}

const nothing = (result: CastResult): CastReport =>
  ({ result, activeId: null, affected: [], goldSaved: 0 });

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
  if (active.targeted
    && !validCastCells(state, map, id).some((c) => coordKey(c) === coordKey(target!))) {
    return nothing('InvalidTarget');
  }
  // WHERE IT LANDS: a ring round the cell the player picked.
  const zoneCells: Coord[] = target === null
    ? []
    : [target, ...cellsWithinRadius(map, target, activeRadius(state, id))];

  const report: CastReport = {
    result: 'Cast', activeId: active.id, affected: [], goldSaved: 0,
  };
  switch (active.id) {
    case 'Lamplight': {
      // No zone, no window — a handful of uses that wait for the player to go
      // down and open a door.
      state.artifacts.charges[id] = activeChargesAt(id, artifactLevel(state, id));
      break;
    }
    case 'Survey': {
      // RING BY RING from the cell it was cast on, so the fog grows out of
      // what the player holds rather than appearing as islands. Cells are
      // already ordered nearest-first, and the Townhall's reach still gates
      // each one: the spell buys the GOLD, never the ladder.
      // The player cast it, so the cells count towards the treasures — read
      // what was undiscovered first, as a tap does (sim/treasures.ts).
      const cells = zoneCells.filter((c) => state.fog.revealed[coordKey(c)] !== true && isWithinReach(state, map, c));
      const fresh = undiscoveredAround(state, map, cells);
      for (const c of cells) {
        const key = coordKey(c);
        report.goldSaved += revealCostForCell(state, map, c) - revealPaidSoFar(state, map, c);
        delete state.fog.progress[key];
        delete state.fog.discovered[key];
        state.fog.revealed[key] = true;
        report.affected.push(c);
      }
      if (cells.length > 0) onPaidReveal(state, map, cells, fresh);
      break;
    }
  }
  payMana(state, castCost(state, id));
  // THE CYCLE STARTS HERE, and the wait is measured from where the window
  // ends — which for an ability that leaves nothing standing is `now`.
  // A CHARGED ABILITY STARTS NO CLOCK. Its close is the moment its last use
  // is spent (`spendCharge`), which may be minutes or days away, so stamping a
  // cooldown here would let the relic come back READY with charges in hand.
  if (chargesLeft(state, id) === 0) {
    const endsAt = now + activeDurationMs(state, id);
    state.artifacts.casts[id] = {
      endsAt,
      readyAt: endsAt + ARTIFACT_COOLDOWN_SECONDS * 1000,
    };
  }
  return report;
}

/** Divination's value at a glance: the Gold this cast would save right here. */
export const divinationSaving = (state: GameState, map: MapData, cell: Coord): number =>
  Math.max(0, revealCostForCell(state, map, cell) - revealPaidSoFar(state, map, cell));
