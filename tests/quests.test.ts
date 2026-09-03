// The quest chain: absolute goals are state predicates (pre-done work
// counts), relative goals count events only while active, claims pay the
// reward and advance the chain, and offline replay feeds relative progress.
import { describe, expect, it } from 'vitest';
import {
  DISTRICTS, QUESTS, TECHNOLOGIES, TECH_ORDER, type QuestDef,
} from '../src/sim/data/definitions';
import {
  explorationGate, fogState, isReachable, revealCostForCell, revealTap,
} from '../src/sim/fog';
import { tapCell } from '../src/sim/harvest';
import {
  activeQuest, claimQuest, isQuestComplete, questValue, recordQuestEvent,
} from '../src/sim/quests';
import { techCost } from '../src/sim/research';
import { deserialize, serialize } from '../src/sim/save';
import {
  addToWallet, coordKey, getWallet, parseCoordKey, townhall,
  type FeatureId, type GameState,
} from '../src/sim/state';
import {
  addBuilt, BERRIES, canGather, FOREST, freshGame, fund, map, T0, tickAt, completeRanks } from './helpers';


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
    // The opening is a HEADING, not just fog: it names the forest, so the
    // ground the player clears is the ground quest 3 then asks them to chop.
    expect(QUESTS[0]).toMatchObject(
      { id: 'FirstSteps', goalType: 'DiscoverFeature', goalTarget: 'Trees' });
    expect(QUESTS[1]).toMatchObject({ id: 'Woodcraft', goalTarget: 'Forestry' });

    inOrder(
      'FirstSteps', 'Woodcraft',                  // 1-2  find the woods → the
                                                  //        one research
      'Timber', 'ARoof',                          // 3-4  chop, then a roof
      'Rations', 'FirstVillager',                 // 5-6  a meal, then a neighbour —
                                                  //   a roof is what permits one
      'TaxDay', 'Explorer',                       // 7    rent pays for more fog
      'Fields', 'FirstPlot', 'ByHand',            // 9-10 farming, by hand
      'Lumber', 'Farmhand', 'ToWork',             // 11-12 and then not by hand
      'Trade', 'ToMarket', 'Merchant',            // 13-15 the FIRST beat at which
                                                  //   the city makes more than it
                                                  //   eats — so the first at which
                                                  //   "somewhere for surplus to go"
                                                  //   means anything. Moved up from
                                                  //   27+ to give generated orders a
                                                  //   home inside the opening
                                                  //   (habit-loop.md §2).
                                                  //   Research, THEN build — the
                                                  //   same two-beat shape as
                                                  //   Saws -> TheSawmill.
      'GrowingTown', 'Neighbors', 'ProperCapital',// 16-18 a House FIRST, then the
                                                  //   citizen it makes room for
                                                  //   (+ the Townhall, woven in)
      'SawTeeth', 'TheSawmill', 'Crewed',         // 19-21 automate the wood
      'FurtherAfield', 'OldStones',               // 22-23 explore, claim the shrine
      'Mapmakers', 'Surveyors',                   // 24    exploration becomes a system
      'Highlands', 'PutToSea',                    // 25-26 the terrain gates
      'ArmedMen', 'Mustered', 'FirstSoldier',     // 27-28 something worth killing
      'FirstSummon', 'IntoTheDark',               // 29-30 a hero, and the first depth
    );

    // 31+: the rest of the city economy the tutorial defers, then the long game.
    inOrder('IntoTheDark', 'Stoneworks', 'TheMine', 'GrandCapital');
    expect(QUESTS.at(-1)).toMatchObject(
      { id: 'TheReliquary', goalType: 'OwnArtifacts', goalAmount: 3 });
  });

  // The two goal kinds the onboarding rewrite needed and the sim did not have.
  it('reads the new goal kinds off real state', () => {
    const state = freshGame();
    const surveyors = QUESTS.find((q) => q.id === 'Surveyors')!;
    expect(questValue(state, surveyors)).toBe(0);
    completeRanks(state, 'Surveying', 2);
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
    // Gold alone. The early chain pays no Knowledge now — that would announce
    // a currency hours before the player owns anything to spend it on.
    expect(state.pendingDiscoveries).toEqual(['resource:Gold']);
  });
});

