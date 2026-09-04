// Minor RANKS: the ladders that used to be levelled upgrades. Their gating,
// their cost curve, and the effective-value helpers actually changing sim
// behaviour. See Docs/features/tech-tree.md §1 rule 2.
import { describe, expect, it } from 'vitest';
import {
  DELVE, DISTRICTS, FOG, HARVEST, LANDMARKS, TECHNOLOGIES, TECH_LINES, TECH_LINE_ORDER,
  TECH_ORDER, WORKER, levelIndexed, lineParent,
} from '../src/sim/data/definitions';
import { grantArtifact } from '../src/sim/artifacts';
import { castCost } from '../src/sim/casting';
import { revealCostForCell, revealPerTap } from '../src/sim/fog';
import { collectTap } from '../src/sim/harvest';
import { salePayout, sellGoods } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import { advance } from '../src/sim/commands';
import { canStartTech, startTech, techCompletesAt } from '../src/sim/research';
import {
  effectiveAutoTapCooldownMs, effectiveBuildTimeMultiplier, effectiveSalePriceMultiplier,
  effectiveTapYield, effectiveTaxRate, effectiveWorkerSpeed, effectiveWorkerYield,
  lineMaxRank, lineRank,
} from '../src/sim/upgrades';
import { buildDuration, upgradeDuration } from '../src/sim/districts';
import { maxArmyPower, trainCost } from '../src/sim/army';
import { depthMs, effectiveHaulLoss, supplyCost } from '../src/sim/expeditions';
import { addHeroXp } from '../src/sim/heroes';
import { landmarkClaimCost } from '../src/sim/landmarks';
import { knowledgePerHour, manaCap, manaProduction } from '../src/sim/mana';
import {
  addBuilt, canGather, completeTech, FOREST, freshGame, fund, map, T0, tickAt, completeRanks } from './helpers';


/** Research one rank end to end, through the real command and the real clock
 *  — the whole point of the collapse is that a rank goes through `startTech`
 *  like anything else. */
const research = (state: ReturnType<typeof freshGame>, id: Parameters<typeof startTech>[1]) => {
  const r = startTech(state, id, T0);
  advance(state, map, T0 + TECHNOLOGIES[id].durationSeconds * 1000);
  return r;
};

describe('researching a rank', () => {
  it('costs Gold and TIME, on the curve the upgrade levels used to charge', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    completeTech(state, 'Forestry');
    // The old cost curve is preserved exactly: base 50, growth 2.2.
    expect(TECHNOLOGIES.TapPowerI.cost.Gold).toBe(50);
    expect(TECHNOLOGIES.TapPowerII.cost.Gold).toBe(110); // 50 × 2.2
    // …and unlike an upgrade, it is not instant.
    expect(TECHNOLOGIES.TapPowerI.durationSeconds).toBeGreaterThan(0);

    expect(startTech(state, 'TapPowerI', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(950);
    expect(lineRank(state, 'TapPower')).toBe(0); // not yet — it is on the clock
    advance(state, map, T0 + TECHNOLOGIES.TapPowerI.durationSeconds * 1000);
    expect(lineRank(state, 'TapPower')).toBe(1);
  });

  it('hangs off its parent technology in the tree', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    expect(startTech(state, 'TapPowerI', T0)).toBe('MissingRequirement'); // Forestry
    expect(startTech(state, 'MarketStallI', T0)).toBe('MissingRequirement'); // Market
    completeTech(state, 'Forestry');
    expect(research(state, 'TapPowerI')).toBe('Started');
    expect(startTech(state, 'MarketStallI', T0)).toBe('MissingRequirement'); // still
    completeTech(state, 'Market');
    expect(research(state, 'MarketStallI')).toBe('Started');
  });

  it('rejects when poor, and runs out of ranks at the top of the ladder', () => {
    const state = freshGame();
    state.city.wallet.Gold = 0; // the opening grant would cover the first rank
    completeTech(state, 'Forestry');
    expect(startTech(state, 'TapPowerI', T0)).toBe('NotEnoughResources');
    // Ranks II+ sit in later eras and wait on those keystones too.
    completeTech(state, 'CharterIII');
    fund(state, { Gold: 1_000_000, Knowledge: 1_000_000 });
    for (const id of TECH_LINES.TapPower) expect(research(state, id)).toBe('Started');
    expect(lineRank(state, 'TapPower')).toBe(lineMaxRank('TapPower'));
    // There is no "AtMax": the ladder simply has no further rung.
    for (const id of TECH_LINES.TapPower) expect(canStartTech(state, id)).toBe(false);
  });
});

