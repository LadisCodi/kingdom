// Minor RANKS: the ladders that used to be levelled upgrades. Their gating,
// their cost curve, and the effective-value helpers actually changing sim
// behaviour. See Docs/features/tech-tree.md §1 rule 2.
import { afterEach, describe, expect, it } from 'vitest';
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
import { TECH_STATS, type TechEffect } from '../src/sim/data/techEffectRules';
import { buildDuration, maxDistrictCount, requiredTechForLevel, upgradeDuration } from '../src/sim/districts';
import { armyCap, trainSecondsAt, woundedCap } from '../src/sim/army';
import { drillOf, partyBoard, partyOf } from '../src/sim/expeditions';
import { partyStats, typeMultiplier } from '../src/sim/combat';
import type { GameState, TechId } from '../src/sim/state';
import { addHeroXp } from '../src/sim/heroes';
import { manaCap, manaProduction } from '../src/sim/mana';
import {
  firstClearLump, knowledgeHeld, knowledgeLump, landmarkClaimLump,
} from '../src/sim/knowledge';
import {
  addBuilt, bonusLadders, canGather, completeRanks, completeRequirements, completeTech, FOREST, freshGame, fund, ladders, map, openEveryEra, rankOf, T0, tickAt, rentStored,
} from './helpers';


/** Research one rank end to end, through the real commands — pour, then pay
 *  — the way the sheet's two presses do. A rank takes no time. */
const research = (state: ReturnType<typeof freshGame>, id: TechId) => {
  pourKnowledge(state, id);
  return researchTech(state, map, id, T0);
};

/** What `n` ranks of a ladder add to `stat`, as a fraction, read off the
 *  data — the steps are content, so the tests follow the file. */
const share = (ladder: string, n: number, stat: string): number => ladders[ladder].slice(0, n)
  .flatMap((id) => TECHNOLOGIES[id].effects.filter((e) => e.stat === stat))
  .reduce((sum, e) => sum + e.value / 100, 0);

/**
 * A stat no card carries any more (the tap, the Mana pool, the crew's walk,
 * the Knowledge lumps — cut from the tree, 2026-10) is still READ by the sim,
 * and a future card may carry it again. Its call site stays covered by lending
 * the effect to a real card for one test, the way techGoodsAndBands.test.ts
 * lends goods.
 */
const restore: Array<() => void> = [];
afterEach(() => { while (restore.length > 0) restore.pop()!(); });
const grantEffect = (state: GameState, ...effects: TechEffect[]): void => {
  // The last card of the tree: nothing a test has researched yet, so pushing
  // it is what invalidates the resolver's cache (keyed on the count done).
  const carrier = TECHNOLOGIES.GoldenAge;
  const before = carrier.effects;
  carrier.effects = effects;
  restore.push(() => { carrier.effects = before; });
  expect(state.research.completed).not.toContain('GoldenAge');
  state.research.completed.push('GoldenAge');
};

describe('researching a rank', () => {
  it('costs Gold and Knowledge and no time', () => {
    const state = freshGame();
    openEveryEra(state);
    fund(state, { Gold: 1000, Knowledge: 10 });
    completeRequirements(state, 'SawpitsI');
    const gold = getWallet(state.city.wallet, 'Gold');
    expect(TECHNOLOGIES.SawpitsI.cost.Gold).toBeGreaterThan(0);
    expect(techKnowledgeCost('SawpitsI')).toBeGreaterThan(0);
    expect('durationSeconds' in TECHNOLOGIES.SawpitsI).toBe(false);

    expect(research(state, 'SawpitsI')).toBe('Researched');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(gold - TECHNOLOGIES.SawpitsI.cost.Gold!);
    expect(knowledgeHeld(state)).toBe(10 - techKnowledgeCost('SawpitsI'));
    // Landed on the press, with no clock to run.
    expect(rankOf(state, 'Sawpits')).toBe(1);
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
    openEveryEra(state);
    completeRequirements(state, 'SawpitsI');
    expect(research(state, 'SawpitsI')).toBe('Researched');
  });

  it('rejects when poor, and runs out of ranks at the top of the ladder', () => {
    const state = freshGame();
    openEveryEra(state);
    fund(state, { Gold: 0, Knowledge: 10 });
    completeRequirements(state, 'SawpitsI');
    expect(research(state, 'SawpitsI')).toBe('NotEnoughGold');
    fund(state, { Gold: 1e9, Knowledge: 1_000_000 });
    state.city.goods = { Planks: 999, CutStone: 999, Iron: 999, Runestone: 999 };
    for (const id of ladders.Sawpits) {
      completeRequirements(state, id);
      expect(research(state, id), id).toBe('Researched');
    }
    expect(rankOf(state, 'Sawpits')).toBe(ladders.Sawpits.length);
    for (const id of ladders.Sawpits) expect(canStartTech(state, id)).toBe(false);
  });
});

