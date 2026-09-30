// Minor RANKS: the ladders that used to be levelled upgrades. Their gating,
// their cost curve, and the effective-value helpers actually changing sim
// behaviour. See Docs/features/tech-tree.md §1 rule 2.
import { describe, expect, it } from 'vitest';
import {
  ARMY, DELVE, DISTRICTS, HARVEST, KNOWLEDGE, LANDMARKS, TECHNOLOGIES,
  TECH_ORDER, WORKER, levelIndexed,
} from '../src/sim/data/definitions';
import { effectiveDiscoverRadius } from '../src/sim/fog';
import { collectTap, effectiveRecoveryMs } from '../src/sim/harvest';
import { getWallet } from '../src/sim/state';
import { researchTech } from '../src/sim/commands';
import { canStartTech, pourKnowledge, techKnowledgeCost } from '../src/sim/research';
import {
  effectiveAutoTapCooldownMs, effectiveBuildTimeMultiplier,
  effectiveTaxRate, effectiveUnitsPerStrike, effectiveWorkerSpeed, effectiveWorkerStrike,
  strikeDraw, tapDraw, tapWorkSeconds,
} from '../src/sim/upgrades';
import { storageCapacity } from '../src/sim/storage';
import { queuedWorkMs } from '../src/sim/workshops';
import { callStardust } from '../src/sim/heroes';
import { TECH_STATS } from '../src/sim/data/techEffectRules';
import { buildDuration, maxDistrictCount, requiredTechForLevel, upgradeDuration } from '../src/sim/districts';
import { armyCap, trainSecondsAt, woundedCap } from '../src/sim/army';
import { drillOf, partyBoard, partyOf } from '../src/sim/expeditions';
import { partyStats, typeMultiplier } from '../src/sim/combat';
import type { GameState, TechId } from '../src/sim/state';
import { addHeroXp } from '../src/sim/heroes';
import { manaCap, manaProduction } from '../src/sim/mana';
import {
  firstClearLump, knowledgeHeld, knowledgeLump, landmarkClaimLump, territoryKnowledge,
} from '../src/sim/knowledge';
import {
  addBuilt, bonusLadders, canGather, completeRanks, completeRequirements, completeTech, FOREST, freshGame, fund, ladders, map, openEveryEra, rankOf, stored, T0, tickAt,
} from './helpers';


/** Research one rank end to end, through the real commands — pour, then pay
 *  — the way the sheet's two presses do. A rank takes no time. */
const research = (state: ReturnType<typeof freshGame>, id: TechId) => {
  pourKnowledge(state, id);
  return researchTech(state, map, id, T0);
};

describe('researching a rank', () => {
  it('costs Gold and Knowledge and no time — the opening rank as authored, the later ones on the bands', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Knowledge: 10 });
    completeRequirements(state, 'TapPowerI');
    expect(TECHNOLOGIES.TapPowerI.cost.Gold).toBe(50);
    expect(TECHNOLOGIES.TapPowerII.cost.Gold).toBeGreaterThanOrEqual(250);
    expect(TECHNOLOGIES.TapPowerII.cost.Gold).toBeLessThanOrEqual(800);
    expect(techKnowledgeCost('TapPowerI')).toBeGreaterThan(0);
    expect('durationSeconds' in TECHNOLOGIES.TapPowerI).toBe(false);

    expect(research(state, 'TapPowerI')).toBe('Researched');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(950);
    expect(knowledgeHeld(state)).toBe(10 - techKnowledgeCost('TapPowerI'));
    // Landed on the press, with no clock to run.
    expect(rankOf(state, 'TapPower')).toBe(1);
  });

  // WHICH card a ladder hangs off is content — a drag in `?dev=tree`. That
  // it hangs off one, and is refused until that one is researched, is not.
  it('hangs off its parent technology in the tree', () => {
    const state = freshGame();
    fund(state, { Gold: 1000, Knowledge: 500 });
    for (const ladder of bonusLadders) {
      // A book's first row is its roots: those start with nothing done.
      if (TECHNOLOGIES[ladders[ladder][0]].requires.length === 0) continue;
      expect(research(state, ladders[ladder][0]),
        `${ladder} I researches with nothing researched`).not.toBe('Researched');
    }
    completeRequirements(state, 'TapPowerI');
    expect(research(state, 'TapPowerI')).toBe('Researched');
  });

  it('rejects when poor, and runs out of ranks at the top of the ladder', () => {
    const state = freshGame();
    fund(state, { Gold: 0, Knowledge: 10 });
    completeRequirements(state, 'TapPowerI');
    expect(research(state, 'TapPowerI')).toBe('NotEnoughGold');
    openEveryEra(state);
    fund(state, { Gold: 1_000_000, Knowledge: 1_000_000 });
    for (const id of ladders.TapPower) {
      for (const req of TECHNOLOGIES[id].requires) completeTech(state, req);
      expect(research(state, id), id).toBe('Researched');
    }
    expect(rankOf(state, 'TapPower')).toBe(ladders.TapPower.length);
    for (const id of ladders.TapPower) expect(canStartTech(state, id)).toBe(false);
  });
});

