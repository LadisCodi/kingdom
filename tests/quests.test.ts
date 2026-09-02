// The quest chain: absolute goals are state predicates (pre-done work
// counts), relative goals count events only while active, claims pay the
// reward and advance the chain, and offline replay feeds relative progress.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, QUESTS, TECH_ORDER } from '../src/sim/data/definitions';
import {
  explorationGate, fogState, isReachable, revealCostForCell, revealKnowledge, revealTap,
} from '../src/sim/fog';
import { tapCell } from '../src/sim/harvest';
import {
  activeQuest, claimQuest, isQuestComplete, questValue, recordQuestEvent,
} from '../src/sim/quests';
import { techCost } from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import { addToWallet, getWallet, parseCoordKey, townhall } from '../src/sim/state';
import { addBuilt, canGather, FOREST, freshGame, fund, map, T0, tickAt } from './helpers';


describe('the quest chain', () => {
  // CLAIM: the chain IS Docs/onboarding.md, in order. That document is the
  // authored first-user experience, and a chain that drifts from it is the
  // one bug nobody notices until a playtest — so the order is asserted here
  // beat by beat rather than described in prose that cannot fail.
  it('follows the onboarding document, beat by beat', () => {
    const at = (id: string) => {
      const i = QUESTS.findIndex((q) => q.id === id);
      expect(i, `quest ${id} is missing from the chain`).toBeGreaterThanOrEqual(0);
      return i;
    };
    const inOrder = (...ids: string[]) => {
      const seen = ids.map(at);
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `${ids[i]} must come after ${ids[i - 1]}`).toBeGreaterThan(seen[i - 1]);
      }
    };

    // Steps 1-3: the game opens on the FOG, not on a tap. Exploring is what
    // pays for Forestry, and Forestry is the ONE door out of the opening —
    // it gates the trees and the berries both, so until it lands the only
    // thing a player can do is clear ground.
    expect(QUESTS[0]).toMatchObject(
      { id: 'FirstSteps', goalType: 'DiscoverCells', goalAmount: 5 });
    expect(QUESTS[1]).toMatchObject({ id: 'Woodcraft', goalTarget: 'Forestry' });

    inOrder(
      'FirstSteps', 'Woodcraft',                  // 1-2  explore → the one research
      'Timber', 'ARoof',                          // 3-4  chop, then a roof
      'Rations', 'FirstVillager',                 // 5-6  a meal, then a neighbour —
                                                  //   a roof is what permits one
      'TaxDay', 'Explorer',                       // 7    rent pays for more fog
      'Fields', 'FirstPlot', 'ByHand',            // 9-10 farming, by hand
      'Lumber', 'Farmhand', 'ToWork',             // 11-12 and then not by hand
      'GrowingTown', 'Neighbors', 'ProperCapital',// 13-14 a House FIRST, then the
                                                  //   citizen it makes room for
                                                  //   (+ the Townhall, woven in)
      'SawTeeth', 'TheSawmill', 'Crewed',         // 15-17 automate the wood
      'FurtherAfield', 'OldStones',               // 18-19 explore, claim the shrine
      'Mapmakers', 'Surveyors',                   // 20    exploration becomes a system
      'Highlands', 'PutToSea',                    // 21-22 the terrain gates
      'ArmedMen', 'Mustered', 'FirstSoldier',     // 23-24 something worth killing
      'FirstSummon', 'IntoTheDark',               // 25-26 a hero, and the first depth
    );

    // 27+: the city economy the tutorial deferred, then the long game.
    inOrder('IntoTheDark', 'ToMarket', 'Stoneworks', 'TheMine', 'GrandCapital');
    expect(QUESTS.at(-1)).toMatchObject(
      { id: 'TheReliquary', goalType: 'OwnArtifacts', goalAmount: 3 });
  });

  // The two goal kinds the onboarding rewrite needed and the sim did not have.
  it('reads the new goal kinds off real state', () => {
    const state = freshGame();
    const surveyors = QUESTS.find((q) => q.id === 'Surveyors')!;
    expect(questValue(state, surveyors)).toBe(0);
    state.upgrades.Surveying = 2;
    expect(isQuestComplete(state, surveyors)).toBe(true);

    const summon = QUESTS.find((q) => q.id === 'FirstSummon')!;
    expect(questValue(state, summon)).toBe(1); // the starting hero
    state.heroes.owned.push('Scout');
    expect(isQuestComplete(state, summon)).toBe(true);
  });

  it('gem rewards land in the PLAYER wallet', () => {
    const state = freshGame();
    const quest = QUESTS.find((q) => q.id === 'GrandCapital')!;
    state.quests.index = QUESTS.indexOf(quest);
    townhall(state).level = 3;
    const gems = getWallet(state.player.wallet, 'Gems');
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(claimQuest(state)).toBe('Claimed');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + quest.rewardGems);
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold + quest.reward.Gold!);
  });

  // The tutorial's beats OVERLAP on purpose: the Wood quest 3 asks you to
  // chop is the Wood quests 4 and 11 ask you to build with, so "collect it"
  // and "spend it" are one action rather than two errands.
  it('quests 3→4 overlap: the Wood you chopped is the House you build', () => {
    const state = canGather(freshGame());
    const timber = QUESTS.find((q) => q.id === 'Timber')!;
    state.quests.index = QUESTS.indexOf(timber);
    // Tapped through the raw primitive, so cell exhaustion is not the subject.
    for (let i = 0; i < timber.goalAmount; i++) {
      recordQuestEvent(state, { kind: 'collect', currency: 'Wood', amount: 1 });
      addToWallet(state.city.wallet, 'Wood', 1);
    }
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
    expect(claimQuest(state)).toBe('Claimed');

    expect(activeQuest(state)!.id).toBe('ARoof');
    // Enough for the roof AND the crop plot that comes six beats later.
    expect(getWallet(state.city.wallet, 'Wood')).toBeGreaterThanOrEqual(
      DISTRICTS.Housing.buildCost.Wood! + DISTRICTS.FarmLands.buildCost.Wood!);
  });

  it('absolute goals complete instantly when the work was already done', () => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 1, y: 2 });
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TheSawmill');
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true); // never blocked
  });

  it('relative goals ignore everything before activation', () => {
    const state = freshGame();
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TaxDay'); // CollectResource Gold 30
    state.quests.progress = 0;
    fund(state, { Gold: 1000 }); // riches on hand — but not COLLECTED while active
    expect(questValue(state, activeQuest(state)!)).toBe(0);
    recordQuestEvent(state, { kind: 'collect', currency: 'Wood', amount: 50 }); // wrong currency
    expect(state.quests.progress).toBe(0);
    recordQuestEvent(state, { kind: 'collect', currency: 'Gold', amount: 30 });
    expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
  });

  it('fog reveals feed the Explorer quest through the sim', () => {
    const state = freshGame();
    state.quests.index = QUESTS.findIndex((q) => q.id === 'Explorer');
    fund(state, { Gold: 100 });
    let r: string = 'Paid';
    while (r === 'Paid') r = revealTap(state, map, { x: 3, y: 1 }); // ungated grassland
    expect(r).toBe('Revealed');
    expect(state.quests.progress).toBe(1);
  });

  it('claiming needs completion; a finished chain has no quest', () => {
    const state = freshGame();
    expect(claimQuest(state)).toBe('NotComplete');
    state.quests.index = QUESTS.length;
    expect(activeQuest(state)).toBe(null);
    expect(claimQuest(state)).toBe('NoQuest');
  });

  it('progress survives the save and grows during offline replay', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1; // 30 gold/min in taxes (one of the two beds)
    state.quests.index = QUESTS.findIndex((q) => q.id === 'TaxDay');
    state.quests.progress = 7;
    tickAt(state, T0); // anchor the tax clock
    const restored = deserialize(serialize(state, T0), map, T0 + 120_000)!;
    expect(restored.quests.index).toBe(state.quests.index);
    // 2 offline minutes × 30 gold/min flowed through the collect hook.
    expect(restored.quests.progress).toBe(7 + 60);
    expect(isQuestComplete(restored, activeQuest(restored)!)).toBe(true);
  });
});