describe('effects reach the sim', () => {
  // No card buys the tap any more; the stat is still read where the tap is
  // priced, and a percentage of it is a DURATION the carry pays out.
  it('tapWorkSeconds buys the tap DURATION, and the carry pays out the fraction', () => {
    const state = freshGame();
    fund(state, { Gold: 100_000 });
    canGather(state);
    const bare = tapWorkSeconds(state);
    grantEffect(state, { stat: 'tapWorkSeconds', op: 'percent', value: 80 });
    expect(tapWorkSeconds(state)).toBeCloseTo(bare * 1.8, 6);
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood'))
      .toBe(Math.floor(tapWorkSeconds(state) / HARVEST.Forest.secondsPerStrike));
  });

  // A SPEED on the gap between AUTO-taps: the cooldown is divided by it.
  it('autoTapSpeed speeds the auto-tap, and never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    expect(effectiveAutoTapCooldownMs(state)).toBe(500);
    grantEffect(state, { stat: 'autoTapSpeed', op: 'percent', value: 45 });
    const wait = effectiveAutoTapCooldownMs(state);
    expect(wait).toBeCloseTo(500 / 1.45);
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
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
    completeRanks(state, 'TradeRoutes', 1);
    expect(effectiveTaxRate(state)).toBeCloseTo(bare * (1 + share('TradeRoutes', 1, 'taxRate')));
    tickAt(state, T0 + 301_000); // ~5 minutes of it
    const perMinute = effectiveTaxRate(state, 'Housing');
    // The helper grants the rank without charging for it — the point under
    // test is the tax rate, not the price of the research.
    expect(rentStored(state)).toBe(Math.floor(perMinute * 301 / 60));
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
    ['IronPicks', 'MountainIron'],
  ];
  for (const [ladder, source] of YIELD_LADDERS) {
    it(`${ladder} is a share more ${source} for hand AND crew, and nothing else`, () => {
      const state = freshGame();
      const other = source === 'Forest' ? HARVEST.Crops : HARVEST.Forest;
      const chunk = effectiveUnitsPerStrike(state, HARVEST[source]);
      const crew = effectiveWorkerStrike(state, HARVEST[source]);
      const elsewhere = effectiveUnitsPerStrike(state, other);
      const ranks = ladders[ladder].length;
      completeRanks(state, ladder, ranks);
      const more = 1 + share(ladder, ranks, 'harvestYield');
      expect(effectiveUnitsPerStrike(state, HARVEST[source])).toBeCloseTo(chunk * more);
      expect(effectiveWorkerStrike(state, HARVEST[source])).toBeCloseTo(crew * more);
      expect(effectiveUnitsPerStrike(state, other)).toBe(elsewhere); // scoped
    });
  }

  it('crewYield is the one payroll-only dial — the crew, never the thumb', () => {
    const state = freshGame();
    const wood = effectiveWorkerStrike(state, HARVEST.Forest);
    const byHand = tapDraw(state, HARVEST.Forest, 0);
    grantEffect(state, { stat: 'crewYield', op: 'percent', value: 20 });
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBeCloseTo(wood * 1.2);
    expect(tapDraw(state, HARVEST.Forest, 0)).toBe(byHand);
  });

  // A percentage of a one-unit chunk is a fraction, and the crew CARRIES it:
  // a strike takes whole units and keeps the rest, so ten strikes bring home
  // the whole units of ten times the chunk.
  it('a crew carries the fraction a yield bonus owes it, and the average is exact', () => {
    const state = freshGame();
    completeRanks(state, 'Sawpits', 1);
    const chunk = 1 + share('Sawpits', 1, 'harvestYield');
    let carry = 0;
    let home = 0;
    for (let i = 0; i < 10; i++) {
      const { want, rest } = strikeDraw(state, HARVEST.Forest, null, carry);
      expect(rest).toBeGreaterThanOrEqual(0);
      expect(rest).toBeLessThan(1);
      home += want;
      carry = rest;
    }
    expect(home).toBe(Math.floor(10 * chunk + 1e-9));
  });

  // Regrowth is a SPEED: the stump's wait is divided by it.
  it('Reforesting and Crop Rotation speed their own regrowth, and nothing else', () => {
    const state = freshGame();
    const at = { x: 0, y: 0 };
    const forest = effectiveRecoveryMs(state, HARVEST.Forest, at);
    const crops = effectiveRecoveryMs(state, HARVEST.Crops, at);
    completeRanks(state, 'Reforesting', 2);
    expect(effectiveRecoveryMs(state, HARVEST.Forest, at))
      .toBe(Math.round(forest / (1 + share('Reforesting', 2, 'regrowthSpeed'))));
    expect(effectiveRecoveryMs(state, HARVEST.Crops, at)).toBe(crops);
    completeRanks(state, 'CropRotation', 1);
    expect(effectiveRecoveryMs(state, HARVEST.Crops, at))
      .toBe(Math.round(crops / (1 + share('CropRotation', 1, 'regrowthSpeed'))));
  });

  // A store bonus is AIMED: Granaries fill the Farm's, Woodsheds the
  // Sawmill's, and neither reaches the other.
  it('Granaries hold more in the Farm, and nothing in the Sawmill', () => {
    const state = freshGame();
    addBuilt(state, 'Farm', { x: 3, y: 1 });
    const farm = state.city.districts.at(-1)!;
    addBuilt(state, 'Sawmill', { x: 3, y: 3 });
    const mill = state.city.districts.at(-1)!;
    const cap = storageCapacity(state, farm);
    const millCap = storageCapacity(state, mill);
    expect(cap).toBeGreaterThan(0);
    completeRanks(state, 'Granaries', 2);
    expect(storageCapacity(state, farm))
      .toBe(Math.floor(cap * (1 + share('Granaries', 2, 'storageCapacity'))));
    expect(storageCapacity(state, mill)).toBe(millCap);
    completeRanks(state, 'Woodsheds', 1);
    expect(storageCapacity(state, mill))
      .toBe(Math.floor(millCap * (1 + share('Woodsheds', 1, 'storageCapacity'))));
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
    completeRanks(state, 'Carpentry', 2);
    const speed = 1 + share('Carpentry', 2, 'buildSpeed');
    const within = (got: number, want: number) => {
      expect(got).toBeGreaterThanOrEqual(Math.floor(want));
      expect(got).toBeLessThanOrEqual(Math.ceil(want));
    };
    within(buildDuration(state, 'Housing', 0, 2), build / speed);
    within(upgradeDuration(state, 'Farm', 1), up / speed);
    expect(effectiveBuildTimeMultiplier(state)).toBeCloseTo(1 / speed);
    completeRanks(state, 'Carpentry', ladders.Carpentry.length);
    expect(effectiveBuildTimeMultiplier(state)).toBeGreaterThan(0);
  });

  it('workerSpeed speeds the walk', () => {
    const state = freshGame();
    expect(effectiveWorkerSpeed(state)).toBe(WORKER.moveSpeedTilesPerSecond);
    grantEffect(state, { stat: 'workerSpeed', op: 'percent', value: 30 });
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(WORKER.moveSpeedTilesPerSecond * 1.3);
  });

  it('Schooling trains villagers faster, and soldiers not at all', () => {
    const state = freshGame();
    const th = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const barracks = state.city.districts.at(-1)!;
    const villager = trainSecondsAt(state, th.uniqueId, 'Villager');
    const warrior = trainSecondsAt(state, barracks.uniqueId, 'Warrior');
    completeRanks(state, 'Schooling', 2);
    const speed = 1 + share('Schooling', 2, 'villagerTrainingSpeed');
    expect(trainSecondsAt(state, th.uniqueId, 'Villager')).toBe(Math.max(1, Math.round(villager / speed)));
    expect(trainSecondsAt(state, barracks.uniqueId, 'Warrior')).toBe(warrior);
  });

  it('Guild Halls speed every workshop', () => {
    const state = freshGame();
    addBuilt(state, 'Carpenter', { x: 3, y: 1 });
    const shop = state.city.districts.at(-1)!;
    const need = queuedWorkMs(state, shop, 'Planks');
    completeRanks(state, 'GuildHalls', 2);
    const speed = 1 + share('GuildHalls', 2, 'workshopSpeed');
    expect(queuedWorkMs(state, shop, 'Planks')).toBe(Math.max(1000, Math.round(need / speed)));
  });
});

