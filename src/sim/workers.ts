// Workers as units: claims, the Idle→MovingToCell→Working FSM, and the
// event-driven advance that serves both the live tick and offline replay
// (Docs/features/04-harvest.md §5).
//
// A worker walks out ONCE and then works the cell in place, STRIKING it every
// `secondsPerStrike` and crediting the wallet on the strike. There is no load,
// no return trip and no delivery — the strike is the player's tap performed by
// somebody else. What is left of travel is MIGRATION: a worker whose cell
// empties releases the claim and walks to another, and that is both where the
// distance cost lives and the visible signal that you are over-extracting.

import { DISTRICTS, HARVEST, WORKER, levelIndexed } from './data/definitions';
import { cellsWithinRadiusOfRect, euclideanTiles, type MapData } from './grid';
import { effectiveWorkerStrike, workerStrikeMs } from './upgrades';
import { drawFromCell, harvestSourceAt, isExhausted, recoversAt } from './harvest';
import { recordResourceDiscovery } from './discovery';
import { recordQuestEvent } from './quests';
import {
  addToWallet, coordKey, districtById, newId, sameCell,
  type Coord, type CurrencyId, type District, type GameState,
  type HarvestSourceId, type Worker,
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
  const sources = DISTRICTS[district.definitionId].harvestSources;
  if (sources.length === 0) return [];
  return influenceCells(map, district).filter(
    (c) => state.fog.revealed[coordKey(c)] === true && worksHere(sources, state, c),
  );
}

/** Does this building go after whatever is on that cell? The Mine works two
 *  different mountains, so "the building's source" is a set, not a value. */
const worksHere = (
  sources: readonly HarvestSourceId[], state: GameState, cell: Coord,
): boolean => {
  const here = harvestSourceAt(state, cell);
  return here !== null && sources.includes(here);
};

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

const moveMs = (from: Coord, to: Coord): number =>
  (euclideanTiles(from, to) / WORKER.moveSpeedTilesPerSecond) * 1000;

/** A stable angle per worker id, so an idle worker keeps its spot by the door
 *  instead of jittering. Integer arithmetic, like every other hash here. */
const unitPhase = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
};

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
    setState(w, 'MovingToCell', at, at + moveMs(building.location, cell));
  } else {
    w.claimedCell = null;
    setState(w, 'Idle', at, null);
  }
}

/** A strike: the axe landing on the CELL. The renderer hits that cell with
 *  the player's own punch and foley, at half volume and without the flash.
 *  Carries no amount because the units are not the player's yet — they are in
 *  a pair of hands, walking. */
export interface StrikeEvent {
  cell: Coord;
  source: HarvestSourceId; // which ground — the renderer picks the foley from it
}

/** A haul landing at the BUILDING. This is where the wallet moves and where
 *  the number pops, and the gap between it and the strike that earned it is
 *  the walk you can watch. */
export interface DepositEvent {
  cell: Coord; // the building
  currencyId: CurrencyId;
  amount: number;
}

