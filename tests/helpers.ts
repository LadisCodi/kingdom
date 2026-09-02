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

/**
 * Top up a purse. Routed the way `Game.effectiveWalletValue` routes reads, so
 * a test funds what it means to fund: Knowledge is KINGDOM-scoped (it buys
 * research) and Gems are the player's; everything else is the city's.
 */
export const fund = (state: GameState, wallet: Record<string, number>): void => {
  const { Knowledge, Gems, ...city } = wallet;
  Object.assign(state.city.wallet, city);
  if (Knowledge !== undefined) state.kingdom.wallet.Knowledge = Knowledge;
  if (Gems !== undefined) state.player.wallet.Gems = Gems;
};

/** The authored resource cells the early game is built around. None of them
 *  is inside the Townhall's opening REVEAL any more — the map puts them one
 *  ring out, so the player explores toward what they can see. Tests that are
 *  about what happens after the fog use `canGather`. */
export const FOREST: Coord = { x: 1, y: 3 };
export const BERRIES: Coord = { x: -2, y: 1 };
export const ANIMALS: Coord = { x: -1, y: -2 };

/**
 * A kingdom that can actually gather: Forestry researched, and the forest and
 * berry cells cleared.
 *
 * Forestry gates BOTH the Forest and the Berries (Docs/onboarding.md steps
 * 2-3, revised): during the first-time experience the only thing the player
 * can do is tap fog, so no Food arrives before it is meant to. Every test
 * about the harvest loop, workers, taxes or offline replay is about what
 * happens AFTER that gate — the gate itself is defended in `harvest.test.ts`.
 */
export const canGather = (state: GameState): GameState => {
  completeTech(state, 'Forestry');
  reveal(state, [FOREST, BERRIES, ANIMALS]);
  return state;
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
    .find((d) => d.trains.includes(unitId)) as DistrictDef).id;
  addBuilt(state, definitionId, location);
};

/** Drop every military building somewhere out of the way, for tests that only
 *  care that the army exists.
 *
 *  DISTINCT buildings — the Barracks turns out three of the four units, so
 *  adding one per unit would stack three Barracks on the city and treble the
 *  army cap. */
export const addAllTrainers = (state: GameState): void => {
  const cells: Coord[] = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }];
  const halls = Object.values(DISTRICTS)
    .filter((d) => d.armyCapPerLevel.length > 0)
    .map((d) => d.id);
  halls.forEach((id, i) => addBuilt(state, id, cells[i]));
};

/** Test setup: mark a technology as already researched. */
export const completeTech = (state: GameState, id: TechId): void => {
  state.research.completed.push(id);
};

/** Advance the unified sim to a given time. */
export const tickAt = (state: GameState, now: number) => advance(state, map, now);