// The Mana pool and the Knowledge lumps: no card carries them since the
// one-tree rework, and the sim still reads every one.
describe('the Mana and Knowledge stats reach their numbers', () => {
  it('manaCap raises the whole Mana ceiling, and only the ceiling', () => {
    const state = freshGame();
    state.landmarks.claimed[LANDMARKS[0].id] = true;
    const cap = manaCap(state);
    const rate = manaProduction(state);
    grantEffect(state, { stat: 'manaCap', op: 'percent', value: 30 });
    expect(manaCap(state)).toBe(Math.round(cap * 1.3));
    expect(manaProduction(state)).toBe(rate);
  });

  it('manaRegen raises the rate, and only the rate', () => {
    const state = freshGame();
    const base = manaProduction(state);
    const cap = manaCap(state);
    grantEffect(state, { stat: 'manaRegen', op: 'percent', value: 20 });
    expect(manaProduction(state)).toBeCloseTo(base * 1.2);
    expect(manaCap(state)).toBe(cap);
  });

  it('knowledgeYield is a percentage on every lump, rounded', () => {
    const state = freshGame();
    expect(knowledgeLump(state, 100)).toBe(100);
    grantEffect(state, { stat: 'knowledgeYield', op: 'percent', value: 20 });
    expect(knowledgeLump(state, 100)).toBe(120);
    expect(knowledgeLump(state, 15)).toBe(Math.round(15 * 1.2));
    expect(knowledgeLump(state, 0)).toBe(0);
  });

  it('landmarkKnowledge raises what a claim pays, and nothing else', () => {
    const state = freshGame();
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump);
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
    grantEffect(state, { stat: 'landmarkKnowledge', op: 'percent', value: 20 });
    expect(landmarkClaimLump(state)).toBe(Math.round(KNOWLEDGE.landmarkClaimLump * 1.2));
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
  });

  it('lairKnowledge raises what a first clear pays, and nothing else', () => {
    const state = freshGame();
    grantEffect(state, { stat: 'lairKnowledge', op: 'percent', value: 40 });
    expect(firstClearLump(state)).toBe(Math.round(DELVE.firstClearKnowledge * 1.4));
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump);
  });
});

