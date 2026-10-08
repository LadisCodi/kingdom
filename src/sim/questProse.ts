// WHAT A QUEST ASKS, generated from its goal.
//
// A quest used to say it twice: once as data — `goalType`, `goalTarget`,
// `goalAmount` — and once as a `description` typed beside it on the Quests
// sheet. Only the data was checked, so the prose drifted from it and, worse,
// drifted in REGISTER: half the chain read "Build the Sanctum." and half read
// "Nothing here can be worked by hand yet. Research Forestry — it opens the
// woods and the berry bushes both." Briefing, not label.
//
// That mattered because the tracker is the ONLY place a description is ever
// shown, and it fits about forty characters. Forty of the fifty-three
// descriptions were longer, so three quarters of the chain was read as a
// sentence cut off mid-word — the long half of the copy had no reader at all.
//
// So the sentence is not authored any more; it is a RENDERING of the goal, the
// way `techProse.ts` renders a technology's card from what it unlocks. A
// rebalance updates its own prose, and a new quest cannot ship without one.
//
// What is still written by hand is the half that is language rather than
// fact: one phrase per goal type below, and the quest's NAME, which stays on
// the sheet because a name is flavour ("Timber!", "Tax day") and carries no
// fact to drift from.
//
// It lives here rather than in `sim/data/` for the reason `techProse.ts` does:
// it needs display names, and `definitions.ts` may not import it back.

import { ABANDONED, CURRENCIES, DISTRICTS, FEATURES, LANDMARK_ART, TECHNOLOGIES } from './data/definitions';
import type { QuestDef, QuestGoalType } from './data/definitions';
import type { CurrencyId, DistrictId, FeatureId, LandmarkKind, TechId } from './state';
import { currentLang } from '../i18n/lang';
import { tr, trn } from '../i18n/tr';

/** An id the DATA holds as a bare string, in the words a player reads. The
 *  fallback is the id itself: a quest naming something that no longer exists
 *  is a content fault for `tests/quests.test.ts` to report, not a crash. */
/** What a group of buildings is called in a goal (`AnyDecoration`). */
const groupName = (id: string): string | undefined => {
  switch (id) {
    case 'AnyDecoration': return tr('decoration');
    case 'AnyProducer': return tr('production building');
    case 'AnyHall': return tr('military hall');
    case 'AnyWorkshop': return tr('workshop');
    default: return undefined;
  }
};
const districtName = (id: string): string => groupName(id) ?? DISTRICTS[id as DistrictId]?.name ?? id;
const featureName = (id: string): string => FEATURES[id as FeatureId]?.name ?? id;
const techName = (id: string): string => TECHNOLOGIES[id as TechId]?.name ?? id;
/** A currency in the player's words: Gold, Food, Wood, Stone. A quest naming
 *  a currency that has been renamed away reads as the bare id rather than as
 *  a plausible wrong word. */
const currencyName = (id: string): string => {
  if (CURRENCIES[id as CurrencyId] === undefined) return id;
  switch (id as CurrencyId) {
    case 'Gold': return tr('Gold');
    case 'Food': return tr('Food');
    case 'Wood': return tr('Wood');
    case 'Stone': return tr('Stone');
    case 'Mana': return tr('Mana');
    case 'Knowledge': return tr('Knowledge');
    case 'Stardust': return tr('Stardust');
    case 'Gems': return tr('Gems');
    default: return id;
  }
};

/**
 * Names English will not inflect by adding an s.
 *
 * Authored, because there is no rule to derive them from — the same reason
 * `techProse.ts` writes its noun phrases by hand. A name mapped TO ITSELF is a
 * mass or already-plural noun: two of them are still "Housing".
 *
 * Anything ending in s is caught without an entry, which covers the district
 * names that are already plural ("crop plots") or only look it ("Barracks").
 */
const IRREGULAR: Readonly<Record<string, string>> = {
  technology: 'technologies',
  hero: 'heroes',
  Housing: 'Housing',
};

const isMass = (one: string): boolean => IRREGULAR[one] === one || /s$/i.test(one);