describe('effects reach the sim', () => {
  it('TapPower buys the tap DURATION, and the carry pays out the fraction', () => {
    const state = freshGame();
    fund(state, { Gold: 100_000 });
    canGather(state);
    const bare = tapWorkSeconds(state);
    completeRanks(state, 'TapPower', 4); // +20% a rank
    expect(tapWorkSeconds(state)).toBeCloseTo(bare * 1.8, 6);

    // A Forest strike is 10 s, so the thumb owes 1.8 Wood a tap — it takes
    // one and the remainder rides in `tapCarry` until it adds up, which is
    // what makes a percentage upgrade honest.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood'))
      .toBe(Math.floor(tapWorkSeconds(state) / HARVEST.Forest.secondsPerStrike));
  });

  // QuickHands is a SPEED on the gap between AUTO-taps: the cooldown is
  // divided by it, so it only ever climbs and never reaches zero.
  it('QuickHands speeds the auto-tap, and nothing else', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    completeTech(state, 'Forestry');
    expect(effectiveAutoTapCooldownMs(state)).toBe(500);

    completeRanks(state, 'QuickHands', 1); // +15%
    expect(effectiveAutoTapCooldownMs(state)).toBeCloseTo(500 / 1.15);

    completeRanks(state, 'QuickHands', ladders.QuickHands.length);
    expect(rankOf(state, 'QuickHands')).toBe(ladders.QuickHands.length);
    expect(effectiveAutoTapCooldownMs(state))
      .toBeCloseTo(500 / (1 + 0.15 * ladders.QuickHands.length));
  });

  it('QuickHands never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    completeRanks(state, 'QuickHands', ladders.QuickHands.length);
    const wait = effectiveAutoTapCooldownMs(state);

    // Manual taps ignore the cooldown entirely, finished ladder or not.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    // A held repeat still waits, just less than it used to.
    expect(collectTap(state, map, FOREST, T0 + 2, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + 1 + Math.ceil(wait), true)).toBe('Harvested');
  });

  it('TradeRoutes boosts the passive tax rate', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1;
    fund(state, { Gold: 1000 });
    completeRequirements(state, 'TradeRoutesI');
    const bare = effectiveTaxRate(state);
    completeRanks(state, 'TradeRoutes', 1); // +5%
    expect(effectiveTaxRate(state)).toBeCloseTo(bare * 1.05);
    tickAt(state, T0 + 301_000); // ~5 minutes of it
    const perMinute = effectiveTaxRate(state, 'Housing');
    // The helper grants the rank without charging for it — the point under
    // test is the tax rate, not the price of the research.
    expect(stored(state, 'Gold')).toBe(Math.floor(perMinute * 301 / 60));
  });
});

