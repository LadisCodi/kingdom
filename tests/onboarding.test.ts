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
import {
  CITY_DEF, DISTRICTS, FEATURES, FOG, HARVEST, QUESTS, TECHNOLOGIES,
} from '../src/sim/data/definitions';
import { advance, changeWorkers, enqueueBuild } from '../src/sim/commands';
import {
  explorationGate, fogState, isReachable, revealCostForCell, revealTap,
} from '../src/sim/fog';
import { placementBlock } from '../src/sim/districts';
import { collectTap } from '../src/sim/harvest';
import { sellGoods } from '../src/sim/market';
import { mana } from '../src/sim/mana';
import { newGame } from '../src/sim/newGame';
import { maxPopulation } from '../src/sim/population';
import { trainUnit } from '../src/sim/army';
import { activeQuest, claimQuest, isQuestComplete } from '../src/sim/quests';
import { isTechComplete, startTech, techCost } from '../src/sim/research';
import {
  coordKey, getWallet, parseCoordKey, type Coord, type CurrencyId, type DistrictId,
  type TechId,
} from '../src/sim/state';
import { BERRIES, FOREST, map, T0 } from './helpers';

const PLOT: Coord = { x: -1, y: 1 }; // open grass beside the Townhall, revealed at start
const PLOT_B: Coord = { x: -1, y: 0 }; // and its neighbour