// SPANISH NAMES are inflected by rule: the data's names are translated by the
// overlay, so there is no table to write. The head noun takes the plural, and
// so does an adjective straight after it ("Santuarios arcanos"); a name that
// ends in s is already plural ("huertos", "Establos").
const es = (): boolean => currentLang() === 'es';
const LINKS = new Set(['de', 'del', 'para', 'con', 'en']);
const pluralWordEs = (w: string): string =>
  /s$/i.test(w) ? w
    : /ión$/i.test(w) ? `${w.slice(0, -3)}iones`
      : /z$/i.test(w) ? `${w.slice(0, -1)}ces`
        : /[aeiouáéó]$/i.test(w) ? `${w}s`
          : `${w}es`;
const pluralEs = (name: string): string => {
  const words = name.split(' ');
  if (/s$/i.test(words[0])) return name;
  words[0] = pluralWordEs(words[0]);
  if (words.length > 1 && !LINKS.has(words[1].toLowerCase())) words[1] = pluralWordEs(words[1]);
  return words.join(' ');
};
/** A Spanish name's gender, from its head noun: *la granja*, *el muelle*. */
const feminineEs = (name: string): boolean => /(a|ión|dad)$/i.test(name.split(' ')[0]);

const plural = (n: number, one: string): string => (es()
  ? (n === 1 ? one : pluralEs(one))
  : (n === 1 || isMass(one) ? one : IRREGULAR[one] ?? `${one}s`));

/** "a Farm", but "Housing" and "crop plots" — an article in front of a mass
 *  noun is the tell that a line was assembled rather than written. */
const one = (name: string): string => (es()
  ? (/s$/i.test(name.split(' ')[0]) ? name : `${feminineEs(name) ? 'una' : 'un'} ${name}`)
  : (isMass(name) ? name : `a ${name}`));

/** "the Farm" — *la granja*, *el muelle*. */
const the = (name: string): string => (es()
  ? `${/s$/i.test(name.split(' ')[0]) ? (feminineEs(name) ? 'las' : 'los') : (feminineEs(name) ? 'la' : 'el')} ${name}`
  : `the ${name}`);

/** "the old housing" — *la casa en ruinas*. */
const theOld = (name: string): string => (es() ? `${the(name)} en ruinas` : `the old ${name}`);

/** `1,200`, not `1200` — the tracker's numbers are read at a glance. The
 *  sim reads no locale, so this is the English grouping; the UI passes its
 *  own formatter (`formatExact`), which writes the viewer's. */
const groupEnglish = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * The line the tracker shows: an IMPERATIVE naming the goal and nothing else.
 *
 * No context, no reason, no flavour — those are the quest's name's job, and
 * the tracker's job is to answer "what do I do now" in one glance. Every
 * branch is written to stay inside `QUEST_LINE_MAX`, which
 * `tests/questProse.test.ts` enforces over the whole chain.
 */