// The only thing worth asserting about a line is that it REACHES the sim: a
// definition with no consumer is a price tag on nothing. So each of these
// researches a rank and measures the number the player actually experiences,
// never the effect table.
describe('every ladder reaches the number it claims to', () => {
  // A rank missing from the tree is invisible IN THE GAME while still being
  // purchasable by id.
  it('shows every authored rank somewhere in the tree', () => {
    for (const ladder of bonusLadders) {
      const ranks = ladders[ladder];
      expect(ranks.length, `${ladder} has no ranks`).toBeGreaterThan(0);
      for (const id of ranks) {
        expect(TECH_ORDER, `${ladder} rank ${id} is not in TECH_ORDER`).toContain(id);
      }
    }
  });

  // EVERY BONUS CLIMBS (Docs/features/22-progression.md §9): no rank shrinks a
  // number, and no rank discounts anything.
  it('never shrinks a number and never discounts a price', () => {
    for (const id of TECH_ORDER) {
      for (const e of TECHNOLOGIES[id].effects) {
        expect(e.value, `${id} moves ${e.stat} by ${e.value}`).toBeGreaterThan(0);
        expect(e.stat, `${id} discounts`).not.toMatch(/Cost$/);
      }
    }
    for (const stat of Object.keys(TECH_STATS)) expect(stat).not.toMatch(/Cost$|Time$/);
  });

  // The yield ladders are ABUNDANCE OF THE GROUND, so they lift the thumb and
  // the crew alike — both draw the same depot — and each is a PERCENT of that
  // ground's own chunk, so a rank is worth the same share early and late.
  const YIELD_LADDERS: Array<[string, keyof typeof HARVEST]> = [
    ['Sawpits', 'Forest'], ['Irrigation', 'Crops'], ['Stonecutting', 'Stone'],
    ['Butchery', 'Meat'], ['IronPicks', 'MountainIron'], ['GoldPanning', 'MountainGold'],
    ['BigNets', 'Fish'],
  ];
  for (const [ladder, source] of YIELD_LADDERS) {
    it(`${ladder} is a share more ${source} for hand AND crew, and nothing else`, () => {
      const state = freshGame();
      const other = source === 'Forest' ? HARVEST.Crops : HARVEST.Forest;
      const chunk = effectiveUnitsPerStrike(state, HARVEST[source]);
      const crew = effectiveWorkerStrike(state, HARVEST[source]);
      const elsewhere = effectiveUnitsPerStrike(state, other);
      const ranks = ladders[ladder].length;
      completeRanks(state, ladder, ranks); // +10% a rank
      expect(effectiveUnitsPerStrike(state, HARVEST[source])).toBeCloseTo(chunk * (1 + 0.1 * ranks));
      expect(effectiveWorkerStrike(state, HARVEST[source])).toBeCloseTo(crew * (1 + 0.1 * ranks));
      expect(effectiveUnitsPerStrike(state, other)).toBe(elsewhere); // scoped
    });
  }

  it('WorkerLoad is the one payroll-only dial — the crew, never the thumb', () => {
    const state = freshGame();
    const wood = effectiveWorkerStrike(state, HARVEST.Forest);
    const byHand = tapDraw(state, HARVEST.Forest, 0);
    completeRanks(state, 'WorkerLoad', 2);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBeCloseTo(wood * 1.2);
    expect(tapDraw(state, HARVEST.Forest, 0)).toBe(byHand);
  });

  // A percentage of a one-unit chunk is a fraction, and the crew CARRIES it:
  // a strike takes whole units and keeps the rest, so ten strikes at 1.1
  // bring home eleven.
  it('a crew carries the fraction a yield bonus owes it, and the average is exact', () => {
    const state = freshGame();
    completeRanks(state, 'Sawpits', 1); // 1.1 a strike
    let carry = 0;
    let home = 0;
    for (let i = 0; i < 10; i++) {
      const { want, rest } = strikeDraw(state, HARVEST.Forest, null, carry);
      expect(rest).toBeGreaterThanOrEqual(0);
      expect(rest).toBeLessThan(1);
      home += want;
      carry = rest;
    }
    expect(home).toBe(11);
  });

  it('TapPower buys DURATION, so it never mints and never goes stale', () => {
    const state = freshGame();
    const seconds = tapWorkSeconds(state);
    completeRanks(state, 'TapPower', 4); // +20% a rank
    expect(tapWorkSeconds(state)).toBeCloseTo(seconds * 1.8, 6);
    expect(tapDraw(state, HARVEST.Forest, 0))
      .toBeCloseTo(tapWorkSeconds(state) / HARVEST.Forest.secondsPerStrike, 6);
  });

  // Regrowth is a SPEED: the stump's wait is divided by it.
  it('Reforesting and Crop Rotation speed their own regrowth, and nothing else', () => {
    const state = freshGame();
    const at = { x: 0, y: 0 };
    const forest = effectiveRecoveryMs(state, HARVEST.Forest, at);
    const crops = effectiveRecoveryMs(state, HARVEST.Crops, at);
    completeRanks(state, 'Reforesting', 2); // +20%
    expect(effectiveRecoveryMs(state, HARVEST.Forest, at)).toBe(Math.round(forest / 1.2));
    expect(effectiveRecoveryMs(state, HARVEST.Crops, at)).toBe(crops);
    completeRanks(state, 'CropRotation', 1);
    expect(effectiveRecoveryMs(state, HARVEST.Crops, at)).toBe(Math.round(crops / 1.1));
  });

  it('Granaries hold more in every store', () => {
    const state = freshGame();
    addBuilt(state, 'Sawmill', { x: 3, y: 1 });
    const mill = state.city.districts.at(-1)!;
    const cap = storageCapacity(state, mill);
    expect(cap).toBeGreaterThan(0);
    completeRanks(state, 'Granaries', 2); // +20%
    expect(storageCapacity(state, mill)).toBe(Math.floor(cap * 1.2));
  });

  // Every line hangs off a major technology, and rank I is unreachable before
  // it. A line rooted at nothing would float free of the tree entirely.
  it('is locked behind the technology its ladder hangs off', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    for (const ladder of bonusLadders) {
      const first = ladders[ladder][0];
      // A book's first row is its roots: those start with nothing done.
      if (TECHNOLOGIES[first].requires.length === 0) continue;
      expect(canStartTech(state, first), `${ladder} I starts with no research`).toBe(false);
    }
  });
});

