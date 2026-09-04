// Workers as units: claims, the Idle→MovingToCell→Working→MovingHome FSM, and
// the event-driven advance that serves both the live tick and offline replay
// (Docs/features/harvest-loop.md §3).

import { DISTRICTS, HARVEST, WORKER, levelIndexed } from './data/definitions';
import { cellsWithinRadiusOfRect, euclideanTiles, type MapData } from './grid';
import { effectiveWorkerYield , effectiveWorkerSpeed } from './upgrades';
import { harvestSourceAt, isExhausted, recoversAt, registerTap } from './harvest';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import {
  addToWallet, coordKey, districtById, newId, sameCell,
  type Coord, type CurrencyId, type District, type GameState, type Worker,
} from './state';

// ------------------------------------------------------------ area of influence

export function influenceRadius(district: District): number {
  const list = DISTRICTS[district.definitionId].influenceRadiusPerLevel;
  return list.length === 0 ? 0 : levelIndexed(list, district.level);
}

export const influenceCells = (map: MapData, district: District): Coord[] =>
  cellsWithinRadiusOfRect(
    map, district.location, DISTRICTS[district.definitionId].size, influenceRadius(district),
  );

/** Revealed resource cells of the building's source type in its area
 *  (exhausted cells count — workers wait for them to recover). */
export function workableCells(state: GameState, map: MapData, district: District): Coord[] {
  const source = DISTRICTS[district.definitionId].harvestSource;
  if (!source) return [];
  return influenceCells(map, district).filter(
    (c) => state.fog.revealed[coordKey(c)] === true && harvestSourceAt(state, c) === source,
  );
}

/** The per-level worker cap. Workable cells in range don't limit assignment —
 *  workers beyond the available cells simply wait Idle. */
export function assignableWorkerLimit(district: District): number {
  const def = DISTRICTS[district.definitionId];
  if (def.maxWorkersPerLevel.length === 0) return 0;
  return levelIndexed(def.maxWorkersPerLevel, district.level);
}

// ------------------------------------------------------------------------ claims

const isClaimed = (state: GameState, cell: Coord, except?: Worker): boolean =>
  state.workers.some(
    (w) => w !== except && w.claimedCell !== null && sameCell(w.claimedCell, cell),
  );

/** Nearest unclaimed, non-exhausted workable cell (workableCells is nearest-first). */
function findClaimableCell(
  state: GameState,
  map: MapData,
  district: District,
  now: number,
  except?: Worker,
): Coord | null {
  for (const cell of workableCells(state, map, district)) {
    if (!isClaimed(state, cell, except) && !isExhausted(state, cell, now)) return cell;
  }
  return null;
}

// --------------------------------------------------------------------------- FSM

/** A leg's duration, at the speed the kingdom walks at when the leg STARTS
 *  (Cartage). Fixed for the leg, like every other StateUntil, so replay and
 *  stepped ticking agree on when the worker arrives. */
const moveMs = (state: GameState, from: Coord, to: Coord): number =>
  (euclideanTiles(from, to) / effectiveWorkerSpeed(state)) * 1000;

const setState = (
  w: Worker,
  activity: Worker['activity'],
  at: number,
  until: number | null,
): void => {
  w.activity = activity;
  w.stateStartedAt = at;
  w.stateUntil = until;
};

/** From the building: claim a cell and head out, or go/stay Idle. */
function tryDispatch(state: GameState, map: MapData, w: Worker, building: District, at: number): void {
  const cell = findClaimableCell(state, map, building, at, w);
  if (cell) {
    w.claimedCell = cell;
    setState(w, 'MovingToCell', at, at + moveMs(state, building.location, cell));
  } else {
    w.claimedCell = null;
    setState(w, 'Idle', at, null);
  }
}

/** A worker deposit event, surfaced for UI floaters. */
export interface DepositEvent {
  cell: Coord; // the building's cell
  currencyId: CurrencyId;
  amount: number;
}

