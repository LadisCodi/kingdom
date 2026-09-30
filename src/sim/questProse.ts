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

import { CURRENCIES, DISTRICTS, FEATURES, TECHNOLOGIES } from './data/definitions';
import type { QuestDef, QuestGoalType } from './data/definitions';
import type { CurrencyId, DistrictId, FeatureId, TechId } from './state';

/** An id the DATA holds as a bare string, in the words a player reads. The
 *  fallback is the id itself: a quest naming something that no longer exists
 *  is a content fault for `tests/quests.test.ts` to report, not a crash. */
const districtName = (id: string): string => DISTRICTS[id as DistrictId]?.name ?? id;
const featureName = (id: string): string => FEATURES[id as FeatureId]?.name ?? id;
const techName = (id: string): string => TECHNOLOGIES[id as TechId]?.name ?? id;
// A currency has no display name because its id IS one: Gold, Food, Wood,
// Stone. The lookup is still made, so a quest naming a currency that has been
// renamed away reads as the bare id rather than as a plausible wrong word.
const currencyName = (id: string): string =>
  (CURRENCIES[id as CurrencyId] === undefined ? id : id);

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

const plural = (n: number, one: string): string =>
  (n === 1 || isMass(one) ? one : IRREGULAR[one] ?? `${one}s`);

/** "a Farm", but "Housing" and "crop plots" — an article in front of a mass
 *  noun is the tell that a line was assembled rather than written. */
const one = (name: string): string => (isMass(name) ? name : `a ${name}`);

/** `1,200`, not `1200` — the tracker's numbers are read at a glance. */
const count = (n: number): string => n.toLocaleString('en-GB');

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
}): string {
  const { goalTarget: target, goalAmount: n, goalLevel: level } = quest;
  switch (quest.goalType) {
    case 'BuildDistrict':
      return target === null
        ? `Build ${count(n)} ${plural(n, 'building')}.`
        : n === 1
          ? `Build ${one(districtName(target))}.`
          : `Build ${count(n)} ${plural(n, districtName(target))}.`;
    case 'UpgradeDistrict': {
      const what = target === null ? 'building' : districtName(target);
      const bar = level === null ? '' : ` to level ${level}`;
      return n === 1
        ? `Upgrade ${one(what)}${bar}.`
        : `Upgrade ${count(n)} ${plural(n, what)}${bar}.`;
    }
    case 'CollectResource':
      return `Collect ${count(n)} ${currencyName(target ?? '')}.`;
    case 'HoldResource':
      return `Hold ${count(n)} ${currencyName(target ?? '')} at once.`;
    case 'ReachPopulation':
      return `Grow to ${count(n)} ${plural(n, 'villager')}.`;
    case 'CompleteTech':
      return target === null
        ? 'Finish a technology.'
        : `Research ${techName(target)}.`;
    case 'CompleteTechs':
      return `Research ${count(n)} ${plural(n, 'technology')}.`;
    case 'AssignWorkers':
      return `Put ${count(n)} ${plural(n, 'villager')} to work.`;
    case 'TrainArmy':
      return `Train ${count(n)} ${plural(n, 'soldier')}.`;
    case 'CollectTaps':
      return `Tap ${count(n)} times.`;
    case 'DiscoverCells':
      return `Clear ${count(n)} ${plural(n, 'tile')} of fog.`;
    case 'DiscoverFeature':
      return target === null
        ? `Find ${count(n)} ${plural(n, 'thing')}.`
        : `Find ${count(n)} ${plural(n, featureName(target))}.`;
    case 'ClaimLandmarks':
      return `Claim ${count(n)} ${plural(n, 'landmark')}.`;
    case 'ClearLairs':
      return `Clear ${count(n)} ${plural(n, 'lair')}.`;
    case 'OwnArtifacts':
      return `Own ${count(n)} ${plural(n, 'relic')}.`;
    case 'OwnHeroes':
      return `Own ${count(n)} ${plural(n, 'hero')}.`;
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
