import { advance } from '../src/sim/commands';
import { Game } from '../src/game';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { Camera } from '../src/render/camera';
import { DISTRICTS, type DistrictDef } from '../src/sim/data/definitions';
import {
  coordKey, type Coord, type DistrictId, type GameState, type TechId, type UnitId,
} from '../src/sim/state';

export const map = buildMapData();
/** A Thursday, deliberately: it sits in the quiet gap between two
 *  Conjunction windows (which run Monday to Wednesday), so a test that does
 *  not care about the timeline is not silently inside a season. */
export const T0 = Date.parse('2026-08-20T12:00:00Z');

/** A fixed world seed. newGame() rolls a real one, so without this two
 *  freshGame()s would be two different worlds and every "replay equals
 *  ticking" assertion would compare apples to oranges. */
export const TEST_SEED = 0x5eed;

export const freshGame = (): GameState => {
  const state = newGame(map, T0);
  state.seed = TEST_SEED;
  return state;
};

/** The presenter, constructible under node: Camera reads nothing but the
 *  canvas's client size (stubbed below), playSfx swallows the missing
 *  AudioContext, and mapRenderer is only ever an erased `import type`. */
export const freshPresenter = (state: GameState = freshGame()): Game =>
  new Game(state, map, new Camera(
    { clientWidth: 720, clientHeight: 1280 } as unknown as HTMLCanvasElement,
  ));

/** Screen coords that land on `cell`, for driving handleTap / handleHold. */
export const screenAt = (game: Game, cell: Coord): [number, number] => {
  const { x, y, size } = game.camera.cellToScreen(cell);
  return [x + size / 2, y + size / 2];
};

export const fund = (state: GameState, wallet: Record<string, number>): void => {
  Object.assign(state.city.wallet, wallet);
};

export const reveal = (state: GameState, cells: Coord[]): void => {
  for (const c of cells) state.fog.revealed[coordKey(c)] = true;
};

/** Test setup: drop an already-Built district onto the map (no cost, no
 *  placement checks) — e.g. Housing for population capacity. */
export const addBuilt = (state: GameState, definitionId: DistrictId, location: Coord): void => {
  state.city.districts.push({
    uniqueId: `district_${definitionId}_${state.nextId++}`,
    definitionId, level: 1, assignedWorkers: 0, location, state: 'Built', visualVariant: 1,
    lastTapAt: 0,
  });
};

/** Test setup: the military building a unit type needs, plus enough army cap
 *  to actually recruit. Units are trained by their OWN building now, so almost
 *  every army assertion needs one. */
export const addTrainer = (state: GameState, unitId: UnitId, location: Coord): void => {
  const definitionId = (Object.values(DISTRICTS)
    .find((d) => d.trains === unitId) as DistrictDef).id;
  addBuilt(state, definitionId, location);
};

/** Drop the four military buildings somewhere out of the way, for tests that
 *  only care that the army exists. */
export const addAllTrainers = (state: GameState): void => {
  const cells: Coord[] = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }];
  const units: UnitId[] = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];
  units.forEach((u, i) => addTrainer(state, u, cells[i]));
};

/** Test setup: mark a technology as already researched. */
export const completeTech = (state: GameState, id: TechId): void => {
  state.research.completed.push(id);
};

/** Advance the unified sim to a given time. */
export const tickAt = (state: GameState, now: number) => advance(state, map, now);
