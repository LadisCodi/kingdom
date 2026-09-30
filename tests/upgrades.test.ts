// Minor RANKS: the ladders that used to be levelled upgrades. Their gating,
// their cost curve, and the effective-value helpers actually changing sim
// behaviour. See Docs/features/tech-tree.md §1 rule 2.
import { describe, expect, it } from 'vitest';
import {
  ARMY, DELVE, DISTRICTS, FOG, HARVEST, KNOWLEDGE, LANDMARKS, MANA, TECHNOLOGIES,
  TECH_ORDER, WORKER, levelIndexed,
} from '../src/sim/data/definitions';
import { grantArtifactLevel } from '../src/sim/artifacts';
import { castCost } from '../src/sim/casting';
import { effectiveDiscoverRadius, revealCostForCell, revealTapCost } from '../src/sim/fog';
import { collectTap } from '../src/sim/harvest';
import { getWallet } from '../src/sim/state';
import { researchTech } from '../src/sim/commands';
import { canStartTech, pourKnowledge, techKnowledgeCost } from '../src/sim/research';
import {
  effectiveAutoTapCooldownMs, effectiveBuildTimeMultiplier,
  effectiveTaxRate, effectiveWorkerSpeed, effectiveWorkerStrike, tapDraw,
  tapWorkSeconds,
} from '../src/sim/upgrades';
import { buildDuration, maxDistrictCount, requiredTechForLevel, upgradeDuration } from '../src/sim/districts';
import { armyCap, trainCost } from '../src/sim/army';
import { drillOf, lairSupplyCost, partyBoard, partyOf } from '../src/sim/expeditions';
import { partyStats, typeMultiplier } from '../src/sim/combat';
import type { GameState, TechId } from '../src/sim/state';
import { addHeroXp } from '../src/sim/heroes';
import { landmarkClaimCost } from '../src/sim/landmarks';
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
    completeRanks(state, 'TapPower', 5); // +20% a rank
    expect(tapWorkSeconds(state)).toBeCloseTo(bare * 2, 6);

    // A Forest strike is 10 s, so a doubled thumb owes 2 Wood a tap — and on
    // ground where it owes a fraction the remainder rides in `tapCarry`
    // until it adds up, which is what makes a percentage upgrade honest.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood'))
      .toBe(Math.floor(tapWorkSeconds(state) / HARVEST.Forest.secondsPerStrike));
  });

  // QuickHands shortens the gap between AUTO-taps only. A deliberate tap has
  // no cooldown to shave, so the line is a convenience — it narrows the gap
  // toward manual tapping without ever closing it.
  it('QuickHands shortens the auto-tap cooldown, and nothing else', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    completeTech(state, 'Forestry');
    expect(effectiveAutoTapCooldownMs(state)).toBe(500);

    completeRanks(state, 'QuickHands', 1); // -0.05s
    expect(effectiveAutoTapCooldownMs(state)).toBe(450);

    completeRanks(state, 'QuickHands', ladders.QuickHands.length);
    expect(rankOf(state, 'QuickHands')).toBe(ladders.QuickHands.length);
    // 0.5 - 5x0.05 = 0.25s: still slower than a determined tapper.
    expect(effectiveAutoTapCooldownMs(state)).toBe(250);
  });

  it('QuickHands never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    completeRanks(state, 'QuickHands', ladders.QuickHands.length);

    // Manual taps ignore the cooldown entirely, finished ladder or not.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    // A held repeat still waits, just less than it used to.
    expect(collectTap(state, map, FOREST, T0 + 2, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + 1 + 250, true)).toBe('Harvested');
  });

  it('TradeRoutes boosts the passive tax rate', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1;
    fund(state, { Gold: 1000 });
    completeRequirements(state, 'TradeRoutesI');
    const bare = effectiveTaxRate(state);
    completeRanks(state, 'TradeRoutes', 1); // +10%
    expect(effectiveTaxRate(state)).toBeCloseTo(bare * 1.1);
    tickAt(state, T0 + 301_000); // ~5 minutes of it
    // Against the rate the HOUSES actually pay, not the unaimed one: an aimed
    // bonus (Taxes I sits on Housing) reaches the collection and not the bare
    // query, and which technologies sit above the ladder is the designer's to
    // move — so the expectation is read off the city rather than written down.
    const perMinute = effectiveTaxRate(state, 'Housing');
    // The helper grants the rank without charging for it — the point under
    // test is the tax rate, not the price of the research.
    expect(stored(state, 'Gold')).toBe(Math.floor(perMinute * 301 / 60));
  });
});