describe('the city lines reach their numbers', () => {
  it('Carpentry speeds a build and an upgrade, and never reaches an instant one', () => {
    const state = freshGame();
    const build = buildDuration(state, 'Housing', 0, 2);
    const up = upgradeDuration(state, 'Farm', 1);
    completeRanks(state, 'Carpentry', 2); // +20% speed
    const within = (got: number, want: number) => {
      expect(got).toBeGreaterThanOrEqual(Math.floor(want));
      expect(got).toBeLessThanOrEqual(Math.ceil(want));
    };
    within(buildDuration(state, 'Housing', 0, 2), build / 1.2);
    within(upgradeDuration(state, 'Farm', 1), up / 1.2);
    expect(effectiveBuildTimeMultiplier(state)).toBeCloseTo(1 / 1.2);
    completeRanks(state, 'Carpentry', ladders.Carpentry.length);
    expect(effectiveBuildTimeMultiplier(state)).toBeGreaterThan(0);
  });

  it('Cartage speeds the walk, and the nominal gather rate with it', () => {
    const state = freshGame();
    expect(effectiveWorkerSpeed(state)).toBe(WORKER.moveSpeedTilesPerSecond);
    completeRanks(state, 'Cartage', 3); // +30%
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(WORKER.moveSpeedTilesPerSecond * 1.3);
  });

  it('Schooling trains villagers faster, and soldiers not at all', () => {
    const state = freshGame();
    const th = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const barracks = state.city.districts.at(-1)!;
    const villager = trainSecondsAt(state, th.uniqueId, 'Villager');
    const warrior = trainSecondsAt(state, barracks.uniqueId, 'Warrior');
    completeRanks(state, 'Schooling', 2); // +40%
    expect(trainSecondsAt(state, th.uniqueId, 'Villager')).toBe(Math.max(1, Math.round(villager / 1.4)));
    expect(trainSecondsAt(state, barracks.uniqueId, 'Warrior')).toBe(warrior);
  });

  it('Guild Halls speed every workshop', () => {
    const state = freshGame();
    addBuilt(state, 'Carpenter', { x: 3, y: 1 });
    const shop = state.city.districts.at(-1)!;
    const need = queuedWorkMs(state, shop, 'Planks');
    completeRanks(state, 'GuildHalls', 2); // +20%
    expect(queuedWorkMs(state, shop, 'Planks')).toBe(Math.max(1000, Math.round(need / 1.2)));
  });
});