describe('the Warfare lines reach their numbers', () => {
  it('Colours is a share of what the halls can field, and nothing to a kingdom with no hall', () => {
    const state = freshGame();
    completeRanks(state, 'Colours', ladders.Colours.length);
    expect(armyCap(state), 'a banner is not a barracks').toBe(0);
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const halls = levelIndexed(DISTRICTS.Barracks.armyCapPerLevel, 1);
    expect(armyCap(state))
      .toBe(Math.round(halls * (1 + share('Colours', ladders.Colours.length, 'armyCap'))));
  });

  it('recruitSpeed trains soldiers faster, and villagers not at all', () => {
    const state = freshGame();
    const th = state.city.districts.find((d) => d.definitionId === 'Townhall')!;
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const barracks = state.city.districts.at(-1)!;
    const warrior = trainSecondsAt(state, barracks.uniqueId, 'Warrior');
    const villager = trainSecondsAt(state, th.uniqueId, 'Villager');
    grantEffect(state, { stat: 'recruitSpeed', op: 'percent', value: 30 });
    expect(trainSecondsAt(state, barracks.uniqueId, 'Warrior')).toBe(Math.max(1, Math.round(warrior / 1.3)));
    expect(trainSecondsAt(state, th.uniqueId, 'Villager')).toBe(villager);
  });

  it('infirmaryBeds is a share more room in the Infirmary', () => {
    const state = freshGame();
    addBuilt(state, 'Infirmary', { x: 3, y: 1 });
    const beds = woundedCap(state);
    expect(beds).toBeGreaterThan(0);
    grantEffect(state, { stat: 'infirmaryBeds', op: 'percent', value: 40 });
    expect(woundedCap(state)).toBe(Math.floor(beds * 1.4));
  });
});

describe('the Sagas lines reach their numbers', () => {
  it('Tales pays a hero more XP for the same grant', () => {
    const state = freshGame();
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(20);
    completeRanks(state, 'Tales', 1);
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp'))
      .toBe(20 + Math.round(20 * (1 + share('Tales', 1, 'heroXp'))));
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
    completeRanks(state, 'WarmWelcome', 1);
    expect(callStardust(state, 'basic'))
      .toBe(Math.round(base * (1 + share('WarmWelcome', 1, 'summonStardust'))));
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
    completeRanks(state, 'ShieldWall', ladders.ShieldWall.length);
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
    completeRanks(state, 'Warhorns', ladders.Warhorns.length);
    expect(partyBoard(partyOf(state, slots)).slots[0]!.dmg).toBeGreaterThan(before);
  });

  it('Vigour is a share more health for every unit', () => {
    const state = freshGame();
    const hp = melee(state).hp;
    completeRanks(state, 'Vigour', ladders.Vigour.length);
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
    // Every Housing level from 2 has a card now, a chapter each.
    expect(requiredTechForLevel('Housing', 4)).toBe('Townhouses');
    expect(levelIndexed(DISTRICTS.Housing.populationCapacityPerLevel, 3))
      .toBeGreaterThan(levelIndexed(DISTRICTS.Housing.populationCapacityPerLevel, 2));
  });

  it('Second Sanctum lets one more of its district stand', () => {
    const state = freshGame();
    const sanctum = maxDistrictCount(state, DISTRICTS.Sanctum);
    completeTech(state, 'SecondSanctum');
    expect(maxDistrictCount(state, DISTRICTS.Sanctum)).toBe(sanctum + 1);
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