describe('effects reach the sim', () => {
  it('TapPower increases what a collect tap yields', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    canGather(state);
    completeRanks(state, 'TapPower', 1); // +1
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2); // 1 base + 1
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

    completeRanks(state, 'QuickHands', lineMaxRank('QuickHands'));
    expect(lineRank(state, 'QuickHands')).toBe(lineMaxRank('QuickHands'));
    // 0.5 - 5x0.05 = 0.25s: still slower than a determined tapper.
    expect(effectiveAutoTapCooldownMs(state)).toBe(250);
  });

  it('QuickHands never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    completeRanks(state, 'QuickHands', lineMaxRank('QuickHands'));

    // Manual taps ignore the cooldown entirely, finished ladder or not.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    // A held repeat still waits, just less than it used to.
    expect(collectTap(state, map, FOREST, T0 + 2, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + 1 + 250, true)).toBe('Harvested');
  });

  it('MarketStall raises the Market sale prices', () => {
    const state = freshGame();
    addBuilt(state, 'Market', { x: 2, y: 0 });
    fund(state, { Gold: 1000, Wood: 100 });
    completeTech(state, 'Market');
    expect(salePayout(state, 'Wood', 100)).toBe(300);
    completeRanks(state, 'MarketStall', 1); // +5%
    expect(effectiveSalePriceMultiplier(state)).toBeCloseTo(1.05);
    expect(sellGoods(state, 'Wood', 100).gold).toBe(315);
  });

  it('TradeRoutes boosts the passive tax rate', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1;
    fund(state, { Gold: 1000 });
    completeTech(state, 'Market');
    expect(effectiveTaxRate(state)).toBe(30);
    completeRanks(state, 'TradeRoutes', 1); // +10% → 33/min
    expect(effectiveTaxRate(state)).toBeCloseTo(33);
    tickAt(state, T0 + 301_000); // ~5 min × 33/min → 165 gold (150 unboosted)
    // The helper grants the rank without charging for it — the point under
    // test is the tax rate, not the price of the research.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1000 + 165);
  });
});