describe('first-time discoveries', () => {
  it('announces a resource ONCE, ever — persisted across saves', () => {
    const state = canGather(freshGame());
    expect(state.pendingDiscoveries).toEqual([]);
    tapCell(state, map, FOREST, T0);
    expect(state.pendingDiscoveries).toEqual(['resource:Wood']);
    tapCell(state, map, FOREST, T0); // second wood: no new announcement
    expect(state.pendingDiscoveries).toEqual(['resource:Wood']);
    state.pendingDiscoveries = []; // UI drained the banner
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.discoveries['resource:Wood']).toBe(true);
    tapCell(restored, map, FOREST, T0 + 1000);
    expect(restored.pendingDiscoveries).toEqual([]); // never re-announced
  });

  it('quest rewards discover their currencies too', () => {
    const state = canGather(freshGame());
    state.quests.index = QUESTS.findIndex((q) => q.id === 'Timber');
    state.quests.progress = QUESTS.find((q) => q.id === 'Timber')!.goalAmount;
    tapCell(state, map, FOREST, T0);
    state.pendingDiscoveries = [];
    expect(claimQuest(state)).toBe('Claimed'); // pays Gold
    expect(state.pendingDiscoveries).toEqual(['resource:Gold', 'resource:Knowledge']);
  });
});

