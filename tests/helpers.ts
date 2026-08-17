import { tick } from '../src/sim/commands';
import { buildMapData } from '../src/sim/grid';
import { newGame } from '../src/sim/newGame';
import { coordKey, type Coord, type GameState } from '../src/sim/state';

export const map = buildMapData();
export const T0 = Date.parse('2026-08-17T12:00:00Z');
export const rng = () => 0.5;

export const freshGame = (): GameState => newGame(map, T0, rng);

export const fund = (state: GameState, wallet: Record<string, number>): void => {
  Object.assign(state.city.wallet, wallet);
};

export const reveal = (state: GameState, cells: Coord[]): void => {
  for (const c of cells) state.fog.revealed[coordKey(c)] = true;
};

/** Run the single tick at a given time (completes due queue items, accrues, expires spells). */
export const tickAt = (state: GameState, now: number) => tick(state, map, now, rng);