export function questLine(quest: {
  goalType: QuestGoalType;
  goalTarget: string | null;
  goalAmount: number;
  goalLevel: number | null;
}, count: (num: number) => string = groupEnglish): string {
  const { goalTarget: target, goalAmount: amount, goalLevel: level } = quest;
  const n = count(amount);
  switch (quest.goalType) {
    case 'BuildDistrict':
      return target === null
        ? trn(amount, 'Build {n} building.', 'Build {n} buildings.', { n })
        : amount === 1
          ? tr('Build {what}.', { what: one(districtName(target)) })
          : tr('Build {n} {things}.', { n, things: plural(amount, districtName(target)) });
    case 'RepairDistrict': {
      // One ruin of its kind on the map: it has a name of its own, and that is
      // what the line asks for — "Repair the Millers' house."
      const ruins = ABANDONED.filter((a) => a.districtId === target);
      if (amount === 1 && ruins.length === 1) {
        const name = ruins[0].name;
        return tr('Repair {what}.', { what: `${name.charAt(0).toLowerCase()}${name.slice(1)}` });
      }
      const what = (target === null ? tr('building') : districtName(target)).toLowerCase();
      return amount === 1
        ? tr('Repair {what}.', { what: theOld(what) })
        : tr('Repair {n} old {things}.', { n, things: plural(amount, what) });
    }
    case 'UpgradeDistrict': {
      const what = target === null ? tr('building') : districtName(target);
      // There is one Townhall: *the* Townhall, never *a* Townhall.
      const which = target === 'Townhall' ? the(what) : one(what);
      if (amount === 1) {
        return level === null
          ? tr('Upgrade {what}.', { what: which })
          : tr('Upgrade {what} to level {level}.', { what: which, level });
      }
      return level === null
        ? tr('Upgrade {n} {things}.', { n, things: plural(amount, what) })
        : tr('Upgrade {n} {things} to level {level}.', { n, things: plural(amount, what), level });
    }
    case 'CollectResource':
      return tr('Collect {n} {coin}.', { n, coin: currencyName(target ?? '') });
    case 'HoldResource':
      return tr('Hold {n} {coin} at once.', { n, coin: currencyName(target ?? '') });
    case 'ReachPopulation':
      return trn(amount, 'Grow to {n} villager.', 'Grow to {n} villagers.', { n });
    case 'CompleteTech':
      return target === null
        ? tr('Finish a technology.')
        : tr('Research {name}.', { name: techName(target) });
    case 'CompleteTechs':
      return trn(amount, 'Research {n} technology.', 'Research {n} technologies.', { n });
    case 'AssignWorkers':
      return trn(amount, 'Put {n} villager to work.', 'Put {n} villagers to work.', { n });
    case 'WorkInReach': {
      // What its crew works, by the feature's own name: "crop plots".
      const def = target === null ? undefined : DISTRICTS[target as DistrictId];
      const source = def?.harvestSources[0];
      const feature = Object.values(FEATURES).find((f) => f.source === source);
      const what = (feature?.name ?? tr('field')).toLowerCase();
      return tr('Move {what} beside {n} {things}.',
        { what: the(target === null ? tr('building') : districtName(target)), n, things: plural(amount, what) });
    }
    case 'TrainArmy':
      return trn(amount, 'Train {n} soldier.', 'Train {n} soldiers.', { n });
    case 'CollectTaps':
      return tr('Tap {n} times.', { n });
    case 'DiscoverCells':
      return trn(amount, 'Clear the fog from {n} tile in all.', 'Clear the fog from {n} tiles in all.', { n });
    case 'DiscoverFeature':
      return target === null
        ? trn(amount, 'Find {n} thing.', 'Find {n} things.', { n })
        : tr('Find {n} {things}.', { n, things: plural(amount, featureName(target)) });
    case 'ClaimLandmarks': {
      if (target === null) return trn(amount, 'Claim {n} landmark.', 'Claim {n} landmarks.', { n });
      const name = LANDMARK_ART[target as LandmarkKind]?.name ?? target;
      return amount === 1
        ? tr('Claim {what}.', { what: the(name) })
        : tr('Claim {n} {things}.', { n, things: plural(amount, name) });
    }
    case 'FindLairs':
      return trn(amount, 'Find {n} lair.', 'Find {n} lairs.', { n });
    case 'ClearLairs':
      return trn(amount, 'Clear {n} lair.', 'Clear {n} lairs.', { n });
    case 'OwnArtifacts':
      return trn(amount, 'Own {n} relic.', 'Own {n} relics.', { n });
    case 'OwnHeroes':
      return trn(amount, 'Own {n} hero.', 'Own {n} heroes.', { n });
  }
}

/**
 * What the tracker can show without truncating.
 *
 * Measured, not chosen: the scroll is 226px wide, the goal's mark takes 44 of
 * them and the padding 26, which leaves ~156px for two lines of the 13px body
 * face — about 22 characters a line. 44 is that, and it is the number
 * `tests/questProse.test.ts` holds every generated line to.
 */
export const QUEST_LINE_MAX = 44;

/** The whole chain's lines, for the test and for `?dev` to eyeball. */
export const questLines = (quests: readonly QuestDef[]): string[] =>
  quests.map((q) => questLine(q));
