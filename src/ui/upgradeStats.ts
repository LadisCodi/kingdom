// What a building IS at a level, and what it COSTS to reach the next one.
//
// One model, two surfaces (Docs/art/ui-menus-redesign.md §7.27):
//
//   * the building card reads it at the CURRENT level and prints a band of
//     tiles — what this building does for you right now;
//   * the upgrade popup reads it at the current level AND the next one and
//     prints what the level ADDS — the current value and a green delta.
//
// They used to be one function that returned finished `<div>`s, which is why
// the card could not show a stat without also showing an arrow. A stat is a
// number with a name; turning it into a row is the screen's business.
//
// THE DELTAS ARE BUILT BY ZIPPING TWO READS, never by a second table of
// deltas. `statsAt(level)` and `statsAt(level + 1)` are the same function, so
// a stat's gain is always the difference of what the two levels show, and
// adding one to a building adds it to both screens at once.

import {
  DISTRICTS, FOG, HARVEST, MANA, TAXES, levelIndexed,
} from '../sim/data/definitions';
import { trainSecondsAt } from '../sim/army';
import { requiredPopulation, requiredTechForLevel, requiredTownhallLevel } from '../sim/districts';
import { harmonyBlock, harmonyCost } from '../sim/harmony';
import { isTechComplete } from '../sim/research';
import { TECHNOLOGIES } from '../sim/data/definitions';
import { townhall, type District } from '../sim/state';
import type { Game } from '../game';
import type { IconName } from './kit/icon';
import { formatDuration, formatExact, formatNumber } from './format';

/** One number a building is judged on, at one level. */
export interface BuildingStat {
  /** Stable across levels, so two reads can be zipped into a pair. */
  key: string;
  icon: IconName;
  label: string;
  /** The label cut to a word that fits a stat tile on a phone (the district
   *  card's three-up band): eight letters at most, which three to a row still
   *  fit on the iPhone X. */
  short: string;
  value: string;
  /** The number behind `value`, for the popup's delta. */
  n: number;
  /** How a difference in `n` reads — `+2`, `+2 rings`, `−5s` — with its sign. */
  gain: (d: number) => string;
  /** A stat where less is the improvement (a wait). */
  lowerIsBetter?: true;
  /** False for a figure only the upgrade popup shows — one that is neutral
   *  until a late level and that the card's Production already counts in. */
  onCard?: false;
}

/** A stat the next level moves: its current value and what the level adds. */
export interface StatChange extends BuildingStat {
  /** The difference, in the stat's own words (`+0.25`, `+2 rings`). */
  delta: string;
  /** False when the level makes the stat worse. */
  better: boolean;
}

