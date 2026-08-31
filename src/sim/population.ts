// Population training (Townhall, timed) and the shared worker pool.

import { CITY_DEF, DISTRICTS, TRAINING } from './data/definitions';
import type { GameState } from './state';
import { canAfford, pay } from './wallet';

/** Max population = Σ PopulationCapacity over active (Built) districts. */
export function maxPopulation(state: GameState): number {
  let total = 0;
  for (const d of state.city.districts) {
    if (d.state !== 'Built') continue;
    total += DISTRICTS[d.definitionId].populationCapacity;
  }
  return total;
}

/** AvailableWorkers = Population − Σ AssignedWorkers. */
export function availableWorkers(state: GameState): number {
  let assigned = 0;
  for (const d of state.city.districts) assigned += d.assignedWorkers;
  return state.city.population - assigned;
}

/** cost = round(base × growth^(currentPopulation − 1)) Food. */
export const populationCost = (currentPopulation: number): number =>
  Math.round(
    CITY_DEF.populationCostBase * CITY_DEF.populationCostGrowth ** (currentPopulation - 1),
  );

export type StartTrainingResult =
  | 'Started' | 'AtMax' | 'AlreadyTraining' | 'NotEnoughResources';

/** Start training one villager at the Townhall: Food paid up front, then
 *  TRAINING.seconds pass (boostable by Townhall taps; completes in advance). */
export function startTraining(state: GameState, now: number): StartTrainingResult {
  if (state.city.population >= maxPopulation(state)) return 'AtMax';
  if (state.city.training !== null) return 'AlreadyTraining';
  const cost = { Food: populationCost(state.city.population) };
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.city.training = { startedAt: now };
  return 'Started';
}

export const trainingCompletesAt = (state: GameState): number | null =>
  state.city.training === null
    ? null
    : state.city.training.startedAt + TRAINING.seconds * 1000;

/** Complete the training if its time is up; returns true when +1 pop landed. */
export function advanceTraining(state: GameState, toTime: number): boolean {
  const completesAt = trainingCompletesAt(state);
  if (completesAt === null || completesAt > toTime) return false;
  state.city.training = null;
  state.city.population += 1;
  return true;
}