// The minor lines added 2026-09-02, one per big technology that had none.
//
// The only thing worth asserting about a line is that it REACHES the sim: a
// definition with no consumer is a price tag on nothing, and that is the
// failure mode this whole file exists to catch (see `withWardenBonus`, which
// shipped inert for weeks). So each of these researches a rank and measures
// the number the player actually experiences, never the effect table.
describe('every ladder reaches the number it claims to', () => {
  // A rank missing from the tree is invisible IN THE GAME while still being
  // purchasable by id — which is exactly what happened to Surveying, with a
  // quest pointing the player at a node that was never drawn.
  it('shows every authored rank somewhere in the tree', () => {
    for (const ladder of bonusLadders) {
      const ranks = ladders[ladder];
      expect(ranks.length, `${ladder} has no ranks`).toBeGreaterThan(0);
      for (const id of ranks) {
        expect(TECH_ORDER, `${ladder} rank ${id} is not in TECH_ORDER`).toContain(id);
      }
    }
  });

  // The seven cell-scoped upgrades are ABUNDANCE OF THE GROUND, so they lift
  // the thumb and the crew alike — both draw the same depot, and that is the
  // change that unifies the two feelings (04-harvest.md §7).
  it('Butchery makes wild game richer for hand AND crew, and nothing else', () => {
    const state = freshGame();
    const meatTap = tapDraw(state, HARVEST.Meat, 0);
    const meatCrew = effectiveWorkerStrike(state, HARVEST.Meat);
    const woodTap = tapDraw(state, HARVEST.Forest, 0);
    completeRanks(state, 'Butchery', 2);
    expect(tapDraw(state, HARVEST.Meat, 0)).toBeGreaterThan(meatTap);
    expect(effectiveWorkerStrike(state, HARVEST.Meat)).toBe(meatCrew + 2);
    expect(tapDraw(state, HARVEST.Forest, 0)).toBe(woodTap); // scoped
  });

  it('Irrigation enriches crops from its second rank; the first only waters them', () => {
    // Scythes is gone (2026-09-08) and Irrigation is the one ladder on Crops.
    // Rank I moves REGROWTH, not the haul — a worker's strike is untouched by
    // it — and ranks II and III add a unit each.
    const state = freshGame();
    const base = effectiveWorkerStrike(state, HARVEST.Crops);
    completeRanks(state, 'Irrigation', 1);
    expect(effectiveWorkerStrike(state, HARVEST.Crops)).toBe(base);
    completeRanks(state, 'Irrigation', 3);
    expect(effectiveWorkerStrike(state, HARVEST.Crops)).toBe(base + 2);
  });

  it('WorkerLoad is the one payroll-only dial — the crew, never the thumb', () => {
    const state = freshGame();
    const wood = effectiveWorkerStrike(state, HARVEST.Forest);
    const byHand = tapDraw(state, HARVEST.Forest, 0);
    completeRanks(state, 'WorkerLoad', 2);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBe(wood + 2);
    expect(tapDraw(state, HARVEST.Forest, 0)).toBe(byHand);
  });

  it('Sawpits enriches the forest for the crew, and stays out of the fields', () => {
    const state = freshGame();
    const wood = effectiveWorkerStrike(state, HARVEST.Forest);
    const crops = effectiveWorkerStrike(state, HARVEST.Crops);
    completeRanks(state, 'Sawpits', 2);
    expect(effectiveWorkerStrike(state, HARVEST.Forest)).toBe(wood + 2);
    expect(effectiveWorkerStrike(state, HARVEST.Crops)).toBe(crops);
  });

  it('TapPower buys DURATION, so it never mints and never goes stale', () => {
    const state = freshGame();
    const seconds = tapWorkSeconds(state);
    completeRanks(state, 'TapPower', 5); // +20% a rank
    expect(tapWorkSeconds(state)).toBeCloseTo(seconds * 2, 6);
    // And the units follow from the ground's own rate, not from a flat bonus.
    expect(tapDraw(state, HARVEST.Forest, 0))
      .toBeCloseTo(tapWorkSeconds(state) / HARVEST.Forest.secondsPerStrike, 6);
  });

  // Pitons is the only thing left that moves the fog: a cell is five taps at
  // every ring, so the Gold is the whole of the price and a discount is the
  // whole of the relief.
  it('Pitons discounts the Gold a cell costs, and the cell is still five taps', () => {
    const state = freshGame();
    const cell = { x: 4, y: 1 };
    const full = revealCostForCell(state, map, cell);

    completeRanks(state, 'Pitons', 2); // −20%
    const discounted = revealCostForCell(state, map, cell);
    expect(discounted).toBe(Math.max(FOG.minCost, Math.round(full * 0.8)));

    // The five slices of the discounted price still add up to it exactly.
    const charges = Array.from({ length: FOG.tapsToReveal },
      (_, i) => revealTapCost(discounted, i));
    expect(charges.reduce((a, b) => a + b, 0)).toBe(discounted);
  });

  it('Pitons can never make a cell free', () => {
    const state = freshGame();
    completeRanks(state, 'Pitons', 99); // far past max, as a modifier stack might
    expect(revealCostForCell(state, map, { x: 3, y: 1 }))
      .toBeGreaterThanOrEqual(FOG.minCost);
  });

  it('Resonance buys down what a relic costs to cast', () => {
    const state = freshGame();
    grantArtifactLevel(state, 'VerdantSeal');
    const full = castCost(state, 'VerdantSeal');
    expect(full).toBeGreaterThan(0);
    completeRanks(state, 'Resonance', 2); // −40%
    expect(castCost(state, 'VerdantSeal')).toBe(Math.round(full * 0.6));
  });

  // A LADDER IS NOT A SHAPE. There is deliberately nothing here asserting
  // that rank I hangs off a major or that rank II follows rank I: a numeral
  // is a promise to the player that the bonus goes further down the book, and
  // carries no mechanism at all. Every rank is an ordinary card gated by the
  // row above it, wherever the designer puts it. What a ladder still owes is
  // its NUMERALS running I…n (`techTreeRules.ts`) and every rank reaching the
  // sim, which the cases below and `ladderEffects.test.ts` cover.

  // Every line hangs off a major technology, and rank I is unreachable before
  // it. A line rooted at nothing would float free of the tree entirely.
  it('is locked behind the technology its ladder hangs off', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    for (const ladder of bonusLadders) {
      const first = ladders[ladder][0];
      expect(canStartTech(state, first), `${ladder} I starts with no research`).toBe(false);
    }
  });
});