// Docs/features/knowledge.md — the steady half of the research budget.
//
// CLAIM: quests pay Stardust into the KINGDOM purse, and the chain pays out
// more Gold than the whole tech tree costs. Exploring is the half that scales;
// this is the half that arrives on rails, so a player who follows the chain
// is never hard-stuck behind a technology they cannot afford.
describe('quests fund the research tree', () => {
  it('pays its Stardust into the kingdom purse, not the city', () => {
    const state = freshGame();
    const explorer = QUESTS.findIndex((q) => q.id === 'Explorer');
    state.quests.index = explorer;
    state.quests.progress = QUESTS[explorer].goalAmount;
    expect(claimQuest(state)).toBe('Claimed');
    expect(getWallet(state.kingdom.wallet, 'Stardust'))
      .toBe(QUESTS[explorer].rewardStardust);
    expect(getWallet(state.city.wallet, 'Stardust')).toBe(0);
  });

  // THE RATIO INVERTED ON 2026-09-04, on purpose.
  //
  // The chain used to pay 1.8x the whole tree, which
  // Docs/features/tomes-and-research.md §0 names as the problem: "the tree is
  // not a sink, it is a formality". Collapsing the upgrades into 49 ranked
  // technologies took the tree from 6,600 to 26,625, so the chain now covers
  // a little under half of it and the rest has to be earned by running a
  // city. That is the point — but it is also the number most likely to make
  // the early game feel poor, so it is asserted rather than assumed.
  it('the chain no longer covers the tree — the tree is a real sink now', () => {
    const chain = QUESTS.reduce((sum, q) => sum + (q.reward.Gold ?? 0), 0);
    const tree = TECH_ORDER.reduce((sum, id) => sum + techCost(id), 0);
    // 11,865: the two Market beats moved into the opening and were re-priced
    // to their new position (250/290 -> 110/120, since 540 Gold at quest 15
    // would have nearly doubled the early economy), and a third beat —
    // `Trade`, the research that opens them — was added in front at 100.
    expect(chain).toBe(11_865);
    expect(tree).toBe(26_625);
    // Still enough to carry the player well past the opening: the majors
    // alone (what the chain used to be measured against) cost 6,600.
    const majors = TECH_ORDER.filter((id) => TECHNOLOGIES[id].line === null)
      .reduce((sum, id) => sum + techCost(id), 0);
    expect(majors).toBe(6600);
    expect(chain).toBeGreaterThan(majors);
  });

  // CLAIM: Knowledge appears with the Reliquary, not before it. Every quest
  // that pays it is a quest about the long game — clearing a ruin, reaching a
  // depth, owning a hero or a relic — so a player cannot bank a currency they
  // have nothing to spend on.
  it('only the long-game quests pay Knowledge at all', () => {
    const LONG_GAME = ['ClearRuins', 'ReachDepth', 'OwnArtifacts', 'OwnHeroes'];
    for (const q of QUESTS) {
      if (q.rewardStardust > 0) expect(LONG_GAME).toContain(q.goalType);
    }
    expect(QUESTS.filter((q) => q.rewardStardust > 0).length).toBeGreaterThan(0);
  });

  /**
   * The opening's one arithmetic dependency, and the whole game hangs off it:
   * quest 2 DEMANDS Forestry, quest 1 is the only thing before it, and both
   * the fog quest 1 asks for and Forestry itself are paid out of the same
   * fixed opening purse (Docs/onboarding.md).
   *
   * So the sum that has to work is: (the cells quest 1 asks for, at their
   * DEAREST) + Forestry ≤ the opening grant + what quest 1 pays back.
   * Dearest, because the player picks the cells and may well pick badly — a
   * floor that only holds for a considerate player is not a floor.
   *
   * This is the test that fails if anyone retunes the fog curve, the opening
   * grant, quest 1's reward, or Forestry's price in isolation.
   */
  it('the opening funds its own first research, at the worst frontier the player can pick', () => {
    const state = freshGame();
    const first = QUESTS[0];
    expect(['DiscoverCells', 'DiscoverFeature']).toContain(first.goalType);

    // Every cell the player could actually pay for right now — narrowed to
    // the ones that COUNT, because a feature-specific opening quest cannot be
    // finished on whatever ground happens to be cheapest.
    const frontier = [...map.terrain.keys()]
      .map(parseCoordKey)
      .filter((c) => fogState(state, map, c) === 'Discovered'
        && isReachable(state, map, c)
        && explorationGate(map, c) === null
        && (first.goalType !== 'DiscoverFeature'
          || map.initialFeatures.get(coordKey(c)) === first.goalTarget));
    expect(frontier.length, `fewer than ${first.goalAmount} cells can finish quest 1`)
      .toBeGreaterThanOrEqual(first.goalAmount);

    const dearest = frontier
      .map((c) => revealCostForCell(state, map, c))
      .sort((a, b) => b - a)
      .slice(0, first.goalAmount);

    const fog = dearest.reduce((sum, cost) => sum + cost, 0);
    const purse = getWallet(state.city.wallet, 'Gold') + (first.reward.Gold ?? 0);
    expect(fog).toBeLessThanOrEqual(purse);
    expect(fog + techCost('Forestry')).toBeLessThanOrEqual(purse);
  });
});

