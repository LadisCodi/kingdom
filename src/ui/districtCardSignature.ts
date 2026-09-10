// The district card's SIGNATURE — what the card draws that does not tick, as
// one string — kept apart from the card so it can be read under node: the
// card reaches the sprite loader, which builds an Image at import.
//
// Same string, same card. `districtCardScreen` (ui/districtCard.ts) rebuilds
// the card only when this moves and lets the live parts carry the clock. The
// contract is the one `legacy()`'s signature has — anything the render reads
// and this omits goes stale — so it is deliberately coarse: whole objects
// where the card reads several fields of them, and every gate and every
// `short` the card colours.

import type { Game } from '../game';
import { adjacencyInEffect } from '../sim/adjacency';
import { lineFor, trainCost } from '../sim/army';
import { DISTRICTS } from '../sim/data/definitions';
import {
  canMoveDistrict, requiredPopulation, upgradeCost, upgradeDuration, upgradeGoodsCost,
} from '../sim/districts';
import { canAffordGoods } from '../sim/goods';
import { harmonyBlock, harmonyDemand, harmonySupply, harmonySurplusTier } from '../sim/harmony';
import { mana } from '../sim/mana';
import { districtCapacity, houseGoldPerMinute, maxPopulation } from '../sim/population';
import { townhall, type CurrencyId, type District } from '../sim/state';
import { isWorkshop, queueCapacity, recipeOf } from '../sim/workshops';
import { pickedTrainee } from './trainingPick';

export function districtCardSignature(game: Game, district: District): string {
  const def = DISTRICTS[district.definitionId];
  const s = game.state;
  const queueItem = s.city.queue.find((q) => q.districtUniqueId === district.uniqueId);
  const next = district.level + 1;
  const wallet = (c: string) => game.walletValue(c as CurrencyId);
  const shorts = (cost: Record<string, number>) =>
    Object.entries(cost).map(([c, n]) => wallet(c) < n);
  const parts: unknown[] = [
    district,
    queueItem?.uniqueId ?? null,
    queueItem === undefined ? null : queueItem.startedAt === null,
    game.uiHint(),
    canMoveDistrict(district),
    game.freeWorkers() === 0,
    s.city.population,
    townhall(s).level,
    s.research.completed.length,
    s.city.goods,
    game.residentsIn(district),
    districtCapacity(s, district),
    houseGoldPerMinute(s, district),
    adjacencyInEffect(s, district),
    // Worker buildings: the cells in reach and the crew's size.
    def.harvestSources.length > 0 ? game.workableCellsOf(district).length : null,
    // Training: what is picked, what it costs against the purse, the room it
    // has, the army's room, the ward.
    pickedTrainee(district.uniqueId) ?? null,
    lineFor(s, district.uniqueId).map((i) => i.trainee),
    def.trains.map((t) => shorts(trainCost(s, t) as Record<string, number>)),
    // Not the whole readout: its progress and remaining seconds tick, and
    // the queue row already carries those as a live part.
    (({ queued, cost, atMax }) => [queued, cost, atMax])(game.trainingInfo()),
    maxPopulation(s),
    game.armyRoom(),
    def.bedsPerLevel.length > 0 ? game.woundedInfo() : null,
    // Harmony, read on the Townhall and demanded by a level.
    harmonySupply(s), harmonyDemand(s), harmonySurplusTier(s),
  ];
  if (district.state === 'Built' && district.level < def.maxLevel) {
    parts.push(
      shorts(upgradeCost(district.definitionId, district.ordinal, district.level) as Record<string, number>),
      upgradeGoodsCost(district.definitionId, next),
      canAffordGoods(s.city.goods, upgradeGoodsCost(district.definitionId, next)),
      harmonyBlock(s, def, next, district),
      requiredPopulation(district.definitionId, next),
      upgradeDuration(s, district.definitionId, district.level),
    );
  }
  if (isWorkshop(district) && district.state === 'Built') {
    const recipe = recipeOf(district);
    const items = s.city.workshops[district.uniqueId]?.items ?? [];
    parts.push(
      items.length, queueCapacity(district),
      shorts(recipe.input as Record<string, number>),
      recipe.inputMana > 0 ? mana(s) < recipe.inputMana : null,
    );
  }
  return JSON.stringify(parts);
}
