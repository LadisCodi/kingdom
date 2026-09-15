// What a building IS at a level, and what it COSTS to reach the next one.
//
// One model, two surfaces (Docs/art/ui-menus-redesign.md §7.27):
//
//   * the building card reads it at the CURRENT level and prints a band of
//     tiles — what this building does for you right now;
//   * the upgrade popup reads it at the current level AND the next one and
//     prints the pairs — what the level would change.
//
// They used to be one function that returned finished `<div>`s, which is why
// the card could not show a stat without also showing an arrow. A stat is a
// number with a name; turning it into a row is the screen's business.
//
// THE PAIRS ARE BUILT BY ZIPPING TWO READS, never by a second table of
// deltas. `statsAt(level)` and `statsAt(level + 1)` are the same function, so
// a stat can never appear on one side of an arrow and not the other, and
// adding one to a building adds it to both screens at once.

import {
  DISTRICTS, FOG, MANA, TAXES, levelIndexed,
} from '../sim/data/definitions';
import { requiredPopulation, requiredTechForLevel, requiredTownhallLevel } from '../sim/districts';
import { harmonyBlock, harmonyCost } from '../sim/harmony';
import { isTechComplete } from '../sim/research';
import { TECHNOLOGIES } from '../sim/data/definitions';
import { townhall, type District } from '../sim/state';
import type { Game } from '../game';
import type { IconName } from './kit/icon';

/** One number a building is judged on, at one level. */
export interface BuildingStat {
  /** Stable across levels, so two reads can be zipped into a pair. */
  key: string;
  icon: IconName;
  label: string;
  value: string;
}

/** The same stat at two levels, and whether the level actually moves it. */
export interface StatChange extends BuildingStat {
  to: string;
  /** False for a row like *Exploration range 5 → 5*, which the popup greys
   *  rather than drops: a level that moves nothing has to SAY so, or the
   *  player reads the missing row as a bug. */
  changed: boolean;
}

/**
 * Everything this building is worth at `level`.
 *
 * Pure in `level` — it never reads `district.level` — which is the whole
 * reason the pairs are honest. The one exception is the Townhall's fog reach
 * and the house capacities, which are per-level ladders anyway.
 */
export function statsAt(game: Game, district: District, level: number): BuildingStat[] {
  const def = DISTRICTS[district.definitionId];
  const out: BuildingStat[] = [];
  const add = (key: string, icon: IconName, label: string, value: string | number) =>
    out.push({ key, icon, label, value: String(value) });
  /** A per-level list that a building may not carry at all. */
  const term = (list: readonly number[], blank: number) =>
    (list.length === 0 ? blank : levelIndexed(list, level) ?? blank);

  if (def.populationCapacityPerLevel.length > 0) {
    add('homes', 'Housing', 'Villager cap', levelIndexed(def.populationCapacityPerLevel, level));
  }
  if (def.influenceRadiusPerLevel.length > 0) {
    add('reach', 'showme', 'Exploration range', levelIndexed(def.influenceRadiusPerLevel, level));
    add('crew', 'workers', 'Workers', levelIndexed(def.maxWorkersPerLevel, level));
  }
  if (def.extraUnitsPerDeliveryPerLevel.length > 0) {
    add('delivery', 'plus', 'Per delivery', `+${term(def.extraUnitsPerDeliveryPerLevel, 0)}`);
  }
  if (def.strikeSpeedPerLevel.length > 0) {
    add('swing', 'clock', 'Swing', `×${term(def.strikeSpeedPerLevel, 1)}`);
  }
  if (def.armyCapPerLevel.length > 0) {
    add('army', 'army', 'Army cap', levelIndexed(def.armyCapPerLevel, level));
  }
  if (def.bedsPerLevel.length > 0) {
    add('beds', 'hp', 'Beds', levelIndexed(def.bedsPerLevel, level));
  }
  // A level buys a house MORE ROOM and BETTER RENT, and the second half is
  // the reason to keep upgrading a house that is already full.
  if (def.taxBonusPerLevel.length > 0) {
    add('rent', 'Gold', 'Rent each',
      `+${Math.round(levelIndexed(def.taxBonusPerLevel, level) * 100)}%`);
  }
  // The Sanctum owns BOTH Mana numbers — it is the engine as well as the
  // reservoir, since the Townhall stopped producing (08-magic.md §2).
  if (district.definitionId === 'Sanctum') {
    add('mana-cap', 'Mana', 'Mana held', levelIndexed(MANA.sanctumCapPerLevel, level));
    add('mana-rate', 'Mana', 'Mana /h', levelIndexed(MANA.sanctumPerHourPerLevel, level));
  }
  if (district.definitionId === 'Townhall') {
    const ladder = TAXES.townhallMultiplierPerLevel;
    if (ladder.length > 0) add('taxes', 'Gold', 'Gold income', `×${levelIndexed(ladder, level)}`);
    const reach = FOG.reachPerTownhallLevel;
    if (reach.length > 0) add('fog', 'Townhall', 'Fog reach', `ring ${levelIndexed(reach, level)}`);
  }
  void game;
  return out;
}

