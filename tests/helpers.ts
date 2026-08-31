import { advance } from '../src/sim/commands';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey, type Coord, type GameState, type TechId } from '../src/sim/state';

export const map = buildMapData();
export const T0 = Date.parse('2026-08-17T12:00:00Z');

export const freshGame = (): GameState => newGame(map, T0);

export const fund = (state: GameState, wallet: Record<string, number>): void => {
  Object.assign(state.city.wallet, wallet);
};

export const reveal = (state: GameState, cells: Coord[]): void => {
  for (const c of cells) state.fog.revealed[coordKey(c)] = true;
};

/** Test setup: mark a technology as already researched. */
export const completeTech = (state: GameState, id: TechId): void => {
  state.research.completed.push(id);
};

/** Advance the unified sim to a given time. */
export const tickAt = (state: GameState, now: number) => advance(state, map, now);