describe('a player can actually play the onboarding', () => {
  it('runs steps 1-17 on nothing but what the game gives them', () => {
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
    const clear = (cell: Coord) => {
      let r: string = 'Paid';
      while (r === 'Paid') r = revealTap(state, map, cell);
      expect(r, `could not clear ${coordKey(cell)}`).toBe('Revealed');
    };
    /** Push the border outward the way a player does: whatever is cheapest
     *  and touching cleared ground. Derived, so moving a feature on the Map
     *  sheet cannot turn this into a test of nothing. */
    const clearNearest = (n: number) => {
      for (let i = 0; i < n; i++) {
        const next = [...map.terrain.keys()]
          .map(parseCoordKey)
          .filter((c) => fogState(state, map, c) === 'Discovered'
            && isReachable(state, map, c)
            && explorationGate(map, c) === null)
          .sort((a, b) => revealCostForCell(state, map, a) - revealCostForCell(state, map, b))[0];
        expect(next, 'the frontier ran out').toBeDefined();
        clear(next);
      }
    };
    const research = (id: TechId) => {
      expect(gold(), `cannot afford ${id}`).toBeGreaterThanOrEqual(techCost(id));
      expect(startTech(state, id, now)).toBe('Started');
      tick(TECHNOLOGIES[id].durationSeconds);
      expect(isTechComplete(state, id)).toBe(true);
    };
    // The forest cells the opening reveals, tapped round-robin so exhaustion
    // is waited out rather than assumed away.
    const TREES: Coord[] = [FOREST, { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 2 }];
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
    const build = (id: DistrictId, cell: Coord) => {
      expect(enqueueBuild(state, map, id, cell), `could not queue ${id}`).toBe('Started');
      tick(600); // long enough for anything this early
      expect(state.city.districts.some((d) => d.definitionId === id && d.state === 'Built'))
        .toBe(true);
    };

    // ---- steps 1-3: the fog pays for the one research that opens anything -
    expect(gold()).toBeGreaterThan(0); // the opening purse exists at all
    // Nothing on the map answers a tap yet. That is the whole opening.
    expect(collectTap(state, map, FOREST, now)).not.toBe('Harvested');
    expect(collectTap(state, map, BERRIES, now)).not.toBe('Harvested');

    // Quest 1 names the FOREST, so the border walks toward the trees rather
    // than in whatever direction the player happened to face — and the ground
    // it clears is the ground quest 3 then asks them to chop. These four are
    // every forest cell reachable from the opening block.
    for (const cell of [{ x: 0, y: 3 }, FOREST, { x: 3, y: 2 }, { x: 2, y: 3 }]) clear(cell);
    finish('FirstSteps');

    research('Forestry');
    finish('Woodcraft');

    // ---- steps 3-4: chop, then a roof ----
    // Trees exhaust after ten taps and take 90 s to come back, so this is a
    // few cells and a little patience — exactly the friction step 15 later
    // sells the Sawmill against.
    chop(QUESTS.find((q) => q.id === 'Timber')!.goalAmount);
    finish('Timber');

    expect(wood()).toBeGreaterThanOrEqual(DISTRICTS.Housing.buildCost.Wood!);
    build('Housing', { x: 2, y: 0 });
    finish('ARoof');

    // ---- steps 5-6: a meal, and the neighbour the roof permits ----
    // The bush is on the other side of the Townhall from the woods, so this
    // is the first time the border goes the other way. The quest's own arrow
    // points at it — a Discovered cell counts for that hint, which is why it
    // can point at a bush still under the fog.
    clear(BERRIES);
    for (let i = 0; i < 5; i++) expect(collectTap(state, map, BERRIES, now)).toBe('Harvested');
    finish('Rations');

    expect(maxPopulation(state)).toBeGreaterThanOrEqual(1); // the House, not the Townhall
    expect(trainUnit(state, 'Villager', T0)).toBe('Queued');
    tick(60);
    expect(state.city.population).toBe(1);
    finish('FirstVillager');

    // ---- step 7: rent, which is what pays for more fog ----
    const beforeTax = gold();
    tick(120); // one housed villager × 30/min
    expect(gold()).toBeGreaterThanOrEqual(beforeTax + 30);
    finish('TaxDay');

    // ---- steps 7-8: back out into the country ----
    clearNearest(QUESTS.find((q) => q.id === 'Explorer')!.goalAmount);
    finish('Explorer');

    // ---- steps 9-12: farming, by hand and then not ----
    research('Agriculture');
    finish('Fields');

    // Step 10 asks for TWO plots: enough Food to keep a growing town fed
    // without tapping the single bush forever. The second plot is priced on
    // the per-instance curve (10 then 45 Wood), so the player chops for it —
    // the chain does not hand them the Wood until the NEXT beat.
    chop(Math.max(0, 55 - wood()));
    build('FarmLands', PLOT);
    build('FarmLands', PLOT_B);
    finish('FirstPlot');

    while (getWallet(state.city.wallet, 'Food') < 20) {
      let any = false;
      for (const plot of [PLOT, PLOT_B]) {
        if (collectTap(state, map, plot, now) === 'Harvested') any = true;
      }
      if (!any) tick(30);
    }
    finish('ByHand');

    chop(Math.max(0, 30 - wood()));
    finish('Lumber');

    build('Farm', { x: -2, y: 0 });
    finish('Farmhand');

    const farm = state.city.districts.find((d) => d.definitionId === 'Farm')!;
    expect(changeWorkers(state, map, farm.uniqueId, 1, now)).toBe('Assigned');
    finish('ToWork');

    // ---- steps 13-15: somewhere for the surplus to go ----
    // The Market moved here from quest 32 so that generated orders have a home
    // inside the opening (habit-loop.md §2). This is the beat that has to hold
    // up: 150 Gold for the technology and 40 Wood for the building, out of
    // nothing but what the chain has paid so far.
    //
    // Research, then build, then use — the same three-beat shape the chain
    // uses for every other building worth explaining.
    research('Market');
    finish('Trade');
    chop(Math.max(0, DISTRICTS.Market.buildCost.Wood! - wood()));
    // Found rather than authored, like `clearNearest` above: a hardcoded cell
    // is a test that breaks when the map is re-authored, and this beat is
    // about affording the Market, not about where it goes.
    const spot = [...map.terrain.keys()].map(parseCoordKey)
      .find((c) => placementBlock(state, map, 'Market', c) === null);
    expect(spot, 'nowhere legal to put the Market').toBeDefined();
    build('Market', spot!);
    finish('ToMarket');

    // And there has to be something to sell. Whatever the plots and the trees
    // have piled up, sold down to the twenty the quest asks for.
    let sold = 0;
    let guard = 0;
    while (sold < 20) {
      expect(guard++, 'nothing left to sell').toBeLessThan(200);
      for (const c of ['Food', 'Wood'] as CurrencyId[]) {
        if (sold >= 20) break;
        const { result, units } = sellGoods(state, c, 20 - sold);
        if (result === 'Sold') sold += units;
      }
      if (sold < 20) tick(30); // let the plots and the forest come back
    }
    finish('Merchant');

    // ---- steps 16-17: a second House, and the villager it makes room for ----
    chop(Math.max(0, DISTRICTS.Housing.buildCost.Wood! * 3 - wood()));
    build('Housing', { x: 0, y: -1 });
    finish('GrowingTown');

    // Two L1 houses hold four; the chain asks for three, so the new roof is
    // what the villager needed.
    expect(maxPopulation(state)).toBeGreaterThanOrEqual(3);
    while (state.city.population < 3) {
      if (trainUnit(state, 'Villager', T0) !== 'Queued') tick(30); // Food comes off the plots
      tick(30);
    }
    finish('Neighbors');

    // The player is now seventeen beats in and has never been handed anything.
    expect(activeQuest(state)!.id).toBe('ProperCapital');

    // And the energy held out. Mana is what every tap is paid from, so an
    // opening that drains the pool is an opening that stops dead in front of
    // a player who has not yet been shown what refills it.
    expect(mana(state)).toBeGreaterThan(0);
  });

  // The rest of the chain is not playable in a unit test — it needs a Sawmill
  // running for minutes, an army, and a delve. What CAN be checked is the
  // thing most likely to be wrong: that every technology the chain demands is
  // still affordable out of what the chain itself pays, in the order it asks.
  it('never demands an OPENING technology the chain has not already paid for', () => {
    // Research is Gold now, so the purse counted here is the CITY's, and it
    // is counted at its floor: the opening grant plus the quest rewards, and
    // nothing else. Housing taxes, the Market and the harvest all pay on top
    // of this, so a chain that works on rewards alone works for anyone.
    //
    // THE GUARANTEE COVERS THE OPENING — every era-1 technology and the
    // keystone that closes era 1 — and stops there on purpose. Since the tree
    // was repriced to tech-tree.md §6's bands (2026-09-04) an era-2 major
    // costs 1,000–2,500 Gold, and the chain's later asks (Sailing, Scaling
    // Tools, Surveying II) are meant to be paid out of a RUNNING city: by
    // then the player has a Market, taxes and workers, and the doc's own
    // words are "the depth is the city's to earn". Funding them from rewards
    // would mean 1,000-Gold quests at beat 25, which would double the early
    // economy — the exact distortion balancing-v3 pulled the Market beats back
    // from.
    //
    // Fog is charged against the same purse, at its floor too — a
    // DiscoverCells quest cannot cost less than its cells at the nearest ring
    // the player can ever be standing at, which is 2 (the Townhall's own
    // radius already covers ring 1).
    const DEAREST_CELL = FOG.rings[1].cost;
    let purse = CITY_DEF.initialCurrencies.Gold ?? 0;
    for (const quest of QUESTS) {
      if (quest.goalType === 'CompleteTech') {
        const id = quest.goalTarget as TechId;
        const opening = TECHNOLOGIES[id].era === 1 || /^(Charter|Warband|Attunement)II$/.test(id);
        if (opening) {
          expect(purse, `the chain asks for ${id} before it can afford it`)
            .toBeGreaterThanOrEqual(techCost(id));
          purse -= techCost(id);
        }
      }
      if (quest.goalType === 'DiscoverCells' || quest.goalType === 'DiscoverFeature') {
        purse -= quest.goalAmount * DEAREST_CELL;
      }
      purse += quest.reward.Gold ?? 0;
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

// Every rock and every iron vein now sits on MOUNTAIN terrain, which cannot be
// revealed — and so cannot be tapped or worked — until Scaling Tools. That
// makes Stone and Iron mid-game materials, and it makes the chain's ORDER
// load-bearing in a way it was not before: a quest asking for a building
// priced in Stone before that research is a wall the player cannot see coming.
//
// Derived from the map's own terrain rather than a hand-written list, so
// moving a feature onto or off a mountain re-checks the whole chain by itself.
describe('the chain never asks for a material the map cannot yet yield', () => {
  it('orders every gated material cost after the research that opens it', () => {
    // currency -> the tech you need before ANY cell yields it. A single
    // ungated cell anywhere means no gate at all.
    const gate = new Map<string, TechId | null>();
    for (const [key, feature] of map.initialFeatures) {
      const source = FEATURES[feature].source;
      if (source === null) continue;
      const currency = HARVEST[source].currencyId;
      const terrain = map.terrain.get(key);
      const tech: TechId | null = terrain === 'Mountain' ? 'ScalingTools'
        : terrain === 'Water' ? 'Sailing' : null;
      if (tech === null || gate.get(currency) === null) gate.set(currency, null);
      else if (!gate.has(currency)) gate.set(currency, tech);
    }

    const unlockedAt = (tech: TechId) =>
      QUESTS.findIndex((q) => q.goalType === 'CompleteTech' && q.goalTarget === tech);

    QUESTS.forEach((quest, i) => {
      const id = quest.goalTarget as keyof typeof DISTRICTS;
      const cost = quest.goalType === 'BuildDistrict' ? DISTRICTS[id].buildCost
        : quest.goalType === 'UpgradeDistrict' ? DISTRICTS[id].upgradeCost
          : null;
      if (cost === null) return;
      for (const currency of Object.keys(cost)) {
        const tech = gate.get(currency);
        if (tech === undefined || tech === null) continue;
        const at = unlockedAt(tech);
        expect(at, `${quest.id} needs ${currency}, and no quest researches ${tech}`)
          .toBeGreaterThanOrEqual(0);
        expect(at, `${quest.id} (q${i + 1}) needs ${currency}, behind ${tech} at q${at + 1}`)
          .toBeLessThan(i);
      }
    });
  });
});
