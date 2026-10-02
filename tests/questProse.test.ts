// What a quest asks is rendered, not written — so the render is what is checked.
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data/definitions';
import type { QuestGoalType } from '../src/sim/data/definitions';
import { questLine, QUEST_LINE_MAX } from '../src/sim/questProse';

const ALL_GOALS: readonly QuestGoalType[] = [
  'BuildDistrict', 'RepairDistrict', 'UpgradeDistrict', 'HoldResource', 'ReachPopulation',
  'CompleteTech', 'CompleteTechs', 'AssignWorkers', 'TrainArmy',
  'CollectResource', 'CollectTaps', 'DiscoverCells', 'DiscoverFeature',
  'ClaimLandmarks', 'FindLairs', 'ClearLairs',
  'OwnArtifacts', 'OwnHeroes',
];

describe('what a quest asks', () => {
  it('fits the tracker, for every quest in the chain', () => {
    // THE REASON THIS MODULE EXISTS. The tracker is the only place a quest
    // line is ever shown and it holds ~44 characters; the authored copy this
    // replaced ran to 105, so forty of fifty-three quests were read as a
    // sentence cut off mid-word. A generated line that does not fit is the
    // same bug with a new author.
    const over = QUESTS
      .map((q) => questLine(q))
      .filter((line) => line.length > QUEST_LINE_MAX);
    expect(over).toEqual([]);
  });

  it('says something for every goal the union allows', () => {
    // The switch is exhaustive, so tsc already refuses a missing branch. What
    // it cannot see is a branch that returns nothing useful for the shape a
    // quest of that type actually has — a null target especially.
    for (const goalType of ALL_GOALS) {
      for (const goalTarget of [null, 'Gold']) {
        const line = questLine({ goalType, goalTarget, goalAmount: 3, goalLevel: 2 });
        expect(line.length, `${goalType} / ${goalTarget}`).toBeGreaterThan(4);
        expect(line, `${goalType} / ${goalTarget}`).toMatch(/\.$/);
        expect(line, `${goalType} / ${goalTarget}`).not.toMatch(/undefined|null|NaN/);
      }
    }
  });

  it('is an imperative — it names the goal and stops', () => {
    // The register the chain is being held to: no context, no reason, no
    // flavour. One sentence, one full stop, and the flavour lives in `name`.
    for (const quest of QUESTS) {
      const line = questLine(quest);
      expect(line.match(/\./g) ?? [], quest.name).toHaveLength(1);
      expect(line, quest.name).toMatch(/^[A-Z]/);
    }
  });

  it('inflects the names English will not inflect mechanically', () => {
    // "crop plots" is already plural, "Barracks" only looks it, and "Housing"
    // is a mass noun — each of which produced a wrong line once.
    const line = (over: Partial<Parameters<typeof questLine>[0]>) => questLine({
      goalType: 'BuildDistrict', goalTarget: 'FarmLands', goalAmount: 1, goalLevel: null, ...over,
    });
    expect(line({ goalAmount: 2 })).toBe('Build 2 crop plots.');
    expect(line({})).toBe('Build crop plots.');
    expect(line({ goalTarget: 'Housing', goalAmount: 2 })).toBe('Build 2 Housing.');
    expect(line({ goalTarget: 'Housing' })).toBe('Build Housing.');
    expect(line({ goalTarget: 'Farm' })).toBe('Build a Farm.');
    expect(line({ goalTarget: 'Farm', goalAmount: 2 })).toBe('Build 2 Farms.');
    expect(questLine({
      goalType: 'OwnHeroes', goalTarget: null, goalAmount: 2, goalLevel: null,
    })).toBe('Own 2 heroes.');
    expect(questLine({
      goalType: 'CompleteTechs', goalTarget: null, goalAmount: 3, goalLevel: null,
    })).toBe('Research 3 technologies.');
  });
});
