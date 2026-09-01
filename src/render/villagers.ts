// Ambient villagers: the UNASSIGNED population, wandering around the
// buildings that house them (the Townhall and any district with
// populationCapacity). Pure cosmetics, render-side only — nothing here
// touches sim state or the save; the flock rebuilds from scratch on reload.

import type { MapData } from '../sim/grid';
import { availableWorkers, districtCapacity } from '../sim/population';
import {
  coordKey, districtAt, districtSize,
  type Coord, type District, type GameState,
} from '../sim/state';

// Cosmetic tuning — deliberately NOT in the balance workbook (no gameplay).
const WANDER_RADIUS = 2; // Chebyshev distance from the home footprint
const SPEED_MIN = 0.3; // tiles per second — a stroll, slower than workers
const SPEED_MAX = 0.6;
const PAUSE_MIN_MS = 800; // idle stand between walk legs
const PAUSE_MAX_MS = 3500;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

interface Agent {
  home: string; // uniqueId of the building it loiters around
  from: Coord; // fractional cell coords
  to: Coord;
  legStartedAt: number;
  legEndsAt: number;
  pauseUntil: number; // stand at `to` until then, then pick a new leg
  phase: number; // ms offset so walk cycles don't sync across the flock
}

/** A draw position plus what the renderer needs to animate the stroll. */
export interface VillagerPose extends Coord {
  walking: boolean;
  dx: number; // sign of horizontal travel while walking (for mirroring)
  phase: number;
}

/** Open cells ringing the home footprint (1..WANDER_RADIUS away): existing
 *  land, revealed, no water, no district, no feature. */
function wanderCells(state: GameState, map: MapData, home: District): Coord[] {
  const size = districtSize(home);
  const [x1, y1] = [home.location.x + size.x - 1, home.location.y + size.y - 1];
  const cells: Coord[] = [];
  for (let y = home.location.y - WANDER_RADIUS; y <= y1 + WANDER_RADIUS; y++) {
    for (let x = home.location.x - WANDER_RADIUS; x <= x1 + WANDER_RADIUS; x++) {
      const d = Math.max(home.location.x - x, x - x1, home.location.y - y, y - y1);
      if (d < 1) continue; // inside the footprint
      const cell = { x, y };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (!terrain || terrain === 'Water') continue;
      if (!state.fog.revealed[key]) continue;
      if (state.features[key] !== undefined) continue;
      if (districtAt(state, cell) !== undefined) continue;
      cells.push(cell);
    }
  }
  // Nowhere open around it: loiter on the doorstep (the footprint itself).
  if (cells.length === 0) {
    for (let y = home.location.y; y <= y1; y++) {
      for (let x = home.location.x; x <= x1; x++) cells.push({ x, y });
    }
  }
  return cells;
}

/** A wander destination: a valid cell plus a sub-cell offset so villagers
 *  don't line up on grid centers. */
function pickTarget(state: GameState, map: MapData, home: District): Coord {
  const cells = wanderCells(state, map, home);
  const cell = cells[Math.floor(Math.random() * cells.length)];
  return { x: cell.x + rand(0, 0.35), y: cell.y + rand(0, 0.35) };
}

export class Villagers {
  private agents: Agent[] = [];

  /** Advance the flock and return draw poses in fractional cell coords. */
  positions(state: GameState, map: MapData, now: number): VillagerPose[] {
    const homes = state.city.districts.filter((d) =>
      d.state === 'Built' &&
      (d.definitionId === 'Townhall' || districtCapacity(state, d) > 0));
    const idle = availableWorkers(state);
    if (homes.length === 0 || idle <= 0) {
      this.agents = [];
      return [];
    }

    // Sync the flock to the idle head-count; spread newcomers over the homes.
    if (this.agents.length > idle) this.agents.length = idle;
    while (this.agents.length < idle) {
      const home = homes[this.agents.length % homes.length];
      const at = pickTarget(state, map, home);
      this.agents.push({
        home: home.uniqueId, from: at, to: at,
        legStartedAt: now, legEndsAt: now, pauseUntil: now + rand(0, PAUSE_MAX_MS),
        phase: Math.floor(rand(0, 997)),
      });
    }

    return this.agents.map((a) => {
      let home = homes.find((h) => h.uniqueId === a.home);
      if (!home) { // its building is gone — move in somewhere else
        home = homes[Math.floor(Math.random() * homes.length)];
        a.home = home.uniqueId;
        a.pauseUntil = now;
        a.legEndsAt = now;
      }
      if (now >= a.legEndsAt && now >= a.pauseUntil) {
        // Start a new stroll: walk to a fresh spot, then stand a while.
        a.from = a.to;
        a.to = pickTarget(state, map, home);
        const dist = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
        a.legStartedAt = now;
        a.legEndsAt = now + (dist / rand(SPEED_MIN, SPEED_MAX)) * 1000;
        a.pauseUntil = a.legEndsAt + rand(PAUSE_MIN_MS, PAUSE_MAX_MS);
      }
      if (now >= a.legEndsAt) { // standing
        return { ...a.to, walking: false, dx: 0, phase: a.phase };
      }
      const t = (now - a.legStartedAt) / (a.legEndsAt - a.legStartedAt);
      return {
        x: a.from.x + (a.to.x - a.from.x) * t,
        y: a.from.y + (a.to.y - a.from.y) * t,
        walking: true,
        dx: a.to.x - a.from.x,
        phase: a.phase,
      };
    });
  }
}