/** Everything one advance of the crews produced, for the renderer. */
export interface CrewEvents {
  strikes: StrikeEvent[];
  deposits: DepositEvent[];
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
function step(
  state: GameState,
  map: MapData,
  w: Worker,
  building: District,
  t: number,
  strikes: StrikeEvent[],
  deposits: DepositEvent[],
): void {
  const sources = DISTRICTS[building.definitionId].harvestSources;
  switch (w.activity) {
    case 'Idle':
      tryDispatch(state, map, w, building, t);
      break;
    case 'MovingToCell': {
      const cell = w.claimedCell!;
      if (isExhausted(state, cell, t) || !worksHere(sources, state, cell)) {
        // Emptied (or vanished) en route: turn back empty-handed rather than
        // standing over a stump. It costs the trip, which is the honest price
        // of the player having got there first.
        w.claimedCell = null;
        setState(w, 'MovingHome', t, t + moveMs(cell, building.location));
      } else {
        setState(w, 'Working', t, t + workerStrikeMs(state, HARVEST[harvestSourceAt(state, cell)!]));
      }
      break;
    }
    case 'Working': {
      const cell = w.claimedCell!;
      const source = harvestSourceAt(state, cell);
      if (source === null || !worksHere(sources, state, cell)) {
        w.claimedCell = null;
        setState(w, 'MovingHome', t, t + moveMs(cell, building.location));
        break;
      }
      const spec = HARVEST[source];
      // THE STRIKE. Units leave the depot HERE, at the moment the swing lands
      // — not on arrival home. That is what stops the player and the worker
      // taking the same wood twice: a load in transit is already out of the
      // ground, and the cell shows a stump while it is still being carried.
      w.carrying = drawFromCell(state, cell, spec, effectiveWorkerStrike(state, spec), t);
      w.carriedSource = w.carrying > 0 ? source : null;
      if (w.carrying > 0) strikes.push({ cell, source });
      setState(w, 'MovingHome', t, t + moveMs(cell, building.location));
      break;
    }
    case 'MovingHome': {
      // THE HAUL LANDS. The wallet is credited only now, which is why the
      // trip is worth watching: what you see walking is matter you do not
      // have yet.
      if (w.carrying > 0 && w.carriedSource !== null) {
        const spec = HARVEST[w.carriedSource];
        const amount = w.carrying;
        addToWallet(state.city.wallet, spec.currencyId, amount);
        recordResourceDiscovery(state, spec.currencyId);
        recordQuestEvent(state, { kind: 'collect', currency: spec.currencyId, amount });
        // Deliberately NOT a { kind: 'tap' } event. The two look alike on
        // screen; a quest that asks the player to tap is asking for the hand,
        // and unifying them would complete those with the city idle.
        deposits.push({ cell: building.location, currencyId: spec.currencyId, amount });
      }
      w.carrying = 0;
      w.carriedSource = null;
      // Keep the claim while the cell still holds something; otherwise migrate.
      if (w.claimedCell !== null && !isExhausted(state, w.claimedCell, t)
        && worksHere(sources, state, w.claimedCell)) {
        setState(w, 'MovingToCell', t, t + moveMs(building.location, w.claimedCell));
      } else {
        w.claimedCell = null;
        tryDispatch(state, map, w, building, t);
      }
      break;
    }
  }
}

/** Advance all workers to `toTime`, processing events in chronological order. */
export function advanceWorkers(state: GameState, map: MapData, toTime: number): CrewEvents {
  const out: CrewEvents = { strikes: [], deposits: [] };
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
    if (next === null) return out;
    const building = districtById(state, next.buildingId)!;
    // Guard against zero-length loops: an Idle worker whose dispatch fails
    // advances its own reference time so the same wake isn't reprocessed.
    const before = next.activity;
    step(state, map, next, building, nextAt, out.strikes, out.deposits);
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
    carrying: 0,
    carriedSource: null,
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
 * Two cases, and the split is the whole point.
 *
 * A worker **carrying** a load keeps it and simply walks to the new address
 * instead of the old one. The units are already out of the ground (they left
 * the depot when the swing landed), so confiscating them would destroy matter
 * and charge the player for a trip they had already worked for.
 *
 * A worker **empty-handed** releases its claim and goes Idle at `now`, because
 * the cell it was walking to may be outside the radius the building now has;
 * `tryDispatch` then picks one that is in range.
 *
 * `from` is the OLD location, and it has to be passed rather than read: the
 * caller has already moved the district by the time the walk home is timed.
 */
export function relocateCrew(
  state: GameState,
  map: MapData,
  district: District,
  from: Coord,
  now: number,
): void {
  void map;
  for (const w of state.workers) {
    if (w.buildingId !== district.uniqueId) continue;
    // Where the worker actually is right now, timed against the OLD home.
    const at = w.activity === 'Idle' ? from
      : w.activity === 'Working' ? (w.claimedCell ?? from)
        : (workerPosition(state, w, now) ?? from);
    if (w.carrying > 0) {
      setState(w, 'MovingHome', now, now + moveMs(at, district.location));
    } else {
      w.claimedCell = null;
      setState(w, 'Idle', now, null);
    }
  }
}

/** Despawn the last worker of the building; its claim is released and any
 *  carried load is LOST. Kept simple on purpose, and honest: those units left
 *  the ground already, so somebody has to eat them. */
export function removeWorker(state: GameState, district: District): void {
  for (let i = state.workers.length - 1; i >= 0; i--) {
    if (state.workers[i].buildingId === district.uniqueId) {
      state.workers.splice(i, 1);
      district.assignedWorkers -= 1;
      return;
    }
  }
}

/** Render helper: the worker's current position in cell coordinates.
 *
 *  An IDLE worker loiters just outside its building rather than standing on
 *  it, and that is deliberate: a knot of people doing nothing by the door is
 *  the most actionable fact in the game — *you over-hired, or you need more
 *  ground* — and it was invisible while they waited inside
 *  (`Docs/features/04-harvest.md` §7). The count lives in the district card;
 *  the map shows the characters and nothing else.
 *
 *  The spot is a stable hash of the worker id, so a loiterer does not jitter
 *  between frames and two of them rarely stand in the same place. */
export function workerPosition(state: GameState, w: Worker, now: number): Coord | null {
  const building = districtById(state, w.buildingId);
  if (!building) return null;
  const home = building.location;
  if (w.activity === 'Idle') {
    const size = DISTRICTS[building.definitionId].size;
    const spot = unitPhase(w.id);
    return {
      x: home.x + (size.x - 1) / 2 + Math.cos(spot) * (size.x / 2 + 0.55),
      y: home.y + (size.y - 1) / 2 + Math.sin(spot) * (size.y / 2 + 0.55),
    };
  }
  if (w.activity === 'Working') return w.claimedCell;
  const target = w.claimedCell;
  // A MovingHome worker whose trip was aborted has no claim left, so it
  // interpolates from wherever it turned round.
  const from = w.activity === 'MovingToCell' ? home : (target ?? home);
  const to = w.activity === 'MovingToCell' ? (target ?? home) : home;
  const duration = (w.stateUntil ?? now) - w.stateStartedAt;
  const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - w.stateStartedAt) / duration));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