// The minor lines added 2026-09-02, one per big technology that had none.
//
// The only thing worth asserting about a line is that it REACHES the sim: a
// definition with no consumer is a price tag on nothing, and that is the
// failure mode this whole file exists to catch (see `withWardenBonus`, which
// shipped inert for weeks). So each of these researches a rank and measures
// the number the player actually experiences, never the effect table.
describe('every line reaches the number it claims to', () => {
  // The tech tree groups ranks with `TECH_LINES` keyed by parent, so a
  // upgrade missing from that list is invisible IN THE GAME while still being
  // purchasable by id — which is exactly what happened to Surveying, with a
  // quest pointing the player at a node that was never drawn.
  it('shows every authored rank somewhere in the tree', () => {
    // TECH_LINES is derived from TECH_ORDER, so a rank missing from the order
    // is invisible in the game — which is exactly what happened to Surveying,
    // with a quest pointing the player at a node that was never drawn.
    for (const line of TECH_LINE_ORDER) {
      const ranks = TECH_LINES[line];
      expect(ranks.length, `${line} has no ranks`).toBeGreaterThan(0);
      for (const id of ranks) {
        expect(TECH_ORDER, `${line} rank ${id} is not in TECH_ORDER`).toContain(id);
      }
      const parent = lineParent(line);
      expect(parent, `${line} hangs off no technology, so nothing draws it`).not.toBeNull();
      expect(TECH_ORDER, `${line} hangs off an unknown technology`).toContain(parent);
    }
  });

  it('Butchery adds to what a tap on wild game yields, and to nothing else', () => {
    const state = freshGame();
    const meat = effectiveTapYield(state, HARVEST.Meat);
    const wood = effectiveTapYield(state, HARVEST.Forest);
    completeRanks(state, 'Butchery', 2);
    expect(effectiveTapYield(state, HARVEST.Meat)).toBe(meat + 2);
    expect(effectiveTapYield(state, HARVEST.Forest)).toBe(wood); // scoped
  });

  it('Scythes adds to a tap on crops', () => {
    const state = freshGame();
    const before = effectiveTapYield(state, HARVEST.Crops);
    completeRanks(state, 'Scythes', 3);
    expect(effectiveTapYield(state, HARVEST.Crops)).toBe(before + 3);
  });

  it('Sawpits and Irrigation add to worker deliveries, each to its own resource', () => {
    const state = freshGame();
    const wood = effectiveWorkerYield(state, HARVEST.Forest);
    const crops = effectiveWorkerYield(state, HARVEST.Crops);
    completeRanks(state, 'Sawpits', 2);
    expect(effectiveWorkerYield(state, HARVEST.Forest)).toBe(wood + 2);
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops);
    completeRanks(state, 'Irrigation', 1);
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops + 1);
  });

  // Pitons and Surveying buy down two DIFFERENT costs — the Gold a cell wants
  // and the taps it takes to pay it — so they have to stack without either
  // making the other pointless.
  it('Pitons discounts the Gold a cell costs, and stacks with Surveying', () => {
    const state = freshGame();
    const cell = { x: 3, y: 1 };
    const full = revealCostForCell(state, map, cell);

    completeRanks(state, 'Pitons', 2); // −20%
    const discounted = revealCostForCell(state, map, cell);
    expect(discounted).toBe(Math.max(FOG.goldPerTap, Math.round(full * 0.8)));

    // Surveying does not touch the price, only the number of presses.
    const tapsBefore = revealPerTap(state);
    completeRanks(state, 'Surveying', 1);
    expect(revealCostForCell(state, map, cell)).toBe(discounted);
    expect(revealPerTap(state)).toBe(tapsBefore + 1);
  });

  it('Pitons can never make a cell free', () => {
    const state = freshGame();
    completeRanks(state, 'Pitons', 99); // far past max, as a modifier stack might
    expect(revealCostForCell(state, map, { x: 3, y: 1 }))
      .toBeGreaterThanOrEqual(FOG.goldPerTap);
  });

  it('Resonance buys down what a relic costs to cast', () => {
    const state = freshGame();
    grantArtifact(state, 'VerdantSeal');
    const full = castCost(state, 'VerdantSeal');
    expect(full).toBeGreaterThan(0);
    completeRanks(state, 'Resonance', 2); // −40%
    expect(castCost(state, 'VerdantSeal')).toBe(Math.round(full * 0.6));
  });

  // The renderer fans a line under `lineParent(line)`, and only MAJORS have a
  // grid position to fan from. A line whose parent is itself a rank would
  // therefore be drawn nowhere at all — invisible in the game while still
  // being researchable by id. That is precisely the Surveying bug the repo
  // already shipped once, in a new costume.
  it('hangs every line under a major, so the fan has somewhere to draw it', () => {
    for (const line of TECH_LINE_ORDER) {
      const parent = lineParent(line);
      expect(parent, `${line} hangs off nothing`).not.toBeNull();
      expect(TECHNOLOGIES[parent!].node, `${line} hangs off ${parent}, which is itself a rank`)
        .not.toBeNull();
    }
  });

  // And every rank is reachable from exactly one fan: ranks after the first
  // chain off the rank before, so the whole ladder hangs from one major.
  it('chains each rank off the one before, so a ladder has a single root', () => {
    for (const line of TECH_LINE_ORDER) {
      const ranks = TECH_LINES[line];
      ranks.forEach((id, i) => {
        const requires = TECHNOLOGIES[id].requires;
        // The FIRST requirement is the ladder: the parent major for rank I,
        // the rank before for every rank after. A rank in era 2+ carries its
        // era's keystone as a second requirement, which is the era gate.
        if (i > 0) expect(requires[0], `${id} should follow ${ranks[i - 1]}`).toBe(ranks[i - 1]);
        const extra = requires.slice(1);
        expect(extra.length, `${id} has more than an era gate`).toBeLessThanOrEqual(1);
        for (const k of extra) expect(k, `${id}'s second requirement is not a keystone`).toMatch(/^(Charter|Warband|Attunement)(II|III|IV)$/);
      });
    }
  });

  // Every line hangs off a major technology, and rank I is unreachable before
  // it. A line rooted at nothing would float free of the tree entirely.
  it('is locked behind the technology its line hangs off', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    for (const line of TECH_LINE_ORDER) {
      expect(lineParent(line), `${line} hangs off nothing`).not.toBeNull();
      const first = TECH_LINES[line][0];
      expect(canStartTech(state, first), `${line} I starts with no research`).toBe(false);
    }
  });
});