describe('the Magic lines reach their numbers', () => {
  it('Deep Wells raises the whole Mana ceiling, and only the ceiling', () => {
    const state = freshGame();
    state.landmarks.claimed[LANDMARKS[0].id] = true;
    const cap = manaCap(state);
    const rate = manaProduction(state);
    completeRanks(state, 'DeepWells', 3); // +30%, landmarks included
    expect(manaCap(state)).toBe(Math.round(cap * 1.3));
    expect(manaProduction(state)).toBe(rate);
  });

  it('Ley Taps raises the rate, and only the rate', () => {
    const state = freshGame();
    const base = manaProduction(state);
    const cap = manaCap(state);
    completeRanks(state, 'LeyTaps', 2); // +20%
    expect(manaProduction(state)).toBeCloseTo(base * 1.2);
    expect(manaCap(state)).toBe(cap);
  });

  it('Meditation is a fifth more Mana', () => {
    const state = freshGame();
    const cap = manaCap(state);
    completeTech(state, 'Meditation');
    expect(manaCap(state)).toBe(Math.round(cap * 1.2));
  });

  it('Scriptorium is a percentage on every lump, rounded', () => {
    const state = freshGame();
    expect(knowledgeLump(state, 100)).toBe(100);
    completeRanks(state, 'Scriptorium', 2); // +20%
    expect(knowledgeLump(state, 100)).toBe(120);
    expect(knowledgeLump(state, 15)).toBe(Math.round(15 * 1.2));
    expect(knowledgeLump(state, 0)).toBe(0);
  });
});

// Knowledge from the ground is LUMPS (07-research.md §3): Wayposts (the
// Atlas) raise what a landmark claim pays, Bounties (Warfare) what a lair pays.
describe('the lump lines reach their numbers', () => {
  it('Wayposts and Bounties each raise their own lump of Knowledge', () => {
    const state = freshGame();
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump);
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
    completeRanks(state, 'Wayposts', 1); // +20% a claim
    expect(landmarkClaimLump(state)).toBe(Math.round(KNOWLEDGE.landmarkClaimLump * 1.2));
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
    completeRanks(state, 'Bounties', 2); // +40% a clear
    expect(firstClearLump(state)).toBe(Math.round(DELVE.firstClearKnowledge * 1.4));
  });

  // Researching a lump raise late must never cost what researching it early
  // would have paid: the command pays the raise back for every site held.
  describe('a lump raise is paid back for the ground already held', () => {
    const holding = () => {
      const state = freshGame();
      openEveryEra(state);
      state.landmarks.claimed[LANDMARKS[0].id] = true;
      state.landmarks.claimed[LANDMARKS[1].id] = true;
      state.lairs.Orcs = { armedAt: 0, nextRaidAt: null, hoard: {}, defeated: true, cleared: true };
      fund(state, { Gold: 99_999, Knowledge: 10 });
      return state;
    };
    const payback = (id: TechId) => {
      const state = holding();
      completeRequirements(state, id);
      const before = territoryKnowledge(state);
      const held = knowledgeHeld(state);
      expect(research(state, id)).toBe('Researched');
      const raise = territoryKnowledge(state) - before;
      expect(knowledgeHeld(state)).toBe(held - techKnowledgeCost(id) + raise);
      return raise;
    };

    it('Wayposts pays its raise for each landmark already claimed', () => {
      expect(payback('WaypostsI')).toBe(2 * (Math.round(KNOWLEDGE.landmarkClaimLump * 1.2)
        - KNOWLEDGE.landmarkClaimLump));
    });

    it('Bounties pays its raise for each lair already cleared', () => {
      expect(payback('BountiesI')).toBe(Math.round(DELVE.firstClearKnowledge * 1.2)
        - DELVE.firstClearKnowledge);
    });

    it('Scriptorium pays its percentage on the lumps already earned', () => {
      expect(payback('ScriptoriumI')).toBeGreaterThan(0);
    });

    it('pays nothing back when the research is refused', () => {
      const state = holding();
      completeRequirements(state, 'WaypostsI');
      fund(state, { Gold: 0 });
      const held = knowledgeHeld(state);
      pourKnowledge(state, 'WaypostsI');
      expect(researchTech(state, map, 'WaypostsI', T0)).toBe('NotEnoughGold');
      expect(knowledgeHeld(state)).toBe(held - techKnowledgeCost('WaypostsI'));
    });

    it('pays nothing back with no ground held', () => {
      const state = freshGame();
      fund(state, { Gold: 99_999, Knowledge: 10 });
      completeRequirements(state, 'WaypostsI');
      expect(research(state, 'WaypostsI')).toBe('Researched');
      expect(knowledgeHeld(state)).toBe(10 - techKnowledgeCost('WaypostsI'));
    });
  });
});

