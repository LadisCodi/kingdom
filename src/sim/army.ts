// Army recruiting (Docs/08). One shared army; training is instant (as built).

import { CITY_DEF, UNITS, levelIndexed } from './data/definitions';
import { isTechComplete } from './research';
import { newId, townhall, type GameState, type UnitId } from './state';
import { canAfford, pay } from './wallet';

export const armyPower = (state: GameState): number =>
  state.army.reduce((sum, u) => sum + UNITS[u.definitionId].power, 0);

export const maxArmyPower = (state: GameState): number =>
  levelIndexed(CITY_DEF.maxArmyPowerPerTownhallLevel, townhall(state).level);

export type TrainResult = 'Trained' | 'NotEnoughResources' | 'ArmyAtCapacity' | 'TechRequired';

export function trainUnit(state: GameState, unitId: UnitId): TrainResult {
  const def = UNITS[unitId];
  if (def.requiredTech !== null && !isTechComplete(state, def.requiredTech)) return 'TechRequired';
  if (armyPower(state) + def.power > maxArmyPower(state)) return 'ArmyAtCapacity';
  if (!canAfford(state.city.wallet, def.recruitCost)) return 'NotEnoughResources';
  pay(state.city.wallet, def.recruitCost);
  state.army.push({ uniqueId: newId(state, `unit_${unitId}`), definitionId: unitId });
  return 'Trained';
}