// The era-2/3 hooks (Docs/features/tech-tree.md §9), first batch: Civics and
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

  it('Wayposts and Vigils each add to their own source of Knowledge', () => {
    const state = freshGame();
    state.landmarks.claimed[LANDMARKS[0].id] = true;
    state.ruinsCleared.HollowBarrow = true;
    const base = knowledgePerHour(state);
    completeRanks(state, 'Wayposts', 1);
    expect(knowledgePerHour(state)).toBe(base + 1);
    completeRanks(state, 'Vigils', 2);
    expect(knowledgePerHour(state)).toBe(base + 1 + 2);
  });

  it('Scriptorium is a percentage on the whole drip', () => {
    const state = freshGame();
    state.landmarks.claimed[LANDMARKS[0].id] = true;
    state.ruinsCleared.HollowBarrow = true;
    const base = knowledgePerHour(state);
    completeRanks(state, 'Scriptorium', 2); // +10%
    expect(knowledgePerHour(state)).toBeCloseTo(base * 1.1);
  });

  it('Pilgrimage discounts a claim, and never makes one free', () => {
    const state = freshGame();
    const def = LANDMARKS[0];
    const full = landmarkClaimCost(state, def);
    completeRanks(state, 'Pilgrimage', 3); // −15%
    expect(landmarkClaimCost(state, def)).toBe(Math.round(full * 0.85));
    expect(landmarkClaimCost(state, def)).toBeGreaterThan(0);
  });

  // Scriveners is the one hook that touches a BOUNDARY, so it is fixed when a
  // research starts and never applied retroactively: a rank landing while a
  // tech is on the desk must not move that tech's completion into the past,
  // which one-call replay and stepped ticking would then land on differently.
  it('Scriveners shortens a research that starts AFTER it, not one already running', () => {
    const state = freshGame();
    fund(state, { Gold: 99_999 });
    completeTech(state, 'Forestry');
    const full = TECHNOLOGIES.Saws.durationSeconds * 1000;
    expect(startTech(state, 'Saws', T0)).toBe('Started');
    expect(techCompletesAt(state, 'Saws')).toBe(T0 + full);

    completeRanks(state, 'Scriveners', 2); // −10%, lands mid-research
    expect(techCompletesAt(state, 'Saws'), 'must not shorten what is on the desk').toBe(T0 + full);

    // The next research is quicker.
    state.research.slotsPurchased = 1;
    expect(startTech(state, 'Agriculture', T0)).toBe('Started');
    expect(techCompletesAt(state, 'Agriculture'))
      .toBe(T0 + Math.round(TECHNOLOGIES.Agriculture.durationSeconds * 1000 * 0.9));
  });

  it('one-call replay equals stepped ticking with Scriveners landing mid-window', () => {
    // Scriveners I is started alongside a long research and completes first.
    // Both paths must agree on when the long one lands.
    const setup = () => {
      const s = freshGame();
      fund(s, { Gold: 99_999, Knowledge: 99_999 });
      // Charter IV is the six-hour keystone; Scriveners I is twenty minutes.
      // Architecture brings Charter III and every era-2 major with it.
      for (const id of ['Architecture', 'Engineering', 'DeepMining'] as const) completeTech(s, id);
      s.research.slotsPurchased = 2;
      expect(startTech(s, 'CharterIV', T0)).toBe('Started');   // long
      expect(startTech(s, 'ScrivenersI', T0)).toBe('Started'); // short
      return s;
    };
    const oneCall = setup();
    const stepped = setup();
    const END = T0 + 60 * 60_000;
    advance(oneCall, map, END);
    for (let t = 1000; t <= 60 * 60_000; t += 1000) advance(stepped, map, T0 + t);
    // The rank really did land inside the window…
    expect(oneCall.research.completed).toContain('ScrivenersI');
    expect(stepped.research.completed).toContain('ScrivenersI');
    // …and the keystone still on the desk lands at the pace it STARTED at, in
    // both paths alike — not five percent sooner because a rank arrived.
    const authored = T0 + TECHNOLOGIES.CharterIV.durationSeconds * 1000;
    expect(techCompletesAt(oneCall, 'CharterIV')).toBe(authored);
    expect(techCompletesAt(stepped, 'CharterIV')).toBe(authored);
    expect(stepped.research.completed).toEqual(oneCall.research.completed);
    expect(stepped.research.active).toEqual(oneCall.research.active);
  });
});

