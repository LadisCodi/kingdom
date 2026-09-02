// Docs/onboarding.md — the authored first-user experience, PLAYED.
//
// The quest-order test in `quests.test.ts` asserts the chain lists the right
// beats in the right sequence. This one asserts something stronger and much
// easier to break by accident: that a player who does exactly what the chain
// says, with nothing but what the game has handed them, can actually finish
// each beat. Every dead end in an onboarding is an arithmetic failure between
// two numbers authored in different sheets — the fog curve against the
// opening purse, a tech price against what exploring pays, a build cost
// against what one tree yields — and none of those show up in a unit test of
// either side on its own.
//
// So: no `fund()`, ever. The only resources this test spends are the ones the
// opening grants and the ones it earns.
import { describe, expect, it } from 'vitest';
import { DISTRICTS, QUESTS, TECHNOLOGIES } from '../src/sim/data/definitions';
import { advance, changeWorkers, enqueueBuild } from '../src/sim/commands';
import { fogState, revealTap } from '../src/sim/fog';
import { collectTap } from '../src/sim/harvest';
import { mana } from '../src/sim/mana';
import { newGame } from '../src/sim/newGame';
import { maxPopulation, queueTraining } from '../src/sim/population';
import { activeQuest, claimQuest, isQuestComplete } from '../src/sim/quests';
import { isTechComplete, startTech, techCost } from '../src/sim/research';
import { coordKey, getWallet, type Coord, type TechId } from '../src/sim/state';
import { map, T0 } from './helpers';

const BERRIES: Coord = { x: 0, y: 2 };
const FOREST: Coord = { x: 2, y: 2 };
const ANIMALS: Coord = { x: 2, y: -2 };
const PLOT: Coord = { x: -1, y: 1 }; // open grass beside the Townhall, revealed at start