// The era-2/3 hooks (Docs/features/tech-tree.md §6.2), first batch: Civics and
// Magic. Same discipline as above — a line is asserted where the PLAYER meets
// the number, never on the effect table.
describe('the era-2/3 lines reach their numbers', () => {
  it('Carpentry shortens a build and an upgrade, and the floor holds', () => {
    const state = freshGame();
    const build = buildDuration(state, 'Housing', 0, 2);
    const up = upgradeDuration(state, 'Farm', 1);
    completeRanks(state, 'Carpentry', 2); // −10%
    // The multiplier is applied to the raw product BEFORE the single rounding,
    // so compare against a window rather than re-rounding a rounded number.
    const within = (got: number, want: number) => {
      expect(got).toBeGreaterThanOrEqual(Math.floor(want));
      expect(got).toBeLessThanOrEqual(Math.ceil(want));
    };
    within(buildDuration(state, 'Housing', 0, 2), build * 0.9);
    within(upgradeDuration(state, 'Farm', 1), up * 0.9);
    expect(effectiveBuildTimeMultiplier(state)).toBeCloseTo(0.9);
  });

  it('Cartage speeds the walk, and the nominal gather rate with it', () => {
    const state = freshGame();
    expect(effectiveWorkerSpeed(state)).toBe(WORKER.moveSpeedTilesPerSecond);
    completeRanks(state, 'Cartage', 3); // +15%
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(WORKER.moveSpeedTilesPerSecond * 1.15);
  });

  it('Deep Wells raises the Mana ceiling, and only the ceiling', () => {
    const state = freshGame();
    const cap = manaCap(state);
    const rate = manaProduction(state);
    completeRanks(state, 'DeepWells', 3); // +30
    expect(manaCap(state)).toBe(cap + 30);
    expect(manaProduction(state)).toBe(rate);
  });

  it('Ley Taps lets a claimed landmark touch the RATE — and only a claimed one', () => {
    const state = freshGame();
    const base = manaProduction(state);
    completeRanks(state, 'LeyTaps', 2); // +2/h per landmark
    expect(manaProduction(state), 'no landmark, no effect').toBe(base);
    state.landmarks.claimed[LANDMARKS[0].id] = true;
    expect(manaProduction(state)).toBe(base + 2);
  });

  // Knowledge from the ground is LUMPS now (07-research.md §3): Wayposts
  // raise what a landmark claim pays, Vigils what a first clear pays.
  it('Wayposts and Vigils each raise their own lump of Knowledge', () => {
    const state = freshGame();
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump);
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
    completeRanks(state, 'Wayposts', 1); // +3 a claim
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump + 3);
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge);
    completeRanks(state, 'Vigils', 2); // +5 a clear, a rank
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge + 10);
    expect(landmarkClaimLump(state)).toBe(KNOWLEDGE.landmarkClaimLump + 3);
  });

  it('Scriptorium is a percentage on every lump, rounded', () => {
    const state = freshGame();
    expect(knowledgeLump(state, 100)).toBe(100);
    completeRanks(state, 'Scriptorium', 2); // +10%
    expect(knowledgeLump(state, 100)).toBe(110);
    expect(knowledgeLump(state, 15)).toBe(Math.round(15 * 1.1));
    expect(knowledgeLump(state, 0)).toBe(0);
  });

  // Researching a lump raise late must never cost what researching it early
  // would have paid: the command pays the raise back for every site held.
  describe('a lump raise is paid back for the ground already held', () => {
    const holding = () => {
      const state = freshGame();
      openEveryEra(state);
      state.landmarks.claimed[LANDMARKS[0].id] = true;
      state.landmarks.claimed[LANDMARKS[1].id] = true;
      state.lairs.Orcs = { armedAt: 0, nextRaidAt: null, hoard: {}, cleared: true };
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
      expect(payback('WaypostsI')).toBe(2 * 3);
    });

    it('Vigils pays its raise for each lair already cleared', () => {
      expect(payback('VigilsI')).toBe(5);
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

  it('Pilgrimage discounts a claim, and never makes one free', () => {
    const state = freshGame();
    const def = LANDMARKS[0];
    const full = landmarkClaimCost(state, def);
    completeRanks(state, 'Pilgrimage', 3); // −15%
    expect(landmarkClaimCost(state, def)).toBe(Math.round(full * 0.85));
    expect(landmarkClaimCost(state, def)).toBeGreaterThan(0);
  });
});

// Second batch: Warfare. Same discipline.
describe('the Warfare lines reach their numbers', () => {
  it('Colours adds to what the halls can field, and nothing to a kingdom with no hall', () => {
    const state = freshGame();
    completeRanks(state, 'Colours', 3); // +6
    expect(armyCap(state), 'a banner is not a barracks').toBe(0);
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const halls = levelIndexed(DISTRICTS.Barracks.armyCapPerLevel, 1);
    expect(armyCap(state)).toBe(halls + 6);
  });

  it('Muster Drill discounts every coin of a recruit, floor 1', () => {
    const state = freshGame();
    const full = trainCost(state, 'Warrior');
    completeRanks(state, 'MusterDrill', 2); // −20%
    const cut = trainCost(state, 'Warrior');
    for (const c of Object.keys(full)) {
      expect(cut[c]).toBe(Math.max(1, Math.round(full[c] * 0.8)));
    }
    // A villager is priced by population, not by the drill.
    expect(trainCost(state, 'Villager')).toEqual(trainCost(freshGame(), 'Villager'));
  });

  it('Rations cuts the provisioning, and stacks with the Quartermaster', () => {
    const state = freshGame();
    const full = lairSupplyCost(state, 'Drake', []);
    completeRanks(state, 'Rations', 2); // −10%
    const cut = lairSupplyCost(state, 'Drake', []);
    for (const c of Object.keys(full) as Array<keyof typeof full>) {
      expect(cut[c]).toBe(Math.max(1, Math.round(full[c]! * 0.9)));
    }
  });

  // `Bearers` and `Salvage` bought back part of a failed delve's haul, and
  // `Pathfinders` hurried a depth's clock. The room model has neither: a
  // failed room grants nothing and deducts nothing, and a room resolves the
  // instant it is entered (Docs/features/11-expeditions.md §5). The cards are
  // still in the tree and move nothing — recorded as H8, and listed in
  // tests/ladderEffects.test.ts so the debt cannot be forgotten.


  it('Drillmaster pays a hero more XP for the same delve', () => {
    const state = freshGame();
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(20);
    completeRanks(state, 'Drillmaster', 2); // +10%
    addHeroXp(state, 20);
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBe(42);
  });
});

// Third batch: the combat lines. combat.ts is pure, so these are carried in on
// the Party as a Drill — asserted through the numbers a fight is decided by.
describe('the combat lines reach the fight', () => {
  const melee = (state: GameState) =>
    partyStats(partyOf(state, [{ unitId: 'Warrior', count: 2 }]));
  const ranged = (state: GameState) =>
    partyStats(partyOf(state, [{ unitId: 'Archer', count: 2 }]));

  it('Shield Wall hardens Melee and leaves Distance alone', () => {
    const state = freshGame();
    const m0 = melee(state).def; const r0 = ranged(state).def;
    completeRanks(state, 'ShieldWall', 2); // +2 DEF each
    expect(melee(state).def).toBe(m0 + 4);
    expect(ranged(state).def).toBe(r0);
  });

  it('Fletching sharpens Distance and leaves Melee alone', () => {
    const state = freshGame();
    const m0 = melee(state).atk; const r0 = ranged(state).atk;
    completeRanks(state, 'Fletching', 1);
    expect(ranged(state).atk).toBe(r0 + 2);
    expect(melee(state).atk).toBe(m0);
  });

  it('Barding armours Mounted — Cavalry is Mounted AND Melee, so it takes both', () => {
    const state = freshGame();
    const cav = () => partyStats(partyOf(state, [{ unitId: 'Cavalry', count: 1 }])).def;
    const c0 = cav();
    completeRanks(state, 'Barding', 1);
    completeRanks(state, 'ShieldWall', 1);
    expect(cav()).toBe(c0 + 2);
  });

  it('Warhorns lifts every unit, and reaches the swing itself', () => {
    // The drill is resolved into the BOARD now, so a rank shows up where it
    // matters: on what a squad hits for (Docs/features/combat.md §7).
    const state = freshGame();
    const slots = [{ unitId: 'Warrior' as const, count: 3 }];
    const before = partyBoard(partyOf(state, slots)).slots[0]!.dmg;
    completeRanks(state, 'Warhorns', 2); // +2 damage each
    expect(partyBoard(partyOf(state, slots)).slots[0]!.dmg).toBe(before + 2);
  });

  it('Manoeuvre softens a bad matchup, and never past neutral', () => {
    const state = freshGame();
    const bad = ARMY.typeDisadvantage;
    expect(typeMultiplier('Warrior', 'Archer')).toBe(bad); // shields lose to arrows
    completeRanks(state, 'Manoeuvre', 3); // +6%
    const drill = drillOf(state);
    expect(typeMultiplier('Warrior', 'Archer', drill.disadvantageOffset)).toBeCloseTo(bad + 0.06);
    expect(typeMultiplier('Warrior', 'Archer', 5)).toBe(1); // capped at neutral
    // The good matchup is untouched: Manoeuvre is about not wasting a trip.
    expect(typeMultiplier('Archer', 'Warrior', drill.disadvantageOffset)).toBe(ARMY.typeAdvantage);
  });
});

// Fourth: Farsight, the one hook with a DISCRETE effect at completion.
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

  // The sweep belongs to the research COMMAND: marking the rank done by hand
  // widens the radius but discovers nothing until something is placed.
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

// The era-2/3 MAJORS that work against dials the game already had.
describe('the era-2/3 majors that are live', () => {
  it('Aqueducts lets Housing reach level 3 with a third tier of beds', () => {
    // Housing reaches 10 now; Aqueducts still owns the third tier, and it is
    // the last technology on the ladder — every level above it is bought with
    // goods and a Townhall level instead (Docs/plans/builder-30-days.md §4).
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

  it('Roadworks is a quarter faster, and stacks with Cartage', () => {
    const state = freshGame();
    const base = effectiveWorkerSpeed(state);
    completeTech(state, 'Roadworks');
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(base * 1.25);
    completeRanks(state, 'Cartage', 1);
    expect(effectiveWorkerSpeed(state)).toBeCloseTo(base * 1.25 * 1.05);
  });

  it('Tactics takes a tenth off a bad matchup, through the Drill', () => {
    const state = freshGame();
    completeTech(state, 'Tactics');
    expect(drillOf(state).disadvantageOffset).toBeCloseTo(0.10);
    expect(typeMultiplier('Warrior', 'Archer', drillOf(state).disadvantageOffset))
      .toBeCloseTo(ARMY.typeDisadvantage + 0.10);
  });


  it('Meditation raises the ceiling by the authored step', () => {
    const state = freshGame();
    const cap = manaCap(state);
    completeTech(state, 'Meditation');
    expect(manaCap(state)).toBe(cap + MANA.meditationCap);
  });

  // Both raise the first-clear lump. Pushed by id, not through the chain
  // helper, so no other rank that moves a lump comes along with them.
  it('Conquest and Sanctified Ruins both raise the first-clear lump, and compose', () => {
    const state = freshGame();
    const base = DELVE.firstClearKnowledge;
    expect(firstClearLump(state)).toBe(base);
    state.research.completed.push('Conquest');
    expect(firstClearLump(state)).toBe(base + KNOWLEDGE.conquestFirstClearLump);
    state.research.completed.push('SanctifiedRuins');
    expect(firstClearLump(state)).toBe((base + KNOWLEDGE.conquestFirstClearLump) * 2);
    // Sanctified doubles Vigils too — the whole of it.
    completeRanks(state, 'Vigils', 1);
    expect(firstClearLump(state)).toBe((base + KNOWLEDGE.conquestFirstClearLump + 5) * 2);
  });

  it('Sanctified Ruins alone doubles the lump', () => {
    const state = freshGame();
    state.research.completed.push('SanctifiedRuins');
    expect(firstClearLump(state)).toBe(DELVE.firstClearKnowledge * 2);
  });
});
