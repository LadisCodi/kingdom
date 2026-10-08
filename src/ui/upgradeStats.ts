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

import { techMultiplier } from '../sim/techEffects';
import {
  DISTRICTS, FOG, HARVEST, MANA, levelIndexed,
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
import { tr, trn } from '../i18n/tr';

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
    add('homes', 'bed', tr('Beds'), tr('Beds'), levelIndexed(def.populationCapacityPerLevel, level));
  }
  if (def.influenceRadiusPerLevel.length > 0) {
    add('reach', 'showme', tr('Exploration range'), tr('Range'), levelIndexed(def.influenceRadiusPerLevel, level));
    // The map draws the range around the building while its card is open;
    // the popup keeps the pair, since a level can widen it.
    out[out.length - 1].onCard = false;
    add('crew', 'workers', tr('Workers'), tr('Crew'), levelIndexed(def.maxWorkersPerLevel, level));
    // The card's workers stepper says it (*2 / 3*); the popup keeps the pair.
    out[out.length - 1].onCard = false;
  }
  // A crew's haul is the late levels' gift, neutral until then, and the
  // card's Production already counts it in: the popup's pair shows what a
  // level buys, the card does not repeat it.
  if (def.extraUnitsPerDeliveryPerLevel.length > 0) {
    const haul = term(def.extraUnitsPerDeliveryPerLevel, 0);
    add('delivery', 'plus', tr('Per delivery'), tr('Haul'), `+${formatExact(haul)}`, haul);
    out[out.length - 1].onCard = false;
  }
  // How fast its crew works, as the building's own level gives it: ×1 at
  // level 1, climbing with every level. On the card too — it is what a
  // producer's level buys first.
  if (def.strikeSpeedPerLevel.length > 0) {
    const swing = term(def.strikeSpeedPerLevel, 1);
    add('swing', 'clock', tr('Work speed'), tr('Speed'), `×${formatNumber(swing, 2)}`, swing,
      (d) => signed(d, `×${formatNumber(Math.abs(d), 2)}`));
  }
  // What it holds uncollected (03-economy.md §3.2), in the coin it makes: a
  // level buys a bigger store, and a bigger store is a longer absence.
  if (def.storageCapacityPerLevel.length > 0) {
    // After the tree's Granaries, so the card's *120/150* is the real ceiling.
    const cap = Math.floor(levelIndexed(def.storageCapacityPerLevel, level)
      * techMultiplier(game.state, 'storageCapacity', { district: def.id }));
    const coin = (def.harvestSources.length > 0
      ? HARVEST[def.harvestSources[0]].currencyId : 'Gold') as IconName;
    add('store', coin, tr('Storage'), tr('Storage'), formatExact(cap), cap,
      (d) => signed(d, formatExact(Math.abs(d))));
  }
  if (def.armyCapPerLevel.length > 0) {
    add('army', 'army', tr('Army cap'), tr('Army'), levelIndexed(def.armyCapPerLevel, level));
  }
  if (def.bedsPerLevel.length > 0) {
    add('beds', 'hp', tr('Beds'), tr('Beds'), levelIndexed(def.bedsPerLevel, level));
  }
  // The War Camp's whole ladder: armies more out at once on the world board.
  if (def.armySlotsPerLevel.length > 0) {
    add('armySlots', 'army', tr('Armies out'), tr('Armies'), levelIndexed(def.armySlotsPerLevel, level));
  }
  // The Tavern's whole ladder: a share more Hero XP, the TOTAL at the level.
  if (def.heroXpBonusPerLevel.length > 0) {
    const xp = levelIndexed(def.heroXpBonusPerLevel, level);
    add('heroXp', 'HeroXp', tr('Hero XP'), tr('Hero XP'), `+${formatExact(xp)}%`, xp,
      (d) => signed(d, `${formatExact(Math.abs(d))}%`));
  }
  // A level buys a house MORE ROOM and BETTER RENT, and the second half is
  // the reason to keep upgrading a house that is already full.
  if (def.taxBonusPerLevel.length > 0) {
    const rent = Math.round(levelIndexed(def.taxBonusPerLevel, level) * 100);
    add('rent', 'Gold', tr('Rent each'), tr('Rent'), `+${formatExact(rent)}%`, rent, (d) => signed(d, `${formatExact(Math.abs(d))}%`));
    // The card's Gold /h already counts it in; the popup shows what a level adds.
    out[out.length - 1].onCard = false;
  }
  // The Sanctum owns BOTH Mana numbers — it is the engine as well as the
  // reservoir, since the Townhall stopped producing (08-magic.md §2).
  if (district.definitionId === 'Sanctum') {
    add('mana-cap', 'Mana', tr('Mana held'), tr('Stored'), levelIndexed(MANA.sanctumCapPerLevel, level));
    add('mana-rate', 'Mana', tr('Mana /h'), tr('Rate'), levelIndexed(MANA.sanctumPerHourPerLevel, level));
  }
  if (district.definitionId === 'Townhall') {
    // Its own Gold, made with nobody living in it, into its own store.
    if (def.goldPerMinutePerLevel.length > 0) {
      const perHour = levelIndexed(def.goldPerMinutePerLevel, level) * 60;
      add('taxes', 'Gold', tr('Gold /h'), tr('Income'), perHour);
    }
    const reach = FOG.reachPerTownhallLevel;
    if (reach.length > 0) {
      const ring = levelIndexed(reach, level);
      add('fog', 'Townhall', tr('Fog reach'), tr('Fog'), tr('ring {n}', { n: formatExact(ring) }), ring,
        (d) => signed(d, trn(Math.abs(d), '{n} ring', '{n} rings', { n: formatExact(Math.abs(d)) })));
    }
  }
  // Last of all: what one of its trainees takes to train HERE, neighbours included. One
  // trainee per building (dataRules.ts), so the building's own figure — and
  // the Train button carries only the price.
  if (def.trains.length > 0) {
    // At the rank the hall is set to: a Warrior III takes longer than a I.
    const secs = trainSecondsAt(game.state, district.uniqueId, game.traineeAt(district));
    add('train-time', 'hourglass', tr('Training time'), tr('tile::Training'), formatDuration(secs), secs,
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
      label: tr('Townhall level {n}', { n: formatExact(requiredTh) }),
      met: townhall(game.state).level >= requiredTh,
    });
  }
  const gateTech = requiredTechForLevel(district.definitionId, next);
  if (gateTech !== null) {
    out.push({
      icon: 'research',
      label: tr('Research {tech}', { tech: TECHNOLOGIES[gateTech].name }),
      met: isTechComplete(game.state, gateTech),
    });
  }
  const pop = requiredPopulation(district.definitionId, next);
  if (pop > 0) {
    out.push({
      icon: 'population',
      label: tr('Reach {n} population', { n: formatExact(pop) }),
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
      label: tr('{n} Harmony', { n: formatExact(demand) }),
      met: harmonyBlock(game.state, def, next, district) === null,
    });
  }
  return out;
}

/** Whether every gate is clear — what decides the button, not the price. */
export const requirementsMet = (game: Game, district: District, next: number): boolean =>
  requirements(game, district, next).every((r) => r.met);