// Second batch: Warfare. Same discipline.
describe('the Warfare lines reach their numbers', () => {
  it('Colours adds to what the halls can field, and nothing to a kingdom with no hall', () => {
    const state = freshGame();
    completeRanks(state, 'Colours', 3); // +6
    expect(maxArmyPower(state), 'a banner is not a barracks').toBe(0);
    addBuilt(state, 'Barracks', { x: 3, y: 1 });
    const halls = levelIndexed(DISTRICTS.Barracks.armyCapPerLevel, 1);
    expect(maxArmyPower(state)).toBe(halls + 6);
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
    const full = supplyCost(state, 'HollowBarrow', null);
    completeRanks(state, 'Rations', 2); // −10%
    const cut = supplyCost(state, 'HollowBarrow', null);
    for (const c of Object.keys(full) as Array<keyof typeof full>) {
      expect(cut[c]).toBe(Math.max(1, Math.round(full[c]! * 0.9)));
    }
  });

  it('Bearers keeps more of a failed haul, down to a floor of one fifth', () => {
    const state = freshGame();
    expect(effectiveHaulLoss(state)).toBe(DELVE.failHaulLoss);
    completeRanks(state, 'Bearers', 3); // −9%
    expect(effectiveHaulLoss(state)).toBeCloseTo(DELVE.failHaulLoss - 0.09);
    expect(effectiveHaulLoss(state)).toBeGreaterThanOrEqual(0.2);
  });

  it('Pathfinders shortens every depth, through the same door a Conjunction uses', () => {
    const state = freshGame();
    const full = depthMs(state, 'HollowBarrow', 1);
    completeRanks(state, 'Pathfinders', 2); // −20%
    expect(depthMs(state, 'HollowBarrow', 1)).toBe(Math.max(1000, Math.round(full * 0.8)));
  });

  it('Drillmaster pays a hero more XP for the same delve', () => {
    const state = freshGame();
    addHeroXp(state, 'Warden', 20);
    expect(state.heroes.xp.Warden).toBe(20);
    completeRanks(state, 'Drillmaster', 2); // +10%
    addHeroXp(state, 'Warden', 20);
    expect(state.heroes.xp.Warden).toBe(42);
  });
});
