// Ambient villagers (render-side): the flock mirrors the UNASSIGNED
// population, loiters near the buildings that house it, and actually moves.
import { describe, expect, it } from 'vitest';
import { Villagers } from '../src/render/villagers';
import { districtSize, townhall, type Coord, type GameState } from '../src/sim/state';
import { freshGame, map, T0 } from './helpers';

/** Chebyshev distance from a point to the townhall footprint rect. */
const distToTownhall = (state: GameState, p: Coord): number => {
  const th = townhall(state);
  const size = districtSize(th);
  const [x1, y1] = [th.location.x + size.x - 1, th.location.y + size.y - 1];
  return Math.max(th.location.x - p.x, p.x - x1, th.location.y - p.y, p.y - y1, 0);
};

describe('ambient villagers', () => {
  it('one villager per unassigned population unit, near their housing', () => {
    const state = freshGame();
    const v = new Villagers();
    expect(v.positions(state, map, T0)).toHaveLength(0); // population 0

    state.city.population = 3;
    const positions = v.positions(state, map, T0);
    expect(positions).toHaveLength(3);
    // Fresh game has only the Townhall — everyone loiters within its ring.
    for (const p of positions) {
      expect(distToTownhall(state, p)).toBeLessThanOrEqual(2 + 0.35); // radius + sub-cell offset
    }

    // Assigning workers pulls them out of the flock.
    townhall(state).assignedWorkers = 2;
    expect(v.positions(state, map, T0 + 100)).toHaveLength(1);
  });

  it('villagers wander over time instead of standing forever', () => {
    const state = freshGame();
    state.city.population = 3;
    const v = new Villagers();
    const before = v.positions(state, map, T0).map((p) => ({ ...p }));
    // Sample well past every spawn pause (≤3.5s) and mid-stroll.
    v.positions(state, map, T0 + 10_000);
    const after = v.positions(state, map, T0 + 12_000);
    const moved = after.some((p, i) =>
      Math.hypot(p.x - before[i].x, p.y - before[i].y) > 0.01);
    expect(moved).toBe(true);
    for (const p of after) {
      expect(distToTownhall(state, p)).toBeLessThanOrEqual(2 + 0.35);
    }
  });
});