/** When this worker next needs processing; null = never (blocked Idle). */
function nextEventAt(state: GameState, map: MapData, w: Worker, building: District): number | null {
  if (w.activity !== 'Idle') return w.stateUntil;
  // Idle: wake when any unclaimed workable cell exists or recovers — never
  // before stateStartedAt (which completion/reveal events bump forward, so a
  // cell that appeared mid-absence isn't worked retroactively).
  let earliest: number | null = null;
  for (const cell of workableCells(state, map, building)) {
    if (isClaimed(state, cell, w)) continue;
    const at = Math.max(w.stateStartedAt, recoversAt(state, cell, w.stateStartedAt) ?? w.stateStartedAt);
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

/** Process one worker event at time t. */
function step(state: GameState, map: MapData, w: Worker, building: District, t: number, deposits: DepositEvent[]): void {
  switch (w.activity) {
    case 'Idle':
      tryDispatch(state, map, w, building, t);
      break;
    case 'MovingToCell': {
      const cell = w.claimedCell!;
      if (isExhausted(state, cell, t) || harvestSourceAt(state, cell) !== DISTRICTS[building.definitionId].harvestSource) {
        // Exhausted (or vanished) en route: turn back empty-handed.
        w.claimedCell = null;
        w.carrying = false;
        setState(w, 'MovingHome', t, t + moveMs(state, cell, building.location));
      } else {
        setState(w, 'Working', t, t + WORKER.workSeconds * 1000);
      }
      break;
    }
    case 'Working': {
      // Race rule: the unit is secured even if the cell exhausted mid-work.
      w.carrying = true;
      setState(w, 'MovingHome', t, t + moveMs(state, w.claimedCell!, building.location));
      break;
    }
    case 'MovingHome': {
      if (w.carrying && w.claimedCell) {
        const source = harvestSourceAt(state, w.claimedCell);
        if (source) {
          const spec = HARVEST[source];
          const amount = effectiveWorkerYield(state, spec);
          addToWallet(state.city.wallet, spec.currencyId, amount);
          recordResourceDiscovery(state, spec.currencyId);
          recordQuestEvent(state, { kind: 'collect', currency: spec.currencyId, amount });
          registerTap(state, w.claimedCell, spec, t);
          deposits.push({ cell: building.location, currencyId: spec.currencyId, amount });
        }
      }
      w.carrying = false;
      // Keep the claim if the cell is still workable; otherwise pick another.
      if (w.claimedCell && !isExhausted(state, w.claimedCell, t) &&
          harvestSourceAt(state, w.claimedCell) === DISTRICTS[building.definitionId].harvestSource) {
        setState(w, 'MovingToCell', t, t + moveMs(state, building.location, w.claimedCell));
      } else {
        w.claimedCell = null;
        tryDispatch(state, map, w, building, t);
      }
      break;
    }
  }
}

/** Advance all workers to `toTime`, processing events in chronological order. */
export function advanceWorkers(state: GameState, map: MapData, toTime: number): DepositEvent[] {
  const deposits: DepositEvent[] = [];
  for (;;) {
    let next: Worker | null = null;
    let nextAt = Infinity;
    for (const w of state.workers) {
      const building = districtById(state, w.buildingId);
      if (!building || building.state !== 'Built') continue;
      const at = nextEventAt(state, map, w, building);
      if (at !== null && at <= toTime && at < nextAt) {
        next = w;
        nextAt = at;
      }
    }
    if (next === null) return deposits;
    const building = districtById(state, next.buildingId)!;
    // Guard against zero-length loops: an Idle worker whose dispatch fails
    // advances its own reference time so the same wake isn't reprocessed.
    const before = next.activity;
    step(state, map, next, building, nextAt, deposits);
    if (before === 'Idle' && next.activity === 'Idle') {
      next.stateStartedAt = nextAt + 1;
    }
  }
}

// -------------------------------------------------------------- assign/unassign

export function addWorker(state: GameState, map: MapData, district: District, now: number): void {
  const w: Worker = {
    id: newId(state, `worker_${district.definitionId}`),
    buildingId: district.uniqueId,
    activity: 'Idle',
    claimedCell: null,
    carrying: false,
    stateStartedAt: now,
    stateUntil: null,
  };
  state.workers.push(w);
  district.assignedWorkers += 1;
  tryDispatch(state, map, w, district, now);
}

/**
 * The building moved: re-home its crew without taking anything from them.
 *
 * Two cases, and the split is the whole point. A worker **carrying** a load
 * keeps its claim and simply walks to the new address instead of the old one
 * — the deposit still lands on arrival, so relocating never costs the player
 * a trip already worked for. A worker **not** carrying releases its claim and
 * goes Idle at `now`, because the cell it was walking to may be outside the
 * new influence radius; `tryDispatch` then picks one that is in range.
 *
 * `from` is the OLD location, and it has to be passed rather than read: the
 * caller has already moved the district by the time the walk home is timed.
 */
export function relocateCrew(
  state: GameState,
  district: District,
  from: Coord,
  now: number,
): void {
  for (const w of state.workers) {
    if (w.buildingId !== district.uniqueId) continue;
    // Where the worker actually is right now, timed against the OLD home.
    const at = w.activity === 'Idle' ? from
      : w.activity === 'Working' ? (w.claimedCell ?? from)
        : (workerPosition(state, w, now) ?? from);
    if (w.carrying) {
      setState(w, 'MovingHome', now, now + moveMs(state, at, district.location));
    } else {
      w.claimedCell = null;
      setState(w, 'Idle', now, null);
    }
  }
}

/** Despawn the last worker of the building; its claim is released and any
 *  carried load is lost (design decision). */
export function removeWorker(state: GameState, district: District): void {
  for (let i = state.workers.length - 1; i >= 0; i--) {
    if (state.workers[i].buildingId === district.uniqueId) {
      state.workers.splice(i, 1);
      district.assignedWorkers -= 1;
      return;
    }
  }
}

/** Render helper: the worker's current position in cell coordinates. */
export function workerPosition(state: GameState, w: Worker, now: number): Coord | null {
  const building = districtById(state, w.buildingId);
  if (!building) return null;
  const home = building.location;
  if (w.activity === 'Idle') return home;
  if (w.activity === 'Working') return w.claimedCell;
  const target = w.claimedCell;
  // MovingHome after an aborted trip has no claim — interpolate from where it was.
  const from = w.activity === 'MovingToCell' ? home : (target ?? home);
  const to = w.activity === 'MovingToCell' ? (target ?? home) : home;
  const duration = (w.stateUntil ?? now) - w.stateStartedAt;
  const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - w.stateStartedAt) / duration));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