/** A difference, rounded to what the tiles print, with its sign. */
const signed = (d: number, text: string): string => `${d < 0 ? '−' : '+'}${text}`;
const plain = (d: number): string => signed(d, formatNumber(Math.abs(d), 2));

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
  const add = (
    key: string, icon: IconName, label: string, short: string, value: string | number,
    n = Number(value), gain: (d: number) => string = plain,
  ) => out.push({ key, icon, label, short, value: typeof value === 'number' ? formatNumber(value, 2) : value, n, gain });
  /** A per-level list that a building may not carry at all. */
  const term = (list: readonly number[], blank: number) =>
    (list.length === 0 ? blank : levelIndexed(list, level) ?? blank);

  if (def.populationCapacityPerLevel.length > 0) {
    add('homes', 'bed', 'Beds', 'Beds', levelIndexed(def.populationCapacityPerLevel, level));
  }
  if (def.influenceRadiusPerLevel.length > 0) {
    add('reach', 'showme', 'Exploration range', 'Range', levelIndexed(def.influenceRadiusPerLevel, level));
    add('crew', 'workers', 'Workers', 'Crew', levelIndexed(def.maxWorkersPerLevel, level));
    // The card's workers stepper says it (*2 / 3*); the popup keeps the pair.
    out[out.length - 1].onCard = false;
  }
  // A crew's haul and swing are the late levels' gift, neutral until then,
  // and the card's Production already counts them in: the popup's pair shows
  // what a level buys, the card does not repeat them.
  if (def.extraUnitsPerDeliveryPerLevel.length > 0) {
    const haul = term(def.extraUnitsPerDeliveryPerLevel, 0);
    add('delivery', 'plus', 'Per delivery', 'Haul', `+${formatExact(haul)}`, haul);
    out[out.length - 1].onCard = false;
  }
  if (def.strikeSpeedPerLevel.length > 0) {
    const swing = term(def.strikeSpeedPerLevel, 1);
    add('swing', 'clock', 'Swing', 'Swing', `×${swing}`, swing);
    out[out.length - 1].onCard = false;
  }
  // What it holds uncollected (03-economy.md §3.2), in the coin it makes: a
  // level buys a bigger store, and a bigger store is a longer absence.
  if (def.storageCapacityPerLevel.length > 0) {
    const cap = levelIndexed(def.storageCapacityPerLevel, level);
    const coin = (def.harvestSources.length > 0
      ? HARVEST[def.harvestSources[0]].currencyId : 'Gold') as IconName;
    add('store', coin, 'Storage', 'Storage', formatExact(cap), cap,
      (d) => signed(d, formatExact(Math.abs(d))));
  }
  if (def.armyCapPerLevel.length > 0) {
    add('army', 'army', 'Army cap', 'Army', levelIndexed(def.armyCapPerLevel, level));
  }
  if (def.bedsPerLevel.length > 0) {
    add('beds', 'hp', 'Beds', 'Beds', levelIndexed(def.bedsPerLevel, level));
  }
  // A level buys a house MORE ROOM and BETTER RENT, and the second half is
  // the reason to keep upgrading a house that is already full.
  if (def.taxBonusPerLevel.length > 0) {
    const rent = Math.round(levelIndexed(def.taxBonusPerLevel, level) * 100);
    add('rent', 'Gold', 'Rent each', 'Rent', `+${rent}%`, rent, (d) => signed(d, `${Math.abs(d)}%`));
  }
  // The Sanctum owns BOTH Mana numbers — it is the engine as well as the
  // reservoir, since the Townhall stopped producing (08-magic.md §2).
  if (district.definitionId === 'Sanctum') {
    add('mana-cap', 'Mana', 'Mana held', 'Stored', levelIndexed(MANA.sanctumCapPerLevel, level));
    add('mana-rate', 'Mana', 'Mana /h', 'Rate', levelIndexed(MANA.sanctumPerHourPerLevel, level));
  }
  if (district.definitionId === 'Townhall') {
    const ladder = TAXES.townhallMultiplierPerLevel;
    if (ladder.length > 0) {
      const mult = levelIndexed(ladder, level);
      add('taxes', 'Gold', 'Gold income', 'Income', `×${mult}`, mult);
    }
    const reach = FOG.reachPerTownhallLevel;
    if (reach.length > 0) {
      const ring = levelIndexed(reach, level);
      add('fog', 'Townhall', 'Fog reach', 'Fog', `ring ${ring}`, ring,
        (d) => signed(d, `${Math.abs(d)} ring${Math.abs(d) === 1 ? '' : 's'}`));
    }
  }
  // Last of all: what one of its trainees takes to train HERE, neighbours included. One
  // trainee per building (dataRules.ts), so the building's own figure — and
  // the Train button carries only the price.
  if (def.trains.length > 0) {
    const secs = trainSecondsAt(game.state, district.uniqueId, def.trains[0]);
    add('train-time', 'hourglass', 'Training time', 'Training', formatDuration(secs), secs,
      (d) => signed(d, formatDuration(Math.abs(d))));
    out[out.length - 1].lowerIsBetter = true;
  }
  return out;
}

/**
 * What the next level adds, for the upgrade popup's Improvements.
 *
 * Only the stats the level MOVES: the popup lists what the player is buying,
 * and a stat the level leaves alone is not part of it.
 */
export function statChanges(game: Game, district: District, next: number): StatChange[] {
  const after = new Map(statsAt(game, district, next).map((s) => [s.key, s.n]));
  return statsAt(game, district, district.level).flatMap((s) => {
    const d = (after.get(s.key) ?? s.n) - s.n;
    if (Math.abs(d) < 1e-9) return [];
    return [{ ...s, delta: s.gain(d), better: (d > 0) !== (s.lowerIsBetter === true) }];
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
      label: `Reach ${formatExact(pop)} population`,
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
      label: `${formatExact(demand)} Harmony`,
      met: harmonyBlock(game.state, def, next, district) === null,
    });
  }
  return out;
}

/** Whether every gate is clear — what decides the button, not the price. */
export const requirementsMet = (game: Game, district: District, next: number): boolean =>
  requirements(game, district, next).every((r) => r.met);