/**
 * The pairs, for the upgrade popup's Stats table.
 *
 * Every stat the building has, whether or not the level moves it — an
 * unchanged row is a fact the player is buying against, and dropping it would
 * make the table shorter for the levels that deserve the most scrutiny.
 */
export function statChanges(game: Game, district: District, next: number): StatChange[] {
  const before = statsAt(game, district, district.level);
  const after = new Map(statsAt(game, district, next).map((s) => [s.key, s.value]));
  return before.map((s) => {
    const to = after.get(s.key) ?? s.value;
    return { ...s, to, changed: to !== s.value };
  });
}

/** One thing that must be true before the level can be bought. */
export interface Requirement {
  icon: IconName;
  label: string;
  met: boolean;
}

/**
 * EVERY gate on the next level, met and unmet alike.
 *
 * The card used to show only the FIRST unmet one, as a sentence where the
 * button goes. That answers "why can't I?" and nothing else: a player two
 * errands away from a level saw one of them, did it, and found another. A
 * list with ticks is the same information as a plan.
 *
 * Being short of the PRICE is not here. A price is not a requirement — it is
 * the thing the button spends, it moves on its own every minute, and it has a
 * row of its own under the table.
 */
export function requirements(game: Game, district: District, next: number): Requirement[] {
  const def = DISTRICTS[district.definitionId];
  const out: Requirement[] = [];

  const requiredTh = requiredTownhallLevel(district.definitionId, next);
  // A Townhall does not gate itself; a level 1 gate is no gate at all.
  if (requiredTh > 1 && district.definitionId !== 'Townhall') {
    out.push({
      icon: 'Townhall',
      label: `Townhall level ${requiredTh}`,
      met: townhall(game.state).level >= requiredTh,
    });
  }
  const gateTech = requiredTechForLevel(district.definitionId, next);
  if (gateTech !== null) {
    out.push({
      icon: 'research',
      label: `Research ${TECHNOLOGIES[gateTech].name}`,
      met: isTechComplete(game.state, gateTech),
    });
  }
  const pop = requiredPopulation(district.definitionId, next);
  if (pop > 0) {
    out.push({
      icon: 'population',
      label: `Reach ${pop} population`,
      met: game.state.city.population >= pop,
    });
  }
  // Harmony is quoted at the price rather than listed here UNLESS the level
  // actually raises the demand: a decoration is the answer, and that is an
  // errand like the other three.
  const demand = harmonyCost(def, next);
  if (demand > harmonyCost(def, district.level)) {
    out.push({
      icon: 'harmony',
      label: `${demand} Harmony`,
      met: harmonyBlock(game.state, def, next, district) === null,
    });
  }
  return out;
}

/** Whether every gate is clear — what decides the button, not the price. */
export const requirementsMet = (game: Game, district: District, next: number): boolean =>
  requirements(game, district, next).every((r) => r.met);
