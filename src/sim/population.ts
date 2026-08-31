// Population buying and the shared worker pool (Docs/05; harvest-loop §2).

import { CITY_DEF, DISTRICTS } from './data/definitions';
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

export type BuyPopulationResult = 'Success' | 'AtMax' | 'NotEnoughResources';

export function buyPopulation(state: GameState): BuyPopulationResult {
  if (state.city.population >= maxPopulation(state)) return 'AtMax';
  const cost = { Food: populationCost(state.city.population) };
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
  state.city.population += 1;
  return 'Success';
}
