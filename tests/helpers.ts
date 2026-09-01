import { advance } from '../src/sim/commands';
import { Game } from '../src/game';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { Camera } from '../src/render/camera';
import {
  coordKey, type Coord, type DistrictId, type GameState, type TechId,
} from '../src/sim/state';

export const map = buildMapData();
export const T0 = Date.parse('2026-08-17T12:00:00Z');

export const freshGame = (): GameState => newGame(map, T0);

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
  });
};

/** Test setup: mark a technology as already researched. */
export const completeTech = (state: GameState, id: TechId): void => {
  state.research.completed.push(id);
};

/** Advance the unified sim to a given time. */
export const tickAt = (state: GameState, now: number) => advance(state, map, now);