// Docs/features/knowledge.md — the steady half of the research budget.
//
// CLAIM: quests pay Knowledge into the KINGDOM purse, and the chain pays out
// more than the whole tech tree costs. Exploring is the half that scales;
// this is the half that arrives on rails, so a player who follows the chain
// is never hard-stuck behind a technology they cannot afford.
describe('quests fund the research tree', () => {
  it('pays its Knowledge into the kingdom purse, not the city', () => {
    const state = freshGame();
    const explorer = QUESTS.findIndex((q) => q.id === 'Explorer');
    state.quests.index = explorer;
    state.quests.progress = QUESTS[explorer].goalAmount;
    expect(claimQuest(state)).toBe('Claimed');
    expect(getWallet(state.kingdom.wallet, 'Knowledge'))
      .toBe(QUESTS[explorer].rewardKnowledge);
    expect(getWallet(state.city.wallet, 'Knowledge')).toBe(0);
  });

  // The chain carries MOST of the tree and deliberately not all of it: a
  // player who follows the guided path still has to have been out on the map
  // to finish researching, which is the whole reason the currency is earned
  // by clearing fog. The map holds 2,902 on top of this, so the shortfall is
  // a nudge rather than a wall.
  it('the chain covers most of the tech tree, but never all of it', () => {
    const chain = QUESTS.reduce((sum, q) => sum + q.rewardKnowledge, 0);
    const tree = TECH_ORDER.reduce((sum, id) => sum + techCost(id), 0);
    expect(chain).toBe(571);
    expect(chain).toBeGreaterThan(tree * 0.75);
    expect(chain).toBeLessThan(tree);
  });

  /**
   * The opening's one arithmetic dependency, and the whole game hangs off it:
   * quest 2 DEMANDS Forestry, quest 1 is the only thing before it, and quest 1
   * pays no Knowledge of its own. Every point of it comes from the fog quest 1
   * makes the player clear.
   *
   * So the sum that has to work is: (cells quest 1 asks for) × (the CHEAPEST
   * Knowledge any of them can pay) ≥ Forestry. Cheapest, because the player
   * picks the cells and will pick the near ones — a floor that only holds for
   * a considerate player is not a floor.
   *
   * And the Gold has to be there too: a new kingdom is handed a fixed purse
   * (Docs/onboarding.md), and clearing those cells is the only thing it is
   * for. This is the test that fails if anyone retunes the fog curve, the
   * opening grant, the reveal yield, or Forestry's price in isolation.
   */
  it('the opening funds its own first research, at the worst frontier the player can pick', () => {
    const state = freshGame();
    const first = QUESTS[0];
    expect(first).toMatchObject({ goalType: 'DiscoverCells' });

    // Every cell the player could actually pay for right now.
    const frontier = [...map.terrain.keys()]
      .map(parseCoordKey)
      .filter((c) => fogState(state, map, c) === 'Discovered'
        && isReachable(state, map, c)
        && explorationGate(map, c) === null);
    expect(frontier.length).toBeGreaterThanOrEqual(first.goalAmount);

    const cheapest = frontier
      .map((c) => ({ k: revealKnowledge(map, c), gold: revealCostForCell(state, map, c) }))
      .sort((a, b) => a.k - b.k)
      .slice(0, first.goalAmount);

    const knowledge = cheapest.reduce((sum, c) => sum + c.k, 0);
    const gold = cheapest.reduce((sum, c) => sum + c.gold, 0);
    expect(knowledge).toBeGreaterThanOrEqual(techCost('Forestry'));
    expect(gold).toBeLessThanOrEqual(getWallet(state.city.wallet, 'Gold'));
  });
});