// DiscoverFeature (2026-09-02): a DiscoverCells that cares WHAT it uncovered.
//
// "Clear five cells" can be satisfied in any direction, so it teaches the verb
// and nothing else. "Clear two with forest on them" is a heading — it points
// the opening at the thing the next quest is about to need, which is the
// whole reason the goal type exists.
describe('DiscoverFeature: revealing cells that have something on them', () => {
  const questWith = (target: FeatureId, amount: number): QuestDef => ({
    id: 'test', name: 'test', description: '',
    goalType: 'DiscoverFeature', goalTarget: target, goalAmount: amount, goalLevel: null,
    reward: {}, rewardGems: 0, rewardStardust: 0,
  });

  /** Put a made-up quest in the chain's active slot. */
  const activate = (state: GameState, quest: QuestDef) => {
    (QUESTS as QuestDef[]).splice(state.quests.index, 0, quest);
    state.quests.progress = 0;
    return () => { (QUESTS as QuestDef[]).splice(state.quests.index, 1); };
  };

  it('counts only reveals that uncovered the named feature', () => {
    const state = freshGame();
    const restore = activate(state, questWith('Trees', 2));
    try {
      recordQuestEvent(state, { kind: 'reveal', feature: null }); // bare ground
      recordQuestEvent(state, { kind: 'reveal', feature: 'Rocks' }); // wrong one
      expect(state.quests.progress).toBe(0);
      recordQuestEvent(state, { kind: 'reveal', feature: 'Trees' });
      expect(state.quests.progress).toBe(1);
      recordQuestEvent(state, { kind: 'reveal', feature: 'Trees' });
      expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
    } finally { restore(); }
  });

  // The event has to carry the feature, because the reveal is the only moment
  // that knows it: a berry bush is FINITE, so a player who drains it minutes
  // later would otherwise retroactively un-complete the quest.
  it('keeps the credit after the feature itself is used up', () => {
    const state = canGather(freshGame());
    const bush = BERRIES;
    delete state.fog.revealed[coordKey(bush)]; // put it back under the fog
    state.city.wallet.Gold = 500;

    const restore = activate(state, questWith('BerryBush', 1));
    try {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, bush);
      expect(r).toBe('Revealed');
      expect(state.quests.progress).toBe(1);

      // Drain it to nothing — the bush leaves the map entirely.
      while (tapCell(state, map, bush, T0) === 'Harvested') { /* eat it */ }
      expect(state.features[coordKey(bush)]).toBeUndefined();
      expect(state.quests.progress).toBe(1); // still counted
      expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
    } finally { restore(); }
  });

  it('counts a real fog reveal, with the feature read off the cell', () => {
    const state = freshGame();
    state.city.wallet.Gold = 500;
    // A Trees cell one ring out, reachable from the opening block.
    const trees = [...map.terrain.keys()].map(parseCoordKey)
      .filter((c) => map.initialFeatures.get(coordKey(c)) === 'Trees'
        && fogState(state, map, c) === 'Discovered' && isReachable(state, map, c))[0];
    expect(trees, 'no reachable forest at the opening').toBeDefined();

    const restore = activate(state, questWith('Trees', 1));
    try {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, trees);
      expect(r).toBe('Revealed');
      expect(state.quests.progress).toBe(1);
      expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
    } finally { restore(); }
  });

  it('the plain DiscoverCells goal still counts every reveal, feature or not', () => {
    const state = freshGame();
    const restore = activate(state, {
      id: 'test', name: 'test', description: '',
      goalType: 'DiscoverCells', goalTarget: null, goalAmount: 2, goalLevel: null,
      reward: {}, rewardGems: 0, rewardStardust: 0,
    });
    try {
      recordQuestEvent(state, { kind: 'reveal', feature: null });
      recordQuestEvent(state, { kind: 'reveal', feature: 'Trees' });
      expect(isQuestComplete(state, activeQuest(state)!)).toBe(true);
    } finally { restore(); }
  });
});
