// The four artifact ACTIVES (Docs/features/08-magic.md §2).
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

import { ARTIFACTS, FEATURES, type ArtifactActiveId } from './data/definitions';
import { fogState, revealCostForCell } from './fog';
import { cellsWithinRadius, type MapData } from './grid';
import { effectiveStock, harvestSourceAt, harvestSpecAt } from './harvest';
import { mana, payMana } from './mana';
import { addModifier, resolve } from './modifiers';
import {
  coordKey, districtAt, newId, type ArtifactId, type Coord, type GameState,
} from './state';
import { isAttuned, ownsArtifact } from './artifacts';
import { effect } from './upgrades';

export type CastBlock =
  | 'NotOwned' | 'NoActive' | 'NotEnoughMana' | 'InvalidTarget' | 'NotAttuned';

export type CastResult = 'Cast' | CastBlock;

/** Whether the relic can be cast at all, ignoring the target.
 *
 *  Casting requires the relic to be ATTUNED. That is the whole point of the
 *  slot: an ability you can reach without committing a socket to its passive
 *  would make the loadout limit free. */
export function castBlock(state: GameState, id: ArtifactId): CastBlock | null {
  if (!ownsArtifact(state, id)) return 'NotOwned';
  const active = ARTIFACTS[id].active;
  if (active === null) return 'NoActive';
  if (!isAttuned(state, id)) return 'NotAttuned';
  if (mana(state) < castCost(state, id)) return 'NotEnoughMana';
  return null;
}

/** What casting actually costs right now — Resonance buys it down permanently,
 *  a Conjunction can halve it on top. */
export function castCost(state: GameState, id: ArtifactId): number {
  const active = ARTIFACTS[id].active;
  if (active === null) return 0;
  const bought = active.manaCost * Math.max(0, 1 - effect(state, 'Resonance'));
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
      // to buy, and one you cannot see is not a decision yet.
      return map.cells.filter((c) => fogState(state, map, c) === 'Discovered');
    case 'Bloom':
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

/** What a cast did, for the floaters and the banner. */
export interface CastReport {
  result: CastResult;
  activeId: ArtifactActiveId | null;
  /** Cells the effect touched — the renderer sparkles them. */
  affected: Coord[];
  /** Gold the player did NOT have to spend (Divination). */
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
  const block = castBlock(state, id);
  if (block !== null) return nothing(block);
  const active = ARTIFACTS[id].active!;
  if (active.targeted && target === null) return nothing('InvalidTarget');
  if (active.targeted && !validCastCells(state, map, id).some((c) => coordKey(c) === coordKey(target!))) {
    return nothing('InvalidTarget');
  }

  const report: CastReport = { result: 'Cast', activeId: active.id, affected: [], goldSaved: 0 };
  switch (active.id) {
    case 'Divination': {
      // Its Mana price is FLAT while the Gold reveal cost DOUBLES every ring,
      // so its value grows with depth — exactly where the pain is. This is the
      // relic that turns the fog from a chore into a real question.
      const key = coordKey(target!);
      const total = revealCostForCell(state, map, target!);
      report.goldSaved = total - (state.fog.progress[key] ?? 0);
      delete state.fog.progress[key];
      delete state.fog.discovered[key];
      state.fog.revealed[key] = true;
      report.affected.push(target!);
      break;
    }
    case 'Bloom': {
      // Clears exhaustion outright rather than shortening it: a "come back
      // sooner" button would just be a worse version of the passive.
      const cells = [target!, ...cellsWithinRadius(map, target!, active.radius)];
      for (const c of cells) {
        if (harvestSourceAt(state, c) === null) continue;
        if (state.fog.revealed[coordKey(c)] !== true) continue;
        const spec = harvestSpecAt(state, c)!;
        // Refill to what the GROUND holds, not to the authored stock: a Bloom
        // on grassland puts back more than one on sand, which is the same rule
        // recovery follows (04-harvest.md §3).
        const full = effectiveStock(map, c, spec);
        const cell = state.harvest[coordKey(c)];
        if (cell === undefined || (cell.units >= full && cell.exhaustedUntil === null)) continue;
        cell.units = full;
        cell.exhaustedUntil = null;
        report.affected.push(c);
      }
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
  return report;
}

/** Divination's value at a glance: the Gold this cast would save right here. */
export const divinationSaving = (state: GameState, map: MapData, cell: Coord): number =>
  Math.max(0, revealCostForCell(state, map, cell) - (state.fog.progress[coordKey(cell)] ?? 0));

/** Cells Bloom would touch from this centre, for the placement preview. */
export const bloomPreview = (state: GameState, map: MapData, centre: Coord, radius: number): Coord[] =>
  [centre, ...cellsWithinRadius(map, centre, radius)].filter(
    (c) => harvestSourceAt(state, c) !== null && state.fog.revealed[coordKey(c)] === true,
  );
