// Army recruiting (Docs/08). One shared army; training is instant (as built).

import { CITY_DEF, UNITS, levelIndexed } from './data/definitions';
import {
  addToWallet, getWallet, newId, townhall,
  type CurrencyId, type GameState, type UnitId,
} from './state';

export const armyPower = (state: GameState): number =>
  state.army.reduce((sum, u) => sum + UNITS[u.definitionId].power, 0);

export const maxArmyPower = (state: GameState): number =>
  levelIndexed(CITY_DEF.maxArmyPowerPerTownhallLevel, townhall(state).level);

export type TrainResult = 'Trained' | 'NotEnoughResources' | 'ArmyAtCapacity';

export function trainUnit(state: GameState, unitId: UnitId): TrainResult {
  const def = UNITS[unitId];
  if (armyPower(state) + def.power > maxArmyPower(state)) return 'ArmyAtCapacity';
  for (const [c, amount] of Object.entries(def.recruitCost)) {
    if (getWallet(state.city.wallet, c as CurrencyId) < amount) return 'NotEnoughResources';
  }
  for (const [c, amount] of Object.entries(def.recruitCost)) {
    addToWallet(state.city.wallet, c as CurrencyId, -amount);
  }
  state.army.push({ uniqueId: newId(state, `unit_${unitId}`), definitionId: unitId });
  return 'Trained';
}