describe('the Warfare lines reach their numbers', () => {
  it('Colours is a share of what the halls can field, and nothing to a kingdom with no hall', () => {
    const state = freshGame();
    completeRanks(state, 'Colours', 3); // +30%
    expect(armyCap(state), 'a banner is not a barracks').toBe(0);
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const halls = levelIndexed(DISTRICTS.Barracks.armyCapPerLevel, 1);
    expect(armyCap(state)).toBe(Math.round(halls * 1.3));
  });

  it('Drill Yards train soldiers faster, and villagers not at all', () => {
    const state = freshGame();
    const th = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const barracks = state.city.districts.at(-1)!;
    const warrior = trainSecondsAt(state, barracks.uniqueId, 'Warrior');
    const villager = trainSecondsAt(state, th.uniqueId, 'Villager');
    completeRanks(state, 'DrillYards', 2); // +30%
    expect(trainSecondsAt(state, barracks.uniqueId, 'Warrior')).toBe(Math.max(1, Math.round(warrior / 1.3)));
    expect(trainSecondsAt(state, th.uniqueId, 'Villager')).toBe(villager);
  });

  it('Beds are a share more room in the Infirmary', () => {
    const state = freshGame();
    addBuilt(state, 'Infirmary', { x: 3, y: 1 });
    const beds = woundedCap(state);
    expect(beds).toBeGreaterThan(0);
    completeRanks(state, 'Beds', 2); // +40%
    expect(woundedCap(state)).toBe(Math.floor(beds * 1.4));
  });
});

describe('the Sagas lines reach their numbers', () => {
  it('Tales pays a hero more XP for the same grant', () => {
    const state = freshGame();
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(20);
    completeRanks(state, 'Tales', 2); // +20%
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(44);
  });

  it('the Tavern adds its own share, by level', () => {
    const state = freshGame();
    addBuilt(state, 'Tavern', { x: 3, y: 1 });
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(22); // +10% at L1
  });

  it('Warm Welcome pays more Stardust on every call', () => {
    const state = freshGame();
    const base = callStardust(state, 'basic');
    completeRanks(state, 'WarmWelcome', 2); // +20%
    expect(callStardust(state, 'basic')).toBe(Math.round(base * 1.2));
  });
});

// The combat lines: combat.ts is pure, so these are carried in on the Party
// as a Drill — asserted through the numbers a fight is decided by. Every one
// is a PERCENT of the unit's own number.
describe('the combat lines reach the fight', () => {
  const melee = (state: GameState) =>
    partyStats(partyOf(state, [{ unitId: 'Warrior', count: 20 }]));
  const ranged = (state: GameState) =>
    partyStats(partyOf(state, [{ unitId: 'Archer', count: 20 }]));

  it('Shield Wall hardens Melee and leaves Distance alone', () => {
    const state = freshGame();
    const m0 = melee(state).def; const r0 = ranged(state).def;
    completeRanks(state, 'ShieldWall', 2); // +20% DEF
    expect(melee(state).def).toBeGreaterThan(m0);
    expect(ranged(state).def).toBe(r0);
  });

  it('Fletching sharpens Distance and leaves Melee alone', () => {
    const state = freshGame();
    const m0 = melee(state).atk; const r0 = ranged(state).atk;
    completeRanks(state, 'Fletching', 1); // +10%
    expect(ranged(state).atk).toBeGreaterThan(r0);
    expect(melee(state).atk).toBe(m0);
  });

  it('Barding armours Mounted — Cavalry is Mounted AND Melee, so it takes both', () => {
    const state = freshGame();
    const cav = () => partyStats(partyOf(state, [{ unitId: 'Cavalry', count: 20 }])).def;
    const c0 = cav();
    completeRanks(state, 'Barding', 1);
    const c1 = cav();
    expect(c1).toBeGreaterThan(c0);
    completeRanks(state, 'ShieldWall', 1);
    expect(cav()).toBeGreaterThan(c1);
  });

  it('Warhorns lifts every unit, and reaches the swing itself', () => {
    const state = freshGame();
    const slots = [{ unitId: 'Warrior' as const, count: 3 }];
    const before = partyBoard(partyOf(state, slots)).slots[0]!.dmg;
    completeRanks(state, 'Warhorns', 4); // +20%
    expect(partyBoard(partyOf(state, slots)).slots[0]!.dmg).toBeGreaterThan(before);
  });

  it('Vigour is a share more health for every unit', () => {
    const state = freshGame();
    const hp = melee(state).hp;
    completeRanks(state, 'Vigour', 2); // +10%
    expect(melee(state).hp).toBeGreaterThan(hp);
  });
});

