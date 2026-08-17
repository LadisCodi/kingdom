// Population buying (Docs/05).

import { CITY_DEF } from './data/definitions';
import { maxPopulation } from './recalc';
import { addToWallet, getWallet, type GameState } from './state';

/** cost = round(base × growth^(currentPopulation − 1)) Food. */
export const populationCost = (currentPopulation: number): number =>
  Math.round(
    CITY_DEF.populationCostBase * CITY_DEF.populationCostGrowth ** (currentPopulation - 1),
  );

export type BuyPopulationResult = 'Success' | 'AtMax' | 'NotEnoughResources';

export function buyPopulation(state: GameState): BuyPopulationResult {
  if (state.city.population >= maxPopulation(state)) return 'AtMax';
  const cost = populationCost(state.city.population);
  if (getWallet(state.city.wallet, 'Food') < cost) return 'NotEnoughResources';
  addToWallet(state.city.wallet, 'Food', -cost);
  state.city.population += 1;
  return 'Success'; // caller must trigger a production recalc (Townhall tax)
}