describe('a player can actually play the onboarding', () => {
  it('runs steps 1-14 on nothing but what the game gives them', () => {
    const state = newGame(map, T0);
    let now = T0;

    // Every step below claims the quest it just satisfied, so the chain and
    // the play are checked against each other the whole way down.
    const finish = (id: string) => {
      const quest = activeQuest(state)!;
      expect(quest.id, `expected to be on quest ${id}`).toBe(id);
      expect(isQuestComplete(state, quest), `${id} is not complete`).toBe(true);
      expect(claimQuest(state)).toBe('Claimed');
    };
    const tick = (seconds: number) => { now += seconds * 1000; advance(state, map, now); };
    const gold = () => getWallet(state.city.wallet, 'Gold');
    const wood = () => getWallet(state.city.wallet, 'Wood');
    const knowledge = () => getWallet(state.kingdom.wallet, 'Knowledge');
    const clear = (cell: Coord) => {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, cell);
      expect(r, `could not clear ${coordKey(cell)}`).toBe('Revealed');
    };
    const research = (id: TechId) => {
      expect(knowledge(), `cannot afford ${id}`).toBeGreaterThanOrEqual(techCost(id));
      expect(startTech(state, id, now)).toBe('Started');
      tick(TECHNOLOGIES[id].durationSeconds);
      expect(isTechComplete(state, id)).toBe(true);
    };
    // The forest cells the opening reveals, tapped round-robin so exhaustion
    // is waited out rather than assumed away.
    const TREES: Coord[] = [FOREST, { x: 1, y: 3 }, { x: 2, y: 3 }];
    const chop = (units: number) => {
      const target = getWallet(state.city.wallet, 'Wood') + units;
      let guard = 0;
      while (getWallet(state.city.wallet, 'Wood') < target) {
        expect(guard++, 'chopping made no progress').toBeLessThan(2000);
        let any = false;
        for (const cell of TREES) {
          if (fogState(state, map, cell) !== 'Revealed') continue;
          if (collectTap(state, map, cell, now) === 'Harvested') any = true;
        }
        if (!any) tick(30); // every reachable cell is spent — wait for recovery
      }
    };
    const build = (id: 'Housing' | 'FarmLands' | 'Farm', cell: Coord) => {
      expect(enqueueBuild(state, map, id, cell), `could not queue ${id}`).toBe('Started');
      tick(600); // long enough for anything this early
      expect(state.city.districts.some((d) => d.definitionId === id && d.state === 'Built'))
        .toBe(true);
    };

    // ---- steps 1-3: the fog pays for the research that opens the trees ----
    expect(gold()).toBeGreaterThan(0); // the opening purse exists at all
    expect(collectTap(state, map, FOREST, now)).toBe('TechLocked');

    for (const cell of [{ x: 3, y: 1 }, { x: -2, y: 0 }, { x: -2, y: 1 },
      { x: 0, y: 3 }, { x: 1, y: 3 }]) clear(cell);
    finish('FirstSteps');

    research('Forestry');
    finish('Woodcraft');

    // Trees exhaust after ten taps and take 90 s to come back, so this is a
    // few cells and a little patience — exactly the friction step 15 later
    // sells the Sawmill against.
    chop(QUESTS.find((q) => q.id === 'Timber')!.goalAmount);
    finish('Timber');

    // ---- steps 4-6: a roof, a meal, a neighbour ----
    expect(wood()).toBeGreaterThanOrEqual(DISTRICTS.Housing.buildCost.Wood!);
    build('Housing', { x: 2, y: 0 });
    finish('ARoof');

    for (let i = 0; i < 5; i++) expect(collectTap(state, map, BERRIES, now)).toBe('Harvested');
    finish('Rations');

    expect(maxPopulation(state)).toBeGreaterThanOrEqual(1);
    expect(queueTraining(state, now)).toBe('Queued');
    tick(60);
    expect(state.city.population).toBe(1);
    finish('FirstVillager');

    // ---- step 7: rent, which is what pays for more fog ----
    const beforeTax = gold();
    tick(120); // 1 housed × 30/min
    expect(gold()).toBeGreaterThanOrEqual(beforeTax + 30);
    finish('TaxDay');

    // ---- steps 7-8: back out into the country ----
    for (const cell of [{ x: 0, y: -2 }, { x: 1, y: -2 }, { x: 2, y: -2 },
      { x: -2, y: -1 }, { x: -2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 },
      { x: 3, y: 3 }]) clear(cell);
    finish('Explorer');

    expect(fogState(state, map, ANIMALS)).toBe('Revealed');
    for (let i = 0; i < 5; i++) {
      if (collectTap(state, map, ANIMALS, now) !== 'Harvested') tick(30);
    }
    finish('WildGame');

    // ---- steps 9-12: farming, by hand and then not ----
    research('Agriculture');
    finish('Fields');

    build('FarmLands', PLOT);
    finish('FirstPlot');

    while (getWallet(state.city.wallet, 'Food') < 20) {
      if (collectTap(state, map, PLOT, now) !== 'Harvested') tick(30);
    }
    finish('ByHand');

    chop(Math.max(0, 30 - wood()));
    finish('Lumber');

    build('Farm', { x: -1, y: 0 });
    finish('Farmhand');

    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(changeWorkers(state, map, farm.uniqueId, 1, now)).toBe('Assigned');
    finish('ToWork');

    // ---- step 13: one house holds two, so the second villager needs no second roof
    expect(maxPopulation(state)).toBeGreaterThanOrEqual(2);
    expect(queueTraining(state, now)).toBe('Queued');
    tick(60);
    expect(state.city.population).toBe(2);
    finish('Neighbors');

    // The player is now 14 beats in and has never been handed anything.
    expect(activeQuest(state)!.id).toBe('GrowingTown');

    // And the energy held out. Mana is what every tap is paid from, so an
    // opening that drains the pool is an opening that stops dead in front of
    // a player who has not yet been shown what refills it.
    expect(mana(state)).toBeGreaterThan(0);
  });

  // The rest of the chain is not playable in a unit test — it needs a Sawmill
  // running for minutes, an army, and a delve. What CAN be checked is the
  // thing most likely to be wrong: that every technology the chain demands is
  // still affordable out of what the chain itself pays, in the order it asks.
  it('never demands a technology the chain has not already paid for', () => {
    // Knowledge arrives two ways, and both are counted at their FLOOR:
    // a quest's authored reward, and the fog a DiscoverCells quest forces the
    // player to clear. A cleared cell pays its ring, and the nearest ring the
    // player can ever be standing at is 2 — the opening frontier, since the
    // Townhall's own radius already covers ring 1. Every later frontier is
    // further out and pays more, so 2 per cell is a floor that always holds.
    const CHEAPEST_CELL = 2;
    let purse = 0;
    for (const quest of QUESTS) {
      if (quest.goalType === 'CompleteTech') {
        const id = quest.goalTarget as TechId;
        expect(purse, `the chain asks for ${id} before it can afford it`)
          .toBeGreaterThanOrEqual(techCost(id));
        purse -= techCost(id);
      }
      if (quest.goalType === 'DiscoverCells') purse += quest.goalAmount * CHEAPEST_CELL;
      purse += quest.rewardKnowledge;
    }
  });
});

// A guard for the thing that made the old chain quietly unplayable: a quest
// asking the player to build something the Townhall has no room for.
describe('the chain never asks for a building the city cannot hold', () => {
  it('respects maxCountPerTownhallLevel at the Townhall level it is asked at', () => {
    let townhallLevel = 1;
    const built: Record<string, number> = {};
    for (const quest of QUESTS) {
      if (quest.goalType === 'UpgradeDistrict' && quest.goalTarget === 'Townhall') {
        townhallLevel = quest.goalLevel ?? townhallLevel;
      }
      if (quest.goalType !== 'BuildDistrict') continue;
      const id = quest.goalTarget as keyof typeof DISTRICTS;
      built[id] = quest.goalAmount;
      const caps = DISTRICTS[id].maxCountPerTownhallLevel;
      if (caps.length === 0) continue;
      const cap = caps[Math.min(townhallLevel, caps.length) - 1];
      expect(built[id], `${quest.id} wants ${built[id]} ${id} at Townhall ${townhallLevel}`)
        .toBeLessThanOrEqual(cap);
    }
  });
});
