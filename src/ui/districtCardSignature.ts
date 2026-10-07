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

import { upgradeRefusal } from '../sim/commands';
import type { Game } from '../game';
import { adjacencyInEffect } from '../sim/adjacency';
import { lineFor, trainPlan } from '../sim/army';
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

export function districtCardSignature(game: Game, district: District): string {
  const def = DISTRICTS[district.definitionId];
  const s = game.state;
  const queueItem = s.city.queue.find((q) => q.districtUniqueId === district.uniqueId);
  const next = district.level + 1;
  const wallet = (c: string) => game.walletValue(c as CurrencyId);
  const shorts = (cost: Record<string, number>) =>
    Object.entries(cost).map(([c, n]) => wallet(c) < n);
  // The rent clock's anchor moves on every tick a store earns — or stands
  // full — and the card draws the store, never the anchor.
  const { rentAnchor: _anchor, ...drawn } = district;
  const parts: unknown[] = [
    drawn,
    queueItem?.uniqueId ?? null,
    queueItem === undefined ? null : queueItem.startedAt === null,
    game.uiHint(),
    canMoveDistrict(district),
    // Whether Upgrade wears its call to action: every gate and cost met.
    upgradeRefusal(s, district.uniqueId) === null,
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
    // Training: its line, what it costs against the purse, the room it
    // has, the army's room, the ward.
    lineFor(s, district.uniqueId).map((i) => i.trainee),
    // How many of its trainee the player owns, shown under the portrait.
    def.trains.map((t) => (t === 'Villager' ? s.city.population
      : s.army.filter((u) => u.definitionId === t).length)),
    // The Train amount picked, and the order it prices against the purse
    // ("All" moves with the purse itself).
    game.trainAmount,
    def.trains.map((t) => {
      const plan = trainPlan(s, t, game.trainAmount);
      return [plan.count, shorts(plan.cost as Record<string, number>)];
    }),
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
      upgradeGoodsCost(s, district.definitionId, next),
      canAffordGoods(s.city.goods, upgradeGoodsCost(s, district.definitionId, next)),
      harmonyBlock(s, def, next, district),
      requiredPopulation(district.definitionId, next),
      upgradeDuration(s, district.definitionId, district.level),
    );
  }
  if (isWorkshop(district) && district.state === 'Built') {
    const recipe = recipeOf(district);
    const items = s.city.workshops[district.uniqueId]?.items ?? [];
    parts.push(
      items.length, queueCapacity(s, district),
      shorts(recipe.input as Record<string, number>),
      recipe.inputMana > 0 ? mana(s) < recipe.inputMana : null,
    );
  }
  return JSON.stringify(parts);
}