// Farsight, the one hook with a DISCRETE effect at completion.
describe('Farsight reaches the fog', () => {
  const ready = () => {
    const s = freshGame();
    fund(s, { Gold: 99_999, Knowledge: 10 });
    completeRequirements(s, 'FarsightI');
    openEveryEra(s);
    return s;
  };

  it('widens how far a building marks the fog, and re-discovers around standing ones', () => {
    const state = ready();
    const before = Object.keys(state.fog.discovered).length;
    expect(effectiveDiscoverRadius(state, 2)).toBe(2);

    expect(research(state, 'FarsightI')).toBe('Researched');

    expect(effectiveDiscoverRadius(state, 2)).toBe(3);
    expect(Object.keys(state.fog.discovered).length, 'the Townhall should see farther now')
      .toBeGreaterThan(before);
  });

  it('re-discovers at completion, not later', () => {
    const viaCommand = ready();
    research(viaCommand, 'FarsightI');
    const byHand = ready();
    completeRanks(byHand, 'Farsight', 1);
    expect(effectiveDiscoverRadius(byHand, 2)).toBe(3);
    expect(Object.keys(byHand.fog.discovered).length)
      .toBeLessThan(Object.keys(viaCommand.fog.discovered).length);
  });
});

describe('the majors that are live', () => {
  it('Aqueducts lets Housing reach level 3 with a third tier of beds', () => {
    expect(requiredTechForLevel('Housing', 3)).toBe('Aqueducts');
    expect(requiredTechForLevel('Housing', 4)).toBe(null);
    expect(levelIndexed(DISTRICTS.Housing.populationCapacityPerLevel, 3))
      .toBeGreaterThan(levelIndexed(DISTRICTS.Housing.populationCapacityPerLevel, 2));
  });

  it('Second Sanctum lets one more of its district stand', () => {
    const state = freshGame();
    const sanctum = maxDistrictCount(state, DISTRICTS.Sanctum);
    completeTech(state, 'SecondSanctum');
    expect(maxDistrictCount(state, DISTRICTS.Sanctum)).toBe(sanctum + 1);
  });

  it('Roadworks is a quarter faster, and adds to Cartage', () => {
    const state = freshGame();
    const base = effectiveWorkerSpeed(state);
    state.research.completed.push('Roadworks');
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(base * 1.25);
    completeRanks(state, 'Cartage', 1);
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(base * 1.35);
  });

  it('Tactics takes a tenth off a bad matchup, through the Drill', () => {
    const state = freshGame();
    completeTech(state, 'Tactics');
    expect(drillOf(state).disadvantageOffset).toBeCloseTo(0.10);
    expect(typeMultiplier('Warrior', 'Archer', drillOf(state).disadvantageOffset))
      .toBeCloseTo(ARMY.typeDisadvantage + 0.10);
  });

  it('the Tavern is opened by Hospitality, and its levels by the Sagas', () => {
    expect(DISTRICTS.Tavern.requiredTech).toBe('Hospitality');
    for (const level of [2, 3, 4, 5]) {
      expect(TECHNOLOGIES[requiredTechForLevel('Tavern', level)!].tome).toBe('Sagas');
    }
  });
});
